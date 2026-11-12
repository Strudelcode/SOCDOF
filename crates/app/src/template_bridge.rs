//! TypeScript-compatible wire format of the invoice template book.
//!
//! The TypeScript editor (`invoiceTemplateManager.ts` / `InvoiceTemplateModal.tsx`) keeps flat
//! company fields (`companyName`, `companyAddress`, …), camelCase names and a separate
//! `stationeryImageUrl` / `stationeryPdfUrl` pair. The Rust core keeps one nested `TemplateCompany`,
//! snake_case field names and one `stationery_source`. This module is the single translation layer
//! between both:
//!
//! * every core field is exposed under the exact TypeScript name, so the webview form and a
//!   TypeScript export mean the same thing;
//! * fields the TypeScript model has and the core did not need before (`presetType`,
//!   `fontFamily`, `createdAt`, `isDefault`) are carried through instead of being dropped;
//! * the stationery split follows the TypeScript renderer, which paints
//!   `stationeryImageUrl || stationeryPdfUrl`, so an image always wins on the way in and a PDF
//!   source is reported as `stationeryPdfUrl` on the way out;
//! * unknown fields are rejected instead of being ignored silently.
//!
//! Only this module knows the wire names. The core model, the stored settings JSON and the render
//! paths stay unchanged apart from the four newly stored fields.

use serde::{Deserialize, Serialize};

use socdof_core::invoice_template::{
    InvoiceTemplate, StationeryToken, TemplateBook, TemplateCompany,
};

/// One invoice template in the TypeScript field format.
///
/// Missing fields fall back to the TypeScript defaults, so a payload written by an older editor
/// still produces a usable template. `id`, `name` and `headerTitle` keep sane defaults but are
/// still validated by the core; a book without templates is rejected instead of being replaced by
/// the factory templates.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct InvoiceTemplateView {
    /// Stable identifier.
    pub id: String,
    /// Name shown in the template picker.
    pub name: String,
    /// Short description of the intended use.
    pub description: String,
    /// TypeScript preset family (`din_5008`, `modern`, `corporate`, `creative`, `praxis`, `custom`).
    pub preset_type: String,
    /// Whether the TypeScript book marks this template as its factory default.
    pub is_default: bool,
    /// Logo path or `data:` URL.
    pub logo_url: String,
    /// Whether the logo is printed.
    pub show_logo: bool,
    /// Logo alignment: `left`, `center` or `right`.
    pub logo_position: String,
    /// Company name of this template.
    pub company_name: String,
    /// Company subtitle of this template.
    pub company_subtitle: String,
    /// Managing director or owner.
    pub company_owner: String,
    /// Street and house number; the TypeScript `companyAddress`.
    pub company_address: String,
    /// Postal code and city.
    pub company_zip_city: String,
    /// Phone number.
    pub company_phone: String,
    /// Contact email.
    pub company_email: String,
    /// Website.
    pub company_website: String,
    /// Tax number.
    pub company_tax_id: String,
    /// VAT id.
    pub company_vat_id: String,
    /// Bank name.
    pub company_bank_name: String,
    /// IBAN.
    pub company_iban: String,
    /// BIC.
    pub company_bic: String,
    /// Commercial register entry.
    pub company_commercial_register: String,
    /// Accent color as `#rrggbb`.
    pub primary_color: String,
    /// Font family of the rendered HTML: `sans`, `serif` or `mono`.
    pub font_family: String,
    /// Document title printed above the subject.
    pub header_title: String,
    /// Introductory text used when the invoice has no note.
    pub header_text: String,
    /// Payment or closing text below the totals.
    pub footer_text: String,
    /// Legal tax note printed in the footer.
    pub tax_note: String,
    /// Payment term in days.
    pub due_days: i64,
    /// Whether the custom HTML body replaces the built-in layout.
    pub use_custom_layout: bool,
    /// Free HTML body with `{Placeholder}` variables.
    pub custom_body_template: String,
    /// Whether the DIN 5008 fold and hole marks are printed.
    pub show_fold_marks: bool,
    /// Whether stationery is painted under the invoice.
    pub stationery_mode: bool,
    /// Stationery PDF path or `data:` URL.
    pub stationery_pdf_url: String,
    /// Stationery image path or `data:` URL.
    pub stationery_image_url: String,
    /// Absolute text fields placed on the stationery page.
    pub stationery_tokens: Vec<StationeryToken>,
    /// Creation timestamp of the TypeScript editor.
    pub created_at: String,
}

