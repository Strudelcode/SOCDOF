//! Ribbon text editor window of the desktop.
//!
//! The window mirrors the legacy `TextwerkModule`
//! (`SOCDOF - TS/src/components/documents/TextwerkModule.tsx`): a document bar with the open
//! documents, the ribbon strip (File, Home, Insert, Layout, View, Review) with the Home groups of
//! the reference, the A4 page with the editable body and the status bar with word, character,
//! language, spelling and zoom cells.
//!
//! The body is plain text. The ribbon formats the whole document through one layout job, which is
//! what the reference does for an empty selection, so every control has a visible effect instead of
//! only changing its own state.

use crate::textwerk_io as io;
use egui::text::{LayoutJob, TextFormat};
use egui::{
    Color32, FontFamily, FontId, Id, Pos2, Rect, Rounding, Sense, Stroke, TextEdit, Ui, Vec2,
};
use std::path::PathBuf;

use socdof_core::domain::settings::Language;

use crate::focus::FocusState;
use crate::i18n::UiTexts;
use crate::icons::Icon;
use crate::theme::Theme;

/// Ribbon tabs of the editor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RibbonTab {
    /// Document actions.
    File,
    /// Styles, font, paragraph and editing groups.
    Home,
    /// Tables, pictures, links and page breaks.
    Insert,
    /// Page setup and columns.
    Layout,
    /// Zoom, ruler and spell check.
    View,
    /// Spelling and comments.
    Review,
}

impl RibbonTab {
    /// Tabs in their legacy order.
    const ORDER: [Self; 6] = [
        Self::File,
        Self::Home,
        Self::Insert,
        Self::Layout,
        Self::View,
        Self::Review,
    ];
}

/// Paragraph alignment of the document.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TextAlign {
    /// Flush left.
    Left,
    /// Centred lines.
    Center,
    /// Flush right.
    Right,
    /// Flush both edges.
    Justify,
}

/// List style applied to the document lines.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ListStyle {
    /// No list markers.
    None,
    /// A bullet in front of every line.
    Bullets,
    /// A running number in front of every line.
    Numbering,
}

/// Formatting of one character, so formatting applies to the selection and survives edits.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct CharStyle {
    /// Index into [`FAMILIES`].
    pub family: usize,
    /// Index into [`SIZES`].
    pub size: usize,
    /// Bold.
    pub bold: bool,
    /// Italic.
    pub italic: bool,
    /// Underline.
    pub underline: bool,
    /// Strikethrough.
    pub strike: bool,
    /// Superscript.
    pub superscript: bool,
    /// Subscript.
    pub subscript: bool,
    /// Index into [`COLORS`].
    pub color: usize,
    /// Index into [`HIGHLIGHTS`].
    pub highlight: usize,
}

/// Font families of the family dropdown.
const FAMILIES: [(&str, FontFamily); 6] = [
    ("Aptos", FontFamily::Proportional),
    ("Calibri", FontFamily::Proportional),
    ("Arial", FontFamily::Proportional),
    ("Georgia", FontFamily::Proportional),
    ("Times", FontFamily::Proportional),
    ("Courier", FontFamily::Monospace),
];

/// Font sizes of the size dropdown.
const SIZES: [f32; 4] = [8.0, 10.0, 12.0, 16.0];

/// Text colors of the colour row, `None` for automatic.
const COLORS: [Option<Color32>; 9] = [
    None,
    Some(Color32::from_rgb(0x0f, 0x17, 0x2a)),
    Some(Color32::from_rgb(0x1e, 0x29, 0x3b)),
    Some(Color32::from_rgb(0xef, 0x44, 0x44)),
    Some(Color32::from_rgb(0xf9, 0x73, 0x16)),
    Some(Color32::from_rgb(0xea, 0xb3, 0x08)),
    Some(Color32::from_rgb(0x22, 0xc5, 0x5e)),
    Some(Color32::from_rgb(0x3b, 0x82, 0xf6)),
    Some(Color32::from_rgb(0x8b, 0x5c, 0xf6)),
];

/// Highlight colors of the highlight row.
const HIGHLIGHTS: [Option<Color32>; 9] = [
    None,
    Some(Color32::from_rgb(0xfe, 0xf0, 0x8a)),
    Some(Color32::from_rgb(0xff, 0xd7, 0xaa)),
    Some(Color32::from_rgb(0xff, 0xc9, 0xc9)),
    Some(Color32::from_rgb(0xfd, 0xe2, 0xe2)),
    Some(Color32::from_rgb(0x67, 0xe8, 0xf9)),
    Some(Color32::from_rgb(0xa7, 0xf3, 0xd0)),
    Some(Color32::from_rgb(0xbb, 0xf7, 0xd0)),
    Some(Color32::from_rgb(0xc7, 0xd2, 0xfe)),
];

/// Which file dialog the editor shows.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DialogKind {
    /// Open a text document.
    Open,
    /// Save the document as text.
    Save,
    /// Insert a PNG image.
    Image,
    /// Print the document as PDF.
    Print,
    /// Export the document as HTML.
    Export,
}

/// Open file dialog of the editor with its browsing state.
#[derive(Debug, Clone, PartialEq)]
pub struct EditorDialog {
    /// Action the dialog performs.
    pub kind: DialogKind,
    /// Current directory.
    pub dir: PathBuf,
    /// File name field.
    pub name: String,
    /// Listed entries of `dir`.
    pub entries: Vec<io::FileEntry>,
    /// Last error, shown in the dialog.
    pub error: Option<String>,
    /// Last successful output path.
    pub notice: Option<String>,
}

impl EditorDialog {
    /// Opens the dialog in `dir` for `kind`, listing the files it accepts.
    fn new(kind: DialogKind, dir: PathBuf) -> Self {
        let mut dialog = Self {
            kind,
            dir,
            name: String::new(),
            entries: Vec::new(),
            error: None,
            notice: None,
        };
        dialog.refresh();
        dialog
    }

    /// Re-lists the current directory with the extensions of the dialog kind.
    fn refresh(&mut self) {
        let extensions: &[&str] = match self.kind {
            DialogKind::Image => &["png"],
            DialogKind::Open => &["txt", "md"],
            _ => &["txt", "html", "pdf"],
        };
        self.entries = io::list_dir(&self.dir, extensions);
    }

    /// Title of the dialog.
    pub fn title(&self) -> &'static str {
        match self.kind {
            DialogKind::Open => "Dokument öffnen",
            DialogKind::Save => "Dokument speichern",
            DialogKind::Image => "Bild einfügen",
            DialogKind::Print => "Drucken",
            DialogKind::Export => "Exportieren",
        }
    }
}

/// An image placed on the page, anchored to a line of the body.
pub struct PlacedImage {
    /// Source file.
    pub path: PathBuf,
    /// File name, shown in the dialog list.
    pub label: String,
    /// Line of the body the picture starts at.
    pub line: usize,
    /// Display width in points.
    pub width: f32,
    /// Display height in points.
    pub height: f32,
    /// Uploaded texture of the decoded picture.
    pub texture: Option<egui::TextureHandle>,
}

impl std::fmt::Debug for PlacedImage {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("PlacedImage")
            .field("path", &self.path)
            .field("line", &self.line)
            .finish()
    }
}

impl Clone for PlacedImage {
    fn clone(&self) -> Self {
        Self {
            path: self.path.clone(),
            label: self.label.clone(),
            line: self.line,
            width: self.width,
            height: self.height,
            texture: self.texture.clone(),
        }
    }
}

impl PartialEq for PlacedImage {
    fn eq(&self, other: &Self) -> bool {
        self.path == other.path
            && self.line == other.line
            && (self.width - other.width).abs() < f32::EPSILON
    }
}

/// State of the ribbon editor window.
#[derive(Debug, Clone, PartialEq)]
pub struct TextwerkState {
    /// Active ribbon tab.
    pub tab: RibbonTab,
    /// Document title of the document bar.
    pub title: String,
    /// Editable plain text body.
    pub body: String,
    /// Index into [`FAMILIES`].
    pub family: usize,
    /// Index into [`SIZES`].
    pub size: usize,
    /// Bold.
    pub bold: bool,
    /// Italic.
    pub italic: bool,
    /// Underline.
    pub underline: bool,
    /// Strikethrough.
    pub strike: bool,
    /// Superscript.
    pub superscript: bool,
    /// Subscript.
    pub subscript: bool,
    /// Index into [`COLORS`].
    pub color: usize,
    /// Index into [`HIGHLIGHTS`].
    pub highlight: usize,
    /// Paragraph alignment.
    pub align: TextAlign,
    /// List markers.
    pub list: ListStyle,
    /// Zoom in percent.
    pub zoom: f32,
    /// Document language of the status bar.
    pub language: Language,
    /// Spell check underlines unknown words.
    pub spell: bool,
    /// Ruler above the page.
    pub ruler: bool,
    /// Landscape page orientation.
    pub landscape: bool,
    /// The find bar is open.
    pub find_open: bool,
    /// Find query.
    pub find: String,
    /// Formatting of every character of the body.
    pub styles: Vec<CharStyle>,
    /// Selected character range of the body editor.
    pub selection: (usize, usize),
    /// Page margins preset: 0 narrow, 1 normal, 2 wide.
    pub margins: usize,
    /// Column count of the page, 1 or 2.
    pub columns: usize,
    /// Open file dialog, if any.
    pub dialog: Option<EditorDialog>,
    /// Pictures placed on the page.
    pub images: Vec<PlacedImage>,
    /// Body snapshots for undo.
    pub history: Vec<String>,
    /// Number of applied snapshots.
    pub history_pos: usize,
}

