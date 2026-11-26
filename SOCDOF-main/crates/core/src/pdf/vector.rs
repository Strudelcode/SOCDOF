//! Vector-only PDF stationery.
//!
//! The TypeScript app rasterises the first PDF page before printing. The Rust exporter keeps the
//! page's vector operators instead: paths, rectangles, curves, fills and strokes are copied into the
//! invoice content stream, scaled like the CSS `object-fit: cover` image used by the reference.
//! Text, images, patterns and other resource-backed operators are intentionally skipped so the
//! generated document never references resources that were not copied with the page.

use crate::pdf::writer::mm;

/// A vector-only first page of a stationery PDF, in source page coordinates.
#[derive(Debug, Clone)]
pub struct VectorBackground {
    content: String,
    bounds: [f64; 4],
}

impl VectorBackground {
    /// Reads the first page of `bytes` and keeps its vector drawing operations.
    pub fn from_pdf_bytes(bytes: &[u8]) -> Result<Self, String> {
        if !bytes.starts_with(b"%PDF") {
            return Err("stationery source is not a PDF".to_string());
        }

        let objects = pdf_objects(bytes);
        let (_, page) = objects
            .iter()
            .find(|(_, body)| is_page(body))
            .ok_or_else(|| "pdf_stationery_without_page".to_string())?;
        let bounds = pdf_box(page, "/CropBox")
            .or_else(|| pdf_box(page, "/MediaBox"))
            .ok_or_else(|| "pdf_stationery_without_page_box".to_string())?;
        if bounds[2] <= bounds[0] || bounds[3] <= bounds[1] {
            return Err("pdf_stationery_has_empty_page".to_string());
        }

        let references = pdf_content_references(page);
        if references.is_empty() {
            return Err("pdf_stationery_without_content".to_string());
        }

        let mut source = String::new();
        for number in references {
            let body = object_body(&objects, number)
                .ok_or_else(|| "pdf_stationery_content_missing".to_string())?;
            source.push_str(&decode_content_stream(body)?);
            source.push('\n');
        }

        let content = sanitize_vector_content(&source)?;
        Ok(Self { content, bounds })
    }

    /// The sanitized source-page operators, used by geometry tests.
    pub fn content(&self) -> &str {
        &self.content
    }

    /// The affine transform from source-page coordinates to the A4 page.
    ///
    /// This mirrors `object-fit: cover`: the page is scaled until it covers A4 and the overflow is
    /// centred, so the aspect ratio is preserved.
    pub fn matrix(&self, width_pt: f64, height_pt: f64) -> [f64; 6] {
        let [left, bottom, right, top] = self.bounds;
        let source_width = (right - left).max(0.01);
        let source_height = (top - bottom).max(0.01);
        let scale = (width_pt / source_width).max(height_pt / source_height);
        let translated_x = (width_pt - source_width * scale) / 2.0 - left * scale;
        let translated_y = (height_pt - source_height * scale) / 2.0 - bottom * scale;
        [scale, 0.0, 0.0, scale, translated_x, translated_y]
    }

    /// The operator that paints this stationery behind the page content.
    pub fn placement(&self, width_pt: f64, height_pt: f64) -> String {
        let [a, b, c, d, e, f] = self.matrix(width_pt, height_pt);
        format!(
            "q {a:.6} {b:.6} {c:.6} {d:.6} {e:.6} {f:.6} cm\n{}\nQ\n",
            self.content
        )
    }

    /// The A4 placement used by the invoice PDF writer.
    pub fn page_placement(&self) -> String {
        self.placement(
            mm(crate::pdf::writer::PAGE_WIDTH_MM),
            mm(crate::pdf::writer::PAGE_HEIGHT_MM),
        )
    }
}

