//! Native double-entry stock journal embedded in the Products module.
use egui::{Context, RichText, TextEdit, Ui};
use socdof_core::domain::stock::{StockJournalEntry, StockLocation};
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{badge, button, card, empty_state, search_field_reserved, ButtonVariant, Tone};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

const LOCATIONS: [StockLocation; 5] = [
    StockLocation::Vendors,
    StockLocation::Warehouse,
    StockLocation::Customers,
    StockLocation::InventoryLoss,
    StockLocation::Scrap,
];

#[derive(Debug, Clone, PartialEq, Eq)]
struct StockMoveDraft {
    product_id: Option<Uuid>,
    quantity: String,
    source: StockLocation,
    destination: StockLocation,
    reference: String,
    notes: String,
}

impl Default for StockMoveDraft {
    fn default() -> Self {
        Self {
            product_id: None,
            quantity: "1".to_string(),
            source: StockLocation::Vendors,
            destination: StockLocation::Warehouse,
            reference: String::new(),
            notes: String::new(),
        }
    }
}

/// Search, filters, draft and result state for the stock journal.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct StockMovesState {
    pub query: String,
    pub location_filter: Option<StockLocation>,
    pub entries: Vec<StockJournalEntry>,
    pub create_open: bool,
    draft: StockMoveDraft,
    loaded_query: String,
    loaded: bool,
    pub error: Option<&'static str>,
    pub status: Option<&'static str>,
}

impl StockMovesState {
    fn refresh(&mut self, store: &Store) {
        if self.loaded && self.query == self.loaded_query {
            return;
        }
        match store.search_stock_journal_entries(&self.query) {
            Ok(entries) => {
                self.entries = entries;
                self.loaded_query.clone_from(&self.query);
                self.loaded = true;
                self.error = None;
            }
            Err(_) => self.error = Some("stock_journal_error_load"),
        }
    }

    fn save(&mut self, store: &Store, now: i64) {
        let Some(product_id) = self.draft.product_id else {
            self.error = Some("stock_journal_error_product");
            return;
        };
        let Some(quantity) = self.draft.quantity.trim().parse::<i64>().ok().filter(|n| *n > 0) else {
            self.error = Some("stock_journal_error_quantity");
            return;
        };
        if self.draft.reference.trim().is_empty() {
            self.error = Some("stock_journal_error_reference");
            return;
        }
        if self.draft.source == self.draft.destination {
            self.error = Some("stock_journal_error_locations");
            return;
        }
        let entry = StockJournalEntry {
            id: Uuid::new_v4(),
            product_id,
            product_name: None,
            product_sku: None,
            quantity,
            source_location: self.draft.source,
            dest_location: self.draft.destination,
            reference: self.draft.reference.trim().to_string(),
            notes: (!self.draft.notes.trim().is_empty()).then(|| self.draft.notes.trim().to_string()),
            created_at: now,
        };
        match store.insert_stock_journal_entry(&entry) {
            Ok(_) => {
                self.status = Some("stock_journal_saved");
                self.error = None;
                self.create_open = false;
                self.draft = StockMoveDraft::default();
                self.loaded = false;
                self.refresh(store);
            }
            Err(socdof_core::error::CoreError::Validation(code)) if code == "stock_insufficient" => {
                self.error = Some("stock_journal_error_insufficient");
            }
            Err(_) => self.error = Some("stock_journal_error_save"),
        }
    }

    fn visible_entries(&self) -> Vec<&StockJournalEntry> {
        self.entries.iter().filter(|entry| {
            self.location_filter.map_or(true, |location| {
                entry.source_location == location || entry.dest_location == location
            })
        }).collect()
    }
}

