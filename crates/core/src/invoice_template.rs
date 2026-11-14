//! Invoice print templates and their persisted selection.
//!
//! The shipped TypeScript application edits invoice layouts in `invoiceTemplateManager.ts` and keeps
//! the active template in local storage. The Rust application keeps the same information in the
//! settings table: a validated book of templates plus the active id. The PDF renderer reads the
//! header, footer, accent and fold-mark settings from the active template, so printing never uses a
//! hidden default while the screen shows another one.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::date;
use crate::domain::contact::Contact;
use crate::domain::invoice::{Invoice, InvoiceStatus};
use crate::domain::settings::CompanyProfile;
use crate::error::{CoreError, CoreResult};
use crate::pdf::vector::VectorBackground;
use crate::pdf::writer::{mm, text_width, BackgroundImage};
use crate::rich_html::{self, RichDocument};
use crate::store::Store;

/// Settings key of the whole template book.
pub const TEMPLATES_SETTING_KEY: &str = "invoice_templates";

/// Stable id of the classic DIN 5008 template.
pub const DEFAULT_TEMPLATE_ID: &str = "din_5008_classic";

/// Company values printed by one template, overriding the global profile when filled.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct TemplateCompany {
    /// Company name.
    pub name: String,
    /// Subtitle or business description.
    pub subtitle: String,
    /// Managing director or owner.
    pub owner: String,
    /// Street and house number.
    pub street: String,
    /// Postal code and city.
    pub zip_city: String,
    /// Phone number.
    pub phone: String,
    /// Contact email.
    pub email: String,
    /// Website.
    pub website: String,
    /// Tax number.
    pub tax_id: String,
    /// VAT id.
    pub vat_id: String,
    /// Bank name.
    pub bank_name: String,
    /// IBAN.
    pub iban: String,
    /// BIC.
    pub bic: String,
    /// Commercial register entry.
    pub commercial_register: String,
}

impl TemplateCompany {
    /// Whether every field is empty.
    pub fn is_empty(&self) -> bool {
        self.name.trim().is_empty()
            && self.subtitle.trim().is_empty()
            && self.owner.trim().is_empty()
            && self.street.trim().is_empty()
            && self.zip_city.trim().is_empty()
            && self.phone.trim().is_empty()
            && self.email.trim().is_empty()
            && self.website.trim().is_empty()
            && self.tax_id.trim().is_empty()
            && self.vat_id.trim().is_empty()
            && self.bank_name.trim().is_empty()
            && self.iban.trim().is_empty()
            && self.bic.trim().is_empty()
            && self.commercial_register.trim().is_empty()
    }

    /// Global profile with every non-empty template value applied.
    pub fn apply(&self, base: &CompanyProfile) -> CompanyProfile {
        let mut profile = base.clone();
        for (target, value) in [
            (&mut profile.name, &self.name),
            (&mut profile.street, &self.street),
            (&mut profile.zip_city, &self.zip_city),
            (&mut profile.phone, &self.phone),
            (&mut profile.email, &self.email),
            (&mut profile.tax_id, &self.tax_id),
            (&mut profile.bank_name, &self.bank_name),
            (&mut profile.iban, &self.iban),
            (&mut profile.bic, &self.bic),
        ] {
            if !value.trim().is_empty() {
                *target = value.clone();
            }
        }
        profile
    }
}

/// One absolute text field placed on the stationery page.
///
/// The field names match the TypeScript `StationeryTokenField`, so a template keeps its tokens when
/// it moves between the two applications: positions are percentages of the A4 page, the font size is
/// in CSS pixels, and there is no opacity or repeat flag — the TypeScript page has neither.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct StationeryToken {
    /// Stable identifier, only used by the editor.
    pub id: String,
    /// Invoice variable such as `{Rechnungsnummer}`.
    pub token_key: String,
    /// Left edge in percent of the page width.
    pub x_pct: f64,
    /// Top edge in percent of the page height, measured from the top edge.
    pub y_pct: f64,
    /// Optional width in percent of the page width.
    pub width_pct: Option<f64>,
    /// Font size in CSS pixels.
    pub font_size: Option<f64>,
    /// `normal` or `bold`.
    pub font_weight: String,
    /// Text colour as `#rrggbb`.
    pub color: String,
    /// `left`, `center` or `right`.
    pub align: String,
}

impl Default for StationeryToken {
    fn default() -> Self {
        StationeryToken {
            id: String::new(),
            token_key: String::new(),
            x_pct: 0.0,
            y_pct: 0.0,
            width_pct: None,
            font_size: None,
            font_weight: String::new(),
            color: String::new(),
            align: String::new(),
        }
    }
}

impl StationeryToken {
    /// Font size in CSS pixels, 13 px like the TypeScript default.
    pub fn font_size_px(&self) -> f64 {
        self.font_size
            .filter(|size| *size > 0.0 && size.is_finite())
            .unwrap_or(13.0)
    }

    /// Whether the field prints in bold; every other weight is regular.
    pub fn bold(&self) -> bool {
        self.font_weight.eq_ignore_ascii_case("bold")
    }

    /// Text colour as RGB components, `#0f172a` like the TypeScript default.
    pub fn color_rgb(&self) -> [f64; 3] {
        parse_hex_color(&self.color).unwrap_or([15.0 / 255.0, 23.0 / 255.0, 42.0 / 255.0])
    }

    /// Horizontal alignment inside the field width; unknown values print left.
    pub fn alignment(&self) -> &'static str {
        match self.align.to_ascii_lowercase().as_str() {
            "center" => "center",
            "right" => "right",
            _ => "left",
        }
    }

    /// Left edge in percent, clamped to the page for values outside 0–100.
    pub fn x_percent(&self) -> f64 {
        clamp_percent(self.x_pct)
    }

    /// Top edge in percent, clamped to the page for values outside 0–100.
    pub fn y_percent(&self) -> f64 {
        clamp_percent(self.y_pct)
    }

    /// Width in percent, absent for a shrink-to-fit field.
    pub fn width_percent(&self) -> Option<f64> {
        self.width_pct
            .filter(|width| *width > 0.0 && width.is_finite())
            .map(clamp_percent)
    }
}

fn clamp_percent(value: f64) -> f64 {
    if value.is_finite() {
        value.clamp(0.0, 100.0)
    } else {
        0.0
    }
}

/// One laid-out line of a stationery token, in the PDF export's page coordinates.
#[derive(Debug, Clone, PartialEq)]
pub struct StationeryTextLine {
    /// Text of the line.
    pub text: String,
    /// Left edge in PDF points from the left page edge.
    pub x_pt: f64,
    /// Top edge in millimetres from the top page edge.
    pub top_mm: f64,
    /// Baseline in millimetres from the top page edge.
    pub baseline_mm: f64,
    /// Advance width in PDF points, using the export's Helvetica approximation.
    pub width_pt: f64,
}

/// Complete line layout of one stationery token.
#[derive(Debug, Clone, PartialEq)]
pub struct StationeryTextLayout {
    /// Font size in PDF points (`fontSize` CSS pixels × 0.75).
    pub font_size_pt: f64,
    /// Left anchor of the field in PDF points.
    pub anchor_pt: f64,
    /// Fixed field width in PDF points; `None` for shrink-to-fit.
    pub field_width_pt: Option<f64>,
    /// Vertical distance between line tops in millimetres (line height 1.4).
    pub line_height_mm: f64,
    /// Lines in drawing order; empty lines keep their vertical slot.
    pub lines: Vec<StationeryTextLine>,
}

