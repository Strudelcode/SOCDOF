//! DIN 5008 Form B letter geometry and the invoice renderer.
//!
//! Every measurement lives in [`form_b`] and [`LetterGeometry`], in millimetres from the top-left
//! corner of an A4 sheet, so the layout is tested against the norm instead of being tuned by eye.
//! The values follow DIN 5008:2020 form B: 45 mm letterhead, address field from 45 mm (85 × 45 mm,
//! 20 mm from the left edge, text from 25 mm), information block from 50 mm (125 mm from the left,
//! at most 75 mm wide), subject 8.46 mm below the information block, first body line at 111.5 mm,
//! fold marks at 105 mm and 210 mm, hole mark at 148.5 mm, last text line at 257 mm.
//!
//! The hole mark is the centre of the sheet: 43.5 mm below the first fold mark of form B. DIN 5008
//! has no 8.7 mm offset between the two; the 87 mm (8.7 cm) fold mark belongs to *form A*, whose
//! template instructions are often quoted in centimetres.

use std::path::Path;

use crate::date::format_date;
use crate::domain::contact::Contact;
use crate::domain::invoice::Invoice;
use crate::domain::settings::CompanyProfile;
use crate::error::CoreResult;

use crate::document_layout::{DocumentLayout, TokenAlign};

use super::writer::{mm, text_width, Document, Page};

/// DIN 5008:2020 form B measurements in millimetres, measured from the top-left sheet edge.
pub mod form_b {
    /// Page width of DIN A4.
    pub const PAGE_WIDTH: f64 = 210.0;
    /// Page height of DIN A4.
    pub const PAGE_HEIGHT: f64 = 297.0;
    /// Height of the letterhead above the address field.
    pub const LETTERHEAD_HEIGHT: f64 = 45.0;
    /// Left text margin.
    pub const LEFT_MARGIN: f64 = 25.0;
    /// Right text margin.
    pub const RIGHT_MARGIN: f64 = 20.0;
    /// Bottom margin, where the footer sits.
    pub const BOTTOM_MARGIN: f64 = 20.0;
    /// Top edge of the address field.
    pub const ADDRESS_TOP: f64 = 45.0;
    /// Left edge of the address field; the address text itself starts at [`LEFT_MARGIN`].
    pub const ADDRESS_LEFT: f64 = 20.0;
    /// Width of the address field.
    pub const ADDRESS_WIDTH: f64 = 85.0;
    /// Height of the address field: 17.7 mm note zone plus 27.3 mm address zone.
    pub const ADDRESS_HEIGHT: f64 = 45.0;
    /// Top edge of the address zone inside the field.
    pub const ADDRESS_ZONE_TOP: f64 = 62.7;
    /// Return-sender line above the address field.
    pub const RETURN_LINE_TOP: f64 = 43.0;
    /// Top edge of the information block.
    pub const INFO_TOP: f64 = 50.0;
    /// Left edge of the information block.
    pub const INFO_LEFT: f64 = 125.0;
    /// Maximum width of the information block.
    pub const INFO_MAX_WIDTH: f64 = 75.0;
    /// Minimum height of the information block.
    pub const INFO_MIN_HEIGHT: f64 = 40.0;
    /// Gap between the information block and the subject line.
    pub const SUBJECT_GAP: f64 = 8.46;
    /// Top edge of the subject line (two blank lines below the information block).
    pub const SUBJECT_TOP: f64 = INFO_TOP + INFO_MIN_HEIGHT + SUBJECT_GAP;
    /// First body line: two blank lines for the salutation, one after it.
    pub const BODY_TOP: f64 = 111.5;
    /// Top edge of the position table on the first page.
    pub const TABLE_TOP: f64 = 132.0;
    /// Top edge of the repeated table header on continuation pages.
    pub const CONTINUATION_TABLE_TOP: f64 = 50.0;
    /// Height of one position row.
    pub const ROW_HEIGHT: f64 = 6.0;
    /// Lowest position row, leaving room for the totals block above the footer.
    pub const TABLE_BOTTOM: f64 = 250.0;
    /// Height the totals block needs below the last row (rule, three lines, closing note).
    pub const TOTALS_HEIGHT: f64 = 35.0;
    /// Lowest text line of the sheet.
    pub const LAST_TEXT_LINE: f64 = 257.0;
    /// First fold mark.
    pub const FOLD_MARK_ONE: f64 = 105.0;
    /// Second fold mark.
    pub const FOLD_MARK_TWO: f64 = 210.0;
    /// Hole mark: half the sheet height, 43.5 mm below the first fold mark.
    pub const HOLE_MARK: f64 = 148.5;
    /// Marks start inside the binding margin.
    pub const MARK_LEFT: f64 = 8.0;
    /// Length of a mark.
    pub const MARK_LENGTH: f64 = 5.0;
    /// Stroke greyness of the marks; the norm leaves the appearance open.
    pub const MARK_GREY: f64 = 0.6;
}

