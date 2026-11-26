//! Writes a [`Document`] as an OOXML package.
//!
//! The package contains the parts Word needs to open the file without repair prompts: the content
//! types, both relationship parts, the main document, a styles part with the used styles and the
//! core and extended properties. Page size and margins follow the A4 layout of the printed invoice
//! (25 mm left, 20 mm right and bottom).

use super::xml::escape;
use super::{zip, Block, Document, DocxError, DocxImage, DocxToken, LayoutTable, Run, Table};

/// Builds the package bytes of `document`.
pub fn write(document: &Document) -> Result<Vec<u8>, DocxError> {
    let has_logo = document.logo.is_some();
    let has_stationery = document.stationery.is_some();
    let has_tokens = has_stationery && !document.tokens.is_empty();
    // The logo and the stationery tokens are first-page marks; the stationery repeats on every page.
    let first_page = has_logo || has_tokens;
    let default_header = has_stationery && first_page;
    let mut parts = vec![
        (
            "[Content_Types].xml".to_string(),
            content_types(document).into_bytes(),
        ),
        ("_rels/.rels".to_string(), root_relationships().into_bytes()),
        (
            "word/document.xml".to_string(),
            document_xml(document).into_bytes(),
        ),
        (
            "word/_rels/document.xml.rels".to_string(),
            document_relationships(document).into_bytes(),
        ),
        ("word/styles.xml".to_string(), styles().into_bytes()),
        (
            "docProps/core.xml".to_string(),
            core_properties(document).into_bytes(),
        ),
        (
            "docProps/app.xml".to_string(),
            app_properties(document).into_bytes(),
        ),
    ];
    // Header1 is the first page when a logo or stationery tokens exist; it carries the logo, the
    // stationery and the tokens. The default header (header2) repeats the stationery alone for the
    // following pages. Without a first-page mark, header1 is the default header.
    if has_logo || has_stationery {
        parts.push((
            "word/header1.xml".to_string(),
            header_xml(document, has_stationery, has_logo, has_stationery).into_bytes(),
        ));
        parts.push((
            "word/_rels/header1.xml.rels".to_string(),
            header_relationships(has_stationery, has_logo).into_bytes(),
        ));
    }
    if default_header {
        parts.push((
            "word/header2.xml".to_string(),
            header_xml(document, true, false, false).into_bytes(),
        ));
        parts.push((
            "word/_rels/header2.xml.rels".to_string(),
            header_relationships(true, false).into_bytes(),
        ));
    }
    if let Some(stationery) = &document.stationery {
        parts.push((
            "word/media/stationery.png".to_string(),
            stationery.png.clone(),
        ));
    }
    if let Some(logo) = &document.logo {
        parts.push(("word/media/logo.png".to_string(), logo.png.clone()));
    }
    Ok(zip::write(&parts))
}

const XML_DECLARATION: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";

fn content_types(document: &Document) -> String {
    let has_logo = document.logo.is_some();
    let has_stationery = document.stationery.is_some();
    let has_tokens = has_stationery && !document.tokens.is_empty();
    let default_header = has_stationery && (has_logo || has_tokens);
    let mut headers = String::new();
    if has_logo || has_stationery {
        headers.push_str("<Override PartName=\"/word/header1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml\"/>");
    }
    if default_header {
        headers.push_str("<Override PartName=\"/word/header2.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml\"/>");
    }
    format!(
        "{XML_DECLARATION}<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">\
<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\
<Default Extension=\"xml\" ContentType=\"application/xml\"/>\
{}\n<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>\
<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>\
{headers}\n<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>\
<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>\
</Types>",
        if has_logo || has_stationery {
            "<Default Extension=\"png\" ContentType=\"image/png\"/>"
        } else {
            ""
        },
    )
}

fn root_relationships() -> String {
    format!(
        "{XML_DECLARATION}<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\
<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>\
<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties\" Target=\"docProps/core.xml\"/>\
<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties\" Target=\"docProps/app.xml\"/>\
</Relationships>"
    )
}

fn document_relationships(document: &Document) -> String {
    let has_logo = document.logo.is_some();
    let has_stationery = document.stationery.is_some();
    let has_tokens = has_stationery && !document.tokens.is_empty();
    let first_page = has_logo || has_tokens;
    let default_header = has_stationery && first_page;
    let mut headers = String::new();
    if first_page || has_stationery {
        headers.push_str("<Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/header\" Target=\"header1.xml\"/>");
    }
    if default_header {
        headers.push_str("<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/header\" Target=\"header2.xml\"/>");
    }
    format!(
        "{XML_DECLARATION}<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\
<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>\
{headers}\n</Relationships>"
    )
}