/// Lays out a resolved stationery token exactly like the PDF export.
///
/// Line breaks and per-line offsets come from the shared Helvetica advance approximation used by
/// the PDF writer, not from the UI font. The template preview draws these same lines, so long
/// values break at the same positions and advance with the same line offsets in both places.
/// Percentages are clamped to the page through the token accessors.
pub fn layout_stationery_token(token: &StationeryToken, text: &str) -> StationeryTextLayout {
    const PAGE_WIDTH_MM: f64 = 210.0;
    const PAGE_HEIGHT_MM: f64 = 297.0;
    let font_px = token.font_size_px();
    let font_size_pt = font_px * 0.75;
    let anchor_pt = mm(PAGE_WIDTH_MM * token.x_percent() / 100.0);
    let field_width_pt = token
        .width_percent()
        .map(|percent| mm(PAGE_WIDTH_MM * percent / 100.0));
    let texts = match field_width_pt {
        Some(width) => wrap_stationery_text(text, width, font_size_pt),
        None => text.lines().map(str::to_string).collect(),
    };
    let line_height_mm = font_px * 0.264_583 * 1.4;
    let mut top_mm = PAGE_HEIGHT_MM * token.y_percent() / 100.0;
    let mut lines = Vec::with_capacity(texts.len());
    for text in texts {
        let width_pt = text_width(&text, font_size_pt);
        let x_pt = match (field_width_pt, token.alignment()) {
            (Some(width), "right") => anchor_pt + width - width_pt,
            (Some(width), "center") => anchor_pt + (width - width_pt) / 2.0,
            _ => anchor_pt,
        };
        let baseline_mm = top_mm + font_px * 0.264_583;
        lines.push(StationeryTextLine {
            text,
            x_pt,
            top_mm,
            baseline_mm,
            width_pt,
        });
        top_mm += line_height_mm;
    }
    StationeryTextLayout {
        font_size_pt,
        anchor_pt,
        field_width_pt,
        line_height_mm,
        lines,
    }
}

/// Wraps one token value at word boundaries using the PDF's Helvetica advance widths.
fn wrap_stationery_text(text: &str, width: f64, size: f64) -> Vec<String> {
    let mut lines = Vec::new();
    for line in text.lines() {
        let mut current = String::new();
        for word in line.split_whitespace() {
            let candidate = if current.is_empty() {
                word.to_string()
            } else {
                format!("{current} {word}")
            };
            if text_width(&candidate, size) <= width || current.is_empty() {
                current = candidate;
            } else {
                lines.push(current);
                current = word.to_string();
            }
        }
        lines.push(current);
    }
    lines
}

/// Token keys offered by the TypeScript stationery editor, in its order.
///
/// Keeping the list in the core means the editor dropdown and the export resolve the same keys.
pub const STATIONERY_TOKEN_KEYS: &[&str] = &[
    "{Rechnung}",
    "{Rechnungsnummer}",
    "{Datum}",
    "{Faelligkeitsdatum}",
    "{Zahlungsziel_Tage}",
    "{Status}",
    "{Waehrung}",
    "{Kunde_Name}",
    "{Kunde_Firma}",
    "{Kunde_Adresse}",
    "{Kunde_PLZ_Ort}",
    "{Kunde_Email}",
    "{Kunde_Telefon}",
    "{Kunde_UStId}",
    "{Netto}",
    "{Ust_Satz}",
    "{Ust_Betrag}",
    "{Gesamtbetrag}",
    "{Steuerhinweis}",
    "{Positionen_Tabelle}",
    "{Firma_Name}",
    "{Firma_Zusatz}",
    "{Firma_Inhaber}",
    "{Firma_Adresse}",
    "{Firma_PLZ_Ort}",
    "{Firma_Telefon}",
    "{Firma_Email}",
    "{Firma_Website}",
    "{Firma_Steuernummer}",
    "{Firma_UStId}",
    "{Firma_IBAN}",
    "{Firma_BIC}",
    "{Firma_Bank}",
    "{Firma_Handelsregister}",
];

/// New field with the TypeScript `handleAddStationeryToken` defaults.
pub fn new_stationery_token(
    id: impl Into<String>,
    token_key: impl Into<String>,
) -> StationeryToken {
    StationeryToken {
        id: id.into(),
        token_key: token_key.into(),
        x_pct: 15.0,
        y_pct: 35.0,
        width_pct: None,
        font_size: Some(13.0),
        font_weight: "normal".to_string(),
        color: String::new(),
        align: "left".to_string(),
    }
}

/// Fields placed by the TypeScript "Standardfelder" button.
pub fn default_stationery_tokens() -> Vec<StationeryToken> {
    [
        (
            "tok_num",
            "{Rechnungsnummer}",
            65.0,
            22.0,
            None,
            14.0,
            "bold",
            "right",
        ),
        (
            "tok_date", "{Datum}", 65.0, 26.0, None, 12.0, "normal", "right",
        ),
        (
            "tok_cust_name",
            "{Kunde_Name}",
            12.0,
            24.0,
            None,
            13.0,
            "bold",
            "left",
        ),
        (
            "tok_cust_addr",
            "{Kunde_Adresse}",
            12.0,
            27.0,
            None,
            12.0,
            "normal",
            "left",
        ),
        (
            "tok_cust_city",
            "{Kunde_PLZ_Ort}",
            12.0,
            30.0,
            None,
            12.0,
            "normal",
            "left",
        ),
        (
            "tok_table",
            "{Positionen_Tabelle}",
            10.0,
            38.0,
            Some(80.0),
            12.0,
            "normal",
            "left",
        ),
        (
            "tok_total",
            "{Gesamtbetrag}",
            65.0,
            82.0,
            None,
            16.0,
            "bold",
            "right",
        ),
    ]
    .into_iter()
    .map(
        |(id, key, x, y, width, size, weight, align)| StationeryToken {
            id: id.to_string(),
            token_key: key.to_string(),
            x_pct: x,
            y_pct: y,
            width_pct: width,
            font_size: Some(size),
            font_weight: weight.to_string(),
            color: String::new(),
            align: align.to_string(),
        },
    )
    .collect()
}

/// One editable invoice print template.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct InvoiceTemplate {
    /// Stable identifier.
    pub id: String,
    /// Name shown in the template picker.
    pub name: String,
    /// Short description of the intended use.
    pub description: String,
    /// TypeScript preset family: `din_5008`, `modern`, `corporate`, `creative`, `praxis` or `custom`.
    pub preset_type: String,
    /// Document title printed above the subject.
    pub header_title: String,
    /// Introductory text used when the invoice has no note.
    pub header_text: String,
    /// Payment or closing text below the totals.
    pub footer_text: String,
    /// Legal tax note printed in the footer.
    pub tax_note: String,
    /// Accent color as `#rrggbb`.
    pub primary_color: String,
    /// TypeScript font family of the rendered HTML: `sans`, `serif` or `mono`.
    pub font_family: String,
    /// Payment term used by new invoices created with this template.
    pub due_days: i64,
    /// Whether the DIN 5008 fold and hole marks are printed.
    pub show_fold_marks: bool,
    /// Logo path or `data:image/png;base64,...` source.
    pub logo: String,
    /// Whether the logo is printed.
    pub show_logo: bool,
    /// Logo alignment: `left`, `center` or `right`.
    pub logo_position: String,
    /// Company values of this template, empty fields fall back to the profile.
    pub company: TemplateCompany,
    /// Whether the custom HTML body replaces the built-in layout.
    pub use_custom_layout: bool,
    /// Free HTML body with `{Placeholder}` variables.
    pub custom_body_template: String,
    /// Whether stationery is painted under the invoice.
    pub stationery_mode: bool,
    /// Stationery image or PDF path, or a `data:` URL.
    pub stationery_source: String,
    /// Absolute text fields placed on the stationery page, empty for templates without tokens.
    #[serde(rename = "stationeryTokens")]
    pub stationery_tokens: Vec<StationeryToken>,
    /// Creation timestamp of the TypeScript editor, kept so a bridge round trip loses nothing.
    pub created_at: String,
    /// Whether the TypeScript book marks this template as its factory default.
    pub is_default: bool,
}

impl Default for InvoiceTemplate {
    fn default() -> Self {
        default_template()
    }
}

