//! Native restaurant operations backed by the shared SQLite store.
use crate::components::{button, ButtonVariant};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::FONT_SMALL;
use egui::{Context, RichText};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::pos::{PaymentMethod as PosPaymentMethod, PosOrder, PosOrderLine};
use socdof_core::domain::restaurant::{self, MenuItem, RestaurantTable, TableOrder};
use socdof_core::money::Money;
use socdof_core::store::Store;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum RestaurantView {
    #[default]
    Tables,
    Kitchen,
    Menu,
    History,
}

#[derive(Debug, Clone)]
pub struct RestaurantState {
    pub menu: Vec<MenuItem>,
    pub orders: Vec<TableOrder>,
    pub tables: Vec<RestaurantTable>,
    pub view: RestaurantView,
    pub selected_table: String,
    pub area_filter: String,
    pub query: String,
    pub category_filter: String,
    pub dish_draft: Option<MenuItem>,
    pub dish_is_new: bool,
    pub payment_method: String,
    pub tip_cents: i64,
    pub cash_given_cents: i64,
    pub split_count: i64,
    pub hospitality: bool,
    pub hospitality_host: String,
    pub hospitality_occasion: String,
    pub hospitality_guests: String,
    pub last_receipt: Option<String>,
    pub error: Option<String>,
    pub status: Option<String>,
    pub back: bool,
}

impl Default for RestaurantState {
    fn default() -> Self {
        let tables = restaurant::tables();
        Self {
            menu: Vec::new(),
            orders: Vec::new(),
            selected_table: tables
                .first()
                .map(|table| table.name.clone())
                .unwrap_or_default(),
            tables,
            view: RestaurantView::Tables,
            area_filter: "all".into(),
            query: String::new(),
            category_filter: "all".into(),
            dish_draft: None,
            dish_is_new: false,
            payment_method: "cash".into(),
            tip_cents: 0,
            cash_given_cents: 0,
            split_count: 1,
            hospitality: false,
            hospitality_host: String::new(),
            hospitality_occasion: String::new(),
            hospitality_guests: String::new(),
            last_receipt: None,
            error: None,
            status: None,
            back: false,
        }
    }
}