fn document_xml(document: &Document) -> String {
    let mut body = String::new();
    for block in &document.blocks {
        body.push_str(&block_xml(block));
    }
    // Word expects the section properties as the last child of the body. `w:sectPr` has a fixed
    // child order: the header references come first, `w:titlePg` after the page geometry.
    let has_logo = document.logo.is_some();
    let has_stationery = document.stationery.is_some();
    let has_tokens = has_stationery && !document.tokens.is_empty();
    let first_page = has_logo || has_tokens;
    let default_header = has_stationery && first_page;
    let mut header_references = String::new();
    if first_page {
        header_references.push_str("<w:headerReference w:type=\"first\" r:id=\"rId2\"/>");
        if default_header {
            header_references.push_str("<w:headerReference w:type=\"default\" r:id=\"rId3\"/>");
        }
    } else if has_stationery {
        header_references.push_str("<w:headerReference w:type=\"default\" r:id=\"rId2\"/>");
    }
    // `w:titlePg` switches the first page to the first header; the logo and the tokens stay there.
    let title_page = if first_page { "<w:titlePg/>" } else { "" };
    body.push_str(&format!(
        "<w:sectPr>{header_references}<w:pgSz w:w=\"11906\" w:h=\"16838\"/>\
<w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1417\" w:header=\"709\" w:footer=\"709\" w:gutter=\"0\"/>\
{title_page}</w:sectPr>"
    ));
    format!(
        "{XML_DECLARATION}<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">\
<w:body>{body}</w:body></w:document>"
    )
}

const PAGE_WIDTH_EMU: i64 = 7_560_000;
const PAGE_HEIGHT_EMU: i64 = 10_692_000;

fn header_xml(document: &Document, stationery: bool, logo: bool, tokens: bool) -> String {
    let stationery_rel = stationery.then_some("rId1");
    let logo_rel = logo.then_some(if stationery { "rId2" } else { "rId1" });
    let mut content = String::new();
    if tokens && stationery {
        for (index, token) in document.tokens.iter().enumerate() {
            if index > 0 {
                content.push_str(&separator_paragraph());
            }
            content.push_str(&token_table(token));
        }
    }
    let mut runs = String::new();
    if let (Some(image), Some(rel)) = (&document.stationery, stationery_rel) {
        let (left, top, right, bottom) = cover_crop(image);
        runs.push_str(&image_drawing(
            rel,
            1,
            "Briefpapier",
            (0, 0),
            PAGE_WIDTH_EMU,
            PAGE_HEIGHT_EMU,
            (left, top, right, bottom),
        ));
    }
    if let (Some(image), Some(rel)) = (&document.logo, logo_rel) {
        let (width, height) = logo_extent(image);
        let margin = 720_000;
        let x = match image.position.as_str() {
            "left" => margin,
            "center" => (PAGE_WIDTH_EMU - width) / 2,
            _ => PAGE_WIDTH_EMU - margin - width,
        };
        runs.push_str(&image_drawing(
            rel,
            2,
            "Logo",
            (x, 360_000),
            width,
            height,
            (0, 0, 0, 0),
        ));
    }
    format!(
        "{XML_DECLARATION}<w:hdr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" \
xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" \
xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" \
xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">\
{content}<w:p><w:pPr><w:spacing w:after=\"0\"/></w:pPr><w:r>{runs}</w:r></w:p></w:hdr>"
    )
}

const PAGE_WIDTH_TWIPS: f64 = 11_906.0;
const PAGE_HEIGHT_TWIPS: f64 = 16_838.0;