impl InvoiceTemplate {
    /// Validates the values before they are stored or printed.
    pub fn validate(&self) -> Result<(), String> {
        if self.id.trim().is_empty() {
            return Err("template_id_required".to_string());
        }
        if self.name.trim().is_empty() {
            return Err("template_name_required".to_string());
        }
        if self.header_title.trim().is_empty() {
            return Err("template_header_required".to_string());
        }
        if parse_hex_color(&self.primary_color).is_none() {
            return Err("template_color_invalid".to_string());
        }
        if !(0..=365).contains(&self.due_days) {
            return Err("template_due_days_invalid".to_string());
        }
        if !matches!(self.logo_position.as_str(), "left" | "center" | "right") {
            return Err("template_logo_position_invalid".to_string());
        }
        if self.logo.chars().count() > 16_000_000
            || self.stationery_source.chars().count() > 32_000_000
        {
            return Err("template_asset_too_large".to_string());
        }
        if self.custom_body_template.chars().count() > 200_000 {
            return Err("template_text_too_long".to_string());
        }
        if self.stationery_tokens.len() > 200 {
            return Err("template_tokens_too_many".to_string());
        }
        for token in &self.stationery_tokens {
            if !token.x_pct.is_finite()
                || !token.y_pct.is_finite()
                || !token.width_pct.map(f64::is_finite).unwrap_or(true)
                || !token.font_size.map(f64::is_finite).unwrap_or(true)
                || token.token_key.chars().count() > 120
            {
                return Err("template_token_invalid".to_string());
            }
        }
        for value in [
            &self.name,
            &self.description,
            &self.header_title,
            &self.header_text,
            &self.footer_text,
            &self.tax_note,
        ] {
            if value.chars().count() > 2_000 {
                return Err("template_text_too_long".to_string());
            }
        }
        Ok(())
    }

    /// CSS font stack of the TypeScript `fontFamily` value.
    ///
    /// `serif` and `mono` use the TypeScript stacks. Every other, missing or unknown value keeps
    /// the sans stack the built-in layout always used, so existing templates render unchanged.
    pub fn font_stack(&self) -> &'static str {
        match self.font_family.trim().to_ascii_lowercase().as_str() {
            "serif" => "Georgia, Cambria, \"Times New Roman\", Times, serif",
            "mono" => "\"JetBrains Mono\", Consolas, \"Courier New\", Courier, monospace",
            _ => "Helvetica, Arial, sans-serif",
        }
    }

    /// Accent color as normalized RGB components.
    pub fn color(&self) -> [f64; 3] {
        parse_hex_color(&self.primary_color).unwrap_or([0.0, 0.0, 0.0])
    }

    /// Global company profile with this template's overrides applied.
    pub fn effective_company(&self, company: &CompanyProfile) -> CompanyProfile {
        self.company.apply(company)
    }

    /// Decoded logo, when the template shows one and the asset can be read.
    pub fn logo_image(&self) -> Option<BackgroundImage> {
        if !self.show_logo || self.logo.trim().is_empty() {
            return None;
        }
        let bytes = asset_bytes(&self.logo)?;
        BackgroundImage::from_stationery_bytes(&bytes).ok()
    }

    /// Decoded raster stationery background, when stationery mode is enabled.
    pub fn stationery_image(&self) -> Option<BackgroundImage> {
        if !self.stationery_mode || self.stationery_source.trim().is_empty() {
            return None;
        }
        let bytes = asset_bytes(&self.stationery_source)?;
        BackgroundImage::from_stationery_bytes(&bytes).ok()
    }

    /// Vector-only stationery, when stationery mode is enabled and the source has no raster image.
    pub fn stationery_vector(&self) -> Option<VectorBackground> {
        if !self.stationery_mode || self.stationery_source.trim().is_empty() {
            return None;
        }
        let bytes = asset_bytes(&self.stationery_source)?;
        VectorBackground::from_pdf_bytes(&bytes).ok()
    }

    /// Resolved text of every stationery token, empty without stationery mode or tokens.
    ///
    /// Tokens are the absolute text overlays of the TypeScript stationery page. A missing value
    /// falls back to the token key itself, like `vars[key] || key` in TypeScript, and HTML-valued
    /// tokens such as `{Positionen_Tabelle}` are flattened to plain text because the exports keep
    /// the formatted invoice body separately.
    pub fn stationery_token_texts(
        &self,
        invoice: &Invoice,
        contact: &Contact,
        company: &CompanyProfile,
        currency: &str,
    ) -> Vec<(StationeryToken, String)> {
        if !self.stationery_mode || self.stationery_tokens.is_empty() {
            return Vec::new();
        }
        let variables = self.variables(invoice, contact, company, currency);
        self.stationery_tokens
            .iter()
            .map(|token| {
                let value = variables
                    .get(token.token_key.trim())
                    .cloned()
                    .unwrap_or_else(|| token.token_key.clone());
                (token.clone(), html_to_text(&value))
            })
            .filter(|(_, text)| !text.trim().is_empty())
            .collect()
    }

    /// Footer text with the invoice placeholders replaced.
    pub fn footer_text_for(&self, invoice: &Invoice) -> String {
        let days = (invoice.due_at - invoice.issued_at).max(0) / (24 * 60 * 60 * 1_000);
        self.footer_text
            .replace("{Faelligkeitsdatum}", &date::format_date(invoice.due_at))
            .replace("{Rechnungsnummer}", &invoice.number)
            .replace("{Zahlungsziel_Tage}", &days.to_string())
            .trim()
            .to_string()
    }

    /// Values available in custom HTML templates and the preview.
    pub fn variables(
        &self,
        invoice: &Invoice,
        contact: &Contact,
        company: &CompanyProfile,
        currency: &str,
    ) -> BTreeMap<String, String> {
        let company_profile = self.effective_company(company);
        let currency = if currency.trim().is_empty() {
            company_profile.currency.as_str()
        } else {
            currency
        };
        let customer_name = contact.display_name();
        let customer_company = contact.company_name.clone().unwrap_or_default();
        let customer_city = [contact.zip.as_deref(), contact.city.as_deref()]
            .into_iter()
            .flatten()
            .filter(|value| !value.trim().is_empty())
            .collect::<Vec<_>>()
            .join(" ");
        let tax_rate = invoice
            .lines
            .first()
            .map(|line| format!("{:.0}%", line.tax_rate_bp as f64 / 100.0))
            .unwrap_or_else(|| "0%".to_string());
        let status = match invoice.status {
            InvoiceStatus::Draft => "Entwurf",
            InvoiceStatus::Sent => "Offen",
            InvoiceStatus::Overdue => "Überfällig",
            InvoiceStatus::Paid => "Bezahlt",
            InvoiceStatus::Cancelled => "Storniert",
        };
        let mut variables = BTreeMap::new();
        for (key, value) in [
            ("{Rechnung}", self.header_title.clone()),
            ("{Rechnungsnummer}", invoice.number.clone()),
            ("{Datum}", date::format_date(invoice.issued_at)),
            ("{Faelligkeitsdatum}", date::format_date(invoice.due_at)),
            (
                "{Zahlungsziel_Tage}",
                ((invoice.due_at - invoice.issued_at).max(0) / 86_400_000).to_string(),
            ),
            ("{Status}", status.to_string()),
            ("{Waehrung}", currency.to_string()),
            ("{Kunde_Name}", customer_name),
            ("{Kunde_Firma}", customer_company),
            (
                "{Kunde_Adresse}",
                contact.street.clone().unwrap_or_default(),
            ),
            ("{Kunde_PLZ_Ort}", customer_city),
            ("{Kunde_Email}", contact.email.clone().unwrap_or_default()),
            ("{Kunde_Telefon}", contact.phone.clone().unwrap_or_default()),
            ("{Kunde_UStId}", contact.tax_id.clone().unwrap_or_default()),
            ("{Netto}", invoice.total_net().format_localized(currency)),
            ("{Ust_Satz}", tax_rate),
            (
                "{Ust_Betrag}",
                invoice.total_tax().format_localized(currency),
            ),
            (
                "{Gesamtbetrag}",
                invoice.total_gross().format_localized(currency),
            ),
            ("{Steuerhinweis}", self.tax_note.clone()),
            ("{Positionen_Tabelle}", positions_html(invoice, currency)),
            ("{Firma_Name}", company_profile.name),
            ("{Firma_Zusatz}", self.company.subtitle.clone()),
            ("{Firma_Inhaber}", self.company.owner.clone()),
            ("{Firma_Adresse}", company_profile.street),
            ("{Firma_PLZ_Ort}", company_profile.zip_city),
            ("{Firma_Telefon}", company_profile.phone),
            ("{Firma_Email}", company_profile.email),
            ("{Firma_Website}", self.company.website.clone()),
            ("{Firma_Steuernummer}", company_profile.tax_id.clone()),
            ("{Firma_UStId}", self.company.vat_id.clone()),
            ("{Firma_IBAN}", company_profile.iban),
            ("{Firma_BIC}", company_profile.bic),
            ("{Firma_Bank}", company_profile.bank_name),
            (
                "{Firma_Handelsregister}",
                self.company.commercial_register.clone(),
            ),
            ("{Primaerfarbe}", self.primary_color.clone()),
            ("{Fusszeile}", self.footer_text_for(invoice)),
        ] {
            variables.insert(key.to_string(), value);
        }
        variables
    }

    /// Full HTML of the invoice, using the custom body or the built-in layout.
    pub fn render_html(
        &self,
        invoice: &Invoice,
        contact: &Contact,
        company: &CompanyProfile,
        currency: &str,
    ) -> String {
        let variables = self.variables(invoice, contact, company, currency);
        if self.use_custom_layout && !self.custom_body_template.trim().is_empty() {
            let mut html = self.custom_body_template.clone();
            for (key, value) in variables {
                html = html.replace(&key, &value);
            }
            return html;
        }
        let color = html_escape(&self.primary_color);
        let font = self.font_stack();
        let mut html = format!(
            "<div style=\"font-family: {font}; color: #0f172a; max-width: 800px; margin: 0 auto; padding: 24px; line-height: 1.5; font-size: 13px;\">\n"
        );
        html.push_str(&format!(
            "<div style=\"border-bottom: 3px solid {color}; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between;\">"
        ));
        html.push_str(&format!(
            "<div><div style=\"font-size: 20px; font-weight: 700;\">{}</div><div style=\"font-size: 11px; color: #475569;\">{} · {}</div></div>",
            variables.get("{Firma_Name}").map(String::as_str).unwrap_or_default(),
            variables.get("{Firma_Adresse}").map(String::as_str).unwrap_or_default(),
            variables.get("{Firma_PLZ_Ort}").map(String::as_str).unwrap_or_default()
        ));
        html.push_str(&format!(
            "<div style=\"text-align: right;\"><div style=\"font-size: 26px; font-weight: 800; color: {color};\">{}</div><div>Nr. {}</div><div>Datum: {}</div><div>Fällig: {}</div></div></div>",
            variables.get("{Rechnung}").map(String::as_str).unwrap_or_default(),
            variables.get("{Rechnungsnummer}").map(String::as_str).unwrap_or_default(),
            variables.get("{Datum}").map(String::as_str).unwrap_or_default(),
            variables.get("{Faelligkeitsdatum}").map(String::as_str).unwrap_or_default()
        ));
        html.push_str(&format!(
            "<div style=\"border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin-bottom: 20px;\"><div style=\"font-size: 10px; color: #94a3b8;\">{} · {} · {}</div><div style=\"font-size: 14px; font-weight: 700; margin-top: 8px;\">{}</div><div>{}</div><div>{}</div></div>",
            variables.get("{Firma_Name}").map(String::as_str).unwrap_or_default(),
            variables.get("{Firma_Adresse}").map(String::as_str).unwrap_or_default(),
            variables.get("{Firma_PLZ_Ort}").map(String::as_str).unwrap_or_default(),
            variables.get("{Kunde_Firma}").map(String::as_str).unwrap_or_default(),
            variables.get("{Kunde_Name}").map(String::as_str).unwrap_or_default(),
            variables.get("{Kunde_PLZ_Ort}").map(String::as_str).unwrap_or_default()
        ));
        html.push_str(&format!(
            "<h2 style=\"font-size: 18px; color: #0f172a;\">{}</h2><p>{}</p>",
            html_escape(&self.header_title),
            html_escape(
                &invoice
                    .note
                    .clone()
                    .filter(|note| !note.trim().is_empty())
                    .unwrap_or_else(|| self.header_text.clone())
            )
        ));
        html.push_str(
            variables
                .get("{Positionen_Tabelle}")
                .map(String::as_str)
                .unwrap_or_default(),
        );
        for (label, value) in [
            ("Netto", variables.get("{Netto}")),
            ("USt.", variables.get("{Ust_Betrag}")),
            ("Gesamt", variables.get("{Gesamtbetrag}")),
        ] {
            html.push_str(&format!(
                "<p style=\"text-align: right; margin: 2px 0;\"><strong>{label}:</strong> {}</p>",
                value.map(String::as_str).unwrap_or_default()
            ));
        }
        html.push_str(&format!(
            "<p style=\"margin-top: 20px;\">{}</p><p style=\"font-size: 10px; color: #64748b;\">{}</p></div>",
            html_escape(&self.footer_text_for(invoice)),
            html_escape(&self.tax_note)
        ));
        html
    }

    /// Renders the visible HTML into the shared formatted document model used by all outputs.
    pub fn rendered_document(
        &self,
        invoice: &Invoice,
        contact: &Contact,
        company: &CompanyProfile,
        currency: &str,
    ) -> RichDocument {
        rich_html::parse(&self.render_html(invoice, contact, company, currency))
    }

    /// Catalogue-style label key of a validation code.
    pub fn error_key(code: &str) -> &'static str {
        let code = code.rsplit(": ").next().unwrap_or(code);
        match code {
            "template_name_required" => "invoices_template_error_name",
            "template_header_required" => "invoices_template_error_header",
            "template_color_invalid" => "invoices_template_error_color",
            "template_due_days_invalid" => "invoices_template_error_due",
            "template_text_too_long" => "invoices_template_error_text",
            "template_logo_position_invalid" => "invoices_template_error_logo_position",
            "template_asset_too_large" => "invoices_template_error_asset_size",
            "template_tokens_too_many" => "invoices_template_error_text",
            "template_token_invalid" => "invoices_template_error_invalid",
            "template_required" => "invoices_template_error_empty",
            "template_id_duplicate" => "invoices_template_error_duplicate",
            "template_active_missing" => "invoices_template_error_active",
            "template_invalid" => "invoices_template_error_invalid",
            _ => "invoices_template_error_save",
        }
    }
}

