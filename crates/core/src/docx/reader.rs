//! Reads the body of a Word document into [`Document`] blocks.
//!
//! The mapping follows what the TypeScript template import did with the same file: paragraphs with
//! their runs (bold and italic), tables with rows and cells, headings by their `HeadingN` style and
//! explicit page breaks. Content the app cannot represent — images, footnotes, fields — is skipped
//! instead of failing, so an arbitrary Word file still yields readable text.

use super::xml::{self, Element};
use super::{zip, Block, Document, DocxError, Metadata, Row, Run, Table};

/// Reads a package into blocks and metadata.
pub fn read(bytes: &[u8]) -> Result<Document, DocxError> {
    let part = zip::read(bytes, "word/document.xml")?
        .ok_or_else(|| DocxError::MissingPart("word/document.xml".to_string()))?;
    let source = String::from_utf8(part)
        .map_err(|_| DocxError::Xml("word/document.xml is not UTF-8".to_string()))?;
    let root = xml::parse(&source)?;
    let body = root
        .find("body")
        .ok_or_else(|| DocxError::Xml("word/document.xml has no w:body".to_string()))?;

    let mut blocks = Vec::new();
    container(body, &mut blocks, 0);
    Ok(Document {
        blocks,
        metadata: metadata(bytes)?,
    })
}

/// Walks a container element and appends the blocks it holds.
fn container(element: &Element, blocks: &mut Vec<Block>, depth: usize) {
    if depth > 16 {
        return;
    }
    for child in element.elements() {
        if child.is("p") {
            paragraph(child, blocks);
        } else if child.is("tbl") {
            if let Some(table) = table(child) {
                blocks.push(Block::Table(table));
            }
        } else if child.is("sdt") || child.is("sdtContent") || child.is("customXml") {
            container(child, blocks, depth + 1);
        }
    }
}

/// Appends the blocks of one `w:p`.
fn paragraph(element: &Element, blocks: &mut Vec<Block>) {
    let style = element
        .child("pPr")
        .and_then(|properties| properties.child("pStyle"))
        .and_then(|style| style.attribute("val"))
        .unwrap_or_default()
        .to_string();
    let mut runs = Vec::new();
    collect_runs(element, &mut runs);
    merge(&mut runs);

    if runs.iter().any(|run| !run.text.trim().is_empty()) {
        let level = heading_level(&style);
        blocks.push(match level {
            Some(level) => Block::Heading { level, runs },
            None => Block::Paragraph { runs },
        });
    }
    if has_page_break(element) {
        blocks.push(Block::PageBreak);
    }
}

/// Collects the runs of a paragraph or table cell, descending into hyperlinks and content controls.
fn collect_runs(element: &Element, runs: &mut Vec<Run>) {
    for child in element.elements() {
        if child.is("r") {
            if let Some(run) = run(child) {
                runs.push(run);
            }
        } else if child.is("hyperlink")
            || child.is("sdt")
            || child.is("sdtContent")
            || child.is("smartTag")
            || child.is("ins")
            || child.is("fldSimple")
        {
            collect_runs(child, runs);
        }
    }
}

/// Reads one `w:r` with its run properties.
fn run(element: &Element) -> Option<Run> {
    let mut text = String::new();
    for child in element.elements() {
        if child.is("t") {
            text.push_str(&child.text());
        } else if child.is("tab") {
            text.push('\t');
        } else if child.is("br") {
            let page_break = child
                .attribute("type")
                .map(|kind| kind.eq_ignore_ascii_case("page"))
                .unwrap_or(false);
            if !page_break {
                text.push('\n');
            }
        } else if child.is("cr") {
            text.push('\n');
        }
    }
    if text.is_empty() {
        return None;
    }
    let properties = element.child("rPr");
    let enabled = |name: &str| {
        properties
            .and_then(|properties| properties.child(name))
            .map(|flag| {
                !matches!(
                    flag.attribute("val")
                        .map(str::to_ascii_lowercase)
                        .as_deref(),
                    Some("0" | "false" | "off")
                )
            })
            .unwrap_or(false)
    };
    Some(Run {
        text,
        bold: enabled("b"),
        italic: enabled("i"),
    })
}

