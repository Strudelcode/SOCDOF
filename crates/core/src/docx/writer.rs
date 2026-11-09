//! Writes a [`Document`] as an OOXML package.
//!
//! The package contains the parts Word needs to open the file without repair prompts: the content
//! types, both relationship parts, the main document, a styles part with the used styles and the
//! core and extended properties. Page size and margins follow the A4 layout of the printed invoice
//! (25 mm left, 20 mm right and bottom).

use super::xml::escape;
use super::{zip, Block, Document, DocxError, Run, Table};

/// Builds the package bytes of `document`.
pub fn write(document: &Document) -> Result<Vec<u8>, DocxError> {
    let parts = vec![
        (
            "[Content_Types].xml".to_string(),
            content_types().into_bytes(),
        ),
        ("_rels/.rels".to_string(), root_relationships().into_bytes()),
        (
            "word/document.xml".to_string(),
            document_xml(document).into_bytes(),
        ),
        (
            "word/_rels/document.xml.rels".to_string(),
            document_relationships().into_bytes(),
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
    Ok(zip::write(&parts))
}

const XML_DECLARATION: &str = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\n";

fn content_types() -> String {
    format!(
        "{XML_DECLARATION}<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">\
<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>\
<Default Extension=\"xml\" ContentType=\"application/xml\"/>\
<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>\
<Override PartName=\"/word/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml\"/>\
<Override PartName=\"/docProps/core.xml\" ContentType=\"application/vnd.openxmlformats-package.core-properties+xml\"/>\
<Override PartName=\"/docProps/app.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.extended-properties+xml\"/>\
</Types>"
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

fn document_relationships() -> String {
    format!(
        "{XML_DECLARATION}<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">\
<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/>\
</Relationships>"
    )
}

fn document_xml(document: &Document) -> String {
    let mut body = String::new();
    for block in &document.blocks {
        body.push_str(&block_xml(block));
    }
    // Word expects the section properties as the last child of the body.
    body.push_str(
        "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/>\
<w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1417\" w:header=\"709\" w:footer=\"709\" w:gutter=\"0\"/>\
</w:sectPr>",
    );
    format!(
        "{XML_DECLARATION}<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\" \
xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">\
<w:body>{body}</w:body></w:document>"
    )
}

fn block_xml(block: &Block) -> String {
    match block {
        Block::Heading { level, runs } => {
            paragraph(Some(&format!("Heading{}", (*level).clamp(1, 6))), runs)
        }
        Block::Paragraph { runs } => paragraph(None, runs),
        Block::Table(table) => format!("{}{}", table_xml(table), paragraph(None, &[])),
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
<Company>{}</Company><AppVersion>0.30.0</AppVersion>\
</Properties>",
        escape(&document.metadata.creator),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::docx::{Block, Metadata, Run, Table};

    fn sample() -> Document {
        Document {
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
