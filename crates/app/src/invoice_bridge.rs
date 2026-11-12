//! Invoice wire format of the webview and the export helpers behind it.
//!
//! The webview list, the editor and the preview window talk to this module only. It maps a stored
//! [`Invoice`] to a flat view with the customer labels and integer cents, parses the editor input
//! back into a validated invoice and renders the preview and both export formats with the selected
//! template. The field names follow the TypeScript invoice model where the Rust model has an
//! equivalent:
//!
//! * `contact_name` / `contact_company` are joined from the stored contact, so the list needs no
//!   second lookup in the frontend;
//! * `date` and `due_date` are ISO dates (`YYYY-MM-DD`), the format of the TypeScript date inputs;
//! * `payment_terms` is the number of days between issue and due date;
//! * `items` keep description, quantity, net unit price and tax rate plus the computed net, tax and
//!   gross amount of each position.
//!
//! The TypeScript status `posted` is stored as [`InvoiceStatus::Sent`]; the wire format accepts both
//! names and always reports the stored one. Manual recipients without a contact, the TypeScript
//! discount column and the SdI/FatturaPA fields have no Rust equivalent yet; the differences are
//! listed in `RUST_MIGRATION.md`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use socdof_core::date;
use socdof_core::document_layout;
use socdof_core::docx;
use socdof_core::domain::contact::Contact;
use socdof_core::domain::dunning::{self, DunningLevel};
use socdof_core::domain::fattura::{self, FatturaOptions};
use socdof_core::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
use socdof_core::domain::mail;
use socdof_core::domain::payment::InvoicePayment;
use socdof_core::domain::settings::CompanyProfile;
use socdof_core::error::{CoreError, CoreResult};
use socdof_core::invoice_template::{self, InvoiceTemplate, TemplateBook};
use socdof_core::money::Money;
use socdof_core::pdf::din5008;
use socdof_core::store::Store;

/// Length of one day in milliseconds.
pub const DAY_MS: i64 = 24 * 60 * 60 * 1_000;

/// One invoice position in the wire format.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceItemView {
    /// Description printed on the invoice.
    pub description: String,
    /// Quantity in thousandths (`1000` = one unit).
    pub quantity_milli: i64,
    /// Net unit price in integer cents.
    pub unit_price_cents: i64,
    /// Tax rate in basis points (`1900` = 19 %).
    pub tax_rate_bp: i64,
    /// Net amount of the position in cents.
    pub net_cents: i64,
    /// Tax amount of the position in cents.
    pub tax_cents: i64,
    /// Net plus tax of the position in cents.
    pub gross_cents: i64,
}

impl InvoiceItemView {
    /// Builds the view of one stored position.
    pub fn from_line(line: &InvoiceLine) -> Self {
        InvoiceItemView {
            description: line.description.clone(),
            quantity_milli: line.quantity_milli,
            unit_price_cents: line.unit_price.cents(),
            tax_rate_bp: line.tax_rate_bp,
            net_cents: line.net().cents(),
            tax_cents: line.tax().cents(),
            gross_cents: line.gross().cents(),
        }
    }
}

/// An invoice with the customer labels and computed totals the webview renders.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceView {
    /// Stable identifier.
    pub id: Uuid,
    /// Human readable invoice number.
    pub number: String,
    /// Billed contact.
    pub contact_id: Uuid,
    /// Display name of the contact.
    pub contact_name: String,
    /// Company name of the contact, empty for private customers.
    pub contact_company: String,
    /// Lifecycle state in its storage representation (`draft`, `sent`, `paid`, …).
    pub status: String,
    /// Issue date as `YYYY-MM-DD`.
    pub date: String,
    /// Due date as `YYYY-MM-DD`.
    pub due_date: String,
    /// Days between issue and due date, the TypeScript payment term in days.
    pub payment_terms: i64,
    /// Currency symbol used for printing.
    pub currency_symbol: String,
    /// Free text note printed above the totals.
    pub notes: String,
    /// Positions of the invoice.
    pub items: Vec<InvoiceItemView>,
    /// Sum of the net position amounts in cents.
    pub subtotal_cents: i64,
    /// Sum of the tax amounts in cents.
    pub tax_total_cents: i64,
    /// Net plus tax in cents.
    pub total_cents: i64,
    /// Issue date in milliseconds since the Unix epoch.
    pub issued_at: i64,
    /// Due date in milliseconds since the Unix epoch.
    pub due_at: i64,
}

