//! Products module screen: catalogue, stock levels and reordering.
//!
//! The screen works on the core store: list and search through
//! [`Store::list_products`]/[`Store::search_products`], writes through [`Store::insert_product`],
//! [`Store::update_product`] and [`Store::delete_product`], and books stock through
//! [`Store::adjust_stock`], which writes the movement history and the new level in one transaction.
//! Validation stays in the domain; the screen maps the returned codes to catalogue keys.
//!
//! Views are list, detail and form. Detail adds the stock booking, the form never edits the stock
//! level directly so every change keeps a movement. Every control registers in the shared
//! [`FocusState`], every visible string comes from the catalogue and all painting uses the tokens.

use egui::{Context, RichText};
use socdof_core::domain::product::Product;
use socdof_core::domain::stock::{StockMove, StockMoveKind};
use socdof_core::money::Money;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, ButtonVariant, Tone,
};
use crate::controls::{switch, text_field};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample products, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// View currently shown by the products screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ProductsView {
    /// Searchable list of all products.
    #[default]
    List,
    /// Detail of the selected product with the stock booking.
    Detail,
    /// Create or edit form.
    Form,
}

impl ProductsView {
    /// Catalogue key of the view title.
    pub fn title_key(self) -> &'static str {
        match self {
            ProductsView::List => "products_title",
            ProductsView::Detail => "products_detail_title",
            ProductsView::Form => "products_form_title",
        }
    }
}

/// Editable values of one product. Stock is deliberately not part of the draft.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProductDraft {
    /// Display name.
    pub name: String,
    /// SKU / article number.
    pub sku: String,
    /// Category.
    pub category: String,
    /// Unit of measure.
    pub unit: String,
    /// Net sales price as entered.
    pub price: String,
    /// Net cost price as entered.
    pub cost_price: String,
    /// Tax rate in percent as entered.
    pub tax_rate: String,
    /// Reorder level.
    pub reorder_level: String,
    /// Target stock for replenishment.
    pub target_stock: String,
    /// Whether the product is active.
    pub active: bool,
    /// Whether it is excluded from reorder suggestions.
    pub exclude_from_reorder: bool,
}

impl Default for ProductDraft {
    fn default() -> Self {
        Self {
            name: String::new(),
            sku: String::new(),
            category: String::new(),
            unit: "Stk".to_string(),
            price: String::new(),
            cost_price: String::new(),
            tax_rate: "19".to_string(),
            reorder_level: "0".to_string(),
            target_stock: "0".to_string(),
            active: true,
            exclude_from_reorder: false,
        }
    }
}

impl ProductDraft {
    /// Fills the draft from a stored product.
    pub fn from_product(product: &Product) -> Self {
        Self {
            name: product.name.clone(),
            sku: product.sku.clone(),
            category: product.category.clone(),
            unit: product.unit.clone(),
            price: product.price.to_decimal_string(),
            cost_price: product.cost_price.to_decimal_string(),
            tax_rate: format!("{}", product.tax_rate_bp as f64 / 100.0),
            reorder_level: product.reorder_level.to_string(),
            target_stock: product.target_stock.to_string(),
            active: product.active,
            exclude_from_reorder: product.exclude_from_reorder,
        }
    }

    /// Builds the product to store; `base` keeps id, stock and creation time when editing.
    pub fn to_product(&self, base: Option<&Product>, now: i64) -> Result<Product, &'static str> {
        let price = Money::parse(&self.price).ok_or("products_error_price")?;
        let cost_price = if self.cost_price.trim().is_empty() {
            Money::ZERO
        } else {
            Money::parse(&self.cost_price).ok_or("products_error_price")?
        };
        let tax_rate_bp = parse_percent_bp(&self.tax_rate).ok_or("products_error_tax")?;
        let reorder_level = parse_count(&self.reorder_level).ok_or("products_error_number")?;
        let target_stock = parse_count(&self.target_stock).ok_or("products_error_number")?;