/// Renders the stock journal. Returns true when the user requests the Products list.
pub fn stock_moves_window(
    ctx: &Context,
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut StockMovesState,
    store: &Store,
    now: i64,
) -> bool {
    state.refresh(store);
    let mut back = false;
    ui.horizontal(|ui| {
        if button(ui, theme, focus, texts.get("products_back"), ButtonVariant::Ghost).activated {
            back = true;
        }
        ui.label(RichText::new(texts.get("stock_journal_title")).size(FONT_TITLE).strong());
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if button(ui, theme, focus, texts.get("stock_journal_new"), ButtonVariant::Primary).activated {
                state.create_open = true;
                if state.draft.product_id.is_none() {
                    state.draft.product_id = store.list_products().ok().and_then(|p| p.first().map(|v| v.id));
                }
            }
            if button(ui, theme, focus, texts.get("stock_journal_export"), ButtonVariant::Secondary).activated {
                export_csv(state, texts, now);
            }
        });
    });
    ui.label(RichText::new(texts.get("stock_journal_subtitle")).size(FONT_SMALL).color(theme.palette.text_muted));
    ui.add_space(8.0);
    if let Some(error) = state.error {
        badge(ui, theme, texts.get(error), Tone::Danger);
    }
    if let Some(status) = state.status {
        badge(ui, theme, texts.get(status), Tone::Success);
    }
    ui.horizontal_wrapped(|ui| {
        search_field_reserved(ui, theme, focus, &mut state.query, texts.get("stock_journal_search"), 180.0);
        egui::ComboBox::from_id_source("stock-journal-location-filter")
            .selected_text(texts.get(location_filter_key(state.location_filter)))
            .show_ui(ui, |ui| {
                ui.selectable_value(&mut state.location_filter, None, texts.get("stock_journal_location_all"));
                for location in LOCATIONS {
                    ui.selectable_value(&mut state.location_filter, Some(location), texts.get(location_key(location)));
                }
            });
    });
    state.refresh(store);
    let visible = state.visible_entries();
    let inbound: i64 = visible.iter().filter(|e| e.dest_location == StockLocation::Warehouse).map(|e| e.quantity).sum();
    let outbound: i64 = visible.iter().filter(|e| e.source_location == StockLocation::Warehouse).map(|e| e.quantity).sum();
    let virtual_moves = visible.iter().filter(|e| e.stock_delta() == 0).count();
    ui.add_space(8.0);
    ui.horizontal_wrapped(|ui| {
        for (label, value) in [
            ("stock_journal_inbound", inbound.to_string()),
            ("stock_journal_outbound", outbound.to_string()),
            ("stock_journal_virtual", virtual_moves.to_string()),
        ] {
            card(ui, theme, |ui| {
                ui.label(RichText::new(texts.get(label)).size(FONT_SMALL).color(theme.palette.text_muted));
                ui.label(RichText::new(value).size(FONT_TITLE).strong());
            });
        }
    });
    ui.add_space(8.0);
    if visible.is_empty() {
        card(ui, theme, |ui| empty_state(ui, theme, texts.get("stock_journal_empty"), texts.get("stock_journal_subtitle")));
    } else {
        card(ui, theme, |ui| {
            egui::ScrollArea::horizontal().show(ui, |ui| {
                egui::Grid::new("stock-journal-table").num_columns(7).spacing(egui::vec2(14.0, 8.0)).show(ui, |ui| {
                    for key in ["stock_journal_col_date","stock_journal_col_reference","stock_journal_col_product","stock_journal_col_from","stock_journal_col_to","stock_journal_col_quantity","stock_journal_col_notes"] {
                        ui.label(RichText::new(texts.get(key)).size(FONT_SMALL).strong().color(theme.palette.text_muted));
                    }
                    ui.end_row();
                    for entry in visible {
                        ui.label(date_label(entry.created_at));
                        ui.label(&entry.reference);
                        ui.label(entry.product_name.as_deref().unwrap_or("—"));
                        ui.label(texts.get(location_key(entry.source_location)));
                        ui.label(texts.get(location_key(entry.dest_location)));
                        let prefix = if entry.stock_delta() > 0 { "+" } else if entry.stock_delta() < 0 { "−" } else { "" };
                        ui.label(format!("{prefix}{}", entry.quantity));
                        ui.label(entry.notes.as_deref().unwrap_or("—"));
                        ui.end_row();
                    }
                });
            });
        });
    }

    create_dialog(ctx, theme, texts, focus, state, store, now);
    back
}

