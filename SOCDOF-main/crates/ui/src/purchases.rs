//! Purchases module screen: suppliers, purchase orders and the goods receipt.
//!
//! The screen works on the core store: the list and search through [`Store::list_purchase_orders`]
//! and [`Store::search_purchase_orders`], writes through [`Store::insert_purchase_order`],
//! [`Store::update_purchase_order`] and [`Store::delete_purchase_order`], the lifecycle through
//! [`Store::set_purchase_order_status`] and the receipt through [`Store::receive_purchase_order`].
//! Validation and the stock movements stay in the domain
//! ([`socdof_core::domain::purchase::PurchaseOrder`]); the screen only maps snake_case codes to
//! catalogue keys, so invalid input never reaches the database.
//!
//! Views are list, detail and form. Every control registers in the shared [`FocusState`], every
//! visible string comes from the catalogue and all painting uses the design tokens.

use egui::{Context, RichText};
use socdof_core::date;
use socdof_core::domain::contact::{Contact, ContactKind};
use socdof_core::domain::purchase::{
    summarize, PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus,
};
use socdof_core::money::Money;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, modal, search_field_reserved, ButtonVariant, Tone,
};
use crate::controls::{select, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample orders, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Length of one day in milliseconds.
const DAY_MS: i64 = 24 * 60 * 60 * 1_000;

/// Delivery window suggested for a new order.
const DELIVERY_DAYS: i64 = 7;

/// View currently shown by the purchases screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum PurchasesView {
    /// Searchable list of all purchase orders.
    #[default]
    List,
    /// Detail of the selected order with positions and status actions.
    Detail,
    /// Create or edit form with the positions.
    Form,
}

impl PurchasesView {
    /// Catalogue key of the view title.
    pub fn title_key(self) -> &'static str {
        match self {
            PurchasesView::List => "purchases_title",
            PurchasesView::Detail => "purchases_detail_title",
            PurchasesView::Form => "purchases_form_title",
        }
    }
}

/// Editable values of one order position.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PurchaseLineDraft {
    /// Description shown on the order and the goods receipt.
    pub description: String,
    /// Quantity in whole units or decimals, as entered.
    pub quantity: String,
    /// Net unit cost as entered.
    pub unit_cost: String,
    /// Tax rate in percent as entered.
    pub tax_rate: String,
}

impl Default for PurchaseLineDraft {
    fn default() -> Self {
        Self {
            description: String::new(),
            quantity: "1".to_string(),
            unit_cost: String::new(),
            tax_rate: "19".to_string(),
        }
    }
}

impl PurchaseLineDraft {
    /// Fills the draft from a stored position.
    pub fn from_line(line: &PurchaseOrderLine) -> Self {
        Self {
            description: line.description.clone(),
            quantity: milli_text(line.quantity_milli),
            unit_cost: line.unit_cost.to_decimal_string(),
            tax_rate: percent_text(line.tax_rate_bp),
        }
    }

    fn to_line(&self) -> Result<PurchaseOrderLine, &'static str> {
        if self.description.trim().is_empty() {
            return Err("purchases_error_line_description");
        }
        let quantity_milli = parse_quantity(&self.quantity).ok_or("purchases_error_quantity")?;
        let unit_cost = Money::parse(&self.unit_cost).ok_or("purchases_error_price")?;
        if unit_cost.cents() < 0 {
            return Err("purchases_error_price");
        }
        let tax_rate_bp = parse_percent_bp(&self.tax_rate).ok_or("purchases_error_tax")?;

        Ok(PurchaseOrderLine {
            product_id: None,
            description: self.description.trim().to_string(),
            quantity_milli,
            unit_cost,
            tax_rate_bp,
        })
    }
}

/// Editable values of one purchase order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PurchaseDraft {
    /// Human readable order number, unique per company.
    pub number: String,
    /// Index into the loaded vendors.
    pub vendor: usize,
    /// Optional note.
    pub note: String,
    /// Ordered positions.
    pub lines: Vec<PurchaseLineDraft>,
}

impl Default for PurchaseDraft {
    fn default() -> Self {
        Self {
            number: String::new(),
            vendor: 0,
            note: String::new(),
            lines: vec![PurchaseLineDraft::default()],
        }
    }
}

impl PurchaseDraft {
    /// Fills the draft from a stored order.
    pub fn from_order(order: &PurchaseOrder, vendors: &[Contact]) -> Self {
        Self {
            number: order.number.clone(),
            vendor: vendors
                .iter()
                .position(|contact| contact.id == order.vendor_id)
                .unwrap_or(0),
            note: order.note.clone().unwrap_or_default(),
            lines: order
                .lines
                .iter()
                .map(PurchaseLineDraft::from_line)
                .collect(),
        }
    }