/// One token as a borderless, page-anchored floating table over the stationery.
fn token_table(token: &DocxToken) -> String {
    let x = (token.x_pct / 100.0 * PAGE_WIDTH_TWIPS).round() as i64;
    let y = (token.y_pct / 100.0 * PAGE_HEIGHT_TWIPS).round() as i64;
    let (width, width_type) = match token.width_pct {
        Some(percent) => (
            ((percent / 100.0 * PAGE_WIDTH_TWIPS).round() as i64).max(1),
            "dxa",
        ),
        None => (0, "auto"),
    };
    let half_points = (token.font_size_px * 1.5).round().max(2.0) as i64;
    let line = (token.font_size_px * 21.0).round().max(20.0) as i64;
    let mut runs = String::from("<w:r><w:rPr>");
    if token.bold {
        runs.push_str("<w:b/>");
    }
    runs.push_str(&format!(
        "<w:color w:val=\"{:02X}{:02X}{:02X}\"/><w:sz w:val=\"{half_points}\"/><w:szCs w:val=\"{half_points}\"/></w:rPr>",
        token.color[0], token.color[1], token.color[2]
    ));
    for (index, line_text) in token.text.split('\n').enumerate() {
        if index > 0 {
            runs.push_str("<w:br/>");
        }
        if !line_text.is_empty() {
            runs.push_str(&format!(
                "<w:t xml:space=\"preserve\">{}</w:t>",
                escape(line_text)
            ));
        }
    }
    runs.push_str("</w:r>");
    format!(
        "<w:tbl><w:tblPr><w:tblpPr w:leftFromText=\"0\" w:rightFromText=\"0\" w:topFromText=\"0\" w:bottomFromText=\"0\" w:vertAnchor=\"page\" w:horzAnchor=\"page\" w:tblpX=\"{x}\" w:tblpY=\"{y}\"/>\
<w:tblOverlap w:val=\"overlap\"/><w:tblW w:w=\"{width}\" w:type=\"{width_type}\"/>\
<w:tblBorders><w:top w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/><w:left w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/><w:bottom w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/><w:right w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/><w:insideH w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/><w:insideV w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/></w:tblBorders>\
<w:tblCellMar><w:top w:w=\"0\" w:type=\"dxa\"/><w:left w:w=\"0\" w:type=\"dxa\"/><w:bottom w:w=\"0\" w:type=\"dxa\"/><w:right w:w=\"0\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr>\
<w:tblGrid><w:gridCol w:w=\"{width}\"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w=\"{width}\" w:type=\"{width_type}\"/></w:tcPr>\
<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"{line}\" w:lineRule=\"exact\"/><w:jc w:val=\"{}\"/></w:pPr>{runs}</w:p>\
</w:tc></w:tr></w:tbl>",
        token.align
    )
}

/// Tiny paragraph that keeps neighbouring floating tables from being merged by Word.
fn separator_paragraph() -> String {
    "<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"20\" w:lineRule=\"exact\"/><w:rPr><w:sz w:val=\"2\"/></w:rPr></w:pPr></w:p>"
        .to_string()
}

fn header_relationships(stationery: bool, logo: bool) -> String {
    let mut relationships = String::new();
    if stationery {
        relationships.push_str("<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/stationery.png\"/>");
    }
    if logo {
        let id = if stationery { 2 } else { 1 };
        relationships.push_str(&format!("<Relationship Id=\"rId{id}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/logo.png\"/>"));
    }
    format!(
        "{XML_DECLARATION}<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">{relationships}</Relationships>"
    )
}

fn logo_extent(image: &DocxImage) -> (i64, i64) {
    // TS limits the header logo to 140 × 70 CSS pixels (37.04 × 18.52 mm at 96 dpi) with
    // `object-fit: contain` inside a `max-width`/`max-height` box, which never scales a smaller
    // image up. 9525 EMU are one pixel at 96 dpi.
    const PX_EMU: i64 = 9_525;
    const MAX_WIDTH_EMU: i64 = 140 * PX_EMU;
    const MAX_HEIGHT_EMU: i64 = 70 * PX_EMU;
    let width = image.width.max(1) as i64 * PX_EMU;
    let height = image.height.max(1) as i64 * PX_EMU;
    let scale = (MAX_WIDTH_EMU as f64 / width as f64)
        .min(MAX_HEIGHT_EMU as f64 / height as f64)
        .min(1.0);
    (
        (width as f64 * scale).round() as i64,
        (height as f64 * scale).round() as i64,
    )
}

fn cover_crop(image: &DocxImage) -> (u32, u32, u32, u32) {
    let source = image.width.max(1) as f64 / image.height.max(1) as f64;
    let target = 210.0 / 297.0;
    if source > target {
        let inset = ((1.0 - target / source) / 2.0 * 100_000.0).round() as u32;
        (inset, 0, inset, 0)
    } else {
        let inset = ((1.0 - source / target) / 2.0 * 100_000.0).round() as u32;
        (0, inset, 0, inset)
    }
}