impl InvoiceView {
    /// Builds the view of a stored invoice, using the contact for the labels.
    pub fn from_invoice(invoice: &Invoice, contact: Option<&Contact>) -> Self {
        InvoiceView {
            id: invoice.id,
            number: invoice.number.clone(),
            contact_id: invoice.contact_id,
            contact_name: contact
                .map(Contact::display_name)
                .unwrap_or_else(|| invoice.contact_id.to_string()),
            contact_company: contact
                .and_then(|contact| contact.company_name.clone())
                .unwrap_or_default(),
            status: invoice.status.as_str().to_string(),
            date: iso_date(invoice.issued_at),
            due_date: iso_date(invoice.due_at),
            payment_terms: (invoice.due_at - invoice.issued_at).max(0) / DAY_MS,
            currency_symbol: invoice.currency_symbol.clone(),
            notes: invoice.note.clone().unwrap_or_default(),
            items: invoice
                .lines
                .iter()
                .map(InvoiceItemView::from_line)
                .collect(),
            subtotal_cents: invoice.total_net().cents(),
            tax_total_cents: invoice.total_tax().cents(),
            total_cents: invoice.total_gross().cents(),
            issued_at: invoice.issued_at,
            due_at: invoice.due_at,
        }
    }
}

/// One invoice position sent by the editor.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct InvoiceItemInput {
    /// Description printed on the invoice.
    pub description: String,
    /// Quantity in thousandths (`1000` = one unit).
    pub quantity_milli: i64,
    /// Net unit price in integer cents.
    pub unit_price_cents: i64,
    /// Tax rate in basis points (`1900` = 19 %).
    pub tax_rate_bp: i64,
}

impl Default for InvoiceItemInput {
    /// Empty position with one unit and the German standard tax rate, like the editor row.
    fn default() -> Self {
        InvoiceItemInput {
            description: String::new(),
            quantity_milli: 1_000,
            unit_price_cents: 0,
            tax_rate_bp: 1900,
        }
    }
}

impl InvoiceItemInput {
    /// Converts the row into a stored position.
    pub fn to_line(&self) -> InvoiceLine {
        InvoiceLine {
            description: self.description.trim().to_string(),
            quantity_milli: self.quantity_milli,
            unit_price: Money::from_cents(self.unit_price_cents),
            tax_rate_bp: self.tax_rate_bp,
        }
    }
}

/// An invoice created or changed by the editor.
///
/// Missing fields fall back to the editor defaults (`status = draft`, empty note, empty items), so a
/// partial payload still produces a validation error with a readable code instead of a parse error.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct InvoiceInput {
    /// Identifier of the invoice to change; `None` creates a new invoice.
    pub id: Option<Uuid>,
    /// Human readable invoice number.
    pub number: String,
    /// Billed contact.
    pub contact_id: Uuid,
    /// Lifecycle state; `posted` is accepted as the TypeScript name of `sent`.
    pub status: String,
    /// Issue date as `YYYY-MM-DD`.
    pub date: String,
    /// Due date as `YYYY-MM-DD`.
    pub due_date: String,
    /// Currency symbol; an empty value falls back to the company currency.
    pub currency_symbol: String,
    /// Free text note printed above the totals.
    pub notes: String,
    /// Positions of the invoice.
    pub items: Vec<InvoiceItemInput>,
}

