//! Minimal PDF writer.
//!
//! Supports what invoices need: A4 pages, Helvetica regular/bold, text with WinAnsi encoding, right
//! aligned text, horizontal rules, any number of pages and one full-page background (a raster
//! letterhead embedded as a Flate-compressed RGB image, or vector stationery copied as PDF drawing
//! operators) that is repeated on every page. The output is a PDF 1.4 with a correct xref table.

use std::io::Write;
use std::path::Path;

use crate::pdf::vector::VectorBackground;

/// A4 width in millimetres.
pub const PAGE_WIDTH_MM: f64 = 210.0;
/// A4 height in millimetres.
pub const PAGE_HEIGHT_MM: f64 = 297.0;

const POINTS_PER_MM: f64 = 72.0 / 25.4;

/// Converts millimetres into PDF points.
pub fn mm(value: f64) -> f64 {
    value * POINTS_PER_MM
}

/// Converts PDF points back into millimetres, used by the layout tests.
pub fn to_mm(points: f64) -> f64 {
    points / POINTS_PER_MM
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

/// Decoded background image, ready for the PDF image object.
#[derive(Debug, Clone)]
pub struct BackgroundImage {
    /// Pixel width.
    pub width: u32,
    /// Pixel height.
    pub height: u32,
    /// RGB samples, three bytes per pixel, row by row.
    pub rgb: Vec<u8>,
}

impl BackgroundImage {
    /// Decodes a PNG file into RGB samples.
    pub fn from_png(path: &Path) -> Result<Self, String> {
        let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
        Self::from_png_bytes(&bytes)
    }

    /// Decodes PNG bytes into RGB samples.
    pub fn from_png_bytes(bytes: &[u8]) -> Result<Self, String> {
        Self::from_raster_bytes(bytes)
    }

    /// Decodes JPEG, GIF, WebP, BMP or ICO bytes into RGB samples.
    fn from_raster_bytes(bytes: &[u8]) -> Result<Self, String> {
        let image = image::load_from_memory(bytes)
            .map_err(|error| error.to_string())?
            .to_rgb8();
        let (width, height) = image.dimensions();
        let rgb = image.into_raw();
        let expected = width as usize * height as usize * 3;
        if rgb.len() != expected {
            return Err("background image has an unexpected sample count".to_string());
        }
        Ok(Self { width, height, rgb })
    }

    /// Decodes a logo or stationery asset: a raster image, an SVG, or the first raster image of a PDF.
    pub fn from_stationery_bytes(bytes: &[u8]) -> Result<Self, String> {
        if bytes.starts_with(b"%PDF") {
            Self::from_pdf_bytes(bytes)
        } else if looks_like_svg(bytes) {
            Self::from_svg_bytes(bytes)
        } else {
            Self::from_raster_bytes(bytes)
        }
    }

    /// Rasterizes an SVG at its intrinsic size, capped to a safe bitmap dimension.
    #[cfg(not(target_arch = "wasm32"))]
    fn from_svg_bytes(bytes: &[u8]) -> Result<Self, String> {
        const MAX_SIDE: f32 = 2048.0;

        let tree = resvg::usvg::Tree::from_data(bytes, &resvg::usvg::Options::default())
            .map_err(|error| error.to_string())?;
        let size = tree.size();
        let intrinsic_width = size.width();
        let intrinsic_height = size.height();
        if !intrinsic_width.is_finite()
            || !intrinsic_height.is_finite()
            || intrinsic_width <= 0.0
            || intrinsic_height <= 0.0
        {
            return Err("svg has no drawable size".to_string());
        }

        let scale = (MAX_SIDE / intrinsic_width.max(intrinsic_height)).min(1.0);
        let width = (intrinsic_width * scale).ceil().max(1.0) as u32;
        let height = (intrinsic_height * scale).ceil().max(1.0) as u32;
        let mut pixmap = resvg::tiny_skia::Pixmap::new(width, height)
            .ok_or_else(|| "svg raster is too large".to_string())?;
        resvg::render(
            &tree,
            resvg::tiny_skia::Transform::from_scale(scale, scale),
            &mut pixmap.as_mut(),
        );

        let rgba = pixmap.data();
        let expected = width as usize * height as usize * 4;
        if rgba.len() != expected {
            return Err("svg raster has an unexpected sample count".to_string());
        }
        let mut rgb = Vec::with_capacity(width as usize * height as usize * 3);
        for pixel in rgba.chunks_exact(4) {
            // tiny-skia stores premultiplied RGBA; composite transparent pixels onto white.
            let alpha = pixel[3] as u16;
            rgb.push((pixel[0] as u16 + 255 - alpha).min(255) as u8);
            rgb.push((pixel[1] as u16 + 255 - alpha).min(255) as u8);
            rgb.push((pixel[2] as u16 + 255 - alpha).min(255) as u8);
        }
        Ok(Self { width, height, rgb })
    }

    /// The browser build keeps the native decoders and skips SVG rasterization.
    #[cfg(target_arch = "wasm32")]
    fn from_svg_bytes(_bytes: &[u8]) -> Result<Self, String> {
        Err("svg rasterization is unavailable in the browser build".to_string())
    }

    /// Extracts the largest image from the first page of a PDF.
    ///
    /// This covers letterheads exported as a full-page image, including every PDF this writer
    /// produces. Vector-only PDFs have no embedded raster image and are rejected by the caller.
    pub fn from_pdf_bytes(bytes: &[u8]) -> Result<Self, String> {
        let mut best: Option<(u64, BackgroundImage)> = None;
        let mut cursor = 0;
        while let Some(offset) = find_bytes(&bytes[cursor..], b"/Subtype /Image") {
            let start = cursor + offset;
            let end = find_bytes(&bytes[start..], b"endobj")
                .map(|value| start + value)
                .unwrap_or(bytes.len());
            let object = &bytes[start..end];
            if let Some(image) = decode_pdf_image(object) {
                let area = image.width as u64 * image.height as u64;
                if best
                    .as_ref()
                    .map(|(value, _)| area > *value)
                    .unwrap_or(true)
                {
                    best = Some((area, image));
                }
            }
            cursor = end.max(start + 1);
        }
        best.map(|(_, image)| image)
            .ok_or_else(|| "pdf_stationery_without_raster_image".to_string())
    }

    /// Background operator that stretches the image over the whole page.
    fn operator(&self, width_pt: f64, height_pt: f64) -> String {
        format!("q {width_pt:.2} 0 0 {height_pt:.2} 0 0 cm /Bg Do Q\n")
    }

    fn deflated(&self) -> Vec<u8> {
        let mut encoder =
            flate2::write::ZlibEncoder::new(Vec::new(), flate2::Compression::default());
        encoder.write_all(&self.rgb).expect("in-memory deflate");
        encoder.finish().expect("in-memory deflate")
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

    /// Writes text in a fill color, then restores black for the following operators.
    pub fn text_color(&mut self, x: f64, y: f64, size: f64, text: &str, color: [f64; 3]) {
        self.write_text_color("F1", x, y, size, text, color);
    }

    /// Writes bold text in a fill color, then restores black.
    pub fn text_bold_color(&mut self, x: f64, y: f64, size: f64, text: &str, color: [f64; 3]) {
        self.write_text_color("F2", x, y, size, text, color);
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

    /// Writes right-aligned text in a fill color.
    pub fn text_right_color(
        &mut self,
        x_right: f64,
        y: f64,
        size: f64,
        text: &str,
        color: [f64; 3],
    ) {
        let x = x_right - text_width(text, size);
        self.text_color(x, y, size, text, color);
    }

    /// Writes right-aligned bold text in a fill color.
    pub fn text_right_bold_color(
        &mut self,
        x_right: f64,
        y: f64,
        size: f64,
        text: &str,
        color: [f64; 3],
    ) {
        let x = x_right - text_width(text, size);
        self.text_bold_color(x, y, size, text, color);
    }

    /// Places the background image behind everything else on the page.
    pub fn background(&mut self, image: &BackgroundImage, width_pt: f64, height_pt: f64) {
        self.content
            .insert_str(0, &image.operator(width_pt, height_pt));
    }

    /// Places vector stationery behind everything else on the page.
    pub fn vector_background(&mut self, background: &VectorBackground) {
        self.content.insert_str(0, &background.page_placement());
    }

    /// Draws a registered image at a point in PDF coordinates.
    pub fn image(&mut self, name: &str, x: f64, y: f64, width: f64, height: f64) {
        self.content.push_str(&format!(
            "q {width:.2} 0 0 {height:.2} {x:.2} {y:.2} cm /{name} Do Q\n"
        ));
    }

    /// Draws a light horizontal mark (fold or hole mark) and returns the stroke colour to black.
    pub fn mark(&mut self, x1: f64, y: f64, x2: f64, grey: f64) {
        self.content.push_str(&format!(
            "{grey:.2} G 0.4 w {x1:.2} {y:.2} m {x2:.2} {y:.2} l S 0 G\n"
        ));
    }

    /// Draws a horizontal line.
    pub fn line(&mut self, x1: f64, y: f64, x2: f64, width: f64) {
        self.content.push_str(&format!(
            "{width:.2} w {x1:.2} {y:.2} m {x2:.2} {y:.2} l S\n"
        ));
    }

    /// Draws a QR code including its four module quiet zone.
    ///
    /// `x` and `y` are the lower left corner of the square, `size` its side in points.
    pub fn qr(&mut self, x: f64, y: f64, size: f64, code: &crate::barcode::qr::QrCode) {
        let quiet = 4usize;
        let total = code.size() + quiet * 2;
        let module = size / total as f64;
        for row in 0..code.size() {
            let mut column = 0;
            while column < code.size() {
                if !code.dark(row, column) {
                    column += 1;
                    continue;
                }
                let start = column;
                while column < code.size() && code.dark(row, column) {
                    column += 1;
                }
                let left = x + (quiet + start) as f64 * module;
                let bottom = y + size - (quiet + row + 1) as f64 * module;
                let width = (column - start) as f64 * module;
                self.content.push_str(&format!(
                    "0 G {left:.3} {bottom:.3} {width:.3} {module:.3} re f\n"
                ));
            }
        }
    }

    fn write_text(&mut self, font: &str, x: f64, y: f64, size: f64, text: &str) {
        self.content.push_str(&format!(
            "BT /{font} {size:.2} Tf 1 0 0 1 {x:.2} {y:.2} Tm ({}) Tj ET\n",
            escape(text)
        ));
    }

    fn write_text_color(
        &mut self,
        font: &str,
        x: f64,
        y: f64,
        size: f64,
        text: &str,
        color: [f64; 3],
    ) {
        let [red, green, blue] = color;
        self.content.push_str(&format!(
            "{red:.3} {green:.3} {blue:.3} rg BT /{font} {size:.2} Tf 1 0 0 1 {x:.2} {y:.2} Tm ({}) Tj ET 0 g\n",
            escape(text)
        ));
    }
}

/// A PDF document with one or more pages and an optional repeated background.
#[derive(Debug)]
pub struct Document {
    title: String,
    pages: Vec<Page>,
    background: Option<BackgroundImage>,
    vector_background: Option<VectorBackground>,
    images: Vec<BackgroundImage>,
}

impl Document {
    /// Creates a document with a title shown in the PDF viewer.
    pub fn new(title: &str) -> Self {
        Document {
            title: title.to_string(),
            pages: vec![Page::new()],
            background: None,
            vector_background: None,
            images: Vec::new(),
        }
    }

    /// Mutable access to the content of the current (last) page.
    pub fn page_mut(&mut self) -> &mut Page {
        self.pages.last_mut().expect("a document has a page")
    }

    /// Appends a page; the background image is painted on it as well.
    pub fn new_page(&mut self) -> &mut Page {
        self.pages.push(Page::new());
        if let Some(image) = &self.background {
            let page = self.pages.last_mut().expect("just pushed");
            page.background(image, mm(PAGE_WIDTH_MM), mm(PAGE_HEIGHT_MM));
        }
        if let Some(background) = &self.vector_background {
            let page = self.pages.last_mut().expect("just pushed");
            page.vector_background(background);
        }
        self.pages.last_mut().expect("just pushed")
    }

    /// Number of pages the document writes.
    pub fn page_count(&self) -> usize {
        self.pages.len()
    }

    /// Embeds a background image that covers every page, including pages added later.
    pub fn set_background(&mut self, image: BackgroundImage) {
        for page in &mut self.pages {
            page.background(&image, mm(PAGE_WIDTH_MM), mm(PAGE_HEIGHT_MM));
        }
        self.background = Some(image);
        self.vector_background = None;
    }

    /// Embeds vector stationery that is painted under every page, including pages added later.
    pub fn set_vector_background(&mut self, background: VectorBackground) {
        for page in &mut self.pages {
            page.vector_background(&background);
        }
        self.background = None;
        self.vector_background = Some(background);
    }

    /// Registers an image and returns the XObject name used by [`Page::image`].
    pub fn add_image(&mut self, image: BackgroundImage) -> String {
        self.images.push(image);
        format!("Im{}", self.images.len())
    }

    /// Dimensions of a registered image in pixels, if it exists.
    pub fn image_size(&self, name: &str) -> Option<(u32, u32)> {
        let index = name.strip_prefix("Im")?.parse::<usize>().ok()?;
        let image = self.images.get(index.checked_sub(1)?)?;
        Some((image.width, image.height))
    }

    /// Renders the PDF file.
    pub fn to_bytes(&self) -> Vec<u8> {
        let page_count = self.pages.len();
        let regular_font = 3 + page_count;
        let bold_font = regular_font + 1;
        let first_content = bold_font + 1;
        let info = first_content + page_count;
        let first_image = info + 1;
        let mut xobjects = Vec::new();
        if self.background.is_some() {
            xobjects.push(format!("/Bg {first_image} 0 R"));
        }
        let logo_start = first_image + usize::from(self.background.is_some());
        for index in 0..self.images.len() {
            xobjects.push(format!("/Im{} {} 0 R", index + 1, logo_start + index));
        }
        let resources = if xobjects.is_empty() {
            format!("<< /Font << /F1 {regular_font} 0 R /F2 {bold_font} 0 R >> >>")
        } else {
            format!(
                "<< /Font << /F1 {regular_font} 0 R /F2 {bold_font} 0 R >> \\
                 /XObject << {} >> >>",
                xobjects.join(" ")
            )
        };

        let mut objects: Vec<Vec<u8>> = Vec::with_capacity(page_count + 6 + self.images.len());
        objects.push(b"<< /Type /Catalog /Pages 2 0 R >>".to_vec());
        let kids = (0..page_count)
            .map(|index| format!("{} 0 R", 3 + index))
            .collect::<Vec<_>>()
            .join(" ");
        objects.push(format!("<< /Type /Pages /Kids [{kids}] /Count {page_count} >>").into_bytes());
        for index in 0..page_count {
            objects.push(
                format!(
                    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {:.2} {:.2}] \\
                     /Resources {resources} /Contents {} 0 R >>",
                    mm(PAGE_WIDTH_MM),
                    mm(PAGE_HEIGHT_MM),
                    first_content + index
                )
                .into_bytes(),
            );
        }
        objects.push(
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
                .to_vec(),
        );
        objects.push(
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
                .to_vec(),
        );
        for page in &self.pages {
            let content = &page.content;
            let mut stream = format!("<< /Length {} >>\nstream\n", content.len()).into_bytes();
            stream.extend_from_slice(content.as_bytes());
            stream.extend_from_slice(b"\nendstream");
            objects.push(stream);
        }
        objects.push(
            format!(
                "<< /Title ({}) /Producer (SOCDOF) /Creator (SOCDOF) >>",
                escape(&self.title)
            )
            .into_bytes(),
        );
        for image in self.background.iter().chain(self.images.iter()) {
            let data = image.deflated();
            let mut object = format!(
                "<< /Type /XObject /Subtype /Image /Width {} /Height {} /ColorSpace /DeviceRGB \\
                 /BitsPerComponent 8 /Filter /FlateDecode /Length {} >>\nstream\n",
                image.width,
                image.height,
                data.len()
            )
            .into_bytes();
            object.extend_from_slice(&data);
            object.extend_from_slice(b"\nendstream");
            objects.push(object);
        }

        let mut out: Vec<u8> = Vec::with_capacity(
            self.pages
                .iter()
                .map(|page| page.content.len())
                .sum::<usize>()
                + 4096,
        );
        out.extend_from_slice(b"%PDF-1.4\n%\n");

        let mut offsets = Vec::with_capacity(objects.len());
        for (index, body) in objects.iter().enumerate() {
            offsets.push(out.len());
            out.extend_from_slice(format!("{} 0 obj\n", index + 1).as_bytes());
            out.extend_from_slice(body);
            out.extend_from_slice(b"\nendobj\n");
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
                "trailer\n<< /Size {size} /Root 1 0 R /Info {info} 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
            )
            .as_bytes(),
        );

        out
    }
}

fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

fn pdf_number(header: &str, key: &str) -> Option<usize> {
    let rest = &header[header.find(key)? + key.len()..];
    let digits: String = rest
        .trim_start()
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect();
    digits.parse().ok()
}

fn looks_like_svg(bytes: &[u8]) -> bool {
    let bytes = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    bytes
        .iter()
        .position(|byte| !byte.is_ascii_whitespace())
        .map(|start| bytes[start] == b'<')
        .unwrap_or(false)
}

fn decode_pdf_image(object: &[u8]) -> Option<BackgroundImage> {
    let header_end = find_bytes(object, b"stream")?;
    let header = String::from_utf8_lossy(&object[..header_end]);
    if !header.contains("/Subtype /Image") || !header.contains("/BitsPerComponent 8") {
        return None;
    }
    let width = pdf_number(&header, "/Width")? as u32;
    let height = pdf_number(&header, "/Height")? as u32;
    let length = pdf_number(&header, "/Length")?;
    let mut start = header_end + b"stream".len();
    if object.get(start) == Some(&b'\r') {
        start += 1;
    }
    if object.get(start) == Some(&b'\n') {
        start += 1;
    }
    let end = start.saturating_add(length).min(object.len());
    let stream = &object[start..end];
    let samples = if header.contains("/Filter /FlateDecode") {
        let mut decoded = Vec::new();
        let mut decoder = flate2::read::ZlibDecoder::new(stream);
        std::io::Read::read_to_end(&mut decoder, &mut decoded).ok()?;
        decoded
    } else {
        stream.to_vec()
    };
    let rgb = if header.contains("/ColorSpace /DeviceRGB") {
        samples
    } else if header.contains("/ColorSpace /DeviceGray") {
        samples
            .iter()
            .flat_map(|value| [*value, *value, *value])
            .collect()
    } else {
        return None;
    };
    let expected = width as usize * height as usize * 3;
    if width == 0 || height == 0 || rgb.len() < expected {
        return None;
    }
    Some(BackgroundImage {
        width,
        height,
        rgb: rgb[..expected].to_vec(),
    })
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
    fn embeds_a_png_background_as_an_image_object() {
        let directory = std::env::temp_dir().join(format!("socdof-bg-{}", std::process::id()));
        std::fs::create_dir_all(&directory).expect("temp dir");
        let path = directory.join("briefpapier.png");
        {
            let file = std::fs::File::create(&path).expect("png file");
            let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), 4, 3);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut writer = encoder.write_header().expect("png header");
            writer
                .write_image_data(&[255u8; 4 * 3 * 4])
                .expect("png data");
        }

        let image = BackgroundImage::from_png(&path).expect("decoded");
        assert_eq!((image.width, image.height), (4, 3));

        let mut document = Document::new("Brief");
        document.set_background(image);
        document.page_mut().text(20.0, 20.0, 10.0, "Text");
        let bytes = document.to_bytes();
        let text = String::from_utf8_lossy(&bytes);

        assert!(text.contains("/Subtype /Image"));
        assert!(text.contains("/Filter /FlateDecode"));
        assert!(text.contains("/Bg Do"));
        assert!(text.contains("/XObject << /Bg 8 0 R >>"));
        assert!(text.ends_with("%%EOF\n"));

        let _ = std::fs::remove_dir_all(directory);
    }

    #[test]
    fn writes_several_pages_with_a_shared_background() {
        let mut document = Document::new("Mehrseitig");
        document.page_mut().text(20.0, 20.0, 10.0, "Seite eins");
        document.new_page().text(20.0, 20.0, 10.0, "Seite zwei");
        document.new_page().text(20.0, 20.0, 10.0, "Seite drei");
        assert_eq!(document.page_count(), 3);

        let text = String::from_utf8(document.to_bytes()).expect("ascii pdf");
        assert!(text.contains("/Count 3"));
        assert!(text.contains("/Kids [3 0 R 4 0 R 5 0 R]"));
        assert_eq!(text.matches("/Type /Page /Parent").count(), 3);
        assert!(text.contains("Seite drei"));
        assert!(text.ends_with("%%EOF\n"));

        let start = text.rfind("startxref").expect("startxref present");
        let offset: usize = text[start + "startxref".len()..]
            .split_whitespace()
            .next()
            .expect("offset")
            .parse()
            .expect("number");
        assert_eq!(&text[offset..offset + 4], "xref");
        assert!(text.contains("/Info 11 0 R"));
    }

    #[test]
    fn measures_text_for_right_alignment() {
        let narrow = text_width("111", 10.0);
        let wide = text_width("888888", 10.0);
        assert!(wide > narrow);
    }
}
