//! Word documents (`.docx`) without third-party dependencies.
//!
//! The TypeScript application never wrote a real Word package: it exported its invoice HTML as a
//! file named `.doc` with the `application/msword` type, and only *read* `.docx` files, for the
//! invoice template import. This module closes that gap on both sides:
//!
//! * [`write_invoice_docx`] writes a valid OOXML package — the ZIP parts, relationships, content
//!   types, styles and document properties — with the same values the DIN 5008 PDF prints: invoice
//!   number, dates, recipient, positions with quantities, unit prices and amounts, the totals block,
//!   the payment note and the company footer.
//! * [`read_docx`] turns a Word file, written here or by another tool, back into [`Document`] blocks
//!   so the app can reuse the text, headings and tables of an imported template.
//!
//! The package is built from `zip`, `xml`, `writer` and `reader`; [`Document`] is the neutral model
//! both sides share, which makes a write → read round trip directly comparable.

pub mod reader;
pub mod writer;
mod xml;
mod zip;

use std::fmt::{self, Display, Formatter};
use std::path::Path;

use crate::date::civil_from_millis;
use crate::domain::contact::Contact;
use crate::domain::invoice::Invoice;
use crate::domain::settings::CompanyProfile;

/// Inline text with the run properties Word stores per run.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Run {
    /// Text of the run.
    pub text: String,
    /// Bold text (`w:b`).
    pub bold: bool,
    /// Italic text (`w:i`).
    pub italic: bool,
}

impl Run {
    /// Creates a plain run.
    pub fn plain(text: impl Into<String>) -> Self {
        Run {
            text: text.into(),
            bold: false,
            italic: false,
        }
    }

    /// Creates a bold run.
    pub fn bold(text: impl Into<String>) -> Self {
        Run {
            text: text.into(),
            bold: true,
            italic: false,
        }
    }
}

/// One paragraph of a table cell.
pub type Cell = Vec<Vec<Run>>;

/// One row of a table, one entry per cell.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Row {
    /// Cells of the row, each a list of paragraphs of runs.
    pub cells: Vec<Cell>,
}

impl Row {
    /// Text of a cell, paragraphs joined by a space.
    pub fn cell_text(&self, column: usize) -> String {
        self.cells
            .get(column)
            .map(|paragraphs| {
                paragraphs
                    .iter()
                    .flatten()
                    .map(|run| run.text.as_str())
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default()
    }
}

/// A table with rows of cells.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Table {
    /// Rows in document order.
    pub rows: Vec<Row>,
}

impl Table {
    /// Text of one cell; empty when the coordinates are outside the table.
    pub fn cell(&self, row: usize, column: usize) -> String {
        self.rows
            .get(row)
            .map(|row| row.cell_text(column))
            .unwrap_or_default()
    }

    /// Number of columns of the widest row.
    pub fn columns(&self) -> usize {
        self.rows
            .iter()
            .map(|row| row.cells.len())
            .max()
            .unwrap_or(0)
    }
}

/// A block of a Word document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Block {
    /// A heading with its outline level (`1` is `Heading1`).
    Heading {
        /// Outline level, one or higher.
        level: u8,
        /// Inline content.
        runs: Vec<Run>,
    },
    /// A body paragraph.
    Paragraph {
        /// Inline content.
        runs: Vec<Run>,
    },
    /// A table.
    Table(Table),
    /// An explicit page break.
    PageBreak,
}

impl Block {
    /// The runs of a heading or paragraph, empty for tables and page breaks.
    pub fn runs(&self) -> &[Run] {
        match self {
            Block::Heading { runs, .. } | Block::Paragraph { runs } => runs,
            Block::Table(_) | Block::PageBreak => &[],
        }
    }

    /// The plain text of the block.
    pub fn text(&self) -> String {
        match self {
            Block::Heading { runs, .. } | Block::Paragraph { runs } => {
                runs.iter().map(|run| run.text.as_str()).collect()
            }
            Block::Table(table) => table
                .rows
                .iter()
                .map(|row| {
                    (0..row.cells.len())
                        .map(|column| row.cell_text(column))
                        .collect::<Vec<_>>()
                        .join("\t")
                })
                .collect::<Vec<_>>()
                .join("\n"),
            Block::PageBreak => String::new(),
        }
    }
}

/// Document properties of the package.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Metadata {
    /// `dc:title` of `docProps/core.xml`.
    pub title: String,
    /// `dc:creator` of `docProps/core.xml`.
    pub creator: String,
    /// `dcterms:created` as written in the package (W3CDTF).
    pub created: String,
}