/// All templates plus the active selection.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct TemplateBook {
    /// Templates in display order.
    pub templates: Vec<InvoiceTemplate>,
    /// Id of the template used for printing.
    pub active_id: String,
}

impl Default for TemplateBook {
    fn default() -> Self {
        let templates = default_templates();
        TemplateBook {
            active_id: templates
                .first()
                .map(|template| template.id.clone())
                .unwrap_or_default(),
            templates,
        }
    }
}

impl TemplateBook {
    /// Validates the whole book, including unique ids and a resolvable active template.
    pub fn validate(&self) -> Result<(), String> {
        if self.templates.is_empty() {
            return Err("template_required".to_string());
        }
        let mut seen = Vec::new();
        for template in &self.templates {
            template.validate()?;
            if seen.contains(&template.id) {
                return Err("template_id_duplicate".to_string());
            }
            seen.push(template.id.clone());
        }
        if !seen.iter().any(|id| id == &self.active_id) {
            return Err("template_active_missing".to_string());
        }
        Ok(())
    }

    /// Active template, falling back to the first one for a legacy or empty selection.
    pub fn active(&self) -> Option<&InvoiceTemplate> {
        self.templates
            .iter()
            .find(|template| template.id == self.active_id)
            .or_else(|| self.templates.first())
    }

    /// Selects a template by id.
    pub fn activate(&mut self, id: &str) -> bool {
        if self.templates.iter().any(|template| template.id == id) {
            self.active_id = id.to_string();
            true
        } else {
            false
        }
    }

    /// Appends a copy of the selected template with a new id.
    pub fn duplicate(&mut self, id: &str, new_id: String) -> Option<&InvoiceTemplate> {
        let index = self
            .templates
            .iter()
            .position(|template| template.id == id)?;
        let mut copy = self.templates[index].clone();
        copy.id = new_id;
        copy.name = format!("{} (Kopie)", copy.name);
        self.templates.push(copy);
        self.templates.last()
    }

    /// Removes a template, unless it is the last one.
    pub fn remove(&mut self, id: &str) -> bool {
        if self.templates.len() <= 1 {
            return false;
        }
        let Some(index) = self.templates.iter().position(|template| template.id == id) else {
            return false;
        };
        self.templates.remove(index);
        if self.active_id == id {
            self.active_id = self.templates[0].id.clone();
        }
        true
    }
}

