//! Rich-text markup for the text editor.
//!
//! Documents stay plain text; the editor stores formatting as a small Markdown-like markup so it
//! survives storage, backups and search unchanged:
//!
//! - `**fett**` and `_kursiv_` for inline emphasis,
//! - `# ` for a heading line,
//! - `- ` for a bullet line,
//! - `> ` for a quote line.
//!
//! [`render`] draws the formatted document for the preview, [`wrap_selection`] and
//! [`toggle_line_prefix`] implement the ribbon actions.
//!
//! egui ships a single font weight, so bold runs are painted twice with a sub-pixel offset; italic
//! runs use the italic skew epaint applies to `TextFormat::italics`.

use egui::text::{LayoutJob, TextFormat};
use egui::{Color32, FontId, Sense, Stroke, Ui, Vec2};

use crate::theme::Theme;
use crate::tokens::{FONT_BODY, FONT_HEADING};

/// A run of text with its inline emphasis.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Span {
    /// Visible text, without markup characters.
    pub text: String,
    /// Whether the run is bold.
    pub bold: bool,
    /// Whether the run is italic.
    pub italic: bool,
}

/// Kind of a document block.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockKind {
    /// Regular text.
    Paragraph,
    /// A `# ` heading line.
    Heading,
    /// A `- ` bullet line.
    Bullet,
    /// A `> ` quote line.
    Quote,
}

/// One block of the parsed document.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Block {
    /// Block kind taken from the line prefix.
    pub kind: BlockKind,
    /// Inline runs of the line without its prefix.
    pub spans: Vec<Span>,
}

/// Splits a line into runs and drops its `**` and `_` markers.
pub fn inline_spans(text: &str) -> Vec<Span> {
    let mut spans = Vec::new();
    let mut buffer = String::new();
    let mut bold = false;
    let mut italic = false;
    let characters: Vec<char> = text.chars().collect();
    let mut index = 0;
    while index < characters.len() {
        if characters[index] == '*' && characters.get(index + 1) == Some(&'*') {
            push_span(&mut spans, &mut buffer, bold, italic);
            bold = !bold;
            index += 2;
            continue;
        }
        if characters[index] == '_' {
            push_span(&mut spans, &mut buffer, bold, italic);
            italic = !italic;
            index += 1;
            continue;
        }
        buffer.push(characters[index]);
        index += 1;
    }
    push_span(&mut spans, &mut buffer, bold, italic);
    if spans.is_empty() {
        spans.push(Span {
            text: String::new(),
            bold,
            italic,
        });
    }
    spans
}

fn push_span(spans: &mut Vec<Span>, buffer: &mut String, bold: bool, italic: bool) {
    if !buffer.is_empty() {
        spans.push(Span {
            text: std::mem::take(buffer),
            bold,
            italic,
        });
    }
}

/// Parses the whole body into blocks, one per line.
pub fn parse(body: &str) -> Vec<Block> {
    let mut blocks = Vec::new();
    for line in body.split('\n') {
        let trimmed = line.trim_start();
        let (kind, rest) = if let Some(rest) = trimmed.strip_prefix("# ") {
            (BlockKind::Heading, rest)
        } else if let Some(rest) = trimmed.strip_prefix("- ") {
            (BlockKind::Bullet, rest)
        } else if let Some(rest) = trimmed.strip_prefix("> ") {
            (BlockKind::Quote, rest)
        } else {
            (BlockKind::Paragraph, line)
        };
        blocks.push(Block {
            kind,
            spans: inline_spans(rest),
        });
    }
    blocks
}

/// Plain text of the marked-up body, used for word counts.
pub fn plain_text(body: &str) -> String {
    let mut text = String::new();
    for (index, block) in parse(body).into_iter().enumerate() {
        if index > 0 {
            text.push('\n');
        }
        for span in block.spans {
            text.push_str(&span.text);
        }
    }
    text
}