fn pdf_objects(bytes: &[u8]) -> Vec<(u32, &[u8])> {
    let mut objects = Vec::new();
    let mut cursor = 0;
    while let Some(offset) = find_bytes(&bytes[cursor..], b" obj") {
        let object = cursor + offset;
        let mut generation_start = object;
        while generation_start > 0 && bytes[generation_start - 1].is_ascii_digit() {
            generation_start -= 1;
        }
        let mut number_end = generation_start;
        while number_end > 0 && bytes[number_end - 1].is_ascii_whitespace() {
            number_end -= 1;
        }
        let mut number_start = number_end;
        while number_start > 0 && bytes[number_start - 1].is_ascii_digit() {
            number_start -= 1;
        }
        let number = if number_start < number_end {
            std::str::from_utf8(&bytes[number_start..number_end])
                .ok()
                .and_then(|value| value.parse().ok())
        } else {
            None
        };
        let body_start = object + 4;
        let Some(relative_end) = find_bytes(&bytes[body_start..], b"endobj") else {
            break;
        };
        let body_end = body_start + relative_end;
        if let Some(number) = number {
            objects.push((number, &bytes[body_start..body_end]));
        }
        cursor = body_end + b"endobj".len();
    }
    objects
}

fn object_body<'a>(objects: &'a [(u32, &'a [u8])], number: u32) -> Option<&'a [u8]> {
    objects
        .iter()
        .find(|(candidate, _)| *candidate == number)
        .map(|(_, body)| *body)
}

fn is_page(body: &[u8]) -> bool {
    let text = String::from_utf8_lossy(body);
    let mut rest = text.as_ref();
    while let Some(index) = rest.find("/Type") {
        let after = rest[index + "/Type".len()..].trim_start();
        if let Some(after) = after.strip_prefix("/Page") {
            if !after.starts_with('s') {
                return true;
            }
        }
        rest = &rest[index + "/Type".len()..];
    }
    false
}

fn pdf_box(body: &[u8], key: &str) -> Option<[f64; 4]> {
    let text = String::from_utf8_lossy(body);
    let start = text.find(key)? + key.len();
    let rest = text[start..].trim_start();
    let end = rest.strip_prefix('[')?.find(']')?;
    let values = rest[1..=end]
        .split_whitespace()
        .map(|value| value.parse::<f64>().ok())
        .collect::<Option<Vec<_>>>()?;
    if values.len() != 4 {
        return None;
    }
    Some([values[0], values[1], values[2], values[3]])
}

fn pdf_content_references(body: &[u8]) -> Vec<u32> {
    let text = String::from_utf8_lossy(body);
    let Some(start) = text.find("/Contents") else {
        return Vec::new();
    };
    let rest = text[start + "/Contents".len()..].trim_start();
    if let Some(array) = rest.strip_prefix('[') {
        let values = array.split(']').next().unwrap_or_default();
        let mut numbers = Vec::new();
        let mut references = Vec::new();
        for token in values.split_whitespace() {
            if token == "R" {
                if numbers.len() >= 2 {
                    references.push(numbers[numbers.len() - 2]);
                }
            } else if let Ok(number) = token.parse::<u32>() {
                numbers.push(number);
            }
        }
        return references;
    }

    let mut tokens = rest.split_whitespace();
    let Some(number) = tokens.next().and_then(|token| token.parse::<u32>().ok()) else {
        return Vec::new();
    };
    let Some(_generation) = tokens.next().and_then(|token| token.parse::<u32>().ok()) else {
        return Vec::new();
    };
    if tokens.next() == Some("R") {
        vec![number]
    } else {
        Vec::new()
    }
}

fn decode_content_stream(body: &[u8]) -> Result<String, String> {
    let stream_start = find_bytes(body, b"stream")
        .ok_or_else(|| "pdf_stationery_content_without_stream".to_string())?;
    let dictionary = String::from_utf8_lossy(&body[..stream_start]);
    let mut start = stream_start + b"stream".len();
    if body.get(start) == Some(&b'\r') {
        start += 1;
    }
    if body.get(start) == Some(&b'\n') {
        start += 1;
    }
    let end = find_bytes(&body[start..], b"endstream")
        .map(|offset| start + offset)
        .ok_or_else(|| "pdf_stationery_content_without_endstream".to_string())?;
    let mut data = &body[start..end];
    while matches!(data.last(), Some(b'\r' | b'\n')) {
        data = &data[..data.len() - 1];
    }

    let decoded = if dictionary.contains("/FlateDecode") {
        let mut decoder = flate2::read::ZlibDecoder::new(data);
        let mut decoded = Vec::new();
        std::io::Read::read_to_end(&mut decoder, &mut decoded)
            .map_err(|error| format!("pdf_stationery_content_invalid: {error}"))?;
        decoded
    } else if dictionary.contains("/Filter") {
        return Err("pdf_stationery_content_filter_unsupported".to_string());
    } else {
        data.to_vec()
    };
    Ok(String::from_utf8_lossy(&decoded).into_owned())
}

#[derive(Debug, Clone)]
enum Operand {
    Number(f64),
    Name(String),
    Array(String),
    Other,
}

enum Token {
    Operand(Operand),
    Operator(String),
}

fn sanitize_vector_content(source: &str) -> Result<String, String> {
    let bytes = source.as_bytes();
    let mut position = 0;
    let mut operands = Vec::new();
    let mut output = String::new();
    let mut depth = 0usize;
    let mut painted = false;
    let mut in_text = false;

    while position < bytes.len() {
        skip_space(bytes, &mut position);
        if position >= bytes.len() {
            break;
        }
        let Some(token) = next_token(bytes, &mut position) else {
            break;
        };
        match token {
            Token::Operand(operand) => {
                if !in_text {
                    operands.push(operand);
                }
            }
            Token::Operator(operator) => {
                if operator == "BI" {
                    return Err("pdf_stationery_inline_image_unsupported".to_string());
                }
                if in_text {
                    if operator == "ET" {
                        in_text = false;
                    }
                    operands.clear();
                    continue;
                }
                if operator == "BT" {
                    in_text = true;
                    operands.clear();
                    continue;
                }
                match operator.as_str() {
                    "q" => {
                        depth += 1;
                        write_operator(&mut output, &operands, "q");
                    }
                    "Q" => {
                        if depth > 0 {
                            depth -= 1;
                            write_operator(&mut output, &operands, "Q");
                        }
                    }
                    "S" | "s" | "f" | "F" | "f*" | "B" | "B*" | "b" | "b*" => {
                        if operands.is_empty() {
                            write_operator(&mut output, &operands, &operator);
                            painted = true;
                        }
                    }
                    _ => {
                        emit_vector_operator(&operator, &operands, &mut output);
                    }
                }
                operands.clear();
            }
        }
    }

    for _ in 0..depth {
        output.push_str("Q\n");
    }
    if !painted {
        return Err("pdf_stationery_without_vector_paint".to_string());
    }
    Ok(output)
}

fn emit_vector_operator(operator: &str, operands: &[Operand], output: &mut String) {
    let valid = match operator {
        "m" | "l" => count_numbers(operands, 2),
        "c" => count_numbers(operands, 6),
        "v" | "y" | "re" => count_numbers(operands, 4),
        "cm" => count_numbers(operands, 6),
        "w" | "J" | "j" | "M" | "i" => count_numbers(operands, 1),
        "rg" | "RG" => count_numbers(operands, 3),
        "g" | "G" => count_numbers(operands, 1),
        "k" | "K" => count_numbers(operands, 4),
        "d" => {
            operands.len() == 2
                && matches!(&operands[0], Operand::Array(array) if array.starts_with('['))
                && matches!(&operands[1], Operand::Number(_))
        }
        "cs" | "CS" => {
            operands.len() == 1
                && matches!(&operands[0], Operand::Name(name) if is_device_color_space(name))
        }
        "sc" | "SC" | "scn" | "SCN" => {
            !operands.is_empty() && operands.len() <= 4 && operands.iter().all(is_number)
        }
        "h" | "n" | "W" | "W*" => operands.is_empty(),
        _ => false,
    };
    if valid {
        write_operator(output, operands, operator);
    }
}

fn count_numbers(operands: &[Operand], count: usize) -> bool {
    operands.len() == count && operands.iter().all(is_number)
}

fn is_number(operand: &Operand) -> bool {
    matches!(operand, Operand::Number(_))
}

fn is_device_color_space(name: &str) -> bool {
    matches!(name, "/DeviceRGB" | "/DeviceGray" | "/DeviceCMYK")
}

fn write_operator(output: &mut String, operands: &[Operand], operator: &str) {
    for operand in operands {
        match operand {
            Operand::Number(value) => output.push_str(&value.to_string()),
            Operand::Name(name) | Operand::Array(name) => output.push_str(name),
            Operand::Other => return,
        }
        output.push(' ');
    }
    output.push_str(operator);
    output.push(' ');
}

fn skip_space(bytes: &[u8], position: &mut usize) {
    while *position < bytes.len() {
        if bytes[*position].is_ascii_whitespace() {
            *position += 1;
        } else if bytes[*position] == b'%' {
            while *position < bytes.len() && bytes[*position] != b'\n' {
                *position += 1;
            }
        } else {
            break;
        }
    }
}

fn next_token(bytes: &[u8], position: &mut usize) -> Option<Token> {
    if *position >= bytes.len() {
        return None;
    }
    match bytes[*position] {
        b'/' => {
            let start = *position;
            *position += 1;
            while *position < bytes.len() && !is_delimiter(bytes[*position]) {
                *position += 1;
            }
            let name = String::from_utf8_lossy(&bytes[start..*position]).into_owned();
            Some(Token::Operand(Operand::Name(name)))
        }
        b'[' => {
            let array = take_array(bytes, position);
            Some(Token::Operand(Operand::Array(array)))
        }
        b'(' => {
            skip_literal_string(bytes, position);
            Some(Token::Operand(Operand::Other))
        }
        b'<' if bytes.get(*position + 1) == Some(&b'<') => {
            skip_dictionary(bytes, position);
            Some(Token::Operand(Operand::Other))
        }
        b'<' => {
            skip_hex_string(bytes, position);
            Some(Token::Operand(Operand::Other))
        }
        b'+' | b'-' | b'.' | b'0'..=b'9' => {
            let start = *position;
            *position += 1;
            while *position < bytes.len() && !is_delimiter(bytes[*position]) {
                *position += 1;
            }
            let token = String::from_utf8_lossy(&bytes[start..*position]);
            token
                .parse()
                .ok()
                .map(|number| Token::Operand(Operand::Number(number)))
                .or(Some(Token::Operand(Operand::Other)))
        }
        _ => {
            let start = *position;
            *position += 1;
            while *position < bytes.len() && !is_delimiter(bytes[*position]) {
                *position += 1;
            }
            let operator = String::from_utf8_lossy(&bytes[start..*position]).into_owned();
            if operator.is_empty() {
                *position += 1;
                Some(Token::Operand(Operand::Other))
            } else {
                Some(Token::Operator(operator))
            }
        }
    }
}

fn is_delimiter(byte: u8) -> bool {
    byte.is_ascii_whitespace()
        || matches!(
            byte,
            b'(' | b')' | b'<' | b'>' | b'[' | b']' | b'{' | b'}' | b'/' | b'%'
        )
}

fn take_array(bytes: &[u8], position: &mut usize) -> String {
    let start = *position;
    *position += 1;
    let mut depth = 1usize;
    while *position < bytes.len() && depth > 0 {
        match bytes[*position] {
            b'[' => {
                depth += 1;
                *position += 1;
            }
            b']' => {
                depth -= 1;
                *position += 1;
            }
            b'(' => skip_literal_string(bytes, position),
            b'<' if bytes.get(*position + 1) == Some(&b'<') => skip_dictionary(bytes, position),
            b'<' => skip_hex_string(bytes, position),
            _ => *position += 1,
        }
    }
    String::from_utf8_lossy(&bytes[start..*position]).into_owned()
}

fn skip_literal_string(bytes: &[u8], position: &mut usize) {
    *position += 1;
    let mut depth = 1usize;
    while *position < bytes.len() && depth > 0 {
        match bytes[*position] {
            b'\\' => *position = (*position + 2).min(bytes.len()),
            b'(' => {
                depth += 1;
                *position += 1;
            }
            b')' => {
                depth -= 1;
                *position += 1;
            }
            _ => *position += 1,
        }
    }
}

fn skip_hex_string(bytes: &[u8], position: &mut usize) {
    *position += 1;
    while *position < bytes.len() {
        let byte = bytes[*position];
        *position += 1;
        if byte == b'>' {
            break;
        }
    }
}

fn skip_dictionary(bytes: &[u8], position: &mut usize) {
    *position += 2;
    let mut depth = 1usize;
    while *position < bytes.len() && depth > 0 {
        match bytes[*position] {
            b'<' if bytes.get(*position + 1) == Some(&b'<') => {
                depth += 1;
                *position += 2;
            }
            b'>' if bytes.get(*position + 1) == Some(&b'>') => {
                depth -= 1;
                *position += 2;
            }
            b'(' => skip_literal_string(bytes, position),
            _ => *position += 1,
        }
    }
}

fn find_bytes(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::pdf::writer::{mm, PAGE_HEIGHT_MM, PAGE_WIDTH_MM};

    fn vector_pdf(content: &str, width: u32, height: u32) -> Vec<u8> {
        format!(
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n\
             2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n\
             3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] \
             /Contents 4 0 R /Resources << /Font << /F1 9 0 R >> >> >>\nendobj\n\
             4 0 obj\n<< /Length {} >>\nstream\n{content}\nendstream\nendobj\n%%EOF\n",
            content.len()
        )
        .into_bytes()
    }

    #[test]
    fn keeps_vector_operators_and_cover_geometry() {
        let pdf = vector_pdf(
            "1 0 0 rg\n50 20 20 20 re f\n0 0 1 RG\n2 w\n50 20 m 70 40 l S\n",
            100,
            100,
        );
        let background = VectorBackground::from_pdf_bytes(&pdf).expect("vector stationery");
        assert!(background.content().contains("50 20 20 20 re f"));
        assert!(background.content().contains("50 20 m 70 40 l S"));

        let matrix = background.matrix(mm(PAGE_WIDTH_MM), mm(PAGE_HEIGHT_MM));
        let scale = mm(PAGE_HEIGHT_MM) / 100.0;
        assert!((matrix[0] - scale).abs() < 1e-9);
        assert!((matrix[4] - (mm(PAGE_WIDTH_MM) - 100.0 * scale) / 2.0).abs() < 1e-9);
        let placement = background.page_placement();
        assert!(
            placement.starts_with("q 8.418898 0.000000 0.000000 8.418898 -123.307087 0.000000 cm"),
            "{placement}"
        );
    }

    #[test]
    fn skips_text_and_rejects_content_without_painted_vectors() {
        let pdf = vector_pdf(
            "BT /F1 12 Tf 10 10 Td (Hintergrund) Tj ET\n0.5 g 1 2 3 4 re f\n",
            100,
            100,
        );
        let background = VectorBackground::from_pdf_bytes(&pdf).expect("vector fill");
        assert!(!background.content().contains("Hintergrund"));
        assert!(!background.content().contains("BT"));
        assert!(background.content().contains("1 2 3 4 re f"));

        let empty = vector_pdf("0 0 1 rg\n", 100, 100);
        assert!(VectorBackground::from_pdf_bytes(&empty).is_err());
    }

    #[test]
    fn repeats_vector_background_on_new_pages() {
        let pdf = vector_pdf("1 0 0 rg 50 20 20 20 re f", 100, 100);
        let background = VectorBackground::from_pdf_bytes(&pdf).expect("vector stationery");
        let mut document = crate::pdf::writer::Document::new("Mehrseitig");
        document.set_vector_background(background);
        document.page_mut().text(10.0, 10.0, 10.0, "eins");
        document.new_page().text(10.0, 10.0, 10.0, "zwei");

        let bytes = document.to_bytes();
        let text = String::from_utf8_lossy(&bytes);
        assert_eq!(text.matches("50 20 20 20 re f").count(), 2);
        assert_eq!(
            text.matches("q 8.418898 0.000000 0.000000 8.418898 -123.307087 0.000000 cm")
                .count(),
            2
        );
        assert!(text.contains("eins"));
        assert!(text.contains("zwei"));
    }

    #[test]
    fn preserves_paths_curves_and_color_operators() {
        let pdf = vector_pdf(
            "0 0 0 rg 1 1 1 RG 0.5 w 0 0 m 100 0 l 100 100 0 100 0 0 c h B\n",
            100,
            100,
        );
        let background = VectorBackground::from_pdf_bytes(&pdf).expect("curve");
        assert!(background.content().contains("0 0 m 100 0 l"));
        assert!(background.content().contains("100 100 0 100 0 0 c h B"));
    }
}