fn image_drawing(
    relationship: &str,
    id: u32,
    name: &str,
    position: (i64, i64),
    width: i64,
    height: i64,
    crop: (u32, u32, u32, u32),
) -> String {
    let (x, y) = position;
    let crop = if crop == (0, 0, 0, 0) {
        String::new()
    } else {
        format!(
            "<a:srcRect l=\"{}\" t=\"{}\" r=\"{}\" b=\"{}\"/>",
            crop.0, crop.1, crop.2, crop.3
        )
    };
    format!(
        "<w:drawing><wp:anchor distT=\"0\" distB=\"0\" distL=\"0\" distR=\"0\" simplePos=\"0\" \
relativeHeight=\"{}\" behindDoc=\"1\" locked=\"0\" layoutInCell=\"1\" allowOverlap=\"1\">\
<wp:simplePos x=\"0\" y=\"0\"/><wp:positionH relativeFrom=\"page\"><wp:posOffset>{x}</wp:posOffset></wp:positionH>\
<wp:positionV relativeFrom=\"page\"><wp:posOffset>{y}</wp:posOffset></wp:positionV>\
<wp:extent cx=\"{width}\" cy=\"{height}\"/><wp:effectExtent l=\"0\" t=\"0\" r=\"0\" b=\"0\"/>\
<wp:wrapNone/><wp:docPr id=\"{id}\" name=\"{name}\"/><wp:cNvGraphicFramePr/>\
<a:graphic><a:graphicData uri=\"http://schemas.openxmlformats.org/drawingml/2006/picture\">\
<pic:pic><pic:nvPicPr><pic:cNvPr id=\"{id}\" name=\"{name}\"/><pic:cNvPicPr/></pic:nvPicPr>\
<pic:blipFill><a:blip r:embed=\"{relationship}\"/>{crop}<a:stretch><a:fillRect/></a:stretch></pic:blipFill>\
<pic:spPr><a:xfrm><a:off x=\"0\" y=\"0\"/><a:ext cx=\"{width}\" cy=\"{height}\"/></a:xfrm>\
<a:prstGeom prst=\"rect\"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>\
</a:graphicData></a:graphic></wp:anchor></w:drawing>",
        id + 100,
    )
}

fn block_xml(block: &Block) -> String {
    match block {
        Block::Heading { level, runs } => {
            paragraph(Some(&format!("Heading{}", (*level).clamp(1, 6))), runs)
        }
        Block::Paragraph { runs } => paragraph(None, runs),
        Block::Table(table) => format!("{}{}", table_xml(table), paragraph(None, &[])),
        Block::LayoutTable(table) => {
            format!("{}{}", layout_table_xml(table), paragraph(None, &[]))
        }
        Block::Spacer { twips } => format!(
            "<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"0\" w:line=\"{}\" w:lineRule=\"exact\"/></w:pPr></w:p>",
            (*twips).max(1)
        ),
        Block::PageBreak => "<w:p><w:r><w:br w:type=\"page\"/></w:r></w:p>".to_string(),
    }
}

fn paragraph(style: Option<&str>, runs: &[Run]) -> String {
    let mut xml = String::from("<w:p>");
    if let Some(style) = style {
        xml.push_str(&format!(
            "<w:pPr><w:pStyle w:val=\"{}\"/></w:pPr>",
            escape(style)
        ));
    }
    for run in runs {
        xml.push_str(&run_xml(run));
    }
    xml.push_str("</w:p>");
    xml
}

fn run_xml(run: &Run) -> String {
    let mut xml = String::from("<w:r>");
    if run.bold || run.italic {
        xml.push_str("<w:rPr>");
        if run.bold {
            xml.push_str("<w:b/>");
        }
        if run.italic {
            xml.push_str("<w:i/>");
        }
        xml.push_str("</w:rPr>");
    }
    for (index, line) in run.text.split('\n').enumerate() {
        if index > 0 {
            xml.push_str("<w:br/>");
        }
        if !line.is_empty() {
            xml.push_str(&format!(
                "<w:t xml:space=\"preserve\">{}</w:t>",
                escape(line)
            ));
        }
    }
    xml.push_str("</w:r>");
    xml
}