/// Number of words in the marked-up body, markup characters excluded.
pub fn word_count(body: &str) -> usize {
    plain_text(body).split_whitespace().count()
}

fn char_to_byte(text: &str, index: usize) -> usize {
    text.char_indices()
        .nth(index)
        .map(|(byte, _)| byte)
        .unwrap_or(text.len())
}

/// Wraps the selected character range in `marker` and returns the selection inside the markers.
pub fn wrap_selection(
    body: &mut String,
    selection: (usize, usize),
    marker: &str,
) -> (usize, usize) {
    let start = char_to_byte(body, selection.0.min(selection.1));
    let end = char_to_byte(body, selection.0.max(selection.1));
    body.insert_str(end, marker);
    body.insert_str(start, marker);
    let offset = marker.chars().count();
    (
        selection.0.min(selection.1) + offset,
        selection.0.max(selection.1) + offset,
    )
}

/// Adds `prefix` to every line of the selection, or removes it when all lines already carry it.
pub fn toggle_line_prefix(
    body: &mut String,
    selection: (usize, usize),
    prefix: &str,
) -> (usize, usize) {
    let start = char_to_byte(body, selection.0.min(selection.1));
    let end = char_to_byte(body, selection.0.max(selection.1));
    let block_start = body[..start]
        .rfind('\n')
        .map(|index| index + 1)
        .unwrap_or(0);
    let block_end = body[end..]
        .find('\n')
        .map(|index| end + index)
        .unwrap_or(body.len());
    let block = body[block_start..block_end].to_string();
    let remove = !block.is_empty() && block.split('\n').all(|line| line.starts_with(prefix));
    let mut replacement = String::new();
    for (index, line) in block.split('\n').enumerate() {
        if index > 0 {
            replacement.push('\n');
        }
        if remove {
            replacement.push_str(&line[prefix.len()..]);
        } else if line.trim().is_empty() {
            replacement.push_str(line);
        } else {
            replacement.push_str(prefix);
            replacement.push_str(line);
        }
    }
    body.replace_range(block_start..block_end, &replacement);
    let first = body[..block_start].chars().count();
    (first, first + replacement.chars().count())
}

fn format_for(size: f32, italic: bool, color: Color32) -> TextFormat {
    TextFormat {
        font_id: FontId::proportional(size),
        color,
        italics: italic,
        ..Default::default()
    }
}

fn block_jobs(
    theme: &Theme,
    block: &Block,
    size: f32,
    width: f32,
) -> (LayoutJob, Option<LayoutJob>) {
    let text_color = theme.palette.text;
    let mut base = LayoutJob::default();
    base.wrap.max_width = width;
    let mut overlay = LayoutJob::default();
    overlay.wrap.max_width = width;
    let has_bold = block.spans.iter().any(|span| span.bold);
    let quote = block.kind == BlockKind::Quote;

    if block.kind == BlockKind::Bullet {
        base.append(
            "\u{2022}   ",
            0.0,
            format_for(size, false, theme.palette.text_muted),
        );
        overlay.append(
            "\u{2022}   ",
            0.0,
            format_for(size, false, Color32::TRANSPARENT),
        );
    }

    for span in &block.spans {
        let italic = span.italic || quote;
        let mut base_format = format_for(size, italic, text_color);
        let mut overlay_format = format_for(size, italic, Color32::TRANSPARENT);
        if span.bold {
            overlay_format.color = text_color;
            if quote {
                base_format.color = text_color;
            }
        }
        base.append(&span.text, 0.0, base_format);
        overlay.append(&span.text, 0.0, overlay_format);
    }

    (base, has_bold.then_some(overlay))
}