impl RestaurantState {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.menu = store.restaurant_menu()?;
        self.orders = store.restaurant_orders()?;
        if !self
            .tables
            .iter()
            .any(|table| table.name == self.selected_table)
        {
            self.selected_table = self
                .tables
                .first()
                .map(|table| table.name.clone())
                .unwrap_or_default();
        }
        Ok(())
    }
    pub fn reset_for_open(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.view = RestaurantView::Tables;
        self.area_filter = "all".into();
        self.query.clear();
        self.category_filter = "all".into();
        self.dish_draft = None;
        self.error = None;
        self.status = None;
        self.refresh(store)
    }
    pub fn active_order(&self) -> Option<&TableOrder> {
        self.orders
            .iter()
            .find(|order| order.table_number == self.selected_table && order.status != "paid")
    }
    pub fn start_new_dish(&mut self, now: i64) {
        self.dish_draft = Some(MenuItem {
            id: Uuid::new_v4(),
            name: String::new(),
            category: "mains".into(),
            price_cents: 0,
            tax_rate_bp: 1_900,
            ingredients: String::new(),
            allergens: Vec::new(),
            emoji: "🍽️".into(),
            prep_time_minutes: 15,
            is_available: true,
            created_at: now,
        });
        self.dish_is_new = true;
        self.error = None;
    }
    pub fn edit_dish(&mut self, id: Uuid) {
        self.dish_draft = self.menu.iter().find(|dish| dish.id == id).cloned();
        self.dish_is_new = false;
        self.error = None;
    }
    pub fn save_dish(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(mut dish) = self.dish_draft.clone() else {
            return Ok(());
        };
        dish.normalize();
        dish.validate()
            .map_err(socdof_core::CoreError::Validation)?;
        if self.dish_is_new {
            store.insert_restaurant_menu_item(&dish)?;
        } else {
            store.update_restaurant_menu_item(&dish)?;
        }
        self.dish_draft = None;
        self.status = Some("restaurant_dish_saved".into());
        self.refresh(store)
    }
    pub fn delete_dish(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        store.delete_restaurant_menu_item(id)?;
        self.status = Some("restaurant_dish_deleted".into());
        self.refresh(store)
    }
    pub fn add_item(&mut self, store: &Store, id: Uuid, now: i64) -> socdof_core::CoreResult<()> {
        let dish = store
            .restaurant_menu_item(id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(id.to_string()))?;
        if !dish.is_available {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_dish_unavailable".into(),
            ));
        }
        let mut order = store
            .restaurant_open_order(&self.selected_table)?
            .unwrap_or_else(|| TableOrder::new(&self.selected_table, now));
        order.add_menu_item(&dish, now);
        store.save_restaurant_order(&order)?;
        self.refresh(store)
    }
    pub fn set_quantity(
        &mut self,
        store: &Store,
        order_id: Uuid,
        item_id: Uuid,
        qty: i64,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        let mut order = store
            .restaurant_order(order_id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(order_id.to_string()))?;
        if order.status == "paid" {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_order_already_paid".into(),
            ));
        }
        if !order.set_item_qty(item_id, qty, now) {
            store.delete_restaurant_order(order_id)?;
        } else {
            store.update_restaurant_order(&order)?;
        }
        self.refresh(store)
    }
    pub fn set_notes(
        &mut self,
        store: &Store,
        order_id: Uuid,
        item_id: Uuid,
        notes: &str,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        let mut order = store
            .restaurant_order(order_id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(order_id.to_string()))?;
        if !order.set_item_notes(item_id, notes, now) {
            return Err(socdof_core::CoreError::NotFound(item_id.to_string()));
        }
        store.update_restaurant_order(&order)?;
        self.refresh(store)
    }
    pub fn set_status(
        &mut self,
        store: &Store,
        id: Uuid,
        status: &str,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        if !restaurant::valid_status(status) || status == "paid" {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_order_status_invalid".into(),
            ));
        }
        let mut order = store
            .restaurant_order(id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(id.to_string()))?;
        if order.status == "paid" {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_order_already_paid".into(),
            ));
        }
        order.status = status.into();
        order.updated_at = now;
        store.update_restaurant_order(&order)?;
        self.refresh(store)
    }
    pub fn set_server(
        &mut self,
        store: &Store,
        id: Uuid,
        name: &str,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        let mut order = store
            .restaurant_order(id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(id.to_string()))?;
        if order.status == "paid" {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_order_already_paid".into(),
            ));
        }
        order.server_name = name.trim().into();
        order.updated_at = now;
        store.update_restaurant_order(&order)?;
        self.refresh(store)
    }
    pub fn cancel_order(&mut self, store: &Store, id: Uuid) -> socdof_core::CoreResult<()> {
        let order = store
            .restaurant_order(id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(id.to_string()))?;
        if order.status == "paid" {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_order_already_paid".into(),
            ));
        }
        store.delete_restaurant_order(id)?;
        self.status = Some("restaurant_order_deleted".into());
        self.refresh(store)
    }
    pub fn checkout(
        &mut self,
        store: &Store,
        id: Uuid,
        now: i64,
    ) -> socdof_core::CoreResult<String> {
        if !restaurant::valid_payment_method(&self.payment_method) {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_payment_method_invalid".into(),
            ));
        }
        let order = store
            .restaurant_order(id)?
            .ok_or_else(|| socdof_core::CoreError::NotFound(id.to_string()))?;
        if order.status == "paid" || order.items.is_empty() {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_order_items_required".into(),
            ));
        }
        let total_with_tip = order.total_cents.saturating_add(self.tip_cents.max(0));
        let cash = if self.payment_method == "cash" {
            Some(self.cash_given_cents)
        } else {
            None
        };
        if cash.is_some_and(|given| given < total_with_tip) {
            return Err(socdof_core::CoreError::Validation(
                "restaurant_cash_too_low".into(),
            ));
        }
        let (year, _, _) = socdof_core::date::civil_from_millis(now);
        let number = store.restaurant_receipt_number(year)?;
        let company = store.company_profile()?;
        let contact = store.restaurant_walk_in_contact(now)?;
        let currency = if company.currency.trim().is_empty() {
            "€".to_string()
        } else {
            company.currency.clone()
        };
        let mut paid = order.clone();
        paid.status = "paid".into();
        paid.payment_method = Some(self.payment_method.clone());
        paid.paid_at = Some(now);
        paid.tip_cents = self.tip_cents.max(0);
        paid.cash_tendered_cents = cash;
        paid.cash_change_cents = cash.map(|given| (given - total_with_tip).max(0));
        paid.is_hospitality_receipt = self.hospitality;
        paid.hospitality_host = self.hospitality_host.trim().into();
        paid.hospitality_occasion = self.hospitality_occasion.trim().into();
        paid.hospitality_guests = self.hospitality_guests.trim().into();
        paid.receipt_number = Some(number.clone());
        paid.invoice_id = Some(Uuid::new_v4());
        paid.updated_at = now;
        paid.recalculate();
        let note = if paid.is_hospitality_receipt {
            format!("Bewirtungsbeleg: Anlass: {} • Bewirtete Personen: {} • Gastgeber: {} • Zahlart: {}",
                if paid.hospitality_occasion.is_empty() {"Geschäftsessen"} else {&paid.hospitality_occasion},
                if paid.hospitality_guests.is_empty() {"Gäste"} else {&paid.hospitality_guests},
                if paid.hospitality_host.is_empty() {&company.name} else {&paid.hospitality_host}, self.payment_method.to_uppercase())
        } else {
            format!(
                "Gastronomie Kassenbeleg • {} • Zahlart: {}",
                paid.table_number,
                self.payment_method.to_uppercase()
            )
        };
        let invoice = Invoice {
            id: paid.invoice_id.unwrap_or_else(Uuid::new_v4),
            number: number.clone(),
            contact_id: contact.id,
            status: InvoiceStatus::Paid,
            issued_at: now,
            due_at: now,
            currency_symbol: currency.clone(),
            note: Some(note.clone()),
            tax_total_override_cents: Some(paid.tax_total_cents),
            lines: paid
                .items
                .iter()
                .map(|item| InvoiceLine {
                    description: item.name.clone(),
                    quantity_milli: item.qty * 1_000,
                    unit_price: Money::from_cents(item.price_cents),
                    tax_rate_bp: item.tax_rate_bp,
                })
                .collect(),
        };
        let method = if self.payment_method == "cash" {
            PosPaymentMethod::Cash
        } else {
            PosPaymentMethod::Card
        };
        let receipt = PosOrder {
            id: Uuid::new_v4(),
            receipt_number: number.clone(),
            contact_id: Some(contact.id),
            payment_method: method,
            paid_at: now,
            currency_symbol: currency,
            note: Some(note),
            tax_total_override_cents: Some(paid.tax_total_cents),
            cash_given: cash.map(Money::from_cents),
            lines: paid
                .items
                .iter()
                .map(|item| PosOrderLine {
                    product_id: None,
                    description: item.name.clone(),
                    quantity_milli: item.qty * 1_000,
                    unit_price: Money::from_cents(item.price_cents),
                    tax_rate_bp: item.tax_rate_bp,
                })
                .collect(),
            legacy_id: None,
        };
        store.restaurant_checkout(&paid, &invoice, &receipt)?;
        self.last_receipt = Some(number.clone());
        self.status = Some("restaurant_checkout_saved".into());
        self.tip_cents = 0;
        self.cash_given_cents = 0;
        self.hospitality = false;
        self.refresh(store)?;
        Ok(number)
    }
}

