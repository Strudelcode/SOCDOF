//! Document layout: letterhead background and token placement.
//!
//! The layout describes what a printed document looks like before the module content starts: an
//! optional PNG letterhead that covers the page, and text tokens placed as percentages of the page
//! (0–100 from the left and the top edge). The Studio drawer edits it, the DIN 5008 renderer draws
//! it. The layout is one JSON value in the settings table, so it is validated here and nowhere else.

use serde::{Deserialize, Serialize};

use crate::date::format_date;
use crate::domain::invoice::Invoice;
use crate::domain::settings::CompanyProfile;
use crate::error::{CoreError, CoreResult};
use crate::store::Store;

/// Settings key of the persisted document layout.
pub const LAYOUT_SETTING_KEY: &str = "document_layout";

/// Horizontal alignment of a placed token.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TokenAlign {
    /// Text starts at the token position.
    #[default]
    Left,
    /// Text is centred on the token position.
    Center,
    /// Text ends at the token position.
    Right,
}

/// Text that can be placed on the letterhead.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenKey {
    /// Legal company name.
    CompanyName,
    /// Street, postal code and city.
    CompanyAddress,
    /// Phone and email.
    CompanyContact,
    /// Tax number of the company.
    TaxId,
    /// Number of the printed invoice.
    InvoiceNumber,
    /// Issue date of the printed invoice.
    InvoiceDate,
    /// Due date of the printed invoice.
    DueDate,
    /// Subject line of the invoice.
    Subject,
    /// Company line in the footer.
    Footer,
}

impl TokenKey {
    /// Every token the layout can place.
    pub const ALL: [TokenKey; 9] = [
        TokenKey::CompanyName,
        TokenKey::CompanyAddress,
        TokenKey::CompanyContact,
        TokenKey::TaxId,
        TokenKey::InvoiceNumber,
        TokenKey::InvoiceDate,
        TokenKey::DueDate,
        TokenKey::Subject,
        TokenKey::Footer,
    ];

    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            TokenKey::CompanyName => "company_name",
            TokenKey::CompanyAddress => "company_address",
            TokenKey::CompanyContact => "company_contact",
            TokenKey::TaxId => "tax_id",
            TokenKey::InvoiceNumber => "invoice_number",
            TokenKey::InvoiceDate => "invoice_date",
            TokenKey::DueDate => "due_date",
            TokenKey::Subject => "subject",
            TokenKey::Footer => "footer",
        }
    }

    /// Catalogue key of the token label.
    pub fn label_key(self) -> &'static str {
        match self {
            TokenKey::CompanyName => "studio_layout_token_company_name",
            TokenKey::CompanyAddress => "studio_layout_token_company_address",
            TokenKey::CompanyContact => "studio_layout_token_company_contact",
            TokenKey::TaxId => "studio_layout_token_tax_id",
            TokenKey::InvoiceNumber => "studio_layout_token_invoice_number",
            TokenKey::InvoiceDate => "studio_layout_token_invoice_date",
            TokenKey::DueDate => "studio_layout_token_due_date",
            TokenKey::Subject => "studio_layout_token_subject",
            TokenKey::Footer => "studio_layout_token_footer",
        }
    }
}

/// One placed token.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct LayoutToken {
    /// Token that supplies the text.
    pub key: TokenKey,
    /// Whether the token is printed.
    pub enabled: bool,
    /// Horizontal position in percent of the page width.
    pub x_pct: f64,
    /// Vertical position in percent of the page height, measured from the top edge.
    pub y_pct: f64,
    /// Font size in points.
    pub size_pt: f64,
    /// Whether the token prints in bold.
    pub bold: bool,
    /// Horizontal alignment at the token position.
    pub align: TokenAlign,
}

impl LayoutToken {
    /// Whether the values fit on the page.
    fn validate(&self) -> Result<(), String> {
        if !(0.0..=100.0).contains(&self.x_pct) || !(0.0..=100.0).contains(&self.y_pct) {
            return Err("layout_position_invalid".to_string());
        }
        if !(5.0..=72.0).contains(&self.size_pt) {
            return Err("layout_size_invalid".to_string());
        }
        Ok(())
    }
}

/// Page layout of printed documents.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct DocumentLayout {
    /// PNG file that is printed as the letterhead, empty for none.
    pub letterhead_image: String,
    /// Tokens placed on the page.
    pub tokens: Vec<LayoutToken>,
}