fn table_xml(table: &Table) -> String {
    let columns = table.columns().max(1);
    let width = 9000 / columns as i64;
    let mut xml = String::from(
        "<w:tbl><w:tblPr><w:tblStyle w:val=\"TableGrid\"/><w:tblW w:w=\"0\" w:type=\"auto\"/>\
<w:tblBorders>\
<w:top w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:left w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:right w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
<w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"999999\"/>\
</w:tblBorders></w:tblPr><w:tblGrid>",
    );
    for _ in 0..columns {
        xml.push_str(&format!("<w:gridCol w:w=\"{width}\"/>"));
    }
    xml.push_str("</w:tblGrid>");
    for row in &table.rows {
        xml.push_str("<w:tr>");
        for cell in &row.cells {
            xml.push_str("<w:tc><w:tcPr><w:tcW w:w=\"0\" w:type=\"auto\"/></w:tcPr>");
            if cell.is_empty() {
                xml.push_str("<w:p/>");
            }
            for runs in cell {
                xml.push_str(&paragraph(None, runs));
            }
            xml.push_str("</w:tc>");
        }
        xml.push_str("</w:tr>");
    }
    xml.push_str("</w:tbl>");
    xml
}

/// Borderless table with fixed cell widths for a linearized flex/grid container.
fn layout_table_xml(table: &LayoutTable) -> String {
    let columns = table
        .rows
        .iter()
        .map(|row| row.cells.len())
        .max()
        .unwrap_or(0)
        .max(1);
    let mut widths = vec![0i64; columns];
    for row in &table.rows {
        for (index, cell) in row.cells.iter().enumerate() {
            widths[index] = widths[index].max(cell.width);
        }
    }
    let mut xml = String::from(
        "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/><w:tblLayout w:type=\"fixed\"/>\
<w:tblBorders>\
<w:top w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>\
<w:left w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>\
<w:bottom w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>\
<w:right w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>\
<w:insideH w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>\
<w:insideV w:val=\"none\" w:sz=\"0\" w:space=\"0\" w:color=\"auto\"/>\
</w:tblBorders>\
<w:tblCellMar><w:top w:w=\"0\" w:type=\"dxa\"/><w:left w:w=\"0\" w:type=\"dxa\"/>\
<w:bottom w:w=\"0\" w:type=\"dxa\"/><w:right w:w=\"0\" w:type=\"dxa\"/></w:tblCellMar></w:tblPr><w:tblGrid>",
    );
    for width in &widths {
        xml.push_str(&format!("<w:gridCol w:w=\"{width}\"/>"));
    }
    xml.push_str("</w:tblGrid>");
    for row in &table.rows {
        xml.push_str("<w:tr>");
        if row.height > 0 {
            xml.push_str(&format!(
                "<w:trPr><w:trHeight w:val=\"{}\" w:hRule=\"atLeast\"/></w:trPr>",
                row.height
            ));
        }
        for cell in &row.cells {
            xml.push_str(&format!(
                "<w:tc><w:tcPr><w:tcW w:w=\"{}\" w:type=\"dxa\"/>{}\
<w:vAlign w:val=\"{}\"/></w:tcPr>",
                cell.width,
                cell_margins(cell),
                cell.valign.as_str()
            ));
            if cell.blocks.is_empty() {
                xml.push_str("<w:p/>");
            }
            for block in &cell.blocks {
                xml.push_str(&block_xml(block));
            }
            xml.push_str("</w:tc>");
        }
        xml.push_str("</w:tr>");
    }
    xml.push_str("</w:tbl>");
    xml
}

fn cell_margins(cell: &super::LayoutCell) -> String {
    let [left, top, right, bottom] = cell.margin;
    format!(
        "<w:tcMar><w:top w:w=\"{top}\" w:type=\"dxa\"/><w:left w:w=\"{left}\" w:type=\"dxa\"/>\
<w:bottom w:w=\"{bottom}\" w:type=\"dxa\"/><w:right w:w=\"{right}\" w:type=\"dxa\"/></w:tcMar>"
    )
}

