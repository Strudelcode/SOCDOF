//! Quick billing screen: dish tiles, cart, payment, receipt journal and daily statistics.
//!
//! Ported from `SOCDOF - TS/src/components/sales/IOSBillingModule.tsx`. Every control works on the
//! core store: dishes through [`Store::insert_quick_dish`] and friends, sales through
//! [`Store::insert_quick_receipt`] (which books the stock in the same transaction) and cancellations
//! through [`Store::cancel_quick_receipt`], which writes a linked storno booking instead of deleting
//! a receipt. The statistics are computed from the stored receipts, never from UI counters.
//!
//! Views are checkout, menu, receipts, statistics and settings; the option sheet, the payment sheet,
//! the dish form, the receipt detail and the storno confirmation are dialogs.

use egui::{Align, Context, Layout, RichText, Vec2};
use socdof_core::domain::quick_billing::{
    self, dish_sales, next_storno_number, option_sales, summarize, DaySummary, DishOption,
    DishSales, PaymentMethod, QuickDish, QuickReceipt, ReceiptLine, ReceiptStatus,
};
use socdof_core::money::Money;
use socdof_core::store::quick_billing::QuickBillingSettings;
use socdof_core::store::Store;
use uuid::Uuid;

use crate::components::{
    badge, button, card, empty_state, kpi_cards, modal, search_field_reserved, ButtonVariant, Tone,
    FORM_STACK_WIDTH,
};
use crate::controls::{select, switch, text_field, PopupState};
use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::theme::Theme;
use crate::tokens::{FONT_SMALL, FONT_TITLE};

/// Fixed timestamp of the sample dishes and receipts, shared with the other fixtures.
pub const SAMPLE_NOW_MS: i64 = crate::dashboard::SAMPLE_NOW_MS;

/// Currency of the register; SOCDOF bills in euro.
pub const CURRENCY: &str = "€";

/// Tax rates offered in the dish form.
const TAX_RATES: [&str; 2] = ["7", "19"];

/// Tabs of the screen.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum QuickBillingView {
    /// Dish tiles with the cart and the payment action.
    #[default]
    Checkout,
    /// Dish management (create, edit, delete, enable).
    Menu,
    /// Stored receipts with detail and cancellation.
    Receipts,
    /// Daily and total figures from the stored receipts.
    Stats,
    /// Register name and receipt footer.
    Settings,
}

impl QuickBillingView {
    /// The five tabs in bar order.
    pub const ALL: [QuickBillingView; 5] = [
        QuickBillingView::Checkout,
        QuickBillingView::Menu,
        QuickBillingView::Receipts,
        QuickBillingView::Stats,
        QuickBillingView::Settings,
    ];

    /// Catalogue key of the tab label.
    pub fn label_key(self) -> &'static str {
        match self {
            QuickBillingView::Checkout => "quick_billing_tab_checkout",
            QuickBillingView::Menu => "quick_billing_tab_menu",
            QuickBillingView::Receipts => "quick_billing_tab_receipts",
            QuickBillingView::Stats => "quick_billing_tab_stats",
            QuickBillingView::Settings => "quick_billing_tab_settings",
        }
    }
}

/// Editable row of the dish form's option list.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DishOptionDraft {
    /// Group, for example `Beilage`.
    pub group: String,
    /// Option name.
    pub name: String,
    /// Surcharge as entered.
    pub extra: String,
    /// Whether the option is preselected.
    pub default: bool,
}

impl DishOptionDraft {
    fn from_option(option: &DishOption) -> Self {
        Self {
            group: option.group.clone(),
            name: option.name.clone(),
            extra: option.extra_price.to_decimal_string(),
            default: option.default,
        }
    }

    fn to_option(&self) -> Option<DishOption> {
        let name = self.name.trim();
        if name.is_empty() {
            return None;
        }
        Some(DishOption {
            group: if self.group.trim().is_empty() {
                "Beilage".to_string()
            } else {
                self.group.trim().to_string()
            },
            name: name.to_string(),
            extra_price: Money::parse(self.extra.trim()).unwrap_or(Money::ZERO),
            default: self.default,
        })
    }
}

/// Editable values of the dish form.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DishDraft {
    /// Dish name.
    pub name: String,
    /// Menu category.
    pub category: String,
    /// Gross price as entered.
    pub price: String,
    /// Tax rate in percent as entered.
    pub tax_rate: String,
    /// Description shown under the tile.
    pub description: String,
    /// Emoji of the tile.
    pub emoji: String,
    /// Article number.
    pub sku: String,
    /// Tracked stock as entered; `0` means untracked.
    pub stock: String,
    /// Whether the dish can be sold.
    pub enabled: bool,
    /// Sides and extras.
    pub options: Vec<DishOptionDraft>,
}

impl Default for DishDraft {
    fn default() -> Self {
        Self {
            name: String::new(),
            category: String::new(),
            price: String::new(),
            tax_rate: "7".to_string(),
            description: String::new(),
            emoji: "🍽️".to_string(),
            sku: String::new(),
            stock: "0".to_string(),
            enabled: true,
            options: Vec::new(),
        }
    }
}

impl DishDraft {
    /// Fills the draft from a stored dish.
    pub fn from_dish(dish: &QuickDish) -> Self {
        Self {
            name: dish.name.clone(),
            category: dish.category.clone(),
            price: dish.price.to_decimal_string(),
            tax_rate: format!("{}", dish.tax_rate_bp as f64 / 100.0),
            description: dish.description.clone(),
            emoji: dish.emoji.clone(),
            sku: dish.sku.clone(),
            stock: dish.stock.to_string(),
            enabled: dish.enabled,
            options: dish
                .options
                .iter()
                .map(DishOptionDraft::from_option)
                .collect(),
        }
    }

    /// Builds the dish to store; `base` keeps id and creation time when editing.
    pub fn to_dish(&self, base: Option<&QuickDish>, now: i64) -> Result<QuickDish, &'static str> {
        if self.name.trim().is_empty() {
            return Err("quick_billing_error_dish_name");
        }
        let price = Money::parse(self.price.trim()).ok_or("quick_billing_error_dish_price")?;
        if price.cents() < 0 {
            return Err("quick_billing_error_dish_price");
        }
        let tax_rate_bp = Money::parse_scaled_decimal(self.tax_rate.trim(), 2)
            .filter(|value| (0..=10_000).contains(value))
            .ok_or("quick_billing_error_dish_tax")?;
        let stock = self
            .stock
            .trim()
            .parse::<i64>()
            .ok()
            .filter(|value| *value >= 0)
            .ok_or("quick_billing_error_dish_stock")?;

        let mut dish = match base {
            Some(dish) => dish.clone(),
            None => QuickDish::new(self.name.trim(), now),
        };
        dish.name = self.name.trim().to_string();
        dish.category = self.category.trim().to_string();
        dish.price = price;
        dish.tax_rate_bp = tax_rate_bp;
        dish.description = self.description.trim().to_string();
        dish.emoji = if self.emoji.trim().is_empty() {
            "🍽️".to_string()
        } else {
            self.emoji.trim().to_string()
        };
        dish.sku = self.sku.trim().to_string();
        dish.stock = stock;
        dish.enabled = self.enabled;
        dish.options = self
            .options
            .iter()
            .filter_map(DishOptionDraft::to_option)
            .collect();
        dish.updated_at = now;
        Ok(dish)
    }
}

/// State of the quick billing screen.
#[derive(Debug, Clone)]
pub struct QuickBillingState {
    /// Active tab.
    pub view: QuickBillingView,
    /// Search text of the checkout tiles.
    pub query: String,
    /// Selected category, `None` shows every category.
    pub category: Option<String>,
    /// All stored dishes.
    pub dishes: Vec<QuickDish>,
    /// All stored receipts, newest first.
    pub receipts: Vec<QuickReceipt>,
    /// Cart positions; a line is a receipt line until the sale is completed.
    pub cart: Vec<ReceiptLine>,
    /// Open option sheet with the dish and the preselected options.
    pub option_dish: Option<Uuid>,
    /// Chosen options of the open sheet.
    pub option_choices: Vec<DishOption>,
    /// Kitchen note of the open sheet.
    pub option_note: String,
    /// Open dish form.
    pub dish_form: Option<DishDraft>,
    /// Dish the form edits, `None` for a new dish.
    pub editing: Option<Uuid>,
    /// Whether the payment sheet is open.
    pub payment_open: bool,
    /// Selected payment method.
    pub payment: PaymentMethod,
    /// Cash tendered as entered.
    pub tendered: String,
    /// Receipt shown by the detail dialog.
    pub receipt_open: Option<Uuid>,
    /// Whether the storno confirmation is open.
    pub confirm_storno: bool,
    /// Whether the dish deletion confirmation is open.
    pub confirm_delete: bool,
    /// Register name and receipt footer.
    pub settings: QuickBillingSettings,
    /// Popup state of the category filter.
    pub category_popup: PopupState,
    /// Catalogue key of the last error.
    pub error: Option<&'static str>,
    /// Catalogue key of the last success message.
    pub status: Option<&'static str>,
    /// Set when the back button was activated.
    pub back: bool,
    loaded: bool,
    reload: bool,
}