        let mut product = match base {
            Some(product) => product.clone(),
            None => Product::new(self.name.trim(), now),
        };

        product.name = self.name.trim().to_string();
        product.sku = self.sku.trim().to_string();
        product.category = self.category.trim().to_string();
        product.unit = self.unit.trim().to_string();
        product.price = price;
        product.cost_price = cost_price;
        product.tax_rate_bp = tax_rate_bp;
        product.reorder_level = reorder_level;
        product.target_stock = target_stock;
        product.active = self.active;
        product.exclude_from_reorder = self.exclude_from_reorder;
        product.updated_at = now;

        Ok(product)
    }
}

fn parse_percent_bp(input: &str) -> Option<i64> {
    let compact = input.trim().replace(',', ".");
    let value: f64 = compact.parse().ok()?;
    if !value.is_finite() || !(0.0..=100.0).contains(&value) {
        return None;
    }
    Some((value * 100.0).round() as i64)
}

fn parse_count(input: &str) -> Option<i64> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Some(0);
    }
    trimmed.parse::<i64>().ok().filter(|value| *value >= 0)
}

/// State of the products screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProductsState {
    /// Search text; empty lists every product.
    pub query: String,
    /// Products matching the last loaded query.
    pub products: Vec<Product>,
    /// Selected product, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: ProductsView,
    /// Editable values of the form.
    pub draft: ProductDraft,
    /// Quantity entered for the next stock booking.
    pub stock_amount: String,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded_query: String,
    reload: bool,
}

impl Default for ProductsState {
    fn default() -> Self {
        Self {
            query: String::new(),
            products: Vec::new(),
            selected: None,
            view: ProductsView::List,
            draft: ProductDraft::default(),
            stock_amount: String::new(),
            confirm_delete: false,
            error: None,
            status: None,
            back: false,
            loaded_query: String::new(),
            reload: true,
        }
    }
}

impl ProductsState {
    /// Creates an empty screen; the first [`ProductsState::refresh`] loads the list.
    pub fn new() -> Self {
        Self::default()
    }

    /// Reloads the list when the query changed or a write invalidated it.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if !self.reload && self.loaded_query == self.query {
            return Ok(());
        }

        self.products = if self.query.trim().is_empty() {
            store.list_products()?
        } else {
            store.search_products(&self.query)?
        };
        self.loaded_query = self.query.clone();
        self.reload = false;
        Ok(())
    }

    /// Selected product, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&Product> {
        self.selected
            .and_then(|id| self.products.iter().find(|product| product.id == id))
    }

    /// Opens the detail view of a product.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.stock_amount.clear();
        self.view = ProductsView::Detail;
    }

    /// Opens an empty form.
    pub fn start_new(&mut self) {
        self.selected = None;
        self.draft = ProductDraft::default();
        self.error = None;
        self.status = None;
        self.view = ProductsView::Form;
    }

    /// Opens the form with the selected product.
    pub fn start_edit(&mut self) {
        let Some(product) = self.current() else {
            return;
        };
        self.draft = ProductDraft::from_product(product);
        self.error = None;
        self.status = None;
        self.view = ProductsView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.view = if self.selected.is_some() {
            ProductsView::Detail
        } else {
            ProductsView::List
        };
    }

    /// Validates and stores the draft.
    ///
    /// Validation failures set [`ProductsState::error`] and return `Ok(())`; storage errors are
    /// returned so the caller can report them.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let product = match self.draft.to_product(base.as_ref(), now) {
            Ok(product) => product,
            Err(key) => {
                self.error = Some(key);
                self.status = None;
                return Ok(());
            }
        };

        if let Err(code) = product.validate() {
            self.error = Some(product_validation_key(&code));
            self.status = None;
            return Ok(());
        }

        if base.is_some() {
            store.update_product(&product)?;
        } else {
            store.insert_product(&product)?;
        }

        self.selected = Some(product.id);
        self.view = ProductsView::Detail;
        self.error = None;
        self.status = Some("products_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Deletes the selected product after the caller confirmed it.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.delete_product(id)?;
        self.selected = None;
        self.view = ProductsView::List;
        self.confirm_delete = false;
        self.error = None;
        self.status = Some("products_deleted");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Books a stock movement for the selected product.
    ///
    /// Invalid quantities and rejected movements (for example an outgoing booking above the
    /// available stock) set [`ProductsState::error`] instead of writing anything.
    pub fn adjust_stock(
        &mut self,
        store: &Store,
        kind: StockMoveKind,
        now: i64,
    ) -> socdof_core::CoreResult<()> {
        let Some(product) = self.current() else {
            return Ok(());
        };
        let quantity = match self.stock_amount.trim().parse::<i64>() {
            Ok(quantity) if quantity > 0 => quantity,
            _ => {
                self.error = Some("products_error_number");
                self.status = None;
                return Ok(());
            }
        };

        let movement = StockMove {
            id: Uuid::new_v4(),
            product_id: product.id,
            kind,
            quantity,
            reason: None,
            created_at: now,
        };

        match store.adjust_stock(&movement) {
            Ok(_) => {
                self.error = None;
                self.status = Some("products_stock_saved");
                self.stock_amount.clear();
                self.reload = true;
                self.refresh(store)?;
            }
            Err(_) => {
                self.error = Some("products_error_stock");
                self.status = None;
            }
        }
        Ok(())
    }
}