/// Complete form B geometry, so a test or a different sheet can reason about the whole layout.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LetterGeometry {
    /// Page width in millimetres.
    pub page_width: f64,
    /// Page height in millimetres.
    pub page_height: f64,
    /// Letterhead height above the address field.
    pub letterhead_height: f64,
    /// Left text margin.
    pub left_margin: f64,
    /// Right text margin.
    pub right_margin: f64,
    /// Bottom margin where the footer sits.
    pub bottom_margin: f64,
    /// Top edge of the address field.
    pub address_top: f64,
    /// Left edge of the address field.
    pub address_left: f64,
    /// Width of the address field.
    pub address_width: f64,
    /// Height of the address field.
    pub address_height: f64,
    /// Top edge of the address zone inside the field.
    pub address_zone_top: f64,
    /// Return-sender line above the field.
    pub return_line_top: f64,
    /// Top edge of the information block.
    pub info_top: f64,
    /// Left edge of the information block.
    pub info_left: f64,
    /// Maximum width of the information block.
    pub info_max_width: f64,
    /// Minimum height of the information block.
    pub info_min_height: f64,
    /// Top edge of the subject line.
    pub subject_top: f64,
    /// First body line.
    pub body_top: f64,
    /// Top edge of the position table on the first page.
    pub table_top: f64,
    /// Top edge of the repeated table header on continuation pages.
    pub continuation_table_top: f64,
    /// Height of one position row.
    pub row_height: f64,
    /// Lowest position row.
    pub table_bottom: f64,
    /// Height the totals block needs below the last row.
    pub totals_height: f64,
    /// Lowest text line of the sheet.
    pub last_text_line: f64,
    /// First fold mark.
    pub fold_mark_one: f64,
    /// Second fold mark.
    pub fold_mark_two: f64,
    /// Hole mark.
    pub hole_mark: f64,
    /// Start of the marks inside the binding margin.
    pub mark_left: f64,
    /// Length of a mark.
    pub mark_length: f64,
    /// Stroke greyness of the marks.
    pub mark_grey: f64,
}

impl Default for LetterGeometry {
    fn default() -> Self {
        LetterGeometry::form_b()
    }
}

impl LetterGeometry {
    /// Form B of DIN 5008:2020.
    pub fn form_b() -> Self {
        LetterGeometry {
            page_width: form_b::PAGE_WIDTH,
            page_height: form_b::PAGE_HEIGHT,
            letterhead_height: form_b::LETTERHEAD_HEIGHT,
            left_margin: form_b::LEFT_MARGIN,
            right_margin: form_b::RIGHT_MARGIN,
            bottom_margin: form_b::BOTTOM_MARGIN,
            address_top: form_b::ADDRESS_TOP,
            address_left: form_b::ADDRESS_LEFT,
            address_width: form_b::ADDRESS_WIDTH,
            address_height: form_b::ADDRESS_HEIGHT,
            address_zone_top: form_b::ADDRESS_ZONE_TOP,
            return_line_top: form_b::RETURN_LINE_TOP,
            info_top: form_b::INFO_TOP,
            info_left: form_b::INFO_LEFT,
            info_max_width: form_b::INFO_MAX_WIDTH,
            info_min_height: form_b::INFO_MIN_HEIGHT,
            subject_top: form_b::SUBJECT_TOP,
            body_top: form_b::BODY_TOP,
            table_top: form_b::TABLE_TOP,
            continuation_table_top: form_b::CONTINUATION_TABLE_TOP,
            row_height: form_b::ROW_HEIGHT,
            table_bottom: form_b::TABLE_BOTTOM,
            totals_height: form_b::TOTALS_HEIGHT,
            last_text_line: form_b::LAST_TEXT_LINE,
            fold_mark_one: form_b::FOLD_MARK_ONE,
            fold_mark_two: form_b::FOLD_MARK_TWO,
            hole_mark: form_b::HOLE_MARK,
            mark_left: form_b::MARK_LEFT,
            mark_length: form_b::MARK_LENGTH,
            mark_grey: form_b::MARK_GREY,
        }
    }

    /// Left text edge in points.
    pub fn text_left(&self) -> f64 {
        mm(self.left_margin)
    }

    /// Right text edge in points.
    pub fn text_right(&self) -> f64 {
        mm(self.page_width - self.right_margin)
    }

    /// Vertical position in points for a distance measured from the top edge.
    pub fn y(&self, from_top_mm: f64) -> f64 {
        mm(self.page_height - from_top_mm)
    }

    /// Marks as `(x_start, x_end, distance from top)`, all in millimetres.
    pub fn marks(&self) -> [(f64, f64, f64); 3] {
        let right = self.mark_left + self.mark_length;
        [
            (self.mark_left, right, self.fold_mark_one),
            (self.mark_left, right, self.hole_mark),
            (self.mark_left, right, self.fold_mark_two),
        ]
    }

    /// Top edge of the footer, inside the bottom margin.
    pub fn footer_top(&self) -> f64 {
        self.page_height - self.bottom_margin
    }

    /// Number of position rows a page holds without pushing the totals into the footer.
    pub fn rows_per_page(&self, first_page: bool) -> usize {
        let header = if first_page {
            self.table_top
        } else {
            self.continuation_table_top
        };
        let last_row = self.table_bottom - self.totals_height;
        let available = last_row - (header + 8.0);
        (available / self.row_height).floor().max(0.0) as usize + 1
    }

    /// Splits the positions into page ranges; every page keeps room for the totals, and a row moves
    /// whole to the next page instead of being cut in half.
    pub fn paginate(&self, row_count: usize) -> Vec<(usize, usize)> {
        if row_count == 0 {
            return vec![(0, 0)];
        }
        let mut ranges = Vec::new();
        let mut start = 0;
        let mut first_page = true;
        while start < row_count {
            let end = (start + self.rows_per_page(first_page)).min(row_count);
            ranges.push((start, end));
            start = end;
            first_page = false;
        }
        ranges
    }
}

/// Renders one invoice as a DIN 5008 PDF.
pub fn render_invoice_pdf(
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
) -> Vec<u8> {
    render(invoice, recipient, company, None)
}