/// Classic DIN 5008 template, identical to the historical default print.
pub fn default_template() -> InvoiceTemplate {
    InvoiceTemplate {
        id: DEFAULT_TEMPLATE_ID.to_string(),
        name: "DIN 5008 Standard".to_string(),
        description: "Klassischer Geschäftsbrief mit Falt- und Lochmarken.".to_string(),
        preset_type: "din_5008".to_string(),
        header_title: "Rechnung".to_string(),
        header_text: "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag.".to_string(),
        footer_text: "Bitte überweisen Sie den Gesamtbetrag bis zum {Faelligkeitsdatum}."
            .to_string(),
        tax_note: String::new(),
        primary_color: "#2563eb".to_string(),
        font_family: "sans".to_string(),
        due_days: 14,
        show_fold_marks: true,
        logo: String::new(),
        show_logo: true,
        logo_position: "right".to_string(),
        company: TemplateCompany::default(),
        use_custom_layout: false,
        custom_body_template: String::new(),
        stationery_mode: false,
        stationery_source: String::new(),
        stationery_tokens: Vec::new(),
        created_at: String::new(),
        is_default: true,
    }
}

/// Factory templates of a fresh installation.
pub fn default_templates() -> Vec<InvoiceTemplate> {
    let mut classic = default_template();
    classic.name = "DIN 5008 Standard (klassisch)".to_string();
    classic.description =
        "Deutscher Geschäftsstandard mit Faltmarken und präzisem Adressfeld.".to_string();

    let mut modern = InvoiceTemplate {
        id: "modern_minimal".to_string(),
        name: "Modern Minimal".to_string(),
        description: "Klares Layout für Agenturen und Freiberufler.".to_string(),
        preset_type: "modern".to_string(),
        is_default: false,
        header_title: "Rechnung & Leistungsnachweis".to_string(),
        header_text: "Vielen Dank für die angenehme Zusammenarbeit. Anbei die Abrechnung."
            .to_string(),
        footer_text:
            "Bitte überweisen Sie den Gesamtbetrag bis zum {Faelligkeitsdatum} unter Angabe der Rechnungsnummer {Rechnungsnummer}.".to_string(),
        tax_note: "Regelbesteuerung gemäß UStG.".to_string(),
        primary_color: "#0f172a".to_string(),
        due_days: 14,
        show_fold_marks: false,
        ..default_template()
    };
    modern.tax_note = "Regelbesteuerung gemäß UStG.".to_string();

    let corporate = InvoiceTemplate {
        id: "corporate_executive".to_string(),
        name: "Corporate Executive".to_string(),
        description: "Industrieller Auftritt für GmbH und Handel.".to_string(),
        preset_type: "corporate".to_string(),
        is_default: false,
        header_title: "Handelsrechnung".to_string(),
        header_text: "Gemäß Ihrer Bestellung berechnen wir folgende Lieferungen und Leistungen."
            .to_string(),
        footer_text: "Rechnungsbetrag fällig rein netto innerhalb von {Zahlungsziel_Tage} Tagen."
            .to_string(),
        tax_note: "Lieferung gemäß den vereinbarten Handelsbedingungen.".to_string(),
        primary_color: "#1e3a8a".to_string(),
        due_days: 30,
        show_fold_marks: true,
        ..default_template()
    };

    let creative = InvoiceTemplate {
        id: "creative_studio".to_string(),
        name: "Creative Studio".to_string(),
        description: "Persönlicher Stil für Design, Handwerk und Handel.".to_string(),
        preset_type: "creative".to_string(),
        is_default: false,
        header_title: "Rechnung & Honorar".to_string(),
        header_text: "Wir stellen die vereinbarten Positionen in Rechnung.".to_string(),
        footer_text: "Herzlichen Dank für Ihr Vertrauen!".to_string(),
        tax_note: String::new(),
        primary_color: "#c2410c".to_string(),
        due_days: 14,
        show_fold_marks: false,
        ..default_template()
    };

    let practice = InvoiceTemplate {
        id: "practice_medical".to_string(),
        name: "Heilbehandlung & Praxis".to_string(),
        description: "Praxisabrechnung mit Hinweis zur Steuerbefreiung.".to_string(),
        preset_type: "praxis".to_string(),
        is_default: false,
        header_title: "Honorarabrechnung".to_string(),
        header_text: "Für die durchgeführten Sitzungen erlaube ich mir folgendes Honorar in Rechnung zu stellen.".to_string(),
        footer_text: "Bitte überweisen Sie den Honorarbetrag innerhalb von {Zahlungsziel_Tage} Tagen auf das Praxiskonto.".to_string(),
        tax_note: "Umsatzsteuerbefreit nach § 4 Nr. 14 UStG (Heilbehandlung im Bereich der Humanmedizin).".to_string(),
        primary_color: "#0d9488".to_string(),
        due_days: 14,
        show_fold_marks: true,
        ..default_template()
    };

    vec![classic, modern, corporate, creative, practice]
}

/// Loads the stored template book, or the factory templates on a fresh database.
pub fn load(store: &Store) -> CoreResult<TemplateBook> {
    match store.get_setting(TEMPLATES_SETTING_KEY)? {
        Some(value) => {
            let book: TemplateBook = serde_json::from_value(value)
                .map_err(|_| CoreError::Validation("template_invalid".to_string()))?;
            book.validate().map_err(CoreError::Validation)?;
            Ok(book)
        }
        None => Ok(TemplateBook::default()),
    }
}

/// Validates and stores the whole template book atomically.
pub fn save(store: &Store, book: &TemplateBook) -> CoreResult<()> {
    book.validate().map_err(CoreError::Validation)?;
    let value = serde_json::to_value(book).map_err(CoreError::Serialization)?;
    store.put_setting(TEMPLATES_SETTING_KEY, &value)
}

/// Active template without loading the whole book at call sites.
pub fn active(store: &Store) -> CoreResult<InvoiceTemplate> {
    let book = load(store)?;
    book.active()
        .cloned()
        .ok_or_else(|| CoreError::Validation("template_required".to_string()))
}

fn positions_html(invoice: &Invoice, currency: &str) -> String {
    let mut html = String::from(
        "<table style=\"width: 100%; border-collapse: collapse; font-size: 12px; margin: 16px 0;\"><thead><tr style=\"background: #f1f5f9; text-align: left;\"><th>Pos.</th><th>Bezeichnung</th><th style=\"text-align: right;\">Menge</th><th style=\"text-align: right;\">Einzelpreis</th><th style=\"text-align: right;\">MwSt</th><th style=\"text-align: right;\">Gesamt</th></tr></thead><tbody>",
    );
    if invoice.lines.is_empty() {
        html.push_str("<tr><td colspan=\"6\">Keine Positionen angegeben.</td></tr>");
    }
    for (index, line) in invoice.lines.iter().enumerate() {
        html.push_str(&format!(
            "<tr style=\"border-bottom: 1px solid #e2e8f0;\"><td>{:02}</td><td>{}</td><td style=\"text-align: right;\">{}</td><td style=\"text-align: right;\">{}</td><td style=\"text-align: right;\">{:.0}%</td><td style=\"text-align: right; font-weight: 700;\">{}</td></tr>",
            index + 1,
            html_escape(line.description.trim()),
            quantity_text(line.quantity_milli),
            html_escape(&line.unit_price.format_localized(currency)),
            line.tax_rate_bp as f64 / 100.0,
            html_escape(&line.gross().format_localized(currency))
        ));
    }
    html.push_str("</tbody></table>");
    html
}

fn quantity_text(quantity_milli: i64) -> String {
    let whole = quantity_milli / 1_000;
    let rest = quantity_milli % 1_000;
    if rest == 0 {
        whole.to_string()
    } else {
        format!("{whole},{}", format!("{rest:03}").trim_end_matches('0'))
    }
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Plain-text preview of an HTML template, with tags and basic entities removed.
pub fn html_to_text(html: &str) -> String {
    let mut text = String::new();
    let mut tag = String::new();
    let mut in_tag = false;
    for character in html.chars() {
        match character {
            '<' => {
                in_tag = true;
                tag.clear();
            }
            '>' if in_tag => {
                let name = tag.trim().to_ascii_lowercase();
                if name.starts_with("br")
                    || name.starts_with("/p")
                    || name.starts_with("/div")
                    || name.starts_with("/tr")
                    || name.starts_with("/h")
                    || name.starts_with("/li")
                    || name.starts_with("hr")
                {
                    text.push('\n');
                } else if name.starts_with("td") || name.starts_with("th") {
                    text.push('\t');
                }
                in_tag = false;
            }
            _ if in_tag => tag.push(character),
            _ => text.push(character),
        }
    }
    let text = text
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");
    let mut lines = Vec::new();
    for line in text.lines() {
        let line = line.split_whitespace().collect::<Vec<_>>().join(" ");
        if !line.is_empty() {
            lines.push(line);
        }
    }
    lines.join("\n")
}

/// Which template slot an asset belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TemplateAssetKind {
    /// The company logo in the invoice header.
    Logo,
    /// The letterhead image or PDF painted behind the invoice.
    Stationery,
}