fn styles() -> String {
    format!(
        "{XML_DECLARATION}<w:styles xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">\
<w:docDefaults><w:rPrDefault><w:rPr>\
<w:rFonts w:ascii=\"Helvetica\" w:hAnsi=\"Helvetica\" w:cs=\"Helvetica\"/>\
<w:sz w:val=\"20\"/><w:szCs w:val=\"20\"/><w:lang w:val=\"de-DE\"/>\
</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after=\"120\"/></w:pPr></w:pPrDefault></w:docDefaults>\
<w:style w:type=\"paragraph\" w:default=\"1\" w:styleId=\"Normal\"><w:name w:val=\"Normal\"/><w:qFormat/></w:style>\
<w:style w:type=\"paragraph\" w:styleId=\"Title\"><w:name w:val=\"Title\"/><w:basedOn w:val=\"Normal\"/>\
<w:pPr><w:spacing w:after=\"240\"/></w:pPr><w:rPr><w:b/><w:sz w:val=\"40\"/></w:rPr></w:style>\
<w:style w:type=\"paragraph\" w:styleId=\"Heading1\"><w:name w:val=\"heading 1\"/><w:basedOn w:val=\"Normal\"/>\
<w:next w:val=\"Normal\"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before=\"240\" w:after=\"120\"/>\
<w:outlineLvl w:val=\"0\"/></w:pPr><w:rPr><w:b/><w:sz w:val=\"34\"/></w:rPr></w:style>\
<w:style w:type=\"paragraph\" w:styleId=\"Heading2\"><w:name w:val=\"heading 2\"/><w:basedOn w:val=\"Normal\"/>\
<w:next w:val=\"Normal\"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before=\"200\" w:after=\"100\"/>\
<w:outlineLvl w:val=\"1\"/></w:pPr><w:rPr><w:b/><w:sz w:val=\"28\"/></w:rPr></w:style>\
<w:style w:type=\"table\" w:styleId=\"TableGrid\"><w:name w:val=\"Table Grid\"/><w:basedOn w:val=\"TableNormal\"/>\
<w:tblPr><w:tblBorders>\
<w:top w:val=\"single\" w:sz=\"4\" w:color=\"auto\"/>\
<w:left w:val=\"single\" w:sz=\"4\" w:color=\"auto\"/>\
<w:bottom w:val=\"single\" w:sz=\"4\" w:color=\"auto\"/>\
<w:right w:val=\"single\" w:sz=\"4\" w:color=\"auto\"/>\
<w:insideH w:val=\"single\" w:sz=\"4\" w:color=\"auto\"/>\
<w:insideV w:val=\"single\" w:sz=\"4\" w:color=\"auto\"/>\
</w:tblBorders></w:tblPr></w:style>\
<w:style w:type=\"table\" w:default=\"1\" w:styleId=\"TableNormal\"><w:name w:val=\"Normal Table\"/><w:uiPriority w:val=\"99\"/></w:style>\
</w:styles>"
    )
}

fn core_properties(document: &Document) -> String {
    let metadata = &document.metadata;
    format!(
        "{XML_DECLARATION}<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" \
xmlns:dc=\"http://purl.org/dc/elements/1.1/\" xmlns:dcterms=\"http://purl.org/dc/terms/\" \
xmlns:dcmitype=\"http://purl.org/dc/dcmitype/\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\">\
<dc:title>{}</dc:title><dc:creator>{}</dc:creator><cp:lastModifiedBy>{}</cp:lastModifiedBy>\
<dcterms:created xsi:type=\"dcterms:W3CDTF\">{}</dcterms:created>\
<dcterms:modified xsi:type=\"dcterms:W3CDTF\">{}</dcterms:modified>\
</cp:coreProperties>",
        escape(&metadata.title),
        escape(&metadata.creator),
        escape(&metadata.creator),
        escape(&metadata.created),
        escape(&metadata.created),
    )
}

