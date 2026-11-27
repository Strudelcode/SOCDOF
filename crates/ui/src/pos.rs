//! Point-of-sale screen: receipts, payment methods, change and the daily close.
//!
//! The screen works on the core store: the list and search through [`Store::list_pos_orders`] and
//! [`Store::search_pos_orders`], the daily close through [`Store::pos_orders_between`], writes
//! through [`Store::insert_pos_order`] with the domain stock movements, and the cancellation through
//! [`Store::cancel_pos_order`], which returns the sold positions to stock in one transaction.
//! Validation and arithmetic stay in [`socdof_core::domain::pos`]; the screen only maps snake_case
//! codes to catalogue keys, so invalid input never reaches the database.
//!
//! Views are register, list, daily close, detail and form. Every control registers in the shared
//! [`FocusState`], every
//! visible string comes from the catalogue and all painting uses the design tokens.

use egui::{Align, Context, Layout, RichText, Vec2};
use socdof_core::date;
use socdof_core::domain::contact::Contact;
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::pos::{
    summarize, z_report, PaymentMethod, PosOrder, PosOrderLine, PosZReport,
};
use socdof_core::domain::product::Product;
use socdof_core::domain::stock::StockMoveKind;
use socdof_core::money::Money;
#[cfg(any(feature = "dialogs", test))]
use socdof_core::pdf::writer::Document;
use socdof_core::store::Store;
use socdof_core::CoreError;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, form_columns, modal, search_field_reserved, toolbar,
    ButtonVariant, Tone, FORM_STACK_WIDTH, TOOLBAR_STACK_WIDTH,
};
use crate::controls::{select, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample receipts, shared with the other module fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Length of one day in milliseconds.
const DAY_MS: i64 = 24 * 60 * 60 * 1_000;

/// Length of one hour in milliseconds.
const HOUR_MS: i64 = 60 * 60 * 1_000;

/// Payment methods in display and storage order.
const PAYMENTS: [PaymentMethod; 6] = [
    PaymentMethod::Cash,
    PaymentMethod::Card,
    PaymentMethod::Nfc,
    PaymentMethod::BankTransfer,
    PaymentMethod::Invoice,
    PaymentMethod::Other,
];

/// View currently shown by the POS screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum PosView {
    /// Cash register: product tiles, cart, payment and the last receipt.
    #[default]
    Register,
    /// Searchable list of all receipts with the daily close.
    List,
    /// Daily close with payment and VAT groups plus the text export.
    ZReport,
    /// Detail of the selected receipt.
    Detail,
    /// New receipt form with the positions.
    Form,
}

impl PosView {
    /// Catalogue key of the view title.
    pub fn title_key(self) -> &'static str {
        match self {
            PosView::Register => "pos_register_title",
            PosView::List => "pos_title",
            PosView::ZReport => "pos_z_title",
            PosView::Detail => "pos_detail_title",
            PosView::Form => "pos_form_title",
        }
    }
}

/// Editable values of one receipt position.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PosLineDraft {
    /// Index into the loaded products, `0` meaning a free-text position.
    pub product: usize,
    /// Description printed on the receipt.
    pub description: String,
    /// Quantity in whole units or decimals, as entered.
    pub quantity: String,
    /// Net unit price as entered.
    pub unit_price: String,
    /// Tax rate in percent as entered.
    pub tax_rate: String,
}

impl Default for PosLineDraft {
    fn default() -> Self {
        Self {
            product: 0,
            description: String::new(),
            quantity: "1".to_string(),
            unit_price: String::new(),
            tax_rate: "19".to_string(),
        }
    }
}

impl PosLineDraft {
    /// Fills the draft from a stored position.
    pub fn from_line(line: &PosOrderLine, products: &[Product]) -> Self {
        Self {
            product: line
                .product_id
                .and_then(|id| products.iter().position(|product| product.id == id))
                .map(|index| index + 1)
                .unwrap_or(0),
            description: line.description.clone(),
            quantity: milli_text(line.quantity_milli),
            unit_price: line.unit_price.to_decimal_string(),
            tax_rate: percent_text(line.tax_rate_bp),
        }
    }

    fn to_line(&self, products: &[Product]) -> Result<PosOrderLine, &'static str> {
        if self.description.trim().is_empty() {
            return Err("pos_error_line_description");
        }
        let quantity_milli = parse_quantity(&self.quantity).ok_or("pos_error_quantity")?;
        let unit_price = Money::parse(&self.unit_price).ok_or("pos_error_price")?;
        if unit_price.cents() < 0 {
            return Err("pos_error_price");
        }
        let tax_rate_bp = parse_percent_bp(&self.tax_rate).ok_or("pos_error_tax")?;
        let product_id = self
            .product
            .checked_sub(1)
            .and_then(|index| products.get(index))
            .map(|product| product.id);

        Ok(PosOrderLine {
            product_id,
            description: self.description.trim().to_string(),
            quantity_milli,
            unit_price,
            tax_rate_bp,
        })
    }
}

/// Editable values of one receipt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PosDraft {
    /// Receipt number, unique per company.
    pub number: String,
    /// Index into [`PAYMENTS`].
    pub payment: usize,
    /// Optional note.
    pub note: String,
    /// Cash handed over, as entered.
    pub cash_given: String,
    /// Sold positions.
    pub lines: Vec<PosLineDraft>,
}

impl Default for PosDraft {
    fn default() -> Self {
        Self {
            number: String::new(),
            payment: 0,
            note: String::new(),
            cash_given: String::new(),
            lines: vec![PosLineDraft::default()],
        }
    }
}

impl PosDraft {
    /// Builds the receipt to store.
    pub fn to_order(&self, products: &[Product], now: i64) -> Result<PosOrder, &'static str> {
        if self.number.trim().is_empty() {
            return Err("pos_error_number");
        }
        if self.lines.is_empty() {
            return Err("pos_error_lines");
        }

        let payment_method = *PAYMENTS.get(self.payment).ok_or("pos_error_payment")?;
        let cash_given = if self.cash_given.trim().is_empty() {
            None
        } else {
            let amount = Money::parse(&self.cash_given).ok_or("pos_error_cash")?;
            if amount.cents() < 0 {
                return Err("pos_error_cash");
            }
            Some(amount)
        };

        let mut lines = Vec::with_capacity(self.lines.len());
        for line in &self.lines {
            lines.push(line.to_line(products)?);
        }

        Ok(PosOrder {
            id: Uuid::new_v4(),
            receipt_number: self.number.trim().to_string(),
            contact_id: None,
            payment_method,
            paid_at: now,
            currency_symbol: "€".to_string(),
            note: non_empty(&self.note),
            tax_total_override_cents: None,
            cash_given,
            discount_bp: 0,
            lines,
            legacy_id: None,
        })
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
    let quantity = Money::parse_scaled_decimal(input, 3)?;
    (quantity > 0).then_some(quantity)
}

fn parse_percent_bp(input: &str) -> Option<i64> {
    let basis_points = Money::parse_scaled_decimal(input, 2)?;
    (0..=10_000).contains(&basis_points).then_some(basis_points)
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
    date::format_date(ms)
}

fn format_time(ms: i64) -> String {
    let minutes = ms.rem_euclid(DAY_MS) / 60_000;
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

fn money(symbol: &str, amount: Money) -> String {
    amount.format_localized(symbol)
}

#[cfg(any(feature = "dialogs", test))]
fn receipt_pdf(order: &PosOrder, customer: Option<&str>, texts: &UiTexts) -> Vec<u8> {
    let mut document = Document::new(&order.receipt_number);
    {
        let page = document.page_mut();
        page.text_bold(42.0, 790.0, 18.0, texts.get("pos_detail_title"));
        page.text_bold(42.0, 764.0, 12.0, &order.receipt_number);
        page.text(
            42.0,
            746.0,
            9.0,
            &format!(
                "{}: {} {}",
                texts.get("pos_col_time"),
                format_date(order.paid_at),
                format_time(order.paid_at)
            ),
        );
        page.text(
            42.0,
            731.0,
            9.0,
            &format!(
                "{}: {}",
                texts.get("pos_col_payment"),
                texts.get(payment_key(order.payment_method))
            ),
        );
        if let Some(customer) = customer.filter(|name| !name.trim().is_empty()) {
            page.text(
                42.0,
                716.0,
                9.0,
                &format!("{}: {customer}", texts.get("contacts_col_name")),
            );
        }
        page.line(42.0, 700.0, 553.0, 0.6);
        page.text_bold(42.0, 684.0, 9.0, texts.get("pos_lines_title"));
    }

    let mut y = 665.0;
    for line in &order.lines {
        if y < 72.0 {
            let page = document.new_page();
            page.text_bold(42.0, 790.0, 12.0, &order.receipt_number);
            y = 765.0;
        }
        let description_lines = wrap_receipt_description(&line.description, 360.0, 9.0);
        for description in description_lines {
            document.page_mut().text(42.0, y, 9.0, &description);
            y -= 13.0;
        }
        document.page_mut().text(
            54.0,
            y,
            8.0,
            &format!(
                "{} x {}",
                milli_text(line.quantity_milli),
                money(&order.currency_symbol, line.unit_price)
            ),
        );
        document.page_mut().text_right_bold(
            553.0,
            y,
            9.0,
            &money(&order.currency_symbol, line.gross()),
        );
        y -= 18.0;
    }

    if y < 120.0 {
        let page = document.new_page();
        page.text_bold(42.0, 790.0, 12.0, &order.receipt_number);
        y = 765.0;
    }
    let page = document.page_mut();
    page.line(42.0, y, 553.0, 0.6);
    y -= 18.0;
    for (label, amount) in [
        ("pos_total_net", order.total_net()),
        ("pos_total_tax", order.total_tax()),
        ("pos_total_gross", order.total_gross()),
    ] {
        page.text(42.0, y, 9.0, texts.get(label));
        page.text_right_bold(553.0, y, 9.0, &money(&order.currency_symbol, amount));
        y -= 15.0;
    }
    if let Some(given) = order.cash_given {
        page.text(
            42.0,
            y,
            9.0,
            &format!(
                "{}: {}",
                texts.get("pos_cash_given"),
                money(&order.currency_symbol, given)
            ),
        );
        y -= 15.0;
        if let Some(change) = order.change() {
            page.text(
                42.0,
                y,
                9.0,
                &format!(
                    "{}: {}",
                    texts.get("pos_change"),
                    money(&order.currency_symbol, change)
                ),
            );
            y -= 15.0;
        }
    }
    if let Some(note) = order.note.as_deref().filter(|note| !note.trim().is_empty()) {
        page.text(42.0, y, 9.0, &format!("{}: {note}", texts.get("pos_note")));
    }
    document.to_bytes()
}

#[cfg(any(feature = "dialogs", test))]
fn wrap_receipt_description(description: &str, max_width: f64, size: f64) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in description.split_whitespace() {
        let candidate = if current.is_empty() {
            word.to_string()
        } else {
            format!("{current} {word}")
        };
        if !current.is_empty() && socdof_core::pdf::writer::text_width(&candidate, size) > max_width
        {
            lines.push(std::mem::take(&mut current));
        }
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(word);
    }
    if !current.is_empty() {
        lines.push(current);
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    lines
}

fn payment_key(method: PaymentMethod) -> &'static str {
    match method {
        PaymentMethod::Cash => "pos_payment_cash",
        PaymentMethod::Card => "pos_payment_card",
        PaymentMethod::Nfc => "pos_payment_nfc",
        PaymentMethod::BankTransfer => "pos_payment_bank_transfer",
        PaymentMethod::Invoice => "pos_payment_invoice",
        PaymentMethod::Other => "pos_payment_other",
    }
}