fn product_validation_key(code: &str) -> &'static str {
    match code {
        "name_required" => "products_error_name",
        "price_negative" | "cost_price_negative" => "products_error_price",
        "tax_rate_out_of_range" => "products_error_tax",
        _ => "products_error_number",
    }
}

fn stock_move(product_id: Uuid, kind: StockMoveKind, quantity: i64, now: i64) -> StockMove {
    StockMove {
        id: Uuid::new_v4(),
        product_id,
        kind,
        quantity,
        reason: None,
        created_at: now,
    }
}

/// Seeds two deterministic products with stock movements for the gallery and the snapshots.
///
/// Stock is booked through [`Store::adjust_stock`], so the fixture uses the same write path as the
/// screen. The function is a no-op when the store already has products.
pub fn seed_products(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if store.product_count()? > 0 {
        return Ok(());
    }

    let category = texts.get("products_sample_category").to_string();

    let mut coffee = Product::new(texts.get("products_sample_product_a"), SAMPLE_NOW_MS);
    coffee.sku = "A-100".to_string();
    coffee.category = category.clone();
    coffee.unit = "kg".to_string();
    coffee.price = Money::from_cents(990);
    coffee.cost_price = Money::from_cents(500);
    coffee.reorder_level = 15;
    coffee.target_stock = 30;
    store.insert_product(&coffee)?;
    store.adjust_stock(&stock_move(coffee.id, StockMoveKind::In, 12, SAMPLE_NOW_MS))?;

    let mut cup = Product::new(texts.get("products_sample_product_b"), SAMPLE_NOW_MS);
    cup.sku = "B-204".to_string();
    cup.category = category;
    cup.unit = "Stk".to_string();
    cup.price = Money::from_cents(450);
    cup.cost_price = Money::from_cents(200);
    cup.reorder_level = 5;
    cup.target_stock = 20;
    store.insert_product(&cup)?;
    store.adjust_stock(&stock_move(cup.id, StockMoveKind::In, 50, SAMPLE_NOW_MS))?;

    Ok(())
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ProductsState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("products"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &ProductsState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

fn money(amount: Money) -> String {
    amount.format_localized("€")
}

/// Renders the products screen into the context.
pub fn products(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ProductsState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.view {
            ProductsView::List => state.back = true,
            ProductsView::Detail => state.view = ProductsView::List,
            ProductsView::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("products_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.view {
                ProductsView::List => list_view(ui, theme, texts, focus, state),
                ProductsView::Detail => detail_view(ui, theme, texts, focus, state, store, now),
                ProductsView::Form => form_view(ui, theme, texts, focus, state, store, now),
            });
        });

    let mut open = state.confirm_delete;
    let mut confirm = false;
    {
        let focus = &mut *focus;
        modal(
            ctx,
            theme,
            &mut open,
            texts.get("products_delete_title"),
            |ui| {
                ui.label(texts.get("products_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("products_delete_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        confirm = true;
                        close = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("products_delete_cancel"),
                        ButtonVariant::Secondary,
                    )
                    .activated
                    {
                        close = true;
                    }
                });
                close
            },
        );
    }
    state.confirm_delete = open;

    if confirm && state.delete_selected(store).is_err() {
        state.error = Some("products_error_delete");
    }
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ProductsState,
) {
    let subtitle = format!(
        "{} · {}",
        state.products.len(),
        texts.get("products_subtitle")
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("products_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut create = false;
    ui.horizontal(|ui| {
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("products_search"),
            150.0,
        );
        if button(
            ui,
            theme,
            focus,
            texts.get("products_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
    });
    if create {
        state.start_new();
        return;
    }

    ui.add_space(12.0);
    if state.products.is_empty() {
        let searching = !state.query.trim().is_empty();
        card(ui, theme, |ui| {
            if searching {
                empty_state(
                    ui,
                    theme,
                    texts.get("products_no_results"),
                    texts.get("products_no_results_hint"),
                );
            } else {
                empty_state(
                    ui,
                    theme,
                    texts.get("products_empty_title"),
                    texts.get("products_empty_hint"),
                );
            }
        });
        return;
    }

    let mut chosen = None;
    card(ui, theme, |ui| {
        egui::Grid::new("socdof-products-table")
            .num_columns(5)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "products_col_name",
                    "products_col_sku",
                    "products_col_stock",
                    "products_col_price",
                    "products_col_status",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for product in &state.products {
                    if button(ui, theme, focus, &product.name, ButtonVariant::Ghost).activated {
                        chosen = Some(product.id);
                    }
                    ui.label(&product.sku);
                    ui.label(format!("{} {}", product.stock, product.unit));
                    ui.label(money(product.price));
                    if product.needs_reorder() {
                        badge(ui, theme, texts.get("products_low_stock"), Tone::Warning);
                    } else {
                        badge(ui, theme, texts.get("products_in_stock"), Tone::Success);
                    }
                    ui.end_row();
                }
            });
    });
    if let Some(id) = chosen {
        state.select(id);
    }
}

fn detail_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ProductsState,
    store: &Store,
    now: i64,
) {
    let Some(product) = state.current().cloned() else {
        state.view = ProductsView::List;
        return;
    };

    let subtitle = product.sku.clone();
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("products_detail_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(&product.name).size(FONT_TITLE).strong());
            if product.needs_reorder() {
                badge(ui, theme, texts.get("products_low_stock"), Tone::Warning);
            } else {
                badge(ui, theme, texts.get("products_in_stock"), Tone::Success);
            }
            if !product.active {
                badge(ui, theme, texts.get("products_inactive"), Tone::Neutral);
            }
        });
        ui.add_space(8.0);
        for (label, value) in [
            ("products_col_sku", product.sku.clone()),
            ("products_category", product.category.clone()),
            ("products_unit", product.unit.clone()),
            ("products_price", money(product.price)),
            ("products_cost", money(product.cost_price)),
            (
                "products_tax",
                format!("{} %", product.tax_rate_bp as f64 / 100.0),
            ),
            (
                "products_col_stock",
                format!("{} {}", product.stock, product.unit),
            ),
            ("products_reorder", product.reorder_level.to_string()),
            ("products_target", product.target_stock.to_string()),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(value);
            });
        }
    });

    ui.add_space(12.0);
    let mut book_in = false;
    let mut book_out = false;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("products_stock_title")).strong());
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.stock_amount,
            texts.get("products_stock_amount"),
            texts.get("products_stock_amount_hint"),
            None,
        );
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("products_stock_in"),
                ButtonVariant::Primary,
            )
            .activated
            {
                book_in = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("products_stock_out"),
                ButtonVariant::Secondary,
            )
            .activated
            {
                book_out = true;
            }
        });
    });

    ui.add_space(12.0);
    let mut edit = false;
    let mut delete = false;
    ui.horizontal(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("products_edit"),
            ButtonVariant::Primary,
        )
        .activated
        {
            edit = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("products_delete"),
            ButtonVariant::Danger,
        )
        .activated
        {
            delete = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("products_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.view = ProductsView::List;
        }
    });

    if book_in {
        state
            .adjust_stock(store, StockMoveKind::In, now)
            .expect("stock booking");
    }
    if book_out {
        state
            .adjust_stock(store, StockMoveKind::Out, now)
            .expect("stock booking");
    }
    if edit {
        state.start_edit();
    }
    if delete {
        state.confirm_delete = true;
    }
}