impl Default for InvoiceInput {
    /// Editor defaults of a new invoice.
    fn default() -> Self {
        InvoiceInput {
            id: None,
            number: String::new(),
            contact_id: Uuid::nil(),
            status: "draft".to_string(),
            date: String::new(),
            due_date: String::new(),
            currency_symbol: String::new(),
            notes: String::new(),
            items: Vec::new(),
        }
    }
}

impl InvoiceInput {
    /// Builds the invoice to store; `base` keeps the stored identity when editing.
    ///
    /// All validation rules stay in the domain: a missing number, an empty position list, a zero
    /// quantity or a tax rate outside 0–100 % returns the same code the core uses.
    pub fn to_invoice(
        &self,
        base: Option<&Invoice>,
        company: &CompanyProfile,
    ) -> CoreResult<Invoice> {
        let id = self
            .id
            .or_else(|| base.map(|invoice| invoice.id))
            .unwrap_or_else(Uuid::new_v4);
        let issued_at = parse_iso_date(&self.date)
            .ok_or_else(|| CoreError::Validation("invoice_date_invalid".to_string()))?;
        let due_at = parse_iso_date(&self.due_date)
            .ok_or_else(|| CoreError::Validation("invoice_due_date_invalid".to_string()))?;
        if due_at < issued_at {
            return Err(CoreError::Validation(
                "invoice_due_before_issued".to_string(),
            ));
        }
        let status = status_from_wire(&self.status)
            .ok_or_else(|| CoreError::Validation("invoice_status_invalid".to_string()))?;
        let currency_symbol = match self.currency_symbol.trim() {
            "" => company.currency.trim().to_string(),
            value => value.to_string(),
        };
        let currency_symbol = if currency_symbol.is_empty() {
            "€".to_string()
        } else {
            currency_symbol
        };
        let invoice = Invoice {
            id,
            number: self.number.trim().to_string(),
            contact_id: self.contact_id,
            status,
            issued_at,
            due_at,
            currency_symbol,
            note: match self.notes.trim() {
                "" => None,
                note => Some(note.to_string()),
            },
            lines: self.items.iter().map(InvoiceItemInput::to_line).collect(),
        };
        invoice.validate().map_err(CoreError::Validation)?;
        Ok(invoice)
    }
}

/// Defaults of a new invoice, loaded once when the editor opens.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceDefaults {
    /// Suggested sequential number for the current year.
    pub number: String,
    /// Company currency, or `€` when the profile has none.
    pub currency_symbol: String,
    /// Payment term of the active template in days.
    pub due_days: i64,
}

/// One resolved stationery field of the preview.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InvoicePreviewToken {
    /// Invoice variable such as `{Rechnungsnummer}`.
    pub key: String,
    /// Text printed at that position.
    pub text: String,
    /// Left edge in percent of the page width.
    pub x_pct: f64,
    /// Top edge in percent of the page height.
    pub y_pct: f64,
    /// Optional width in percent of the page width.
    pub width_pct: Option<f64>,
    /// Font size in CSS pixels.
    pub font_size: Option<f64>,
    /// `normal` or `bold`.
    pub font_weight: String,
    /// Text colour as `#rrggbb`, empty for the template default.
    pub color: String,
    /// `left`, `center` or `right`.
    pub align: String,
}

/// Everything the preview dialog renders for one invoice.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InvoicePreview {
    /// The invoice itself, including the totals.
    pub invoice: InvoiceView,
    /// Template used for the preview and the next export.
    pub template_id: String,
    /// Name of that template.
    pub template_name: String,
    /// HTML body generated by the shared renderer.
    pub html: String,
    /// Whether the template paints stationery under the invoice.
    pub stationery_mode: bool,
    /// Stationery image or PDF path, or a `data:` URL.
    pub stationery_source: String,
    /// Stationery fields with their replaced values.
    pub tokens: Vec<InvoicePreviewToken>,
}

/// Export format of an invoice.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InvoiceExportFormat {
    /// DIN 5008 PDF.
    Pdf,
    /// Word package.
    Docx,
}

