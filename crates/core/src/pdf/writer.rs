//! Minimal PDF writer.
//!
//! Supports what invoices need: A4 pages, Helvetica regular/bold, text with WinAnsi encoding, right
//! aligned text and horizontal rules. The output is a single page PDF 1.4 with a correct xref table.

/// A4 width in millimetres.
pub const PAGE_WIDTH_MM: f64 = 210.0;
/// A4 height in millimetres.
pub const PAGE_HEIGHT_MM: f64 = 297.0;

const POINTS_PER_MM: f64 = 72.0 / 25.4;

/// Converts millimetres into PDF points.
pub fn mm(value: f64) -> f64 {
    value * POINTS_PER_MM
}

/// Content of one page, written as a PDF content stream.
#[derive(Debug)]
pub struct Page {
    content: String,
}

impl Default for Page {
    fn default() -> Self {
        Page::new()
    }
}

impl Page {
    /// Creates an empty page.
    pub fn new() -> Self {
        Page {
            content: String::new(),
        }
    }

    /// Writes text with the regular font. `x` and `y` are in points from the lower left corner.
    pub fn text(&mut self, x: f64, y: f64, size: f64, text: &str) {
        self.write_text("F1", x, y, size, text);
    }

    /// Writes text with the bold font.
    pub fn text_bold(&mut self, x: f64, y: f64, size: f64, text: &str) {
        self.write_text("F2", x, y, size, text);
    }

    /// Writes text so that it ends exactly at `x_right`.
    pub fn text_right(&mut self, x_right: f64, y: f64, size: f64, text: &str) {
        let x = x_right - text_width(text, size);
        self.text(x, y, size, text);
    }

    /// Writes bold text so that it ends exactly at `x_right`.
    pub fn text_right_bold(&mut self, x_right: f64, y: f64, size: f64, text: &str) {
        let x = x_right - text_width(text, size);
        self.text_bold(x, y, size, text);
    }

    /// Draws a horizontal line.
    pub fn line(&mut self, x1: f64, y: f64, x2: f64, width: f64) {
        self.content.push_str(&format!(
            "{width:.2} w {x1:.2} {y:.2} m {x2:.2} {y:.2} l S\n"
        ));
    }

    fn write_text(&mut self, font: &str, x: f64, y: f64, size: f64, text: &str) {
        self.content.push_str(&format!(
            "BT /{font} {size:.2} Tf 1 0 0 1 {x:.2} {y:.2} Tm ({}) Tj ET\n",
            escape(text)
        ));
    }
}

/// A single page PDF document.
#[derive(Debug)]
pub struct Document {
    title: String,
    page: Page,
}

impl Document {
    /// Creates a document with a title shown in the PDF viewer.
    pub fn new(title: &str) -> Self {
        Document {
            title: title.to_string(),
            page: Page::new(),
        }
    }

    /// Mutable access to the page content.
    pub fn page_mut(&mut self) -> &mut Page {
        &mut self.page
    }

    /// Renders the PDF file.
    pub fn to_bytes(&self) -> Vec<u8> {
        let content = &self.page.content;
        let objects = [
            "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
            format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.2} {:.2}] \
                 /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
                mm(PAGE_WIDTH_MM),
                mm(PAGE_HEIGHT_MM)
            ),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
                .to_string(),
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
                .to_string(),
            format!(
                "<< /Length {} >>\nstream\n{}\nendstream",
                content.len(),
                content
            ),
            format!(
                "<< /Title ({}) /Producer (SOCDOF) /Creator (SOCDOF) >>",
                escape(&self.title)
            ),
        ];

        let mut out: Vec<u8> = Vec::with_capacity(content.len() + 1024);
        out.extend_from_slice(b"%PDF-1.4\n%\n");

        let mut offsets = Vec::with_capacity(objects.len());
        for (index, body) in objects.iter().enumerate() {
            offsets.push(out.len());
            out.extend_from_slice(format!("{} 0 obj\n{}\nendobj\n", index + 1, body).as_bytes());
        }

        let xref_offset = out.len();
        let size = objects.len() + 1;
        out.extend_from_slice(format!("xref\n0 {size}\n").as_bytes());
        out.extend_from_slice(b"0000000000 65535 f \n");
        for offset in offsets {
            out.extend_from_slice(format!("{offset:010} 00000 n \n").as_bytes());
        }

        out.extend_from_slice(
            format!(
                "trailer\n<< /Size {size} /Root 1 0 R /Info 7 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
            )
            .as_bytes(),
        );

        out
    }
}

/// Approximate width of `text` in points for Helvetica.
pub fn text_width(text: &str, size: f64) -> f64 {
    text.chars().map(|c| char_width_em(c) * size).sum()
}

fn char_width_em(c: char) -> f64 {
    match c {
        '0'..='9' => 0.556,
        ' ' => 0.278,
        '.' | ',' | ':' | ';' | '!' | '|' | '\'' => 0.278,
        '-' | '/' | '(' | ')' => 0.333,
        'i' | 'l' | 'j' | 'I' => 0.278,
        'm' | 'w' | 'M' | 'W' => 0.833,
        c if c.is_uppercase() => 0.667,
        c if c.is_lowercase() => 0.5,
        _ => 0.556,
    }
}

/// Escapes a string for a PDF literal and encodes it as WinAnsi.
fn escape(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 8);
    for character in text.chars() {
        let byte = win_ansi(character);
        match byte {
            b'(' => out.push_str("\\("),
            b')' => out.push_str("\\)"),
            b'\\' => out.push_str("\\\\"),
            0x20..=0x7E => out.push(byte as char),
            other => out.push_str(&format!("\\{other:03o}")),
        }
    }
    out
}

/// Maps Unicode characters onto their WinAnsi position. Unsupported characters become `?`.
fn win_ansi(character: char) -> u8 {
    match character {
        '€' => 0x80,
        '‚' => 0x82,
        '„' => 0x84,
        '…' => 0x85,
        '‘' => 0x91,
        '’' => 0x92,
        '“' => 0x93,
        '”' => 0x94,
        '–' => 0x96,
        '—' => 0x97,
        c if (c as u32) <= 0xFF => c as u8,
        _ => b'?',
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_a_structurally_valid_pdf() {
        let mut document = Document::new("Test");
        document.page_mut().text(mm(25.0), mm(280.0), 12.0, "Hallo");

        let bytes = document.to_bytes();
        let text = String::from_utf8(bytes).expect("ascii pdf");

        assert!(text.starts_with("%PDF-1.4"));
        assert!(text.contains("/MediaBox [0 0 595.28 841.89]"));
        assert!(text.ends_with("%%EOF\n"));

        let start = text.rfind("startxref").expect("startxref present");
        let offset: usize = text[start + "startxref".len()..]
            .split_whitespace()
            .next()
            .expect("offset")
            .parse()
            .expect("number");
        assert_eq!(&text[offset..offset + 4], "xref");
    }

    #[test]
    fn escapes_pdf_strings_and_umlauts() {
        let mut document = Document::new("Titel (Test)");
        document
            .page_mut()
            .text(0.0, 0.0, 10.0, "Müller (GmbH) \\ Test");

        let text = String::from_utf8(document.to_bytes()).expect("ascii pdf");
        assert!(text.contains("M\\374ller \\(GmbH\\) \\\\ Test"));
    }

    #[test]
    fn measures_text_for_right_alignment() {
        let narrow = text_width("111", 10.0);
        let wide = text_width("888888", 10.0);
        assert!(wide > narrow);
    }
}
