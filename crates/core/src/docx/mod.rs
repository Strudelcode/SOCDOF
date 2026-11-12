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
use crate::invoice_template::{
    asset_bytes, default_template, layout_stationery_token, InvoiceTemplate,
};
use crate::rich_html::{
    block_margins, layout_container, AlignItems, ContainerKind, FlexDirection, RichBlock,
    RichContainer, TextRun, DIN5008_TEXT_WIDTH_PT,
};

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

/// Vertical alignment of the content of a [`LayoutCell`] (`w:vAlign`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CellVAlign {
    /// Top aligned (`flex-start`/`stretch`).
    #[default]
    Top,
    /// Vertically centred (`align-items: center`).
    Center,
    /// Bottom aligned (`align-items: flex-end`).
    Bottom,
}

impl CellVAlign {
    /// The `w:vAlign` value of the alignment.
    pub fn as_str(self) -> &'static str {
        match self {
            CellVAlign::Top => "top",
            CellVAlign::Center => "center",
            CellVAlign::Bottom => "bottom",
        }
    }
}

/// One cell of a [`LayoutTable`].
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct LayoutCell {
    /// Cell width in twips, including its margins.
    pub width: i64,
    /// Cell margins in twips: left, top, right, bottom.
    pub margin: [i64; 4],
    /// Vertical alignment of the content.
    pub valign: CellVAlign,
    /// Cell content; may contain nested blocks and tables.
    pub blocks: Vec<Block>,
}

/// One row of a [`LayoutTable`].
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct LayoutRow {
    /// Cells from left to right; spacer cells keep the flex/grid offsets.
    pub cells: Vec<LayoutCell>,
    /// Minimum row height in twips; zero leaves the height to Word.
    pub height: i64,
}

/// A borderless, fixed-width table that linearizes a flex row or a CSS grid.
///
/// Word has no flex layout, but a table with fixed cell widths and no borders is the structural
/// equivalent of the columns the shared layout plan computes for the preview and the PDF.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct LayoutTable {
    /// Rows from top to bottom.
    pub rows: Vec<LayoutRow>,
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
    /// A borderless, fixed-width layout table for a flex/grid container.
    LayoutTable(LayoutTable),
    /// Vertical whitespace for an explicit CSS margin.
    Spacer {
        /// Height in twips.
        twips: i64,
    },
    /// An explicit page break.
    PageBreak,
}