impl Default for InvoiceTemplateView {
    /// TypeScript defaults of a fresh template, used for every missing field.
    fn default() -> Self {
        InvoiceTemplateView {
            id: String::new(),
            name: String::new(),
            description: String::new(),
            preset_type: "custom".to_string(),
            is_default: false,
            logo_url: String::new(),
            show_logo: true,
            logo_position: "right".to_string(),
            company_name: String::new(),
            company_subtitle: String::new(),
            company_owner: String::new(),
            company_address: String::new(),
            company_zip_city: String::new(),
            company_phone: String::new(),
            company_email: String::new(),
            company_website: String::new(),
            company_tax_id: String::new(),
            company_vat_id: String::new(),
            company_bank_name: String::new(),
            company_iban: String::new(),
            company_bic: String::new(),
            company_commercial_register: String::new(),
            primary_color: "#2563eb".to_string(),
            font_family: "sans".to_string(),
            header_title: "Rechnung".to_string(),
            header_text: String::new(),
            footer_text: String::new(),
            tax_note: String::new(),
            due_days: 14,
            use_custom_layout: false,
            custom_body_template: String::new(),
            show_fold_marks: true,
            stationery_mode: false,
            stationery_pdf_url: String::new(),
            stationery_image_url: String::new(),
            stationery_tokens: Vec::new(),
            created_at: String::new(),
        }
    }
}

impl InvoiceTemplateView {
    /// Builds the wire form of a core template without dropping a field.
    pub fn from_template(template: &InvoiceTemplate) -> Self {
        let (stationery_pdf_url, stationery_image_url) =
            split_stationery_source(&template.stationery_source);
        InvoiceTemplateView {
            id: template.id.clone(),
            name: template.name.clone(),
            description: template.description.clone(),
            preset_type: template.preset_type.clone(),
            is_default: template.is_default,
            logo_url: template.logo.clone(),
            show_logo: template.show_logo,
            logo_position: template.logo_position.clone(),
            company_name: template.company.name.clone(),
            company_subtitle: template.company.subtitle.clone(),
            company_owner: template.company.owner.clone(),
            company_address: template.company.street.clone(),
            company_zip_city: template.company.zip_city.clone(),
            company_phone: template.company.phone.clone(),
            company_email: template.company.email.clone(),
            company_website: template.company.website.clone(),
            company_tax_id: template.company.tax_id.clone(),
            company_vat_id: template.company.vat_id.clone(),
            company_bank_name: template.company.bank_name.clone(),
            company_iban: template.company.iban.clone(),
            company_bic: template.company.bic.clone(),
            company_commercial_register: template.company.commercial_register.clone(),
            primary_color: template.primary_color.clone(),
            font_family: template.font_family.clone(),
            header_title: template.header_title.clone(),
            header_text: template.header_text.clone(),
            footer_text: template.footer_text.clone(),
            tax_note: template.tax_note.clone(),
            due_days: template.due_days,
            use_custom_layout: template.use_custom_layout,
            custom_body_template: template.custom_body_template.clone(),
            show_fold_marks: template.show_fold_marks,
            stationery_mode: template.stationery_mode,
            stationery_pdf_url,
            stationery_image_url,
            stationery_tokens: template.stationery_tokens.clone(),
            created_at: template.created_at.clone(),
        }
    }

    /// Core template of this wire form, with every TypeScript field mapped back.
    pub fn to_template(&self) -> InvoiceTemplate {
        InvoiceTemplate {
            id: self.id.clone(),
            name: self.name.clone(),
            description: self.description.clone(),
            preset_type: self.preset_type.clone(),
            header_title: self.header_title.clone(),
            header_text: self.header_text.clone(),
            footer_text: self.footer_text.clone(),
            tax_note: self.tax_note.clone(),
            primary_color: self.primary_color.clone(),
            font_family: self.font_family.clone(),
            due_days: self.due_days,
            show_fold_marks: self.show_fold_marks,
            logo: self.logo_url.clone(),
            show_logo: self.show_logo,
            logo_position: self.logo_position.clone(),
            company: TemplateCompany {
                name: self.company_name.clone(),
                subtitle: self.company_subtitle.clone(),
                owner: self.company_owner.clone(),
                street: self.company_address.clone(),
                zip_city: self.company_zip_city.clone(),
                phone: self.company_phone.clone(),
                email: self.company_email.clone(),
                website: self.company_website.clone(),
                tax_id: self.company_tax_id.clone(),
                vat_id: self.company_vat_id.clone(),
                bank_name: self.company_bank_name.clone(),
                iban: self.company_iban.clone(),
                bic: self.company_bic.clone(),
                commercial_register: self.company_commercial_register.clone(),
            },
            use_custom_layout: self.use_custom_layout,
            custom_body_template: self.custom_body_template.clone(),
            stationery_mode: self.stationery_mode,
            stationery_source: self.stationery_source(),
            stationery_tokens: self.stationery_tokens.clone(),
            created_at: self.created_at.clone(),
            is_default: self.is_default,
        }
    }