fn payment_tone(method: PaymentMethod) -> Tone {
    match method {
        PaymentMethod::Cash => Tone::Success,
        PaymentMethod::Card => Tone::Accent,
        PaymentMethod::Nfc => Tone::Accent,
        PaymentMethod::BankTransfer => Tone::Neutral,
        PaymentMethod::Invoice => Tone::Warning,
        PaymentMethod::Other => Tone::Neutral,
    }
}

fn suggest_number(orders: &[PosOrder], now: i64) -> String {
    let (year, _, _) = date::civil_from_millis(now);
    let prefix = format!("BON-{year}-");
    let highest = orders
        .iter()
        .filter_map(|order| order.receipt_number.strip_prefix(&prefix))
        .filter_map(|suffix| suffix.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    format!("{prefix}{:04}", highest + 1)
}

fn draft_totals(draft: &PosDraft, products: &[Product]) -> (Money, Money, Money) {
    let mut net = Money::ZERO;
    let mut tax = Money::ZERO;
    for line in &draft.lines {
        if let Ok(line) = line.to_line(products) {
            net = net + line.net();
            tax = tax + line.tax();
        }
    }
    (net, tax, net + tax)
}

fn day_start(ms: i64) -> i64 {
    ms.div_euclid(DAY_MS) * DAY_MS
}

/// State of the POS screen.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PosState {
    /// Search text; empty lists every receipt.
    pub query: String,
    /// Receipts matching the last loaded query and payment filter.
    pub orders: Vec<PosOrder>,
    /// Receipts of the newest day, used for the daily close.
    pub day: Vec<PosOrder>,
    /// Products selectable in the form and shown as register tiles.
    pub products: Vec<Product>,
    /// Contacts selectable as the receipt customer.
    pub contacts: Vec<Contact>,
    /// Cart of the register, newest line last.
    pub cart: Vec<PosOrderLine>,
    /// Barcode or SKU entered at the register.
    pub barcode: String,
    /// Catalog search text.
    pub catalog_query: String,
    /// Selected catalog category, `0` meaning every category.
    pub category_choice: usize,
    /// Receipt-wide discount in percent, as entered.
    pub discount: String,
    /// Index into [`PAYMENTS`] of the register payment.
    pub payment: usize,
    /// Cash handed over at the register, as entered.
    pub tender: String,
    /// Index into the contacts, `0` meaning no customer.
    pub customer: usize,
    /// Receipt booked by the last checkout, shown above the register.
    pub last_receipt: Option<Uuid>,
    /// Selected payment filter; `None` shows every method.
    pub payment_filter: Option<PaymentMethod>,
    /// Index into the filter list, `0` meaning every method.
    pub payment_choice: usize,
    /// Selected receipt, shown by the detail view.
    pub selected: Option<Uuid>,
    /// Current view.
    pub view: PosView,
    /// Editable values of the form.
    pub draft: PosDraft,
    /// Dropdown state of the payment select.
    pub payment_popup: PopupState,
    /// Dropdown state of the payment filter.
    pub filter_popup: PopupState,
    /// Dropdown states of the product selects, one per form line.
    pub line_popups: Vec<PopupState>,
    /// Whether the cancellation confirmation is open.
    pub confirm_cancel: bool,
    /// Catalogue key of the validation or storage error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded_query: String,
    loaded_payment: Option<PaymentMethod>,
    reload: bool,
}

impl Default for PosState {
    fn default() -> Self {
        Self {
            query: String::new(),
            orders: Vec::new(),
            day: Vec::new(),
            products: Vec::new(),
            contacts: Vec::new(),
            cart: Vec::new(),
            barcode: String::new(),
            catalog_query: String::new(),
            category_choice: 0,
            discount: String::new(),
            payment: 0,
            tender: String::new(),
            customer: 0,
            last_receipt: None,
            payment_filter: None,
            payment_choice: 0,
            selected: None,
            view: PosView::Register,
            draft: PosDraft::default(),
            payment_popup: PopupState::default(),
            filter_popup: PopupState::default(),
            line_popups: vec![PopupState::default()],
            confirm_cancel: false,
            error: None,
            status: None,
            back: false,
            loaded_query: String::new(),
            loaded_payment: None,
            reload: true,
        }
    }
}

impl PosState {
    /// Creates an empty screen; the first [`PosState::refresh`] loads the list.
    pub fn new() -> Self {
        Self::default()
    }

    /// Reloads the list when the query or the payment filter changed, or a write invalidated it.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if !self.reload
            && self.loaded_query == self.query
            && self.loaded_payment == self.payment_filter
        {
            return Ok(());
        }

