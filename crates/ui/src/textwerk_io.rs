//! File and document output of the text editor window.
//!
//! The editor writes real files: plain text, HTML and a minimal single-font PDF, and it reads
//! PNG images for the picture insert. Everything here is pure `std`/`png`, so it runs in tests.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// One row of the file dialog.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileEntry {
    /// File or directory name.
    pub name: String,
    /// The entry is a directory.
    pub is_dir: bool,
    /// Size in bytes, zero for directories.
    pub size: u64,
}

/// Directory the dialog opens first: `~/Documents/SOCDOF`, falling back to the current directory.
pub fn documents_dir() -> PathBuf {
    if let Some(home) = std::env::var_os("HOME") {
        let documents = PathBuf::from(home).join("Documents").join("SOCDOF");
        if documents.is_dir() {
            return documents;
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

/// Lists a directory, directories first, filtered by file extension (lowercase, without dot).
pub fn list_dir(dir: &Path, extensions: &[&str]) -> Vec<FileEntry> {
    let mut entries = Vec::new();
    let Ok(read) = fs::read_dir(dir) else {
        return entries;
    };
    for entry in read.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let is_dir = path.is_dir();
        if !is_dir {
            let extension = path
                .extension()
                .map(|value| value.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if !extensions.is_empty() && !extensions.contains(&extension.as_str()) {
                continue;
            }
        }
        let size = entry.metadata().map(|meta| meta.len()).unwrap_or(0);
        entries.push(FileEntry { name, is_dir, size });
    }
    entries.sort_by(|left, right| {
        right
            .is_dir
            .cmp(&left.is_dir)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
    entries
}

/// Reads a UTF-8 text document.
pub fn read_text(path: &Path) -> io::Result<String> {
    fs::read_to_string(path)
}

/// Writes a UTF-8 text document, creating the parent directory.
pub fn write_text(path: &Path, body: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, body)
}

/// Escapes the five HTML entities of the body.
fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Writes the document as a standalone HTML page, paragraphs preserved.
pub fn write_html(path: &Path, title: &str, body: &str) -> io::Result<()> {
    let mut html = String::from("<!doctype html>\n<html><head><meta charset=\"utf-8\">\n");
    html.push_str(&format!("<title>{}</title>\n", html_escape(title)));
    html.push_str(
        "<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:3rem auto;\
         padding:0 1.5rem;line-height:1.6;color:#1e293b}h1{font-size:1.4rem}</style>\n",
    );
    html.push_str("</head><body>\n");
    for paragraph in body.split("\n\n") {
        if paragraph.trim().is_empty() {
            continue;
        }
        html.push_str("<p>");
        html.push_str(&html_escape(paragraph).replace('\n', "<br>\n"));
        html.push_str("</p>\n");
    }
    html.push_str("</body></html>\n");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, html)
}

/// Escapes a PDF literal string.
fn pdf_escape(text: &str) -> String {
    text.replace('\\', "\\\\")
        .replace('(', "\\(")
        .replace(')', "\\)")
}

/// Breaks the body into lines that fit `max_chars`, keeping explicit line breaks.
pub fn wrap_lines(body: &str, max_chars: usize) -> Vec<String> {
    let mut lines = Vec::new();
    for raw in body.lines() {
        if raw.chars().count() <= max_chars {
            lines.push(raw.to_string());
            continue;
        }
        let mut current = String::new();
        for word in raw.split(' ') {
            if current.is_empty() {
                current.push_str(word);
            } else if current.chars().count() + 1 + word.chars().count() <= max_chars {
                current.push(' ');
                current.push_str(word);
            } else {
                lines.push(std::mem::take(&mut current));
                current.push_str(word);
            }
        }
        if !current.is_empty() {
            lines.push(current);
        }
    }
    lines
}

/// Writes the document as a one-font A4 PDF, so print and export produce a real file.
pub fn write_pdf(path: &Path, title: &str, body: &str) -> io::Result<()> {
    // A4 in points, 56 pt margins, 11 pt Helvetica with 15 pt leading.
    const PAGE_WIDTH: f32 = 595.0;
    const PAGE_HEIGHT: f32 = 842.0;
    const MARGIN: f32 = 56.0;
    const LEADING: f32 = 15.0;
    let lines = wrap_lines(body, 88);
    let per_page = ((PAGE_HEIGHT - 2.0 * MARGIN) / LEADING).floor() as usize - 1;
    let mut pages: Vec<&[String]> = Vec::new();
    if lines.is_empty() {
        pages.push(&[]);
    } else {
        for chunk in lines.chunks(per_page.max(1)) {
            pages.push(chunk);
        }
    }

    let mut objects: Vec<String> = Vec::new();
    let page_count = pages.len();
    // 1 catalogue, 2 pages tree, 3 font, then two objects per page.
    objects.push("<< /Type /Catalog /Pages 2 0 R >>".to_string());
    let kids: Vec<String> = (0..page_count)
        .map(|index| format!("{} 0 R", 4 + index * 2))
        .collect();
    objects.push(format!(
        "<< /Type /Pages /Kids [{}] /Count {page_count} >>",
        kids.join(" ")
    ));
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string());

    for (index, page) in pages.iter().enumerate() {
        let mut content = String::new();
        content.push_str("BT\n/F1 11 Tf\n");
        content.push_str(&format!("{MARGIN} {} Td\n", PAGE_HEIGHT - MARGIN));
        content.push_str(&format!("{} TL\n", LEADING));
        if index == 0 {
            content.push_str(&format!("({}) Tj\nT*\n", pdf_escape(title)));
        }
        for line in page.iter() {
            content.push_str(&format!("({}) Tj\nT*\n", pdf_escape(line)));
            content.push_str("T*\n");
        }
        content.push_str("ET\n");
        let stream_index = 5 + index * 2;
        objects.push(format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] \
             /Resources << /Font << /F1 3 0 R >> >> /Contents {stream_index} 0 R >>"
        ));
        objects.push(format!(
            "<< /Length {} >>\nstream\n{}endstream",
            content.len(),
            content
        ));
    }

    let mut pdf = String::from("%PDF-1.4\n");
    let mut offsets = Vec::new();
    for (index, object) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        pdf.push_str(&format!("{} 0 obj\n{}\nendobj\n", index + 1, object));
    }
    let xref_offset = pdf.len();
    pdf.push_str(&format!("xref\n0 {}\n", objects.len() + 1));
    pdf.push_str("0000000000 65535 f \n");
    for offset in &offsets {
        pdf.push_str(&format!("{offset:010} 00000 n \n"));
    }
    pdf.push_str(&format!(
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n",
        objects.len() + 1
    ));
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, pdf)
}