fn create_dialog(ctx: &Context, theme: &Theme, texts: &UiTexts, focus: &mut FocusState, state: &mut StockMovesState, store: &Store, now: i64) {
    if !state.create_open { return; }
    let products = store.list_products().unwrap_or_default();
    let mut open = state.create_open;
    let mut save = false;
    egui::Window::new(texts.get("stock_journal_new_title"))
        .id(egui::Id::new("stock-journal-create"))
        .collapsible(false)
        .resizable(true)
        .open(&mut open)
        .show(ctx, |ui| {
            egui::ComboBox::from_id_source("stock-journal-product")
                .selected_text(products.iter().find(|p| Some(p.id) == state.draft.product_id).map(|p| p.name.clone()).unwrap_or_else(|| texts.get("stock_journal_product")))
                .show_ui(ui, |ui| {
                    for product in &products {
                        ui.selectable_value(&mut state.draft.product_id, Some(product.id), format!("{} · {}", product.name, product.sku));
                    }
                });
            ui.horizontal(|ui| {
                ui.label(texts.get("stock_journal_quantity"));
                ui.add(TextEdit::singleline(&mut state.draft.quantity).desired_width(100.0));
            });
            ui.horizontal(|ui| {
                ui.label(texts.get("stock_journal_source"));
                location_combo(ui, "stock-journal-source", texts, &mut state.draft.source);
            });
            ui.horizontal(|ui| {
                ui.label(texts.get("stock_journal_destination"));
                location_combo(ui, "stock-journal-destination", texts, &mut state.draft.destination);
            });
            ui.horizontal(|ui| {
                ui.label(texts.get("stock_journal_reference"));
                ui.add(TextEdit::singleline(&mut state.draft.reference).desired_width(220.0));
            });
            ui.label(texts.get("stock_journal_notes"));
            ui.add(TextEdit::multiline(&mut state.draft.notes).desired_rows(2));
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if button(ui, theme, focus, texts.get("stock_journal_save"), ButtonVariant::Primary).activated { save = true; }
                if button(ui, theme, focus, texts.get("stock_journal_cancel"), ButtonVariant::Secondary).activated { state.create_open = false; }
            });
        });
    state.create_open = open && state.create_open;
    if save { state.save(store, now); }
}

fn location_combo(ui: &mut Ui, id: &str, texts: &UiTexts, selected: &mut StockLocation) {
    egui::ComboBox::from_id_source(id)
        .selected_text(texts.get(location_key(*selected)))
        .show_ui(ui, |ui| {
            for location in LOCATIONS {
                ui.selectable_value(selected, location, texts.get(location_key(location)));
            }
        });
}

fn location_key(location: StockLocation) -> &'static str {
    match location {
        StockLocation::Vendors => "stock_journal_location_vendors",
        StockLocation::Warehouse => "stock_journal_location_warehouse",
        StockLocation::Customers => "stock_journal_location_customers",
        StockLocation::InventoryLoss => "stock_journal_location_loss",
        StockLocation::Scrap => "stock_journal_location_scrap",
    }
}

fn location_filter_key(location: Option<StockLocation>) -> &'static str {
    location.map(location_key).unwrap_or("stock_journal_location_all")
}

fn date_label(timestamp: i64) -> String {
    let (year, month, day) = socdof_core::date::civil_from_millis(timestamp);
    format!("{day:02}.{month:02}.{year:04}")
}

fn export_csv(state: &mut StockMovesState, _texts: &UiTexts, now: i64) {
    let entries = state.visible_entries().into_iter().cloned().collect::<Vec<_>>();
    if entries.is_empty() {
        state.error = Some("stock_journal_error_export");
        return;
    }
    #[cfg(feature = "dialogs")]
    {
        let (year, month, day) = socdof_core::date::civil_from_millis(now);
        let filename = format!("stock_journal_{year:04}-{month:02}-{day:02}.csv");
        if let Some(path) = rfd::FileDialog::new().set_file_name(&filename).add_filter("CSV", &["csv"]).save_file() {
            let mut csv = String::from("\u{feff}date;reference;product;sku;source;destination;quantity;notes\n");
            for entry in &entries {
                let row = [
                    date_label(entry.created_at),
                    entry.reference.clone(),
                    entry.product_name.clone().unwrap_or_default(),
                    entry.product_sku.clone().unwrap_or_default(),
                    entry.source_location.as_str().to_string(),
                    entry.dest_location.as_str().to_string(),
                    entry.quantity.to_string(),
                    entry.notes.clone().unwrap_or_default(),
                ];
                csv.push_str(&row.iter().map(|value| csv_escape(value)).collect::<Vec<_>>().join(";"));
                csv.push('\n');
            }
            match std::fs::write(path, csv) {
                Ok(()) => { state.status = Some("stock_journal_exported"); state.error = None; }
                Err(_) => state.error = Some("stock_journal_error_export"),
            }
        }
    }
    #[cfg(not(feature = "dialogs"))]
    {
        let _ = (entries, texts, now);
        state.error = Some("stock_journal_error_export");
    }
}

fn csv_escape(value: &str) -> String {
    if value.chars().any(|character| matches!(character, ';' | '"' | '\n' | '\r')) {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}