    /// Builds the order to store; `base` keeps id, dates, currency and status when editing.
    pub fn to_order(
        &self,
        base: Option<&PurchaseOrder>,
        vendors: &[Contact],
        now: i64,
    ) -> Result<PurchaseOrder, &'static str> {
        let vendor = vendors.get(self.vendor).ok_or("purchases_error_vendor")?;
        if self.number.trim().is_empty() {
            return Err("purchases_error_number");
        }
        if self.lines.is_empty() {
            return Err("purchases_error_lines");
        }

        let mut lines = Vec::with_capacity(self.lines.len());
        for line in &self.lines {
            lines.push(line.to_line()?);
        }

        let mut order = match base {
            Some(order) => order.clone(),
            None => PurchaseOrder {
                id: Uuid::new_v4(),
                number: String::new(),
                vendor_id: vendor.id,
                status: PurchaseOrderStatus::Draft,
                order_date: now,
                expected_at: Some(now + DELIVERY_DAYS * DAY_MS),
                currency_symbol: "€".to_string(),
                note: None,
                lines: Vec::new(),
                legacy_id: None,
                created_at: now,
                updated_at: now,
            },
        };

        order.number = self.number.trim().to_string();
        order.vendor_id = vendor.id;
        order.note = non_empty(&self.note);
        order.lines = lines;
        order.updated_at = now;

        Ok(order)
    }
}

fn non_empty(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn parse_quantity(input: &str) -> Option<i64> {
    let compact = input.trim().replace(',', ".");
    let value: f64 = compact.parse().ok()?;
    if !value.is_finite() || value <= 0.0 {
        return None;
    }
    let milli = (value * 1_000.0).round() as i64;
    (milli > 0).then_some(milli)
}

fn parse_percent_bp(input: &str) -> Option<i64> {
    let compact = input.trim().replace(',', ".");
    let value: f64 = compact.parse().ok()?;
    if !value.is_finite() || !(0.0..=100.0).contains(&value) {
        return None;
    }
    Some((value * 100.0).round() as i64)
}

fn milli_text(milli: i64) -> String {
    if milli % 1_000 == 0 {
        (milli / 1_000).to_string()
    } else {
        let mut text = format!("{:.3}", milli as f64 / 1_000.0);
        while text.ends_with('0') {
            text.pop();
        }
        text.replace('.', ",")
    }
}

fn percent_text(bp: i64) -> String {
    format!("{}", bp as f64 / 100.0)
}

fn format_date(ms: i64) -> String {
    let (year, month, day) = date::civil_from_millis(ms);
    format!("{day:02}.{month:02}.{year}")
}

fn money(symbol: &str, amount: Money) -> String {
    amount.format_localized(symbol)
}

fn contact_label(contact: &Contact) -> String {
    contact
        .name
        .clone()
        .or_else(|| contact.company_name.clone())
        .or_else(|| contact.email.clone())
        .or_else(|| contact.phone.clone())
        .unwrap_or_default()
}

fn contact_name(contacts: &[Contact], id: Uuid) -> String {
    contacts
        .iter()
        .find(|contact| contact.id == id)
        .map(contact_label)
        .unwrap_or_default()
}

fn status_key(status: PurchaseOrderStatus) -> &'static str {
    match status {
        PurchaseOrderStatus::Draft => "purchases_status_draft",
        PurchaseOrderStatus::Ordered => "purchases_status_ordered",
        PurchaseOrderStatus::PartiallyReceived => "purchases_status_partially_received",
        PurchaseOrderStatus::Received => "purchases_status_received",
        PurchaseOrderStatus::Cancelled => "purchases_status_cancelled",
    }
}

fn status_tone(status: PurchaseOrderStatus) -> Tone {
    match status {
        PurchaseOrderStatus::Draft => Tone::Neutral,
        PurchaseOrderStatus::Ordered => Tone::Accent,
        PurchaseOrderStatus::PartiallyReceived => Tone::Warning,
        PurchaseOrderStatus::Received => Tone::Success,
        PurchaseOrderStatus::Cancelled => Tone::Danger,
    }
}