impl Default for QuickBillingState {
    fn default() -> Self {
        Self {
            view: QuickBillingView::Checkout,
            query: String::new(),
            category: None,
            dishes: Vec::new(),
            receipts: Vec::new(),
            cart: Vec::new(),
            option_dish: None,
            option_choices: Vec::new(),
            option_note: String::new(),
            dish_form: None,
            editing: None,
            payment_open: false,
            payment: PaymentMethod::Cash,
            tendered: String::new(),
            receipt_open: None,
            confirm_storno: false,
            confirm_delete: false,
            settings: QuickBillingSettings::default(),
            category_popup: PopupState::default(),
            error: None,
            status: None,
            back: false,
            loaded: false,
            reload: true,
        }
    }
}

impl QuickBillingState {
    /// Creates an empty screen; the first [`QuickBillingState::refresh`] loads the register.
    pub fn new() -> Self {
        Self::default()
    }

    /// Reloads dishes, receipts and settings when a write invalidated them.
    pub fn refresh(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if self.loaded && !self.reload {
            return Ok(());
        }
        self.dishes = store.list_quick_dishes()?;
        self.receipts = store.list_quick_receipts()?;
        self.settings = store.quick_billing_settings()?;
        self.loaded = true;
        self.reload = false;
        Ok(())
    }

    /// Reloads the module state before it is shown, as the desktop does when an app is launched.
    pub fn reset_for_open(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        self.view = QuickBillingView::Checkout;
        self.cart.clear();
        self.back = false;
        self.error = None;
        self.status = None;
        self.loaded = false;
        self.reload = true;
        self.refresh(store)
    }

    /// Every category of the menu, sorted and without duplicates.
    pub fn categories(&self) -> Vec<String> {
        let mut categories: Vec<String> = Vec::new();
        for dish in &self.dishes {
            let category = dish.category.trim();
            if !category.is_empty() && !categories.iter().any(|known| known == category) {
                categories.push(category.to_string());
            }
        }
        categories.sort();
        categories
    }

    /// Dishes matching the category filter and the search text.
    pub fn filtered_dishes(&self) -> Vec<&QuickDish> {
        let needle = self.query.trim().to_lowercase();
        self.dishes
            .iter()
            .filter(|dish| {
                self.category
                    .as_deref()
                    .map(|category| dish.category == category)
                    .unwrap_or(true)
            })
            .filter(|dish| {
                if needle.is_empty() {
                    return true;
                }
                dish.name.to_lowercase().contains(&needle)
                    || dish.category.to_lowercase().contains(&needle)
                    || dish.description.to_lowercase().contains(&needle)
                    || dish.sku.to_lowercase().contains(&needle)
            })
            .collect()
    }

    /// Dish of an id, if it still exists.
    pub fn dish(&self, id: Uuid) -> Option<&QuickDish> {
        self.dishes.iter().find(|dish| dish.id == id)
    }

    /// Receipt of an id, if it still exists.
    pub fn receipt(&self, id: Uuid) -> Option<&QuickReceipt> {
        self.receipts.iter().find(|receipt| receipt.id == id)
    }

    /// Cart gross total.
    pub fn cart_gross(&self) -> Money {
        self.cart
            .iter()
            .fold(Money::ZERO, |total, line| total + line.gross())
    }

    /// Cart net total.
    pub fn cart_net(&self) -> Money {
        self.cart
            .iter()
            .fold(Money::ZERO, |total, line| total + line.net())
    }

    /// Cart tax split by rate: `(7 %, 19 %)`.
    pub fn cart_tax_split(&self) -> (Money, Money) {
        let mut reduced = Money::ZERO;
        let mut standard = Money::ZERO;
        for line in &self.cart {
            if line.tax_rate_bp <= 700 {
                reduced = reduced + line.tax();
            } else {
                standard = standard + line.tax();
            }
        }
        (reduced, standard)
    }

    /// Opens the option sheet of a dish, or adds it directly when it has no options.
    pub fn tap_dish(&mut self, id: Uuid) {
        let Some(dish) = self.dish(id) else {
            return;
        };
        if !dish.enabled {
            self.error = Some("quick_billing_error_disabled");
            return;
        }
        if dish.options.is_empty() {
            let dish = dish.clone();
            self.add_line(&dish, Vec::new(), "");
            return;
        }
        self.option_choices = dish.default_options();
        self.option_note.clear();
        self.option_dish = Some(id);
        self.error = None;
    }

    /// Adds a dish with the chosen options and note to the cart, merging equal lines.
    pub fn add_line(&mut self, dish: &QuickDish, options: Vec<DishOption>, note: &str) {
        let labels: Vec<String> = options.iter().map(DishOption::label).collect();
        let note = note.trim();
        let note_value = if note.is_empty() {
            None
        } else {
            Some(note.to_string())
        };
        let unit_price = dish.price_with(&options);

        if let Some(line) = self.cart.iter_mut().find(|line| {
            line.dish_id == Some(dish.id)
                && line.options == labels
                && line.note == note_value
                && line.unit_price == unit_price
        }) {
            line.quantity += 1;
        } else {
            self.cart.push(ReceiptLine {
                dish_id: Some(dish.id),
                name: dish.name.clone(),
                category: dish.category.clone(),
                emoji: dish.emoji.clone(),
                quantity: 1,
                unit_price,
                tax_rate_bp: dish.tax_rate_bp,
                options: labels,
                note: note_value,
            });
        }
        self.error = None;
        self.status = None;
    }

    /// Confirms the option sheet.
    pub fn confirm_options(&mut self) {
        let Some(id) = self.option_dish else {
            return;
        };
        let Some(dish) = self.dish(id).cloned() else {
            self.option_dish = None;
            return;
        };
        let choices = self.option_choices.clone();
        let note = self.option_note.clone();
        self.add_line(&dish, choices, &note);
        self.option_dish = None;
    }

    /// Selects or deselects an option; one option per group.
    pub fn toggle_option(&mut self, option: &DishOption) {
        if let Some(index) = self
            .option_choices
            .iter()
            .position(|chosen| chosen.group == option.group && chosen.name == option.name)
        {
            self.option_choices.remove(index);
            return;
        }
        self.option_choices
            .retain(|chosen| chosen.group != option.group);
        self.option_choices.push(option.clone());
        let order: Vec<String> = self
            .option_dish
            .and_then(|id| self.dish(id))
            .map(|dish| dish.options.iter().map(|item| item.name.clone()).collect())
            .unwrap_or_default();
        self.option_choices.sort_by_key(|chosen| {
            order
                .iter()
                .position(|name| *name == chosen.name)
                .unwrap_or(usize::MAX)
        });
    }

    /// Changes the quantity of a cart line; zero removes it.
    pub fn change_quantity(&mut self, index: usize, delta: i64) {
        if let Some(line) = self.cart.get_mut(index) {
            line.quantity += delta;
            if line.quantity <= 0 {
                self.cart.remove(index);
            }
        }
    }

    /// Removes a cart line.
    pub fn remove_line(&mut self, index: usize) {
        if index < self.cart.len() {
            self.cart.remove(index);
        }
    }

    /// Empties the cart.
    pub fn clear_cart(&mut self) {
        self.cart.clear();
        self.error = None;
    }

    /// Opens the payment sheet with the total as the tendered cash amount.
    pub fn open_payment(&mut self) {
        if self.cart.is_empty() {
            self.error = Some("quick_billing_error_empty");
            return;
        }
        self.payment = PaymentMethod::Cash;
        self.tendered = self.cart_gross().to_decimal_string();
        self.error = None;
        self.payment_open = true;
    }

    /// Change due for the entered cash amount.
    pub fn change_due(&self) -> Money {
        let tendered = Money::parse(self.tendered.trim()).unwrap_or(Money::ZERO);
        Money::from_cents((tendered.cents() - self.cart_gross().cents()).max(0))
    }