impl InvoiceExportFormat {
    /// Parses the wire name used by the export command.
    pub fn from_wire(value: &str) -> Option<Self> {
        match value.trim().to_ascii_lowercase().as_str() {
            "pdf" => Some(InvoiceExportFormat::Pdf),
            "docx" => Some(InvoiceExportFormat::Docx),
            _ => None,
        }
    }

    /// Wire name of the format.
    pub fn as_str(self) -> &'static str {
        match self {
            InvoiceExportFormat::Pdf => "pdf",
            InvoiceExportFormat::Docx => "docx",
        }
    }

    /// File extension of the format.
    pub fn extension(self) -> &'static str {
        match self {
            InvoiceExportFormat::Pdf => "pdf",
            InvoiceExportFormat::Docx => "docx",
        }
    }
}

/// A written invoice export.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct InvoiceExportReport {
    /// `pdf` or `docx`.
    pub format: String,
    /// Path of the written file.
    pub path: PathBuf,
    /// Size of the written file in bytes.
    pub bytes: u64,
}

/// Builds the view of one stored invoice and its contact.
/// Contact mail draft on the wire.
#[derive(Debug, Clone, Serialize)]
pub struct ContactMailView {
    /// Contact the draft belongs to.
    pub contact_id: Uuid,
    /// Mail address of the contact, empty without one.
    pub recipient: String,
    /// Display name used in the `To` header.
    pub recipient_name: String,
    /// Subject line.
    pub subject: String,
    /// Plain text body.
    pub body: String,
    /// Complete `.eml` draft.
    pub eml: String,
    /// Suggested file name.
    pub file_name: String,
    /// `mailto:` URL of the draft.
    pub mailto: String,
}

/// Options of the FatturaPA inspector.
#[derive(Debug, Clone, Default, serde::Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct FatturaInput {
    /// `TD01`, `TD04` or `TD24`.
    pub document_type: String,
    /// Fiscal regime, `RF01` by default.
    pub regime_fiscale: String,
    /// Recipient code, six characters for a public administration.
    pub recipient_code: String,
    /// Certified e-mail.
    pub pec: String,
    /// Two-euro stamp duty.
    pub bollo: bool,
    /// Tender reference CUP.
    pub cup: String,
    /// Tender reference CIG.
    pub cig: String,
}

/// Generated FatturaPA document on the wire.
#[derive(Debug, Clone, Serialize)]
pub struct InvoiceFatturaView {
    /// Complete XML document.
    pub xml: String,
    /// Standard SdI file name.
    pub file_name: String,
    /// Whether all required sections are present.
    pub valid: bool,
    /// Validation diagnostics.
    pub errors: Vec<String>,
    /// Invoice total in cents.
    pub total_cents: i64,
}

/// Builds the contact mail draft.
pub fn contact_mail_view(contact: &Contact, company: &CompanyProfile, now: i64) -> ContactMailView {
    let recipient = contact.email.clone().unwrap_or_default();
    let recipient_name = mail::contact_display_name(contact);
    let subject = mail::contact_subject(contact, company);
    let body = mail::contact_body(contact, company);
    ContactMailView {
        contact_id: contact.id,
        eml: mail::contact_eml(contact, company, now),
        file_name: mail::contact_eml_file_name(contact),
        mailto: mail::mailto_url(&recipient, &subject, &body),
        recipient,
        recipient_name,
        subject,
        body,
    }
}

/// Builds the FatturaPA document from an invoice.
pub fn fattura_view(
    invoice: &Invoice,
    contact: Option<&Contact>,
    company: &CompanyProfile,
    payment_method: Option<&str>,
    input: &FatturaInput,
) -> InvoiceFatturaView {
    let options = FatturaOptions {
        document_type: input.document_type.clone(),
        regime_fiscale: input.regime_fiscale.clone(),
        recipient_code: input.recipient_code.clone(),
        pec: input.pec.clone(),
        bollo: input.bollo,
        cup: input.cup.clone(),
        cig: input.cig.clone(),
    };
    let document = fattura::generate(invoice, company, contact, payment_method, &options);
    let errors = fattura::validate(&document.xml);
    InvoiceFatturaView {
        xml: document.xml,
        file_name: document.file_name,
        valid: errors.is_empty(),
        errors,
        total_cents: invoice.total_gross().cents(),
    }
}