/// Draws the formatted document.
pub fn render(ui: &mut Ui, theme: &Theme, body: &str) {
    if body.trim().is_empty() {
        ui.label(
            egui::RichText::new(" ")
                .size(FONT_BODY)
                .color(theme.palette.text_muted),
        );
        return;
    }
    for (index, block) in parse(body).into_iter().enumerate() {
        if index > 0 {
            ui.add_space(if block.kind == BlockKind::Paragraph {
                4.0
            } else {
                8.0
            });
        }
        let (size, indent) = match block.kind {
            BlockKind::Heading => (FONT_HEADING + 6.0, 0.0),
            BlockKind::Bullet => (FONT_BODY, 4.0),
            BlockKind::Quote => (FONT_BODY, 12.0),
            BlockKind::Paragraph => (FONT_BODY, 0.0),
        };
        let width = (ui.available_width() - indent).max(80.0);
        let (base_job, overlay_job) = block_jobs(theme, &block, size, width);
        let galley = ui.painter().layout_job(base_job);
        let (rect, _) = ui.allocate_exact_size(
            egui::vec2(ui.available_width(), galley.size().y.max(4.0)),
            Sense::hover(),
        );
        if block.kind == BlockKind::Quote {
            let bar = egui::Rect::from_min_size(
                egui::pos2(rect.left() + 3.0, rect.top()),
                egui::vec2(2.0, rect.height()),
            );
            ui.painter().rect_filled(bar, 1.0, theme.palette.text_muted);
        }
        let position = egui::pos2(rect.left() + indent, rect.top());
        ui.painter().galley(position, galley, theme.palette.text);
        if let Some(overlay_job) = overlay_job {
            let overlay = ui.painter().layout_job(overlay_job);
            ui.painter()
                .galley(position + Vec2::new(0.4, 0.0), overlay, theme.palette.text);
        }
    }
}

/// Draws a thin underline under a single line of text, used by the spell checker.
pub fn spell_underline(color: Color32) -> Stroke {
    Stroke::new(1.2_f32, color)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_inline_emphasis() {
        let spans = inline_spans("Ein **fettes** und _kursives_ Wort");
        let bold: Vec<&str> = spans
            .iter()
            .filter(|span| span.bold)
            .map(|span| span.text.as_str())
            .collect();
        assert_eq!(bold, vec!["fettes"]);
        let italic: Vec<&str> = spans
            .iter()
            .filter(|span| span.italic)
            .map(|span| span.text.as_str())
            .collect();
        assert_eq!(italic, vec!["kursives"]);
        let plain: String = spans
            .iter()
            .filter(|span| !span.bold && !span.italic)
            .map(|span| span.text.as_str())
            .collect();
        assert_eq!(plain, "Ein  und  Wort");
    }

    #[test]
    fn parses_lines_into_blocks() {
        let blocks = parse("# Titel\n- Punkt\n> Zitat\nText");
        assert_eq!(
            blocks.iter().map(|block| block.kind).collect::<Vec<_>>(),
            vec![
                BlockKind::Heading,
                BlockKind::Bullet,
                BlockKind::Quote,
                BlockKind::Paragraph
            ]
        );
        assert_eq!(blocks[0].spans[0].text, "Titel");
        assert_eq!(blocks[3].spans[0].text, "Text");
    }

    #[test]
    fn wraps_and_unwraps_selections() {
        let mut body = "Ein Wort".to_string();
        let selection = wrap_selection(&mut body, (4, 8), "**");
        assert_eq!(body, "Ein **Wort**");
        assert_eq!(selection, (6, 10));
        let again = wrap_selection(&mut body, selection, "**");
        assert_eq!(body, "Ein ****Wort****");
        assert_eq!(again, (8, 12));
    }

    #[test]
    fn toggles_line_prefixes_on_selected_lines() {
        let mut body = "Eins\nZwei".to_string();
        let length = body.chars().count();
        let selection = toggle_line_prefix(&mut body, (0, length), "- ");
        assert_eq!(body, "- Eins\n- Zwei");
        assert_eq!(selection, (0, body.chars().count()));
        toggle_line_prefix(&mut body, selection, "- ");
        assert_eq!(body, "Eins\nZwei");
    }

    #[test]
    fn counts_words_without_markup() {
        let body = "# Titel\n\n- **Ein** Punkt\n> _Zitat_ hier";
        assert_eq!(plain_text(body), "Titel\n\nEin Punkt\nZitat hier");
        assert_eq!(word_count(body), 5);
        assert_eq!(word_count(""), 0);
    }

    #[test]
    fn renders_blocks_without_panicking() {
        let ctx = crate::theme::headless_context();
        let theme = Theme::new(crate::theme::Appearance::Light, "indigo");
        let mut shapes = 0;
        for _ in 0..2 {
            let output = ctx.run(
                egui::RawInput {
                    screen_rect: Some(egui::Rect::from_min_size(
                        egui::Pos2::ZERO,
                        egui::Vec2::new(600.0, 800.0),
                    )),
                    ..Default::default()
                },
                |ctx| {
                    egui::CentralPanel::default().show(ctx, |ui| {
                        render(ui, &theme, "# Titel\nEin **fetter** Text\n- Punkt\n> Zitat");
                    });
                },
            );
            shapes = output.shapes.len();
        }
        assert!(shapes > 5);
    }
}