    /// Receipt described by the open payment sheet.
    pub fn pending_receipt(&self, number: String, now: i64) -> Result<QuickReceipt, &'static str> {
        if self.cart.is_empty() {
            return Err("quick_billing_error_empty");
        }
        let total = self.cart_gross();
        let (tendered, change) = match self.payment {
            PaymentMethod::Cash => {
                let tendered =
                    Money::parse(self.tendered.trim()).ok_or("quick_billing_error_tender")?;
                if tendered.cents() < total.cents() {
                    return Err("quick_billing_error_tender");
                }
                (tendered, tendered - total)
            }
            PaymentMethod::Card | PaymentMethod::Nfc => (total, Money::ZERO),
        };
        Ok(QuickReceipt {
            id: Uuid::new_v4(),
            number,
            status: ReceiptStatus::Completed,
            created_at: now,
            cancelled_at: None,
            storno_of: None,
            payment: self.payment,
            tendered,
            change,
            tse_signature: quick_billing::tse_signature(now),
            lines: self.cart.clone(),
        })
    }

    /// Completes the sale and stores it with its stock effect.
    pub fn complete_sale(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let number = match store.next_quick_receipt_number(now) {
            Ok(number) => number,
            Err(error) => {
                self.error = Some("quick_billing_error_save");
                return Err(error);
            }
        };
        let receipt = match self.pending_receipt(number, now) {
            Ok(receipt) => receipt,
            Err(key) => {
                self.error = Some(key);
                return Ok(());
            }
        };
        if let Err(error) = store.insert_quick_receipt(&receipt) {
            self.error = Some("quick_billing_error_save");
            return Err(error);
        }
        self.cart.clear();
        self.payment_open = false;
        self.error = None;
        self.status = Some("quick_billing_sale_saved");
        self.reload = true;
        self.refresh(store)
    }

    /// Opens the receipt detail.
    pub fn open_receipt(&mut self, id: Uuid) {
        self.receipt_open = Some(id);
        self.confirm_storno = false;
        self.error = None;
    }

    /// Cancels the receipt shown in the detail dialog.
    pub fn cancel_receipt(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(id) = self.receipt_open else {
            return Ok(());
        };
        match store.cancel_quick_receipt(id, now) {
            Ok(_) => {
                self.confirm_storno = false;
                self.receipt_open = None;
                self.error = None;
                self.status = Some("quick_billing_storno_saved");
                self.reload = true;
                self.refresh(store)
            }
            Err(error) => {
                self.error = Some("quick_billing_error_storno");
                self.confirm_storno = false;
                Err(error)
            }
        }
    }

    /// Opens an empty dish form.
    pub fn start_new_dish(&mut self) {
        let category = self
            .categories()
            .into_iter()
            .next()
            .unwrap_or_else(|| "Hauptgerichte".to_string());
        self.dish_form = Some(DishDraft {
            category,
            ..DishDraft::default()
        });
        self.editing = None;
        self.error = None;
    }

    /// Opens the dish form with the selected dish.
    pub fn start_edit_dish(&mut self, id: Uuid) {
        let Some(dish) = self.dish(id) else {
            return;
        };
        self.dish_form = Some(DishDraft::from_dish(dish));
        self.editing = Some(id);
        self.error = None;
    }

    /// Validates and stores the dish form.
    pub fn save_dish(&mut self, store: &Store, now: i64) -> socdof_core::CoreResult<()> {
        let Some(draft) = self.dish_form.clone() else {
            return Ok(());
        };
        let base = self.editing.and_then(|id| self.dish(id).cloned());
        let dish = match draft.to_dish(base.as_ref(), now) {
            Ok(dish) => dish,
            Err(key) => {
                self.error = Some(key);
                return Ok(());
            }
        };
        if base.is_some() {
            store.update_quick_dish(&dish)?;
        } else {
            store.insert_quick_dish(&dish)?;
        }
        self.dish_form = None;
        self.editing = None;
        self.error = None;
        self.status = Some("quick_billing_dish_saved");
        self.reload = true;
        self.refresh(store)
    }

    /// Deletes the dish the form edits.
    pub fn delete_dish(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        let Some(id) = self.editing else {
            return Ok(());
        };
        store.delete_quick_dish(id)?;
        self.confirm_delete = false;
        self.dish_form = None;
        self.editing = None;
        self.error = None;
        self.status = Some("quick_billing_dish_deleted");
        self.reload = true;
        self.refresh(store)
    }

    /// Stores the register settings.
    pub fn save_settings(&mut self, store: &Store) -> socdof_core::CoreResult<()> {
        if let Err(error) = store.save_quick_billing_settings(&self.settings) {
            self.error = Some("quick_billing_error_save");
            return Err(error);
        }
        self.error = None;
        self.status = Some("quick_billing_settings_saved");
        Ok(())
    }

    /// Receipts of the day of `now`.
    pub fn day_receipts(&self, now: i64) -> Vec<QuickReceipt> {
        let (year, month, day) = socdof_core::date::civil_from_millis(now);
        self.receipts
            .iter()
            .filter(|receipt| {
                socdof_core::date::civil_from_millis(receipt.created_at) == (year, month, day)
            })
            .cloned()
            .collect()
    }

    /// Summary of the receipts of the day of `now`.
    pub fn day_summary(&self, now: i64) -> DaySummary {
        summarize(&self.day_receipts(now))
    }

    /// Summary of every stored receipt.
    pub fn total_summary(&self) -> DaySummary {
        summarize(&self.receipts)
    }

    /// Sold dishes of the day of `now`, best seller first.
    pub fn day_dish_sales(&self, now: i64) -> Vec<DishSales> {
        dish_sales(&self.day_receipts(now))
    }

    /// Sold options of the day of `now`, most ordered first.
    pub fn day_option_sales(&self, now: i64) -> Vec<(String, i64)> {
        option_sales(&self.day_receipts(now))
    }

    /// Next storno number, shown in the confirmation for transparency.
    pub fn next_storno(&self, now: i64) -> String {
        next_storno_number(&self.receipts, now)
    }
}

/// Seeds the five demo dishes of the reference when the register is still empty.
pub fn seed_quick_billing(store: &Store, texts: &UiTexts) -> socdof_core::CoreResult<()> {
    if store.quick_dish_count()? > 0 {
        return Ok(());
    }
    let mut schnitzel = QuickDish::new(texts.get("quick_billing_sample_schnitzel"), SAMPLE_NOW_MS);
    schnitzel.category = texts.get("quick_billing_sample_main").to_string();
    schnitzel.price = Money::from_cents(1_850);
    schnitzel.tax_rate_bp = 700;
    schnitzel.emoji = "🥩".to_string();
    schnitzel.stock = 35;
    schnitzel.sku = "DISH-SCHNITZEL".to_string();
    schnitzel.options = vec![
        DishOption {
            group: texts.get("quick_billing_sample_side").to_string(),
            name: texts.get("quick_billing_sample_potato_salad").to_string(),
            extra_price: Money::ZERO,
            default: true,
        },
        DishOption {
            group: texts.get("quick_billing_sample_side").to_string(),
            name: texts.get("quick_billing_sample_fries").to_string(),
            extra_price: Money::from_cents(150),
            default: false,
        },
    ];
    store.insert_quick_dish(&schnitzel)?;

    let mut burger = QuickDish::new(texts.get("quick_billing_sample_burger"), SAMPLE_NOW_MS);
    burger.category = schnitzel.category.clone();
    burger.price = Money::from_cents(1_590);
    burger.tax_rate_bp = 700;
    burger.emoji = "🍔".to_string();
    burger.stock = 25;
    burger.sku = "DISH-BURGER".to_string();
    store.insert_quick_dish(&burger)?;

    let mut salad = QuickDish::new(texts.get("quick_billing_sample_salad"), SAMPLE_NOW_MS);
    salad.category = texts.get("quick_billing_sample_starter").to_string();
    salad.price = Money::from_cents(980);
    salad.tax_rate_bp = 700;
    salad.emoji = "🥗".to_string();
    salad.stock = 40;
    salad.sku = "DISH-SALAD".to_string();
    store.insert_quick_dish(&salad)?;

    let mut lemonade = QuickDish::new(texts.get("quick_billing_sample_lemonade"), SAMPLE_NOW_MS);
    lemonade.category = texts.get("quick_billing_sample_drinks").to_string();
    lemonade.price = Money::from_cents(450);
    lemonade.tax_rate_bp = 1_900;
    lemonade.emoji = "🍋".to_string();
    lemonade.stock = 50;
    lemonade.sku = "DRINK-LIMO".to_string();
    store.insert_quick_dish(&lemonade)?;

    let mut espresso = QuickDish::new(texts.get("quick_billing_sample_espresso"), SAMPLE_NOW_MS);
    espresso.category = lemonade.category;
    espresso.price = Money::from_cents(270);
    espresso.tax_rate_bp = 1_900;
    espresso.emoji = "☕".to_string();
    espresso.stock = 100;
    espresso.sku = "DRINK-ESPRESSO".to_string();
    store.insert_quick_dish(&espresso)?;
    Ok(())
}