fn money(cents: i64, currency: &str) -> String {
    format!("{:.2} {}", cents as f64 / 100.0, currency)
}
fn status_key(status: &str) -> &'static str {
    match status {
        "preparing" => "restaurant_status_preparing",
        "ready" => "restaurant_status_ready",
        "served" => "restaurant_status_served",
        "paid" => "restaurant_status_paid",
        _ => "restaurant_status_ordered",
    }
}
fn feedback(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &RestaurantState) {
    if let Some(error) = &state.error {
        ui.label(
            RichText::new(error)
                .size(FONT_SMALL)
                .color(theme.palette.danger),
        );
    }
    if let Some(status) = &state.status {
        ui.label(
            RichText::new(texts.get(status))
                .size(FONT_SMALL)
                .color(theme.palette.success),
        );
    }
}

pub fn restaurant(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut RestaurantState,
    store: &Store,
    now: i64,
) {
    if ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        if state.dish_draft.is_some() {
            state.dish_draft = None;
        } else {
            state.back = true;
        }
    }
    if let Err(error) = state.refresh(store) {
        state.error = Some(error.to_string());
    }
    let currency = store
        .company_profile()
        .map(|profile| profile.currency)
        .unwrap_or_else(|_| "€".into());
    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                crate::chrome::module_header(
                    ui,
                    theme,
                    texts,
                    focus,
                    crate::chrome::ModuleHeader {
                        app: crate::chrome::app_chrome("restaurant"),
                        title: texts.get("restaurant_title"),
                        subtitle: texts.get("restaurant_subtitle"),
                        status: None,
                    },
                    &mut state.back,
                );
                #[cfg(feature = "dialogs")]
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("restaurant_export"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    match export_csv(store) {
                        Ok(Some(path)) => {
                            state.status =
                                Some(format!("{}: {}", texts.get("restaurant_exported"), path))
                        }
                        Ok(None) => {}
                        Err(error) => state.error = Some(error.to_string()),
                    }
                }
                let open = state.orders.iter().filter(|o| o.status != "paid").count();
                let kitchen = state
                    .orders
                    .iter()
                    .filter(|o| o.status == "ordered" || o.status == "preparing")
                    .count();
                let today_key = socdof_core::date::civil_from_millis(now);
                let today_paid: Vec<&TableOrder> = state
                    .orders
                    .iter()
                    .filter(|o| {
                        o.status == "paid"
                            && o.paid_at.is_some_and(|at| {
                                socdof_core::date::civil_from_millis(at) == today_key
                            })
                    })
                    .collect();
                let revenue: i64 = today_paid.iter().map(|o| o.total_cents).sum();
                let cash_sales: i64 = today_paid
                    .iter()
                    .filter(|o| o.payment_method.as_deref() == Some("cash"))
                    .map(|o| o.total_cents)
                    .sum();
                let card_sales = revenue - cash_sales;
                let tax_total: i64 = today_paid.iter().map(|o| o.tax_total_cents).sum();
                ui.horizontal_wrapped(|ui| {
                    for (label, value) in [
                        (texts.get("restaurant_kpi_open"), open.to_string()),
                        (texts.get("restaurant_kpi_kitchen"), kitchen.to_string()),
                        (
                            texts.get("restaurant_kpi_revenue"),
                            money(revenue, &currency),
                        ),
                        (
                            texts.get("restaurant_kpi_menu"),
                            state.menu.len().to_string(),
                        ),
                        (
                            texts.get("restaurant_kpi_today_orders"),
                            today_paid.len().to_string(),
                        ),
                        (
                            texts.get("restaurant_kpi_cash"),
                            money(cash_sales, &currency),
                        ),
                        (
                            texts.get("restaurant_kpi_card"),
                            money(card_sales, &currency),
                        ),
                        (texts.get("restaurant_kpi_tax"), money(tax_total, &currency)),
                    ] {
                        crate::components::card(ui, theme, |ui| {
                            ui.label(
                                RichText::new(label)
                                    .size(FONT_SMALL)
                                    .color(theme.palette.text_muted),
                            );
                            ui.heading(value);
                        });
                    }
                });
                feedback(ui, theme, texts, state);
                ui.horizontal_wrapped(|ui| {
                    for (view, key) in [
                        (RestaurantView::Tables, "restaurant_tab_tables"),
                        (RestaurantView::Kitchen, "restaurant_tab_kitchen"),
                        (RestaurantView::Menu, "restaurant_tab_menu"),
                        (RestaurantView::History, "restaurant_tab_history"),
                    ] {
                        if ui
                            .selectable_label(state.view == view, texts.get(key))
                            .clicked()
                        {
                            state.view = view;
                        }
                    }
                    if state.view == RestaurantView::Menu
                        && button(
                            ui,
                            theme,
                            focus,
                            texts.get("restaurant_new_dish"),
                            ButtonVariant::Primary,
                        )
                        .activated
                    {
                        state.start_new_dish(now);
                    }
                });
                ui.separator();
                match state.view {
                    RestaurantView::Tables => {
                        ui.horizontal_wrapped(|ui| {
                            for (area, key) in [
                                ("all", "restaurant_area_all"),
                                ("indoor", "restaurant_area_indoor"),
                                ("terrace", "restaurant_area_terrace"),
                                ("bar", "restaurant_area_bar"),
                                ("togo", "restaurant_area_togo"),
                            ] {
                                if ui
                                    .selectable_label(state.area_filter == area, texts.get(key))
                                    .clicked()
                                {
                                    state.area_filter = area.into();
                                }
                            }
                        });
                        let tables: Vec<_> = state
                            .tables
                            .iter()
                            .filter(|t| state.area_filter == "all" || t.area == state.area_filter)
                            .cloned()
                            .collect();
                        egui::Grid::new("restaurant-floor")
                            .num_columns(4)
                            .spacing([10.0, 10.0])
                            .show(ui, |ui| {
                                for (i, table) in tables.iter().enumerate() {
                                    let order = state.orders.iter().find(|o| {
                                        o.table_number == table.name && o.status != "paid"
                                    });
                                    let label = format!(
                                        "{}\n{}",
                                        table.name,
                                        order
                                            .map(|o| texts.get(status_key(&o.status)))
                                            .unwrap_or(texts.get("restaurant_free"))
                                    );
                                    if ui
                                        .selectable_label(state.selected_table == table.name, label)
                                        .clicked()
                                    {
                                        state.selected_table = table.name.clone();
                                    }
                                    if i % 4 == 3 {
                                        ui.end_row();
                                    }
                                }
                            });
                        ui.separator();
                        ui.heading(format!(
                            "{} {}",
                            texts.get("restaurant_order_for"),
                            state.selected_table
                        ));
                        if let Some(order) = state.active_order().cloned() {
                            ui.horizontal_wrapped(|ui| {
                                ui.label(texts.get("restaurant_server"));
                                let mut server = order.server_name.clone();
                                if ui
                                    .add(
                                        egui::TextEdit::singleline(&mut server)
                                            .desired_width(130.0),
                                    )
                                    .lost_focus()
                                {
                                    if let Err(e) = state.set_server(store, order.id, &server, now)
                                    {
                                        state.error = Some(e.to_string());
                                    }
                                }
                                ui.label(texts.get(status_key(&order.status)));
                                if button(
                                    ui,
                                    theme,
                                    focus,
                                    texts.get("restaurant_send_kitchen"),
                                    ButtonVariant::Secondary,
                                )
                                .activated
                                {
                                    if let Err(e) =
                                        state.set_status(store, order.id, "preparing", now)
                                    {
                                        state.error = Some(e.to_string());
                                    }
                                }
                                if button(
                                    ui,
                                    theme,
                                    focus,
                                    texts.get("restaurant_cancel_order"),
                                    ButtonVariant::Danger,
                                )
                                .activated
                                {
                                    if let Err(e) = state.cancel_order(store, order.id) {
                                        state.error = Some(e.to_string());
                                    }
                                }
                            });
                            for item in &order.items {
                                ui.horizontal_wrapped(|ui| {
                                    ui.label(format!(
                                        "{} {} ×{} · {}",
                                        item.emoji,
                                        item.name,
                                        item.qty,
                                        money(item.gross().cents(), &currency)
                                    ));
                                    if ui.small_button("−").clicked() {
                                        if let Err(e) = state.set_quantity(
                                            store,
                                            order.id,
                                            item.id,
                                            item.qty - 1,
                                            now,
                                        ) {
                                            state.error = Some(e.to_string());
                                        }
                                    }
                                    if ui.small_button("+").clicked() {
                                        if let Err(e) = state.set_quantity(
                                            store,
                                            order.id,
                                            item.id,
                                            item.qty + 1,
                                            now,
                                        ) {
                                            state.error = Some(e.to_string());
                                        }
                                    }
                                });
                                let mut notes = item.notes.clone();
                                ui.horizontal(|ui| {
                                    ui.label(texts.get("restaurant_item_note"));
                                    if ui
                                        .add(
                                            egui::TextEdit::singleline(&mut notes)
                                                .desired_width(260.0),
                                        )
                                        .lost_focus()
                                    {
                                        if let Err(e) =
                                            state.set_notes(store, order.id, item.id, &notes, now)
                                        {
                                            state.error = Some(e.to_string());
                                        }
                                    }
                                });
                            }
                            ui.label(format!(
                                "{}: {}",
                                texts.get("restaurant_total"),
                                money(order.total_cents, &currency)
                            ));
                            ui.label(format!(
                                "{}: {}",
                                texts.get("restaurant_per_person"),
                                money(
                                    (order.total_cents + state.tip_cents.max(0))
                                        / state.split_count.max(1),
                                    &currency
                                )
                            ));
                            ui.horizontal_wrapped(|ui| {
                                ui.label(texts.get("restaurant_payment"));
                                egui::ComboBox::from_id_source("restaurant-payment")
                                    .selected_text(state.payment_method.clone())
                                    .show_ui(ui, |ui| {
                                        for method in ["cash", "card", "nfc"] {
                                            ui.selectable_value(
                                                &mut state.payment_method,
                                                method.into(),
                                                method,
                                            );
                                        }
                                    });
                                ui.label(texts.get("restaurant_tip_cents"));
                                ui.add(
                                    egui::DragValue::new(&mut state.tip_cents)
                                        .clamp_range(0..=10_000_000),
                                );
                                ui.label(texts.get("restaurant_split_count"));
                                ui.add(
                                    egui::DragValue::new(&mut state.split_count)
                                        .clamp_range(1..=50),
                                );
                                if state.payment_method == "cash" {
                                    ui.label(texts.get("restaurant_cash_given"));
                                    ui.add(
                                        egui::DragValue::new(&mut state.cash_given_cents)
                                            .clamp_range(0..=100_000_000),
                                    );
                                }
                            });
                            ui.checkbox(
                                &mut state.hospitality,
                                texts.get("restaurant_hospitality"),
                            );
                            if state.hospitality {
                                ui.horizontal_wrapped(|ui| {
                                    ui.label(texts.get("restaurant_host"));
                                    ui.text_edit_singleline(&mut state.hospitality_host);
                                    ui.label(texts.get("restaurant_occasion"));
                                    ui.text_edit_singleline(&mut state.hospitality_occasion);
                                    ui.label(texts.get("restaurant_guests"));
                                    ui.text_edit_singleline(&mut state.hospitality_guests);
                                });
                            }
                            if button(
                                ui,
                                theme,
                                focus,
                                texts.get("restaurant_checkout"),
                                ButtonVariant::Primary,
                            )
                            .activated
                            {
                                match state.checkout(store, order.id, now) {
                                    Ok(_) => {}
                                    Err(e) => state.error = Some(e.to_string()),
                                }
                            }
                        } else {
                            ui.label(texts.get("restaurant_no_order"));
                        }
                        ui.separator();
                        ui.heading(texts.get("restaurant_quick_menu"));
                        ui.horizontal_wrapped(|ui| {
                            ui.label(texts.get("restaurant_search"));
                            ui.text_edit_singleline(&mut state.query);
                            egui::ComboBox::from_id_source("restaurant-quick-category")
                                .selected_text(if state.category_filter == "all" {
                                    texts.get("restaurant_all").to_string()
                                } else {
                                    state.category_filter.clone()
                                })
                                .show_ui(ui, |ui| {
                                    ui.selectable_value(
                                        &mut state.category_filter,
                                        "all".to_string(),
                                        texts.get("restaurant_all"),
                                    );
                                    for category in restaurant::CATEGORIES {
                                        ui.selectable_value(
                                            &mut state.category_filter,
                                            category.to_string(),
                                            category,
                                        );
                                    }
                                });
                        });
                        ui.horizontal_wrapped(|ui| {
                            for dish in state
                                .menu
                                .iter()
                                .filter(|d| {
                                    d.is_available
                                        && (state.query.is_empty()
                                            || d.name
                                                .to_lowercase()
                                                .contains(&state.query.to_lowercase()))
                                        && (state.category_filter == "all"
                                            || d.category == state.category_filter)
                                })
                                .cloned()
                                .collect::<Vec<_>>()
                            {
                                if ui
                                    .button(format!(
                                        "{} {} · {}",
                                        dish.emoji,
                                        dish.name,
                                        money(dish.gross().cents(), &currency)
                                    ))
                                    .clicked()
                                {
                                    if let Err(e) = state.add_item(store, dish.id, now) {
                                        state.error = Some(e.to_string());
                                    }
                                }
                            }
                        });
                    }
                    RestaurantView::Kitchen => {
                        let orders: Vec<_> = state
                            .orders
                            .iter()
                            .filter(|o| o.status != "paid")
                            .cloned()
                            .collect();
                        for order in &orders {
                            crate::components::card(ui, theme, |ui| {
                                ui.heading(&order.table_number);
                                ui.label(format!(
                                    "{}: {}",
                                    texts.get("restaurant_server"),
                                    order.server_name
                                ));
                                for item in &order.items {
                                    ui.label(format!("{} ×{} {}", item.name, item.qty, item.notes));
                                }
                                ui.horizontal_wrapped(|ui| {
                                    for (status, key) in [
                                        ("ordered", "restaurant_status_ordered"),
                                        ("preparing", "restaurant_status_preparing"),
                                        ("ready", "restaurant_status_ready"),
                                        ("served", "restaurant_status_served"),
                                    ] {
                                        if button(
                                            ui,
                                            theme,
                                            focus,
                                            texts.get(key),
                                            ButtonVariant::Secondary,
                                        )
                                        .activated
                                        {
                                            if let Err(e) =
                                                state.set_status(store, order.id, status, now)
                                            {
                                                state.error = Some(e.to_string());
                                            }
                                        }
                                    }
                                });
                            });
                        }
                        if orders.is_empty() {
                            ui.label(texts.get("restaurant_kitchen_empty"));
                        }
                    }
                    RestaurantView::Menu => {
                        ui.horizontal_wrapped(|ui| {
                            ui.label(texts.get("restaurant_search"));
                            ui.text_edit_singleline(&mut state.query);
                            egui::ComboBox::from_id_source("restaurant-menu-category")
                                .selected_text(if state.category_filter == "all" {
                                    texts.get("restaurant_all").to_string()
                                } else {
                                    state.category_filter.clone()
                                })
                                .show_ui(ui, |ui| {
                                    ui.selectable_value(
                                        &mut state.category_filter,
                                        "all".to_string(),
                                        texts.get("restaurant_all"),
                                    );
                                    for category in restaurant::CATEGORIES {
                                        ui.selectable_value(
                                            &mut state.category_filter,
                                            category.to_string(),
                                            category,
                                        );
                                    }
                                });
                        });
                        let mut save_dish = false;
                        let mut cancel_dish = false;
                        if let Some(dish) = state.dish_draft.as_mut() {
                            crate::components::card(ui, theme, |ui| {
                                ui.heading(texts.get("restaurant_dish_editor"));
                                egui::Grid::new("restaurant-dish-form").num_columns(2).show(
                                    ui,
                                    |ui| {
                                        ui.label(texts.get("restaurant_name"));
                                        ui.text_edit_singleline(&mut dish.name);
                                        ui.end_row();
                                        ui.label(texts.get("restaurant_category"));
                                        egui::ComboBox::from_id_source("restaurant-dish-cat")
                                            .selected_text(dish.category.clone())
                                            .show_ui(ui, |ui| {
                                                for cat in restaurant::CATEGORIES {
                                                    ui.selectable_value(
                                                        &mut dish.category,
                                                        cat.into(),
                                                        cat,
                                                    );
                                                }
                                            });
                                        ui.end_row();
                                        ui.label(texts.get("restaurant_price_cents"));
                                        ui.add(
                                            egui::DragValue::new(&mut dish.price_cents)
                                                .clamp_range(0..=100_000_000),
                                        );
                                        ui.end_row();
                                        ui.label(texts.get("restaurant_tax_bp"));
                                        ui.add(
                                            egui::DragValue::new(&mut dish.tax_rate_bp)
                                                .clamp_range(0..=10_000),
                                        );
                                        ui.end_row();
                                        ui.label(texts.get("restaurant_ingredients"));
                                        ui.text_edit_singleline(&mut dish.ingredients);
                                        ui.end_row();
                                        ui.label(texts.get("restaurant_allergens"));
                                        let mut allergens = dish.allergens.join(", ");
                                        if ui.text_edit_singleline(&mut allergens).changed() {
                                            dish.allergens = allergens
                                                .split(',')
                                                .map(|value| value.trim().to_string())
                                                .filter(|value| !value.is_empty())
                                                .collect();
                                        }
                                        ui.end_row();
                                        ui.label(texts.get("restaurant_prep"));
                                        ui.add(
                                            egui::DragValue::new(&mut dish.prep_time_minutes)
                                                .clamp_range(0..=600),
                                        );
                                        ui.end_row();
                                        ui.label(texts.get("restaurant_available"));
                                        ui.checkbox(&mut dish.is_available, "");
                                        ui.end_row();
                                    },
                                );
                                ui.horizontal(|ui| {
                                    if button(
                                        ui,
                                        theme,
                                        focus,
                                        texts.get("restaurant_save"),
                                        ButtonVariant::Primary,
                                    )
                                    .activated
                                    {
                                        save_dish = true;
                                    }
                                    if button(
                                        ui,
                                        theme,
                                        focus,
                                        texts.get("restaurant_cancel"),
                                        ButtonVariant::Ghost,
                                    )
                                    .activated
                                    {
                                        cancel_dish = true;
                                    }
                                });
                            });
                        }
                        if save_dish {
                            if let Err(error) = state.save_dish(store) {
                                state.error = Some(error.to_string());
                            }
                        }
                        if cancel_dish {
                            state.dish_draft = None;
                        }
                        let dishes: Vec<_> = state
                            .menu
                            .iter()
                            .filter(|d| {
                                (state.query.is_empty()
                                    || d.name.to_lowercase().contains(&state.query.to_lowercase())
                                    || d.ingredients
                                        .to_lowercase()
                                        .contains(&state.query.to_lowercase()))
                                    && (state.category_filter == "all"
                                        || d.category == state.category_filter)
                            })
                            .cloned()
                            .collect();
                        for dish in dishes {
                            ui.horizontal_wrapped(|ui| {
                                ui.label(format!(
                                    "{} {} · {}",
                                    dish.emoji,
                                    dish.name,
                                    money(dish.gross().cents(), &currency)
                                ));
                                if ui
                                    .button(if dish.is_available {
                                        texts.get("restaurant_available")
                                    } else {
                                        texts.get("restaurant_unavailable")
                                    })
                                    .clicked()
                                {
                                    let mut changed = dish.clone();
                                    changed.is_available = !changed.is_available;
                                    if let Err(e) = store.update_restaurant_menu_item(&changed) {
                                        state.error = Some(e.to_string());
                                    } else {
                                        let _ = state.refresh(store);
                                    }
                                }
                                if button(
                                    ui,
                                    theme,
                                    focus,
                                    texts.get("restaurant_edit"),
                                    ButtonVariant::Secondary,
                                )
                                .activated
                                {
                                    state.edit_dish(dish.id);
                                }
                                if button(
                                    ui,
                                    theme,
                                    focus,
                                    texts.get("restaurant_delete"),
                                    ButtonVariant::Danger,
                                )
                                .activated
                                {
                                    if let Err(e) = state.delete_dish(store, dish.id) {
                                        state.error = Some(e.to_string());
                                    }
                                }
                            });
                        }
                    }
                    RestaurantView::History => {
                        let mut paid: Vec<_> = state
                            .orders
                            .iter()
                            .filter(|o| o.status == "paid")
                            .cloned()
                            .collect();
                        paid.sort_by_key(|o| std::cmp::Reverse(o.paid_at.unwrap_or(o.opened_at)));
                        for order in paid {
                            ui.horizontal_wrapped(|ui| {
                                ui.label(format!(
                                    "{} · {} · {} · {}",
                                    order.table_number,
                                    order.receipt_number.as_deref().unwrap_or("—"),
                                    order.payment_method.as_deref().unwrap_or("—"),
                                    money(order.total_cents + order.tip_cents, &currency)
                                ));
                                if button(
                                    ui,
                                    theme,
                                    focus,
                                    texts.get("restaurant_delete"),
                                    ButtonVariant::Danger,
                                )
                                .activated
                                {
                                    if let Err(e) = store.delete_restaurant_order(order.id) {
                                        state.error = Some(e.to_string());
                                    } else {
                                        let _ = state.refresh(store);
                                    }
                                }
                            });
                        }
                        if !state.orders.iter().any(|o| o.status == "paid") {
                            ui.label(texts.get("restaurant_history_empty"));
                        }
                    }
                }
            });
        });
}