fn suggest_number(orders: &[PurchaseOrder], now: i64) -> String {
    let (year, _, _) = date::civil_from_millis(now);
    let prefix = format!("BE-{year}-");
    let highest = orders
        .iter()
        .filter_map(|order| order.number.strip_prefix(&prefix))
        .filter_map(|suffix| suffix.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    format!("{prefix}{:04}", highest + 1)
}

fn draft_totals(draft: &PurchaseDraft) -> (Money, Money, Money) {
    let mut net = Money::ZERO;
    let mut tax = Money::ZERO;
    for line in &draft.lines {
        if let Ok(line) = line.to_line() {
            net = net + line.net();
            tax = tax + line.tax();
        }
    }
    (net, tax, net + tax)
}

/// State of the purchases screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PurchasesState {
    /// Search text; empty lists every order.
    pub query: String,
    /// Orders matching the last loaded query and the vendor filter.
    pub orders: Vec<PurchaseOrder>,
    /// Suppliers selectable in the form and the filter.
    pub vendors: Vec<Contact>,
    /// Selected supplier filter; `None` shows every supplier.
    pub vendor_filter: Option<Uuid>,
    /// Index into the filter list, `0` meaning every supplier.
    pub vendor_choice: usize,
    /// Selected order, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: PurchasesView,
    /// Editable values of the form.
    pub draft: PurchaseDraft,
    /// Dropdown state of the vendor select.
    pub vendor_popup: PopupState,
    /// Dropdown state of the vendor filter.
    pub vendor_filter_popup: PopupState,
    /// Whether the delete confirmation is open.
    pub confirm_delete: bool,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded_query: String,
    loaded_vendor: Option<Uuid>,
    reload: bool,
}

impl Default for PurchasesState {
    fn default() -> Self {
        Self {
            query: String::new(),
            orders: Vec::new(),
            vendors: Vec::new(),
            vendor_filter: None,
            vendor_choice: 0,
            selected: None,
            view: PurchasesView::List,
            draft: PurchaseDraft::default(),
            vendor_popup: PopupState::default(),
            vendor_filter_popup: PopupState::default(),
            confirm_delete: false,
            error: None,
            status: None,
            back: false,
            loaded_query: String::new(),
            loaded_vendor: None,
            reload: true,
        }
    }
}

impl PurchasesState {
    /// Creates an empty screen; the first [`PurchasesState::refresh`] loads the list.
    pub fn new() -> Self {
        Self::default()
    }

    /// Reloads the list when the query or the supplier filter changed, or a write invalidated it.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if !self.reload
            && self.loaded_query == self.query
            && self.loaded_vendor == self.vendor_filter
        {
            return Ok(());
        }