/// Dunning letter of one invoice on the wire.
#[derive(Debug, Clone, Serialize)]
pub struct InvoiceDunningView {
    /// Number of the invoice.
    pub invoice_number: String,
    /// Level in its storage representation.
    pub level: String,
    /// Level number shown in the dialog.
    pub level_number: u8,
    /// Dunning fee in cents.
    pub fee_cents: i64,
    /// Default interest in cents.
    pub interest_cents: i64,
    /// Days until the new deadline.
    pub days: i64,
    /// New deadline as `YYYY-MM-DD`.
    pub deadline: String,
    /// Invoice total in cents.
    pub total_cents: i64,
    /// Claim including fee and interest.
    pub claim_cents: i64,
    /// Subject of the exported mail.
    pub subject: String,
    /// Letter body.
    pub body: String,
    /// Complete `.eml` draft.
    pub eml: String,
    /// Suggested file name.
    pub file_name: String,
}

/// Invoice mail draft on the wire.
#[derive(Debug, Clone, Serialize)]
pub struct InvoiceMailView {
    /// Number of the invoice.
    pub invoice_number: String,
    /// Mail address of the customer, empty without one.
    pub recipient: String,
    /// Subject line.
    pub subject: String,
    /// Plain text body.
    pub body: String,
    /// Complete `.eml` draft.
    pub eml: String,
    /// Suggested file name.
    pub file_name: String,
    /// `mailto:` URL of the draft.
    pub mailto: String,
}

/// Stored payment on the wire.
#[derive(Debug, Clone, Serialize)]
pub struct InvoicePaymentView {
    /// Invoice the payment belongs to.
    pub invoice_id: Uuid,
    /// When the money arrived.
    pub paid_at: i64,
    /// Method in its storage representation.
    pub method: String,
    /// Reference written to the books.
    pub reference: String,
    /// Cash-register signature, only for cash.
    pub tse_signature: Option<String>,
}

/// Builds the dunning letter of an invoice with the given overrides.
pub fn dunning_view(
    invoice: &Invoice,
    contact: Option<&Contact>,
    company: &CompanyProfile,
    level: DunningLevel,
    fee_cents: Option<i64>,
    days: Option<i64>,
    now: i64,
) -> InvoiceDunningView {
    let defaults = dunning::DunningLetter::new(level, invoice.total_gross(), now);
    let days = days.unwrap_or(defaults.days).max(0);
    let letter = dunning::DunningLetter {
        level,
        fee: fee_cents.map(Money::from_cents).unwrap_or(defaults.fee),
        interest: defaults.interest,
        days,
        deadline: now + days * dunning::DAY_MS,
    };
    let recipient = contact
        .and_then(|contact| contact.email.clone())
        .unwrap_or_default();
    let currency = &invoice.currency_symbol;
    InvoiceDunningView {
        invoice_number: invoice.number.clone(),
        level: level.as_str().to_string(),
        level_number: level.number(),
        fee_cents: letter.fee.cents(),
        interest_cents: letter.interest.cents(),
        days: letter.days,
        deadline: iso_date(letter.deadline),
        total_cents: invoice.total_gross().cents(),
        claim_cents: letter.total(invoice.total_gross()).cents(),
        subject: letter.subject(&invoice.number, &company.name),
        body: letter.body(
            &invoice.number,
            invoice.total_gross(),
            invoice.due_at,
            currency,
            company,
        ),
        eml: letter.eml(
            &recipient,
            &invoice.number,
            invoice.total_gross(),
            invoice.due_at,
            currency,
            company,
        ),
        file_name: letter.file_name(&invoice.number),
    }
}