fn money(amount: Money) -> String {
    amount.format_localized(CURRENCY)
}

fn format_time(millis: i64) -> String {
    let day_ms = millis.rem_euclid(86_400_000);
    format!(
        "{:02}:{:02}",
        day_ms / 3_600_000,
        (day_ms % 3_600_000) / 60_000
    )
}

fn payment_key(method: PaymentMethod) -> &'static str {
    match method {
        PaymentMethod::Cash => "quick_billing_payment_cash",
        PaymentMethod::Card => "quick_billing_payment_card",
        PaymentMethod::Nfc => "quick_billing_payment_nfc",
    }
}

fn status_key(status: ReceiptStatus) -> &'static str {
    match status {
        ReceiptStatus::Completed => "quick_billing_status_completed",
        ReceiptStatus::Cancelled => "quick_billing_status_cancelled",
        ReceiptStatus::Storno => "quick_billing_status_storno",
    }
}

fn status_tone(status: ReceiptStatus) -> Tone {
    match status {
        ReceiptStatus::Completed => Tone::Success,
        ReceiptStatus::Cancelled => Tone::Danger,
        ReceiptStatus::Storno => Tone::Warning,
    }
}

fn messages(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &QuickBillingState) {
    if let Some(key) = state.status {
        badge(ui, theme, texts.get(key), Tone::Success);
    }
    if let Some(key) = state.error {
        badge(ui, theme, texts.get(key), Tone::Danger);
    }
}

fn tabs(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
) {
    ui.horizontal_wrapped(|ui| {
        for view in QuickBillingView::ALL {
            let variant = if view == state.view {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Ghost
            };
            if button(ui, theme, focus, texts.get(view.label_key()), variant).activated {
                state.view = view;
                state.error = None;
            }
        }
    });
}

/// Renders the quick billing screen into the context.
pub fn quick_billing(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
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
            quick_billing_window(ctx, true, ui, theme, texts, focus, state, store, now);
        });
}

/// Renders the register and its dialogs inside a native desktop window.
#[allow(clippy::too_many_arguments)]
pub fn quick_billing_window(
    ctx: &Context,
    active: bool,
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
    store: &Store,
    now: i64,
) {
    if active
        && state.dish_form.is_none()
        && state.option_dish.is_none()
        && !state.payment_open
        && state.receipt_open.is_none()
        && ctx.input(|input| input.key_pressed(egui::Key::Escape))
    {
        match state.view {
            QuickBillingView::Checkout => state.back = true,
            _ => state.view = QuickBillingView::Checkout,
        }
    }

    if state.refresh(store).is_err() {
        state.error = Some("quick_billing_error_load");
    }

    egui::ScrollArea::vertical().show(ui, |ui| {
        let subtitle = format!(
            "{} · {}",
            state.settings.store_name,
            texts.get("quick_billing_subtitle")
        );
        crate::chrome::module_header(
            ui,
            theme,
            texts,
            focus,
            crate::chrome::ModuleHeader {
                app: crate::chrome::app_chrome("ios_billing"),
                title: texts.get("quick_billing_title"),
                subtitle: &subtitle,
                status: None,
            },
            &mut state.back,
        );
        ui.add_space(8.0);
        messages(ui, theme, texts, state);
        ui.add_space(6.0);
        tabs(ui, theme, texts, focus, state);
        ui.add_space(12.0);
        match state.view {
            QuickBillingView::Checkout => checkout(ui, theme, texts, focus, state),
            QuickBillingView::Menu => menu(ui, theme, texts, focus, state, store),
            QuickBillingView::Receipts => receipts(ui, theme, texts, focus, state),
            QuickBillingView::Stats => stats(ui, theme, texts, state, now),
            QuickBillingView::Settings => settings(ui, theme, texts, focus, state, store),
        }
    });

    option_sheet(ctx, theme, texts, focus, state);
    payment_sheet(ctx, theme, texts, focus, state, store, now);
    dish_form_dialog(ctx, theme, texts, focus, state, store, now);
    receipt_dialog(ctx, theme, texts, focus, state, store, now);
}

fn checkout(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
) {
    let mut chosen_category: Option<Option<String>> = None;
    let categories = state.categories();
    ui.horizontal_wrapped(|ui| {
        let all = texts.get("quick_billing_all_categories");
        let variant = if state.category.is_none() {
            ButtonVariant::Primary
        } else {
            ButtonVariant::Secondary
        };
        if button(ui, theme, focus, all, variant).activated {
            chosen_category = Some(None);
        }
        for category in &categories {
            let active = state.category.as_deref() == Some(category.as_str());
            let variant = if active {
                ButtonVariant::Primary
            } else {
                ButtonVariant::Secondary
            };
            if button(ui, theme, focus, category, variant).activated {
                chosen_category = Some(Some(category.clone()));
            }
        }
    });
    if let Some(category) = chosen_category {
        state.category = category;
    }

    ui.add_space(6.0);
    search_field_reserved(
        ui,
        theme,
        focus,
        &mut state.query,
        texts.get("quick_billing_search"),
        0.0,
    );
    ui.add_space(8.0);

    let mut tapped = None;
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("quick_billing_menu_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(6.0);
        let filtered: Vec<QuickDish> = state.filtered_dishes().into_iter().cloned().collect();
        if filtered.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("quick_billing_menu_no_dishes"),
                texts.get("quick_billing_menu_no_dishes_hint"),
            );
            return;
        }
        let tile = if ui.available_width() < FORM_STACK_WIDTH {
            (ui.available_width() - 8.0).max(120.0)
        } else {
            168.0
        };
        ui.horizontal_wrapped(|ui| {
            for dish in &filtered {
                let label = truncate(&format!("{} {}", dish.emoji, dish.name), 20);
                ui.allocate_ui_with_layout(
                    Vec2::new(tile, 74.0),
                    Layout::top_down(Align::Center),
                    |ui| {
                        if button(ui, theme, focus, &label, ButtonVariant::Secondary).activated {
                            tapped = Some(dish.id);
                        }
                        ui.label(RichText::new(money(dish.price)).strong());
                        if !dish.enabled {
                            badge(
                                ui,
                                theme,
                                texts.get("quick_billing_dish_disabled"),
                                Tone::Neutral,
                            );
                        }
                    },
                );
            }
        });
    });
    if let Some(id) = tapped {
        state.tap_dish(id);
    }

    ui.add_space(12.0);
    let mut pay = false;
    let mut clear = false;
    let mut change: Option<(usize, i64)> = None;
    let mut remove = None;
    card(ui, theme, |ui| {
        ui.horizontal_wrapped(|ui| {
            ui.label(
                RichText::new(texts.get("quick_billing_cart_title"))
                    .size(FONT_TITLE)
                    .strong(),
            );
            ui.label(
                RichText::new(format!(
                    "{} {}",
                    state.cart.len(),
                    texts.get("quick_billing_receipt_items")
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
        });
        ui.add_space(6.0);
        if state.cart.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("quick_billing_cart_empty"),
                texts.get("quick_billing_cart_empty_hint"),
            );
        }
        for (index, line) in state.cart.iter().enumerate() {
            ui.horizontal_wrapped(|ui| {
                ui.label(RichText::new(format!("{}× {}", line.quantity, line.name)).strong());
                if !line.options.is_empty() {
                    ui.label(
                        RichText::new(line.options.join(", "))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                }
                if let Some(note) = &line.note {
                    ui.label(
                        RichText::new(format!("· {note}"))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                }
                if button(ui, theme, focus, "−", ButtonVariant::Ghost).activated {
                    change = Some((index, -1));
                }
                if button(ui, theme, focus, "+", ButtonVariant::Ghost).activated {
                    change = Some((index, 1));
                }
                ui.label(RichText::new(money(line.gross())).strong());
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_cart_remove"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    remove = Some(index);
                }
            });
        }
        if !state.cart.is_empty() {
            ui.add_space(8.0);
            let (reduced, standard) = state.cart_tax_split();
            for (key, amount) in [
                ("quick_billing_cart_subtotal", state.cart_net()),
                ("quick_billing_cart_tax7", reduced),
                ("quick_billing_cart_tax19", standard),
            ] {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.label(money(amount));
                });
            }
            ui.horizontal(|ui| {
                ui.label(RichText::new(texts.get("quick_billing_cart_total")).strong());
                ui.label(
                    RichText::new(money(state.cart_gross()))
                        .size(FONT_TITLE)
                        .strong(),
                );
            });
            ui.add_space(8.0);
        }
        ui.horizontal_wrapped(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("quick_billing_pay"),
                ButtonVariant::Primary,
            )
            .activated
            {
                pay = true;
            }
            if button(
                ui,
                theme,
                focus,
                texts.get("quick_billing_cart_clear"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                clear = true;
            }
        });
    });
    if let Some((index, delta)) = change {
        state.change_quantity(index, delta);
    }
    if let Some(index) = remove {
        state.remove_line(index);
    }
    if clear {
        state.clear_cart();
    }
    if pay {
        state.open_payment();
    }
}