impl Block {
    /// The runs of a heading or paragraph, empty for tables and page breaks.
    pub fn runs(&self) -> &[Run] {
        match self {
            Block::Heading { runs, .. } | Block::Paragraph { runs } => runs,
            Block::Table(_) | Block::LayoutTable(_) | Block::PageBreak | Block::Spacer { .. } => {
                &[]
            }
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
            Block::LayoutTable(table) => table
                .rows
                .iter()
                .map(|row| {
                    row.cells
                        .iter()
                        .map(|cell| {
                            cell.blocks
                                .iter()
                                .map(Block::text)
                                .collect::<Vec<_>>()
                                .join(" ")
                        })
                        .collect::<Vec<_>>()
                        .join("\t")
                })
                .collect::<Vec<_>>()
                .join("\n"),
            Block::PageBreak | Block::Spacer { .. } => String::new(),
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

/// An embedded image of a Word package.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct DocxImage {
    /// PNG bytes stored under `word/media/`.
    pub png: Vec<u8>,
    /// Pixel width of the image.
    pub width: u32,
    /// Pixel height of the image.
    pub height: u32,
    /// Logo alignment (`left`, `center` or `right`); empty for stationery.
    pub position: String,
}

impl DocxImage {
    /// Encodes a decoded RGB image as PNG.
    pub fn from_rgb(width: u32, height: u32, rgb: &[u8]) -> Option<Self> {
        let expected = width as usize * height as usize * 3;
        if rgb.len() != expected || width == 0 || height == 0 {
            return None;
        }
        let mut bytes = Vec::new();
        let mut encoder = png::Encoder::new(std::io::Cursor::new(&mut bytes), width, height);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().ok()?;
        writer.write_image_data(rgb).ok()?;
        writer.finish().ok()?;
        Some(DocxImage {
            png: bytes,
            width,
            height,
            position: String::new(),
        })
    }
}

/// A stationery text field resolved for the Word package.
#[derive(Debug, Clone, PartialEq)]
pub struct DocxToken {
    /// Text printed on the first page.
    pub text: String,
    /// Left edge in percent of the page width.
    pub x_pct: f64,
    /// Top edge in percent of the page height.
    pub y_pct: f64,
    /// Optional width in percent of the page width.
    pub width_pct: Option<f64>,
    /// Font size in CSS pixels.
    pub font_size_px: f64,
    /// Whether the text prints in bold.
    pub bold: bool,
    /// Text colour.
    pub color: [u8; 3],
    /// Horizontal alignment: `left`, `center` or `right`.
    pub align: String,
}

/// A parsed Word document.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Document {
    /// Body blocks in document order.
    pub blocks: Vec<Block>,
    /// Package metadata.
    pub metadata: Metadata,
    /// Logo embedded in the first-page header; empty when no readable image was supplied.
    pub logo: Option<DocxImage>,
    /// Stationery background, embedded in the first-page and the default header.
    pub stationery: Option<DocxImage>,
    /// Stationery text fields drawn on the first page.
    pub tokens: Vec<DocxToken>,
}

impl Document {
    /// All paragraphs and headings with their text, tables skipped.
    pub fn paragraphs(&self) -> Vec<String> {
        self.blocks
            .iter()
            .filter(|block| !matches!(block, Block::Table(_) | Block::LayoutTable(_)))
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
    write_invoice_docx_with_template(path, invoice, contact, company, &default_template())
}

/// Writes the invoice as a Word package using an invoice template.
pub fn write_invoice_docx_with_template(
    path: &Path,
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
    template: &InvoiceTemplate,
) -> Result<(), DocxError> {
    let bytes = invoice_docx_bytes_with_template(invoice, contact, company, template)?;
    std::fs::write(path, bytes).map_err(|error| DocxError::Io(error.to_string()))
}

/// Builds the Word package of an invoice in memory.
pub fn invoice_docx_bytes(
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
) -> Result<Vec<u8>, DocxError> {
    invoice_docx_bytes_with_template(invoice, contact, company, &default_template())
}

/// Builds the Word package of an invoice with a template in memory.
pub fn invoice_docx_bytes_with_template(
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
    template: &InvoiceTemplate,
) -> Result<Vec<u8>, DocxError> {
    writer::write(&invoice_document_with_template(
        invoice, contact, company, template,
    ))
}

/// Reads one part of a package, for relationship and media checks.
pub fn read_part(bytes: &[u8], name: &str) -> Result<Option<Vec<u8>>, DocxError> {
    zip::read(bytes, name)
}

/// The invoice as a document, with the values the DIN 5008 PDF prints.
pub fn invoice_document(
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
) -> Document {
    invoice_document_with_template(invoice, contact, company, &default_template())
}

/// The invoice as a template-aware Word document.
pub fn invoice_document_with_template(
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
    template: &InvoiceTemplate,
) -> Document {
    let company = template.effective_company(company);
    let company = &company;
    let currency = if invoice.currency_symbol.trim().is_empty() {
        &company.currency
    } else {
        &invoice.currency_symbol
    };
    let logo = template_docx_logo(template);
    let stationery = template_docx_stationery(template);
    let tokens = if stationery.is_some() {
        template_docx_tokens(template, invoice, contact, company, currency)
    } else {
        Vec::new()
    };
    if template.use_custom_layout && !template.custom_body_template.trim().is_empty() {
        let rendered = template.rendered_document(invoice, contact, company, currency);
        let blocks = rich_blocks_to_docx(&rendered.blocks, DIN5008_TEXT_WIDTH_PT);
        return Document {
            blocks,
            metadata: Metadata {
                title: format!("{} {}", template.header_title, invoice.number),
                creator: company.name.clone(),
                created: w3cdtf(invoice.issued_at),
            },
            logo,
            stationery,
            tokens,
        };
    }
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
        .unwrap_or(template.header_text.as_str());

    let mut blocks = vec![
        Block::Heading {
            level: 1,
            runs: vec![Run::plain(format!(
                "{} Nr. {}",
                template.header_title, invoice.number
            ))],
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
    ];
    blocks.push(Block::Heading {
        level: 2,
        runs: vec![Run::plain("Positionen")],
    });

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
        runs: vec![Run::plain(template.footer_text_for(invoice))],
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
    let tax_line = [
        (!company.tax_id.trim().is_empty())
            .then(|| format!("Steuernummer: {}", company.tax_id.trim())),
        (!template.company.vat_id.trim().is_empty())
            .then(|| format!("USt-IdNr.: {}", template.company.vat_id.trim())),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>()
    .join(" · ");
    if !tax_line.is_empty() {
        blocks.push(Block::Paragraph {
            runs: vec![Run::plain(tax_line)],
        });
    }
    if !template.tax_note.trim().is_empty() {
        blocks.push(Block::Paragraph {
            runs: vec![Run::plain(template.tax_note.clone())],
        });
    }

    Document {
        blocks,
        metadata: Metadata {
            title: format!("{} {}", template.header_title, invoice.number),
            creator: company.name.clone(),
            created: w3cdtf(invoice.issued_at),
        },
        logo,
        stationery,
        tokens,
    }
}

fn template_docx_logo(template: &InvoiceTemplate) -> Option<DocxImage> {
    if !template.show_logo || template.logo.trim().is_empty() {
        return None;
    }
    let image = template.logo_image()?;
    let mut logo = DocxImage::from_rgb(image.width, image.height, &image.rgb)?;
    logo.position = template.logo_position.clone();
    // Keep the original PNG when the source is already a PNG, so metadata and palettes survive.
    if let Some(bytes) = asset_bytes(&template.logo) {
        if bytes.starts_with(b"\x89PNG") {
            logo.png = bytes;
        }
    }
    Some(logo)
}

fn template_docx_stationery(template: &InvoiceTemplate) -> Option<DocxImage> {
    let image = template.stationery_image()?;
    DocxImage::from_rgb(image.width, image.height, &image.rgb)
}

fn template_docx_tokens(
    template: &InvoiceTemplate,
    invoice: &Invoice,
    contact: &Contact,
    company: &CompanyProfile,
    currency: &str,
) -> Vec<DocxToken> {
    template
        .stationery_token_texts(invoice, contact, company, currency)
        .into_iter()
        .map(|(token, text)| {
            // Use the same Helvetica line breaks as the preview and the PDF; Word then only has to
            // honour the explicit breaks and the fixed 1.4 line spacing.
            let layout = layout_stationery_token(&token, &text);
            let text = layout
                .lines
                .iter()
                .map(|line| line.text.as_str())
                .collect::<Vec<_>>()
                .join("\n");
            DocxToken {
                text,
                x_pct: token.x_percent(),
                y_pct: token.y_percent(),
                width_pct: token.width_percent(),
                font_size_px: token.font_size_px(),
                bold: token.bold(),
                color: token
                    .color_rgb()
                    .map(|channel| (channel * 255.0).round().clamp(0.0, 255.0) as u8),
                align: token.alignment().to_string(),
            }
        })
        .collect()
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

#[cfg(test)]
fn rich_block_to_docx(block: RichBlock) -> Option<Block> {
    rich_block_to_docx_in(block, DIN5008_TEXT_WIDTH_PT)
}

/// Converts a block stack, inserting explicit CSS margins as Word spacer paragraphs.
///
/// Word has no margin-collapsing model; the spacers carry the same collapsed block-flow geometry
/// that the preview and PDF use. Implicit paragraph spacing is left to the Word styles so existing
/// documents keep their familiar look.
fn rich_blocks_to_docx(blocks: &[RichBlock], width: f32) -> Vec<Block> {
    let mut output = Vec::new();
    let mut previous_bottom: Option<f32> = None;
    for block in blocks {
        let margins = block_margins(block);
        let before = previous_bottom.map_or(margins.top(), |bottom| bottom.max(margins.top()));
        if before > 0.01 {
            output.push(Block::Spacer {
                twips: twips(before),
            });
        }
        if let Some(converted) = rich_block_to_docx_in(block.clone(), width) {
            output.push(converted);
        }
        previous_bottom = margins.bottom;
    }
    if let Some(bottom) = previous_bottom {
        if bottom > 0.01 {
            output.push(Block::Spacer {
                twips: twips(bottom),
            });
        }
    }
    output
}

/// Maps a block with the content width of its parent, so nested containers keep the parent width.
fn rich_block_to_docx_in(block: RichBlock, width: f32) -> Option<Block> {
    match block {
        RichBlock::Heading { level, runs, .. } => Some(Block::Heading {
            level,
            runs: docx_runs(&runs),
        }),
        RichBlock::Paragraph { runs, .. } => Some(Block::Paragraph {
            runs: docx_runs(&runs),
        }),
        RichBlock::Table(table) => {
            let rows = table
                .rows
                .into_iter()
                .map(|row| Row {
                    cells: row
                        .into_iter()
                        .map(|cell| vec![docx_runs(&cell.runs)])
                        .collect(),
                })
                .collect::<Vec<_>>();
            (!rows.is_empty()).then_some(Block::Table(Table { rows }))
        }
        RichBlock::Container(container) => container_to_docx(&container, width),
        RichBlock::PageBreak => Some(Block::PageBreak),
        RichBlock::Rule { .. } => Some(Block::Paragraph {
            runs: vec![Run::plain("---")],
        }),
        RichBlock::Image { source, .. } => Some(Block::Paragraph {
            runs: vec![Run::plain(if source.starts_with("data:") {
                "[Bild]".to_string()
            } else {
                format!("[Bild] {source}")
            })],
        }),
    }
}

/// Maps a flex/grid container to a borderless, fixed-width Word table.
///
/// Each resolved slot becomes a cell of the planned width; spacer cells fill the gaps that
/// `justify-content` or `align-items` leave between the slots. Column flex containers produce one
/// row per item, so their horizontal alignment survives as well. Word stretches all cells of a row
/// to the row height, which is exactly what `align-items: stretch` does in the browser.
fn container_to_docx(container: &RichContainer, width: f32) -> Option<Block> {
    let width = width.max(0.0);
    let layout = layout_container(container, width);
    let valign = cell_valign(container);
    let mut rows = Vec::new();
    for row in layout.rows {
        let mut slots = row.slots.iter().collect::<Vec<_>>();
        slots.sort_by(|left, right| left.x.total_cmp(&right.x));
        let mut cells = Vec::new();
        let mut cursor = 0.0f32;
        for slot in slots {
            if slot.x > cursor + 0.05 {
                cells.push(LayoutCell {
                    width: twips(slot.x - cursor),
                    ..LayoutCell::default()
                });
            }
            let item = container.items.get(slot.item);
            let padding = item.map(|item| item.padding).unwrap_or_default();
            let content_width = (slot.width - padding.left - padding.right).max(0.0);
            cells.push(LayoutCell {
                width: twips(slot.width),
                margin: [
                    twips(padding.left),
                    twips(padding.top),
                    twips(padding.right),
                    twips(padding.bottom),
                ],
                valign,
                blocks: item
                    .map(|item| rich_blocks_to_docx(&item.blocks, content_width))
                    .unwrap_or_default(),
            });
            cursor = slot.x + slot.width;
        }
        if cursor < width - 0.05 {
            cells.push(LayoutCell {
                width: twips(width - cursor),
                ..LayoutCell::default()
            });
        }
        if !cells.is_empty() {
            rows.push(LayoutRow {
                cells,
                height: twips(row.height),
            });
        }
    }
    (!rows.is_empty()).then_some(Block::LayoutTable(LayoutTable { rows }))
}

fn cell_valign(container: &RichContainer) -> CellVAlign {
    if matches!(
        container.kind,
        ContainerKind::Flex {
            direction: FlexDirection::Column | FlexDirection::ColumnReverse
        }
    ) {
        return CellVAlign::Top;
    }
    match container.align {
        AlignItems::Center => CellVAlign::Center,
        AlignItems::End => CellVAlign::Bottom,
        AlignItems::Stretch | AlignItems::Start => CellVAlign::Top,
    }
}

/// Points to twips, the unit of OOXML table widths and cell margins.
fn twips(points: f32) -> i64 {
    (f64::from(points.max(0.0)) * 20.0).round().max(0.0) as i64
}

fn docx_runs(runs: &[TextRun]) -> Vec<Run> {
    let mut result = Vec::new();
    for run in runs {
        if run.text.is_empty() {
            continue;
        }
        result.push(Run {
            text: run.text.clone(),
            bold: run.bold,
            italic: run.italic,
        });
    }
    if result.is_empty() {
        result.push(Run::plain(""));
    }
    result
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
    fn nested_containers_plan_with_the_width_of_their_parent_cell() {
        let document = crate::rich_html::parse(
            "<div style=\"display:flex;justify-content:flex-end\">\
               <div style=\"width:280px\">\
                 <div style=\"display:flex;justify-content:space-between\">\
                   <span>Netto</span><span>10,00 €</span></div></div></div>",
        );
        let block = super::rich_block_to_docx(document.blocks[0].clone()).expect("layout table");
        let super::Block::LayoutTable(table) = block else {
            panic!("layout table expected");
        };
        let card = table.rows[0]
            .cells
            .iter()
            .find(|cell| !cell.blocks.is_empty())
            .expect("card cell");
        assert_eq!(card.width, 4200, "280px = 210pt = 4200 twips");
        let super::Block::LayoutTable(nested) = &card.blocks[0] else {
            panic!("nested layout table expected");
        };
        let total: i64 = nested.rows[0].cells.iter().map(|cell| cell.width).sum();
        // Each cell is rounded to whole twips on its own, so the sum may differ by one twip.
        assert!(
            (total - 4200).abs() <= 1,
            "the nested row uses the card width: {total}"
        );
        assert!(nested.rows[0].cells.iter().all(|cell| cell.width <= 4200));
    }

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