/// Builds the invoice mail draft.
pub fn mail_view(
    invoice: &Invoice,
    contact: Option<&Contact>,
    company: &CompanyProfile,
) -> InvoiceMailView {
    let recipient = contact
        .and_then(|contact| contact.email.clone())
        .unwrap_or_default();
    let customer = contact.map(contact_label).unwrap_or_default();
    let subject = mail::invoice_subject(invoice, company);
    let body = mail::invoice_body(invoice, &customer, company);
    InvoiceMailView {
        invoice_number: invoice.number.clone(),
        eml: mail::invoice_eml(invoice, &customer, &recipient, company),
        file_name: mail::eml_file_name(&invoice.number),
        mailto: mail::mailto_url(&recipient, &subject, &body),
        recipient,
        subject,
        body,
    }
}

/// Builds the wire view of a stored payment.
pub fn payment_view(payment: &InvoicePayment) -> InvoicePaymentView {
    InvoicePaymentView {
        invoice_id: payment.invoice_id,
        paid_at: payment.paid_at,
        method: payment.method.as_str().to_string(),
        reference: payment.reference.clone(),
        tse_signature: payment.tse_signature.clone(),
    }
}

/// Display label of a contact, company first like the invoice list.
fn contact_label(contact: &Contact) -> String {
    if let Some(company) = contact
        .company_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return company.to_string();
    }
    if let Some(name) = contact
        .name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return name.to_string();
    }
    let full = format!(
        "{} {}",
        contact.first_name.as_deref().unwrap_or("").trim(),
        contact.last_name.as_deref().unwrap_or("").trim()
    );
    let full = full.trim();
    if full.is_empty() {
        "Kunde".to_string()
    } else {
        full.to_string()
    }
}

/// Builds the view of one stored invoice and its contact.
pub fn invoice_view(store: &Store, invoice: &Invoice) -> CoreResult<InvoiceView> {
    let contact = store.find_contact(invoice.contact_id)?;
    Ok(InvoiceView::from_invoice(invoice, contact.as_ref()))
}

/// Builds the views of many invoices with one contact query.
pub fn invoice_views(store: &Store, invoices: &[Invoice]) -> CoreResult<Vec<InvoiceView>> {
    let contacts: HashMap<Uuid, Contact> = store
        .list_contacts()?
        .into_iter()
        .map(|contact| (contact.id, contact))
        .collect();
    Ok(invoices
        .iter()
        .map(|invoice| InvoiceView::from_invoice(invoice, contacts.get(&invoice.contact_id)))
        .collect())
}

/// Suggests the next sequential invoice number of the current year (`2026-0001`).
pub fn suggest_number(invoices: &[Invoice], now: i64) -> String {
    let (year, _, _) = date::civil_from_millis(now);
    let prefix = format!("{year}-");
    let highest = invoices
        .iter()
        .filter_map(|invoice| invoice.number.strip_prefix(&prefix))
        .filter_map(|suffix| suffix.parse::<u32>().ok())
        .max()
        .unwrap_or(0);
    format!("{prefix}{:04}", highest + 1)
}

/// Parses the lifecycle state of the wire format, including the TypeScript name `posted`.
pub fn status_from_wire(value: &str) -> Option<InvoiceStatus> {
    match value.trim().to_ascii_lowercase().as_str() {
        "draft" => Some(InvoiceStatus::Draft),
        "sent" | "posted" => Some(InvoiceStatus::Sent),
        "paid" => Some(InvoiceStatus::Paid),
        "overdue" => Some(InvoiceStatus::Overdue),
        "cancelled" | "canceled" => Some(InvoiceStatus::Cancelled),
        _ => None,
    }
}

/// Formats a timestamp as `YYYY-MM-DD`.
pub fn iso_date(ms: i64) -> String {
    let (year, month, day) = date::civil_from_millis(ms);
    format!("{year:04}-{month:02}-{day:02}")
}