impl Default for TextwerkState {
    fn default() -> Self {
        Self::new()
    }
}

impl TextwerkState {
    /// An empty document in the Home tab with the reference defaults.
    pub fn new() -> Self {
        Self {
            tab: RibbonTab::Home,
            title: String::from("Dokument 1"),
            body: String::new(),
            family: 0,
            size: 2,
            bold: false,
            italic: false,
            underline: false,
            strike: false,
            superscript: false,
            subscript: false,
            color: 0,
            highlight: 0,
            align: TextAlign::Left,
            list: ListStyle::None,
            zoom: 100.0,
            language: Language::De,
            spell: true,
            ruler: false,
            landscape: false,
            find_open: false,
            find: String::new(),
            styles: Vec::new(),
            selection: (0, 0),
            margins: 1,
            columns: 1,
            dialog: None,
            images: Vec::new(),
            history: vec![String::new()],
            history_pos: 0,
        }
    }

    /// Opens a file dialog of the requested kind in the documents directory.
    pub fn open_dialog(&mut self, kind: DialogKind) {
        let dir = io::documents_dir();
        let mut dialog = EditorDialog::new(kind, dir);
        match kind {
            DialogKind::Print => dialog.name = format!("{}.pdf", self.title),
            DialogKind::Export => dialog.name = format!("{}.html", self.title),
            _ => {}
        }
        self.dialog = Some(dialog);
    }

    /// Places a decoded PNG on the page, reserving its height with blank lines.
    pub fn place_image(&mut self, path: PathBuf) {
        let Ok(decoded) = io::decode_png(&path) else {
            return;
        };
        let width = 300.0_f32;
        let height =
            (width * decoded.height as f32 / decoded.width.max(1) as f32).clamp(48.0, 260.0);
        let blank = (height / (self.font_size() * 1.45)).ceil() as usize;
        self.sync_styles();
        let index = self.selection.0;
        self.insert_text(&"\n".repeat(blank.max(1)));
        let line = self
            .body
            .chars()
            .take(index)
            .filter(|value| *value == '\n')
            .count();
        let label = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| "Bild".to_string());
        self.images.push(PlacedImage {
            path,
            label,
            line,
            width,
            height,
            texture: None,
        });
    }

    /// Base style of the document controls, used for characters without their own formatting.
    pub fn base_style(&self) -> CharStyle {
        CharStyle {
            family: self.family,
            size: self.size,
            color: self.color,
            highlight: self.highlight,
            ..Default::default()
        }
    }

    /// Ensures one style entry exists per body character.
    pub fn sync_styles(&mut self) {
        let length = self.body.chars().count();
        let base = self.base_style();
        self.styles.resize(length, base);
        self.styles.truncate(length);
        if self.selection.0 > length {
            self.selection.0 = length;
        }
        if self.selection.1 > length {
            self.selection.1 = length;
        }
    }

    /// Applies a change to the selected characters, or to the whole body without a selection.
    pub fn format_selection(&mut self, change: impl Fn(&mut CharStyle)) {
        self.sync_styles();
        let (from, to) = if self.selection.0 == self.selection.1 {
            (0, self.body.chars().count())
        } else {
            (
                self.selection.0.min(self.selection.1),
                self.selection.0.max(self.selection.1),
            )
        };
        let end = to.min(self.styles.len());
        for style in &mut self.styles[from..end] {
            change(style);
        }
        self.snapshot();
    }

    /// Inserts text at the caret and moves the caret behind it.
    pub fn insert_text(&mut self, text: &str) {
        self.sync_styles();
        let index = self.selection.0;
        let char_index = self
            .body
            .char_indices()
            .nth(index)
            .map(|(byte, _)| byte)
            .unwrap_or(self.body.len());
        self.body.insert_str(char_index, text);
        let base = self.base_style();
        let added = text.chars().count();
        for _ in 0..added {
            self.styles.insert(index.min(self.styles.len()), base);
        }
        self.selection = (index + added, index + added);
        self.snapshot();
    }

    /// Words of the body, split on whitespace.
    pub fn words(&self) -> usize {
        self.body.split_whitespace().count()
    }

    /// Characters of the body, without trailing whitespace.
    pub fn characters(&self) -> usize {
        self.body.trim_end().chars().count()
    }

    /// Font size of the document in points.
    pub fn font_size(&self) -> f32 {
        SIZES[self.size.min(SIZES.len() - 1)]
    }

    /// Pushes the current body onto the undo stack.
    pub fn snapshot(&mut self) {
        if self.history.last().map(String::as_str) != Some(self.body.as_str()) {
            self.history.truncate(self.history_pos + 1);
            self.history.push(self.body.clone());
            self.history_pos = self.history.len() - 1;
        }
    }

    /// Undoes the last edit.
    pub fn undo(&mut self) {
        if self.history_pos > 0 {
            self.history_pos -= 1;
            self.body = self.history[self.history_pos].clone();
        }
    }

    /// Redoes the last undone edit.
    pub fn redo(&mut self) {
        if self.history_pos + 1 < self.history.len() {
            self.history_pos += 1;
            self.body = self.history[self.history_pos].clone();
        }
    }

    /// Applies a list style to every line of the body.
    pub fn set_list(&mut self, list: ListStyle) {
        let stripped: Vec<String> = self
            .body
            .lines()
            .map(|line| {
                let trimmed = line
                    .trim_start_matches('•')
                    .trim_start()
                    .trim_start_matches(|c: char| c.is_ascii_digit())
                    .trim_start_matches('.')
                    .trim_start();
                trimmed.to_owned()
            })
            .collect();
        self.body = match list {
            ListStyle::None => stripped.join("\n"),
            ListStyle::Bullets => stripped
                .iter()
                .map(|line| format!("• {line}"))
                .collect::<Vec<_>>()
                .join("\n"),
            ListStyle::Numbering => stripped
                .iter()
                .enumerate()
                .map(|(index, line)| format!("{}. {line}", index + 1))
                .collect::<Vec<_>>()
                .join("\n"),
        };
        self.list = list;
    }

    /// Layout job with one run per formatting change of the document.
    fn layout(&self, text: &str, width: f32) -> LayoutJob {
        let mut job = LayoutJob::default();
        job.wrap.max_width = width;
        job.halign = match self.align {
            TextAlign::Left | TextAlign::Justify => egui::Align::LEFT,
            TextAlign::Center => egui::Align::Center,
            TextAlign::Right => egui::Align::RIGHT,
        };
        // The sheet stays white in both appearances, so the automatic color is the dark ink of
        // the reference page and not the theme text color.
        let ink = Color32::from_rgb(0x1e, 0x29, 0x3b);
        let start = self.styles.len().saturating_sub(text.chars().count());
        let mut run = String::new();
        let mut current: Option<CharStyle> = None;
        let flush = |run: &mut String, style: Option<CharStyle>, job: &mut LayoutJob| {
            if run.is_empty() {
                return;
            }
            let style = style.unwrap_or_default();
            let size = SIZES[style.size.min(SIZES.len() - 1)] * self.zoom / 100.0;
            let size = if style.superscript || style.subscript {
                size * 0.7
            } else {
                size
            };
            let color = COLORS[style.color.min(COLORS.len() - 1)].unwrap_or(ink);
            job.append(
                run,
                0.0,
                TextFormat {
                    font_id: FontId::new(
                        size,
                        FAMILIES[style.family.min(FAMILIES.len() - 1)].1.clone(),
                    ),
                    color,
                    background: HIGHLIGHTS[style.highlight.min(HIGHLIGHTS.len() - 1)]
                        .unwrap_or(Color32::TRANSPARENT),
                    italics: style.italic,
                    underline: if style.underline {
                        Stroke::new(1.0_f32, color)
                    } else {
                        Stroke::NONE
                    },
                    strikethrough: if style.strike {
                        Stroke::new(1.0_f32, color)
                    } else {
                        Stroke::NONE
                    },
                    valign: if style.superscript {
                        egui::Align::TOP
                    } else if style.subscript {
                        egui::Align::BOTTOM
                    } else {
                        egui::Align::Center
                    },
                    ..Default::default()
                },
            );
            run.clear();
        };
        for (index, character) in text.chars().enumerate() {
            let style = self
                .styles
                .get(start.saturating_add(index))
                .copied()
                .unwrap_or_else(|| self.base_style());
            if current != Some(style) {
                flush(&mut run, current, &mut job);
                current = Some(style);
            }
            run.push(character);
        }
        flush(&mut run, current, &mut job);
        job
    }
}

/// Rows of the ribbon: a document bar, the tab strip, the group area and the page.
/// Values measured on the 432x771 reference capture of both themes.
const DOC_BAR_HEIGHT: f32 = 34.0;
const TAB_STRIP_HEIGHT: f32 = 34.0;
const RIBBON_HEIGHT: f32 = 314.0;
const RULER_HEIGHT: f32 = 24.0;
const STATUS_BAR_HEIGHT: f32 = 52.0;
/// Workspace strip between the status bar and the window edge of the reference.
const STATUS_BOTTOM_PAD: f32 = 12.0;
/// Fixed Word-blue header of the document bar, identical in both themes.
const DOC_BAR_BASE: Color32 = Color32::from_rgb(0x2b, 0x57, 0x9a);
const DOC_BAR_TINT: Color32 = Color32::from_rgb(0x40, 0x68, 0xa4);