        let all = if self.query.trim().is_empty() {
            store.list_pos_orders()?
        } else {
            store.search_pos_orders(&self.query)?
        };
        self.products = store.list_products()?;
        self.contacts = store.list_contacts()?;
        self.day = match all.first() {
            Some(latest) => {
                let start = day_start(latest.paid_at);
                store.pos_orders_between(start, start + DAY_MS)?
            }
            None => Vec::new(),
        };
        self.orders = all
            .into_iter()
            .filter(|order| {
                self.payment_filter
                    .map(|method| order.payment_method == method)
                    .unwrap_or(true)
            })
            .collect();
        self.loaded_query = self.query.clone();
        self.loaded_payment = self.payment_filter;
        self.reload = false;
        Ok(())
    }

    /// Opens the cash register.
    pub fn open_register(&mut self) {
        self.view = PosView::Register;
        self.confirm_cancel = false;
        self.error = None;
    }

    /// Opens the receipt list.
    pub fn open_list(&mut self) {
        self.view = PosView::List;
        self.confirm_cancel = false;
        self.error = None;
    }

    /// Opens the daily close.
    pub fn open_z_report(&mut self) {
        self.view = PosView::ZReport;
        self.confirm_cancel = false;
        self.error = None;
    }

    /// Categories of the catalog in display order; the first entry is "all".
    pub fn categories(&self) -> Vec<String> {
        let mut categories = self
            .products
            .iter()
            .filter(|product| product.active && !product.category.trim().is_empty())
            .map(|product| product.category.clone())
            .collect::<Vec<_>>();
        categories.sort();
        categories.dedup();
        categories
    }

    /// Products after the catalog search and category filter.
    pub fn catalog(&self) -> Vec<&Product> {
        let categories = self.categories();
        let selected = self
            .category_choice
            .checked_sub(1)
            .and_then(|index| categories.get(index));
        let query = self.catalog_query.trim().to_lowercase();
        self.products
            .iter()
            .filter(|product| product.active)
            .filter(|product| selected.map_or(true, |category| &product.category == category))
            .filter(|product| {
                query.is_empty()
                    || product.name.to_lowercase().contains(&query)
                    || product.sku.to_lowercase().contains(&query)
                    || product
                        .barcode
                        .as_deref()
                        .is_some_and(|barcode| barcode.contains(&query))
            })
            .collect()
    }

    /// Adds one product to the cart or raises the quantity of its line.
    pub fn add_product(&mut self, product_id: Uuid) {
        let Some(product) = self
            .products
            .iter()
            .find(|product| product.id == product_id)
        else {
            return;
        };
        if let Some(line) = self
            .cart
            .iter_mut()
            .find(|line| line.product_id == Some(product_id))
        {
            line.quantity_milli += 1_000;
        } else {
            self.cart.push(PosOrderLine {
                product_id: Some(product.id),
                description: product.name.clone(),
                quantity_milli: 1_000,
                unit_price: product.price,
                tax_rate_bp: product.tax_rate_bp,
            });
        }
        self.error = None;
    }

    /// Finds the entered barcode or SKU and puts it into the cart.
    pub fn scan_barcode(&mut self) {
        let code = self.barcode.trim().to_lowercase();
        if code.is_empty() {
            return;
        }
        let product = self.products.iter().find(|product| {
            product
                .barcode
                .as_deref()
                .is_some_and(|barcode| barcode.eq_ignore_ascii_case(&code))
                || product.sku.eq_ignore_ascii_case(&code)
        });
        match product {
            Some(product) => {
                let id = product.id;
                self.add_product(id);
                self.barcode.clear();
                self.status = Some("pos_scan_added");
            }
            None => {
                self.error = Some("pos_scan_not_found");
                self.status = None;
            }
        }
    }

    /// Raises or lowers the quantity of one cart line; zero removes it.
    pub fn step_cart(&mut self, index: usize, delta: i64) {
        let Some(line) = self.cart.get_mut(index) else {
            return;
        };
        line.quantity_milli = (line.quantity_milli + delta * 1_000).max(0);
        if line.quantity_milli == 0 {
            self.cart.remove(index);
        }
    }

    /// Removes one cart line.
    pub fn remove_cart(&mut self, index: usize) {
        if index < self.cart.len() {
            self.cart.remove(index);
        }
    }

    /// Empties the cart, the discount and the tendered cash.
    pub fn clear_cart(&mut self) {
        self.cart.clear();
        self.discount.clear();
        self.tender.clear();
        self.error = None;
        self.status = None;
    }

    /// Receipt discount in basis points from the percent field.
    pub fn discount_bp(&self) -> i64 {
        if self.discount.trim().is_empty() {
            0
        } else {
            parse_percent_bp(&self.discount).unwrap_or(0)
        }
    }

    /// Net, tax and gross of the cart after the discount.
    pub fn cart_totals(&self) -> (Money, Money, Money) {
        let discount = self.discount_bp();
        let net: Money = self.cart.iter().map(|line| line.net_for(discount)).sum();
        let tax: Money = self.cart.iter().map(|line| line.tax_for(discount)).sum();
        (net, tax, net + tax)
    }

    /// Builds the receipt of the cart; `receipt_number` is chosen by the caller.
    pub fn cart_order(&self, receipt_number: &str, now: i64) -> Result<PosOrder, &'static str> {
        if self.cart.is_empty() {
            return Err("pos_error_lines");
        }
        let discount_bp = self.discount_bp();
        if !self.discount.trim().is_empty() && parse_percent_bp(&self.discount).is_none() {
            return Err("pos_error_discount");
        }
        let payment_method = *PAYMENTS.get(self.payment).ok_or("pos_error_payment")?;
        let cash_given = if self.tender.trim().is_empty() {
            None
        } else {
            let amount = Money::parse(&self.tender).ok_or("pos_error_cash")?;
            Some(amount)
        };
        let contact_id = self
            .customer
            .checked_sub(1)
            .and_then(|index| self.contacts.get(index))
            .map(|contact| contact.id);
        Ok(PosOrder {
            id: Uuid::new_v4(),
            receipt_number: receipt_number.to_string(),
            contact_id,
            payment_method,
            paid_at: now,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            cash_given,
            discount_bp,
            lines: self.cart.clone(),
            legacy_id: None,
        })
    }

    /// Books the cart as a paid receipt, deducts stock and creates the invoice when a customer is
    /// selected. Returns the stored receipt on success.
    pub fn checkout(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<Option<Uuid>> {
        let receipt_number = suggest_number(&store.list_pos_orders()?, now);
        let order = match self.cart_order(&receipt_number, now) {
            Ok(order) => order,
            Err(key) => {
                self.error = Some(key);
                self.status = None;
                return Ok(None);
            }
        };
        if let Err(code) = order.validate() {
            self.error = Some(validation_key(&code));
            self.status = None;
            return Ok(None);
        }

        let invoice = order.contact_id.map(|contact_id| Invoice {
            id: Uuid::new_v4(),
            number: order.receipt_number.clone(),
            contact_id,
            status: InvoiceStatus::Paid,
            issued_at: order.paid_at,
            due_at: order.paid_at,
            currency_symbol: order.currency_symbol.clone(),
            note: Some(order.receipt_number.clone()),
            tax_total_override_cents: None,
            lines: order
                .lines
                .iter()
                .map(|line| InvoiceLine {
                    description: line.description.clone(),
                    quantity_milli: line.quantity_milli,
                    unit_price: line.unit_price,
                    tax_rate_bp: line.tax_rate_bp,
                })
                .collect(),
        });

        match store.pos_checkout(&order, invoice.as_ref()) {
            Ok(()) => {}
            Err(CoreError::Validation(code)) if code == "stock_insufficient" => {
                self.error = Some("pos_error_stock");
                self.status = None;
                return Ok(None);
            }
            Err(_) => {
                self.error = Some("pos_error_save");
                self.status = None;
                return Ok(None);
            }
        }

        self.last_receipt = Some(order.id);
        self.selected = Some(order.id);
        self.cart.clear();
        self.discount.clear();
        self.tender.clear();
        self.barcode.clear();
        self.error = None;
        self.status = Some("pos_checkout_done");
        self.reload = true;
        self.refresh(store)?;
        Ok(Some(order.id))
    }

    /// Receipt booked by the last checkout, when it still exists.
    pub fn last_receipt(&self) -> Option<&PosOrder> {
        self.last_receipt
            .and_then(|id| self.orders.iter().find(|order| order.id == id))
    }

    /// Daily close of the newest business day.
    pub fn z_report(&self) -> PosZReport {
        z_report(&self.day)
    }

    /// Writes the Z report of the newest business day as a text file.
    pub fn export_z_report(
        &self,
        path: &std::path::Path,
        texts: &UiTexts,
        now: i64,
    ) -> socdof_core::CoreResult<u64> {
        let content = self.z_report_text(texts, now);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content.as_bytes())?;
        Ok(content.len() as u64)
    }

    /// Plain-text Z report with the catalogue labels of the screen.
    pub fn z_report_text(&self, texts: &UiTexts, now: i64) -> String {
        let report = self.z_report();
        let day = self
            .day
            .first()
            .map(|order| format_date(order.paid_at))
            .unwrap_or_else(|| format_date(now));
        let symbol = self
            .day
            .first()
            .map(|order| order.currency_symbol.clone())
            .unwrap_or_else(|| "€".to_string());
        let mut lines = vec![
            format!("{} {}", texts.get("pos_z_title"), day),
            String::new(),
            format!("{}: {}", texts.get("pos_summary_receipts"), report.receipts),
        ];
        if let (Some(first), Some(last)) = (report.first_at, report.last_at) {
            lines.push(format!(
                "{}: {}   {}: {}",
                texts.get("pos_z_first"),
                format_time(first),
                texts.get("pos_z_last"),
                format_time(last)
            ));
        }
        lines.push(String::new());
        for (key, amount) in [
            ("pos_summary_net", report.summary.net),
            ("pos_summary_tax", report.summary.tax),
            ("pos_summary_gross", report.summary.gross),
        ] {
            lines.push(format!("{}: {}", texts.get(key), money(&symbol, amount)));
        }
        lines.push(format!(
            "{}: {}",
            texts.get("pos_z_discounts"),
            money(
                &symbol,
                Money::from_cents(
                    self.day
                        .iter()
                        .map(|order| order.discount_amount().cents())
                        .sum()
                )
            )
        ));
        lines.push(String::new());
        for (key, amount) in [
            ("pos_summary_cash", report.summary.cash),
            ("pos_summary_card", report.summary.card),
            ("pos_summary_nfc", report.summary.nfc),
            ("pos_summary_bank_transfer", report.summary.bank_transfer),
            ("pos_summary_invoice", report.summary.invoice),
            ("pos_summary_other", report.summary.other),
        ] {
            lines.push(format!("{}: {}", texts.get(key), money(&symbol, amount)));
        }
        lines.push(String::new());
        lines.push(format!(
            "{}: {}",
            texts.get("pos_cash_given"),
            money(&symbol, report.summary.cash_given)
        ));
        lines.push(format!(
            "{}: {}",
            texts.get("pos_change"),
            money(&symbol, report.summary.change)
        ));
        lines.push(String::new());
        lines.push(format!("{}:", texts.get("pos_z_tax_groups")));
        for group in &report.tax_groups {
            lines.push(format!(
                "{} {}%: {} / {}",
                texts.get("pos_total_net"),
                group.rate_bp as f64 / 100.0,
                money(&symbol, group.net),
                money(&symbol, group.tax)
            ));
        }
        lines.push(String::new());
        lines.push(format!("{}:", texts.get("pos_z_receipt_list")));
        lines.extend(report.numbers.iter().map(|number| format!("- {number}")));
        lines.push(String::new());
        lines.join("\n")
    }

    /// Selected receipt, if it is still part of the loaded list.
    pub fn current(&self) -> Option<&PosOrder> {
        self.selected
            .and_then(|id| self.orders.iter().find(|order| order.id == id))
    }

    /// Opens the detail view of a receipt.
    pub fn select(&mut self, id: Uuid) {
        self.selected = Some(id);
        self.view = PosView::Detail;
    }

    /// Restricts the list to one payment method; `None` shows every method.
    pub fn filter_payment(&mut self, method: Option<PaymentMethod>) {
        self.payment_filter = method;
        self.payment_choice = method
            .and_then(|method| PAYMENTS.iter().position(|candidate| *candidate == method))
            .map(|index| index + 1)
            .unwrap_or(0);
        self.reload = true;
    }

    /// Opens an empty form with the next receipt number.
    pub fn start_new(&mut self, now: i64) {
        self.selected = None;
        self.draft = PosDraft {
            number: suggest_number(&self.orders, now),
            payment: 0,
            note: String::new(),
            cash_given: String::new(),
            lines: vec![PosLineDraft::default()],
        };
        self.line_popups = vec![PopupState::default()];
        self.error = None;
        self.status = None;
        self.view = PosView::Form;
    }

    /// Leaves the form without writing.
    pub fn cancel_edit(&mut self) {
        self.error = None;
        self.view = PosView::List;
    }

    /// Validates, books stock and stores the draft.
    ///
    /// Validation failures set [`PosState::error`] and return `Ok(())`; storage errors are mapped
    /// to a catalogue key so a missing stock never leaves a partial sale behind.
    pub fn save(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let order = match self.draft.to_order(&self.products, now) {
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

        let movements = order.stock_moves(now);
        match store.insert_pos_order(&order, &movements) {
            Ok(()) => {}
            Err(CoreError::Validation(code)) if code == "stock_insufficient" => {
                self.error = Some("pos_error_stock");
                self.status = None;
                return Ok(());
            }
            Err(_) => {
                self.error = Some("pos_error_save");
                self.status = None;
                return Ok(());
            }
        }

        self.selected = Some(order.id);
        self.view = PosView::Detail;
        self.error = None;
        self.status = Some("pos_saved");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }

    /// Cancels the selected receipt after the caller confirmed it, returning goods to stock.
    pub fn cancel_selected(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(id) = self.selected else {
            return Ok(());
        };

        store.cancel_pos_order(id, now)?;
        self.selected = None;
        self.view = PosView::List;
        self.confirm_cancel = false;
        self.error = None;
        self.status = Some("pos_cancelled");
        self.reload = true;
        self.refresh(store)?;
        Ok(())
    }
}

fn validation_key(code: &str) -> &'static str {
    match code {
        "receipt_number_required" => "pos_error_number",
        "lines_required" => "pos_error_lines",
        "line_description_required" => "pos_error_line_description",
        "line_quantity_invalid" => "pos_error_quantity",
        "line_price_negative" => "pos_error_price",
        "line_tax_rate_out_of_range" => "pos_error_tax",
        "cash_given_negative" | "cash_given_too_low" => "pos_error_cash",
        _ => "pos_error_save",
    }
}

fn sample_line(product: &Product, quantity_milli: i64) -> PosOrderLine {
    PosOrderLine {
        product_id: Some(product.id),
        description: product.name.clone(),
        quantity_milli,
        unit_price: product.price,
        tax_rate_bp: product.tax_rate_bp,
    }
}

fn sample_order(
    number: &str,
    payment_method: PaymentMethod,
    paid_at: i64,
    cash_given: Option<Money>,
    lines: Vec<PosOrderLine>,
    note: Option<String>,
) -> PosOrder {
    PosOrder {
        id: Uuid::new_v4(),
        receipt_number: number.to_string(),
        contact_id: None,
        payment_method,
        paid_at,
        currency_symbol: "€".to_string(),
        note,
        tax_total_override_cents: None,
        cash_given,
        discount_bp: 0,
        lines,
        legacy_id: None,
    }
}