fn app_properties(document: &Document) -> String {
    format!(
        "{XML_DECLARATION}<Properties xmlns=\"http://schemas.openxmlformats.org/officeDocument/2006/extended-properties\" \
xmlns:vt=\"http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes\">\
<Application>SOCDOF</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop>\
<Company>{}</Company><AppVersion>{}</AppVersion>\
</Properties>",
        env!("CARGO_PKG_VERSION"),
        escape(&document.metadata.creator),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::docx::{Block, Metadata, Run, Table};

    fn sample() -> Document {
        Document {
            logo: None,
            stationery: None,
            tokens: Vec::new(),
            blocks: vec![
                Block::Heading {
                    level: 1,
                    runs: vec![Run::plain("Titel")],
                },
                Block::Paragraph {
                    runs: vec![Run::bold("fett"), Run::plain(" & normal")],
                },
                Block::Table(Table::default()),
                Block::PageBreak,
            ],
            metadata: Metadata {
                title: "Titel & Co".to_string(),
                creator: "Müller".to_string(),
                created: "2026-11-09T00:00:00Z".to_string(),
            },
        }
    }

    #[test]
    fn the_package_has_the_parts_word_expects() {
        let package = write(&sample()).expect("writes");
        for part in [
            "[Content_Types].xml",
            "_rels/.rels",
            "word/document.xml",
            "word/_rels/document.xml.rels",
            "word/styles.xml",
            "docProps/core.xml",
            "docProps/app.xml",
        ] {
            assert!(
                zip::read(&package, part).expect("reads").is_some(),
                "missing {part}"
            );
        }
    }

    fn part(package: &[u8], name: &str) -> String {
        String::from_utf8(zip::read(package, name).expect("reads").expect("part"))
            .expect("utf-8 part")
    }

    fn image(png: &[u8], width: u32, height: u32, position: &str) -> DocxImage {
        DocxImage {
            png: png.to_vec(),
            width,
            height,
            position: position.to_string(),
        }
    }

    #[test]
    fn a_logo_only_lives_in_the_first_page_header() {
        let mut document = sample();
        document.logo = Some(image(b"\x89PNG\r\n\x1a\nlogo", 200, 100, "right"));
        let package = write(&document).expect("writes");

        let first_header = part(&package, "word/header1.xml");
        assert!(first_header.contains("name=\"Logo\""));
        assert!(!first_header.contains("Briefpapier"));
        assert!(zip::read(&package, "word/header2.xml")
            .expect("reads")
            .is_none());

        let body = part(&package, "word/document.xml");
        assert!(body.contains("<w:titlePg/>"));
        assert!(body.contains("<w:headerReference w:type=\"first\" r:id=\"rId2\"/>"));
        assert!(!body.contains("w:type=\"default\""));
    }

    #[test]
    fn stationery_alone_is_the_default_header() {
        let mut document = sample();
        document.stationery = Some(image(b"\x89PNG\r\n\x1a\npaper", 800, 1000, ""));
        let package = write(&document).expect("writes");

        let header = part(&package, "word/header1.xml");
        assert!(header.contains("name=\"Briefpapier\""));
        assert!(!header.contains("name=\"Logo\""));
        assert!(zip::read(&package, "word/header2.xml")
            .expect("reads")
            .is_none());

        let body = part(&package, "word/document.xml");
        assert!(!body.contains("<w:titlePg/>"));
        assert!(body.contains("<w:headerReference w:type=\"default\" r:id=\"rId2\"/>"));
    }

    #[test]
    fn stationery_tokens_become_page_anchored_text_tables() {
        let mut document = sample();
        document.stationery = Some(image(b"\x89PNG\r\n\x1a\npaper", 800, 1000, ""));
        document.tokens = vec![DocxToken {
            text: "2026-0001".to_string(),
            x_pct: 65.0,
            y_pct: 22.0,
            width_pct: Some(30.0),
            font_size_px: 14.0,
            bold: true,
            color: [185, 28, 28],
            align: "right".to_string(),
        }];
        let package = write(&document).expect("writes");

        let first_header = part(&package, "word/header1.xml");
        assert!(first_header.contains("w:vertAnchor=\"page\""));
        assert!(first_header.contains("w:tblpX=\"7739\""), "{first_header}");
        assert!(first_header.contains("w:tblpY=\"3704\""), "{first_header}");
        assert!(first_header.contains("<w:jc w:val=\"right\"/>"));
        assert!(first_header.contains("<w:b/>"));
        assert!(first_header.contains("<w:color w:val=\"B91C1C\"/>"));
        assert!(first_header.contains("<w:sz w:val=\"21\"/>"));
        assert!(first_header.contains("2026-0001"));

        // Only the letterhead repeats; the token fields stay on the first page.
        let later_header = part(&package, "word/header2.xml");
        assert!(!later_header.contains("w:tblPr"), "{later_header}");
        assert!(!later_header.contains("2026-0001"));
        let body = part(&package, "word/document.xml");
        assert!(body.contains("<w:titlePg/>"));
    }

    #[test]
    fn text_is_escaped_in_the_document_part() {
        let package = write(&sample()).expect("writes");
        let document =
            String::from_utf8(zip::read(&package, "word/document.xml").unwrap().unwrap())
                .expect("utf-8");
        assert!(document.contains(" &amp; normal"));
        assert!(document.contains("<w:b/>"));
        assert!(document.contains("<w:br w:type=\"page\"/>"));
        assert!(document.contains("<w:pStyle w:val=\"Heading1\"/>"));
    }
}