/// Escapes a text for HTML output.
pub fn escape_html(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for character in text.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            _ => escaped.push(character),
        }
    }
    escaped
}

/// Renders the document markup as an HTML fragment.
///
/// Consecutive bullet lines share one `<ul>`, headings become `<h1>`, quotes `<blockquote>` and
/// paragraphs `<p>`; inline emphasis becomes `<strong>` and `<em>`. All text is escaped, so a
/// document can never inject markup into the exported file.
pub fn to_html(body: &str) -> String {
    let mut html = String::new();
    let mut list_open = false;
    for block in parse(body) {
        if block.kind != BlockKind::Bullet && list_open {
            html.push_str("</ul>\n");
            list_open = false;
        }
        let mut inner = String::new();
        for span in &block.spans {
            let mut text = escape_html(&span.text);
            if span.italic {
                text = format!("<em>{text}</em>");
            }
            if span.bold {
                text = format!("<strong>{text}</strong>");
            }
            inner.push_str(&text);
        }
        match block.kind {
            BlockKind::Heading => {
                html.push_str("<h1>");
                html.push_str(&inner);
                html.push_str("</h1>\n");
            }
            BlockKind::Bullet => {
                if !list_open {
                    html.push_str("<ul>\n");
                    list_open = true;
                }
                html.push_str("<li>");
                html.push_str(&inner);
                html.push_str("</li>\n");
            }
            BlockKind::Quote => {
                html.push_str("<blockquote>");
                html.push_str(&inner);
                html.push_str("</blockquote>\n");
            }
            BlockKind::Paragraph => {
                html.push_str("<p>");
                html.push_str(&inner);
                html.push_str("</p>\n");
            }
        }
    }
    if list_open {
        html.push_str("</ul>\n");
    }
    html
}

#[cfg(test)]
mod html_tests {
    use super::*;

    #[test]
    fn emphasis_and_blocks_become_html() {
        let html = to_html("# Titel\n**fett** und _kursiv_\n- eins\n- zwei\n> Zitat");
        assert_eq!(
            html,
            "<h1>Titel</h1>\n<p><strong>fett</strong> und <em>kursiv</em></p>\n<ul>\n<li>eins</li>\n<li>zwei</li>\n</ul>\n<blockquote>Zitat</blockquote>\n"
        );
    }

    #[test]
    fn text_is_escaped_so_documents_cannot_inject_markup() {
        let html = to_html("<script>alert(\"x\")</script> & mehr");
        assert!(!html.contains("<script>"));
        assert!(html.contains("&lt;script&gt;"));
        assert!(html.contains("&amp; mehr"));
    }

    #[test]
    fn empty_documents_produce_an_empty_paragraph() {
        assert_eq!(to_html(""), "<p></p>\n");
    }
}