/// Parses a `YYYY-MM-DD` date at midnight UTC.
pub fn parse_iso_date(text: &str) -> Option<i64> {
    let mut parts = text.trim().split('-');
    let year: i64 = parts.next()?.parse().ok()?;
    let month: u32 = parts.next()?.parse().ok()?;
    let day: u32 = parts.next()?.parse().ok()?;
    if parts.next().is_some()
        || year < 1900
        || !(1..=12).contains(&month)
        || !(1..=31).contains(&day)
    {
        return None;
    }
    let ms = date::days_from_civil(year, month, day) * DAY_MS;
    let roundtrip = date::civil_from_millis(ms);
    if roundtrip != (year, month, day) {
        return None;
    }
    Some(ms)
}

/// Chooses the template of a preview or export: the requested one, else the active one.
pub fn resolve_template(book: &TemplateBook, template_id: Option<&str>) -> InvoiceTemplate {
    if let Some(id) = template_id.map(str::trim).filter(|id| !id.is_empty()) {
        if let Some(template) = book.templates.iter().find(|template| template.id == id) {
            return template.clone();
        }
    }
    book.active()
        .cloned()
        .unwrap_or_else(invoice_template::default_template)
}

/// Resolves the stationery fields of a template for the preview.
pub fn preview_tokens(
    template: &InvoiceTemplate,
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
    currency: &str,
) -> Vec<InvoicePreviewToken> {
    template
        .stationery_token_texts(invoice, contact, company, currency)
        .into_iter()
        .map(|(token, text)| InvoicePreviewToken {
            key: token.token_key,
            text,
            x_pct: token.x_pct,
            y_pct: token.y_pct,
            width_pct: token.width_pct,
            font_size: token.font_size,
            font_weight: token.font_weight,
            color: token.color,
            align: token.align,
        })
        .collect()
}

/// Writes an invoice with the selected template and reports the written file.
pub fn write_invoice_export(
    store: &Store,
    invoice: &Invoice,
    template: &InvoiceTemplate,
    format: InvoiceExportFormat,
    path: &Path,
) -> CoreResult<InvoiceExportReport> {
    let contact = store
        .find_contact(invoice.contact_id)?
        .ok_or_else(|| CoreError::NotFound(invoice.contact_id.to_string()))?;
    let company = store.company_profile()?;

    match format {
        InvoiceExportFormat::Pdf => {
            let layout = document_layout::load(store)?;
            din5008::write_invoice_pdf_with_layout_and_template(
                path, invoice, &contact, &company, &layout, template,
            )?;
        }
        InvoiceExportFormat::Docx => {
            docx::write_invoice_docx_with_template(path, invoice, &contact, &company, template)?;
        }
    }

    Ok(InvoiceExportReport {
        format: format.as_str().to_string(),
        path: path.to_path_buf(),
        bytes: std::fs::metadata(path)?.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_typescript_status_names() {
        assert_eq!(status_from_wire("posted"), Some(InvoiceStatus::Sent));
        assert_eq!(status_from_wire("sent"), Some(InvoiceStatus::Sent));
        assert_eq!(status_from_wire("draft"), Some(InvoiceStatus::Draft));
        assert_eq!(status_from_wire("unknown"), None);
    }

    #[test]
    fn parses_and_formats_iso_dates() {
        let ms = parse_iso_date("2026-02-28").expect("date");
        assert_eq!(iso_date(ms), "2026-02-28");
        assert_eq!(parse_iso_date("2026-02-30"), None);
        assert_eq!(parse_iso_date("28.02.2026"), None);
    }

    #[test]
    fn rejects_due_dates_before_the_issue_date() {
        let input = InvoiceInput {
            number: "2026-0001".to_string(),
            date: "2026-03-01".to_string(),
            due_date: "2026-02-01".to_string(),
            items: vec![InvoiceItemInput {
                description: "Beratung".to_string(),
                ..InvoiceItemInput::default()
            }],
            ..InvoiceInput::default()
        };
        assert!(matches!(
            input.to_invoice(None, &CompanyProfile::default()),
            Err(CoreError::Validation(code)) if code == "invoice_due_before_issued"
        ));
    }
}