/// A parsed Word document.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Document {
    /// Body blocks in document order.
    pub blocks: Vec<Block>,
    /// Package metadata.
    pub metadata: Metadata,
}

impl Document {
    /// All paragraphs and headings with their text, tables skipped.
    pub fn paragraphs(&self) -> Vec<String> {
        self.blocks
            .iter()
            .filter(|block| !matches!(block, Block::Table(_)))
            .map(|block| block.text())
            .filter(|text| !text.trim().is_empty())
            .collect()
    }

    /// The whole text of the document, one line per paragraph and table row.
    pub fn plain_text(&self) -> String {
        self.blocks
            .iter()
            .map(|block| block.text())
            .filter(|text| !text.is_empty())
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// The first table of the document.
    pub fn first_table(&self) -> Option<&Table> {
        self.blocks.iter().find_map(|block| match block {
            Block::Table(table) => Some(table),
            _ => None,
        })
    }

    /// The blocks of a given heading level, in order.
    pub fn headings(&self) -> Vec<(u8, String)> {
        self.blocks
            .iter()
            .filter_map(|block| match block {
                Block::Heading { level, runs } => {
                    Some((*level, runs.iter().map(|run| run.text.as_str()).collect()))
                }
                _ => None,
            })
            .collect()
    }
}

/// Reasons a package cannot be written or read.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DocxError {
    /// The bytes are not a ZIP container at all.
    NotAPackage,
    /// The container has no end-of-central-directory record or a broken entry.
    Damaged(String),
    /// A part the document needs is missing.
    MissingPart(String),
    /// The entry uses a compression method this reader does not implement.
    UnsupportedCompression(u16),
    /// A part is not well-formed XML.
    Xml(String),
    /// The file could not be read or written.
    Io(String),
}

impl Display for DocxError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            DocxError::NotAPackage => write!(formatter, "the file is not a ZIP package"),
            DocxError::Damaged(reason) => write!(formatter, "damaged package: {reason}"),
            DocxError::MissingPart(part) => write!(formatter, "the package has no {part}"),
            DocxError::UnsupportedCompression(method) => {
                write!(formatter, "compression method {method} is not supported")
            }
            DocxError::Xml(reason) => write!(formatter, "invalid XML: {reason}"),
            DocxError::Io(reason) => write!(formatter, "io error: {reason}"),
        }
    }
}

impl std::error::Error for DocxError {}

/// Writes the invoice as a Word package to `path`.
pub fn write_invoice_docx(
    path: &Path,
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
) -> Result<(), DocxError> {
    let bytes = invoice_docx_bytes(invoice, contact, company)?;
    std::fs::write(path, bytes).map_err(|error| DocxError::Io(error.to_string()))
}

/// Builds the Word package of an invoice in memory.
pub fn invoice_docx_bytes(
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
) -> Result<Vec<u8>, DocxError> {
    writer::write(&invoice_document(invoice, contact, company))
}