/// Seeds three deterministic receipts for the gallery and the golden snapshots.
///
/// The sample creates its own two products, books their stock in through the core and sells them
/// through [`Store::insert_pos_order`] with the domain movements, so receipts, stock and the daily
/// close all use the real write paths. It is a no-op when the store already has receipts.
pub fn seed_pos(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if store.pos_order_count()? > 0 {
        return Ok(());
    }

    let mut espresso = Product::new(texts.get("pos_sample_product_a"), SAMPLE_NOW_MS);
    espresso.sku = "POS-A".to_string();
    espresso.price = Money::from_cents(250);
    espresso.cost_price = Money::from_cents(100);
    espresso.tax_rate_bp = 700;
    espresso.category = texts.get("pos_sample_category_drinks").to_string();
    espresso.barcode = Some("4000001".to_string());
    espresso.image_emoji = Some("☕".to_string());
    store.insert_product(&espresso)?;

    let mut cup = Product::new(texts.get("pos_sample_product_b"), SAMPLE_NOW_MS);
    cup.sku = "POS-B".to_string();
    cup.price = Money::from_cents(450);
    cup.cost_price = Money::from_cents(200);
    cup.tax_rate_bp = 1900;
    cup.category = texts.get("pos_sample_category_food").to_string();
    cup.barcode = Some("4000002".to_string());
    cup.image_emoji = Some("C".to_string());
    store.insert_product(&cup)?;

    for product in [&espresso, &cup] {
        store.adjust_stock(&socdof_core::domain::stock::StockMove {
            id: Uuid::new_v4(),
            product_id: product.id,
            kind: StockMoveKind::In,
            quantity: 20,
            reason: Some(texts.get("pos_sample_stock").to_string()),
            created_at: SAMPLE_NOW_MS,
        })?;
    }

    let cash = sample_order(
        "BON-2026-0001",
        PaymentMethod::Cash,
        SAMPLE_NOW_MS - 3 * HOUR_MS,
        Some(Money::from_cents(2_000)),
        vec![sample_line(&espresso, 2_000), sample_line(&cup, 2_000)],
        Some(texts.get("pos_sample_note").to_string()),
    );
    store.insert_pos_order(&cash, &cash.stock_moves(cash.paid_at))?;

    let card = sample_order(
        "BON-2026-0002",
        PaymentMethod::Card,
        SAMPLE_NOW_MS - 2 * HOUR_MS,
        None,
        vec![sample_line(&espresso, 1_000)],
        None,
    );
    store.insert_pos_order(&card, &card.stock_moves(card.paid_at))?;

    let invoice = sample_order(
        "BON-2026-0003",
        PaymentMethod::Invoice,
        SAMPLE_NOW_MS - HOUR_MS,
        None,
        vec![sample_line(&cup, 4_000)],
        None,
    );
    store.insert_pos_order(&invoice, &invoice.stock_moves(invoice.paid_at))?;

    Ok(())
}

fn screen_header(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    title: &str,
    subtitle: &str,
) {
    crate::chrome::module_header(
        ui,
        theme,
        texts,
        focus,
        crate::chrome::ModuleHeader {
            app: crate::chrome::app_chrome("pos"),
            title,
            subtitle,
            status: None,
        },
        &mut state.back,
    );
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &PosState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

/// Renders the POS screen into the context.
/// Renders the POS screen into the context.
pub fn pos(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    store: &Store,
    now: i64,
) {
    egui::CentralPanel::default()
        .frame(
            egui::Frame::none()
                .fill(theme.palette.background)
                .inner_margin(egui::Margin::same(24.0)),
        )
        .show(ctx, |ui| {
            pos_window(ctx, true, ui, theme, texts, focus, state, store, now);
        });
}

/// Renders the complete POS workflow inside a native desktop window.
#[allow(clippy::too_many_arguments)]
pub fn pos_window(
    ctx: &Context,
    active: bool,
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    store: &Store,
    now: i64,
) {
    if active && !state.confirm_cancel && ctx.input(|input| input.key_pressed(egui::Key::Escape)) {
        match state.view {
            PosView::Register | PosView::ZReport => state.open_list(),
            PosView::List => state.back = true,
            PosView::Detail => state.view = PosView::List,
            PosView::Form => state.cancel_edit(),
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("pos_error_load");
    }

    egui::ScrollArea::vertical().show(ui, |ui| match state.view {
        PosView::Register => register_view(ui, theme, texts, focus, state, store, now),
        PosView::List => list_view(ui, theme, texts, focus, state, now),
        PosView::ZReport => z_report_view(ui, theme, texts, focus, state, now),
        PosView::Detail => detail_view(ui, theme, texts, focus, state, store),
        PosView::Form => form_view(ui, theme, texts, focus, state, store, now),
    });

    let mut open = state.confirm_cancel;
    let mut confirm = false;
    {
        let focus = &mut *focus;
        modal(ctx, theme, &mut open, texts.get("pos_cancel_title"), |ui| {
            ui.label(texts.get("pos_cancel_body"));
            ui.add_space(12.0);
            let mut close = false;
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("pos_cancel_confirm"),
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
                    texts.get("pos_cancel_abort"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    close = true;
                }
            });
            close
        });
    }
    state.confirm_cancel = open;

    if confirm && state.cancel_selected(store, now).is_err() {
        state.error = Some("pos_error_cancel");
    }
}

/// Switches between the register, the receipt list and the daily close.
fn pos_tabs(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
) {
    ui.horizontal_wrapped(|ui| {
        for (view, key) in [
            (PosView::Register, "pos_tab_register"),
            (PosView::List, "pos_tab_receipts"),
            (PosView::ZReport, "pos_tab_zreport"),
        ] {
            let variant = if state.view == view {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, texts.get(key), variant).activated {
                match view {
                    PosView::Register => state.open_register(),
                    PosView::List => state.open_list(),
                    PosView::ZReport => state.open_z_report(),
                    PosView::Detail | PosView::Form => {}
                }
            }
        }
    });
}

fn truncate(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_string();
    }
    let mut shortened = text.chars().take(limit).collect::<String>();
    shortened.push('…');
    shortened
}

/// Catalogue with product tiles, the cart and the payment of the register.
fn register_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    store: &Store,
    now: i64,
) {
    let subtitle = texts.count("pos_register_count", state.cart.len());
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("pos_register_title"),
        &subtitle,
    );
    ui.add_space(6.0);
    pos_tabs(ui, theme, texts, focus, state);
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let wide = ui.available_width() >= 760.0;

    let mut selected: Option<Uuid> = None;
    let mut scanned = false;
    card(ui, theme, |ui| {
        ui.set_min_width(ui.available_width());
        ui.label(RichText::new(texts.get("pos_scan_title")).strong());
        ui.add_space(4.0);
        ui.horizontal_wrapped(|ui| {
            let field = text_field(
                ui,
                theme,
                focus,
                &mut state.barcode,
                texts.get("pos_scan_label"),
                texts.get("pos_scan_hint"),
                None,
            );
            let enter = field.response.lost_focus()
                && ui.input(|input| input.key_pressed(egui::Key::Enter));
            if button(
                ui,
                theme,
                focus,
                texts.get("pos_scan_button"),
                ButtonVariant::Secondary,
            )
            .activated
                || enter
            {
                scanned = true;
            }
        });
    });

    ui.add_space(10.0);
    // The catalogue and the cart sit side by side on a desktop panel and stack on the phone, so
    // neither the tiles nor the payment controls ever run off the edge.
    if wide {
        let catalog_width = (ui.available_width() * 0.56).max(320.0);
        ui.horizontal_top(|ui| {
            ui.allocate_ui_with_layout(
                Vec2::new(catalog_width, 0.0),
                Layout::top_down(Align::Min),
                |ui| {
                    ui.set_min_width(catalog_width);
                    register_catalog(ui, theme, texts, focus, state, &mut selected);
                },
            );
            ui.add_space(12.0);
            ui.vertical(|ui| {
                ui.set_min_width(ui.available_width());
                register_cart(ui, theme, texts, focus, state, store, now);
            });
        });
    } else {
        register_catalog(ui, theme, texts, focus, state, &mut selected);
        ui.add_space(10.0);
        register_cart(ui, theme, texts, focus, state, store, now);
    }

    if let Some(id) = selected {
        state.add_product(id);
    }
    if scanned {
        state.scan_barcode();
    }
}

/// Search, category chips and the product tiles of the catalogue.
fn register_catalog(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    selected: &mut Option<Uuid>,
) {
    card(ui, theme, |ui| {
        ui.set_min_width(ui.available_width());
        ui.label(RichText::new(texts.get("pos_catalog_title")).strong());
        ui.add_space(4.0);
        search_field_reserved(
            ui,
            theme,
            focus,
            &mut state.catalog_query,
            texts.get("pos_catalog_search"),
            0.0,
        );
        ui.add_space(4.0);
        let categories = state.categories();
        let mut labels: Vec<String> = vec![texts.get("pos_catalog_all").to_string()];
        labels.extend(categories.iter().cloned());
        let labels: Vec<&str> = labels.iter().map(String::as_str).collect();
        ui.horizontal_wrapped(|ui| {
            for (index, label) in labels.iter().enumerate() {
                let variant = if state.category_choice == index {
                    ButtonVariant::Secondary
                } else {
                    ButtonVariant::Ghost
                };
                if button(ui, theme, focus, label, variant).activated {
                    state.category_choice = index;
                }
            }
        });
        ui.add_space(6.0);

        let products = state.catalog();
        if products.is_empty() {
            empty_state(ui, theme, texts.get("pos_catalog_empty"), "");
            return;
        }
        let columns = ((ui.available_width() / 150.0).floor() as usize).clamp(2, 4);
        let spacing = 8.0;
        let tile_width =
            ((ui.available_width() - spacing * (columns - 1) as f32) / columns as f32).max(96.0);
        egui::Grid::new("pos-catalog-grid")
            .num_columns(columns)
            .spacing([spacing, spacing])
            .show(ui, |ui| {
                for (index, product) in products.iter().enumerate() {
                    if index > 0 && index % columns == 0 {
                        ui.end_row();
                    }
                    let emoji = product
                        .image_emoji
                        .clone()
                        .unwrap_or_else(|| "•".to_string());
                    let label = format!(
                        "{emoji}  {}\n{}",
                        truncate(&product.name, 16),
                        money("€", product.price)
                    );
                    let text = RichText::new(label)
                        .size(FONT_SMALL)
                        .color(theme.palette.text);
                    let response = ui.add_sized(
                        [tile_width, 74.0],
                        egui::Button::new(text)
                            .fill(theme.palette.surface_muted)
                            .stroke(egui::Stroke::new(1.0_f32, theme.palette.border)),
                    );
                    focus.register(response.id);
                    if response.clicked() && product.stock > 0 {
                        *selected = Some(product.id);
                    }
                    response.on_hover_text(format!(
                        "{} · {} {}",
                        product.name,
                        product.stock,
                        texts.get("pos_stock_unit")
                    ));
                }
            });
    });
}