        let all = if self.query.trim().is_empty() {
            store.list_purchase_orders()?
        } else {
            store.search_purchase_orders(&self.query)?
        };
        self.vendors = store.list_contacts()?;
        self.orders = all
            .into_iter()
            .filter(|order| {
                self.vendor_filter
                    .map(|vendor| order.vendor_id == vendor)
                    .unwrap_or(true)
            })
            .collect();
        self.loaded_query = self.query.clone();
        self.loaded_vendor = self.vendor_filter;
        self.reload = false;
        Ok(())
    }

    /// Selected order, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&PurchaseOrder> {
        self.selected
            .and_then(|id| self.orders.iter().find(|order| order.id == id))
    }

    /// Opens the detail view of an order.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.view = PurchasesView::Detail;
    }

    /// Restricts the list to one supplier; `None` shows every supplier.
    pub fn filter_vendor(&mut self, vendor: Option<Uuid>) {
        self.vendor_filter = vendor;
        self.vendor_choice = vendor
            .and_then(|id| self.vendors.iter().position(|contact| contact.id == id))
            .map(|index| index + 1)
            .unwrap_or(0);
        self.reload = true;
    }

    /// Opens an empty form with the next number and the first supplier.
    pub fn start_new(&mut self, now: i64) {
        self.selected = None;
        self.draft = PurchaseDraft {
            number: suggest_number(&self.orders, now),
            vendor: 0,
            note: String::new(),
            lines: vec![PurchaseLineDraft::default()],
        };
        self.error = None;
        self.status = None;
        self.view = PurchasesView::Form;
    }

    /// Opens the form with the selected order.
    pub fn start_edit(&mut self) {
        let Some(order) = self.current() else {
            return;
        };
        self.draft = PurchaseDraft::from_order(order, &self.vendors);
        self.error = None;
        self.status = None;
        self.view = PurchasesView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.view = if self.selected.is_some() {
            PurchasesView::Detail
        } else {
            PurchasesView::List
        };
    }

    /// Validates and stores the draft.
    ///
    /// Validation failures set [`PurchasesState::error`] and return `Ok(())`; storage errors are
    /// returned so the caller can report them.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let base = self.current().cloned();
        let order = match self.draft.to_order(base.as_ref(), &self.vendors, now) {
            Ok(order) => order,
            Err(key) => {
                self.error = Some(key);
                self.status = None;
                return Ok(());
            }
        };

        if let Err(code) = order.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(());
        }

        if base.is_some() {
            store.update_purchase_order(&order)?;
        } else {
            store.insert_purchase_order(&order)?;
        }

        self.selected = Some(order.id);
        self.view = PurchasesView::Detail;
        self.error = None;
        self.status = Some("purchases_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Deletes the selected order after the caller confirmed it.
    pub fn delete_selected(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.delete_purchase_order(id)?;
        self.selected = None;
        self.view = PurchasesView::List;
        self.confirm_delete = false;
        self.error = None;
        self.status = Some("purchases_deleted");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Moves the selected order to the given lifecycle state.
    pub fn set_status(
        &mut self,
        store: &Store,
        status: PurchaseOrderStatus,
    ) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.set_purchase_order_status(id, status, now_millis())?;
        self.error = None;
        self.status = Some("purchases_status_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Books the whole order in, applying the domain stock movements.
    pub fn receive(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(order) = self.current().cloned() else {
            return Ok(());
        };

        let movements = order.stock_moves(now);
        store.receive_purchase_order(order.id, &movements, now)?;
        self.error = None;
        self.status = Some("purchases_received");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }
}

fn now_millis() -> i64 {
    socdof_core::now_millis()
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "number_required" => "purchases_error_number",
        "lines_required" => "purchases_error_lines",
        "line_description_required" => "purchases_error_line_description",
        "line_quantity_invalid" => "purchases_error_quantity",
        "line_price_negative" => "purchases_error_price",
        "line_tax_rate_out_of_range" => "purchases_error_tax",
        "order_not_receivable" => "purchases_error_receive",
        _ => "purchases_error_save",
    }
}

fn sample_line(
    description: String,
    quantity_milli: i64,
    unit_cost_cents: i64,
    tax_rate_bp: i64,
) -> PurchaseOrderLine {
    PurchaseOrderLine {
        product_id: None,
        description,
        quantity_milli,
        unit_cost: Money::from_cents(unit_cost_cents),
        tax_rate_bp,
    }
}

fn sample_order(
    vendor_id: Uuid,
    number: &str,
    status: PurchaseOrderStatus,
    order_date: i64,
    lines: Vec<PurchaseOrderLine>,
    note: Option<String>,
) -> PurchaseOrder {
    PurchaseOrder {
        id: Uuid::new_v4(),
        number: number.to_string(),
        vendor_id,
        status,
        order_date,
        expected_at: Some(order_date + DELIVERY_DAYS * DAY_MS),
        currency_symbol: "€".to_string(),
        note,
        lines,
        legacy_id: None,
        created_at: order_date,
        updated_at: order_date,
    }
}

/// Seeds three deterministic purchase orders for the gallery and the golden snapshots.
///
/// The sample uses a dedicated supplier and is a no-op when the store already has orders, so it
/// never overwrites data.
pub fn seed_purchases(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if store.purchase_order_count()? > 0 {
        return Ok(());
    }

    let vendor_name = texts.get("purchases_sample_vendor").to_string();
    let vendor = match store
        .list_contacts()?
        .into_iter()
        .find(|contact| contact_label(contact) == vendor_name)
    {
        Some(contact) => contact,
        None => {
            let mut contact = Contact::new(ContactKind::Company, SAMPLE_NOW_MS);
            contact.name = Some(vendor_name.clone());
            contact.company_name = Some(vendor_name);
            store.insert_contact(&contact)?;
            contact
        }
    };

    let coffee = texts.get("purchases_sample_coffee").to_string();
    let shipping = texts.get("purchases_sample_shipping").to_string();
    let cups = texts.get("purchases_sample_cups").to_string();
    let cleaning = texts.get("purchases_sample_cleaning").to_string();

    store.insert_purchase_order(&sample_order(
        vendor.id,
        "BE-2026-0001",
        PurchaseOrderStatus::Ordered,
        SAMPLE_NOW_MS - 3 * DAY_MS,
        vec![
            sample_line(coffee, 10_000, 650, 700),
            sample_line(shipping, 1_000, 490, 1900),
        ],
        Some(texts.get("purchases_sample_note").to_string()),
    ))?;

    store.insert_purchase_order(&sample_order(
        vendor.id,
        "BE-2026-0002",
        PurchaseOrderStatus::Received,
        SAMPLE_NOW_MS - 12 * DAY_MS,
        vec![sample_line(cups, 20_000, 200, 1900)],
        None,
    ))?;

    store.insert_purchase_order(&sample_order(
        vendor.id,
        "BE-2026-0003",
        PurchaseOrderStatus::Draft,
        SAMPLE_NOW_MS - DAY_MS,
        vec![sample_line(cleaning, 1_000, 12_000, 1900)],
        None,
    ))?;

    Ok(())
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PurchasesState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("purchases"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &PurchasesState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

/// Renders the purchases screen into the context.
pub fn purchases(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PurchasesState,
    store: &Store,
    now: i64,
) {
    if !state.confirm_delete && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.view {
            PurchasesView::List => state.back = true,
            PurchasesView::Detail => state.view = PurchasesView::List,
            PurchasesView::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("purchases_error_load");
    }

    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| match state.view {
                PurchasesView::List => list_view(ui, theme, texts, focus, state, now),
                PurchasesView::Detail => detail_view(ui, theme, texts, focus, state, store),
                PurchasesView::Form => form_view(ui, theme, texts, focus, state, store, now),
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
            texts.get("purchases_delete_title"),
            |ui| {
                ui.label(texts.get("purchases_delete_body"));
                ui.add_space(12.0);
                let mut close = false;
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("purchases_delete_confirm"),
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
                        texts.get("purchases_delete_cancel"),
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
        state.error = Some("purchases_error_delete");
    }
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PurchasesState,
    now: i64,
) {
    let subtitle = format!(
        "{} · {}",
        texts.count("count_orders", state.orders.len()),
        texts.get("purchases_subtitle"),
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("purchases_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let summary = summarize(&state.orders);
    card(ui, theme, |ui| {
        ui.horizontal_wrapped(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    RichText::new(texts.get("purchases_open_orders"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(
                    RichText::new(summary.open_orders.to_string())
                        .size(FONT_TITLE)
                        .strong(),
                );
            });
            ui.add_space(24.0);
            ui.vertical(|ui| {
                ui.label(
                    RichText::new(texts.get("purchases_open_value"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(
                    RichText::new(money("€", summary.open_gross))
                        .size(FONT_TITLE)
                        .strong(),
                );
            });
            ui.add_space(24.0);
            badge(
                ui,
                theme,
                &format!("{} {}", texts.get("purchases_status_draft"), summary.draft),
                Tone::Neutral,
            );
            badge(
                ui,
                theme,
                &format!(
                    "{} {}",
                    texts.get("purchases_status_received"),
                    summary.received
                ),
                Tone::Success,
            );
        });
    });

    ui.add_space(12.0);
    let mut create = false;
    ui.horizontal(|ui| {
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.query,
            texts.get("purchases_search"),
            150.0,
        );
        let mut names: Vec<String> = vec![texts.get("purchases_all_vendors").to_string()];
        names.extend(state.vendors.iter().map(contact_label));
        let labels: Vec<&str> = names.iter().map(String::as_str).collect();
        let previous = state.vendor_choice;
        select(
            ui,
            theme,
            focus,
            &mut state.vendor_filter_popup,
            "purchase-vendor-filter",
            &mut state.vendor_choice,
            &labels,
        );
        if state.vendor_choice != previous {
            let vendor = state
                .vendor_choice
                .checked_sub(1)
                .and_then(|index| state.vendors.get(index))
                .map(|contact| contact.id);
            state.vendor_filter = vendor;
            state.reload = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("purchases_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
    });
    if create {
        state.start_new(now);
        return;
    }

    ui.add_space(12.0);
    if state.orders.is_empty() {
        let searching = !state.query.trim().is_empty() || state.vendor_filter.is_some();
        card(ui, theme, |ui| {
            if searching {
                empty_state(
                    ui,
                    theme,
                    texts.get("purchases_no_results"),
                    texts.get("purchases_no_results_hint"),
                );
            } else {
                empty_state(
                    ui,
                    theme,
                    texts.get("purchases_empty_title"),
                    texts.get("purchases_empty_hint"),
                );
            }
        });
        return;
    }

    let mut chosen = None;
    card(ui, theme, |ui| {
        egui::Grid::new("socdof-purchases-table")
            .num_columns(6)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "purchases_col_number",
                    "purchases_col_vendor",
                    "purchases_col_date",
                    "purchases_col_expected",
                    "purchases_col_total",
                    "purchases_col_status",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for order in &state.orders {
                    if button(ui, theme, focus, &order.number, ButtonVariant::Ghost).activated {
                        chosen = Some(order.id);
                    }
                    ui.label(contact_name(&state.vendors, order.vendor_id));
                    ui.label(format_date(order.order_date));
                    ui.label(
                        order
                            .expected_at
                            .map(format_date)
                            .unwrap_or_else(|| "—".to_string()),
                    );
                    ui.label(money(&order.currency_symbol, order.total_gross()));
                    badge(
                        ui,
                        theme,
                        texts.get(status_key(order.status)),
                        status_tone(order.status),
                    );
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
    state: &mut PurchasesState,
    store: &Store,
) {
    let Some(order) = state.current().cloned() else {
        state.view = PurchasesView::List;
        return;
    };

    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("purchases_detail_title"),
        &order.number,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(&order.number).size(FONT_TITLE).strong());
            badge(
                ui,
                theme,
                texts.get(status_key(order.status)),
                status_tone(order.status),
            );
        });
        ui.add_space(8.0);
        for (label, value) in [
            (
                "purchases_vendor",
                contact_name(&state.vendors, order.vendor_id),
            ),
            ("purchases_ordered_on", format_date(order.order_date)),
            (
                "purchases_expected_on",
                order
                    .expected_at
                    .map(format_date)
                    .unwrap_or_else(|| "—".to_string()),
            ),
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
        if let Some(note) = &order.note {
            ui.add_space(6.0);
            ui.label(RichText::new(note).size(FONT_SMALL));
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("purchases_lines_title")).strong());
        ui.add_space(6.0);
        egui::Grid::new("socdof-purchase-lines")
            .num_columns(6)
            .spacing(egui::vec2(14.0, 6.0))
            .show(ui, |ui| {
                for key in [
                    "purchases_line_description",
                    "purchases_line_quantity",
                    "purchases_line_price",
                    "purchases_total_net",
                    "purchases_total_tax",
                    "purchases_total_gross",
                ] {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .strong()
                            .color(theme.palette.text_muted),
                    );
                }
                ui.end_row();
                for line in &order.lines {
                    ui.label(&line.description);
                    ui.label(milli_text(line.quantity_milli));
                    ui.label(money(&order.currency_symbol, line.unit_cost));
                    ui.label(money(&order.currency_symbol, line.net()));
                    ui.label(money(&order.currency_symbol, line.tax()));
                    ui.label(money(&order.currency_symbol, line.gross()));
                    ui.end_row();
                }
            });
        ui.add_space(8.0);
        for (label, amount) in [
            ("purchases_total_net", order.total_net()),
            ("purchases_total_tax", order.total_tax()),
            ("purchases_total_gross", order.total_gross()),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(RichText::new(money(&order.currency_symbol, amount)).strong());
            });
        }
    });

    ui.add_space(12.0);
    let mut mark = None;
    let mut receive = false;
    let mut edit = false;
    let mut delete = false;
    ui.horizontal(|ui| {
        if order.status == PurchaseOrderStatus::Draft {
            let activated = button(
                ui,
                theme,
                focus,
                texts.get("purchases_mark_ordered"),
                ButtonVariant::Secondary,
            )
            .activated;
            if activated {
                mark = Some(PurchaseOrderStatus::Ordered);
            }
        }
        if order.status.accepts_goods() {
            let activated = button(
                ui,
                theme,
                focus,
                texts.get("purchases_receive"),
                ButtonVariant::Primary,
            )
            .activated;
            if activated {
                receive = true;
            }
        }
        if order.status == PurchaseOrderStatus::Cancelled {
            let activated = button(
                ui,
                theme,
                focus,
                texts.get("purchases_reopen"),
                ButtonVariant::Secondary,
            )
            .activated;
            if activated {
                mark = Some(PurchaseOrderStatus::Draft);
            }
        } else {
            let activated = button(
                ui,
                theme,
                focus,
                texts.get("purchases_cancel_order"),
                ButtonVariant::Danger,
            )
            .activated;
            if activated {
                mark = Some(PurchaseOrderStatus::Cancelled);
            }
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("purchases_edit"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            edit = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("purchases_delete"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            delete = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("purchases_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.view = PurchasesView::List;
        }
    });

    if let Some(status) = mark {
        if state.set_status(store, status).is_err() {
            state.error = Some("purchases_error_status");
        }
    }
    if receive && state.receive(store, SAMPLE_NOW_MS).is_err() {
        state.error = Some("purchases_error_receive");
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
    state: &mut PurchasesState,
    store: &Store,
    now: i64,
) {
    let editing = state.selected.is_some();
    let title = if editing {
        texts.get("purchases_edit_title")
    } else {
        texts.get("purchases_new_title")
    };
    let subtitle = texts.get("purchases_subtitle").to_string();
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
            &mut state.draft.number,
            texts.get("purchases_number"),
            texts.get("purchases_number_hint"),
            None,
        );
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("purchases_vendor"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            let names: Vec<String> = state.vendors.iter().map(contact_label).collect();
            let labels: Vec<&str> = names.iter().map(String::as_str).collect();
            select(
                ui,
                theme,
                focus,
                &mut state.vendor_popup,
                "purchase-vendor",
                &mut state.draft.vendor,
                &labels,
            );
        });
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.note,
            texts.get("purchases_note"),
            texts.get("purchases_note_hint"),
            None,
        );
    });

    ui.add_space(12.0);
    let mut add_line = false;
    let mut remove_line = None;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("purchases_lines_title")).strong());
        ui.add_space(6.0);
        if state.draft.lines.is_empty() {
            ui.label(
                RichText::new(texts.get("purchases_lines_empty"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        }
        for (index, line) in state.draft.lines.iter_mut().enumerate() {
            ui.add_space(6.0);
            ui.label(
                RichText::new(format!(
                    "{} {}",
                    index + 1,
                    texts.get("purchases_line_description")
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
            text_field(
                ui,
                theme,
                focus,
                &mut line.description,
                texts.get("purchases_line_description"),
                texts.get("purchases_line_description_hint"),
                None,
            );
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut line.quantity,
                        texts.get("purchases_line_quantity"),
                        texts.get("purchases_line_quantity_hint"),
                        None,
                    );
                });
                ui.vertical(|ui| {
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut line.unit_cost,
                        texts.get("purchases_line_price"),
                        texts.get("purchases_line_price_hint"),
                        None,
                    );
                });
                ui.vertical(|ui| {
                    text_field(
                        ui,
                        theme,
                        focus,
                        &mut line.tax_rate,
                        texts.get("purchases_line_tax"),
                        texts.get("purchases_line_tax_hint"),
                        None,
                    );
                });
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("purchases_line_remove"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    remove_line = Some(index);
                }
            });
        }
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("purchases_line_add"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            add_line = true;
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        let (net, tax, gross) = draft_totals(&state.draft);
        for (label, amount) in [
            ("purchases_total_net", net),
            ("purchases_total_tax", tax),
            ("purchases_total_gross", gross),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(label))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(RichText::new(money("€", amount)).strong());
            });
        }
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("purchases_save"),
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
                texts.get("purchases_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if add_line {
        state.draft.lines.push(PurchaseLineDraft::default());
    }
    if let Some(index) = remove_line {
        state.draft.lines.remove(index);
    }
    if save && state.save(store, now).is_err() {
        state.error = Some("purchases_error_save");
    }
    if cancel {
        state.cancel_edit();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::theme::Appearance;
    use socdof_core::domain::product::Product;
    use socdof_core::domain::settings::Language;

    fn vendor(store: &Store, name: &str) -> Contact {
        let mut contact = Contact::new(ContactKind::Company, SAMPLE_NOW_MS);
        contact.name = Some(name.to_string());
        contact.company_name = contact.name.clone();
        store.insert_contact(&contact).expect("contact");
        contact
    }

    fn seeded() -> (Store, PurchasesState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_purchases(&store, &texts).expect("seed");
        let mut state = PurchasesState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render(state: &mut PurchasesState, store: &Store) -> String {
        let ctx = crate::theme::headless_context();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(1000.0, 2400.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                purchases(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("purchase frame")).join("\n")
    }

    #[test]
    fn creates_edits_and_deletes_an_order() {
        let store = Store::open_in_memory().expect("store");
        vendor(&store, "Nordroast GmbH");
        let mut state = PurchasesState::new();
        state.refresh(&store).expect("refresh");
        state.start_new(SAMPLE_NOW_MS);
        assert_eq!(state.draft.number, "BE-2026-0001");

        state.draft.lines[0].description = "Kaffeebohnen".to_string();
        state.draft.lines[0].quantity = "10".to_string();
        state.draft.lines[0].unit_cost = "6,50".to_string();
        state.draft.lines[0].tax_rate = "7".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("insert");

        assert!(state.error.is_none());
        assert_eq!(state.view, PurchasesView::Detail);
        let stored = store.list_purchase_orders().expect("list")[0].clone();
        assert_eq!(stored.total_net(), Money::from_cents(6_500));
        assert_eq!(stored.total_tax(), Money::from_cents(455));
        assert_eq!(stored.total_gross(), Money::from_cents(6_955));

        state.start_edit();
        state.draft.lines[0].quantity = "20".to_string();
        state.save(&store, SAMPLE_NOW_MS + 1).expect("update");
        assert_eq!(
            store
                .find_purchase_order(stored.id)
                .expect("find")
                .unwrap()
                .total_net(),
            Money::from_cents(13_000)
        );

        state.delete_selected(&store).expect("delete");
        assert_eq!(store.purchase_order_count().expect("count"), 0);
        assert_eq!(state.view, PurchasesView::List);
    }

    #[test]
    fn moves_through_the_lifecycle_and_receives_goods() {
        let store = Store::open_in_memory().expect("store");
        let supplier = vendor(&store, "Nordroast GmbH");
        let mut product = Product::new("Kaffee", SAMPLE_NOW_MS);
        product.price = Money::from_cents(900);
        store.insert_product(&product).expect("product");

        let order = sample_order(
            supplier.id,
            "BE-2026-0010",
            PurchaseOrderStatus::Draft,
            SAMPLE_NOW_MS,
            vec![PurchaseOrderLine {
                product_id: Some(product.id),
                description: "Kaffee".to_string(),
                quantity_milli: 2_000,
                unit_cost: Money::from_cents(500),
                tax_rate_bp: 700,
            }],
            None,
        );
        store.insert_purchase_order(&order).expect("insert");

        let mut state = PurchasesState::new();
        state.refresh(&store).expect("refresh");
        state.select(order.id);
        state
            .set_status(&store, PurchaseOrderStatus::Ordered)
            .expect("status");
        assert_eq!(
            store.find_purchase_order(order.id).unwrap().unwrap().status,
            PurchaseOrderStatus::Ordered
        );

        state.receive(&store, SAMPLE_NOW_MS).expect("receive");
        assert_eq!(
            store.find_purchase_order(order.id).unwrap().unwrap().status,
            PurchaseOrderStatus::Received
        );
        assert_eq!(store.find_product(product.id).unwrap().unwrap().stock, 2);
        assert_eq!(state.status, Some("purchases_received"));

        state
            .set_status(&store, PurchaseOrderStatus::Cancelled)
            .expect("cancel");
        assert_eq!(
            store.find_purchase_order(order.id).unwrap().unwrap().status,
            PurchaseOrderStatus::Cancelled
        );
    }

    #[test]
    fn rejects_invalid_orders_and_positions() {
        let store = Store::open_in_memory().expect("store");
        let mut state = PurchasesState::new();
        state.refresh(&store).expect("refresh");
        state.start_new(SAMPLE_NOW_MS);
        state.draft.lines[0].description = "Kaffee".to_string();
        state.draft.lines[0].unit_cost = "5".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("purchases_error_vendor"));

        vendor(&store, "Nordroast GmbH");
        state.reload = true;
        state.refresh(&store).expect("reload vendors");
        state.draft.lines[0].quantity = "0".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("purchases_error_quantity"));

        state.draft.lines[0].quantity = "1".to_string();
        state.draft.lines[0].description.clear();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("purchases_error_line_description"));
    }

    #[test]
    fn searches_and_filters_through_the_store() {
        let (store, mut state, _texts) = seeded();
        assert_eq!(state.orders.len(), 3);

        state.query = "0002".to_string();
        state.refresh(&store).expect("search");
        assert_eq!(state.orders.len(), 1);
        assert_eq!(state.orders[0].number, "BE-2026-0002");

        state.query.clear();
        state.reload = true;
        state.refresh(&store).expect("reload");
        let first = state.vendors[0].id;
        state.filter_vendor(Some(first));
        state.refresh(&store).expect("filter");
        assert_eq!(state.orders.len(), 3);
        assert_eq!(state.status, None);
    }

    #[test]
    fn summarises_open_orders() {
        let (_store, state, _texts) = seeded();
        let summary = summarize(&state.orders);
        assert_eq!(summary.open_orders, 1);
        assert_eq!(summary.open_net, Money::from_cents(6_990));
        assert_eq!(summary.open_gross, Money::from_cents(7_538));
        assert_eq!(summary.draft, 1);
        assert_eq!(summary.received, 1);
    }

    #[test]
    fn renders_the_list_the_detail_and_the_form() {
        let (store, mut state, texts) = seeded();

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("purchases_title")));
        assert!(painted.contains("BE-2026-0001"));
        assert!(painted.contains(texts.get("purchases_status_ordered")));
        assert!(painted.contains(texts.get("purchases_new")));

        let id = state.orders[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("purchases_lines_title")));
        assert!(painted.contains(texts.get("purchases_total_gross")));

        state.start_edit();
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("purchases_save")));
        assert!(painted.contains(texts.get("purchases_line_add")));
    }

    #[test]
    fn seeding_is_idempotent_and_uses_the_store() {
        let (store, _state, texts) = seeded();
        seed_purchases(&store, &texts).expect("second seed");
        assert_eq!(store.purchase_order_count().expect("count"), 3);
        let statuses: Vec<PurchaseOrderStatus> = store
            .list_purchase_orders()
            .expect("list")
            .iter()
            .map(|order| order.status)
            .collect();
        assert!(statuses.contains(&PurchaseOrderStatus::Ordered));
        assert!(statuses.contains(&PurchaseOrderStatus::Received));
        assert!(statuses.contains(&PurchaseOrderStatus::Draft));
    }
}