/// Renders one invoice with the stored letterhead background and placed tokens.
pub fn render_invoice_pdf_with_layout(
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
    layout: &DocumentLayout,
) -> Vec<u8> {
    let mut document = Document::new(&format!("Rechnung {}", invoice.number));
    if let Some(image) = layout.background() {
        document.set_background(image);
    }
    render_document(document, invoice, recipient, company, Some(layout))
}

fn render(
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
    layout: Option<&DocumentLayout>,
) -> Vec<u8> {
    render_document(
        Document::new(&format!("Rechnung {}", invoice.number)),
        invoice,
        recipient,
        company,
        layout,
    )
}

fn render_document(
    mut document: Document,
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
    layout: Option<&DocumentLayout>,
) -> Vec<u8> {
    let geometry = LetterGeometry::form_b();
    let left = geometry.text_left();
    let right = geometry.text_right();
    let currency = if company.currency.trim().is_empty() {
        "€"
    } else {
        company.currency.as_str()
    };
    let ranges = geometry.paginate(invoice.lines.len());
    let page_count = ranges.len();

    for (page_index, (start, end)) in ranges.iter().enumerate() {
        if page_index > 0 {
            document.new_page();
        }
        let page = document.page_mut();
        draw_marks(page, &geometry);
        if page_index == 0 {
            draw_first_page_header(page, invoice, recipient, company, &geometry);
        }

        let header_top = if page_index == 0 {
            geometry.table_top
        } else {
            geometry.continuation_table_top
        };
        draw_table_header(page, &geometry, header_top);

        let mut row_y = header_top + 8.0;
        for index in *start..*end {
            draw_row(
                page,
                &invoice.lines[index],
                index + 1,
                &geometry,
                row_y,
                currency,
            );
            row_y += geometry.row_height;
        }

        if page_index + 1 == page_count {
            page.line(left, geometry.y(row_y + 1.0), right, 0.6);
            draw_totals(page, invoice, currency, &geometry, row_y);
        }

        draw_footer(page, company, &geometry, page_index + 1, page_count);
        if let Some(layout) = layout {
            draw_tokens(page, layout, company, invoice, &geometry);
        }
    }

    document.to_bytes()
}

/// Draws the two fold marks and the hole mark inside the binding margin.
fn draw_marks(page: &mut Page, geometry: &LetterGeometry) {
    for (x1, x2, distance) in geometry.marks() {
        page.mark(mm(x1), geometry.y(distance), mm(x2), geometry.mark_grey);
    }
}

fn draw_first_page_header(
    page: &mut Page,
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
    geometry: &LetterGeometry,
) {
    let left = geometry.text_left();
    let right = geometry.text_right();

    // Return-sender line above the address field.
    let sender_parts: Vec<String> = [
        company.name.as_str(),
        company.street.as_str(),
        company.zip_city.as_str(),
    ]
    .into_iter()
    .filter(|part| !part.trim().is_empty())
    .map(str::to_string)
    .collect();

    if !sender_parts.is_empty() {
        page.text(
            left,
            geometry.y(geometry.return_line_top),
            7.5,
            &sender_parts.join(" · "),
        );
        page.line(left, geometry.y(geometry.return_line_top + 1.0), right, 0.4);
    }

    // Address field.
    let mut address_lines: Vec<String> = vec![recipient.display_name()];
    if let Some(street) = recipient
        .street
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        address_lines.push(street.to_string());
    }
    let city_line = [recipient.zip.as_deref(), recipient.city.as_deref()]
        .into_iter()
        .flatten()
        .filter(|value| !value.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    if !city_line.is_empty() {
        address_lines.push(city_line);
    }
    if let Some(country) = recipient
        .country
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        address_lines.push(country.to_string());
    }

    let mut address_y = geometry.address_top + 3.5;
    for line in address_lines.iter().take(6) {
        page.text(left, geometry.y(address_y), 11.0, line);
        address_y += 4.6;
    }

    // Information block: date and reference numbers on the right.
    let info_lines = [
        format!("Rechnungsnummer: {}", invoice.number),
        format!("Rechnungsdatum: {}", format_date(invoice.issued_at)),
        format!("Fällig am: {}", format_date(invoice.due_at)),
    ];
    let mut info_y = geometry.info_top;
    for line in info_lines {
        page.text_right(right, geometry.y(info_y), 9.0, &line);
        info_y += 4.4;
    }

    // Subject line.
    page.text_bold(
        left,
        geometry.y(geometry.subject_top),
        12.0,
        &format!("Rechnung Nr. {}", invoice.number),
    );

    // Body: the note of the invoice, or a standard opening, wrapped inside the text margin.
    let intro = invoice
        .note
        .clone()
        .filter(|note| !note.trim().is_empty())
        .unwrap_or_else(|| {
            "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag.".to_string()
        });
    let max_lines = ((geometry.table_top - geometry.body_top - 4.0) / 4.6).floor() as usize;
    for (index, line) in wrap(&intro, right - left, 10.0)
        .iter()
        .take(max_lines.max(1))
        .enumerate()
    {
        page.text(
            left,
            geometry.y(geometry.body_top + index as f64 * 4.6),
            10.0,
            line,
        );
    }
}