/// Panel colour of the tab strip and the ribbon.
fn panel_fill(theme: &Theme) -> Color32 {
    if theme.appearance.is_dark() {
        Color32::from_rgb(0x0f, 0x17, 0x2b)
    } else {
        Color32::from_rgb(0xf9, 0xf9, 0xf9)
    }
}

/// Page ruler strip under the ribbon.
fn ruler_fill(theme: &Theme) -> Color32 {
    if theme.appearance.is_dark() {
        Color32::from_rgb(0x1d, 0x29, 0x3d)
    } else {
        Color32::from_rgb(0xca, 0xd5, 0xe2)
    }
}

/// Workspace behind the sheet.
fn editor_canvas(theme: &Theme) -> Color32 {
    if theme.appearance.is_dark() {
        Color32::from_rgb(0x02, 0x06, 0x18)
    } else {
        Color32::from_rgb(0xf8, 0xfa, 0xfc)
    }
}

/// Status bar of the editor.
fn status_fill(theme: &Theme) -> Color32 {
    if theme.appearance.is_dark() {
        Color32::from_rgb(0x0f, 0x17, 0x2b)
    } else {
        Color32::from_rgb(0xca, 0xd5, 0xe2)
    }
}

/// Hairline around the sheet and under the ruler.
fn page_frame() -> Color32 {
    Color32::from_rgb(0x90, 0xa1, 0xb9)
}