/// Decoded PNG image: width, height and RGBA bytes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecodedImage {
    /// Pixel width.
    pub width: usize,
    /// Pixel height.
    pub height: usize,
    /// Row-major RGBA pixels.
    pub rgba: Vec<u8>,
}

/// Decodes a PNG file into RGBA8.
pub fn decode_png(path: &Path) -> io::Result<DecodedImage> {
    let file = fs::File::open(path)?;
    let decoder = png::Decoder::new(io::BufReader::new(file));
    let mut reader = decoder
        .read_info()
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error.to_string()))?;
    let mut buffer = vec![0; reader.output_buffer_size()];
    let info = reader
        .next_frame(&mut buffer)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error.to_string()))?;
    let rgba = match info.color_type {
        png::ColorType::Rgba => buffer[..info.buffer_size()].to_vec(),
        png::ColorType::Rgb => {
            let mut rgba = Vec::with_capacity(info.width as usize * info.height as usize * 4);
            for pixel in buffer[..info.buffer_size()].chunks_exact(3) {
                rgba.extend_from_slice(&[pixel[0], pixel[1], pixel[2], 255]);
            }
            rgba
        }
        png::ColorType::Grayscale => {
            let mut rgba = Vec::with_capacity(info.width as usize * info.height as usize * 4);
            for value in &buffer[..info.buffer_size()] {
                rgba.extend_from_slice(&[*value, *value, *value, 255]);
            }
            rgba
        }
        png::ColorType::GrayscaleAlpha => {
            let mut rgba = Vec::with_capacity(info.width as usize * info.height as usize * 4);
            for pixel in buffer[..info.buffer_size()].chunks_exact(2) {
                rgba.extend_from_slice(&[pixel[0], pixel[0], pixel[0], pixel[1]]);
            }
            rgba
        }
        png::ColorType::Indexed => {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "indexed PNG images are not supported",
            ))
        }
    };
    Ok(DecodedImage {
        width: info.width as usize,
        height: info.height as usize,
        rgba,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("socdof-textwerk-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("temp dir");
        dir
    }

    #[test]
    fn text_round_trips_through_a_file() {
        let dir = temp_dir("text");
        let path = dir.join("notiz.txt");
        write_text(&path, "Zeile eins\nZeile zwei").expect("write");
        assert_eq!(read_text(&path).expect("read"), "Zeile eins\nZeile zwei");
        let entries = list_dir(&dir, &["txt"]);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "notiz.txt");
        assert!(list_dir(&dir, &["md"]).is_empty());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn html_export_escapes_the_body() {
        let dir = temp_dir("html");
        let path = dir.join("seite.html");
        write_html(&path, "Titel", "a < b & c\n\nzweiter Absatz").expect("write");
        let html = read_text(&path).expect("read");
        assert!(html.contains("<p>a &lt; b &amp; c</p>"));
        assert!(html.contains("<p>zweiter Absatz</p>"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pdf_export_writes_a_readable_document() {
        let dir = temp_dir("pdf");
        let path = dir.join("druck.pdf");
        write_pdf(&path, "Bericht", "Erste Zeile\nZweite (Zeile)").expect("write");
        let pdf = read_text(&path).expect("read");
        assert!(pdf.starts_with("%PDF-1.4"));
        assert!(pdf.contains("(Erste Zeile) Tj"));
        assert!(pdf.contains("(Zweite \\(Zeile\\)) Tj"));
        assert!(pdf.contains("/Type /Page "));
        assert!(pdf.trim_end().ends_with("%%EOF"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn lines_wrap_at_the_requested_width() {
        let lines = wrap_lines("aaa bbb ccc ddd", 7);
        assert_eq!(lines, vec!["aaa bbb", "ccc ddd"]);
        assert_eq!(wrap_lines("kurz", 10), vec!["kurz"]);
    }

    #[test]
    fn png_images_decode_to_rgba() {
        let dir = temp_dir("png");
        let path = dir.join("bild.png");
        let file = fs::File::create(&path).expect("create");
        let mut encoder = png::Encoder::new(io::BufWriter::new(file), 2, 1);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().expect("header");
        writer
            .write_image_data(&[255, 0, 0, 0, 255, 0])
            .expect("pixels");
        writer.finish().expect("finish");
        let image = decode_png(&path).expect("decode");
        assert_eq!((image.width, image.height), (2, 1));
        assert_eq!(image.rgba, vec![255, 0, 0, 255, 0, 255, 0, 255]);
        let _ = fs::remove_dir_all(&dir);
    }
}