impl Default for DocumentLayout {
    fn default() -> Self {
        DocumentLayout {
            letterhead_image: String::new(),
            tokens: default_tokens(),
        }
    }
}

/// Token set a fresh installation starts with: letterhead lines in the header, invoice data on the
/// right and the company line in the footer.
fn default_tokens() -> Vec<LayoutToken> {
    let token = |key, x_pct, y_pct, size_pt, bold, align| LayoutToken {
        key,
        enabled: false,
        x_pct,
        y_pct,
        size_pt,
        bold,
        align,
    };
    vec![
        token(
            TokenKey::CompanyName,
            8.0,
            6.0,
            14.0,
            true,
            TokenAlign::Left,
        ),
        token(
            TokenKey::CompanyAddress,
            8.0,
            10.5,
            8.5,
            false,
            TokenAlign::Left,
        ),
        token(
            TokenKey::CompanyContact,
            8.0,
            13.0,
            8.5,
            false,
            TokenAlign::Left,
        ),
        token(
            TokenKey::InvoiceNumber,
            92.0,
            8.0,
            9.0,
            true,
            TokenAlign::Right,
        ),
        token(
            TokenKey::InvoiceDate,
            92.0,
            11.0,
            9.0,
            false,
            TokenAlign::Right,
        ),
        token(TokenKey::DueDate, 92.0, 14.0, 9.0, false, TokenAlign::Right),
        token(TokenKey::TaxId, 8.0, 96.0, 7.5, false, TokenAlign::Left),
        token(TokenKey::Footer, 8.0, 93.0, 7.5, false, TokenAlign::Left),
        token(TokenKey::Subject, 8.0, 33.0, 12.0, true, TokenAlign::Left),
    ]
}

impl DocumentLayout {
    /// Text of one token, `None` when the document type has no value for it.
    pub fn token_text(
        &self,
        key: TokenKey,
        company: &CompanyProfile,
        invoice: Option<&Invoice>,
    ) -> Option<String> {
        let joined = |parts: [&str; 3]| {
            parts
                .into_iter()
                .map(str::trim)
                .filter(|part| !part.is_empty())
                .collect::<Vec<_>>()
                .join(" · ")
        };
        let text = match key {
            TokenKey::CompanyName => company.name.clone(),
            TokenKey::CompanyAddress => joined([
                company.street.as_str(),
                company.zip_city.as_str(),
                company.country.as_str(),
            ]),
            TokenKey::CompanyContact => {
                joined([company.phone.as_str(), company.email.as_str(), ""])
            }
            TokenKey::TaxId => {
                if company.tax_id.trim().is_empty() {
                    String::new()
                } else {
                    format!("Steuernummer: {}", company.tax_id.trim())
                }
            }
            TokenKey::InvoiceNumber => format!("Rechnung Nr. {}", invoice?.number),
            TokenKey::InvoiceDate => format_date(invoice?.issued_at),
            TokenKey::DueDate => format!("Fällig am: {}", format_date(invoice?.due_at)),
            TokenKey::Subject => format!("Rechnung Nr. {}", invoice?.number),
            TokenKey::Footer => joined([
                company.name.as_str(),
                company.street.as_str(),
                company.zip_city.as_str(),
            ]),
        };
        let text = text.trim().to_string();
        if text.is_empty() {
            None
        } else {
            Some(text)
        }
    }

    /// Whether the layout can be printed and stored.
    pub fn validate(&self) -> Result<(), String> {
        let image = self.letterhead_image.trim();
        if !image.is_empty() && !image.to_ascii_lowercase().ends_with(".png") {
            return Err("layout_image_invalid".to_string());
        }
        if self.tokens.is_empty() {
            return Err("layout_tokens_required".to_string());
        }
        let mut seen = Vec::new();
        for token in &self.tokens {
            if seen.contains(&token.key) {
                return Err("layout_tokens_required".to_string());
            }
            seen.push(token.key);
            token.validate()?;
        }
        Ok(())
    }

    /// Loaded background image, `None` when no file is configured or it cannot be read.
    pub fn background(&self) -> Option<crate::pdf::writer::BackgroundImage> {
        let path = self.letterhead_image.trim();
        if path.is_empty() {
            return None;
        }
        crate::pdf::writer::BackgroundImage::from_png(std::path::Path::new(path)).ok()
    }
}