#[cfg(feature = "dialogs")]
fn csv_field(value: &str) -> String {
    if value.contains(';') || value.contains('"') || value.contains('\n') || value.contains('\r') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

#[cfg(feature = "dialogs")]
fn export_csv(store: &Store) -> socdof_core::CoreResult<Option<String>> {
    let orders = store.restaurant_orders()?;
    let mut output = String::from("\u{feff}");
    output.push_str("Belegnummer;Tisch;Datum;Zahlart;Artikel;Positionen;Netto;MwSt;Trinkgeld;Gesamt;Gesamt inkl. Trinkgeld\n");
    for order in orders.iter().filter(|order| order.status == "paid") {
        let articles = order
            .items
            .iter()
            .map(|item| format!("{}× {}", item.qty, item.name))
            .collect::<Vec<_>>()
            .join(", ");
        output.push_str(&format!(
            "{};{};{};{};{};{};{};{};{};{};{}\n",
            csv_field(order.receipt_number.as_deref().unwrap_or("")),
            csv_field(&order.table_number),
            order
                .paid_at
                .map(socdof_core::date::format_iso8601)
                .unwrap_or_else(|| socdof_core::date::format_iso8601(order.opened_at)),
            csv_field(order.payment_method.as_deref().unwrap_or("")),
            csv_field(&articles),
            order.line_count(),
            Money::from_cents(order.subtotal_cents).to_decimal_string(),
            Money::from_cents(order.tax_total_cents).to_decimal_string(),
            Money::from_cents(order.tip_cents).to_decimal_string(),
            Money::from_cents(order.total_cents).to_decimal_string(),
            Money::from_cents(order.total_cents + order.tip_cents).to_decimal_string(),
        ));
    }
    let (year, month, day) = socdof_core::date::civil_from_millis(socdof_core::now_millis());
    let suggested = format!("restaurant-belege-{year:04}-{month:02}-{day:02}.csv");
    if let Some(path) = rfd::FileDialog::new().set_file_name(&suggested).save_file() {
        std::fs::write(&path, output.as_bytes())?;
        Ok(Some(path.display().to_string()))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restaurant_menu_orders_and_checkout_persist_atomically() {
        let store = Store::open_in_memory().expect("store");
        let mut state = RestaurantState::new();
        state.refresh(&store).expect("refresh");
        let dish = state
            .menu
            .iter()
            .find(|d| d.is_available)
            .expect("menu dish")
            .id;
        state
            .add_item(&store, dish, 1_800_000_000_000)
            .expect("add");
        let order = state.active_order().expect("order").clone();
        state
            .set_status(&store, order.id, "preparing", 1_800_000_000_001)
            .expect("kitchen");
        state.payment_method = "card".into();
        let number = state
            .checkout(&store, order.id, 1_800_000_000_002)
            .expect("checkout");
        assert!(!number.is_empty());
        assert_eq!(
            store.restaurant_order(order.id).unwrap().unwrap().status,
            "paid"
        );
        assert_eq!(store.pos_order_count().unwrap(), 1);
        assert_eq!(store.list_invoices().unwrap().len(), 1);
    }
    #[test]
    fn order_notes_server_status_and_cash_checkout_are_preserved() {
        let store = Store::open_in_memory().expect("store");
        let mut state = RestaurantState::new();
        state.refresh(&store).expect("refresh");
        let dish = state.menu.iter().find(|d| d.is_available).unwrap().id;
        state
            .add_item(&store, dish, 1_800_000_000_000)
            .expect("add");
        let order = state.active_order().unwrap().clone();
        let item = order.items[0].id;
        state
            .set_quantity(&store, order.id, item, 2, 1_800_000_000_001)
            .expect("quantity");
        state
            .set_notes(&store, order.id, item, " ohne Zwiebeln ", 1_800_000_000_002)
            .expect("notes");
        state
            .set_server(&store, order.id, " Service ", 1_800_000_000_003)
            .expect("server");
        state
            .set_status(&store, order.id, "preparing", 1_800_000_000_004)
            .expect("status");
        let stored = store.restaurant_order(order.id).unwrap().unwrap();
        assert_eq!(stored.items[0].qty, 2);
        assert_eq!(stored.items[0].notes, "ohne Zwiebeln");
        assert_eq!(stored.server_name, "Service");
        assert_eq!(stored.status, "preparing");
        state.payment_method = "cash".into();
        state.cash_given_cents = 0;
        assert!(state.checkout(&store, order.id, 1_800_000_000_005).is_err());
        state.cash_given_cents = stored.total_cents + 200;
        state.tip_cents = 100;
        state.hospitality = true;
        state.hospitality_host = "SOCDOF".into();
        state.hospitality_occasion = "Geschäftsessen".into();
        state.hospitality_guests = "2 Personen".into();
        state
            .checkout(&store, order.id, 1_800_000_000_006)
            .expect("cash checkout");
        let paid = store.restaurant_order(order.id).unwrap().unwrap();
        assert_eq!(paid.status, "paid");
        assert_eq!(paid.tip_cents, 100);
        assert!(paid.is_hospitality_receipt);
        assert_eq!(paid.hospitality_host, "SOCDOF");
        assert!(paid.cash_change_cents.unwrap() >= 0);
    }

    #[test]
    fn invalid_menu_dish_is_not_saved() {
        let store = Store::open_in_memory().expect("store");
        let mut state = RestaurantState::new();
        state.refresh(&store).expect("refresh");
        let before = state.menu.len();
        state.start_new_dish(1_800_000_000_000);
        state.dish_draft.as_mut().unwrap().name.clear();
        assert!(state.save_dish(&store).is_err());
        assert_eq!(store.restaurant_menu().unwrap().len(), before);
    }
    #[test]
    fn removing_last_order_line_removes_open_order() {
        let store = Store::open_in_memory().expect("store");
        let mut state = RestaurantState::new();
        state.refresh(&store).expect("refresh");
        state
            .add_item(&store, state.menu[0].id, 1_800_000_000_000)
            .expect("add");
        let order = state.active_order().unwrap().clone();
        state
            .set_quantity(&store, order.id, order.items[0].id, 0, 1_800_000_000_001)
            .expect("remove");
        assert!(state.active_order().is_none());
    }
}