/// Cart lines, discount, payment and checkout.
fn register_cart(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    store: &Store,
    now: i64,
) {
    let mut step: Option<(usize, i64)> = None;
    let mut remove: Option<usize> = None;
    let mut checkout = false;
    let mut clear = false;
    card(ui, theme, |ui| {
        ui.set_min_width(ui.available_width());
        ui.horizontal_wrapped(|ui| {
            ui.label(RichText::new(texts.get("pos_cart_title")).strong());
            ui.label(
                RichText::new(texts.count("pos_cart_count", state.cart.len()))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            if !state.cart.is_empty()
                && button(
                    ui,
                    theme,
                    focus,
                    texts.get("pos_cart_clear"),
                    ButtonVariant::Ghost,
                )
                .activated
            {
                clear = true;
            }
        });
        ui.add_space(4.0);
        if state.cart.is_empty() {
            empty_state(ui, theme, texts.get("pos_cart_empty"), "");
        }
        for (index, line) in state.cart.iter().enumerate() {
            let mut minus = false;
            let mut plus = false;
            let mut drop = false;
            ui.add_space(4.0);
            ui.horizontal_wrapped(|ui| {
                minus = button(ui, theme, focus, "−", ButtonVariant::Ghost).activated;
                ui.label(format!("{}×", milli_text(line.quantity_milli)));
                plus = button(ui, theme, focus, "+", ButtonVariant::Ghost).activated;
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(truncate(&line.description, 24))
                            .strong()
                            .size(FONT_SMALL),
                    );
                    ui.label(
                        RichText::new(money("€", line.unit_price))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                });
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    drop = button(ui, theme, focus, "×", ButtonVariant::Ghost).activated;
                    ui.label(RichText::new(money("€", line.gross())).strong());
                });
            });
            if minus {
                step = Some((index, -1));
            }
            if plus {
                step = Some((index, 1));
            }
            if drop {
                remove = Some(index);
            }
            ui.separator();
        }

        let mut names: Vec<String> = vec![texts.get("pos_no_customer").to_string()];
        names.extend(state.contacts.iter().map(|contact| {
            contact
                .name
                .clone()
                .filter(|name| !name.trim().is_empty())
                .unwrap_or_else(|| contact.id.to_string())
        }));
        let labels: Vec<&str> = names.iter().map(String::as_str).collect();
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(texts.get("pos_customer"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            select(
                ui,
                theme,
                focus,
                &mut state.payment_popup,
                "pos-register-customer",
                &mut state.customer,
                &labels,
            );
        });
        ui.add_space(4.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.discount,
            texts.get("pos_discount"),
            texts.get("pos_discount_hint"),
            None,
        );

        let names: Vec<String> = PAYMENTS
            .iter()
            .map(|method| texts.get(payment_key(*method)).to_string())
            .collect();
        let labels: Vec<&str> = names.iter().map(String::as_str).collect();
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(texts.get("pos_payment"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            select(
                ui,
                theme,
                focus,
                &mut state.filter_popup,
                "pos-register-payment",
                &mut state.payment,
                &labels,
            );
        });

        let (net, tax, gross) = state.cart_totals();
        if PAYMENTS
            .get(state.payment)
            .copied()
            .unwrap_or(PaymentMethod::Cash)
            == PaymentMethod::Cash
        {
            ui.add_space(4.0);
            text_field(
                ui,
                theme,
                focus,
                &mut state.tender,
                texts.get("pos_cash_given"),
                texts.get("pos_cash_given_hint"),
                None,
            );
            ui.horizontal_wrapped(|ui| {
                for amount in ["10", "20", "50", "100"] {
                    if button(
                        ui,
                        theme,
                        focus,
                        &format!("{amount} €"),
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        state.tender = amount.to_string();
                    }
                }
            });
            if let Some(change) = Money::parse(&state.tender)
                .filter(|given| given.cents() >= gross.cents())
                .map(|given| given - gross)
            {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(texts.get("pos_change"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.label(
                        RichText::new(money("€", change))
                            .strong()
                            .color(theme.palette.success),
                    );
                });
            }
        }

        ui.add_space(6.0);
        for (key, amount) in [
            ("pos_total_net", net),
            ("pos_total_tax", tax),
            ("pos_total_gross", gross),
        ] {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(key))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                    ui.label(RichText::new(money("€", amount)).strong());
                });
            });
        }
        ui.add_space(8.0);
        let response = ui.add_sized(
            [ui.available_width(), 36.0],
            egui::Button::new(
                RichText::new(texts.get("pos_checkout"))
                    .strong()
                    .color(theme.palette.accent_on),
            )
            .fill(theme.accent.base)
            .rounding(egui::Rounding::same(8.0)),
        );
        focus.register(response.id);
        if response.clicked() {
            checkout = true;
        }
    });

    if clear {
        state.clear_cart();
        state.status = None;
    }
    if let Some((index, delta)) = step {
        state.step_cart(index, delta);
    }
    if let Some(index) = remove {
        state.remove_cart(index);
    }

    if let Some(order) = state.last_receipt().cloned() {
        ui.add_space(10.0);
        card(ui, theme, |ui| {
            ui.set_min_width(ui.available_width());
            ui.label(
                RichText::new(texts.get("pos_last_receipt"))
                    .strong()
                    .color(theme.palette.success),
            );
            ui.label(RichText::new(&order.receipt_number).strong());
            ui.horizontal_wrapped(|ui| {
                ui.label(money(&order.currency_symbol, order.total_gross()));
                if let Some(change) = order.change() {
                    ui.label(format!(
                        "{} {}",
                        texts.get("pos_change"),
                        money(&order.currency_symbol, change)
                    ));
                }
            });
            ui.add_space(4.0);
            ui.horizontal_wrapped(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("pos_open_receipt"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    state.select(order.id);
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("pos_new_sale"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    state.last_receipt = None;
                }
            });
        });
    }

    if checkout && state.checkout(store, now).is_err() {
        state.error = Some("pos_error_save");
    }
}