/// The invoice as a document, with the values the DIN 5008 PDF prints.
pub fn invoice_document(
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
) -> Document {
    let currency = if invoice.currency_symbol.trim().is_empty() {
        &company.currency
    } else {
        &invoice.currency_symbol
    };
    let recipient = [
        contact.display_name(),
        contact.street.clone().unwrap_or_default(),
        [contact.zip.clone(), contact.city.clone()]
            .into_iter()
            .flatten()
            .filter(|part| !part.trim().is_empty())
            .collect::<Vec<_>>()
            .join(" "),
        contact.country.clone().unwrap_or_default(),
    ]
    .into_iter()
    .filter(|line| !line.trim().is_empty())
    .collect::<Vec<_>>();

    let intro = invoice
        .note
        .as_deref()
        .map(str::trim)
        .filter(|note| !note.is_empty())
        .unwrap_or("Sehr geehrte Damen und Herren, vielen Dank für Ihren Auftrag.");

    let mut blocks = vec![
        Block::Heading {
            level: 1,
            runs: vec![Run::plain(format!("Rechnung Nr. {}", invoice.number))],
        },
        Block::Paragraph {
            runs: vec![Run::plain(recipient.join("\n"))],
        },
        Block::Paragraph {
            runs: vec![Run::plain(format!("Rechnungsnummer: {}", invoice.number))],
        },
        Block::Paragraph {
            runs: vec![Run::plain(format!(
                "Rechnungsdatum: {}",
                crate::date::format_date(invoice.issued_at)
            ))],
        },
        Block::Paragraph {
            runs: vec![Run::plain(format!(
                "Fällig am: {}",
                crate::date::format_date(invoice.due_at)
            ))],
        },
        Block::Paragraph {
            runs: vec![Run::plain(intro)],
        },
        Block::Heading {
            level: 2,
            runs: vec![Run::plain("Positionen")],
        },
    ];

    let mut positions = Row {
        cells: ["Pos.", "Bezeichnung", "Menge", "Einzelpreis", "Betrag"]
            .into_iter()
            .map(|label| vec![vec![Run::bold(label)]])
            .collect(),
    };
    positions.cells.truncate(5);
    let mut rows = vec![positions];
    for (index, line) in invoice.lines.iter().enumerate() {
        rows.push(Row {
            cells: vec![
                vec![vec![Run::plain((index + 1).to_string())]],
                vec![vec![Run::plain(line.description.trim())]],
                vec![vec![Run::plain(format_quantity(line.quantity_milli))]],
                vec![vec![Run::plain(line.unit_price.format_localized(currency))]],
                vec![vec![Run::plain(line.net().format_localized(currency))]],
            ],
        });
    }
    blocks.push(Block::Table(Table { rows }));

    blocks.push(Block::Table(Table {
        rows: vec![
            totals_row("Netto", invoice.total_net(), currency, false),
            totals_row("Umsatzsteuer", invoice.total_tax(), currency, false),
            totals_row("Gesamtbetrag", invoice.total_gross(), currency, true),
        ],
    }));

    blocks.push(Block::Paragraph {
        runs: vec![Run::plain(format!(
            "Bitte überweisen Sie den Gesamtbetrag bis zum {}.",
            crate::date::format_date(invoice.due_at)
        ))],
    });

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
        blocks.push(Block::Paragraph {
            runs: vec![Run::plain(footer)],
        });
    }
    if !company.tax_id.trim().is_empty() {
        blocks.push(Block::Paragraph {
            runs: vec![Run::plain(format!(
                "Steuernummer: {}",
                company.tax_id.trim()
            ))],
        });
    }

    Document {
        blocks,
        metadata: Metadata {
            title: format!("Rechnung {}", invoice.number),
            creator: company.name.clone(),
            created: w3cdtf(invoice.issued_at),
        },
    }
}

fn totals_row(label: &str, amount: crate::money::Money, currency: &str, bold: bool) -> Row {
    let text = amount.format_localized(currency);
    let run = |value: String| {
        vec![vec![if bold {
            Run::bold(value)
        } else {
            Run::plain(value)
        }]]
    };
    Row {
        cells: vec![run(label.to_string()), run(text)],
    }
}

/// Formats a quantity like the PDF does: `2`, `2,5`, `0,125`.
fn format_quantity(quantity_milli: i64) -> String {
    let whole = quantity_milli / 1_000;
    let rest = quantity_milli % 1_000;
    if rest == 0 {
        return whole.to_string();
    }
    format!("{whole},{}", format!("{rest:03}").trim_end_matches('0'))
}

/// Milliseconds since the epoch as a W3CDTF timestamp.
fn w3cdtf(millis: i64) -> String {
    let (year, month, day) = civil_from_millis(millis);
    let seconds = millis.div_euclid(1_000).rem_euclid(86_400);
    format!(
        "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}Z",
        seconds / 3_600,
        seconds % 3_600 / 60,
        seconds % 60
    )
}

/// Reads a Word document from `path`.
pub fn read_docx_file(path: &Path) -> Result<Document, DocxError> {
    let bytes = std::fs::read(path).map_err(|error| DocxError::Io(error.to_string()))?;
    read_docx(&bytes)
}

/// Reads a Word document from its package bytes.
pub fn read_docx(bytes: &[u8]) -> Result<Document, DocxError> {
    reader::read(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantities_use_the_german_decimal_comma() {
        assert_eq!(format_quantity(2_000), "2");
        assert_eq!(format_quantity(2_500), "2,5");
        assert_eq!(format_quantity(2_550), "2,55");
        assert_eq!(format_quantity(125), "0,125");
    }

    #[test]
    fn timestamps_are_written_as_w3cdtf() {
        assert_eq!(w3cdtf(0), "1970-01-01T00:00:00Z");
        // 1700000000 seconds since the epoch is 2023-11-14T22:13:20Z.
        assert_eq!(w3cdtf(1_700_000_000_000), "2023-11-14T22:13:20Z");
    }
}