/// Merges neighbouring runs with the same properties, as Word splits them arbitrarily.
fn merge(runs: &mut Vec<Run>) {
    let mut merged: Vec<Run> = Vec::with_capacity(runs.len());
    for run in runs.drain(..) {
        match merged.last_mut() {
            Some(last) if last.bold == run.bold && last.italic == run.italic => {
                last.text.push_str(&run.text);
            }
            _ => merged.push(run),
        }
    }
    *runs = merged;
}

/// Reads one `w:tbl`.
fn table(element: &Element) -> Option<Table> {
    let mut rows = Vec::new();
    for row in element.children_named("tr") {
        let mut cells = Vec::new();
        for cell in row.children_named("tc") {
            let mut paragraphs = Vec::new();
            for paragraph in cell.children_named("p") {
                let mut runs = Vec::new();
                collect_runs(paragraph, &mut runs);
                merge(&mut runs);
                paragraphs.push(runs);
            }
            cells.push(paragraphs);
        }
        if !cells.is_empty() {
            rows.push(Row { cells });
        }
    }
    if rows.is_empty() {
        None
    } else {
        Some(Table { rows })
    }
}

/// Whether a paragraph contains an explicit page break.
fn has_page_break(element: &Element) -> bool {
    element
        .find("br")
        .and_then(|element| element.attribute("type"))
        .map(|kind| kind.eq_ignore_ascii_case("page"))
        .unwrap_or(false)
}

/// Outline level of a paragraph style.
fn heading_level(style: &str) -> Option<u8> {
    let style = style.rsplit(':').next().unwrap_or(style);
    if style.eq_ignore_ascii_case("title") {
        return Some(1);
    }
    let digits: String = style
        .chars()
        .skip_while(|character| !character.is_ascii_digit())
        .take_while(char::is_ascii_digit)
        .collect();
    if style.to_ascii_lowercase().starts_with("heading") {
        digits.parse::<u8>().ok().map(|level| level.clamp(1, 6))
    } else {
        None
    }
}

/// Reads the document properties, which a foreign package may not have.
fn metadata(bytes: &[u8]) -> Result<Metadata, DocxError> {
    let Some(part) = zip::read(bytes, "docProps/core.xml")? else {
        return Ok(Metadata::default());
    };
    let source = String::from_utf8_lossy(&part);
    let root = xml::parse(&source)?;
    Ok(Metadata {
        title: root.find("title").map(Element::text).unwrap_or_default(),
        creator: root.find("creator").map(Element::text).unwrap_or_default(),
        created: root.find("created").map(Element::text).unwrap_or_default(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn heading_styles_map_to_levels() {
        assert_eq!(heading_level("Heading1"), Some(1));
        assert_eq!(heading_level("heading 2"), Some(2));
        assert_eq!(heading_level("Heading3"), Some(3));
        assert_eq!(heading_level("Title"), Some(1));
        assert_eq!(heading_level("Normal"), None);
        assert_eq!(heading_level("Heading12"), Some(6));
    }

    #[test]
    fn a_missing_document_part_is_an_error() {
        let package = zip::write(&[("word/styles.xml".to_string(), b"<x/>".to_vec())]);
        assert_eq!(
            read(&package),
            Err(DocxError::MissingPart("word/document.xml".to_string()))
        );
    }

    #[test]
    fn broken_xml_is_an_error() {
        let package = zip::write(&[(
            "word/document.xml".to_string(),
            b"<w:document><w:body><w:p>".to_vec(),
        )]);
        assert!(matches!(read(&package), Err(DocxError::Xml(_))));
    }

    #[test]
    fn a_body_without_content_yields_no_blocks() {
        let package = zip::write(&[(
            "word/document.xml".to_string(),
            br#"<?xml version="1.0"?><w:document xmlns:w="urn:w"><w:body><w:sectPr/></w:body></w:document>"#
                .to_vec(),
        )]);
        let document = read(&package).expect("reads");
        assert!(document.blocks.is_empty());
        assert_eq!(document.metadata, Metadata::default());
    }
}