/// Daily close of the newest business day with the text export.
fn z_report_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    now: i64,
) {
    let report = state.z_report();
    let day_label = state
        .day
        .first()
        .map(|order| format_date(order.paid_at))
        .unwrap_or_else(|| format_date(now));
    let subtitle = format!(
        "{} · {}",
        day_label,
        texts.count("count_receipts", report.receipts)
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("pos_z_title"),
        &subtitle,
    );
    ui.add_space(6.0);
    pos_tabs(ui, theme, texts, focus, state);
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    if report.receipts == 0 {
        card(ui, theme, |ui| {
            ui.set_min_width(ui.available_width());
            empty_state(ui, theme, texts.get("pos_z_empty"), "");
        });
    } else {
        card(ui, theme, |ui| {
            ui.set_min_width(ui.available_width());
            ui.horizontal_wrapped(|ui| {
                ui.label(RichText::new(texts.get("pos_summary_title")).strong());
                ui.label(
                    RichText::new(format!(
                        "{} {}   {} {}",
                        texts.get("pos_z_first"),
                        report
                            .first_at
                            .map(format_time)
                            .unwrap_or_else(|| "—".to_string()),
                        texts.get("pos_z_last"),
                        report
                            .last_at
                            .map(format_time)
                            .unwrap_or_else(|| "—".to_string())
                    ))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
            });
            ui.add_space(6.0);
            let entries: [(&str, String); 7] = [
                ("pos_summary_receipts", report.receipts.to_string()),
                ("pos_summary_net", money("€", report.summary.net)),
                ("pos_summary_tax", money("€", report.summary.tax)),
                ("pos_summary_gross", money("€", report.summary.gross)),
                ("pos_summary_cash", money("€", report.summary.cash)),
                ("pos_summary_card", money("€", report.summary.card)),
                ("pos_summary_nfc", money("€", report.summary.nfc)),
            ];
            day_summary(ui, theme, texts, &entries);
        });

        ui.add_space(10.0);
        card(ui, theme, |ui| {
            ui.set_min_width(ui.available_width());
            ui.label(RichText::new(texts.get("pos_z_payments")).strong());
            ui.add_space(4.0);
            for method in PAYMENTS {
                let amount = match method {
                    PaymentMethod::Cash => report.summary.cash,
                    PaymentMethod::Card => report.summary.card,
                    PaymentMethod::Nfc => report.summary.nfc,
                    PaymentMethod::BankTransfer => report.summary.bank_transfer,
                    PaymentMethod::Invoice => report.summary.invoice,
                    PaymentMethod::Other => report.summary.other,
                };
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(texts.get(payment_key(method)))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        ui.label(money("€", amount));
                    });
                });
            }
            ui.add_space(4.0);
            ui.horizontal_wrapped(|ui| {
                ui.label(
                    RichText::new(texts.get("pos_cash_given"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(money("€", report.summary.cash_given));
                ui.label(
                    RichText::new(texts.get("pos_change"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(money("€", report.summary.change));
            });
        });

        ui.add_space(10.0);
        card(ui, theme, |ui| {
            ui.set_min_width(ui.available_width());
            ui.label(RichText::new(texts.get("pos_z_tax_groups")).strong());
            ui.add_space(4.0);
            for group in &report.tax_groups {
                ui.horizontal(|ui| {
                    ui.label(format!("{:.1} %", group.rate_bp as f64 / 100.0));
                    ui.with_layout(Layout::right_to_left(Align::Center), |ui| {
                        ui.label(
                            RichText::new(format!(
                                "{} / {}",
                                money("€", group.net),
                                money("€", group.tax)
                            ))
                            .size(FONT_SMALL),
                        );
                    });
                });
            }
            ui.add_space(4.0);
            ui.label(
                RichText::new(texts.get("pos_z_tax_hint"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        });

        ui.add_space(10.0);
        card(ui, theme, |ui| {
            ui.set_min_width(ui.available_width());
            ui.label(RichText::new(texts.get("pos_z_receipt_list")).strong());
            for number in &report.numbers {
                ui.label(RichText::new(number).size(FONT_SMALL));
            }
        });
    }

    ui.add_space(10.0);
    #[cfg(feature = "dialogs")]
    {
        let mut export = false;
        ui.horizontal_wrapped(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("pos_z_export"),
                ButtonVariant::Primary,
            )
            .activated
            {
                export = true;
            }
            ui.label(
                RichText::new(texts.get("pos_z_export_hint"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        });
        if export {
            let (year, month, day) = socdof_core::date::civil_from_millis(now);
            let filename = format!("z-bericht-{year:04}-{month:02}-{day:02}.txt");
            if let Some(path) = rfd::FileDialog::new()
                .set_file_name(&filename)
                .add_filter("Text", &["txt"])
                .save_file()
            {
                match state.export_z_report(&path, texts, now) {
                    Ok(_) => state.status = Some("pos_z_exported"),
                    Err(_) => state.error = Some("pos_z_error_export"),
                }
            }
        }
    }
}

fn list_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    now: i64,
) {
    let subtitle = format!(
        "{} · {}",
        texts.count("count_receipts", state.orders.len()),
        texts.get("pos_subtitle"),
    );
    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("pos_title"),
        &subtitle,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    let day = summarize(&state.day);
    let day_label = state
        .day
        .first()
        .map(|order| format_date(order.paid_at))
        .unwrap_or_else(|| format_date(now));
    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(RichText::new(texts.get("pos_summary_title")).strong());
            ui.label(
                RichText::new(day_label)
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        });
        ui.add_space(6.0);
        let day_entries: [(&str, String); 7] = [
            ("pos_summary_receipts", day.receipts.to_string()),
            ("pos_summary_net", money("€", day.net)),
            ("pos_summary_tax", money("€", day.tax)),
            ("pos_summary_gross", money("€", day.gross)),
            ("pos_summary_cash", money("€", day.cash)),
            ("pos_summary_card", money("€", day.card)),
            ("pos_summary_nfc", money("€", day.nfc)),
        ];
        day_summary(ui, theme, texts, &day_entries);
    });

    ui.add_space(12.0);
    let mut create = false;
    let payment_filter = &mut state.payment_filter;
    let reload = &mut state.reload;
    toolbar(
        ui,
        focus,
        370.0,
        |ui, focus, reserve| {
            search_field_reserved(
                ui,
                theme,
                focus,
                &mut state.query,
                texts.get("pos_search"),
                reserve,
            );
        },
        |ui, focus| {
            let mut names: Vec<String> = vec![texts.get("pos_all_payments").to_string()];
            names.extend(
                PAYMENTS
                    .iter()
                    .map(|method| texts.get(payment_key(*method)).to_string()),
            );
            let labels: Vec<&str> = names.iter().map(String::as_str).collect();
            let previous = state.payment_choice;
            select(
                ui,
                theme,
                focus,
                &mut state.filter_popup,
                "pos-payment-filter",
                &mut state.payment_choice,
                &labels,
            );
            if state.payment_choice != previous {
                let method = state
                    .payment_choice
                    .checked_sub(1)
                    .and_then(|index| PAYMENTS.get(index))
                    .copied();
                *payment_filter = method;
                *reload = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("pos_new"),
                ButtonVariant::Primary,
            )
            .activated
            {
                create = true;
            }
        },
    );
    if create {
        state.start_new(now);
        return;
    }

    ui.add_space(12.0);
    if state.orders.is_empty() {
        let searching = !state.query.trim().is_empty() || state.payment_filter.is_some();
        card(ui, theme, |ui| {
            if searching {
                empty_state(
                    ui,
                    theme,
                    texts.get("pos_no_results"),
                    texts.get("pos_no_results_hint"),
                );
            } else {
                empty_state(
                    ui,
                    theme,
                    texts.get("pos_empty_title"),
                    texts.get("pos_empty_hint"),
                );
            }
        });
        return;
    }

    let mut chosen = None;
    let narrow = ui.available_width() < TOOLBAR_STACK_WIDTH;
    card(ui, theme, |ui| {
        if narrow {
            // Six columns never fit a 432 point panel. The narrow layout keeps every value and
            // wraps instead of scrolling sideways: identity on the first line, figures below it.
            for order in &state.orders {
                ui.horizontal_wrapped(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        &order.receipt_number,
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        chosen = Some(order.id);
                    }
                    ui.label(format_time(order.paid_at));
                    badge(
                        ui,
                        theme,
                        texts.get(payment_key(order.payment_method)),
                        payment_tone(order.payment_method),
                    );
                });
                ui.horizontal_wrapped(|ui| {
                    for (label, value) in [
                        (texts.get("pos_col_items"), order.lines.len().to_string()),
                        (
                            texts.get("pos_col_total"),
                            money(&order.currency_symbol, order.total_gross()),
                        ),
                        (
                            texts.get("pos_col_change"),
                            order
                                .change()
                                .map(|change| money(&order.currency_symbol, change))
                                .unwrap_or_else(|| "—".to_string()),
                        ),
                    ] {
                        ui.label(
                            RichText::new(format!("{label}: {value}"))
                                .size(FONT_SMALL)
                                .color(theme.palette.text_muted),
                        );
                    }
                });
                ui.add_space(8.0);
            }
            return;
        }
        egui::Grid::new("socdof-pos-table")
            .num_columns(6)
            .spacing(egui::vec2(16.0, 8.0))
            .show(ui, |ui| {
                for key in [
                    "pos_col_number",
                    "pos_col_time",
                    "pos_col_payment",
                    "pos_col_items",
                    "pos_col_total",
                    "pos_col_change",
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
                    if button(
                        ui,
                        theme,
                        focus,
                        &order.receipt_number,
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        chosen = Some(order.id);
                    }
                    ui.label(format_time(order.paid_at));
                    badge(
                        ui,
                        theme,
                        texts.get(payment_key(order.payment_method)),
                        payment_tone(order.payment_method),
                    );
                    ui.label(order.lines.len().to_string());
                    ui.label(money(&order.currency_symbol, order.total_gross()));
                    ui.label(
                        order
                            .change()
                            .map(|change| money(&order.currency_symbol, change))
                            .unwrap_or_else(|| "—".to_string()),
                    );
                    ui.end_row();
                }
            });
    });
    if let Some(id) = chosen {
        state.select(id);
    }
}

/// Lays the daily close figures in two to five columns so the card never runs off the panel.
fn day_summary(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, entries: &[(&str, String)]) {
    let columns = ((ui.available_width() / 150.0).floor() as usize).clamp(2, 5);
    for row in entries.chunks(columns) {
        ui.horizontal_wrapped(|ui| {
            for (label, value) in row {
                ui.vertical(|ui| {
                    ui.label(
                        RichText::new(texts.get(label))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.label(RichText::new(value).strong());
                });
                ui.add_space(18.0);
            }
        });
    }
}

fn detail_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    _store: &Store,
) {
    let Some(order) = state.current().cloned() else {
        state.view = PosView::List;
        return;
    };

    screen_header(
        ui,
        theme,
        texts,
        focus,
        state,
        texts.get("pos_detail_title"),
        &order.receipt_number,
    );
    ui.add_space(8.0);
    messages(ui, theme, texts, state);
    ui.add_space(6.0);

    card(ui, theme, |ui| {
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(&order.receipt_number)
                    .size(FONT_TITLE)
                    .strong(),
            );
            badge(
                ui,
                theme,
                texts.get(payment_key(order.payment_method)),
                payment_tone(order.payment_method),
            );
        });
        ui.add_space(8.0);
        for (label, value) in [
            (
                "pos_col_time",
                format!(
                    "{} {}",
                    format_date(order.paid_at),
                    format_time(order.paid_at)
                ),
            ),
            (
                "pos_col_payment",
                texts.get(payment_key(order.payment_method)).to_string(),
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
        if let Some(given) = order.cash_given {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get("pos_cash_given"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(money(&order.currency_symbol, given));
            });
            if let Some(change) = order.change() {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(texts.get("pos_change"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.label(RichText::new(money(&order.currency_symbol, change)).strong());
                });
            }
        }
        if let Some(note) = &order.note {
            ui.add_space(6.0);
            ui.label(RichText::new(note).size(FONT_SMALL));
        }
    });

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("pos_lines_title")).strong());
        ui.add_space(6.0);
        // Six columns need room for two amounts side by side; on a phone the same figures are
        // stacked per position instead of being clipped at the panel edge.
        if ui.available_width() < FORM_STACK_WIDTH {
            for line in &order.lines {
                ui.label(RichText::new(&line.description).strong());
                ui.label(
                    RichText::new(format!(
                        "{} × {} = {}  ·  {} {}",
                        milli_text(line.quantity_milli),
                        money(&order.currency_symbol, line.unit_price),
                        money(&order.currency_symbol, line.gross()),
                        texts.get("pos_total_tax"),
                        money(&order.currency_symbol, line.tax()),
                    ))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
                ui.add_space(6.0);
            }
        } else {
            egui::Grid::new("socdof-pos-lines")
                .num_columns(6)
                .spacing(egui::vec2(14.0, 6.0))
                .show(ui, |ui| {
                    for key in [
                        "pos_line_description",
                        "pos_line_quantity",
                        "pos_line_price",
                        "pos_total_net",
                        "pos_total_tax",
                        "pos_total_gross",
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
                        ui.label(money(&order.currency_symbol, line.unit_price));
                        ui.label(money(&order.currency_symbol, line.net()));
                        ui.label(money(&order.currency_symbol, line.tax()));
                        ui.label(money(&order.currency_symbol, line.gross()));
                        ui.end_row();
                    }
                });
        }
        ui.add_space(8.0);
        for (label, amount) in [
            ("pos_total_net", order.total_net()),
            ("pos_total_tax", order.total_tax()),
            ("pos_total_gross", order.total_gross()),
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
    let mut cancel = false;
    #[cfg(feature = "dialogs")]
    let mut print_receipt = false;
    ui.horizontal(|ui| {
        #[cfg(feature = "dialogs")]
        if button(
            ui,
            theme,
            focus,
            texts.get("pos_print_receipt"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            print_receipt = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("pos_cancel_sale"),
            ButtonVariant::Danger,
        )
        .activated
        {
            cancel = true;
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("pos_back"),
            ButtonVariant::Ghost,
        )
        .activated
        {
            state.view = PosView::List;
        }
    });
    if cancel {
        state.confirm_cancel = true;
    }
    #[cfg(feature = "dialogs")]
    if print_receipt {
        let contact = match order.contact_id {
            Some(id) => match _store.find_contact(id) {
                Ok(contact) => contact,
                Err(_) => {
                    state.error = Some("pos_error_load");
                    return;
                }
            },
            None => None,
        };
        let customer = contact.as_ref().map(|contact| contact.display_name());
        let suggested_name = format!(
            "{}.pdf",
            order
                .receipt_number
                .chars()
                .map(|ch| {
                    if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                        ch
                    } else {
                        '_'
                    }
                })
                .collect::<String>()
        );
        if let Some(path) = rfd::FileDialog::new()
            .set_file_name(&suggested_name)
            .add_filter("PDF", &["pdf"])
            .save_file()
        {
            match std::fs::write(path, receipt_pdf(&order, customer.as_deref(), texts)) {
                Ok(()) => {
                    state.status = Some("pos_saved");
                    state.error = None;
                }
                Err(_) => state.error = Some("pos_error_save"),
            }
        }
    }
}

fn form_view(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut PosState,
    store: &Store,
    now: i64,
) {
    let title = texts.get("pos_new_title");
    let subtitle = texts.get("pos_subtitle").to_string();
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
            texts.get("pos_number"),
            texts.get("pos_number_hint"),
            None,
        );
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            ui.label(
                RichText::new(texts.get("pos_payment"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            let names: Vec<String> = PAYMENTS
                .iter()
                .map(|method| texts.get(payment_key(*method)).to_string())
                .collect();
            let labels: Vec<&str> = names.iter().map(String::as_str).collect();
            select(
                ui,
                theme,
                focus,
                &mut state.payment_popup,
                "pos-payment",
                &mut state.draft.payment,
                &labels,
            );
        });
        ui.add_space(6.0);
        if PAYMENTS
            .get(state.draft.payment)
            .copied()
            .unwrap_or(PaymentMethod::Cash)
            == PaymentMethod::Cash
        {
            text_field(
                ui,
                theme,
                focus,
                &mut state.draft.cash_given,
                texts.get("pos_cash_given"),
                texts.get("pos_cash_given_hint"),
                None,
            );
            ui.add_space(6.0);
        }
        text_field(
            ui,
            theme,
            focus,
            &mut state.draft.note,
            texts.get("pos_note"),
            texts.get("pos_note_hint"),
            None,
        );
    });

    ui.add_space(12.0);
    let mut add_line = false;
    let mut remove_line = None;
    card(ui, theme, |ui| {
        ui.label(RichText::new(texts.get("pos_lines_title")).strong());
        ui.add_space(6.0);
        if state.draft.lines.is_empty() {
            ui.label(
                RichText::new(texts.get("pos_lines_empty"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
        }
        for index in 0..state.draft.lines.len() {
            ui.add_space(6.0);
            ui.label(
                RichText::new(format!(
                    "{} {}",
                    index + 1,
                    texts.get("pos_line_description")
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get("pos_line_product"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                let mut names: Vec<String> = vec![texts.get("pos_line_free").to_string()];
                names.extend(state.products.iter().map(|product| product.name.clone()));
                let labels: Vec<&str> = names.iter().map(String::as_str).collect();
                let previous = state.draft.lines[index].product;
                select(
                    ui,
                    theme,
                    focus,
                    &mut state.line_popups[index],
                    &format!("pos-line-product-{index}"),
                    &mut state.draft.lines[index].product,
                    &labels,
                );
                if state.draft.lines[index].product != previous {
                    if let Some(product) = state.draft.lines[index]
                        .product
                        .checked_sub(1)
                        .and_then(|product_index| state.products.get(product_index))
                    {
                        state.draft.lines[index].description = product.name.clone();
                        state.draft.lines[index].unit_price = product.price.to_decimal_string();
                        state.draft.lines[index].tax_rate = percent_text(product.tax_rate_bp);
                    }
                }
            });
            text_field(
                ui,
                theme,
                focus,
                &mut state.draft.lines[index].description,
                texts.get("pos_line_description"),
                texts.get("pos_line_description_hint"),
                None,
            );
            ui.add_space(4.0);
            // Quantity, price, tax and the remove button only share one row while all four have room;
            // on the phone each field takes its own row so the price keeps a usable width.
            if ui.available_width() < FORM_STACK_WIDTH {
                let line = &mut state.draft.lines[index];
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut line.quantity,
                    texts.get("pos_line_quantity"),
                    texts.get("pos_line_quantity_hint"),
                    None,
                );
                ui.add_space(4.0);
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut line.unit_price,
                    texts.get("pos_line_price"),
                    texts.get("pos_line_price_hint"),
                    None,
                );
                ui.add_space(4.0);
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut line.tax_rate,
                    texts.get("pos_line_tax"),
                    texts.get("pos_line_tax_hint"),
                    None,
                );
                ui.add_space(6.0);
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("pos_line_remove"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    remove_line = Some(index);
                }
            } else {
                // A labelled text field fills the width it is given, so the four cells of this row
                // need explicit widths; otherwise the first field takes the whole row and the price
                // and tax columns collapse into a letter-per-line sliver.
                let widths = form_columns(ui, 3, 110.0);
                ui.horizontal(|ui| {
                    for (slot, width) in widths.iter().enumerate() {
                        let line = &mut state.draft.lines[index];
                        let (value, label, hint) = match slot {
                            0 => (
                                &mut line.quantity,
                                texts.get("pos_line_quantity"),
                                texts.get("pos_line_quantity_hint"),
                            ),
                            1 => (
                                &mut line.unit_price,
                                texts.get("pos_line_price"),
                                texts.get("pos_line_price_hint"),
                            ),
                            _ => (
                                &mut line.tax_rate,
                                texts.get("pos_line_tax"),
                                texts.get("pos_line_tax_hint"),
                            ),
                        };
                        ui.allocate_ui_with_layout(
                            Vec2::new(*width, 0.0),
                            Layout::top_down(Align::Min),
                            |ui| text_field(ui, theme, focus, value, label, hint, None),
                        );
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("pos_line_remove"),
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        remove_line = Some(index);
                    }
                });
            }
        }
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("pos_line_add"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            add_line = true;
        }
    });

    let (net, tax, gross) = draft_totals(&state.draft, &state.products);
    ui.add_space(12.0);
    card(ui, theme, |ui| {
        for (label, amount) in [
            ("pos_total_net", net),
            ("pos_total_tax", tax),
            ("pos_total_gross", gross),
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
        if let Some(change) =
            Money::parse(&state.draft.cash_given).filter(|given| given.cents() >= gross.cents())
        {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get("pos_change"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(
                    RichText::new(money("€", change - gross))
                        .strong()
                        .color(theme.palette.success),
                );
            });
        }
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("pos_save"),
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
                texts.get("pos_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
        });
    });

    if add_line {
        state.draft.lines.push(PosLineDraft::default());
        state.line_popups.push(PopupState::default());
    }
    if let Some(index) = remove_line {
        state.draft.lines.remove(index);
        state.line_popups.remove(index);
    }
    if save && state.save(store, now).is_err() {
        state.error = Some("pos_error_save");
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

    fn seeded() -> (Store, PosState, UiTexts) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        seed_pos(&store, &texts).expect("seed");
        let mut state = PosState::new();
        state.refresh(&store).expect("refresh");
        (store, state, texts)
    }

    fn render_at(state: &mut PosState, store: &Store, width: f32) -> String {
        let ctx = crate::theme::headless_context();
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let theme = Theme::new(Appearance::Light, "indigo");
        let mut focus = FocusState::default();
        let mut output = None;
        for _ in 0..2 {
            let input = egui::RawInput {
                screen_rect: Some(egui::Rect::from_min_size(
                    egui::Pos2::ZERO,
                    egui::Vec2::new(width, 2400.0),
                )),
                ..Default::default()
            };
            output = Some(ctx.run(input, |ctx| {
                pos(ctx, &theme, &texts, &mut focus, state, store, SAMPLE_NOW_MS);
            }));
        }
        crate::snapshot::signature(&output.expect("pos frame")).join("\n")
    }

    fn render(state: &mut PosState, store: &Store) -> String {
        render_at(state, store, 1000.0)
    }

    /// Widest right edge of a painted primitive, ignoring the clip rectangles.
    fn painted_right_edge(signature: &str) -> f32 {
        let mut widest: f32 = 0.0;
        for line in signature.lines() {
            let Some(rest) = line.split("rect(").nth(1) else {
                continue;
            };
            let values: Vec<f32> = rest
                .split(',')
                .take(4)
                .filter_map(|value| value.trim().parse().ok())
                .collect();
            if values.len() == 4 {
                widest = widest.max(values[2]);
            }
        }
        widest
    }

    #[test]
    fn the_narrow_panel_keeps_the_whole_receipt_list_inside() {
        let (store, mut state, texts) = seeded();
        assert!(!state.orders.is_empty(), "the seed creates receipts");
        state.open_list();
        let signature = render_at(&mut state, &store, 432.0);
        let order = &state.orders[0];
        assert!(
            signature.contains(&order.receipt_number),
            "receipt number missing on a narrow panel"
        );
        assert!(
            signature.contains(texts.get(payment_key(order.payment_method))),
            "payment method missing on a narrow panel"
        );
        assert!(
            painted_right_edge(&signature) <= 432.5,
            "a primitive is painted outside the 432 point panel ({})",
            painted_right_edge(&signature)
        );
    }

    #[test]
    fn creates_a_receipt_and_books_stock() {
        let mut state = PosState::new();
        let store = Store::open_in_memory().expect("store");
        let mut product = Product::new("Espresso", SAMPLE_NOW_MS);
        product.price = Money::from_cents(250);
        product.tax_rate_bp = 700;
        store.insert_product(&product).expect("product");
        store
            .adjust_stock(&socdof_core::domain::stock::StockMove {
                id: Uuid::new_v4(),
                product_id: product.id,
                kind: StockMoveKind::In,
                quantity: 5,
                reason: None,
                created_at: SAMPLE_NOW_MS,
            })
            .expect("stock");
        state.refresh(&store).expect("refresh");
        state.start_new(SAMPLE_NOW_MS);
        assert_eq!(state.draft.number, "BON-2026-0001");

        state.draft.lines[0].product = 1;
        state.draft.lines[0].description = "Espresso".to_string();
        state.draft.lines[0].quantity = "2".to_string();
        state.draft.lines[0].unit_price = "2,50".to_string();
        state.draft.lines[0].tax_rate = "7".to_string();
        state.draft.cash_given = "10".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("insert");

        assert!(state.error.is_none());
        assert_eq!(state.view, PosView::Detail);
        assert_eq!(
            store.list_pos_orders().expect("list")[0].total_gross(),
            Money::from_cents(535)
        );
        assert_eq!(store.find_product(product.id).unwrap().unwrap().stock, 3);
        assert_eq!(
            store.list_pos_orders().expect("list")[0].change(),
            Some(Money::from_cents(465))
        );
    }

    #[test]
    fn rejects_invalid_receipts_and_missing_stock() {
        let (store, mut state, _texts) = seeded();
        state.start_new(SAMPLE_NOW_MS);
        state.draft.lines[0].unit_price = "2".to_string();
        state.draft.lines[0].description.clear();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("pos_error_line_description"));

        state.draft.lines[0].description = "Espresso".to_string();
        state.draft.lines[0].quantity = "0".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("pos_error_quantity"));

        state.draft.lines[0].quantity = "1".to_string();
        state.draft.lines[0].product = 1;
        state.draft.cash_given = "1".to_string();
        state.draft.lines[0].unit_price = "10".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("validation ok");
        assert_eq!(state.error, Some("pos_error_cash"));

        state.draft.cash_given.clear();
        state.draft.lines[0].quantity = "99".to_string();
        state.save(&store, SAMPLE_NOW_MS).expect("stock ok");
        assert_eq!(state.error, Some("pos_error_stock"));
    }

    #[test]
    fn searches_and_filters_receipts() {
        let (store, mut state, _texts) = seeded();
        assert_eq!(state.orders.len(), 3);

        state.query = "0002".to_string();
        state.refresh(&store).expect("search");
        assert_eq!(state.orders.len(), 1);
        assert_eq!(state.orders[0].receipt_number, "BON-2026-0002");

        state.query.clear();
        state.reload = true;
        state.refresh(&store).expect("reload");
        state.filter_payment(Some(PaymentMethod::Cash));
        state.refresh(&store).expect("filter");
        assert_eq!(state.orders.len(), 1);
        assert_eq!(state.orders[0].payment_method, PaymentMethod::Cash);
    }

    #[test]
    fn summarises_the_daily_close() {
        let (_store, state, _texts) = seeded();
        let summary = summarize(&state.day);
        assert_eq!(summary.receipts, 3);
        assert_eq!(summary.net, Money::from_cents(3_450));
        assert_eq!(summary.tax, Money::from_cents(566));
        assert_eq!(summary.gross, Money::from_cents(4_016));
        assert_eq!(summary.cash, Money::from_cents(1_606));
        assert_eq!(summary.card, Money::from_cents(268));
        assert_eq!(summary.invoice, Money::from_cents(2_142));
        assert_eq!(summary.change, Money::from_cents(394));
    }

    #[test]
    fn cancelling_returns_goods_to_stock() {
        let (store, mut state, _texts) = seeded();
        let espresso = store
            .list_products()
            .expect("products")
            .into_iter()
            .find(|product| product.sku == "POS-A")
            .expect("sample product");
        let before = espresso.stock;
        let order = state
            .orders
            .iter()
            .find(|order| order.receipt_number == "BON-2026-0001")
            .expect("cash receipt")
            .clone();
        state.select(order.id);
        state
            .cancel_selected(&store, SAMPLE_NOW_MS)
            .expect("cancel");
        assert_eq!(
            store.find_product(espresso.id).unwrap().unwrap().stock,
            before + 2
        );
        assert_eq!(store.pos_order_count().expect("count"), 2);
        assert_eq!(state.status, Some("pos_cancelled"));
    }

    #[test]
    fn renders_the_list_the_detail_and_the_form() {
        assert_eq!(payment_key(PaymentMethod::Nfc), "pos_payment_nfc");
        let (store, mut state, texts) = seeded();
        state.open_list();

        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("pos_title")));
        assert!(painted.contains("BON-2026-0001"));
        assert!(painted.contains(texts.get("pos_summary_title")));
        assert!(painted.contains(texts.get("pos_summary_nfc")));
        assert!(painted.contains(texts.get("pos_payment_cash")));
        assert!(painted.contains("40,16 €"));

        let id = state.orders[0].id;
        state.select(id);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("pos_lines_title")));
        assert!(painted.contains(texts.get("pos_total_gross")));
        assert!(painted.contains(texts.get("pos_cancel_sale")));

        state.start_new(SAMPLE_NOW_MS);
        let painted = render(&mut state, &store);
        assert!(painted.contains(texts.get("pos_save")));
        assert!(painted.contains(texts.get("pos_line_add")));
        assert!(painted.contains(texts.get("pos_cash_given")));
    }

    #[test]
    fn seeding_is_idempotent_and_uses_the_store() {
        let (store, _state, texts) = seeded();
        seed_pos(&store, &texts).expect("second seed");
        assert_eq!(store.pos_order_count().expect("count"), 3);
        assert_eq!(store.product_count().expect("products"), 2);
        assert_eq!(
            store
                .list_pos_orders()
                .expect("list")
                .iter()
                .map(|order| order.payment_method)
                .collect::<Vec<_>>()
                .len(),
            3
        );
    }

    #[test]
    fn receipt_pdf_contains_order_lines_totals_cash_and_customer() {
        let texts = UiTexts::embedded(Language::De).expect("catalogue");
        let order = sample_order(
            "BON-2026-0099",
            PaymentMethod::Cash,
            SAMPLE_NOW_MS,
            Some(Money::from_cents(500)),
            vec![PosOrderLine {
                product_id: None,
                description: "Espresso".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(300),
                tax_rate_bp: 1_900,
            }],
            Some("Am Tresen".to_string()),
        );

        let pdf = receipt_pdf(&order, Some("Ada Lovelace"), &texts);
        let content = String::from_utf8_lossy(&pdf);
        assert!(content.starts_with("%PDF-1.4"));
        assert!(content.contains("BON-2026-0099"));
        assert!(content.contains("Ada Lovelace"));
        assert!(content.contains("Espresso"));
        assert!(content.contains(texts.get("pos_total_gross")));
        assert!(content.contains("3,57"));
        assert!(content.contains(texts.get("pos_cash_given")));
        assert!(content.contains("5,00"));
        assert!(content.contains("1,43"));
        assert!(content.contains("Am Tresen"));
    }

    #[test]
    fn register_filters_the_catalog_scans_barcodes_and_steps_quantities() {
        let (_store, mut state, texts) = seeded();
        assert_eq!(state.catalog().len(), 2);

        state.catalog_query = "pos-a".to_string();
        assert_eq!(state.catalog().len(), 1);
        state.catalog_query.clear();
        state.category_choice = 1;
        assert!(!state.catalog().is_empty());
        state.category_choice = 0;

        state.barcode = "POS-B".to_string();
        state.scan_barcode();
        assert_eq!(state.cart.len(), 1);
        assert_eq!(state.cart[0].description, texts.get("pos_sample_product_b"));
        assert_eq!(state.status, Some("pos_scan_added"));

        state.barcode = "unbekannt".to_string();
        state.scan_barcode();
        assert_eq!(state.error, Some("pos_scan_not_found"));

        state.step_cart(0, 1);
        assert_eq!(state.cart[0].quantity_milli, 2_000);
        state.step_cart(0, -2);
        assert!(state.cart.is_empty());
    }

    #[test]
    fn checkout_books_receipt_invoice_stock_and_discount() {
        let (store, mut state, _texts) = seeded();
        let mut contact = Contact::new(
            socdof_core::domain::contact::ContactKind::Company,
            SAMPLE_NOW_MS,
        );
        contact.name = Some("Ada Lovelace".to_string());
        store.insert_contact(&contact).expect("contact");
        state.reload = true;
        state.refresh(&store).expect("refresh");
        state.customer = 1;

        let espresso = state
            .products
            .iter()
            .find(|product| product.sku == "POS-A")
            .expect("espresso")
            .id;
        let stock_before = store.find_product(espresso).unwrap().unwrap().stock;
        state.add_product(espresso);
        state.add_product(espresso);
        state.discount = "10".to_string();
        state.tender = "10".to_string();
        let (net, tax, gross) = state.cart_totals();
        assert_eq!(net, Money::from_cents(450));
        assert_eq!(tax, Money::from_cents(32));
        assert_eq!(gross, Money::from_cents(482));
        assert_eq!(state.discount_bp(), 1_000);

        let id = state
            .checkout(&store, SAMPLE_NOW_MS)
            .expect("checkout")
            .expect("stored");
        let order = store.find_pos_order(id).expect("find").unwrap();
        assert_eq!(order.discount_bp, 1_000);
        assert_eq!(order.contact_id, Some(contact.id));
        assert_eq!(order.total_gross(), Money::from_cents(482));
        assert_eq!(order.change(), Some(Money::from_cents(518)));
        assert_eq!(state.last_receipt, Some(id));
        assert!(state.cart.is_empty());
        assert_eq!(
            store.find_product(espresso).unwrap().unwrap().stock,
            stock_before - 2
        );
        let invoices = store.list_invoices().expect("invoices");
        assert_eq!(invoices.len(), 1);
        assert_eq!(invoices[0].contact_id, contact.id);
        assert_eq!(invoices[0].status, InvoiceStatus::Paid);
    }

    #[test]
    fn z_report_lists_groups_and_exports_a_text_file() {
        let (store, mut state, texts) = seeded();
        state.open_z_report();
        let report = state.z_report();
        assert_eq!(report.receipts, 3);
        assert_eq!(report.numbers.len(), 3);
        assert!(!report.tax_groups.is_empty());

        let path = std::env::temp_dir().join(format!("socdof-z-report-{}.txt", Uuid::new_v4()));
        let bytes = state
            .export_z_report(&path, &texts, SAMPLE_NOW_MS)
            .expect("export");
        let content = std::fs::read_to_string(&path).expect("read");
        assert_eq!(usize::try_from(bytes).expect("length"), content.len());
        assert!(content.starts_with(texts.get("pos_z_title")));
        assert!(content.contains("BON-2026-0001"));
        assert!(content.contains(texts.get("pos_z_tax_groups")));
        assert!(content.contains(texts.get("pos_change")));
        std::fs::remove_file(path).expect("cleanup");

        let signature = render(&mut state, &store);
        assert!(signature.contains(texts.get("pos_z_title")));
        assert!(signature.contains(texts.get("pos_z_payments")));
    }

    #[test]
    fn the_register_keeps_tiles_and_cart_inside_a_narrow_panel() {
        let (store, mut state, texts) = seeded();
        let first = state.products[0].id;
        state.add_product(first);
        let signature = render_at(&mut state, &store, 432.0);
        assert!(
            signature.contains(&state.products[0].name),
            "product tile missing on a narrow panel"
        );
        assert!(
            signature.contains(texts.get("pos_checkout")),
            "checkout missing on a narrow panel"
        );
        assert!(
            painted_right_edge(&signature) <= 432.5,
            "a primitive is painted outside the 432 point panel ({})",
            painted_right_edge(&signature)
        );
    }

    #[test]
    fn rejects_values_with_more_precision_than_the_store_can_keep() {
        assert_eq!(parse_quantity("1,125"), Some(1_125));
        assert_eq!(parse_quantity("1.125"), Some(1_125));
        assert_eq!(parse_quantity("1.1259"), None);
        assert_eq!(parse_quantity("0"), None);
        assert_eq!(parse_percent_bp("19,00"), Some(1_900));
        assert_eq!(parse_percent_bp("19.001"), None);
        assert_eq!(parse_percent_bp("101"), None);
    }
}