/// Largest logo the TypeScript logo input accepts: 2 MB.
pub const MAX_LOGO_BYTES: usize = 2 * 1024 * 1024;

impl TemplateAssetKind {
    /// Extensions accepted by the TypeScript file inputs, without the dot.
    pub const fn extensions(self) -> &'static [&'static str] {
        match self {
            TemplateAssetKind::Logo => &["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"],
            TemplateAssetKind::Stationery => &["pdf", "png", "jpg", "jpeg", "webp"],
        }
    }

    /// Whether `file_name` has an extension the TypeScript input accepts.
    pub fn accepts(self, file_name: &str) -> bool {
        let Some(extension) = Path::new(file_name)
            .extension()
            .and_then(|value| value.to_str())
        else {
            return false;
        };
        self.extensions()
            .iter()
            .any(|allowed| allowed.eq_ignore_ascii_case(extension))
    }

    /// Largest accepted source file; only the logo has the TypeScript 2 MB limit.
    pub const fn max_bytes(self) -> Option<usize> {
        match self {
            TemplateAssetKind::Logo => Some(MAX_LOGO_BYTES),
            TemplateAssetKind::Stationery => None,
        }
    }
}

/// A logo or stationery file that passed the TypeScript input rules.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateAsset {
    /// Slot the asset belongs to.
    pub kind: TemplateAssetKind,
    /// Self-contained data URL stored in the template.
    pub data_url: String,
    /// Original file name of the source.
    pub file_name: String,
    /// Number of source bytes.
    pub bytes: usize,
}

/// Why a logo or stationery file cannot be used.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TemplateAssetError {
    /// The file could not be read.
    Read(String),
    /// The file has no bytes.
    Empty,
    /// The extension is not one of the TypeScript input filters.
    ExtensionNotAllowed {
        /// Name of the rejected file.
        file_name: String,
        /// Extensions the slot accepts.
        allowed: Vec<String>,
    },
    /// The logo exceeds the TypeScript 2 MB limit.
    TooLarge {
        /// Size of the rejected file.
        bytes: usize,
        /// Largest accepted size.
        max: usize,
    },
}

impl TemplateAssetError {
    /// Stable code used by the UI catalogue.
    pub fn as_str(&self) -> &'static str {
        match self {
            TemplateAssetError::Read(_) => "template_asset_read",
            TemplateAssetError::Empty => "template_asset_empty",
            TemplateAssetError::ExtensionNotAllowed { .. } => "template_asset_extension",
            TemplateAssetError::TooLarge { .. } => "template_asset_too_large",
        }
    }
}

/// Applies the TypeScript file filters and returns the file as a data URL.
pub fn template_asset_from_bytes(
    kind: TemplateAssetKind,
    file_name: &str,
    bytes: &[u8],
) -> Result<TemplateAsset, TemplateAssetError> {
    if bytes.is_empty() {
        return Err(TemplateAssetError::Empty);
    }
    if !kind.accepts(file_name) {
        return Err(TemplateAssetError::ExtensionNotAllowed {
            file_name: file_name.to_string(),
            allowed: kind
                .extensions()
                .iter()
                .map(|value| (*value).to_string())
                .collect(),
        });
    }
    if let Some(max) = kind.max_bytes() {
        if bytes.len() > max {
            return Err(TemplateAssetError::TooLarge {
                bytes: bytes.len(),
                max,
            });
        }
    }
    Ok(TemplateAsset {
        kind,
        data_url: encode_data_url(file_name, bytes),
        file_name: file_name.to_string(),
        bytes: bytes.len(),
    })
}

/// Reads a file and applies the same rules as the native picker and the drop zones.
pub fn read_template_asset(
    kind: TemplateAssetKind,
    path: &Path,
) -> Result<TemplateAsset, TemplateAssetError> {
    let bytes = std::fs::read(path).map_err(|error| TemplateAssetError::Read(error.to_string()))?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default();
    template_asset_from_bytes(kind, file_name, &bytes)
}

/// Reads a path or a base64 data URL into bytes.
pub fn asset_bytes(source: &str) -> Option<Vec<u8>> {
    let source = source.trim();
    if source.is_empty() {
        return None;
    }
    if let Some(data) = source.strip_prefix("data:") {
        let (_, encoded) = data.split_once(',')?;
        return base64_decode(encoded);
    }
    std::fs::read(Path::new(source)).ok()
}

/// Reads a file and stores it as a data URL so the template stays self-contained.
///
/// The MIME type comes from the file signature; unknown content stays `application/octet-stream`.
/// The picker and drop path use [`template_asset_from_bytes`], which also honours the file
/// extension for image formats the signature detector does not know.
pub fn file_to_data_url(path: &Path) -> CoreResult<String> {
    let bytes = std::fs::read(path)?;
    let mime = if bytes.starts_with(b"\x89PNG") {
        "image/png"
    } else if bytes.starts_with(b"%PDF") {
        "application/pdf"
    } else {
        "application/octet-stream"
    };
    Ok(format!("data:{mime};base64,{}", base64_encode(&bytes)))
}

fn encode_data_url(file_name: &str, bytes: &[u8]) -> String {
    format!(
        "data:{};base64,{}",
        asset_mime(file_name, bytes),
        base64_encode(bytes)
    )
}

/// MIME type of a template asset, detected from its signature and extension.
fn asset_mime(file_name: &str, bytes: &[u8]) -> &'static str {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        return "image/png";
    }
    if bytes.starts_with(b"%PDF") {
        return "application/pdf";
    }
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        return "image/jpeg";
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return "image/gif";
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return "image/webp";
    }
    if bytes.starts_with(b"BM") {
        return "image/bmp";
    }
    if bytes.starts_with(&[0x00, 0x00, 0x01, 0x00]) {
        return "image/x-icon";
    }
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "pdf" => "application/pdf",
        _ => "application/octet-stream",
    }
}