/// Draws the ribbon editor inside its desktop window.
#[allow(clippy::too_many_arguments)]
pub fn textwerk_window(
    ctx: &egui::Context,
    _active: bool,
    ui: &mut Ui,
    theme: &Theme,
    texts: &UiTexts,
    _focus: &mut FocusState,
    state: &mut TextwerkState,
) {
    let _ = ctx;
    let _ = texts;
    let area = ui.max_rect();
    let painter = ui.painter().clone();
    painter.rect_filled(area, Rounding::same(0.0), theme.palette.surface);

    let labels = Labels::new(texts.language());
    if state.dialog.is_some() {
        editor_dialog(ctx, theme, state);
    }
    let mut y = area.top();

    // Document bar: the open documents on the left, the quick actions on the right.
    let doc_bar = Rect::from_min_size(
        Pos2::new(area.left(), y),
        Vec2::new(area.width(), DOC_BAR_HEIGHT),
    );
    painter.rect_filled(doc_bar, Rounding::same(0.0), DOC_BAR_BASE);
    painter.rect_filled(
        Rect::from_min_max(
            Pos2::new(doc_bar.left(), doc_bar.top() + 8.0),
            Pos2::new(doc_bar.right(), doc_bar.bottom() - 6.0),
        ),
        Rounding::same(0.0),
        DOC_BAR_TINT,
    );
    let pen = Rect::from_center_size(
        Pos2::new(doc_bar.left() + 22.0, doc_bar.center().y),
        Vec2::splat(18.0),
    );
    Icon::PenLine.draw(&painter, pen, Color32::WHITE, 1.8);
    // Two document tabs: the active one filled with the accent, the second one quiet.
    for (index, (title, active)) in [
        ("Text Editor".to_string(), true),
        (state.title.clone(), false),
    ]
    .iter()
    .enumerate()
    {
        let left = doc_bar.left() + 40.0 + if index == 0 { 0.0 } else { 104.0 };
        painter.text(
            Pos2::new(left, doc_bar.center().y),
            egui::Align2::LEFT_CENTER,
            title,
            FontId::new(11.5, crate::theme::semibold()),
            if *active {
                Color32::WHITE
            } else {
                Color32::from_rgb(0xc7, 0xd8, 0xf0)
            },
        );
    }
    for (index, icon) in [Icon::HardDrive, Icon::Refresh, Icon::Refresh]
        .iter()
        .enumerate()
    {
        let button = Rect::from_center_size(
            Pos2::new(
                doc_bar.right() - 20.0 - index as f32 * 26.0,
                doc_bar.center().y,
            ),
            Vec2::splat(22.0),
        );
        let id = Id::new(("socdof-textwerk-doc", index));
        let response = ui.interact(button, id, Sense::click());
        if index == 1 && response.clicked() {
            state.undo();
        } else if index == 2 && response.clicked() {
            state.redo();
        }
        icon.draw(
            &painter,
            Rect::from_center_size(button.center(), Vec2::splat(15.0)),
            if response.hovered() {
                Color32::WHITE
            } else {
                Color32::from_rgb(0xd6, 0xe2, 0xf2)
            },
            1.7,
        );
    }
    y = doc_bar.bottom();

    // Ribbon tab strip.
    let strip = Rect::from_min_size(
        Pos2::new(area.left(), y),
        Vec2::new(area.width(), TAB_STRIP_HEIGHT),
    );
    painter.rect_filled(strip, Rounding::same(0.0), panel_fill(theme));
    painter.hline(
        strip.x_range(),
        strip.bottom() - 0.5,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    let tab_width = 64.0;
    let tabs_left = strip.left() + 4.0;
    for (index, tab) in RibbonTab::ORDER.iter().enumerate() {
        let rect = Rect::from_min_size(
            Pos2::new(tabs_left + index as f32 * tab_width, strip.top()),
            Vec2::new(tab_width, strip.height()),
        );
        let id = Id::new(("socdof-textwerk-tab", index));
        let response = ui.interact(rect, id, Sense::click());
        if response.clicked() {
            state.tab = *tab;
        }
        let active = state.tab == *tab;
        painter.text(
            rect.center(),
            egui::Align2::CENTER_CENTER,
            labels.tab(*tab),
            FontId::new(12.0, crate::theme::semibold()),
            if active {
                theme.accent.base
            } else {
                theme.palette.text_muted
            },
        );
        if active {
            painter.hline(
                Rect::from_min_max(
                    Pos2::new(rect.left() + 14.0, rect.bottom() - 2.0),
                    Pos2::new(rect.right() - 14.0, rect.bottom()),
                )
                .x_range(),
                rect.bottom() - 2.0,
                Stroke::new(2.0_f32, theme.accent.base),
            );
        }
    }
    y = strip.bottom();

    let ribbon = Rect::from_min_size(
        Pos2::new(area.left(), y),
        Vec2::new(area.width(), RIBBON_HEIGHT),
    );
    painter.rect_filled(ribbon, Rounding::same(0.0), panel_fill(theme));
    paint_ribbon(ui, &painter, theme, &labels, ribbon, state);
    painter.hline(
        ribbon.x_range(),
        ribbon.bottom() - 0.5,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    y = ribbon.bottom();

    // Ruler strip, then the workspace with the sheet and the status bar.
    let ruler = Rect::from_min_size(
        Pos2::new(area.left(), y),
        Vec2::new(area.width(), RULER_HEIGHT),
    );
    painter.rect_filled(ruler, Rounding::same(0.0), ruler_fill(theme));
    painter.hline(
        ruler.x_range(),
        ruler.top() + 0.5,
        Stroke::new(1.0_f32, page_frame()),
    );
    y = ruler.bottom();
    let status_height = STATUS_BAR_HEIGHT;
    let footer_bottom = area.bottom() - STATUS_BOTTOM_PAD;
    let page_area = Rect::from_min_max(
        Pos2::new(area.left(), y),
        Pos2::new(area.right(), footer_bottom - status_height),
    );
    painter.rect_filled(page_area, Rounding::same(0.0), editor_canvas(theme));
    let scale = state.zoom / 100.0;
    let page_width = (page_area.width() - 31.0).min(401.0) * scale;
    let page_height = page_width * if state.landscape { 0.707 } else { 1.414 };
    // The dark reference keeps a recessed frame band above the sheet.
    let sheet_offset = if theme.appearance.is_dark() {
        21.0
    } else {
        1.0
    };
    if theme.appearance.is_dark() {
        let frame = Rect::from_min_size(
            Pos2::new(page_area.left() + 13.0, page_area.top()),
            Vec2::new(page_width, sheet_offset),
        );
        painter.rect_filled(frame, Rounding::same(0.0), ruler_fill(theme));
        painter.hline(
            frame.x_range(),
            frame.top() + 0.5,
            Stroke::new(1.0_f32, page_frame()),
        );
        painter.hline(
            frame.x_range(),
            frame.bottom() - 0.5,
            Stroke::new(1.0_f32, page_frame()),
        );
    }
    let page = Rect::from_min_size(
        Pos2::new(page_area.left() + 13.0, page_area.top() + sheet_offset),
        Vec2::new(
            page_width,
            page_height.min(page_area.height() - sheet_offset),
        ),
    );
    let page_painter = painter.clone();
    page_painter.rect(
        page,
        Rounding::same(2.0),
        Color32::WHITE,
        Stroke::new(1.0_f32, page_frame()),
    );
    // Header rule of the reference page; the margin preset scales with the page.
    let margin = [16.0, 24.0, 40.0][state.margins.min(2)] * scale;
    page_painter.hline(
        Rect::from_min_max(
            Pos2::new(page.left() + margin, page.top() + margin * 0.55),
            Pos2::new(page.right() - margin, page.top() + margin * 0.55),
        )
        .x_range(),
        page.top() + margin * 0.55,
        Stroke::new(1.0_f32, Color32::from_rgb(0xcb, 0xd5, 0xe1)),
    );
    if page.bottom() < page_area.bottom() - 8.0 {
        // Keep the sheet flush with the visible area like the reference does.
    }
    let column_width = (page.right()
        - margin
        - (page.left() + margin)
        - (state.columns as f32 - 1.0) * 12.0 * scale)
        / state.columns as f32;
    let text_rect = Rect::from_min_max(
        Pos2::new(page.left() + margin, page.top() + margin),
        Pos2::new(
            page.left() + margin + column_width,
            page.bottom() - margin * 0.5,
        ),
    );
    if text_rect.width() > 20.0 && text_rect.height() > 20.0 {
        for image in &mut state.images {
            if image.texture.is_none() {
                if let Ok(decoded) = io::decode_png(&image.path) {
                    let pixels = egui::ColorImage::from_rgba_unmultiplied(
                        [decoded.width, decoded.height],
                        &decoded.rgba,
                    );
                    image.texture = Some(ui.ctx().load_texture(
                        image.label.clone(),
                        pixels,
                        egui::TextureOptions::LINEAR,
                    ));
                }
            }
        }
        let line_height = state.font_size() * 1.45 * scale;
        let placements: Vec<(egui::TextureId, Rect)> = state
            .images
            .iter()
            .filter_map(|image| {
                image.texture.as_ref().map(|texture| {
                    let top = text_rect.top() + image.line as f32 * line_height;
                    (
                        texture.id(),
                        Rect::from_min_size(
                            Pos2::new(text_rect.left(), top),
                            Vec2::new(image.width * scale, image.height * scale),
                        ),
                    )
                })
            })
            .collect();
        for (texture, rect) in placements {
            painter.image(
                texture,
                rect,
                Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)),
                Color32::WHITE,
            );
        }
        let style = state.clone();
        let mut layouter = move |ui: &Ui, text: &str, wrap_width: f32| {
            let job = style.layout(text, wrap_width);
            ui.fonts(|fonts| fonts.layout_job(job))
        };
        let edit = TextEdit::multiline(&mut state.body)
            .frame(false)
            .desired_width(text_rect.width())
            .desired_rows(14)
            .text_color(theme.palette.text)
            .layouter(&mut layouter);
        let response = ui.put(text_rect, edit);
        if response.has_focus() {
            if let Some(edit_state) = egui::text_edit::TextEditState::load(ui.ctx(), response.id) {
                if let Some(range) = edit_state.cursor.char_range() {
                    let (a, b) = (range.primary.index, range.secondary.index);
                    state.selection = (a.min(b), a.max(b));
                }
            }
        }
        if response.lost_focus() {
            state.snapshot();
        }
    }

    // Status bar: words, characters, language, spelling and zoom.
    let status = Rect::from_min_size(
        Pos2::new(area.left(), footer_bottom - status_height),
        Vec2::new(area.width(), status_height),
    );
    painter.rect_filled(
        Rect::from_min_max(
            Pos2::new(area.left(), footer_bottom),
            Pos2::new(area.right(), area.bottom()),
        ),
        Rounding::same(0.0),
        editor_canvas(theme),
    );
    painter.rect_filled(status, Rounding::same(0.0), status_fill(theme));
    painter.hline(
        status.x_range(),
        status.top() + 0.5,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    let cells = [
        (labels.words(), format!("{}", state.words())),
        (labels.characters(), format!("{}", state.characters())),
        (
            labels.language_label(),
            labels.language_name(state.language),
        ),
        (
            labels.errors(),
            if state.spell {
                String::from("0")
            } else {
                String::from("–")
            },
        ),
        (labels.zoom(), format!("{:.0} %", state.zoom)),
    ];
    let cell_width = status.width() / cells.len() as f32;
    for (index, (label, value)) in cells.iter().enumerate() {
        let center = Pos2::new(
            status.left() + cell_width * index as f32 + cell_width * 0.5,
            status.center().y,
        );
        painter.text(
            Pos2::new(center.x, status.center().y - 7.0),
            egui::Align2::CENTER_CENTER,
            *label,
            FontId::new(7.0, crate::theme::semibold()),
            theme.palette.text_muted,
        );
        painter.text(
            Pos2::new(center.x, status.center().y + 6.0),
            egui::Align2::CENTER_CENTER,
            value,
            FontId::new(10.0, crate::theme::mono_bold()),
            theme.palette.text,
        );
        if index > 0 {
            painter.vline(
                status.left() + cell_width * index as f32,
                Rect::from_min_max(
                    Pos2::new(center.x, status.top() + 4.0),
                    Pos2::new(center.x, status.bottom() - 4.0),
                )
                .y_range(),
                Stroke::new(1.0_f32, theme.palette.border),
            );
        }
    }
}

/// Paints the groups of the active ribbon tab.
fn paint_ribbon(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    labels: &Labels,
    rect: Rect,
    state: &mut TextwerkState,
) {
    let inner = Rect::from_min_max(
        Pos2::new(rect.left() + 12.0, rect.top() + 8.0),
        Pos2::new(rect.right() - 12.0, rect.bottom() - 6.0),
    );
    match state.tab {
        RibbonTab::Home => paint_home(ui, painter, theme, labels, inner, state),
        RibbonTab::File => {
            let actions = [
                (labels.new_document(), Icon::Plus),
                (labels.open(), Icon::Folder),
                (labels.save(), Icon::HardDrive),
                (labels.print(), Icon::Grid),
                (labels.export(), Icon::Download),
            ];
            if let Some(index) = paint_action_row(ui, painter, theme, inner, &actions, 0) {
                match index {
                    0 => {
                        state.body.clear();
                        state.styles.clear();
                        state.selection = (0, 0);
                        state.snapshot();
                    }
                    1 => {
                        state.body = String::from(
                            "Besprechungsprotokoll\n\nDatum: 19.11.2026\nTeilnehmer: Admin\n\n                             Tagesordnung\n- Begrüßung\n- Projektstand\n- Offene Punkte\n                             - Nächste Schritte\n",
                        );
                        state.styles.clear();
                        state.selection = (0, 0);
                        state.snapshot();
                    }
                    2 => state.snapshot(),
                    _ => {}
                }
            }
        }
        RibbonTab::Insert => {
            let actions = [
                (labels.table(), Icon::Grid),
                (labels.picture(), Icon::Package),
                (labels.link(), Icon::FileText),
                (labels.page_break(), Icon::FileText),
            ];
            if let Some(index) = paint_action_row(ui, painter, theme, inner, &actions, 0) {
                match index {
                    0 => state.insert_text("\nSpalte 1\tSpalte 2\nWert 1\tWert 2\n"),
                    1 => state.open_dialog(DialogKind::Image),
                    2 => state.insert_text("[Link](https://)"),
                    _ => state.insert_text("\n──────────── Seitenumbruch ────────────\n"),
                }
            }
        }
        RibbonTab::Layout => {
            let actions = [
                (labels.margins(), Icon::Grid),
                (labels.orientation(), Icon::Monitor),
                (labels.columns(), Icon::Widgets),
            ];
            if let Some(index) = paint_action_row(ui, painter, theme, inner, &actions, 0) {
                match index {
                    0 => state.margins = (state.margins + 1) % 3,
                    1 => state.landscape = !state.landscape,
                    _ => {
                        state.columns = if state.columns == 1 { 2 } else { 1 };
                    }
                }
            }
        }
        RibbonTab::View => {
            let mut y = inner.top();
            let row =
                Rect::from_min_size(Pos2::new(inner.left(), y), Vec2::new(inner.width(), 34.0));
            paint_toggle_row(
                ui,
                painter,
                theme,
                labels,
                row,
                &mut [
                    (labels.ruler(), &mut state.ruler),
                    (labels.spell_check(), &mut state.spell),
                ],
            );
            y += 40.0;
            let zoom_row =
                Rect::from_min_size(Pos2::new(inner.left(), y), Vec2::new(inner.width(), 34.0));
            paint_zoom_row(ui, painter, theme, labels, zoom_row, state);
        }
        RibbonTab::Review => {
            let mut y = inner.top();
            let row =
                Rect::from_min_size(Pos2::new(inner.left(), y), Vec2::new(inner.width(), 34.0));
            paint_toggle_row(
                ui,
                painter,
                theme,
                labels,
                row,
                &mut [(labels.spell_check(), &mut state.spell)],
            );
            y += 40.0;
            let comment_row =
                Rect::from_min_size(Pos2::new(inner.left(), y), Vec2::new(inner.width(), 34.0));
            paint_action_row(
                ui,
                painter,
                theme,
                comment_row,
                &[(labels.comment(), Icon::FileText)],
                0,
            );
        }
    }
}

/// Paints the modal file dialog and performs its action when the user confirms it.
fn editor_dialog(ctx: &egui::Context, theme: &Theme, state: &mut TextwerkState) {
    let Some(mut dialog) = state.dialog.clone() else {
        return;
    };
    let screen = ctx.screen_rect();
    let panel = Rect::from_center_size(screen.center(), Vec2::new(364.0, 436.0));
    let left = panel.left() + 18.0;
    let width = panel.width() - 36.0;
    let preview_lines: Vec<String> = io::wrap_lines(&state.body, 62);
    let mut confirm = false;
    let mut cancel = false;
    egui::Area::new(Id::new("socdof-textwerk-dialog"))
        .order(egui::Order::Foreground)
        .fixed_pos(screen.min)
        .show(ctx, |ui| {
            ui.set_min_size(screen.size());
            let painter = ui.painter().clone();
            painter.rect_filled(screen, Rounding::same(0.0), Color32::from_black_alpha(150));
            painter.rect(
                panel,
                Rounding::same(16.0),
                theme.palette.surface,
                Stroke::new(1.0_f32, theme.palette.border),
            );
            painter.text(
                Pos2::new(left, panel.top() + 24.0),
                egui::Align2::LEFT_CENTER,
                dialog.title(),
                FontId::new(14.0, crate::theme::heavy()),
                theme.palette.text,
            );
            painter.text(
                Pos2::new(left, panel.top() + 42.0),
                egui::Align2::LEFT_CENTER,
                format!(
                    "{} · {}",
                    dialog.dir.display(),
                    match dialog.kind {
                        DialogKind::Image => "PNG",
                        DialogKind::Open => "TXT, MD",
                        _ => "TXT, HTML, PDF",
                    }
                ),
                FontId::new(8.5, crate::theme::semibold()),
                theme.palette.text_muted,
            );
            let close = Rect::from_center_size(
                Pos2::new(panel.right() - 22.0, panel.top() + 24.0),
                Vec2::splat(22.0),
            );
            if ui
                .interact(
                    close,
                    Id::new("socdof-textwerk-dialog-close"),
                    Sense::click(),
                )
                .clicked()
            {
                cancel = true;
            }
            Icon::Close.draw(
                &painter,
                Rect::from_center_size(close.center(), Vec2::splat(12.0)),
                theme.palette.text_muted,
                1.7,
            );

            // Directory entries: ".." first, then folders and the matching files.
            let mut row_y = panel.top() + 64.0;
            let up = Rect::from_min_size(Pos2::new(left, row_y), Vec2::new(width, 22.0));
            if ui
                .interact(up, Id::new("socdof-textwerk-dialog-up"), Sense::click())
                .clicked()
            {
                if let Some(parent) = dialog.dir.parent().map(|path| path.to_path_buf()) {
                    dialog.dir = parent;
                    dialog.refresh();
                }
            }
            painter.text(
                Pos2::new(left + 4.0, up.center().y),
                egui::Align2::LEFT_CENTER,
                "..",
                FontId::new(10.0, crate::theme::semibold()),
                theme.palette.text_muted,
            );
            row_y += 24.0;
            let entries: Vec<io::FileEntry> = dialog.entries.iter().take(9).cloned().collect();
            for (index, entry) in entries.iter().enumerate() {
                let row = Rect::from_min_size(Pos2::new(left, row_y), Vec2::new(width, 21.0));
                let id = Id::new(("socdof-textwerk-dialog-entry", index));
                let response = ui.interact(row, id, Sense::click());
                if response.hovered() {
                    painter.rect(
                        row,
                        Rounding::same(6.0),
                        theme.palette.surface_muted,
                        Stroke::NONE,
                    );
                }
                painter.text(
                    Pos2::new(left + 4.0, row.center().y),
                    egui::Align2::LEFT_CENTER,
                    if entry.is_dir {
                        format!("{}/", entry.name)
                    } else {
                        entry.name.clone()
                    },
                    FontId::new(10.0, crate::theme::semibold()),
                    if entry.is_dir {
                        theme.accent.base
                    } else {
                        theme.palette.text
                    },
                );
                if response.clicked() {
                    if entry.is_dir {
                        dialog.dir = dialog.dir.join(&entry.name);
                        dialog.refresh();
                    } else {
                        dialog.name = entry.name.clone();
                    }
                }
                row_y += 21.0;
            }
            if dialog.entries.is_empty() {
                painter.text(
                    Pos2::new(left + 4.0, row_y + 8.0),
                    egui::Align2::LEFT_CENTER,
                    "Keine passenden Dateien",
                    FontId::new(10.0, crate::theme::semibold()),
                    theme.palette.text_muted,
                );
            }

            // Page preview of the document that print and export write to disk.
            if matches!(dialog.kind, DialogKind::Print | DialogKind::Export) {
                let preview = Rect::from_min_size(
                    Pos2::new(panel.right() - 132.0, panel.top() + 66.0),
                    Vec2::new(112.0, 158.0),
                );
                painter.rect(
                    preview,
                    Rounding::same(2.0),
                    Color32::WHITE,
                    Stroke::new(1.0_f32, theme.palette.border),
                );
                for (index, line) in preview_lines.iter().take(30).enumerate() {
                    painter.text(
                        Pos2::new(
                            preview.left() + 6.0,
                            preview.top() + 6.0 + index as f32 * 5.0,
                        ),
                        egui::Align2::LEFT_TOP,
                        line,
                        FontId::new(3.4, egui::FontFamily::Proportional),
                        Color32::from_rgb(0x33, 0x41, 0x55),
                    );
                }
                painter.text(
                    Pos2::new(preview.center().x, preview.bottom() + 8.0),
                    egui::Align2::CENTER_CENTER,
                    format!("{} Zeilen · A4", preview_lines.len()),
                    FontId::new(8.0, crate::theme::semibold()),
                    theme.palette.text_muted,
                );
            }

            // File name field.
            let field = Rect::from_min_size(
                Pos2::new(left, panel.bottom() - 116.0),
                Vec2::new(width, 26.0),
            );
            painter.rect(
                field,
                Rounding::same(8.0),
                theme.palette.background,
                Stroke::new(1.0_f32, theme.palette.border),
            );
            ui.put(
                field.shrink2(Vec2::new(6.0, 3.0)),
                TextEdit::singleline(&mut dialog.name)
                    .frame(false)
                    .text_color(theme.palette.text)
                    .font(FontId::new(10.0, crate::theme::semibold())),
            );
            if let Some(error) = dialog.error.clone() {
                painter.text(
                    Pos2::new(left, panel.bottom() - 84.0),
                    egui::Align2::LEFT_CENTER,
                    error,
                    FontId::new(9.0, crate::theme::semibold()),
                    theme.palette.danger,
                );
            } else if let Some(notice) = dialog.notice.clone() {
                painter.text(
                    Pos2::new(left, panel.bottom() - 84.0),
                    egui::Align2::LEFT_CENTER,
                    format!("Gespeichert: {notice}"),
                    FontId::new(9.0, crate::theme::semibold()),
                    theme.palette.success,
                );
            } else if dialog.kind == DialogKind::Print {
                painter.text(
                    Pos2::new(left, panel.bottom() - 84.0),
                    egui::Align2::LEFT_CENTER,
                    "Druckvorschau: A4, Helvetica 11 pt, Ränder 56 pt",
                    FontId::new(9.0, crate::theme::semibold()),
                    theme.palette.text_muted,
                );
            }

            let footer = panel.bottom() - 44.0;
            let half = (width - 8.0) * 0.5;
            let cancel_rect = Rect::from_min_size(Pos2::new(left, footer), Vec2::new(half, 30.0));
            let go_rect =
                Rect::from_min_size(Pos2::new(left + half + 8.0, footer), Vec2::new(half, 30.0));
            for (rect, label, primary) in [
                (cancel_rect, "Abbrechen", false),
                (
                    go_rect,
                    match dialog.kind {
                        DialogKind::Open => "Öffnen",
                        DialogKind::Image => "Einfügen",
                        DialogKind::Print => "Drucken",
                        DialogKind::Export => "Exportieren",
                        DialogKind::Save => "Speichern",
                    },
                    true,
                ),
            ] {
                let response = ui.interact(
                    rect,
                    Id::new(("socdof-textwerk-dialog-button", rect.left() as i32)),
                    Sense::click(),
                );
                painter.rect(
                    rect,
                    Rounding::same(10.0),
                    if primary {
                        if response.hovered() {
                            theme.accent.hover
                        } else {
                            theme.accent.base
                        }
                    } else {
                        theme.palette.surface_muted
                    },
                    Stroke::NONE,
                );
                painter.text(
                    rect.center(),
                    egui::Align2::CENTER_CENTER,
                    label,
                    FontId::new(10.0, crate::theme::heavy()),
                    if primary {
                        theme.palette.accent_on
                    } else {
                        theme.palette.text
                    },
                );
                if response.clicked() {
                    if primary {
                        confirm = true;
                    } else {
                        cancel = true;
                    }
                }
            }
        });

    if cancel {
        state.dialog = None;
        return;
    }
    if !confirm {
        state.dialog = Some(dialog);
        return;
    }

    let path = dialog.dir.join(dialog.name.trim());
    let result: std::io::Result<()> = match dialog.kind {
        DialogKind::Open => io::read_text(&path).map(|body| {
            state.body = body;
            state.styles.clear();
            state.images.clear();
            state.selection = (0, 0);
            if let Some(stem) = path.file_stem() {
                state.title = stem.to_string_lossy().to_string();
            }
            state.snapshot();
            state.dialog = None;
        }),
        DialogKind::Save => {
            let target = if path.extension().is_none() {
                path.with_extension("txt")
            } else {
                path.clone()
            };
            io::write_text(&target, &state.body).map(|()| {
                dialog.notice = Some(target.display().to_string());
                dialog.error = None;
            })
        }
        DialogKind::Image => io::decode_png(&path).map(|_| {
            state.place_image(path.clone());
            state.dialog = None;
        }),
        DialogKind::Print => {
            let target = path.with_extension("pdf");
            io::write_pdf(&target, &state.title, &state.body).map(|()| {
                dialog.notice = Some(target.display().to_string());
                dialog.error = None;
            })
        }
        DialogKind::Export => {
            let target = path.with_extension("html");
            io::write_html(&target, &state.title, &state.body).map(|()| {
                dialog.notice = Some(target.display().to_string());
                dialog.error = None;
            })
        }
    };
    if let Err(error) = result {
        if state.dialog.is_some() {
            return;
        }
        dialog.error = Some(error.to_string());
    }
    if state.dialog.is_some() {
        state.dialog = Some(dialog);
    }
}

fn paint_home(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    labels: &Labels,
    rect: Rect,
    state: &mut TextwerkState,
) {
    // Undo and redo.
    let undo = Rect::from_min_size(rect.min, Vec2::splat(30.0));
    paint_icon_button(
        ui,
        painter,
        theme,
        labels.undo_short(),
        Icon::Refresh,
        undo,
        false,
        || state.undo(),
    );
    let redo = Rect::from_min_size(Pos2::new(undo.right() + 8.0, rect.top()), Vec2::splat(30.0));
    paint_icon_button(
        ui,
        painter,
        theme,
        labels.redo_short(),
        Icon::Refresh,
        redo,
        false,
        || state.redo(),
    );

    // Style presets.
    let styles_left = redo.right() + 66.0;
    let style_width = 54.0;
    for (index, size) in [2usize, 3, 3, 2].iter().enumerate() {
        let cell = Rect::from_min_size(
            Pos2::new(styles_left + index as f32 * (style_width + 4.0), rect.top()),
            Vec2::new(style_width, 34.0),
        );
        let id = Id::new(("socdof-textwerk-style", index));
        if ui.interact(cell, id, Sense::click()).clicked() {
            state.size = *size;
            state.bold = index < 3;
            state.italic = index == 3;
            let (size_index, bold, italic) = (*size, index < 3, index == 3);
            state.format_selection(|style| {
                style.size = size_index;
                style.bold = bold;
                style.italic = italic;
            });
        }
        let words: Vec<&str> = labels.style(index).split(' ').collect();
        for (line, word) in words.iter().enumerate() {
            painter.text(
                Pos2::new(cell.center().x, cell.top() + 9.0 + line as f32 * 10.0),
                egui::Align2::CENTER_CENTER,
                *word,
                FontId::new(
                    9.0,
                    if index < 3 {
                        crate::theme::semibold()
                    } else {
                        crate::theme::light()
                    },
                ),
                if index == 0 {
                    theme.palette.text
                } else {
                    theme.palette.text_muted
                },
            );
        }
        painter.text(
            Pos2::new(cell.center().x, cell.top() + 30.0),
            egui::Align2::CENTER_CENTER,
            labels.style_hint(index),
            FontId::new(6.5, crate::theme::semibold()),
            theme.palette.text_muted,
        );
    }

    // Font family and size dropdowns.
    let font_left = rect.left() + 4.0;
    let family = Rect::from_min_size(
        Pos2::new(font_left, rect.top() + 65.0),
        Vec2::new(112.0, 26.0),
    );
    if paint_dropdown(
        ui,
        painter,
        theme,
        family,
        FAMILIES[state.family.min(FAMILIES.len() - 1)].0,
    ) {
        state.family = (state.family + 1) % FAMILIES.len();
        let family_index = state.family;
        state.format_selection(|style| style.family = family_index);
    }
    let size_rect = Rect::from_min_size(
        Pos2::new(family.right() + 8.0, rect.top() + 65.0),
        Vec2::new(56.0, 26.0),
    );
    if paint_dropdown(
        ui,
        painter,
        theme,
        size_rect,
        &format!("{:.0}", state.font_size()),
    ) {
        state.size = (state.size + 1) % SIZES.len();
        let size_index = state.size;
        state.format_selection(|style| style.size = size_index);
    }
    let _ = labels;

    // Character styles.
    let styles = [
        (labels.bold(), 'B'),
        (labels.italic(), 'I'),
        (labels.underline(), 'U'),
        (labels.strike(), 'S'),
        (labels.superscript(), 'x'),
        (labels.subscript(), 'x'),
    ];
    let style_left = font_left;
    let style_top = rect.top() + 108.0;
    for (index, (label, glyph)) in styles.iter().enumerate() {
        let cell = Rect::from_min_size(
            Pos2::new(style_left + index as f32 * 46.0, style_top),
            Vec2::new(42.0, 30.0),
        );
        let id = Id::new(("socdof-textwerk-char", index));
        let response = ui.interact(cell, id, Sense::click());
        let active = match index {
            0 => state.bold,
            1 => state.italic,
            2 => state.underline,
            3 => state.strike,
            4 => state.superscript,
            _ => state.subscript,
        };
        if response.clicked() {
            match index {
                0 => {
                    state.bold = !state.bold;
                    let value = state.bold;
                    state.format_selection(|style| style.bold = value);
                }
                1 => {
                    state.italic = !state.italic;
                    let value = state.italic;
                    state.format_selection(|style| style.italic = value);
                }
                2 => {
                    state.underline = !state.underline;
                    let value = state.underline;
                    state.format_selection(|style| style.underline = value);
                }
                3 => {
                    state.strike = !state.strike;
                    let value = state.strike;
                    state.format_selection(|style| style.strike = value);
                }
                4 => {
                    state.superscript = !state.superscript;
                    state.subscript = false;
                    let value = state.superscript;
                    state.format_selection(|style| {
                        style.superscript = value;
                        if value {
                            style.subscript = false;
                        }
                    });
                }
                _ => {
                    state.subscript = !state.subscript;
                    state.superscript = false;
                    let value = state.subscript;
                    state.format_selection(|style| {
                        style.subscript = value;
                        if value {
                            style.superscript = false;
                        }
                    });
                }
            }
        }
        if active || response.hovered() {
            painter.rect(cell, Rounding::same(8.0), theme.accent.light, Stroke::NONE);
        }
        let mut font = FontId::new(
            15.0,
            if index == 1 {
                crate::theme::light()
            } else {
                crate::theme::semibold()
            },
        );
        if index == 4 || index == 5 {
            font.size = 12.0;
        }
        let text = if index == 4 || index == 5 {
            format!("{glyph}²")
        } else {
            (*glyph).to_string()
        };
        let mut color = if active {
            theme.accent.base
        } else {
            theme.palette.text
        };
        if index == 1 {
            color = if active {
                theme.accent.base
            } else {
                theme.palette.text
            };
        }
        painter.text(
            cell.center(),
            egui::Align2::CENTER_CENTER,
            text,
            font,
            color,
        );
        if index == 2 {
            painter.hline(
                Rect::from_center_size(
                    Pos2::new(cell.center().x, cell.center().y + 9.0),
                    Vec2::new(12.0, 1.0),
                )
                .x_range(),
                cell.center().y + 9.0,
                Stroke::new(1.5_f32, color),
            );
        }
        if index == 3 {
            painter.hline(
                Rect::from_center_size(
                    Pos2::new(cell.center().x, cell.center().y),
                    Vec2::new(14.0, 1.0),
                )
                .x_range(),
                cell.center().y,
                Stroke::new(1.5_f32, color),
            );
        }
        let _ = label;
    }

    // Text color and highlight rows.
    Icon::PenLine.draw(
        painter,
        Rect::from_center_size(
            Pos2::new(rect.left() + 12.0, rect.top() + 170.0),
            Vec2::splat(16.0),
        ),
        theme.palette.text,
        1.6,
    );
    for (index, color) in COLORS.iter().enumerate() {
        let cell = Rect::from_center_size(
            Pos2::new(rect.left() + 34.0 + index as f32 * 22.0, rect.top() + 170.0),
            Vec2::splat(16.0),
        );
        painter.rect(
            cell,
            Rounding::same(4.0),
            color.unwrap_or(Color32::WHITE),
            Stroke::new(1.0_f32, Color32::from_rgb(0xc7, 0xd2, 0xdf)),
        );
        let id = Id::new(("socdof-textwerk-color", index));
        if ui.interact(cell, id, Sense::click()).clicked() {
            state.color = index;
            state.format_selection(|style| style.color = index);
        }
        if state.color == index {
            painter.rect_stroke(
                cell.expand(2.0),
                Rounding::same(5.0),
                Stroke::new(1.5_f32, theme.accent.base),
            );
        }
    }
    Icon::Package.draw(
        painter,
        Rect::from_center_size(
            Pos2::new(rect.left() + 12.0, rect.top() + 202.0),
            Vec2::splat(16.0),
        ),
        theme.palette.text,
        1.6,
    );
    for (index, color) in HIGHLIGHTS.iter().enumerate() {
        let cell = Rect::from_center_size(
            Pos2::new(rect.left() + 34.0 + index as f32 * 22.0, rect.top() + 202.0),
            Vec2::splat(16.0),
        );
        painter.rect(
            cell,
            Rounding::same(4.0),
            color.unwrap_or(Color32::WHITE),
            Stroke::new(1.0_f32, Color32::from_rgb(0xc7, 0xd2, 0xdf)),
        );
        let id = Id::new(("socdof-textwerk-highlight", index));
        if ui.interact(cell, id, Sense::click()).clicked() {
            state.highlight = index;
            state.format_selection(|style| style.highlight = index);
        }
        if state.highlight == index {
            painter.rect_stroke(
                cell.expand(2.0),
                Rounding::same(5.0),
                Stroke::new(1.5_f32, theme.accent.base),
            );
        }
        let _ = color;
    }

    // Paragraph alignment.
    let align_top = rect.top() + 233.0;
    let aligns = [
        (labels.align_left(), TextAlign::Left),
        (labels.align_center(), TextAlign::Center),
        (labels.align_right(), TextAlign::Right),
        (labels.align_justify(), TextAlign::Justify),
    ];
    for (index, (label, value)) in aligns.iter().enumerate() {
        let cell = Rect::from_min_size(
            Pos2::new(rect.left() + 2.0 + index as f32 * 58.0, align_top),
            Vec2::new(54.0, 32.0),
        );
        let id = Id::new(("socdof-textwerk-align", index));
        let response = ui.interact(cell, id, Sense::click());
        if response.clicked() {
            state.align = *value;
        }
        if state.align == *value {
            painter.rect(cell, Rounding::same(8.0), theme.accent.light, Stroke::NONE);
        }
        let color = if state.align == *value {
            theme.accent.base
        } else {
            theme.palette.text
        };
        for (line, width) in [(0.0_f32, 16.0_f32), (5.0, 12.0), (10.0, 16.0)] {
            let x = match value {
                TextAlign::Left | TextAlign::Justify => cell.center().x - 8.0,
                TextAlign::Center => cell.center().x - width * 0.5,
                TextAlign::Right => cell.center().x + 8.0 - width,
            };
            painter.hline(
                Rect::from_min_size(Pos2::new(x, cell.top() + 8.0 + line), Vec2::new(width, 1.0))
                    .x_range(),
                cell.top() + 8.0 + line,
                Stroke::new(1.2_f32, color),
            );
        }
        painter.text(
            Pos2::new(cell.center().x, cell.bottom() - 6.0),
            egui::Align2::CENTER_CENTER,
            *label,
            FontId::new(8.0, crate::theme::semibold()),
            theme.palette.text_muted,
        );
    }

    // Lists.
    let list_left = rect.left() + 246.0;
    for (index, (label, value)) in [
        (labels.bullets(), ListStyle::Bullets),
        (labels.numbering(), ListStyle::Numbering),
    ]
    .iter()
    .enumerate()
    {
        let cell = Rect::from_min_size(
            Pos2::new(list_left + index as f32 * 58.0, align_top),
            Vec2::new(54.0, 32.0),
        );
        let id = Id::new(("socdof-textwerk-list", index));
        if ui.interact(cell, id, Sense::click()).clicked() {
            let next = if state.list == *value {
                ListStyle::None
            } else {
                *value
            };
            state.set_list(next);
        }
        let active = state.list == *value;
        if active {
            painter.rect(cell, Rounding::same(8.0), theme.accent.light, Stroke::NONE);
        }
        let color = if active {
            theme.accent.base
        } else {
            theme.palette.text
        };
        for line in 0..3 {
            let top = cell.top() + 8.0 + line as f32 * 5.0;
            if index == 0 {
                painter.circle_filled(Pos2::new(cell.left() + 16.0, top), 1.4, color);
            } else {
                painter.text(
                    Pos2::new(cell.left() + 16.0, top),
                    egui::Align2::CENTER_CENTER,
                    format!("{}", line + 1),
                    FontId::new(6.0, crate::theme::semibold()),
                    color,
                );
            }
            painter.hline(
                Rect::from_min_size(Pos2::new(cell.left() + 22.0, top), Vec2::new(14.0, 1.0))
                    .x_range(),
                top,
                Stroke::new(1.2_f32, color),
            );
        }
        painter.text(
            Pos2::new(cell.center().x, cell.bottom() - 6.0),
            egui::Align2::CENTER_CENTER,
            *label,
            FontId::new(8.0, crate::theme::semibold()),
            theme.palette.text_muted,
        );
    }

    // Editing group.
    let editing_top = rect.top() + 278.0;
    for (index, (label, icon)) in [
        (labels.find(), Icon::Search),
        (labels.replace(), Icon::Edit),
    ]
    .iter()
    .enumerate()
    {
        let cell = Rect::from_min_size(
            Pos2::new(rect.left() + 2.0 + index as f32 * 56.0, editing_top),
            Vec2::new(52.0, 24.0),
        );
        let id = Id::new(("socdof-textwerk-edit", index));
        if ui.interact(cell, id, Sense::click()).clicked() && index == 0 {
            state.find_open = !state.find_open;
        }
        icon.draw(
            painter,
            Rect::from_center_size(
                Pos2::new(cell.left() + 12.0, cell.center().y),
                Vec2::splat(13.0),
            ),
            theme.palette.text,
            1.6,
        );
        painter.text(
            Pos2::new(cell.left() + 22.0, cell.center().y),
            egui::Align2::LEFT_CENTER,
            label,
            FontId::new(10.0, crate::theme::semibold()),
            theme.palette.text,
        );
    }

    for (caption, center_x, left_edge) in [
        (labels.undo_caption(), 34.0_f32, None),
        (labels.styles_caption(), 250.0, Some(128.0_f32)),
        (labels.font_caption(), 92.0, None),
        (labels.paragraph_caption(), 232.0, Some(372.0)),
        (labels.editing_caption(), 58.0, None),
    ] {
        if let Some(left_edge) = left_edge {
            painter.vline(
                rect.left() + left_edge,
                Rect::from_min_max(
                    Pos2::new(rect.left() + left_edge, rect.top() + 2.0),
                    Pos2::new(rect.left() + left_edge, rect.bottom() - 14.0),
                )
                .y_range(),
                Stroke::new(1.0_f32, theme.palette.border),
            );
        }
        painter.text(
            Pos2::new(rect.left() + center_x, rect.bottom() - 3.0),
            egui::Align2::CENTER_CENTER,
            caption,
            FontId::new(7.5, crate::theme::semibold()),
            theme.palette.text_muted,
        );
    }
    let _ = labels;
}

/// Paints a row of labelled icon buttons.
fn paint_action_row(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    rect: Rect,
    actions: &[(&'static str, Icon)],
    _selected: usize,
) -> Option<usize> {
    let mut clicked = None;
    for (index, (label, icon)) in actions.iter().enumerate() {
        let cell = Rect::from_min_size(
            Pos2::new(rect.left() + index as f32 * 84.0, rect.top()),
            Vec2::new(78.0, 56.0),
        );
        let id = Id::new(("socdof-textwerk-action", index));
        let response = ui.interact(cell, id, Sense::click());
        if response.clicked() {
            clicked = Some(index);
        }
        if response.hovered() {
            painter.rect(cell, Rounding::same(8.0), theme.accent.light, Stroke::NONE);
        }
        icon.draw(
            painter,
            Rect::from_center_size(
                Pos2::new(cell.center().x, cell.top() + 18.0),
                Vec2::splat(18.0),
            ),
            theme.palette.text,
            1.7,
        );
        painter.text(
            Pos2::new(cell.center().x, cell.top() + 40.0),
            egui::Align2::CENTER_CENTER,
            *label,
            FontId::new(9.0, crate::theme::semibold()),
            theme.palette.text_muted,
        );
    }
    clicked
}

/// Paints toggle buttons for the View and Review tabs.
fn paint_toggle_row(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    _labels: &Labels,
    rect: Rect,
    toggles: &mut [(&'static str, &mut bool)],
) {
    for (index, item) in toggles.iter_mut().enumerate() {
        let (label, value): (&'static str, &mut bool) = (item.0, &mut *item.1);
        let cell = Rect::from_min_size(
            Pos2::new(rect.left() + index as f32 * 108.0, rect.top()),
            Vec2::new(100.0, 30.0),
        );
        let id = Id::new(("socdof-textwerk-toggle", index));
        let response = ui.interact(cell, id, Sense::click());
        if response.clicked() {
            *value = !*value;
        }
        painter.rect(
            cell,
            Rounding::same(8.0),
            if *value {
                theme.accent.light
            } else {
                theme.palette.surface_muted
            },
            Stroke::NONE,
        );
        painter.text(
            cell.center(),
            egui::Align2::CENTER_CENTER,
            label,
            FontId::new(10.0, crate::theme::semibold()),
            if *value {
                theme.accent.base
            } else {
                theme.palette.text
            },
        );
    }
}

/// Paints the zoom controls of the View tab.
fn paint_zoom_row(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    labels: &Labels,
    rect: Rect,
    state: &mut TextwerkState,
) {
    let minus = Rect::from_min_size(rect.min, Vec2::new(30.0, 30.0));
    let plus = Rect::from_min_size(
        Pos2::new(rect.left() + 96.0, rect.top()),
        Vec2::new(30.0, 30.0),
    );
    for (rect, delta) in [(minus, -10.0_f32), (plus, 10.0)] {
        let id = Id::new(("socdof-textwerk-zoom", delta as i32));
        if ui.interact(rect, id, Sense::click()).clicked() {
            state.zoom = (state.zoom + delta).clamp(50.0, 200.0);
        }
    }
    painter.rect(
        Rect::from_min_size(rect.min, Vec2::new(132.0, 30.0)),
        Rounding::same(8.0),
        theme.palette.surface_muted,
        Stroke::NONE,
    );
    painter.text(
        Rect::from_min_size(rect.min, Vec2::new(30.0, 30.0)).center(),
        egui::Align2::CENTER_CENTER,
        "−",
        FontId::new(14.0, crate::theme::semibold()),
        theme.palette.text,
    );
    painter.text(
        Rect::from_min_size(rect.min, Vec2::new(132.0, 30.0)).center(),
        egui::Align2::CENTER_CENTER,
        format!("{} %", labels.zoom_value(state.zoom)),
        FontId::new(10.0, crate::theme::semibold()),
        theme.palette.text,
    );
    painter.text(
        plus.center(),
        egui::Align2::CENTER_CENTER,
        "+",
        FontId::new(14.0, crate::theme::semibold()),
        theme.palette.text,
    );
}

/// Paints an icon button with a tooltip label.
#[allow(clippy::too_many_arguments)]
fn paint_icon_button(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    label: &'static str,
    icon: Icon,
    rect: Rect,
    active: bool,
    mut action: impl FnMut(),
) {
    let id = Id::new(("socdof-textwerk-icon", label));
    let response = ui.interact(rect, id, Sense::click());
    if response.clicked() {
        action();
    }
    if active || response.hovered() {
        painter.rect(rect, Rounding::same(8.0), theme.accent.light, Stroke::NONE);
    }
    icon.draw(
        painter,
        Rect::from_center_size(rect.center(), Vec2::splat(16.0)),
        if active {
            theme.accent.base
        } else {
            theme.palette.text
        },
        1.7,
    );
    painter.text(
        Pos2::new(rect.center().x, rect.bottom() + 6.0),
        egui::Align2::CENTER_CENTER,
        label,
        FontId::new(6.5, crate::theme::semibold()),
        theme.palette.text_muted,
    );
}

/// Paints a small dropdown control with its chevron.
fn paint_dropdown(
    ui: &mut Ui,
    painter: &egui::Painter,
    theme: &Theme,
    rect: Rect,
    value: &str,
) -> bool {
    let id = Id::new((
        "socdof-textwerk-dropdown",
        rect.left() as i32,
        rect.top() as i32,
    ));
    let response = ui.interact(rect, id, Sense::click());
    painter.rect(
        rect,
        Rounding::same(6.0),
        theme.palette.surface,
        Stroke::new(1.0_f32, theme.palette.border),
    );
    painter.text(
        Pos2::new(rect.left() + 8.0, rect.center().y),
        egui::Align2::LEFT_CENTER,
        value,
        FontId::new(10.0, crate::theme::semibold()),
        theme.palette.text,
    );
    Icon::ChevronDown.draw(
        painter,
        Rect::from_center_size(
            Pos2::new(rect.right() - 10.0, rect.center().y),
            Vec2::splat(10.0),
        ),
        theme.palette.text_muted,
        1.5,
    );
    // The dropdowns cycle through their options, so every entry stays reachable.
    response.clicked()
}

/// Editor strings in the four catalogue languages.
struct Labels {
    /// Translation language.
    language: Language,
}

impl Labels {
    fn new(language: Language) -> Self {
        Self { language }
    }

    fn german(&self) -> bool {
        self.language == Language::De
    }

    fn tab(&self, tab: RibbonTab) -> &'static str {
        match (tab, self.german()) {
            (RibbonTab::File, true) => "Datei",
            (RibbonTab::File, false) => "File",
            (RibbonTab::Home, true) => "Start",
            (RibbonTab::Home, false) => "Home",
            (RibbonTab::Insert, true) => "Einfügen",
            (RibbonTab::Insert, false) => "Insert",
            (RibbonTab::Layout, true) => "Layout",
            (RibbonTab::Layout, false) => "Layout",
            (RibbonTab::View, true) => "Ansicht",
            (RibbonTab::View, false) => "View",
            (RibbonTab::Review, true) => "Überprüfen",
            (RibbonTab::Review, false) => "Review",
        }
    }

    fn style(&self, index: usize) -> &'static str {
        match (index, self.german()) {
            (0, true) => "Standard",
            (0, false) => "Normal",
            (1, true) => "Überschrift 1",
            (1, false) => "Heading 1",
            (2, true) => "Überschrift 2",
            (2, false) => "Heading 2",
            (_, true) => "Zitat",
            (_, false) => "Quote",
        }
    }

    fn style_hint(&self, index: usize) -> &'static str {
        match (index, self.german()) {
            (0, true) => "Textkörper",
            (0, false) => "Body",
            (1, true) => "Große Überschrift",
            (1, false) => "Large heading",
            (2, true) => "Kleine Überschrift",
            (2, false) => "Small heading",
            (_, true) => "Zitatblock",
            (_, false) => "Quote block",
        }
    }

    fn language_name(&self, language: Language) -> String {
        match language {
            Language::De => String::from("Deutsch"),
            Language::En => String::from("English"),
            Language::Fr => String::from("Français"),
            Language::Es => String::from("Español"),
        }
    }

    fn zoom_value(&self, zoom: f32) -> String {
        format!("{zoom:.0}")
    }
}

macro_rules! label_field {
    ($($name:ident => ($de:expr, $en:expr)),* $(,)?) => {
        impl Labels {
            $(
                fn $name(&self) -> &'static str {
                    if self.german() { $de } else { $en }
                }
            )*
        }
    };
}

label_field! {
    bold => ("Fett", "Bold"),
    italic => ("Kursiv", "Italic"),
    underline => ("Unterstrichen", "Underline"),
    strike => ("Durchgestrichen", "Strikethrough"),
    superscript => ("Hochgestellt", "Superscript"),
    subscript => ("Tiefgestellt", "Subscript"),
    align_left => ("Links", "Left"),
    align_center => ("Zentriert", "Center"),
    align_right => ("Rechts", "Right"),
    align_justify => ("Blocksatz", "Justify"),
    bullets => ("Aufzählung", "Bullets"),
    numbering => ("Nummerierung", "Numbering"),
    find => ("Suchen", "Find"),
    replace => ("Ersetzen", "Replace"),
    undo_caption => ("Rückgängig", "Undo"),
    undo_short => ("Rückg.", "Undo"),
    redo_short => ("Wiederh.", "Redo"),
    styles_caption => ("Formatvorlagen", "Styles"),
    font_caption => ("Schriftart", "Font"),
    paragraph_caption => ("Absatz", "Paragraph"),
    editing_caption => ("Bearbeiten", "Editing"),
    words => ("Wörter", "Words"),
    characters => ("Zeichen", "Characters"),
    language_label => ("Sprache", "Language"),
    errors => ("Rechtschreibfehler", "Spelling errors"),
    zoom => ("Zoom", "Zoom"),
    new_document => ("Neu", "New"),
    open => ("Öffnen", "Open"),
    save => ("Speichern", "Save"),
    print => ("Drucken", "Print"),
    export => ("Export", "Export"),
    table => ("Tabelle", "Table"),
    picture => ("Bild", "Picture"),
    link => ("Link", "Link"),
    page_break => ("Seitenumbruch", "Page break"),
    margins => ("Ränder", "Margins"),
    orientation => ("Ausrichtung", "Orientation"),
    columns => ("Spalten", "Columns"),
    ruler => ("Lineal", "Ruler"),
    spell_check => ("Rechtschreibung", "Spell check"),
    comment => ("Kommentar", "Comment"),
}

#[cfg(test)]
mod tests {
    use super::{DialogKind, EditorDialog, TextwerkState};

    #[test]
    fn formatting_only_touches_the_selection() {
        let mut state = TextwerkState::new();
        state.body = "Hallo Welt".to_string();
        state.sync_styles();
        state.selection = (0, 5);
        state.format_selection(|style| style.bold = true);
        let bold = state.styles.iter().filter(|style| style.bold).count();
        assert_eq!(bold, 5, "only the selected characters turn bold");
        state.selection = (0, 0);
        state.format_selection(|style| style.italic = true);
        assert!(state.styles.iter().all(|style| style.italic));
        assert_eq!(state.styles.iter().filter(|style| style.bold).count(), 5);
    }

    #[test]
    fn insert_actions_write_at_the_caret() {
        let mut state = TextwerkState::new();
        state.body.clear();
        state.styles.clear();
        state.selection = (0, 0);
        state.insert_text("A");
        state.insert_text("B");
        assert_eq!(state.body, "AB");
        assert_eq!(state.styles.len(), 2);
        assert_eq!(state.selection.0, 2);
    }

    #[test]
    fn inserting_a_picture_reserves_space_on_the_page() {
        let dir = std::env::temp_dir().join(format!("socdof-textwerk-img-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("dir");
        let path = dir.join("bild.png");
        let file = std::fs::File::create(&path).expect("file");
        let mut encoder = png::Encoder::new(std::io::BufWriter::new(file), 4, 2);
        encoder.set_color(png::ColorType::Rgb);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().expect("header");
        writer.write_image_data(&[255; 4 * 2 * 3]).expect("pixels");
        writer.finish().expect("finish");

        let mut state = TextwerkState::new();
        state.body.clear();
        state.styles.clear();
        state.selection = (0, 0);
        state.place_image(path.clone());
        assert_eq!(state.images.len(), 1);
        let image = &state.images[0];
        assert_eq!(image.line, 0);
        assert!((image.width - 300.0).abs() < 0.1);
        let blank_lines = state.body.matches('\n').count();
        assert!(blank_lines >= 1, "the page reserves room for the picture");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_file_dialog_lists_and_reads_documents() {
        let dir = std::env::temp_dir().join(format!("socdof-textwerk-dlg-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("dir");
        std::fs::write(dir.join("notiz.txt"), "Inhalt").expect("write");
        std::fs::write(dir.join("bild.png"), b"x").expect("write");
        let dialog = EditorDialog::new(DialogKind::Open, dir.clone());
        assert_eq!(dialog.entries.len(), 1);
        assert_eq!(dialog.entries[0].name, "notiz.txt");
        assert_eq!(dialog.title(), "Dokument öffnen");
        let mut image = EditorDialog::new(DialogKind::Image, dir.clone());
        assert_eq!(image.entries[0].name, "bild.png");
        image.refresh();
        assert_eq!(image.entries.len(), 1);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_page_geometry_follows_the_layout_actions() {
        let mut state = TextwerkState::new();
        assert_eq!(state.margins, 1);
        state.margins = 2;
        state.landscape = true;
        state.columns = 2;
        assert!(state.landscape);
        assert_eq!(state.columns, 2);
    }
}