/// Loads the stored layout; a fresh installation gets the default layout.
pub fn load(store: &Store) -> CoreResult<DocumentLayout> {
    match store.get_setting(LAYOUT_SETTING_KEY)? {
        Some(value) => serde_json::from_value(value)
            .map_err(|_| CoreError::Validation("layout_invalid".to_string())),
        None => Ok(DocumentLayout::default()),
    }
}

/// Validates and stores the layout.
pub fn save(store: &Store, layout: &DocumentLayout) -> CoreResult<()> {
    layout.validate().map_err(CoreError::Validation)?;
    let value = serde_json::to_value(layout).map_err(CoreError::Serialization)?;
    store.put_setting(LAYOUT_SETTING_KEY, &value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::invoice::{Invoice, InvoiceLine, InvoiceStatus};
    use crate::money::Money;
    use uuid::Uuid;

    fn company() -> CompanyProfile {
        CompanyProfile {
            name: "Studio Lindner".to_string(),
            street: "Hauptstraße 4".to_string(),
            zip_city: "10115 Berlin".to_string(),
            phone: "+49 30 123456".to_string(),
            email: "info@studiolindner.de".to_string(),
            tax_id: "12/345/67890".to_string(),
            ..Default::default()
        }
    }

    fn invoice() -> Invoice {
        Invoice {
            id: Uuid::new_v4(),
            number: "2026-0007".to_string(),
            contact_id: Uuid::new_v4(),
            status: InvoiceStatus::Sent,
            issued_at: 1_760_000_000_000,
            due_at: 1_762_000_000_000,
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(9_000),
                tax_rate_bp: 1900,
            }],
        }
    }

    #[test]
    fn default_layout_places_letterhead_and_invoice_tokens() {
        let layout = DocumentLayout::default();
        assert!(layout.letterhead_image.is_empty());
        assert_eq!(layout.tokens.len(), TokenKey::ALL.len());
        assert!(layout.validate().is_ok());
        assert!(layout.tokens.iter().all(|token| !token.enabled));

        let invoice = invoice();
        let company = company();
        assert_eq!(
            layout.token_text(TokenKey::CompanyName, &company, Some(&invoice)),
            Some("Studio Lindner".to_string())
        );
        assert_eq!(
            layout.token_text(TokenKey::CompanyAddress, &company, Some(&invoice)),
            Some("Hauptstraße 4 · 10115 Berlin".to_string())
        );
        assert_eq!(
            layout.token_text(TokenKey::InvoiceNumber, &company, Some(&invoice)),
            Some("Rechnung Nr. 2026-0007".to_string())
        );
        assert_eq!(
            layout.token_text(TokenKey::InvoiceNumber, &company, None),
            None
        );
    }

    #[test]
    fn rejects_positions_outside_the_page_and_duplicate_tokens() {
        let mut layout = DocumentLayout::default();
        layout.tokens[0].x_pct = 120.0;
        assert_eq!(
            layout.validate(),
            Err("layout_position_invalid".to_string())
        );

        let mut layout = DocumentLayout::default();
        layout.tokens[1].key = TokenKey::CompanyName;
        assert_eq!(layout.validate(), Err("layout_tokens_required".to_string()));

        let layout = DocumentLayout {
            letterhead_image: "briefpapier.jpg".to_string(),
            ..Default::default()
        };
        assert_eq!(layout.validate(), Err("layout_image_invalid".to_string()));
    }

    #[test]
    fn stores_and_loads_the_layout_through_the_settings() {
        let store = Store::open_in_memory().expect("store");
        assert_eq!(load(&store).expect("default"), DocumentLayout::default());

        let mut layout = DocumentLayout {
            letterhead_image: "briefpapier.png".to_string(),
            ..Default::default()
        };
        layout.tokens[0].x_pct = 12.5;
        save(&store, &layout).expect("save");
        assert_eq!(load(&store).expect("load"), layout);

        layout.tokens[0].y_pct = 200.0;
        assert!(save(&store, &layout).is_err());
        assert_eq!(load(&store).expect("unchanged").tokens[0].x_pct, 12.5);
    }

    #[test]
    fn missing_background_files_are_ignored() {
        let layout = DocumentLayout {
            letterhead_image: "/does/not/exist.png".to_string(),
            ..Default::default()
        };
        assert!(layout.background().is_none());
    }
}