fn base64_encode(bytes: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let a = chunk[0] as u32;
        let b = chunk.get(1).copied().unwrap_or(0) as u32;
        let c = chunk.get(2).copied().unwrap_or(0) as u32;
        let value = (a << 16) | (b << 8) | c;
        out.push(ALPHABET[((value >> 18) & 63) as usize] as char);
        out.push(ALPHABET[((value >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            ALPHABET[((value >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            ALPHABET[(value & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

fn base64_decode(value: &str) -> Option<Vec<u8>> {
    let mut output = Vec::new();
    let mut buffer = 0u32;
    let mut bits = 0u32;
    for character in value.bytes() {
        let digit = match character {
            b'A'..=b'Z' => character - b'A',
            b'a'..=b'z' => character - b'a' + 26,
            b'0'..=b'9' => character - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' | b'\n' | b'\r' | b' ' => continue,
            _ => return None,
        } as u32;
        buffer = (buffer << 6) | digit;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }
    Some(output)
}

fn parse_hex_color(value: &str) -> Option<[f64; 3]> {
    let text = value.trim();
    let hex = text.strip_prefix('#')?;
    if hex.len() != 6 || !hex.chars().all(|character| character.is_ascii_hexdigit()) {
        return None;
    }
    let channel = |offset: usize| {
        u8::from_str_radix(&hex[offset..offset + 2], 16)
            .ok()
            .map(|value| value as f64 / 255.0)
    };
    Some([channel(0)?, channel(2)?, channel(4)?])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::{Contact, ContactKind};
    use crate::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
    use crate::money::Money;
    use uuid::Uuid;

    fn sample_html_data() -> (Invoice, Contact, CompanyProfile) {
        let mut contact = Contact::new(ContactKind::Company, 0);
        contact.company_name = Some("Beispiel GmbH".to_string());
        contact.street = Some("Hauptstrasse 5".to_string());
        contact.zip = Some("10115".to_string());
        contact.city = Some("Berlin".to_string());
        let invoice = Invoice {
            id: Uuid::new_v4(),
            number: "2026-0001".to_string(),
            contact_id: contact.id,
            status: InvoiceStatus::Sent,
            issued_at: 1_780_000_000_000,
            due_at: 1_782_000_000_000,
            currency_symbol: "€".to_string(),
            note: None,
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 2_000,
                unit_price: Money::from_cents(8_000),
                tax_rate_bp: 1900,
            }],
        };
        let company = CompanyProfile {
            name: "Settings GmbH".to_string(),
            street: "Einstellungsweg 1".to_string(),
            zip_city: "10115 Berlin".to_string(),
            currency: "€".to_string(),
            ..CompanyProfile::default()
        };
        (invoice, contact, company)
    }

    #[test]
    fn assets_roundtrip_as_data_urls() {
        let directory = std::env::temp_dir().join(format!("socdof-asset-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&directory).expect("temp dir");
        let path = directory.join("logo.png");
        let bytes = b"not-a-real-png-but-persisted";
        std::fs::write(&path, bytes).expect("write");
        let data_url = file_to_data_url(&path).expect("data url");
        assert!(data_url.starts_with("data:application/octet-stream;base64,"));
        assert_eq!(asset_bytes(&data_url).as_deref(), Some(bytes.as_slice()));
        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn company_details_override_the_settings_fallback() {
        let (_, _, company) = sample_html_data();
        let mut template = default_template();
        assert_eq!(template.effective_company(&company).name, "Settings GmbH");
        template.company.name = "Vorlagen GmbH".to_string();
        template.company.street = "Vorlagenweg 2".to_string();
        template.company.vat_id = "DE123456789".to_string();
        let effective = template.effective_company(&company);
        assert_eq!(effective.name, "Vorlagen GmbH");
        assert_eq!(effective.street, "Vorlagenweg 2");
        assert_eq!(effective.zip_city, "10115 Berlin");
        assert_eq!(template.company.vat_id, "DE123456789");
    }

    #[test]
    fn custom_html_replaces_every_placeholder_and_renders_positions() {
        let (invoice, contact, company) = sample_html_data();
        let mut template = default_template();
        template.company.name = "Vorlagen GmbH".to_string();
        template.use_custom_layout = true;
        template.custom_body_template = "<h1>{Firma_Name}</h1><p>{Rechnungsnummer} · {Kunde_Name} · {Gesamtbetrag}</p>{Positionen_Tabelle}"
            .to_string();
        let html = template.render_html(&invoice, &contact, &company, "€");
        assert!(html.contains("Vorlagen GmbH"));
        assert!(html.contains("2026-0001"));
        assert!(html.contains("Beratung"));
        assert!(!html.contains("{Firma_Name}"));
        assert!(!html.contains("{Positionen_Tabelle}"));
        let text = html_to_text(&html);
        assert!(text.contains("Vorlagen GmbH"));
        assert!(text.contains("2026-0001"));
    }

    #[test]
    fn defaults_are_valid_and_have_an_active_template() {
        let book = TemplateBook::default();
        assert!(book.validate().is_ok());
        assert!(book.templates.len() >= 5);
        assert_eq!(
            book.active().map(|template| template.id.as_str()),
            Some(DEFAULT_TEMPLATE_ID)
        );
        assert!(book
            .templates
            .iter()
            .all(|template| template.validate().is_ok()));
    }

    #[test]
    fn stationery_tokens_resolve_values_and_clamp_the_page() {
        let (invoice, contact, company) = sample_html_data();
        let mut template = default_template();
        assert!(
            template.stationery_tokens.is_empty(),
            "existing templates keep no tokens"
        );
        template.stationery_mode = true;
        template.stationery_tokens = vec![
            StationeryToken {
                id: "tok_num".to_string(),
                token_key: "{Rechnungsnummer}".to_string(),
                x_pct: 65.0,
                y_pct: 22.0,
                width_pct: Some(30.0),
                font_size: Some(14.0),
                font_weight: "bold".to_string(),
                color: "#b91c1c".to_string(),
                align: "right".to_string(),
            },
            StationeryToken {
                id: "tok_unknown".to_string(),
                token_key: "{Unbekannt}".to_string(),
                x_pct: 130.0,
                y_pct: -5.0,
                ..StationeryToken::default()
            },
        ];
        let texts = template.stationery_token_texts(&invoice, &contact, &company, "€");
        assert_eq!(texts.len(), 2);
        assert_eq!(texts[0].1, "2026-0001");
        assert!(texts[0].0.bold());
        assert_eq!(texts[0].0.alignment(), "right");
        assert_eq!(texts[0].0.width_percent(), Some(30.0));
        assert_eq!(texts[1].1, "{Unbekannt}");
        assert_eq!(texts[1].0.x_percent(), 100.0);
        assert_eq!(texts[1].0.y_percent(), 0.0);
        assert_eq!(texts[1].0.font_size_px(), 13.0);
        assert_eq!(texts[1].0.alignment(), "left");
        assert_eq!(
            texts[1].0.color_rgb(),
            [15.0 / 255.0, 23.0 / 255.0, 42.0 / 255.0]
        );

        let json = serde_json::to_value(&template).expect("json");
        assert_eq!(json["stationeryTokens"][0]["tokenKey"], "{Rechnungsnummer}");
        assert_eq!(json["stationeryTokens"][0]["fontWeight"], "bold");
        let back: InvoiceTemplate = serde_json::from_value(json).expect("roundtrip");
        assert_eq!(back, template);

        template.stationery_mode = false;
        assert!(template
            .stationery_token_texts(&invoice, &contact, &company, "€")
            .is_empty());
    }

    #[test]
    fn selection_duplication_and_deletion_keep_a_valid_book() {
        let mut book = TemplateBook::default();
        assert!(book.activate("modern_minimal"));
        assert_eq!(book.active_id, "modern_minimal");
        let copy = book
            .duplicate("modern_minimal", "modern_copy".to_string())
            .expect("copy");
        assert_eq!(copy.id, "modern_copy");
        assert!(book.validate().is_ok());
        assert!(book.remove("modern_copy"));
        while book.templates.len() > 1 {
            let id = book.templates[0].id.clone();
            assert!(book.remove(&id));
        }
        let last = book.templates[0].id.clone();
        assert!(!book.remove(&last));
        assert!(book.validate().is_ok());
    }

    #[test]
    fn rejects_bad_colors_due_days_and_duplicate_ids() {
        let mut template = default_template();
        template.primary_color = "blue".to_string();
        assert_eq!(
            template.validate(),
            Err("template_color_invalid".to_string())
        );

        let mut template = default_template();
        template.due_days = 400;
        assert_eq!(
            template.validate(),
            Err("template_due_days_invalid".to_string())
        );

        let mut book = TemplateBook::default();
        book.templates.push(default_template());
        assert_eq!(book.validate(), Err("template_id_duplicate".to_string()));

        let book = TemplateBook {
            active_id: "missing".to_string(),
            ..TemplateBook::default()
        };
        assert_eq!(book.validate(), Err("template_active_missing".to_string()));
    }

    #[test]
    fn parses_the_accent_color() {
        let mut template = default_template();
        template.primary_color = "#ff8000".to_string();
        let [red, green, blue] = template.color();
        assert!((red - 1.0).abs() < f64::EPSILON);
        assert!((green - 128.0 / 255.0).abs() < f64::EPSILON);
        assert!(blue.abs() < f64::EPSILON);
    }

    #[test]
    fn stationery_layout_wraps_and_clamps_like_the_pdf() {
        let mut token = new_stationery_token("tok", "{Firma_Website}");
        token.x_pct = 10.0;
        token.y_pct = 40.0;
        token.width_pct = Some(30.0);
        token.font_size = Some(11.0);
        token.align = "right".to_string();
        let text = "This is a very long stationery text that must wrap across several lines while keeping exactly the same line offsets in the preview and the exported document";
        let layout = layout_stationery_token(&token, text);
        assert!(layout.lines.len() >= 4);
        let field = layout.field_width_pt.expect("field width");
        assert!((field - mm(210.0 * 0.3)).abs() < 1e-9);
        let first_top = layout.lines[0].top_mm;
        for (index, line) in layout.lines.iter().enumerate() {
            assert!(line.width_pt <= field + 1e-9 || line.text.split_whitespace().count() == 1);
            assert!(
                (line.x_pt - (layout.anchor_pt + field - line.width_pt)).abs() < 1e-9,
                "{line:?}"
            );
            assert!(
                (line.top_mm - (first_top + index as f64 * layout.line_height_mm)).abs() < 1e-9
            );
            assert!((line.baseline_mm - (line.top_mm + 11.0 * 0.264_583)).abs() < 1e-9);
        }
        assert_eq!(
            layout
                .lines
                .iter()
                .map(|line| line.text.as_str())
                .collect::<Vec<_>>()
                .join(" "),
            text
        );

        token.width_pct = None;
        let layout = layout_stationery_token(&token, "eins\nzwei\ndrei");
        assert_eq!(layout.lines.len(), 3);
        assert!(layout
            .lines
            .iter()
            .all(|line| (line.x_pt - layout.anchor_pt).abs() < 1e-9));

        token.x_pct = 120.0;
        token.y_pct = -10.0;
        let layout = layout_stationery_token(&token, "x");
        assert!((layout.anchor_pt - mm(210.0)).abs() < 1e-9);
        assert!(layout.lines[0].top_mm.abs() < 1e-9);
        token.x_pct = -5.0;
        token.y_pct = 150.0;
        let layout = layout_stationery_token(&token, "x");
        assert!(layout.anchor_pt.abs() < 1e-9);
        assert!((layout.lines[0].top_mm - 297.0).abs() < 1e-9);
    }

    #[test]
    fn stationery_editor_defaults_match_typescript() {
        let defaults = default_stationery_tokens();
        assert_eq!(defaults.len(), 7);
        assert_eq!(defaults[0].id, "tok_num");
        assert_eq!(defaults[0].token_key, "{Rechnungsnummer}");
        assert_eq!((defaults[0].x_pct, defaults[0].y_pct), (65.0, 22.0));
        assert_eq!(defaults[0].font_size, Some(14.0));
        assert!(defaults[0].bold());
        assert_eq!(defaults[0].alignment(), "right");
        assert_eq!(defaults[5].width_pct, Some(80.0));
        assert_eq!(defaults[6].token_key, "{Gesamtbetrag}");

        let token = new_stationery_token("tok_new", "{Datum}");
        assert_eq!((token.x_pct, token.y_pct), (15.0, 35.0));
        assert_eq!(token.width_pct, None);
        assert_eq!(token.font_size, Some(13.0));
        assert_eq!(token.font_weight, "normal");
        assert_eq!(token.alignment(), "left");
        assert_eq!(STATIONERY_TOKEN_KEYS.len(), 34);
        assert_eq!(STATIONERY_TOKEN_KEYS[33], "{Firma_Handelsregister}");
    }

    #[test]
    fn template_asset_filters_match_the_typescript_inputs() {
        let png = b"\x89PNG\r\n\x1a\nrest";
        let logo = template_asset_from_bytes(TemplateAssetKind::Logo, "Logo.PNG", png)
            .expect("logo asset");
        assert!(logo.data_url.starts_with("data:image/png;base64,"));
        assert_eq!(logo.kind, TemplateAssetKind::Logo);
        assert_eq!(logo.file_name, "Logo.PNG");
        assert_eq!(logo.bytes, png.len());

        assert!(TemplateAssetKind::Logo.accepts("logo.svg"));
        assert!(!TemplateAssetKind::Logo.accepts("briefpapier.pdf"));
        assert!(TemplateAssetKind::Stationery.accepts("briefpapier.PDF"));
        assert!(!TemplateAssetKind::Stationery.accepts("logo.gif"));
        assert_eq!(TemplateAssetKind::Logo.max_bytes(), Some(MAX_LOGO_BYTES));
        assert_eq!(TemplateAssetKind::Stationery.max_bytes(), None);

        let rejected = template_asset_from_bytes(TemplateAssetKind::Stationery, "notes.txt", b"x")
            .expect_err("wrong extension");
        assert_eq!(rejected.as_str(), "template_asset_extension");
        assert_eq!(
            rejected,
            TemplateAssetError::ExtensionNotAllowed {
                file_name: "notes.txt".to_string(),
                allowed: TemplateAssetKind::Stationery
                    .extensions()
                    .iter()
                    .map(|value| (*value).to_string())
                    .collect(),
            }
        );
        assert_eq!(
            template_asset_from_bytes(TemplateAssetKind::Logo, "logo.png", b"")
                .expect_err("empty file"),
            TemplateAssetError::Empty
        );
        let oversized = vec![0u8; MAX_LOGO_BYTES + 1];
        assert_eq!(
            template_asset_from_bytes(TemplateAssetKind::Logo, "logo.png", &oversized)
                .expect_err("oversized logo"),
            TemplateAssetError::TooLarge {
                bytes: MAX_LOGO_BYTES + 1,
                max: MAX_LOGO_BYTES,
            }
        );
    }

    #[test]
    fn svg_logos_decode_to_the_same_rgb_shape_as_png() {
        let bytes = br##"<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3"><rect width="4" height="3" fill="#ff0000"/></svg>"##;
        let asset = template_asset_from_bytes(TemplateAssetKind::Logo, "logo.svg", bytes)
            .expect("svg asset");
        let mut template = default_template();
        template.logo = asset.data_url;
        template.show_logo = true;
        let decoded = template.logo_image().expect("decoded svg logo");
        assert_eq!((decoded.width, decoded.height), (4, 3));
        assert_eq!(decoded.rgb.len(), 4 * 3 * 3);
        assert_eq!(&decoded.rgb[..3], &[255, 0, 0]);
    }

    #[test]
    fn jpeg_logos_decode_to_the_same_rgb_shape_as_png() {
        let mut bytes = Vec::new();
        let image = image::RgbImage::from_pixel(3, 2, image::Rgb([10, 20, 30]));
        image::DynamicImage::ImageRgb8(image)
            .write_to(
                &mut std::io::Cursor::new(&mut bytes),
                image::ImageOutputFormat::Jpeg(90),
            )
            .expect("jpeg");

        let asset = template_asset_from_bytes(TemplateAssetKind::Logo, "logo.jpg", &bytes)
            .expect("jpeg asset");
        let mut template = default_template();
        template.logo = asset.data_url;
        template.show_logo = true;
        let decoded = template.logo_image().expect("decoded jpeg logo");
        assert_eq!((decoded.width, decoded.height), (3, 2));
        assert_eq!(decoded.rgb.len(), 3 * 2 * 3);
    }

    #[test]
    fn template_asset_data_urls_use_the_detected_mime_type() {
        let jpeg = template_asset_from_bytes(
            TemplateAssetKind::Logo,
            "logo.jpg",
            &[0xFF, 0xD8, 0xFF, 0xE0],
        );
        assert!(jpeg
            .expect("jpeg")
            .data_url
            .starts_with("data:image/jpeg;base64,"));
        let pdf = template_asset_from_bytes(
            TemplateAssetKind::Stationery,
            "briefpapier.pdf",
            b"%PDF-1.7\n",
        );
        assert!(pdf
            .expect("pdf")
            .data_url
            .starts_with("data:application/pdf;base64,"));
        let svg = template_asset_from_bytes(
            TemplateAssetKind::Logo,
            "logo.svg",
            b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
        );
        assert!(svg
            .expect("svg")
            .data_url
            .starts_with("data:image/svg+xml;base64,"));
    }

    #[test]
    fn book_survives_a_store_roundtrip() {
        let store = Store::open_in_memory().expect("store");
        let mut book = TemplateBook::default();
        book.templates[0].header_title = "Honorar".to_string();
        book.activate("modern_minimal");
        save(&store, &book).expect("save");
        let loaded = load(&store).expect("load");
        assert_eq!(loaded, book);
        assert_eq!(
            active(&store).expect("active").id.as_str(),
            "modern_minimal"
        );
    }
}