fn truncate(text: &str, limit: usize) -> String {
    if text.chars().count() <= limit {
        return text.to_string();
    }
    let mut short: String = text.chars().take(limit.saturating_sub(1)).collect();
    short.push('…');
    short
}

fn menu(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
    store: &Store,
) {
    let mut create = false;
    let mut edit = None;
    let mut toggle = None;
    ui.horizontal_wrapped(|ui| {
        if button(
            ui,
            theme,
            focus,
            texts.get("quick_billing_menu_new"),
            ButtonVariant::Primary,
        )
        .activated
        {
            create = true;
        }
    });
    if create {
        state.start_new_dish();
    }
    ui.add_space(8.0);
    let dishes = state.dishes.clone();
    card(ui, theme, |ui| {
        if dishes.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("quick_billing_menu_no_dishes"),
                texts.get("quick_billing_menu_no_dishes_hint"),
            );
            return;
        }
        for dish in &dishes {
            ui.horizontal_wrapped(|ui| {
                ui.label(RichText::new(format!("{} {}", dish.emoji, dish.name)).strong());
                badge(
                    ui,
                    theme,
                    if dish.category.is_empty() {
                        texts.get("quick_billing_all_categories")
                    } else {
                        dish.category.as_str()
                    },
                    Tone::Accent,
                );
                ui.label(money(dish.price));
                ui.label(
                    RichText::new(format!(
                        "{} % · {} {}",
                        dish.tax_rate_bp as f64 / 100.0,
                        dish.stock,
                        texts.get("quick_billing_stock_unit")
                    ))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
                if !dish.enabled {
                    badge(
                        ui,
                        theme,
                        texts.get("quick_billing_dish_disabled"),
                        Tone::Neutral,
                    );
                }
                let toggle_key = if dish.enabled {
                    "quick_billing_dish_disable"
                } else {
                    "quick_billing_dish_enable"
                };
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get(toggle_key),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    toggle = Some(dish.id);
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_menu_edit"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    edit = Some(dish.id);
                }
            });
            if !dish.options.is_empty() {
                ui.label(
                    RichText::new(
                        dish.options
                            .iter()
                            .map(DishOption::label)
                            .collect::<Vec<_>>()
                            .join(" · "),
                    )
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
            }
            ui.add_space(4.0);
        }
    });
    if let Some(id) = edit {
        state.start_edit_dish(id);
    }
    if let Some(id) = toggle {
        if let Some(mut dish) = state.dish(id).cloned() {
            dish.enabled = !dish.enabled;
            dish.updated_at = socdof_core::now_millis();
            if store.update_quick_dish(&dish).is_err() {
                state.error = Some("quick_billing_error_dish");
            } else {
                state.reload = true;
                let _ = state.refresh(store);
            }
        }
    }
}

fn receipts(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
) {
    let mut open = None;
    let receipts = state.receipts.clone();
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("quick_billing_receipts_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(6.0);
        if receipts.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("quick_billing_receipts_empty"),
                texts.get("quick_billing_receipts_empty_hint"),
            );
            return;
        }
        for receipt in &receipts {
            ui.horizontal_wrapped(|ui| {
                ui.label(RichText::new(&receipt.number).strong().monospace());
                badge(
                    ui,
                    theme,
                    texts.get(status_key(receipt.status)),
                    status_tone(receipt.status),
                );
                ui.label(
                    RichText::new(format!(
                        "{} · {}",
                        format_time(receipt.created_at),
                        texts.get(payment_key(receipt.payment))
                    ))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
                ui.label(RichText::new(money(receipt.gross())).strong());
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_receipt_view"),
                    ButtonVariant::Secondary,
                )
                .activated
                {
                    open = Some(receipt.id);
                }
            });
            ui.add_space(4.0);
        }
    });
    if let Some(id) = open {
        state.open_receipt(id);
    }
}

fn stats(ui: &mut egui::Ui, theme: &Theme, texts: &UiTexts, state: &QuickBillingState, now: i64) {
    let day = state.day_summary(now);
    let total = state.total_summary();
    let kpis: Vec<(String, String)> = vec![
        (
            format!(
                "{} · {}",
                texts.get("quick_billing_stats_revenue"),
                texts.get("quick_billing_stats_today")
            ),
            money(day.gross),
        ),
        (
            format!(
                "{} · {}",
                texts.get("quick_billing_stats_receipts"),
                texts.get("quick_billing_stats_today")
            ),
            day.receipts.to_string(),
        ),
        (
            texts.get("quick_billing_stats_average").to_string(),
            money(day.average()),
        ),
        (
            texts.get("quick_billing_stats_items").to_string(),
            day.items.to_string(),
        ),
        (
            format!(
                "{} · {}",
                texts.get("quick_billing_stats_revenue"),
                texts.get("quick_billing_stats_all")
            ),
            money(total.gross),
        ),
        (
            texts.get("quick_billing_stats_receipts").to_string(),
            total.receipts.to_string(),
        ),
    ];
    kpi_cards(ui, theme, &kpis);

    ui.add_space(12.0);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("quick_billing_stats_payments"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(6.0);
        for method in PaymentMethod::ALL {
            ui.horizontal(|ui| {
                ui.label(
                    RichText::new(texts.get(payment_key(method)))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(money(day.payment_total(method)));
            });
        }
        ui.add_space(6.0);
        ui.label(
            RichText::new(format!(
                "{} {} · {} {}",
                texts.get("quick_billing_cart_tax7"),
                money(day.tax_reduced),
                texts.get("quick_billing_cart_tax19"),
                money(day.tax_standard)
            ))
            .size(FONT_SMALL)
            .color(theme.palette.text_muted),
        );
    });

    ui.add_space(12.0);
    let dishes = state.day_dish_sales(now);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("quick_billing_stats_top_dishes"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(6.0);
        if dishes.is_empty() {
            empty_state(
                ui,
                theme,
                texts.get("quick_billing_stats_empty"),
                texts.get("quick_billing_stats_empty_hint"),
            );
            return;
        }
        for sale in &dishes {
            ui.horizontal_wrapped(|ui| {
                ui.label(RichText::new(format!("{} {}", sale.emoji, sale.name)).strong());
                ui.label(
                    RichText::new(format!("{}×", sale.quantity))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.label(money(sale.revenue));
            });
        }
    });

    ui.add_space(12.0);
    let options = state.day_option_sales(now);
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("quick_billing_stats_top_options"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(6.0);
        if options.is_empty() {
            ui.label(
                RichText::new(texts.get("quick_billing_stats_empty"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            return;
        }
        for (label, count) in &options {
            ui.horizontal(|ui| {
                ui.label(label);
                ui.label(RichText::new(format!("{count}×")).strong());
            });
        }
    });
}

fn settings(
    ui: &mut egui::Ui,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
    store: &Store,
) {
    let mut save = false;
    card(ui, theme, |ui| {
        ui.label(
            RichText::new(texts.get("quick_billing_settings_title"))
                .size(FONT_TITLE)
                .strong(),
        );
        ui.add_space(6.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.settings.store_name,
            texts.get("quick_billing_settings_store"),
            texts.get("quick_billing_settings_store_hint"),
            None,
        );
        ui.add_space(4.0);
        text_field(
            ui,
            theme,
            focus,
            &mut state.settings.receipt_footer,
            texts.get("quick_billing_settings_footer"),
            texts.get("quick_billing_settings_footer_hint"),
            None,
        );
        ui.add_space(8.0);
        if button(
            ui,
            theme,
            focus,
            texts.get("quick_billing_settings_save"),
            ButtonVariant::Primary,
        )
        .activated
        {
            save = true;
        }
    });
    if save && state.save_settings(store).is_err() {
        state.error = Some("quick_billing_error_save");
    }
}

/// Keeps a dialog inside the viewport on phone widths.
///
/// A modal sizes itself to its content, and the dish form lays out three text fields per option
/// row. Without a maximum width the window grew past the 432 px phone panel.
fn fit_dialog(ui: &mut egui::Ui) {
    let width = ui.ctx().screen_rect().width() - 96.0;
    ui.set_max_width(width.max(240.0));
}

fn option_sheet(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
) {
    let Some(dish) = state.option_dish.and_then(|id| state.dish(id)).cloned() else {
        return;
    };
    let mut open = true;
    let mut confirm = false;
    let mut toggled: Option<DishOption> = None;
    modal(
        ctx,
        theme,
        &mut open,
        texts.get("quick_billing_options_title"),
        |ui| {
            fit_dialog(ui);
            ui.label(RichText::new(format!("{} {}", dish.emoji, dish.name)).strong());
            ui.add_space(6.0);
            let mut groups: Vec<String> = Vec::new();
            for option in &dish.options {
                if !groups.contains(&option.group) {
                    groups.push(option.group.clone());
                }
            }
            for group in groups {
                ui.label(
                    RichText::new(&group)
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                ui.horizontal_wrapped(|ui| {
                    for option in dish.options.iter().filter(|item| item.group == group) {
                        let active = state.option_choices.iter().any(|chosen| {
                            chosen.group == option.group && chosen.name == option.name
                        });
                        let label = if option.extra_price.cents() > 0 {
                            format!("{} (+{})", option.name, money(option.extra_price))
                        } else {
                            option.name.clone()
                        };
                        if button(
                            ui,
                            theme,
                            focus,
                            &label,
                            if active {
                                ButtonVariant::Primary
                            } else {
                                ButtonVariant::Secondary
                            },
                        )
                        .activated
                        {
                            toggled = Some(option.clone());
                        }
                    }
                });
            }
            ui.add_space(6.0);
            text_field(
                ui,
                theme,
                focus,
                &mut state.option_note,
                texts.get("quick_billing_options_note"),
                texts.get("quick_billing_options_note_hint"),
                None,
            );
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_options_add"),
                    ButtonVariant::Primary,
                )
                .activated
                {
                    confirm = true;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_payment_cancel"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    state.option_dish = None;
                }
            });
            false
        },
    );
    if let Some(option) = toggled {
        state.toggle_option(&option);
    }
    if confirm {
        state.confirm_options();
    } else if !open {
        state.option_dish = None;
    }
}