fn form_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut ProductsState,
    store: &Store,
    now: i64,
) {
    let editing = state.selected.is_some();
    let title = if editing {
        texts.get("products_edit_title")
    } else {
        texts.get("products_new_title")
    };
    let subtitle = texts.get("products_subtitle").to_string();
    screen_header(ui, theme, texts, focus, state, title, &subtitle);
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let mut save = false;
    let mut cancel = false;
    card(ui, theme, |ui| {
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.name,
            texts.get("products_name"),
            texts.get("products_name_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.sku,
            texts.get("products_sku"),
            texts.get("products_sku_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.category,
            texts.get("products_category"),
            texts.get("products_category_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.unit,
            texts.get("products_unit"),
            texts.get("products_unit_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.price,
            texts.get("products_price"),
            texts.get("products_price_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.cost_price,
            texts.get("products_cost"),
            texts.get("products_cost_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.tax_rate,
            texts.get("products_tax"),
            texts.get("products_tax_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.reorder_level,
            texts.get("products_reorder"),
            texts.get("products_reorder_hint"),
            None,
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.target_stock,
            texts.get("products_target"),
            texts.get("products_target_hint"),
            None,
        );
        ui.add_space(6.0);
        switch(
            ui,
            theme,
            focus,
            &mut state.draft.active,
            texts.get("products_active"),
        );
        switch(
            ui,
            theme,
            focus,
            &mut state.draft.exclude_from_reorder,
            texts.get("products_exclude_reorder"),
        );
        if let Some(key) = state.error {
            ui.add_space(6.0);
            ui.label(
                RichText::new(texts.get(key))
                    .size(FONT_SMALL)
                    .color(theme.palette.danger),
            );
        }
        ui.add_space(12.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("products_save"),
                ButtonVariant::Primary,
            )
            .activated
            {
                save = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("products_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if save && state.save(store, now).is_err() {
        state.error = Some("products_error_save");
    }
    if cancel {
        state.cancel_edit();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use socdof_core::domain::settings::Language;

    fn seeded() -> (Store, ProductsState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_products(&store, &texts).expect("seed");
        let mut state = ProductsState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut ProductsState, store: &Store) -> String {
        let ctx = crate::theme::headless_context();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(900.0, 1400.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                products(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("products frame")).join("\n")
    }

    #[test]
    fn creates_edits_and_deletes_a_product() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ProductsState::new();
        state.refresh(&store).expect("refresh");
        assert!(state.products.is_empty());

        state.start_new();
        state.draft.name = "Kaffee".to_string();
        state.draft.sku = "A-100".to_string();
        state.draft.price = "9,90".to_string();
        state.draft.cost_price = "5,00".to_string();
        state.draft.reorder_level = "10".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("insert");

        assert!(state.error.is_none());
        assert_eq!(state.view, ProductsView::Detail);
        assert_eq!(store.product_count().expect("count"), 1);
        let id = store.list_products().expect("list")[0].id;
        assert_eq!(state.selected, Some(id));

        state.start_edit();
        state.draft.name = "Kaffee 1 kg".to_string();
        state.draft.price = "10,50".to_string();
        state.save(&store, SAMPLE_NOW_MS + 1).expect("update");
        let stored = store.find_product(id).expect("find").expect("product");
        assert_eq!(stored.name, "Kaffee 1 kg");
        assert_eq!(stored.price, Money::from_cents(1_050));
        assert_eq!(stored.tax_rate_bp, 1_900);

        state.delete_selected(&store).expect("delete");
        assert_eq!(store.product_count().expect("count"), 0);
        assert_eq!(state.view, ProductsView::List);
    }

    #[test]
    fn books_stock_in_and_out_through_the_store() {
        let (store, mut state, _texts) = seeded();
        let coffee = state.products[0].clone();
        state.select(coffee.id);

        state.stock_amount = "8".to_string();
        state
            .adjust_stock(&store, StockMoveKind::In, SAMPLE_NOW_MS + 2)
            .expect("stock in");
        assert_eq!(state.error, None);
        assert_eq!(
            store.find_product(coffee.id).expect("find").unwrap().stock,
            20
        );
        assert_eq!(state.products[0].stock, 20);

        state.stock_amount = "5".to_string();
        state
            .adjust_stock(&store, StockMoveKind::Out, SAMPLE_NOW_MS + 3)
            .expect("stock out");
        assert_eq!(
            store.find_product(coffee.id).expect("find").unwrap().stock,
            15
        );

        state.stock_amount = "999".to_string();
        state
            .adjust_stock(&store, StockMoveKind::Out, SAMPLE_NOW_MS + 4)
            .expect("rejected booking stays an error");
        assert_eq!(state.error, Some("products_error_stock"));
        assert_eq!(
            store.find_product(coffee.id).expect("find").unwrap().stock,
            15
        );
    }

    #[test]
    fn rejects_invalid_prices_and_quantities() {
        let store = Store::open_in_memory().expect("store");
        let mut state = ProductsState::new();
        state.start_new();
        state.draft.name = "Kaffee".to_string();
        state.draft.price = "abc".to_string();
        state
            .save(&store, SAMPLE_NOW_MS)
            .expect("validation returns ok");
        assert_eq!(state.error, Some("products_error_price"));
        assert_eq!(state.view, ProductsView::Form);
        assert_eq!(store.product_count().expect("count"), 0);

        state.draft.price = "9,90".to_string();
        state.draft.tax_rate = "120".to_string();
        state
            .save(&store, SAMPLE_NOW_MS)
            .expect("validation returns ok");
        assert_eq!(state.error, Some("products_error_tax"));
        assert_eq!(store.product_count().expect("count"), 0);
    }

    #[test]
    fn search_filters_the_list_through_the_store() {
        let (store, mut state, _texts) = seeded();
        assert_eq!(state.products.len(), 2);

        let target = state.products[0].name.clone();
        state.query = target.clone();
        state.refresh(&store).expect("search");

        assert_eq!(state.products.len(), 1);
        assert_eq!(state.products[0].name, target);
    }

    #[test]
    fn renders_the_list_the_detail_and_the_form() {
        let (store, mut state, texts) = seeded();

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("products_title")));
        assert!(painted.contains(texts.get("products_sample_product_a")));
        assert!(painted.contains(texts.get("products_low_stock")));
        assert!(painted.contains(texts.get("products_new")));

        let id = state.products[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("products_edit")));
        assert!(painted.contains(texts.get("products_stock_title")));
        assert!(painted.contains(texts.get("products_stock_in")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("products_save")));
        assert!(painted.contains(texts.get("products_tax")));
    }

    #[test]
    fn seeding_is_idempotent_and_books_stock() {
        let (store, _state, texts) = seeded();
        seed_products(&store, &texts).expect("second seed");
        assert_eq!(store.product_count().expect("count"), 2);
        let products = store.list_products().expect("list");
        assert_eq!(
            products.iter().map(|product| product.stock).sum::<i64>(),
            62
        );
    }
}