    /// Single stationery source of the two TypeScript inputs.
    ///
    /// The TypeScript renderer paints `stationeryImageUrl || stationeryPdfUrl`, so a filled image
    /// field wins and the PDF field is only read when no image is set.
    pub fn stationery_source(&self) -> String {
        let image = self.stationery_image_url.trim();
        if !image.is_empty() {
            return image.to_string();
        }
        self.stationery_pdf_url.trim().to_string()
    }
}

impl From<&InvoiceTemplate> for InvoiceTemplateView {
    fn from(template: &InvoiceTemplate) -> Self {
        InvoiceTemplateView::from_template(template)
    }
}

impl From<&InvoiceTemplateView> for InvoiceTemplate {
    fn from(view: &InvoiceTemplateView) -> Self {
        view.to_template()
    }
}

/// Splits the stored stationery source into the two TypeScript fields.
///
/// A PDF (by data-URL MIME type, `%PDF` signature or `.pdf` name) is reported as
/// `stationeryPdfUrl`; everything else is an image. An empty source fills neither field.
fn split_stationery_source(source: &str) -> (String, String) {
    let source = source.trim();
    if source.is_empty() {
        return (String::new(), String::new());
    }
    if is_pdf_source(source) {
        (source.to_string(), String::new())
    } else {
        (String::new(), source.to_string())
    }
}

/// Whether `source` names PDF content rather than an image.
fn is_pdf_source(source: &str) -> bool {
    let lower = source.to_ascii_lowercase();
    lower.starts_with("data:application/pdf")
        || lower.starts_with("%pdf-")
        || lower.ends_with(".pdf")
}

/// All templates plus the active selection, in the TypeScript field format.
///
/// The TypeScript app stores the templates and the active id under two local-storage keys; the
/// Rust book keeps both in one validated settings value and exposes them together here.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct InvoiceTemplateBookView {
    /// Templates in display order.
    pub templates: Vec<InvoiceTemplateView>,
    /// Id of the template used for printing.
    pub active_id: String,
}

impl Default for InvoiceTemplateBookView {
    /// Empty book, so a payload without templates fails validation instead of silently
    /// replacing the stored templates with the factory set.
    fn default() -> Self {
        InvoiceTemplateBookView {
            templates: Vec::new(),
            active_id: String::new(),
        }
    }
}

impl InvoiceTemplateBookView {
    /// Wire form of a stored book.
    pub fn from_book(book: &TemplateBook) -> Self {
        InvoiceTemplateBookView {
            templates: book
                .templates
                .iter()
                .map(InvoiceTemplateView::from_template)
                .collect(),
            active_id: book.active_id.clone(),
        }
    }

    /// Core book of this wire form; the caller validates it before storing.
    pub fn to_book(&self) -> TemplateBook {
        TemplateBook {
            templates: self
                .templates
                .iter()
                .map(InvoiceTemplateView::to_template)
                .collect(),
            active_id: self.active_id.clone(),
        }
    }
}

impl From<&TemplateBook> for InvoiceTemplateBookView {
    fn from(book: &TemplateBook) -> Self {
        InvoiceTemplateBookView::from_book(book)
    }
}

impl From<&InvoiceTemplateBookView> for TemplateBook {
    fn from(view: &InvoiceTemplateBookView) -> Self {
        view.to_book()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_book_maps_the_factory_templates() {
        let book = TemplateBook::default();
        let view = InvoiceTemplateBookView::from_book(&book);
        assert_eq!(view.templates.len(), book.templates.len());
        assert_eq!(view.active_id, book.active_id);
        assert_eq!(view.to_book(), book);
    }

    #[test]
    fn stationery_split_follows_the_typescript_precedence() {
        let mut view = InvoiceTemplateView {
            stationery_pdf_url: "data:application/pdf;base64,AAA".to_string(),
            ..InvoiceTemplateView::default()
        };
        assert_eq!(view.stationery_source(), "data:application/pdf;base64,AAA");
        view.stationery_image_url = "data:image/png;base64,BBB".to_string();
        assert_eq!(view.stationery_source(), "data:image/png;base64,BBB");

        let template = InvoiceTemplate {
            stationery_source: "/tmp/briefpapier.pdf".to_string(),
            ..InvoiceTemplate::default()
        };
        let split = InvoiceTemplateView::from_template(&template);
        assert_eq!(split.stationery_pdf_url, "/tmp/briefpapier.pdf");
        assert_eq!(split.stationery_image_url, "");
        assert_eq!(
            split.to_template().stationery_source,
            "/tmp/briefpapier.pdf"
        );
    }
}