fn payment_sheet(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
    store: &Store,
    now: i64,
) {
    if !state.payment_open {
        return;
    }
    let total = state.cart_gross();
    let mut open = true;
    let mut complete = false;
    let mut method = state.payment;
    modal(
        ctx,
        theme,
        &mut open,
        texts.get("quick_billing_payment_title"),
        |ui| {
            fit_dialog(ui);
            ui.label(
                RichText::new(format!(
                    "{}: {}",
                    texts.get("quick_billing_cart_total"),
                    money(total)
                ))
                .size(FONT_TITLE)
                .strong(),
            );
            ui.add_space(6.0);
            ui.horizontal_wrapped(|ui| {
                for candidate in PaymentMethod::ALL {
                    let variant = if candidate == method {
                        ButtonVariant::Primary
                    } else {
                        ButtonVariant::Ghost
                    };
                    if button(ui, theme, focus, texts.get(payment_key(candidate)), variant)
                        .activated
                    {
                        method = candidate;
                    }
                }
            });
            state.payment = method;
            ui.add_space(6.0);
            if method == PaymentMethod::Cash {
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut state.tendered,
                    texts.get("quick_billing_payment_tendered"),
                    "20,00",
                    None,
                );
                ui.label(
                    RichText::new(format!(
                        "{}: {}",
                        texts.get("quick_billing_payment_change"),
                        money(state.change_due())
                    ))
                    .strong(),
                );
            }
            ui.add_space(10.0);
            ui.horizontal(|ui| {
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_payment_complete"),
                    ButtonVariant::Primary,
                )
                .activated
                {
                    complete = true;
                }
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_payment_cancel"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    state.payment_open = false;
                }
            });
            false
        },
    );
    if complete {
        let _ = state.complete_sale(store, now);
    } else if !open {
        state.payment_open = false;
    }
}

fn dish_form_dialog(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
    store: &Store,
    now: i64,
) {
    let Some(mut draft) = state.dish_form.clone() else {
        return;
    };
    let editing = state.editing.is_some();
    let title = if editing {
        texts.get("quick_billing_dish_edit_title")
    } else {
        texts.get("quick_billing_dish_new_title")
    };
    let mut open = true;
    let mut save = false;
    let mut delete = false;
    let mut cancel = false;
    let mut add_option = false;
    let mut remove_option = None;
    let mut tax_choice = TAX_RATES
        .iter()
        .position(|rate| {
            Money::parse_scaled_decimal(rate, 2)
                == Money::parse_scaled_decimal(draft.tax_rate.trim(), 2)
        })
        .unwrap_or(0);

    modal(ctx, theme, &mut open, title, |ui| {
        fit_dialog(ui);
        text_field(
            ui,
            theme,
            focus,
            &mut draft.name,
            texts.get("quick_billing_dish_name"),
            texts.get("quick_billing_dish_name_hint"),
            None,
        );
        text_field(
            ui,
            theme,
            focus,
            &mut draft.category,
            texts.get("quick_billing_dish_category"),
            texts.get("quick_billing_dish_category_hint"),
            None,
        );
        if ui.available_width() < FORM_STACK_WIDTH {
            text_field(
                ui,
                theme,
                focus,
                &mut draft.price,
                texts.get("quick_billing_dish_price"),
                texts.get("quick_billing_dish_price_hint"),
                None,
            );
            ui.add_space(4.0);
            ui.label(
                RichText::new(texts.get("quick_billing_dish_tax"))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
            );
            let labels: Vec<&str> = TAX_RATES.to_vec();
            if select(
                ui,
                theme,
                focus,
                &mut state.category_popup,
                "quick-billing-tax",
                &mut tax_choice,
                &labels,
            ) {
                draft.tax_rate = TAX_RATES[tax_choice.min(TAX_RATES.len() - 1)].to_string();
            }
        } else {
            ui.horizontal(|ui| {
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut draft.price,
                    texts.get("quick_billing_dish_price"),
                    texts.get("quick_billing_dish_price_hint"),
                    None,
                );
                ui.label(
                    RichText::new(texts.get("quick_billing_dish_tax"))
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
                let labels: Vec<&str> = TAX_RATES.to_vec();
                if select(
                    ui,
                    theme,
                    focus,
                    &mut state.category_popup,
                    "quick-billing-tax",
                    &mut tax_choice,
                    &labels,
                ) {
                    draft.tax_rate = TAX_RATES[tax_choice.min(TAX_RATES.len() - 1)].to_string();
                }
            });
        }
        text_field(
            ui,
            theme,
            focus,
            &mut draft.description,
            texts.get("quick_billing_dish_description"),
            texts.get("quick_billing_dish_description_hint"),
            None,
        );
        ui.horizontal(|ui| {
            text_field(
                ui,
                theme,
                focus,
                &mut draft.emoji,
                texts.get("quick_billing_dish_emoji"),
                "🍽️",
                None,
            );
            text_field(
                ui,
                theme,
                focus,
                &mut draft.sku,
                texts.get("quick_billing_dish_sku"),
                "DISH-1",
                None,
            );
        });
        text_field(
            ui,
            theme,
            focus,
            &mut draft.stock,
            texts.get("quick_billing_dish_stock"),
            "0",
            None,
        );
        if switch(
            ui,
            theme,
            focus,
            &mut draft.enabled,
            texts.get("quick_billing_dish_enabled"),
        )
        .activated
        {
            // The switch already wrote the draft value.
        }

        ui.add_space(8.0);
        ui.label(
            RichText::new(texts.get("quick_billing_dish_options"))
                .size(FONT_SMALL)
                .strong()
                .color(theme.palette.text_muted),
        );
        for (index, option) in draft.options.iter_mut().enumerate() {
            ui.horizontal_wrapped(|ui| {
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut option.group,
                    texts.get("quick_billing_dish_option_group"),
                    "Beilage",
                    None,
                );
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut option.name,
                    texts.get("quick_billing_dish_option_name"),
                    "Pommes",
                    None,
                );
                text_field(
                    ui,
                    theme,
                    focus,
                    &mut option.extra,
                    texts.get("quick_billing_dish_option_price"),
                    "0,00",
                    None,
                );
                switch(
                    ui,
                    theme,
                    focus,
                    &mut option.default,
                    texts.get("quick_billing_dish_option_default"),
                );
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_dish_option_remove"),
                    ButtonVariant::Ghost,
                )
                .activated
                {
                    remove_option = Some(index);
                }
            });
        }
        if button(
            ui,
            theme,
            focus,
            texts.get("quick_billing_dish_option_add"),
            ButtonVariant::Secondary,
        )
        .activated
        {
            add_option = true;
        }

        ui.add_space(10.0);
        if let Some(key) = state.error {
            ui.label(
                RichText::new(texts.get(key))
                    .size(FONT_SMALL)
                    .color(theme.palette.danger),
            );
        }
        ui.horizontal_wrapped(|ui| {
            if button(
                ui,
                theme,
                focus,
                texts.get("quick_billing_dish_save"),
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
                texts.get("quick_billing_dish_cancel"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                cancel = true;
            }
            if editing
                && button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_menu_delete"),
                    ButtonVariant::Danger,
                )
                .activated
            {
                delete = true;
            }
        });
        false
    });
    if add_option {
        draft.options.push(DishOptionDraft {
            group: "Beilage".to_string(),
            name: String::new(),
            extra: "0.00".to_string(),
            default: false,
        });
    }
    if let Some(index) = remove_option {
        if index < draft.options.len() {
            draft.options.remove(index);
        }
    }
    if save {
        state.dish_form = Some(draft);
        let _ = state.save_dish(store, now);
        return;
    }
    if delete {
        state.confirm_delete = true;
    }
    if cancel || !open {
        state.dish_form = None;
        state.editing = None;
    } else {
        state.dish_form = Some(draft);
    }

    if state.confirm_delete {
        let mut confirm_open = true;
        let mut confirmed = false;
        modal(
            ctx,
            theme,
            &mut confirm_open,
            texts.get("quick_billing_menu_delete_title"),
            |ui| {
                fit_dialog(ui);
                ui.label(texts.get("quick_billing_menu_delete_body"));
                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("quick_billing_menu_delete_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        confirmed = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("quick_billing_payment_cancel"),
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        state.confirm_delete = false;
                    }
                });
                false
            },
        );
        if confirmed {
            let _ = state.delete_dish(store);
        } else if !confirm_open {
            state.confirm_delete = false;
        }
    }
}