/// Splits `text` into lines that fit `max_width` points at `size`.
fn wrap(text: &str, max_width: f64, size: f64) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in text.split_whitespace() {
        let candidate = if current.is_empty() {
            word.to_string()
        } else {
            format!("{current} {word}")
        };
        if current.is_empty() || text_width(&candidate, size) <= max_width {
            current = candidate;
        } else {
            lines.push(std::mem::take(&mut current));
            current = word.to_string();
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

fn draw_table_header(page: &mut Page, geometry: &LetterGeometry, top: f64) {
    let left = geometry.text_left();
    let right = geometry.text_right();
    let y = geometry.y(top);
    page.text_bold(left, y, 8.0, "Pos.");
    page.text_bold(left + mm(10.0), y, 8.0, "Bezeichnung");
    page.text_right_bold(right - mm(38.0), y, 8.0, "Menge");
    page.text_right_bold(right - mm(22.0), y, 8.0, "Einzelpreis");
    page.text_right_bold(right, y, 8.0, "Betrag");
    page.line(left, geometry.y(top + 2.0), right, 0.6);
}

fn draw_row(
    page: &mut Page,
    line: &crate::domain::invoice::InvoiceLine,
    position: usize,
    geometry: &LetterGeometry,
    row_y: f64,
    currency: &str,
) {
    let left = geometry.text_left();
    let right = geometry.text_right();
    let y = geometry.y(row_y);
    page.text(left, y, 9.0, &position.to_string());
    page.text(left + mm(10.0), y, 9.0, &truncate(&line.description, 48));
    page.text_right(
        right - mm(38.0),
        y,
        9.0,
        &format_quantity(line.quantity_milli),
    );
    page.text_right(
        right - mm(22.0),
        y,
        9.0,
        &line.unit_price.format_localized(currency),
    );
    page.text_right(right, y, 9.0, &line.net().format_localized(currency));
}

fn draw_totals(
    page: &mut Page,
    invoice: &Invoice,
    currency: &str,
    geometry: &LetterGeometry,
    row_y: f64,
) {
    let left = geometry.text_left();
    let right = geometry.text_right();
    let mut totals_y = row_y + 9.0;
    page.text_right(right - mm(24.0), geometry.y(totals_y), 9.0, "Netto");
    page.text_right(
        right,
        geometry.y(totals_y),
        9.0,
        &invoice.total_net().format_localized(currency),
    );
    totals_y += 5.5;
    page.text_right(right - mm(24.0), geometry.y(totals_y), 9.0, "Umsatzsteuer");
    page.text_right(
        right,
        geometry.y(totals_y),
        9.0,
        &invoice.total_tax().format_localized(currency),
    );
    totals_y += 5.5;
    page.text_right_bold(right - mm(24.0), geometry.y(totals_y), 10.0, "Gesamtbetrag");
    page.text_right_bold(
        right,
        geometry.y(totals_y),
        10.0,
        &invoice.total_gross().format_localized(currency),
    );

    page.text(
        left,
        geometry.y(totals_y + 12.0),
        8.5,
        &format!(
            "Bitte überweisen Sie den Gesamtbetrag bis zum {}.",
            format_date(invoice.due_at)
        ),
    );
}

fn draw_footer(
    page: &mut Page,
    company: &CompanyProfile,
    geometry: &LetterGeometry,
    page_number: usize,
    page_count: usize,
) {
    let left = geometry.text_left();
    let right = geometry.text_right();
    let footer_top = geometry.footer_top();
    let footer = [
        company.name.clone(),
        company.street.clone(),
        company.zip_city.clone(),
    ]
    .into_iter()
    .filter(|part| !part.trim().is_empty())
    .collect::<Vec<_>>()
    .join(" · ");
    if !footer.is_empty() {
        page.text(left, geometry.y(footer_top), 7.5, &footer);
    }

    let contact_line = [company.phone.as_str(), company.email.as_str()]
        .into_iter()
        .filter(|part| !part.trim().is_empty())
        .collect::<Vec<_>>()
        .join(" · ");
    if !contact_line.is_empty() {
        page.text(left, geometry.y(footer_top + 3.5), 7.5, &contact_line);
    }

    if !company.tax_id.trim().is_empty() {
        page.text(
            left,
            geometry.y(footer_top + 7.0),
            7.5,
            &format!("Steuernummer: {}", company.tax_id),
        );
    }
    page.text_right(
        right,
        geometry.y(footer_top + 7.0),
        7.5,
        &format!("Seite {page_number} von {page_count}"),
    );
}

fn draw_tokens(
    page: &mut Page,
    layout: &DocumentLayout,
    company: &CompanyProfile,
    invoice: &Invoice,
    geometry: &LetterGeometry,
) {
    for token in &layout.tokens {
        if !token.enabled {
            continue;
        }
        let Some(text) = layout.token_text(token.key, company, Some(invoice)) else {
            continue;
        };
        let text = truncate(&text, 80);
        let size = token.size_pt;
        let anchor = mm(geometry.page_width * token.x_pct / 100.0);
        let x = match token.align {
            TokenAlign::Left => anchor,
            TokenAlign::Center => anchor - text_width(&text, size) / 2.0,
            TokenAlign::Right => anchor - text_width(&text, size),
        };
        let y = geometry.y(geometry.page_height * token.y_pct / 100.0);
        if token.bold {
            page.text_bold(x, y, size, &text);
        } else {
            page.text(x, y, size, &text);
        }
    }
}

/// Renders an invoice with its layout and writes it to `path`.
pub fn write_invoice_pdf_with_layout(
    path: &Path,
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
    layout: &DocumentLayout,
) -> CoreResult<()> {
    let bytes = render_invoice_pdf_with_layout(invoice, recipient, company, layout);
    std::fs::write(path, bytes)?;
    Ok(())
}

/// Renders an invoice and writes it to `path`.
pub fn write_invoice_pdf(
    path: &Path,
    invoice: &Invoice,
    recipient: &Contact,
    company: &CompanyProfile,
) -> CoreResult<()> {
    let bytes = render_invoice_pdf(invoice, recipient, company);
    std::fs::write(path, bytes)?;
    Ok(())
}

fn format_quantity(quantity_milli: i64) -> String {
    let whole = quantity_milli / 1_000;
    let rest = quantity_milli % 1_000;
    if rest == 0 {
        return whole.to_string();
    }
    let fraction = format!("{rest:03}");
    format!("{whole},{}", fraction.trim_end_matches('0'))
}

fn truncate(text: &str, max_chars: usize) -> String {
    if text.chars().count() <= max_chars {
        return text.to_string();
    }
    let mut truncated: String = text.chars().take(max_chars.saturating_sub(1)).collect();
    truncated.push('…');
    truncated
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::contact::ContactKind;
    use crate::domain::invoice::{InvoiceLine, InvoiceStatus};
    use crate::money::Money;
    use crate::pdf::writer::{to_mm, PAGE_HEIGHT_MM, PAGE_WIDTH_MM};
    use uuid::Uuid;

    /// One text placement read back from the content stream, in millimetres from the top left.
    #[derive(Debug)]
    struct Placed {
        x: f64,
        y: f64,
        size: f64,
        text: String,
    }

    /// Reverses the PDF string escapes so the tests compare the printed text.
    fn unescape(text: &str) -> String {
        let mut out = String::new();
        let mut chars = text.chars().peekable();
        while let Some(character) = chars.next() {
            if character != '\\' {
                out.push(character);
                continue;
            }
            match chars.next() {
                Some(digit @ '0'..='7') => {
                    let mut value = digit.to_digit(8).unwrap_or(0);
                    for _ in 0..2 {
                        if let Some(next @ '0'..='7') = chars.peek().copied() {
                            chars.next();
                            value = value * 8 + next.to_digit(8).unwrap_or(0);
                        }
                    }
                    if let Some(character) = char::from_u32(value) {
                        out.push(character);
                    }
                }
                Some(other) => out.push(other),
                None => break,
            }
        }
        out
    }

    fn placed_text(bytes: &[u8]) -> Vec<Placed> {
        let text = String::from_utf8_lossy(bytes);
        let mut placed = Vec::new();
        for line in text.lines() {
            let Some(space) = line.find(" Tm (") else {
                continue;
            };
            let Some(end) = line.rfind(") Tj ET") else {
                continue;
            };
            let numbers: Vec<f64> = line[..space]
                .split_whitespace()
                .filter_map(|token| token.parse::<f64>().ok())
                .collect();
            if numbers.len() < 3 {
                continue;
            }
            let size = numbers[0];
            let x = numbers[numbers.len() - 2];
            let y = numbers[numbers.len() - 1];
            placed.push(Placed {
                x: to_mm(x),
                y: form_b::PAGE_HEIGHT - to_mm(y),
                size,
                text: unescape(&line[space + 5..end]),
            });
        }
        placed
    }

    fn find<'a>(placed: &'a [Placed], needle: &str) -> &'a Placed {
        placed
            .iter()
            .find(|entry| entry.text.contains(needle))
            .unwrap_or_else(|| panic!("{needle} was not placed among {} texts", placed.len()))
    }

    /// Marks read back from the content stream as `(x_start, x_end, distance from top)`.
    fn marks(bytes: &[u8]) -> Vec<(f64, f64, f64)> {
        let text = String::from_utf8_lossy(bytes);
        let mut marks = Vec::new();
        for line in text.lines() {
            let Some(rest) = line.strip_prefix("0.60 G 0.4 w ") else {
                continue;
            };
            let numbers: Vec<f64> = rest
                .split_whitespace()
                .filter_map(|token| token.parse::<f64>().ok())
                .collect();
            if numbers.len() < 4 {
                continue;
            }
            marks.push((
                to_mm(numbers[0]),
                to_mm(numbers[2]),
                form_b::PAGE_HEIGHT - to_mm(numbers[1]),
            ));
        }
        marks
    }

    fn close(actual: f64, expected: f64) -> bool {
        (actual - expected).abs() < 0.05
    }

    fn sample_company() -> CompanyProfile {
        CompanyProfile {
            name: "Müller & Söhne GmbH".to_string(),
            street: "Hauptstraße 5".to_string(),
            zip_city: "39100 Bozen".to_string(),
            phone: "+39 0471 123456".to_string(),
            email: "rechnung@example.com".to_string(),
            tax_id: "IT01234567890".to_string(),
            ..CompanyProfile::default()
        }
    }

    fn sample_recipient() -> Contact {
        let mut contact = Contact::new(ContactKind::Company, 0);
        contact.company_name = Some("Beispiel GmbH".to_string());
        contact.street = Some("Hauptstrasse 5".to_string());
        contact.zip = Some("10115".to_string());
        contact.city = Some("Berlin".to_string());
        contact
    }

    fn sample_invoice() -> Invoice {
        Invoice {
            id: Uuid::new_v4(),
            number: "2026-0001".to_string(),
            contact_id: Uuid::new_v4(),
            status: InvoiceStatus::Sent,
            issued_at: 1_760_000_000_000,
            due_at: 1_762_000_000_000,
            currency_symbol: "€".to_string(),
            note: None,
            lines: vec![
                InvoiceLine {
                    description: "Beratung".to_string(),
                    quantity_milli: 1_500,
                    unit_price: Money::from_cents(8_000),
                    tax_rate_bp: 1900,
                },
                InvoiceLine {
                    description: "Material".to_string(),
                    quantity_milli: 1_000,
                    unit_price: Money::from_cents(1_250),
                    tax_rate_bp: 1900,
                },
            ],
        }
    }

    fn invoice_with_positions(count: usize) -> Invoice {
        let mut invoice = sample_invoice();
        invoice.lines = (1..=count)
            .map(|index| InvoiceLine {
                description: format!("Posten {index}"),
                quantity_milli: 1_000,
                unit_price: Money::from_cents(1_000),
                tax_rate_bp: 1900,
            })
            .collect();
        invoice
    }

    fn sample_png(directory: &std::path::Path) -> std::path::PathBuf {
        std::fs::create_dir_all(directory).expect("temp dir");
        let background = directory.join("briefpapier.png");
        let file = std::fs::File::create(&background).expect("png file");
        let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), 8, 6);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().expect("png header");
        writer
            .write_image_data(&[220u8; 8 * 6 * 3])
            .expect("png data");
        background
    }

    #[test]
    fn geometry_matches_din_5008_form_b() {
        let geometry = LetterGeometry::form_b();
        let expected = [
            ("page width", geometry.page_width, 210.0),
            ("page height", geometry.page_height, 297.0),
            ("letterhead", geometry.letterhead_height, 45.0),
            ("left margin", geometry.left_margin, 25.0),
            ("right margin", geometry.right_margin, 20.0),
            ("address top", geometry.address_top, 45.0),
            ("address left", geometry.address_left, 20.0),
            ("address width", geometry.address_width, 85.0),
            ("address height", geometry.address_height, 45.0),
            ("address zone", geometry.address_zone_top, 62.7),
            ("return line", geometry.return_line_top, 43.0),
            ("info top", geometry.info_top, 50.0),
            ("info left", geometry.info_left, 125.0),
            ("info width", geometry.info_max_width, 75.0),
            ("subject top", geometry.subject_top, 98.46),
            ("fold mark 1", geometry.fold_mark_one, 105.0),
            ("fold mark 2", geometry.fold_mark_two, 210.0),
            ("hole mark", geometry.hole_mark, 148.5),
            ("last text line", geometry.last_text_line, 257.0),
        ];
        for (name, actual, norm) in expected {
            assert!(close(actual, norm), "{name}: {actual} mm, norm {norm} mm");
        }
        assert!(close(geometry.hole_mark, geometry.page_height / 2.0));
        // The hole mark sits 43.5 mm below the first fold mark of form B; the 8.7 mm (0.87 cm)
        // difference belongs to form A, whose first fold mark is 87 mm from the top.
        assert!(close(geometry.hole_mark - geometry.fold_mark_one, 43.5));
        assert!(!close(geometry.hole_mark - geometry.fold_mark_one, 8.7));
        // The writer and the geometry agree on the sheet.
        assert!(close(geometry.page_width, PAGE_WIDTH_MM));
        assert!(close(geometry.page_height, PAGE_HEIGHT_MM));
        assert!(geometry.text_left() < geometry.text_right());
    }

    #[test]
    fn pagination_keeps_room_for_the_totals_and_the_footer() {
        let geometry = LetterGeometry::form_b();
        let first = geometry.rows_per_page(true);
        let continuation = geometry.rows_per_page(false);
        assert_eq!(first, 13);
        assert_eq!(continuation, 27);

        let last_row = geometry.table_bottom - geometry.totals_height;
        let first_end = geometry.table_top + 8.0 + first as f64 * geometry.row_height;
        assert!(
            first_end - geometry.row_height <= last_row,
            "rows of the first page stay above {last_row} mm"
        );
        let continuation_end =
            geometry.continuation_table_top + 8.0 + continuation as f64 * geometry.row_height;
        assert!(continuation_end - geometry.row_height <= last_row);
        // Totals end below the table but above the last text line.
        assert!(geometry.table_bottom + 6.0 <= geometry.last_text_line);

        assert_eq!(geometry.paginate(0), vec![(0, 0)]);
        assert_eq!(geometry.paginate(5), vec![(0, 5)]);
        assert_eq!(geometry.paginate(first).len(), 1);
        assert_eq!(geometry.paginate(first + 1).len(), 2);
        assert_eq!(geometry.paginate(60).len(), 3);
        let total: usize = geometry.paginate(60).iter().map(|(s, e)| e - s).sum();
        assert_eq!(total, 60, "no row is lost or duplicated");
    }

    #[test]
    fn renders_the_address_field_subject_date_and_footer_at_the_norm_positions() {
        let geometry = LetterGeometry::form_b();
        let bytes = render_invoice_pdf(&sample_invoice(), &sample_recipient(), &sample_company());
        let placed = placed_text(&bytes);

        // Sender line and footer carry the same text, so they are told apart by their position.
        let sender = placed
            .iter()
            .find(|entry| close(entry.y, geometry.return_line_top))
            .expect("return-sender line");
        assert!(sender.text.contains("Müller"), "{}", sender.text);
        assert!(close(sender.x, geometry.left_margin));

        let address = find(&placed, "Beispiel GmbH");
        assert!(close(address.y, geometry.address_top + 3.5));
        assert!(close(address.x, geometry.left_margin));
        assert!(close(address.size, 11.0));

        let street = find(&placed, "Hauptstrasse 5");
        assert!(close(street.y, geometry.address_top + 3.5 + 4.6));

        let invoice_number = find(&placed, "Rechnungsnummer");
        assert!(close(invoice_number.y, geometry.info_top));
        let info_end =
            invoice_number.x + to_mm(text_width(&invoice_number.text, invoice_number.size));
        assert!(
            close(info_end, geometry.page_width - geometry.right_margin),
            "info end {info_end} mm, expected {} mm (x {}, size {}, {} chars)",
            geometry.page_width - geometry.right_margin,
            invoice_number.x,
            invoice_number.size,
            invoice_number.text.chars().count()
        );
        let date = find(&placed, "Rechnungsdatum");
        assert!(close(date.y, geometry.info_top + 4.4));
        let due = find(&placed, "Fällig am");
        assert!(close(due.y, geometry.info_top + 8.8));

        let subject = find(&placed, "Rechnung Nr. 2026-0001");
        assert!(close(subject.y, geometry.subject_top), "{}", subject.y);
        assert!(close(subject.x, geometry.left_margin));

        let intro = find(&placed, "Sehr geehrte Damen und Herren");
        assert!(close(intro.y, geometry.body_top));

        let footer = placed
            .iter()
            .find(|entry| close(entry.y, geometry.footer_top()))
            .expect("footer line");
        assert!(footer.text.contains("Hauptstraße 5"), "{}", footer.text);
        let page_number = find(&placed, "Seite 1 von 1");
        assert!(close(page_number.y, geometry.footer_top() + 7.0));
        assert!(close(
            page_number.x + to_mm(text_width(&page_number.text, page_number.size)),
            geometry.page_width - geometry.right_margin
        ));

        for entry in placed
            .iter()
            .filter(|entry| entry.y < geometry.footer_top() - 0.05)
        {
            let end = entry.x + to_mm(text_width(&entry.text, entry.size));
            assert!(
                entry.x >= geometry.left_margin - 0.05,
                "{} starts at {} mm",
                entry.text,
                entry.x
            );
            assert!(
                end <= geometry.page_width - geometry.right_margin + 0.05,
                "{} ends at {} mm",
                entry.text,
                end
            );
            assert!(
                entry.y <= geometry.last_text_line + 0.05,
                "{} is below the last text line at {} mm",
                entry.text,
                entry.y
            );
        }
    }

    #[test]
    fn draws_fold_and_hole_marks_in_the_binding_margin() {
        let geometry = LetterGeometry::form_b();
        let bytes = render_invoice_pdf(&sample_invoice(), &sample_recipient(), &sample_company());
        let marks = marks(&bytes);
        assert_eq!(marks.len(), 3, "one mark per position on a single page");

        let expected = [
            geometry.fold_mark_one,
            geometry.hole_mark,
            geometry.fold_mark_two,
        ];
        for ((start, end, distance), norm) in marks.iter().zip(expected) {
            assert!(
                close(*distance, norm),
                "mark at {distance} mm, norm {norm} mm"
            );
            assert!(close(*start, geometry.mark_left));
            assert!(close(*end, geometry.mark_left + geometry.mark_length));
            assert!(
                *end <= geometry.left_margin,
                "marks stay inside the binding margin"
            );
        }
    }

    #[test]
    fn continues_the_position_table_on_further_pages_with_repeated_headers() {
        let directory = std::env::temp_dir().join(format!("socdof-multipage-{}", Uuid::new_v4()));
        let background = sample_png(&directory);
        let mut layout = DocumentLayout {
            letterhead_image: background.to_string_lossy().to_string(),
            ..Default::default()
        };
        for token in &mut layout.tokens {
            token.enabled = matches!(
                token.key,
                crate::document_layout::TokenKey::CompanyName
                    | crate::document_layout::TokenKey::InvoiceNumber
            );
        }

        let invoice = invoice_with_positions(60);
        let bytes = render_invoice_pdf_with_layout(
            &invoice,
            &sample_recipient(),
            &sample_company(),
            &layout,
        );
        let text = String::from_utf8_lossy(&bytes);

        assert!(text.contains("/Count 3"), "60 positions span three pages");
        assert_eq!(text.matches("/Type /Page /Parent").count(), 3);
        assert_eq!(text.matches("Bezeichnung").count(), 3, "header repeats");
        assert_eq!(
            text.matches("/Bg Do").count(),
            3,
            "letterhead on every page"
        );
        assert_eq!(text.matches("Seite 1 von 3").count(), 1);
        assert_eq!(text.matches("Seite 2 von 3").count(), 1);
        assert_eq!(text.matches("Seite 3 von 3").count(), 1);
        assert_eq!(text.matches("Umsatzsteuer").count(), 1, "totals only once");
        assert_eq!(
            text.matches("Rechnungsnummer:").count(),
            1,
            "address and info block only on page one"
        );
        assert!(text.contains("Posten 13"));
        assert!(text.contains("Posten 14"));
        assert!(text.contains("Posten 60"));
        assert_eq!(
            text.matches("Rechnung Nr. 2026-0001").count(),
            4,
            "subject once plus the token on three pages"
        );
        assert_eq!(marks(&bytes).len(), 9, "marks on every page");

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn a_long_letter_never_reaches_the_footer_area() {
        let geometry = LetterGeometry::form_b();
        let bytes = render_invoice_pdf(
            &invoice_with_positions(60),
            &sample_recipient(),
            &sample_company(),
        );
        let placed = placed_text(&bytes);
        assert!(placed.len() > 100, "every page carries its rows");

        for entry in placed
            .iter()
            .filter(|entry| entry.y < geometry.footer_top() - 0.05)
        {
            assert!(
                entry.y <= geometry.last_text_line + 0.05,
                "{} sits at {} mm, below the last text line {}",
                entry.text,
                entry.y,
                geometry.last_text_line
            );
            assert!(
                entry.y + 2.0 <= geometry.footer_top(),
                "{} reaches into the footer area at {} mm",
                entry.text,
                entry.y
            );
        }

        let totals = find(&placed, "Gesamtbetrag");
        assert!(
            totals.y + 12.0 <= geometry.last_text_line,
            "the closing line stays above the last text line"
        );
        for page in 1..=3 {
            let page_number = format!("Seite {page} von 3");
            let entry = find(&placed, &page_number);
            assert!(close(entry.y, geometry.footer_top() + 7.0));
        }
    }

    #[test]
    fn wraps_a_long_note_inside_the_text_margin() {
        let geometry = LetterGeometry::form_b();
        let mut invoice = sample_invoice();
        invoice.note = Some(
            "Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag und das entgegengebrachte \
             Vertrauen. Die Leistungen wurden vollständig erbracht und werden hiermit in Rechnung \
             gestellt. Für Rückfragen stehen wir Ihnen jederzeit gerne zur Verfügung."
                .to_string(),
        );
        let bytes = render_invoice_pdf(&invoice, &sample_recipient(), &sample_company());
        let placed = placed_text(&bytes);
        let body: Vec<&Placed> = placed
            .iter()
            .filter(|entry| {
                close(entry.size, 10.0)
                    && entry.y >= geometry.body_top - 0.05
                    && entry.y < geometry.table_top
            })
            .collect();
        assert!(body.len() >= 3, "the note wraps into several lines");
        for entry in body {
            let end = entry.x + to_mm(text_width(&entry.text, entry.size));
            assert!(
                end <= geometry.page_width - geometry.right_margin + 0.05,
                "{} ends at {end} mm (x {}, size {}, {} chars)",
                entry.text,
                entry.x,
                entry.size,
                entry.text.chars().count()
            );
            assert!(
                entry.y < geometry.table_top,
                "wrapped text stays above the table"
            );
        }
    }

    #[test]
    fn renders_invoice_content_in_din5008_layout() {
        let bytes = render_invoice_pdf(&sample_invoice(), &sample_recipient(), &sample_company());
        let text = String::from_utf8(bytes).expect("pdf is ascii");

        assert!(text.starts_with("%PDF-1.4"));
        assert!(text.contains("/MediaBox [0 0 595.28 841.89]"));
        assert!(text.contains("Rechnung Nr. 2026-0001"));
        assert!(text.contains("Beispiel GmbH"));
        assert!(text.contains("Hauptstrasse 5"));
        assert!(text.contains("10115 Berlin"));
        assert!(text.contains("157,68"));
        assert!(text.contains("132,50"));
        assert!(text.contains("25,18"));
        assert!(text.contains("M\\374ller & S\\366hne GmbH"));
        assert!(text.contains("/Count 1"));
        assert!(text.contains("Seite 1 von 1"));
        assert!(text.ends_with("%%EOF\n"));
    }

    #[test]
    fn references_a_valid_xref_table() {
        let bytes = render_invoice_pdf(&sample_invoice(), &sample_recipient(), &sample_company());
        let text = String::from_utf8(bytes).expect("pdf is ascii");

        let start = text.rfind("startxref").expect("startxref");
        let offset: usize = text[start + "startxref".len()..]
            .split_whitespace()
            .next()
            .expect("offset")
            .parse()
            .expect("number");

        assert_eq!(&text[offset..offset + 4], "xref");
        assert!(text[offset..].contains("0000000000 65535 f"));
    }

    #[test]
    fn writes_a_readable_file() {
        let directory = std::env::temp_dir().join(format!("socdof-pdf-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&directory).expect("temp dir");
        let path = directory.join("rechnung.pdf");

        write_invoice_pdf(
            &path,
            &sample_invoice(),
            &sample_recipient(),
            &sample_company(),
        )
        .expect("written");

        let metadata = std::fs::metadata(&path).expect("file exists");
        assert!(metadata.len() > 1_000);

        let bytes = std::fs::read(&path).expect("read");
        assert_eq!(&bytes[..8], b"%PDF-1.4");
        assert!(bytes.windows(5).any(|window| window == b"%%EOF"));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn prints_the_letterhead_background_and_placed_tokens() {
        let directory = std::env::temp_dir().join(format!("socdof-layout-{}", Uuid::new_v4()));
        let background = sample_png(&directory);

        let mut layout = DocumentLayout {
            letterhead_image: background.to_string_lossy().to_string(),
            ..Default::default()
        };
        for token in &mut layout.tokens {
            token.enabled = matches!(
                token.key,
                crate::document_layout::TokenKey::CompanyName
                    | crate::document_layout::TokenKey::InvoiceNumber
            );
        }
        let bytes = render_invoice_pdf_with_layout(
            &sample_invoice(),
            &sample_recipient(),
            &sample_company(),
            &layout,
        );
        let text = String::from_utf8_lossy(&bytes);
        assert!(text.contains("/Subtype /Image"));
        assert!(text.contains("/Bg Do"));
        assert!(text.contains("M\\374ller & S\\366hne GmbH"));
        assert!(text.contains("Rechnung Nr. 2026-0001"));
        assert!(text.ends_with("%%EOF\n"));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn formats_quantities_and_truncates_long_descriptions() {
        assert_eq!(format_quantity(1_000), "1");
        assert_eq!(format_quantity(1_500), "1,5");
        assert_eq!(format_quantity(2_250), "2,25");
        assert_eq!(truncate("kurz", 10), "kurz");
        assert_eq!(truncate("abcdefghij", 5), "abcd…");
    }
}