fn receipt_dialog(
    ctx: &Context,
    theme: &Theme,
    texts: &UiTexts,
    focus: &mut FocusState,
    state: &mut QuickBillingState,
    store: &Store,
    now: i64,
) {
    let Some(receipt) = state.receipt_open.and_then(|id| state.receipt(id)).cloned() else {
        return;
    };
    let mut open = true;
    let mut storno = false;
    modal(
        ctx,
        theme,
        &mut open,
        texts.get("quick_billing_receipt_view"),
        |ui| {
            fit_dialog(ui);
            ui.label(
                RichText::new(&state.settings.store_name)
                    .size(FONT_TITLE)
                    .strong(),
            );
            ui.label(
                RichText::new(format!(
                    "{} · {} · {}",
                    receipt.number,
                    crate::reports::format_date(receipt.created_at),
                    format_time(receipt.created_at)
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
            ui.add_space(6.0);
            badge(
                ui,
                theme,
                texts.get(status_key(receipt.status)),
                status_tone(receipt.status),
            );
            ui.add_space(6.0);
            for line in &receipt.lines {
                ui.horizontal_wrapped(|ui| {
                    ui.label(RichText::new(format!("{}× {}", line.quantity, line.name)).strong());
                    ui.label(money(line.gross()));
                });
                if !line.options.is_empty() {
                    ui.label(
                        RichText::new(line.options.join(", "))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                }
                if let Some(note) = &line.note {
                    ui.label(
                        RichText::new(note)
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                }
            }
            ui.add_space(6.0);
            for (key, amount) in [
                ("quick_billing_receipt_net", receipt.net()),
                ("quick_billing_receipt_tax", receipt.tax()),
                ("quick_billing_receipt_gross", receipt.gross()),
                ("quick_billing_receipt_tendered", receipt.tendered),
                ("quick_billing_receipt_change", receipt.change),
            ] {
                ui.horizontal(|ui| {
                    ui.label(
                        RichText::new(texts.get(key))
                            .size(FONT_SMALL)
                            .color(theme.palette.text_muted),
                    );
                    ui.label(money(amount));
                });
            }
            ui.add_space(6.0);
            ui.label(
                RichText::new(format!(
                    "{} · {}",
                    texts.get(payment_key(receipt.payment)),
                    texts.get("quick_billing_receipt_tse")
                ))
                .size(FONT_SMALL)
                .color(theme.palette.text_muted),
            );
            ui.label(
                RichText::new(&receipt.tse_signature)
                    .monospace()
                    .size(FONT_SMALL),
            );
            if !state.settings.receipt_footer.trim().is_empty() {
                ui.add_space(6.0);
                ui.label(
                    RichText::new(&state.settings.receipt_footer)
                        .size(FONT_SMALL)
                        .color(theme.palette.text_muted),
                );
            }
            if receipt.status == ReceiptStatus::Completed {
                ui.add_space(10.0);
                if button(
                    ui,
                    theme,
                    focus,
                    texts.get("quick_billing_receipt_storno"),
                    ButtonVariant::Danger,
                )
                .activated
                {
                    storno = true;
                    state.confirm_storno = true;
                }
            }
            ui.add_space(8.0);
            if button(
                ui,
                theme,
                focus,
                texts.get("quick_billing_receipt_close"),
                ButtonVariant::Ghost,
            )
            .activated
            {
                state.receipt_open = None;
            }
            false
        },
    );
    if !open {
        state.receipt_open = None;
        state.confirm_storno = false;
    }

    if state.confirm_storno {
        let mut confirm_open = true;
        let mut confirmed = false;
        let next = state.next_storno(now);
        modal(
            ctx,
            theme,
            &mut confirm_open,
            texts.get("quick_billing_receipt_storno_title"),
            |ui| {
                fit_dialog(ui);
                ui.label(texts.get("quick_billing_receipt_storno_body"));
                ui.add_space(6.0);
                ui.label(
                    RichText::new(format!(
                        "{} {}",
                        texts.get("quick_billing_status_storno"),
                        next
                    ))
                    .size(FONT_SMALL)
                    .color(theme.palette.text_muted),
                );
                ui.add_space(10.0);
                ui.horizontal(|ui| {
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("quick_billing_receipt_storno_confirm"),
                        ButtonVariant::Danger,
                    )
                    .activated
                    {
                        confirmed = true;
                    }
                    if button(
                        ui,
                        theme,
                        focus,
                        texts.get("quick_billing_payment_cancel"),
                        ButtonVariant::Ghost,
                    )
                    .activated
                    {
                        state.confirm_storno = false;
                    }
                });
                false
            },
        );
        if confirmed {
            let _ = state.cancel_receipt(store, now);
        } else if !confirm_open {
            state.confirm_storno = false;
        }
    }
    let _ = storno;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::i18n::UiTexts;
    use socdof_core::domain::settings::Language;

    const NOW: i64 = 1_795_780_800_000;

    fn state_with_dishes() -> (Store, QuickBillingState, QuickDish, QuickDish) {
        let store = Store::open_in_memory().expect("store");
        let texts = UiTexts::embedded(Language::De).expect("texts");
        seed_quick_billing(&store, &texts).expect("seed");
        let mut state = QuickBillingState::new();
        state.refresh(&store).expect("refresh");
        let schnitzel = state
            .dishes
            .iter()
            .find(|dish| !dish.options.is_empty())
            .cloned()
            .expect("schnitzel");
        let lemonade = state
            .dishes
            .iter()
            .find(|dish| dish.sku == "DRINK-LIMO")
            .cloned()
            .expect("lemonade");
        (store, state, schnitzel, lemonade)
    }

    #[test]
    fn two_payment_methods_and_a_storno_reach_sqlite_journal_and_statistics() {
        let (store, mut state, schnitzel, lemonade) = state_with_dishes();
        let stock_before = state.dish(schnitzel.id).unwrap().stock;

        // Cash sale with a side and a note.
        state.tap_dish(schnitzel.id);
        state.option_note = "Ohne Zitrone".to_string();
        state.confirm_options();
        assert_eq!(state.cart.len(), 1);
        assert_eq!(state.cart[0].options.len(), 1);
        assert_eq!(state.cart_gross(), Money::from_cents(1_850));
        state.open_payment();
        state.tendered = "20,00".to_string();
        assert_eq!(state.change_due(), Money::from_cents(150));
        state.complete_sale(&store, NOW).expect("cash sale");
        assert!(state.cart.is_empty());
        assert_eq!(state.status, Some("quick_billing_sale_saved"));

        // Card sale of a drink at the reduced rate.
        state.tap_dish(lemonade.id);
        state.open_payment();
        state.payment = PaymentMethod::Card;
        state.complete_sale(&store, NOW + 1_000).expect("card sale");

        let stored = store.list_quick_receipts().expect("journal");
        assert_eq!(stored.len(), 2);
        assert_eq!(stored[0].number, "BON-2026-0002");
        assert_eq!(stored[0].payment, PaymentMethod::Card);
        assert_eq!(stored[1].number, "BON-2026-0001");
        assert_eq!(stored[1].payment, PaymentMethod::Cash);
        assert_eq!(stored[1].change, Money::from_cents(150));
        assert_eq!(stored[1].lines[0].note.as_deref(), Some("Ohne Zitrone"));
        assert!(!stored[1].tse_signature.is_empty());
        assert_eq!(
            store.find_quick_dish(schnitzel.id).unwrap().unwrap().stock,
            stock_before - 1
        );

        let summary = state.total_summary();
        assert_eq!(summary.receipts, 2);
        assert_eq!(summary.gross, Money::from_cents(2_300));
        assert_eq!(summary.cash, Money::from_cents(1_850));
        assert_eq!(summary.card, Money::from_cents(450));

        // Cancel the cash sale: the original stays, a storno booking is added, stock returns.
        let cash_id = stored[1].id;
        state.open_receipt(cash_id);
        state.cancel_receipt(&store, NOW + 2_000).expect("storno");
        assert_eq!(state.status, Some("quick_billing_storno_saved"));
        assert!(state.receipt_open.is_none());

        let journal = state.receipts.clone();
        assert_eq!(journal.len(), 3);
        let storno = journal
            .iter()
            .find(|receipt| receipt.storno_of == Some(cash_id))
            .expect("storno booking");
        assert_eq!(storno.status, ReceiptStatus::Storno);
        assert_eq!(storno.number, "STO-2026-0001");
        assert_eq!(storno.gross(), Money::from_cents(-1_850));
        assert_eq!(
            journal
                .iter()
                .find(|receipt| receipt.id == cash_id)
                .unwrap()
                .status,
            ReceiptStatus::Cancelled
        );
        assert_eq!(
            store.find_quick_dish(schnitzel.id).unwrap().unwrap().stock,
            stock_before
        );

        let after = state.total_summary();
        assert_eq!(after.receipts, 1);
        assert_eq!(after.gross, Money::from_cents(450));
        assert_eq!(after.cash, Money::ZERO);
        assert_eq!(state.day_summary(NOW).gross, Money::from_cents(450));
        let sold = state.day_dish_sales(NOW);
        assert_eq!(sold.len(), 1);
        assert_eq!(sold[0].name, lemonade.name);
    }

    #[test]
    fn cash_below_total_is_rejected_and_writes_nothing() {
        let (store, mut state, schnitzel, _drink) = state_with_dishes();
        state.tap_dish(schnitzel.id);
        state.confirm_options();
        state.open_payment();
        state.tendered = "10,00".to_string();
        state.complete_sale(&store, NOW).expect("handled");
        assert_eq!(state.error, Some("quick_billing_error_tender"));
        assert!(state.payment_open);
        assert_eq!(state.cart.len(), 1);
        assert_eq!(store.quick_receipt_count().expect("count"), 0);
    }

    #[test]
    fn option_sheet_merges_equal_lines_and_keeps_one_option_per_group() {
        let (_store, mut state, schnitzel, _drink) = state_with_dishes();
        let fries = schnitzel
            .options
            .iter()
            .find(|option| option.extra_price.cents() > 0)
            .cloned()
            .expect("fries");
        state.tap_dish(schnitzel.id);
        // Default selection is the free side; choosing fries replaces it inside the group.
        state.toggle_option(&fries);
        state.confirm_options();
        assert_eq!(state.cart.len(), 1);
        assert_eq!(
            state.cart[0].options,
            vec!["Beilage: Pommes frites".to_string()]
        );
        assert_eq!(state.cart[0].unit_price, Money::from_cents(2_000));

        state.tap_dish(schnitzel.id);
        state.toggle_option(&fries);
        state.confirm_options();
        assert_eq!(state.cart.len(), 1, "equal lines must merge");
        assert_eq!(state.cart[0].quantity, 2);
        state.change_quantity(0, -1);
        state.change_quantity(0, -1);
        assert!(state.cart.is_empty());
    }

    #[test]
    fn dish_form_validates_and_stores_new_and_edited_dishes() {
        let (store, mut state, _schnitzel, _drink) = state_with_dishes();
        let before = store.quick_dish_count().expect("count");

        state.start_new_dish();
        state.save_dish(&store, NOW).expect("validation");
        assert_eq!(state.error, Some("quick_billing_error_dish_name"));
        assert_eq!(store.quick_dish_count().expect("count"), before);

        let mut draft = state.dish_form.clone().expect("form");
        draft.name = "Flammkuchen".to_string();
        draft.category = "Hauptgerichte".to_string();
        draft.price = "12,90".to_string();
        draft.stock = "12".to_string();
        draft.options.push(DishOptionDraft {
            group: "Beilage".to_string(),
            name: "Salat".to_string(),
            extra: "1,50".to_string(),
            default: true,
        });
        state.dish_form = Some(draft);
        state.save_dish(&store, NOW).expect("save");
        assert_eq!(store.quick_dish_count().expect("count"), before + 1);
        let stored = store
            .list_quick_dishes()
            .expect("dishes")
            .into_iter()
            .find(|dish| dish.name == "Flammkuchen")
            .expect("dish");
        assert_eq!(stored.price, Money::from_cents(1_290));
        assert_eq!(stored.options[0].extra_price, Money::from_cents(150));

        state.start_edit_dish(stored.id);
        let mut draft = state.dish_form.clone().expect("form");
        draft.price = "13,50".to_string();
        state.dish_form = Some(draft);
        state.save_dish(&store, NOW + 1).expect("update");
        assert_eq!(
            store.find_quick_dish(stored.id).unwrap().unwrap().price,
            Money::from_cents(1_350)
        );

        state.start_edit_dish(stored.id);
        state.delete_dish(&store).expect("delete");
        assert_eq!(store.quick_dish_count().expect("count"), before);
    }

    #[test]
    fn search_category_and_settings_persist() {
        let (store, mut state, _schnitzel, _drink) = state_with_dishes();
        state.query = "limo".to_string();
        let hits = state.filtered_dishes();
        assert_eq!(hits.len(), 1);
        assert!(hits[0].name.contains("Limonade"));

        state.query.clear();
        let category = state.categories().into_iter().next().expect("category");
        state.category = Some(category.clone());
        assert!(state
            .filtered_dishes()
            .iter()
            .all(|dish| dish.category == category));

        state.settings.store_name = "Bar 7".to_string();
        state.settings.receipt_footer = "Bis bald!".to_string();
        state.save_settings(&store).expect("settings");
        let reloaded = Store::open_in_memory();
        assert!(reloaded.is_ok());
        assert_eq!(
            state.settings,
            QuickBillingSettings {
                store_name: "Bar 7".to_string(),
                receipt_footer: "Bis bald!".to_string(),
            }
        );
    }

    #[test]
    fn disabled_dishes_cannot_be_sold_and_empty_cart_cannot_pay() {
        let (store, mut state, schnitzel, _drink) = state_with_dishes();
        let mut dish = schnitzel.clone();
        dish.enabled = false;
        store.update_quick_dish(&dish).expect("disable");
        state.reload = true;
        state.refresh(&store).expect("refresh");
        state.tap_dish(schnitzel.id);
        assert_eq!(state.error, Some("quick_billing_error_disabled"));
        assert!(state.cart.is_empty());

        state.open_payment();
        assert_eq!(state.error, Some("quick_billing_error_empty"));
        assert!(!state.payment_open);
    }
}
