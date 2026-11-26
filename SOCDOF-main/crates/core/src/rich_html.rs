//! Small, deliberately bounded HTML renderer for invoice templates.
//!
//! The TypeScript application inserts the custom template into the DOM, so the browser accepts the
//! complete HTML/CSS language. The Rust port only supports the subset that the shipped templates and
//! the importers actually use: headings, paragraphs, line breaks, lists, emphasis/strong/underline,
//! inline text styles, simple tables, images and CSS flex/grid containers. This module parses that
//! subset once and keeps the result as a document model shared by the egui preview, the PDF writer
//! and the DOCX writer; [`layout_container`] resolves the flex/grid geometry for all three.

use std::collections::BTreeMap;

use crate::pdf::writer::text_width;

/// Horizontal alignment used by a rendered block or table cell.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Align {
    /// Left aligned.
    #[default]
    Left,
    /// Centered.
    Center,
    /// Right aligned.
    Right,
}

/// One formatted text run.
#[derive(Debug, Clone, PartialEq)]
pub struct TextRun {
    /// Visible text, possibly containing newlines.
    pub text: String,
    /// Bold text.
    pub bold: bool,
    /// Italic text.
    pub italic: bool,
    /// Underlined text.
    pub underline: bool,
    /// Explicit RGB colour, inherited from an enclosing element.
    pub color: Option<[u8; 3]>,
    /// Font size in points, inherited from an enclosing element.
    pub size_pt: f32,
}

impl TextRun {
    /// Creates a plain run with the default body size.
    pub fn plain(text: impl Into<String>) -> Self {
        TextRun {
            text: text.into(),
            bold: false,
            italic: false,
            underline: false,
            color: None,
            size_pt: 10.0,
        }
    }
}

/// One cell of a rendered table.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct TableCell {
    /// Inline content of the cell.
    pub runs: Vec<TextRun>,
    /// Cell alignment.
    pub align: Align,
    /// Header cell rendered with strong text and a light background.
    pub header: bool,
    /// Optional RGB background.
    pub background: Option<[u8; 3]>,
}

impl TableCell {
    /// Plain text of the cell.
    pub fn text(&self) -> String {
        self.runs.iter().map(|run| run.text.as_str()).collect()
    }
}

/// A table with one row per source `<tr>`.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct RichTable {
    /// Rows in document order.
    pub rows: Vec<Vec<TableCell>>,
    /// Margins of the table in the surrounding block flow.
    pub margins: Margins,
}

/// Cross-axis alignment of the items of a container (`align-items`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum AlignItems {
    /// Items fill the line (`stretch`, the CSS default).
    #[default]
    Stretch,
    /// Items start at the top for a flex row (`flex-start`).
    Start,
    /// Items are centred on the cross axis (`center`).
    Center,
    /// Items end at the bottom for a flex row (`flex-end`).
    End,
}

/// Distribution of the free main-axis space (`justify-content`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Justify {
    /// Items start at the main-axis start (`flex-start`, the CSS default).
    #[default]
    Start,
    /// Items end at the main-axis end (`flex-end`).
    End,
    /// Items are centred along the main axis (`center`).
    Center,
    /// The free space is placed between the items (`space-between`).
    SpaceBetween,
    /// The free space is split around the items (`space-around`).
    SpaceAround,
    /// The free space is split evenly around and between the items (`space-evenly`).
    SpaceEvenly,
}

/// Main axis of a flex container (`flex-direction`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum FlexDirection {
    /// Items flow left to right (`row`, the CSS default).
    #[default]
    Row,
    /// Items flow right to left (`row-reverse`).
    RowReverse,
    /// Items stack top to bottom (`column`).
    Column,
    /// Items stack bottom to top (`column-reverse`).
    ColumnReverse,
}

/// One track of `grid-template-columns` or `grid-template-rows`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum GridTrack {
    /// A content-sized track (`auto`, `min-content`, `max-content`).
    Auto,
    /// A share of the free space (`1fr`).
    Fraction(f32),
    /// A fixed width or height in points.
    Points(f32),
    /// A percentage of the container width or height.
    Percent(f32),
}

/// Cross-axis wrapping of a flex container (`flex-wrap`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum FlexWrap {
    /// All items stay on one line (`nowrap`, the CSS default).
    #[default]
    NoWrap,
    /// Items that do not fit move to the next cross-axis line (`wrap`).
    Wrap,
    /// Wrapped lines are stacked in reverse cross-axis order (`wrap-reverse`).
    WrapReverse,
}

/// The layout algorithm of a container, derived from `display`.
#[derive(Debug, Clone, PartialEq)]
pub enum ContainerKind {
    /// `display: flex` with its `flex-direction`.
    Flex {
        /// Main axis of the container.
        direction: FlexDirection,
    },
    /// `display: grid`; an empty track list behaves like one full-width column.
    Grid {
        /// Explicit column tracks of `grid-template-columns`.
        columns: Vec<GridTrack>,
    },
}

/// A width requested by a container item.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ItemWidth {
    /// A fixed width in points (`width: 220px`).
    Points(f32),
    /// A percentage of the container width (`width: 55%`).
    Percent(f32),
}

/// Content inset of a container item (`padding`), in points.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Padding {
    /// Inset from the left edge.
    pub left: f32,
    /// Inset from the right edge.
    pub right: f32,
    /// Inset from the top edge.
    pub top: f32,
    /// Inset from the bottom edge.
    pub bottom: f32,
}

/// Vertical and horizontal margins of a block or a flex/grid item, in points.
///
/// `None` means that the inline style did not specify this side. Block stacks use the implicit
/// spacing of the renderer for an unspecified bottom margin, while an explicit `0` suppresses it.
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Margins {
    /// `margin-top`.
    pub top: Option<f32>,
    /// `margin-right`.
    pub right: Option<f32>,
    /// `margin-bottom`.
    pub bottom: Option<f32>,
    /// `margin-left`.
    pub left: Option<f32>,
}

impl Margins {
    /// Resolved top margin, zero when unspecified.
    pub fn top(&self) -> f32 {
        self.top.unwrap_or(0.0)
    }

    /// Resolved right margin, zero when unspecified.
    pub fn right(&self) -> f32 {
        self.right.unwrap_or(0.0)
    }

    /// Resolved bottom margin, zero when unspecified.
    pub fn bottom(&self) -> f32 {
        self.bottom.unwrap_or(0.0)
    }

    /// Resolved left margin, zero when unspecified.
    pub fn left(&self) -> f32 {
        self.left.unwrap_or(0.0)
    }

    /// Sum of the horizontal margins.
    pub fn horizontal(&self) -> f32 {
        self.left() + self.right()
    }

    /// Sum of the vertical margins.
    pub fn vertical(&self) -> f32 {
        self.top() + self.bottom()
    }
}

/// A CSS flex or grid container.
#[derive(Debug, Clone, PartialEq)]
pub struct RichContainer {
    /// Layout algorithm and axis/tracks.
    pub kind: ContainerKind,
    /// `flex-wrap`; only the row axes wrap in this subset.
    pub wrap: FlexWrap,
    /// Definite content height from `height`, used by column wrapping and `fr` grid rows.
    pub height: Option<f32>,
    /// `grid-template-rows`; empty uses implicit `auto` rows.
    pub rows: Vec<GridTrack>,
    /// Height of implicit grid rows (`grid-auto-rows`), `auto` by default.
    pub auto_row: GridTrack,
    /// `justify-content`.
    pub justify: Justify,
    /// `align-items`.
    pub align: AlignItems,
    /// Space between columns (`column-gap`/`gap`).
    pub column_gap: f32,
    /// Space between rows (`row-gap`/`gap`).
    pub row_gap: f32,
    /// Margins of the container in the surrounding block flow.
    pub margins: Margins,
    /// Children in document order.
    pub items: Vec<RichItem>,
}

/// One child of a container; its blocks stack vertically inside the resolved slot.
#[derive(Debug, Clone, PartialEq)]
pub struct RichItem {
    /// Width from `width`, `flex-basis` or the `flex` shorthand.
    pub width: Option<ItemWidth>,
    /// `flex-grow` factor.
    pub grow: f32,
    /// Padding of the item.
    pub padding: Padding,
    /// Margins of the item; unlike block margins they never collapse with a sibling.
    pub margin: Margins,
    /// Content blocks of the item.
    pub blocks: Vec<RichBlock>,
}

/// A placed container item: horizontal slot and vertical offset inside its line.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct RichSlot {
    /// Index into [`RichContainer::items`].
    pub item: usize,
    /// Left edge in points, relative to the container.
    pub x: f32,
    /// Outer width in points, including the item padding.
    pub width: f32,
    /// Top offset in points inside the line, from `align-items`.
    pub y: f32,
    /// Measured item height in points, including the item padding.
    pub height: f32,
}

/// One line of items: a single flex row or one row of a grid.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct RichLayoutRow {
    /// Height of the tallest item in points.
    pub height: f32,
    /// Placed items of the line, in document order.
    pub slots: Vec<RichSlot>,
}

/// The resolved geometry of a container for a given content width.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct RichContainerLayout {
    /// Lines of items, top to bottom.
    pub rows: Vec<RichLayoutRow>,
}

/// Width of the DIN 5008 form B text column in points (165 mm).
///
/// The PDF draws into this column and the DOCX export uses the same width, so both can plan a
/// flex/grid container with the same geometry.
pub const DIN5008_TEXT_WIDTH_PT: f32 = 165.0 * 72.0 / 25.4;

/// One block of a rendered HTML document.
#[derive(Debug, Clone, PartialEq)]
pub enum RichBlock {
    /// A heading with a level of one or higher.
    Heading {
        /// Heading level, `1` is the largest.
        level: u8,
        /// Inline content.
        runs: Vec<TextRun>,
        /// Alignment.
        align: Align,
        /// Margins in the surrounding block flow.
        margins: Margins,
    },
    /// A body paragraph.
    Paragraph {
        /// Inline content.
        runs: Vec<TextRun>,
        /// Alignment.
        align: Align,
        /// Optional background colour.
        background: Option<[u8; 3]>,
        /// Margins in the surrounding block flow.
        margins: Margins,
    },
    /// A table with real rows and cells.
    Table(RichTable),
    /// A flex or grid container with resolved children.
    Container(RichContainer),
    /// An image source, kept for the PDF and preview. DOCX writes its alt text because the existing
    /// OOXML writer has no image relationship support yet.
    Image {
        /// Original `src` attribute.
        source: String,
        /// Preferred width in points, when the inline style supplied one.
        width_pt: Option<f32>,
        /// Margins in the surrounding block flow.
        margins: Margins,
    },
    /// An explicit page break.
    PageBreak,
    /// A horizontal rule.
    Rule {
        /// Margins in the surrounding block flow.
        margins: Margins,
    },
}

/// A parsed custom invoice body.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct RichDocument {
    /// Blocks in document order.
    pub blocks: Vec<RichBlock>,
}

impl RichDocument {
    /// Plain text with one line per block and one line per table row.
    pub fn plain_text(&self) -> String {
        let mut lines = Vec::new();
        for block in &self.blocks {
            match block {
                RichBlock::Heading { runs, .. } | RichBlock::Paragraph { runs, .. } => {
                    let text = runs.iter().map(|run| run.text.as_str()).collect::<String>();
                    if !text.trim().is_empty() {
                        lines.push(text.trim().to_string());
                    }
                }
                RichBlock::Table(table) => {
                    for row in &table.rows {
                        lines.push(
                            row.iter()
                                .map(TableCell::text)
                                .collect::<Vec<_>>()
                                .join("\t"),
                        );
                    }
                }
                RichBlock::Container(container) => {
                    for item in &container.items {
                        let text = blocks_plain_text(&item.blocks);
                        if !text.is_empty() {
                            lines.push(text);
                        }
                    }
                }
                RichBlock::Image { source, .. } => lines.push(source.clone()),
                RichBlock::PageBreak => lines.push("\u{0c}".to_string()),
                RichBlock::Rule { .. } => lines.push("---".to_string()),
            }
        }
        lines.join("\n")
    }
}

/// Plain text of a block stack, used by [`RichDocument::plain_text`] for nested containers.
fn blocks_plain_text(blocks: &[RichBlock]) -> String {
    RichDocument {
        blocks: blocks.to_vec(),
    }
    .plain_text()
}

const MM_TO_PT: f32 = 72.0 / 25.4;

/// Resolves the columns, gaps and row heights of `container` for a content width in points.
///
/// This is the single flex/grid solver of the port; the preview, the PDF writer and the DOCX
/// writer all place the items of a container with it. It follows the CSS defaults of the parsed
/// subset: a flex row starts at the main-axis start, items stretch across the line, and a grid
/// without explicit tracks is one column. An item without `width`/`flex-basis` uses its max-content
/// width, measured with the same Helvetica metrics as the PDF, and a `flex: 1` item starts at a
/// zero basis so the free space is shared by `flex-grow`.
pub fn layout_container(container: &RichContainer, width: f32) -> RichContainerLayout {
    let width = width.max(0.0);
    let grid = matches!(container.kind, ContainerKind::Grid { .. });
    let column_axis = matches!(
        container.kind,
        ContainerKind::Flex {
            direction: FlexDirection::Column | FlexDirection::ColumnReverse
        }
    );
    let mut layout = match &container.kind {
        ContainerKind::Flex {
            direction: FlexDirection::Row | FlexDirection::RowReverse,
        } => RichContainerLayout {
            rows: flex_rows(container, width),
        },
        ContainerKind::Flex {
            direction: FlexDirection::Column | FlexDirection::ColumnReverse,
        } => RichContainerLayout {
            rows: column_rows(container, width),
        },
        ContainerKind::Grid { .. } => RichContainerLayout {
            rows: grid_rows(container, width),
        },
    };
    if matches!(
        container.kind,
        ContainerKind::Flex {
            direction: FlexDirection::RowReverse
        }
    ) {
        for row in &mut layout.rows {
            for slot in &mut row.slots {
                slot.x = width - slot.x - slot.width;
            }
            row.slots.reverse();
        }
    }
    if matches!(
        container.kind,
        ContainerKind::Flex {
            direction: FlexDirection::ColumnReverse
        }
    ) {
        layout.rows.reverse();
    }
    if matches!(
        container.kind,
        ContainerKind::Flex {
            direction: FlexDirection::Row | FlexDirection::RowReverse
        }
    ) && container.wrap == FlexWrap::WrapReverse
    {
        layout.rows.reverse();
    }
    for row in &mut layout.rows {
        let border_heights = row
            .slots
            .iter()
            .map(|slot| item_height(container, slot.item, slot.width))
            .collect::<Vec<_>>();
        let outer_heights = row
            .slots
            .iter()
            .zip(&border_heights)
            .map(|(slot, border)| {
                let margin = container
                    .items
                    .get(slot.item)
                    .map(|item| item.margin)
                    .unwrap_or_default();
                border + margin.vertical()
            })
            .collect::<Vec<_>>();
        if !grid {
            row.height = outer_heights.iter().copied().fold(0.0, f32::max);
        }
        for ((slot, border_height), outer_height) in
            row.slots.iter_mut().zip(border_heights).zip(outer_heights)
        {
            let margin = container
                .items
                .get(slot.item)
                .map(|item| item.margin)
                .unwrap_or_default();
            slot.height = border_height;
            slot.y = if column_axis {
                margin.top()
            } else {
                match container.align {
                    AlignItems::Stretch | AlignItems::Start => margin.top(),
                    AlignItems::Center => (row.height - outer_height) / 2.0 + margin.top(),
                    AlignItems::End => row.height - border_height - margin.bottom(),
                }
            };
        }
    }
    layout
}

/// Places the flex items on as many lines as their hypothetical outer widths require.
fn flex_rows(container: &RichContainer, width: f32) -> Vec<RichLayoutRow> {
    let items = &container.items;
    if items.is_empty() {
        return Vec::new();
    }
    if container.wrap == FlexWrap::NoWrap {
        return vec![flex_line(
            container,
            width,
            &(0..items.len()).collect::<Vec<_>>(),
        )];
    }
    let mut lines: Vec<Vec<usize>> = Vec::new();
    let mut line: Vec<usize> = Vec::new();
    let mut used = 0.0;
    for (index, item) in items.iter().enumerate() {
        let outer = base_width(item, width) + item.margin.horizontal();
        let gap = if line.is_empty() {
            0.0
        } else {
            container.column_gap
        };
        if !line.is_empty() && used + gap + outer > width + 0.001 {
            lines.push(std::mem::take(&mut line));
            used = 0.0;
        }
        if !line.is_empty() {
            used += container.column_gap;
        }
        used += outer;
        line.push(index);
    }
    if !line.is_empty() {
        lines.push(line);
    }
    lines
        .into_iter()
        .map(|line| flex_line(container, width, &line))
        .collect()
}

/// Places one flex line, including `justify-content`, item margins and the gaps.
fn flex_line(container: &RichContainer, width: f32, line: &[usize]) -> RichLayoutRow {
    if line.is_empty() {
        return RichLayoutRow::default();
    }
    let gap_count = line.len().saturating_sub(1);
    let gaps = container.column_gap * gap_count as f32;
    let available = (width - gaps).max(0.0);
    let mut borders = line
        .iter()
        .map(|&index| base_width(&container.items[index], width))
        .collect::<Vec<_>>();
    let margins = line
        .iter()
        .map(|&index| container.items[index].margin.horizontal())
        .sum::<f32>();
    let border_total = borders.iter().sum::<f32>();
    let available_border = (available - margins).max(0.0);
    let grow = line
        .iter()
        .map(|&index| container.items[index].grow.max(0.0))
        .sum::<f32>();
    if border_total > available_border {
        // CSS shrinks every item in proportion to its base width when the line overflows. Margins
        // are fixed and therefore reduce the space available to the flex bases.
        let factor = if border_total > 0.0 {
            available_border / border_total
        } else {
            0.0
        };
        for width in &mut borders {
            *width *= factor;
        }
    } else if grow > 0.0 {
        let free = available_border - border_total;
        for (width, &index) in borders.iter_mut().zip(line) {
            *width += free * container.items[index].grow.max(0.0) / grow;
        }
    }
    let free = (width - borders.iter().sum::<f32>() - margins - gaps).max(0.0);
    let (mut x, gap) = match container.justify {
        Justify::Start => (0.0, container.column_gap),
        Justify::End => (free, container.column_gap),
        Justify::Center => (free / 2.0, container.column_gap),
        Justify::SpaceBetween if line.len() > 1 => {
            (0.0, container.column_gap + free / gap_count as f32)
        }
        Justify::SpaceBetween => (0.0, container.column_gap),
        Justify::SpaceAround => {
            let extra = free / line.len() as f32;
            (extra / 2.0, container.column_gap + extra)
        }
        Justify::SpaceEvenly => {
            let extra = free / (line.len() + 1) as f32;
            (extra, container.column_gap + extra)
        }
    };
    let mut slots = Vec::with_capacity(line.len());
    for (position, (&index, &border)) in line.iter().zip(&borders).enumerate() {
        if position > 0 {
            x += gap;
        }
        let item = &container.items[index];
        x += item.margin.left();
        slots.push(RichSlot {
            item: index,
            x,
            width: border,
            y: 0.0,
            height: 0.0,
        });
        x += border + item.margin.right();
    }
    RichLayoutRow { height: 0.0, slots }
}

/// Stacks the items of a column flex container and aligns them on the cross (horizontal) axis.
fn column_rows(container: &RichContainer, width: f32) -> Vec<RichLayoutRow> {
    container
        .items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let horizontal = item.margin.horizontal();
            let available = (width - horizontal).max(0.0);
            let border = match item.width {
                Some(ItemWidth::Points(points)) => points.max(0.0).min(available),
                Some(ItemWidth::Percent(percent)) => available * (percent / 100.0).clamp(0.0, 1.0),
                None => match container.align {
                    AlignItems::Stretch => available,
                    _ => (intrinsic_width(&item.blocks) + item.padding.left + item.padding.right)
                        .min(available),
                },
            };
            let outer = border + horizontal;
            let free = (width - outer).max(0.0);
            let x = match container.align {
                AlignItems::Stretch | AlignItems::Start => item.margin.left(),
                AlignItems::Center => free / 2.0 + item.margin.left(),
                AlignItems::End => width - item.margin.right() - border,
            };
            RichLayoutRow {
                height: 0.0,
                slots: vec![RichSlot {
                    item: index,
                    x,
                    width: border,
                    y: 0.0,
                    height: 0.0,
                }],
            }
        })
        .collect()
}

/// Places the items of a grid in row-major order on the resolved tracks.
fn grid_rows(container: &RichContainer, width: f32) -> Vec<RichLayoutRow> {
    let columns = match &container.kind {
        ContainerKind::Grid { columns } if !columns.is_empty() => columns.clone(),
        _ => vec![GridTrack::Fraction(1.0)],
    };
    let column_count = columns.len();
    let item_row_count = container.items.len().div_ceil(column_count);
    let row_count = item_row_count.max(container.rows.len());
    if row_count == 0 {
        return Vec::new();
    }
    let positions = grid_column_positions(container, width, &columns);
    let rows = (0..row_count)
        .map(|index| {
            container
                .rows
                .get(index)
                .copied()
                .unwrap_or(container.auto_row)
        })
        .collect::<Vec<_>>();
    let mut result = Vec::with_capacity(row_count);
    let mut auto_heights = Vec::with_capacity(row_count);
    for (row_index, _) in rows.iter().enumerate() {
        let mut slots = Vec::new();
        for (column, &(track_x, track_width)) in positions.iter().enumerate() {
            let item_index = row_index * column_count + column;
            let Some(item) = container.items.get(item_index) else {
                break;
            };
            let margin = item.margin;
            let slot_width = (track_width - margin.horizontal()).max(0.0);
            slots.push(RichSlot {
                item: item_index,
                x: track_x + margin.left(),
                width: slot_width,
                y: 0.0,
                height: 0.0,
            });
        }
        let auto = slots
            .iter()
            .map(|slot| {
                let margin = container.items[slot.item].margin.vertical();
                item_height(container, slot.item, slot.width) + margin
            })
            .fold(0.0, f32::max);
        auto_heights.push(auto);
        result.push(RichLayoutRow {
            height: auto,
            slots,
        });
    }
    // A definite container height turns `fr` rows into shares of the remaining space. Without a
    // definite height the CSS initial value makes them content-sized, like `auto`.
    let gaps = container.row_gap * row_count.saturating_sub(1) as f32;
    let fixed = rows
        .iter()
        .enumerate()
        .map(|(index, track)| match track {
            GridTrack::Points(points) => points.max(0.0),
            GridTrack::Percent(percent) => container
                .height
                .map(|height| height * (percent / 100.0).clamp(0.0, 1.0))
                .unwrap_or(auto_heights[index]),
            GridTrack::Auto => auto_heights[index],
            GridTrack::Fraction(_) => 0.0,
        })
        .sum::<f32>();
    let fractions = rows
        .iter()
        .map(|track| match track {
            GridTrack::Fraction(fraction) => fraction.max(0.0),
            _ => 0.0,
        })
        .sum::<f32>();
    let free = container
        .height
        .map(|height| (height - gaps - fixed).max(0.0))
        .unwrap_or(0.0);
    let unit = if fractions > 0.0 {
        free / fractions
    } else {
        0.0
    };
    for (row, track) in result.iter_mut().zip(rows) {
        row.height = match track {
            GridTrack::Points(points) => points.max(0.0),
            GridTrack::Percent(percent) => container
                .height
                .map(|height| height * (percent / 100.0).clamp(0.0, 1.0))
                .unwrap_or(row.height),
            GridTrack::Auto => row.height,
            GridTrack::Fraction(fraction) => (unit * fraction.max(0.0)).max(row.height),
        };
    }
    result
}

/// Resolves the column tracks of a grid, including content-sized `auto` tracks.
fn grid_column_positions(
    container: &RichContainer,
    width: f32,
    tracks: &[GridTrack],
) -> Vec<(f32, f32)> {
    let gaps = container.column_gap * tracks.len().saturating_sub(1) as f32;
    let available = (width - gaps).max(0.0);
    let mut widths = tracks
        .iter()
        .enumerate()
        .map(|(index, track)| match track {
            GridTrack::Points(points) => points.max(0.0),
            GridTrack::Percent(percent) => available * (percent / 100.0).clamp(0.0, 1.0),
            GridTrack::Auto => container
                .items
                .iter()
                .skip(index)
                .step_by(tracks.len())
                .map(|item| base_width(item, available) + item.margin.horizontal())
                .fold(0.0, f32::max),
            GridTrack::Fraction(_) => 0.0,
        })
        .collect::<Vec<_>>();
    let fixed = widths.iter().sum::<f32>();
    let fractions = tracks
        .iter()
        .map(|track| match track {
            GridTrack::Fraction(fraction) => fraction.max(0.0),
            _ => 0.0,
        })
        .sum::<f32>();
    let unit = if fractions > 0.0 {
        (available - fixed).max(0.0) / fractions
    } else {
        0.0
    };
    for (width, track) in widths.iter_mut().zip(tracks) {
        if let GridTrack::Fraction(fraction) = track {
            *width = unit * fraction.max(0.0);
        }
    }
    let mut positions = Vec::with_capacity(tracks.len());
    let mut x = 0.0;
    for (index, width) in widths.into_iter().enumerate() {
        if index > 0 {
            x += container.column_gap;
        }
        positions.push((x, width));
        x += width;
    }
    positions
}

/// Border-box width of an item before flex-grow and shrink are applied.
fn base_width(item: &RichItem, container_width: f32) -> f32 {
    match item.width {
        Some(ItemWidth::Points(points)) => points.max(0.0),
        Some(ItemWidth::Percent(percent)) => container_width * (percent / 100.0).clamp(0.0, 1.0),
        None => (intrinsic_width(&item.blocks) + item.padding.left + item.padding.right)
            .min(container_width),
    }
}

/// Border-box height of an item: content plus padding, excluding its margins.
fn item_height(container: &RichContainer, index: usize, width: f32) -> f32 {
    let Some(item) = container.items.get(index) else {
        return 0.0;
    };
    let content = (width - item.padding.left - item.padding.right).max(0.0);
    measure_blocks(&item.blocks, content) + item.padding.top + item.padding.bottom
}

/// Margins explicitly set on a block, or the defaults of its variant.
///
/// The inline `margin-top`/`margin-bottom` declarations of the TS templates land here. A margin
/// that was not set is `None`, so the renderer can keep its existing implicit paragraph spacing.
pub fn block_margins(block: &RichBlock) -> Margins {
    match block {
        RichBlock::Heading { margins, .. } | RichBlock::Paragraph { margins, .. } => *margins,
        RichBlock::Table(table) => table.margins,
        RichBlock::Container(container) => container.margins,
        RichBlock::Image { margins, .. } | RichBlock::Rule { margins } => *margins,
        RichBlock::PageBreak => Margins::default(),
    }
}

/// Implicit spacing after a block when no `margin-bottom` was specified.
///
/// These are the values the PDF writer used before explicit margins existed; keeping them here
/// makes measurement, preview and export agree.
pub fn default_block_gap(block: &RichBlock) -> f32 {
    match block {
        RichBlock::Heading { .. } => 1.5,
        RichBlock::Paragraph { .. } => 1.8,
        RichBlock::Table(_) => 2.0,
        RichBlock::Image { .. } => 3.0,
        RichBlock::Rule { .. } => 4.0,
        RichBlock::Container(_) | RichBlock::PageBreak => 0.0,
    }
}

/// Content height of one block, excluding its margins.
fn block_content_height(block: &RichBlock, width: f32) -> f32 {
    match block {
        RichBlock::Heading { runs, .. } => runs_height(runs, width, true),
        RichBlock::Paragraph { runs, .. } => runs_height(runs, width, false),
        RichBlock::Table(table) => table_height(table, width),
        RichBlock::Container(container) => {
            let layout = layout_container(container, width);
            let gaps = container.row_gap * layout.rows.len().saturating_sub(1) as f32;
            layout.rows.iter().map(|row| row.height).sum::<f32>() + gaps
        }
        // Images are rare inside a container; this estimate only feeds the row height.
        RichBlock::Image { width_pt, .. } => {
            let image_width = width_pt.map(|value| value.min(width)).unwrap_or(width);
            image_width * 0.75
        }
        RichBlock::PageBreak => 0.0,
        RichBlock::Rule { .. } => 0.0,
    }
}

/// Height in points a stack of blocks needs at `width` points.
///
/// Adjacent vertical margins collapse to the larger value, as they do in a normal CSS block
/// formatting context. The implicit bottom spacing of a variant participates in that collapse, so
/// an explicit `margin-bottom: 0` can remove it. The values mirror the drawing code of the PDF
/// writer (line heights, table row heights and block spacing), so a container row is as tall as the
/// content the export paints into it.
pub fn measure_blocks(blocks: &[RichBlock], width: f32) -> f32 {
    let width = width.max(0.0);
    let mut height = 0.0;
    let mut previous_bottom: Option<f32> = None;
    for block in blocks {
        let margins = block_margins(block);
        let before = previous_bottom.map_or(margins.top(), |bottom| bottom.max(margins.top()));
        height += before;
        height += block_content_height(block, width);
        previous_bottom = Some(margins.bottom.unwrap_or_else(|| default_block_gap(block)));
    }
    height + previous_bottom.unwrap_or(0.0)
}

fn runs_height(runs: &[TextRun], width: f32, bold: bool) -> f32 {
    layout_runs(runs, width, bold)
        .iter()
        .map(|line| line_height(line))
        .sum()
}

fn table_height(table: &RichTable, width: f32) -> f32 {
    let columns = table.rows.iter().map(Vec::len).max().unwrap_or(0);
    if columns == 0 {
        return 0.0;
    }
    let column_width = width / columns as f32;
    let mut height = 0.0;
    for (row_index, row) in table.rows.iter().enumerate() {
        let mut row_height: f32 = 5.0;
        for cell in row {
            let lines = layout_runs(
                &cell.runs,
                (column_width - 3.0 * MM_TO_PT).max(0.0),
                cell.header,
            );
            let cell_height = lines
                .iter()
                .map(|line| line_height(line).max(3.6))
                .sum::<f32>()
                + 2.4;
            row_height = row_height.max(cell_height);
        }
        height += row_height;
        if row_index == 0 {
            height += 0.5;
        }
    }
    height
}

/// Max-content width of a block stack in points, used to size items without an explicit width.
pub fn intrinsic_width(blocks: &[RichBlock]) -> f32 {
    blocks
        .iter()
        .map(|block| match block {
            RichBlock::Heading { runs, .. } | RichBlock::Paragraph { runs, .. } => runs_width(runs),
            RichBlock::Table(table) => table_intrinsic_width(table),
            RichBlock::Container(container) => container_intrinsic_width(container),
            RichBlock::Image { width_pt, .. } => width_pt.unwrap_or(0.0),
            RichBlock::PageBreak | RichBlock::Rule { .. } => 0.0,
        })
        .fold(0.0, f32::max)
}

fn container_intrinsic_width(container: &RichContainer) -> f32 {
    let item_width = |item: &RichItem| {
        intrinsic_width(&item.blocks)
            + item.padding.left
            + item.padding.right
            + item.margin.horizontal()
    };
    match &container.kind {
        ContainerKind::Flex {
            direction: FlexDirection::Column | FlexDirection::ColumnReverse,
        } => container.items.iter().map(item_width).fold(0.0, f32::max),
        ContainerKind::Flex { .. } => {
            container.items.iter().map(item_width).sum::<f32>()
                + container.column_gap * container.items.len().saturating_sub(1) as f32
        }
        ContainerKind::Grid { columns } => {
            let count = columns.len().max(1);
            let gaps = container.column_gap * count.saturating_sub(1) as f32;
            let fixed = columns
                .iter()
                .map(|track| match track {
                    GridTrack::Points(points) => points.max(0.0),
                    GridTrack::Auto | GridTrack::Fraction(_) | GridTrack::Percent(_) => 0.0,
                })
                .sum::<f32>();
            let flexible = columns
                .iter()
                .filter(|track| !matches!(track, GridTrack::Points(_)))
                .count();
            let largest = container.items.iter().map(item_width).fold(0.0, f32::max);
            fixed + largest * flexible as f32 + gaps
        }
    }
}

fn table_intrinsic_width(table: &RichTable) -> f32 {
    let columns = table.rows.iter().map(Vec::len).max().unwrap_or(0);
    let mut widths = vec![0.0f32; columns];
    for row in &table.rows {
        for (column, cell) in row.iter().enumerate() {
            widths[column] = widths[column].max(runs_width(&cell.runs) + 3.0 * MM_TO_PT);
        }
    }
    widths.iter().sum()
}

fn runs_width(runs: &[TextRun]) -> f32 {
    let mut widest = 0.0f32;
    let mut current = 0.0f32;
    for run in runs {
        for (index, part) in run.text.split('\n').enumerate() {
            if index > 0 {
                widest = widest.max(current);
                current = 0.0;
            }
            current += text_width(part, f64::from(run.size_pt)) as f32;
        }
    }
    widest.max(current)
}

/// Breaks runs into lines that fit `max_width`, the shared line breaker of preview and exports.
pub fn layout_runs(runs: &[TextRun], max_width: f32, bold: bool) -> Vec<Vec<TextRun>> {
    let mut lines: Vec<Vec<TextRun>> = Vec::new();
    let mut line: Vec<TextRun> = Vec::new();
    let mut line_width = 0.0;
    let push_line = |line: &mut Vec<TextRun>, lines: &mut Vec<Vec<TextRun>>| {
        if !line.is_empty() {
            lines.push(std::mem::take(line));
        }
    };
    for run in runs {
        for (index, part) in run.text.split('\n').enumerate() {
            if index > 0 {
                push_line(&mut line, &mut lines);
                line_width = 0.0;
            }
            for word in part.split_whitespace() {
                let mut styled = run.clone();
                styled.text = word.to_string();
                let word_width = run_width(&styled);
                let needed = if line.is_empty() {
                    word_width
                } else {
                    word_width + run_width(&space_run(run))
                };
                if !line.is_empty() && line_width + needed > max_width {
                    push_line(&mut line, &mut lines);
                    line_width = 0.0;
                }
                if !line.is_empty() {
                    let space = space_run(run);
                    line_width += run_width(&space);
                    line.push(space);
                }
                line_width += word_width;
                line.push(styled);
            }
        }
    }
    push_line(&mut line, &mut lines);
    if bold || !lines.is_empty() {
        return lines;
    }
    Vec::new()
}

fn space_run(run: &TextRun) -> TextRun {
    let mut space = run.clone();
    space.text = " ".to_string();
    space
}

/// Width of one run in points at its font size.
pub fn run_width(run: &TextRun) -> f32 {
    text_width(&run.text, f64::from(run.size_pt)) as f32
}

/// Height of one laid-out line in points, the value the PDF writer advances by.
pub fn line_height(line: &[TextRun]) -> f32 {
    line.iter()
        .map(|run| run.size_pt * 0.3528 * 1.3)
        .fold(4.2, f32::max)
}

#[derive(Debug, Clone, Default)]
struct Element {
    tag: String,
    attrs: BTreeMap<String, String>,
    children: Vec<Node>,
}

#[derive(Debug, Clone)]
enum Node {
    Text(String),
    Element(Element),
}

/// Parses the supported HTML subset into the shared document model.
pub fn parse(html: &str) -> RichDocument {
    let nodes = parse_nodes(html);
    let mut document = RichDocument::default();
    let mut pending = Pending::default();
    walk(&nodes, Style::default(), &mut document, &mut pending);
    pending.flush(&mut document);
    prune(&mut document.blocks);
    document
}

/// Drops blocks that render nothing, including containers whose items are all empty.
fn prune(blocks: &mut Vec<RichBlock>) {
    blocks.retain_mut(|block| match block {
        RichBlock::Paragraph { runs, .. } | RichBlock::Heading { runs, .. } => {
            runs.iter().any(|run| !run.text.trim().is_empty())
        }
        RichBlock::Container(container) => {
            for item in &mut container.items {
                prune(&mut item.blocks);
            }
            container.items.retain(|item| !item.blocks.is_empty());
            !container.items.is_empty()
        }
        _ => true,
    });
}

#[derive(Debug, Clone, Copy)]
struct Style {
    bold: bool,
    italic: bool,
    underline: bool,
    color: Option<[u8; 3]>,
    size_pt: f32,
    align: Align,
}

impl Default for Style {
    fn default() -> Self {
        Style {
            bold: false,
            italic: false,
            underline: false,
            color: None,
            size_pt: 10.0,
            align: Align::Left,
        }
    }
}

#[derive(Debug, Default)]
struct Pending {
    runs: Vec<TextRun>,
    align: Align,
    heading: Option<u8>,
    background: Option<[u8; 3]>,
    margins: Margins,
    style: Style,
}

impl Pending {
    fn push_text(&mut self, text: &str, style: Style) {
        let collapsed = text.split_whitespace().collect::<Vec<_>>().join(" ");
        if collapsed.is_empty() {
            return;
        }
        if self
            .runs
            .last()
            .is_some_and(|last| !last.text.ends_with([' ', '\n']))
        {
            self.runs.push(TextRun {
                text: " ".to_string(),
                bold: last_style(&self.runs).bold,
                italic: last_style(&self.runs).italic,
                underline: last_style(&self.runs).underline,
                color: last_style(&self.runs).color,
                size_pt: last_style(&self.runs).size_pt,
            });
        }
        self.runs.push(TextRun {
            text: collapsed,
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            color: style.color,
            size_pt: style.size_pt,
        });
        self.align = style.align;
        self.style = style;
    }

    fn line_break(&mut self, style: Style) {
        self.runs.push(TextRun {
            text: "\n".to_string(),
            bold: style.bold,
            italic: style.italic,
            underline: style.underline,
            color: style.color,
            size_pt: style.size_pt,
        });
    }

    fn flush(&mut self, document: &mut RichDocument) {
        if self.runs.is_empty() {
            self.heading = None;
            self.background = None;
            self.margins = Margins::default();
            return;
        }
        let runs = std::mem::take(&mut self.runs);
        let margins = std::mem::take(&mut self.margins);
        if let Some(level) = self.heading.take() {
            document.blocks.push(RichBlock::Heading {
                level,
                runs,
                align: self.align,
                margins,
            });
        } else {
            document.blocks.push(RichBlock::Paragraph {
                runs,
                align: self.align,
                background: self.background.take(),
                margins,
            });
        }
    }
}

fn last_style(runs: &[TextRun]) -> Style {
    runs.last().map_or_else(Style::default, |run| Style {
        bold: run.bold,
        italic: run.italic,
        underline: run.underline,
        color: run.color,
        size_pt: run.size_pt,
        align: Align::Left,
    })
}

fn walk(nodes: &[Node], style: Style, document: &mut RichDocument, pending: &mut Pending) {
    for node in nodes {
        match node {
            Node::Text(text) => pending.push_text(text, style),
            Node::Element(element) => walk_element(element, style, document, pending),
        }
    }
}

fn walk_element(
    element: &Element,
    style: Style,
    document: &mut RichDocument,
    pending: &mut Pending,
) {
    let tag = element.tag.as_str();
    if matches!(tag, "style" | "script" | "head" | "meta" | "link") {
        return;
    }
    if declaration(&element.attrs, "display").is_some_and(|value| normalize(value) == "none") {
        return;
    }
    if is_page_break(element) {
        pending.flush(document);
        document.blocks.push(RichBlock::PageBreak);
        return;
    }
    match tag {
        "br" => pending.line_break(style),
        "hr" => {
            pending.flush(document);
            document.blocks.push(RichBlock::Rule {
                margins: parse_margins(&element.attrs),
            });
        }
        "img" => {
            pending.flush(document);
            let source = element.attrs.get("src").cloned().unwrap_or_default();
            if !source.trim().is_empty() {
                document.blocks.push(RichBlock::Image {
                    source,
                    width_pt: element
                        .attrs
                        .get("width")
                        .and_then(|value| value.trim_end_matches("px").parse::<f32>().ok()),
                    margins: parse_margins(&element.attrs),
                });
            }
        }
        "table" => {
            pending.flush(document);
            document
                .blocks
                .push(RichBlock::Table(parse_table(element, style)));
        }
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
            pending.flush(document);
            let start = document.blocks.len();
            let level = tag[1..].parse::<u8>().unwrap_or(1);
            let heading_style = Style {
                bold: true,
                size_pt: heading_size(level),
                ..apply_style(style, &element.attrs)
            };
            pending.heading = Some(level);
            pending.align = heading_style.align;
            walk(&element.children, heading_style, document, pending);
            pending.flush(document);
            apply_scope_margins(&mut document.blocks[start..], parse_margins(&element.attrs));
        }
        "p" | "div" | "section" | "header" | "footer" | "article" | "main" | "li" | "ul" | "ol" => {
            if let Some(kind) = container_kind(&element.attrs) {
                pending.flush(document);
                let container = parse_container(element, style, kind);
                if !container.items.is_empty() {
                    document.blocks.push(RichBlock::Container(container));
                }
                return;
            }
            pending.flush(document);
            let start = document.blocks.len();
            let block_style = apply_style(style, &element.attrs);
            if tag == "li" {
                pending.push_text("• ", block_style);
            }
            pending.background = background_color(&element.attrs);
            pending.align = block_style.align;
            walk(&element.children, block_style, document, pending);
            pending.flush(document);
            apply_scope_margins(&mut document.blocks[start..], parse_margins(&element.attrs));
        }
        _ => {
            let mut inline_style = apply_style(style, &element.attrs);
            if matches!(tag, "b" | "strong") {
                inline_style.bold = true;
            }
            if matches!(tag, "i" | "em") {
                inline_style.italic = true;
            }
            if tag == "u" {
                inline_style.underline = true;
            }
            walk(&element.children, inline_style, document, pending);
        }
    }
}

fn parse_container(element: &Element, style: Style, kind: ContainerKind) -> RichContainer {
    let inherited = apply_style(style, &element.attrs);
    let mut container = RichContainer {
        kind,
        wrap: FlexWrap::default(),
        height: None,
        rows: Vec::new(),
        auto_row: GridTrack::Auto,
        justify: Justify::default(),
        align: AlignItems::default(),
        column_gap: 0.0,
        row_gap: 0.0,
        margins: parse_margins(&element.attrs),
        items: Vec::new(),
    };
    apply_container_style(&mut container, &element.attrs);
    for node in &element.children {
        match node {
            Node::Text(text) if text.trim().is_empty() => {}
            Node::Element(child) => container.items.push(parse_item(child, inherited)),
            Node::Text(_) => container.items.push(parse_anonymous_item(node, inherited)),
        }
    }
    container
}

fn parse_item(element: &Element, style: Style) -> RichItem {
    let mut document = RichDocument::default();
    let mut pending = Pending::default();
    walk_element(element, style, &mut document, &mut pending);
    pending.flush(&mut document);
    prune(&mut document.blocks);
    RichItem {
        width: item_width(&element.attrs),
        grow: item_grow(&element.attrs),
        padding: item_padding(&element.attrs),
        margin: parse_margins(&element.attrs),
        blocks: document.blocks,
    }
}

/// A direct text node of a container is an anonymous flex item, as in the browser.
fn parse_anonymous_item(node: &Node, style: Style) -> RichItem {
    let mut document = RichDocument::default();
    let mut pending = Pending::default();
    walk(
        std::slice::from_ref(node),
        style,
        &mut document,
        &mut pending,
    );
    pending.flush(&mut document);
    prune(&mut document.blocks);
    RichItem {
        width: None,
        grow: 0.0,
        padding: Padding::default(),
        margin: Margins::default(),
        blocks: document.blocks,
    }
}

fn container_kind(attrs: &BTreeMap<String, String>) -> Option<ContainerKind> {
    let display = normalize(declaration(attrs, "display")?);
    match display.as_str() {
        "flex" | "inline-flex" => Some(ContainerKind::Flex {
            direction: match declaration(attrs, "flex-direction")
                .map(normalize)
                .as_deref()
            {
                Some("row-reverse") => FlexDirection::RowReverse,
                Some("column") => FlexDirection::Column,
                Some("column-reverse") => FlexDirection::ColumnReverse,
                _ => FlexDirection::Row,
            },
        }),
        "grid" | "inline-grid" => Some(ContainerKind::Grid {
            columns: declaration(attrs, "grid-template-columns")
                .map(parse_grid_tracks)
                .unwrap_or_default(),
        }),
        _ => None,
    }
}

fn apply_container_style(container: &mut RichContainer, attrs: &BTreeMap<String, String>) {
    if let Some(value) = declaration(attrs, "justify-content") {
        container.justify = match normalize(value).as_str() {
            "flex-end" | "end" | "right" => Justify::End,
            "center" => Justify::Center,
            "space-between" => Justify::SpaceBetween,
            "space-around" => Justify::SpaceAround,
            "space-evenly" => Justify::SpaceEvenly,
            _ => Justify::Start,
        };
    }
    if let Some(value) = declaration(attrs, "align-items") {
        container.align = match normalize(value).as_str() {
            "flex-start" | "start" | "baseline" => AlignItems::Start,
            "center" => AlignItems::Center,
            "flex-end" | "end" => AlignItems::End,
            _ => AlignItems::Stretch,
        };
    }
    let wrap = declaration(attrs, "flex-wrap").map(normalize).or_else(|| {
        declaration(attrs, "flex-flow").and_then(|value| {
            normalize(value)
                .split_whitespace()
                .find(|token| matches!(*token, "wrap" | "nowrap" | "wrap-reverse"))
                .map(str::to_string)
        })
    });
    if let Some(value) = wrap {
        container.wrap = match value.as_str() {
            "wrap" => FlexWrap::Wrap,
            "wrap-reverse" => FlexWrap::WrapReverse,
            _ => FlexWrap::NoWrap,
        };
    }
    if let Some(value) = declaration(attrs, "height").and_then(parse_length_pt) {
        container.height = Some(value.max(0.0));
    }
    if matches!(container.kind, ContainerKind::Grid { .. }) {
        if let Some(value) = declaration(attrs, "grid-template-rows") {
            container.rows = parse_grid_tracks(value);
        }
        if let Some(value) = declaration(attrs, "grid-auto-rows") {
            container.auto_row = parse_grid_tracks(value)
                .into_iter()
                .next()
                .unwrap_or(GridTrack::Auto);
        }
    }
    if let Some(value) = declaration(attrs, "gap") {
        let parts = value
            .split_whitespace()
            .filter_map(parse_length_pt)
            .collect::<Vec<_>>();
        if let Some(row) = parts.first() {
            container.row_gap = row.max(0.0);
        }
        container.column_gap = parts.get(1).copied().unwrap_or(container.row_gap).max(0.0);
    }
    if let Some(value) = declaration(attrs, "row-gap").and_then(parse_length_pt) {
        container.row_gap = value.max(0.0);
    }
    if let Some(value) = declaration(attrs, "column-gap").and_then(parse_length_pt) {
        container.column_gap = value.max(0.0);
    }
}

/// Expands `repeat()` and parses the column tracks of `grid-template-columns`.
fn parse_grid_tracks(value: &str) -> Vec<GridTrack> {
    let mut expanded = normalize(value);
    while let Some(start) = expanded.find("repeat(") {
        let Some(relative_end) = expanded[start..].find(')') else {
            break;
        };
        let end = start + relative_end;
        let inner = &expanded[start + "repeat(".len()..end];
        let Some((count, tracks)) = inner.split_once(',') else {
            break;
        };
        let count = count.trim().parse::<usize>().unwrap_or(0);
        let replacement = std::iter::repeat(tracks.trim())
            .take(count)
            .collect::<Vec<_>>()
            .join(" ");
        expanded.replace_range(start..=end, &replacement);
    }
    if expanded.trim().is_empty() || expanded.trim() == "none" {
        return Vec::new();
    }
    expanded.split_whitespace().map(parse_grid_track).collect()
}

fn parse_grid_track(token: &str) -> GridTrack {
    let token = token.trim();
    if let Some(inner) = token
        .strip_prefix("minmax(")
        .and_then(|value| value.strip_suffix(')'))
    {
        if let Some((_, maximum)) = inner.split_once(',') {
            return parse_grid_track(maximum);
        }
    }
    if let Some(fraction) = token.strip_suffix("fr") {
        GridTrack::Fraction(fraction.trim().parse::<f32>().unwrap_or(1.0).max(0.0))
    } else if let Some(percent) = token.strip_suffix('%') {
        GridTrack::Percent(percent.trim().parse::<f32>().unwrap_or(100.0))
    } else if let Some(points) = parse_length_pt(token) {
        GridTrack::Points(points.max(0.0))
    } else {
        GridTrack::Auto
    }
}

/// The basis of an item: `flex-basis` wins over `width`, and the `flex` shorthand sets the basis.
fn item_width(attrs: &BTreeMap<String, String>) -> Option<ItemWidth> {
    if let Some(value) = declaration(attrs, "flex-basis").and_then(parse_item_width) {
        return Some(value);
    }
    if let Some(value) = declaration(attrs, "flex") {
        let parts = value.split_whitespace().collect::<Vec<_>>();
        if parts.len() == 1 && parts[0].parse::<f32>().is_ok() {
            // `flex: <grow>` is `flex: <grow> 1 0%`.
            return Some(ItemWidth::Points(0.0));
        }
        if let Some(basis) = parts.get(2).and_then(|basis| parse_item_width(basis)) {
            return Some(basis);
        }
    }
    declaration(attrs, "width").and_then(parse_item_width)
}

fn parse_item_width(value: &str) -> Option<ItemWidth> {
    let value = normalize(value);
    if let Some(percent) = value.strip_suffix('%') {
        return percent
            .trim()
            .parse::<f32>()
            .ok()
            .map(|percent| ItemWidth::Percent(percent.max(0.0)));
    }
    parse_length_pt(&value).map(|points| ItemWidth::Points(points.max(0.0)))
}

fn item_grow(attrs: &BTreeMap<String, String>) -> f32 {
    if let Some(value) = declaration(attrs, "flex-grow") {
        return normalize(value).parse::<f32>().unwrap_or(0.0).max(0.0);
    }
    if let Some(value) = declaration(attrs, "flex") {
        let first = value.split_whitespace().next().unwrap_or_default();
        return first.parse::<f32>().unwrap_or(0.0).max(0.0);
    }
    0.0
}

fn item_padding(attrs: &BTreeMap<String, String>) -> Padding {
    let mut padding = Padding::default();
    if let Some(value) = declaration(attrs, "padding") {
        let parts = value
            .split_whitespace()
            .filter_map(parse_length_pt)
            .map(|value| value.max(0.0))
            .collect::<Vec<_>>();
        match parts.as_slice() {
            [all] => {
                padding = Padding {
                    left: *all,
                    right: *all,
                    top: *all,
                    bottom: *all,
                };
            }
            [vertical, horizontal] => {
                padding = Padding {
                    left: *horizontal,
                    right: *horizontal,
                    top: *vertical,
                    bottom: *vertical,
                };
            }
            [top, horizontal, bottom] => {
                padding = Padding {
                    left: *horizontal,
                    right: *horizontal,
                    top: *top,
                    bottom: *bottom,
                };
            }
            [top, right, bottom, left, ..] => {
                padding = Padding {
                    left: *left,
                    right: *right,
                    top: *top,
                    bottom: *bottom,
                };
            }
            [] => {}
        }
    }
    for (name, side) in [
        ("padding-left", 0),
        ("padding-right", 1),
        ("padding-top", 2),
        ("padding-bottom", 3),
    ] {
        if let Some(value) = declaration(attrs, name).and_then(parse_length_pt) {
            match side {
                0 => padding.left = value.max(0.0),
                1 => padding.right = value.max(0.0),
                2 => padding.top = value.max(0.0),
                _ => padding.bottom = value.max(0.0),
            }
        }
    }
    padding
}

fn parse_margins(attrs: &BTreeMap<String, String>) -> Margins {
    let mut margins = Margins::default();
    if let Some(value) = declaration(attrs, "margin") {
        let parts = value
            .split_whitespace()
            .map(parse_length_pt)
            .collect::<Vec<_>>();
        let side = |index: usize| {
            parts
                .get(index)
                .and_then(|value| *value)
                .map(|value| value.max(0.0))
        };
        match parts.len() {
            1 => {
                margins = Margins {
                    top: side(0),
                    right: side(0),
                    bottom: side(0),
                    left: side(0),
                };
            }
            2 => {
                margins.top = side(0);
                margins.bottom = side(0);
                margins.left = side(1);
                margins.right = side(1);
            }
            3 => {
                margins.top = side(0);
                margins.left = side(1);
                margins.right = side(1);
                margins.bottom = side(2);
            }
            4.. => {
                margins.top = side(0);
                margins.right = side(1);
                margins.bottom = side(2);
                margins.left = side(3);
            }
            _ => {}
        }
    }
    for (name, side) in [
        ("margin-top", 0),
        ("margin-right", 1),
        ("margin-bottom", 2),
        ("margin-left", 3),
    ] {
        if let Some(value) = declaration(attrs, name).and_then(parse_length_pt) {
            match side {
                0 => margins.top = Some(value.max(0.0)),
                1 => margins.right = Some(value.max(0.0)),
                2 => margins.bottom = Some(value.max(0.0)),
                _ => margins.left = Some(value.max(0.0)),
            }
        }
    }
    margins
}

fn block_margins_mut(block: &mut RichBlock) -> &mut Margins {
    match block {
        RichBlock::Heading { margins, .. } | RichBlock::Paragraph { margins, .. } => margins,
        RichBlock::Table(table) => &mut table.margins,
        RichBlock::Container(container) => &mut container.margins,
        RichBlock::Image { margins, .. } | RichBlock::Rule { margins } => margins,
        RichBlock::PageBreak => unreachable!("page breaks carry no margins"),
    }
}

fn merge_outer_margin(current: &mut Option<f32>, outer: Option<f32>) {
    if let Some(outer) = outer {
        *current = Some(current.map_or(outer, |value| value.max(outer)));
    }
}

/// Applies the margins of a wrapper element to its first and last rendered block.
///
/// CSS collapses the wrapper margin with the adjacent child margin; taking the maximum of the two
/// reproduces that without introducing a wrapper node into the shared document model.
fn apply_scope_margins(blocks: &mut [RichBlock], outer: Margins) {
    if outer.top.is_none() && outer.bottom.is_none() {
        return;
    }
    if let Some(first) = blocks.first_mut() {
        if !matches!(first, RichBlock::PageBreak) {
            merge_outer_margin(&mut block_margins_mut(first).top, outer.top);
        }
    }
    if let Some(last) = blocks.last_mut() {
        if !matches!(last, RichBlock::PageBreak) {
            merge_outer_margin(&mut block_margins_mut(last).bottom, outer.bottom);
        }
    }
}

/// Value of the first `name` declaration of an inline `style` attribute.
fn declaration<'a>(attrs: &'a BTreeMap<String, String>, name: &str) -> Option<&'a str> {
    attrs.get("style")?.split(';').find_map(|declaration| {
        let (key, value) = declaration.split_once(':')?;
        key.trim()
            .eq_ignore_ascii_case(name)
            .then_some(value.trim())
    })
}

/// Trims a CSS value and drops an `!important` suffix.
fn normalize(value: &str) -> String {
    value
        .split("!important")
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
}

/// Parses a CSS length into points; unitless values are pixels like in the inline styles.
fn parse_length_pt(value: &str) -> Option<f32> {
    let value = normalize(value);
    if let Some(number) = value.strip_suffix("px") {
        return number.trim().parse::<f32>().ok().map(|px| px * 0.75);
    }
    if let Some(number) = value.strip_suffix("pt") {
        return number.trim().parse::<f32>().ok();
    }
    if let Some(number) = value.strip_suffix("mm") {
        return number.trim().parse::<f32>().ok().map(|mm| mm * MM_TO_PT);
    }
    if let Some(number) = value.strip_suffix("rem") {
        return number.trim().parse::<f32>().ok().map(|rem| rem * 12.0);
    }
    value.parse::<f32>().ok().map(|px| px * 0.75)
}

fn heading_size(level: u8) -> f32 {
    match level {
        1 => 20.0,
        2 => 16.0,
        3 => 14.0,
        4 => 12.0,
        _ => 11.0,
    }
}

fn parse_table(element: &Element, style: Style) -> RichTable {
    let mut rows = Vec::new();
    collect_rows(&element.children, style, &mut rows);
    RichTable {
        rows,
        margins: parse_margins(&element.attrs),
    }
}

fn collect_rows(nodes: &[Node], style: Style, rows: &mut Vec<Vec<TableCell>>) {
    for node in nodes {
        let Node::Element(element) = node else {
            continue;
        };
        match element.tag.as_str() {
            "tr" => {
                let mut cells = Vec::new();
                collect_cells(&element.children, style, &mut cells);
                if !cells.is_empty() {
                    rows.push(cells);
                }
            }
            "thead" | "tbody" | "tfoot" => collect_rows(&element.children, style, rows),
            _ => {}
        }
    }
}

fn collect_cells(nodes: &[Node], style: Style, cells: &mut Vec<TableCell>) {
    for node in nodes {
        let Node::Element(element) = node else {
            continue;
        };
        if !matches!(element.tag.as_str(), "td" | "th") {
            continue;
        }
        let cell_style = apply_style(style, &element.attrs);
        let mut runs = Vec::new();
        collect_inline(&element.children, cell_style, &mut runs);
        if runs.is_empty() {
            runs.push(TextRun::plain(""));
        }
        cells.push(TableCell {
            runs,
            align: cell_style.align,
            header: element.tag == "th" || cell_style.bold,
            background: background_color(&element.attrs),
        });
    }
}

fn collect_inline(nodes: &[Node], style: Style, runs: &mut Vec<TextRun>) {
    for node in nodes {
        match node {
            Node::Text(text) => {
                let text = text.split_whitespace().collect::<Vec<_>>().join(" ");
                if text.is_empty() {
                    continue;
                }
                if runs
                    .last()
                    .is_some_and(|run| !run.text.ends_with([' ', '\n']))
                {
                    runs.push(TextRun::plain(" "));
                }
                runs.push(TextRun {
                    text,
                    bold: style.bold,
                    italic: style.italic,
                    underline: style.underline,
                    color: style.color,
                    size_pt: style.size_pt,
                });
            }
            Node::Element(element) => match element.tag.as_str() {
                "br" => runs.push(TextRun {
                    text: "\n".to_string(),
                    bold: style.bold,
                    italic: style.italic,
                    underline: style.underline,
                    color: style.color,
                    size_pt: style.size_pt,
                }),
                "style" | "script" => {}
                _ => collect_inline(&element.children, apply_style(style, &element.attrs), runs),
            },
        }
    }
}

fn apply_style(mut style: Style, attrs: &BTreeMap<String, String>) -> Style {
    if attrs
        .get("class")
        .is_some_and(|class| class.contains("docx-page-break"))
    {
        return style;
    }
    if let Some(value) = attrs.get("style") {
        for declaration in value.split(';') {
            let Some((name, value)) = declaration.split_once(':') else {
                continue;
            };
            let name = name.trim().to_ascii_lowercase();
            let value = value.trim();
            match name.as_str() {
                "color" => {
                    if let Some(color) = parse_color(value) {
                        style.color = Some(color);
                    }
                }
                "font-weight" => {
                    style.bold = value.eq_ignore_ascii_case("bold")
                        || value.eq_ignore_ascii_case("bolder")
                        || value.parse::<u16>().is_ok_and(|weight| weight >= 600);
                }
                "font-style" => style.italic = value.eq_ignore_ascii_case("italic"),
                "text-decoration" => {
                    style.underline = value.to_ascii_lowercase().contains("underline")
                }
                "font-size" => {
                    if let Some(size) = parse_size(value) {
                        style.size_pt = size;
                    }
                }
                "text-align" => {
                    style.align = match value.to_ascii_lowercase().as_str() {
                        "center" => Align::Center,
                        "right" => Align::Right,
                        _ => Align::Left,
                    }
                }
                _ => {}
            }
        }
    }
    match attrs.get("align").map(|value| value.to_ascii_lowercase()) {
        Some(value) if value == "center" => style.align = Align::Center,
        Some(value) if value == "right" => style.align = Align::Right,
        _ => {}
    }
    style.bold |= matches!(attrs.get("tag").map(String::as_str), Some("b" | "strong"));
    style
}

fn background_color(attrs: &BTreeMap<String, String>) -> Option<[u8; 3]> {
    let style = attrs.get("style")?;
    for declaration in style.split(';') {
        let Some((name, value)) = declaration.split_once(':') else {
            continue;
        };
        if name.trim().eq_ignore_ascii_case("background-color") {
            return parse_color(value.trim());
        }
    }
    None
}

fn is_page_break(element: &Element) -> bool {
    if element
        .attrs
        .get("class")
        .is_some_and(|class| class.contains("docx-page-break"))
    {
        return true;
    }
    element.attrs.get("style").is_some_and(|style| {
        let style = style.to_ascii_lowercase();
        style.contains("page-break-before: always")
            || style.contains("page-break-after: always")
            || style.contains("break-before: page")
            || style.contains("break-after: page")
    })
}

fn parse_size(value: &str) -> Option<f32> {
    let value = value.trim().to_ascii_lowercase();
    if let Some(value) = value.strip_suffix("px") {
        return value.trim().parse::<f32>().ok().map(|size| size * 0.75);
    }
    if let Some(value) = value.strip_suffix("pt") {
        return value.trim().parse::<f32>().ok();
    }
    value.parse::<f32>().ok()
}

/// Parses `#rgb`, `#rrggbb`, `rgb(r,g,b)` and the common CSS colour names.
pub fn parse_color(value: &str) -> Option<[u8; 3]> {
    let value = value.trim().to_ascii_lowercase();
    if let Some(hex) = value.strip_prefix('#') {
        if hex.len() == 3 {
            let mut out = [0; 3];
            for (index, character) in hex.chars().enumerate() {
                out[index] = u8::from_str_radix(&format!("{character}{character}"), 16).ok()?;
            }
            return Some(out);
        }
        if hex.len() == 6 {
            return Some([
                u8::from_str_radix(&hex[0..2], 16).ok()?,
                u8::from_str_radix(&hex[2..4], 16).ok()?,
                u8::from_str_radix(&hex[4..6], 16).ok()?,
            ]);
        }
    }
    if let Some(inner) = value
        .strip_prefix("rgb(")
        .and_then(|value| value.strip_suffix(')'))
    {
        let parts = inner
            .split(',')
            .filter_map(|part| part.trim().trim_end_matches('%').parse::<u8>().ok())
            .collect::<Vec<_>>();
        if parts.len() == 3 {
            return Some([parts[0], parts[1], parts[2]]);
        }
    }
    match value.as_str() {
        "black" => Some([0, 0, 0]),
        "white" => Some([255, 255, 255]),
        "red" => Some([255, 0, 0]),
        "green" => Some([0, 128, 0]),
        "blue" => Some([0, 0, 255]),
        "gray" | "grey" => Some([128, 128, 128]),
        "slate" => Some([71, 85, 105]),
        _ => None,
    }
}

fn parse_nodes(html: &str) -> Vec<Node> {
    let mut root = Vec::new();
    let mut stack: Vec<Element> = Vec::new();
    let bytes = html.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] != b'<' {
            let next = html[index..]
                .find('<')
                .map(|offset| index + offset)
                .unwrap_or(bytes.len());
            push_node(
                &mut stack,
                &mut root,
                Node::Text(html[index..next].to_string()),
            );
            index = next;
            continue;
        }
        if html[index..].starts_with("<!--") {
            index = html[index + 4..]
                .find("-->")
                .map(|offset| index + 4 + offset + 3)
                .unwrap_or(bytes.len());
            continue;
        }
        let Some(end) = html[index..].find('>').map(|offset| index + offset) else {
            break;
        };
        let inside = html[index + 1..end].trim();
        if inside.is_empty() {
            index = end + 1;
            continue;
        }
        let closing = inside.starts_with('/');
        let self_closing = inside.ends_with('/');
        let body = inside.trim_start_matches('/').trim_end_matches('/').trim();
        let tag = body
            .split_whitespace()
            .next()
            .unwrap_or_default()
            .to_ascii_lowercase();
        if closing {
            if let Some(position) = stack.iter().rposition(|element| element.tag == tag) {
                while stack.len() > position {
                    let element = stack.pop().expect("checked position");
                    push_node(&mut stack, &mut root, Node::Element(element));
                }
            }
        } else if !tag.is_empty() && !tag.starts_with('!') {
            let attrs = parse_attrs(body);
            let element = Element {
                tag: tag.clone(),
                attrs,
                children: Vec::new(),
            };
            if self_closing || matches!(tag.as_str(), "br" | "hr" | "img" | "meta" | "link") {
                push_node(&mut stack, &mut root, Node::Element(element));
            } else {
                stack.push(element);
            }
        }
        index = end + 1;
    }
    while let Some(element) = stack.pop() {
        push_node(&mut stack, &mut root, Node::Element(element));
    }
    root
}

fn push_node(stack: &mut [Element], root: &mut Vec<Node>, node: Node) {
    if let Some(parent) = stack.last_mut() {
        parent.children.push(node);
    } else {
        root.push(node);
    }
}

fn parse_attrs(body: &str) -> BTreeMap<String, String> {
    let mut attrs = BTreeMap::new();
    let Some(space) = body.find(char::is_whitespace) else {
        return attrs;
    };
    let mut rest = &body[space..];
    let mut chars = rest.char_indices().peekable();
    while let Some((offset, character)) = chars.next() {
        if character.is_whitespace() || character == '/' {
            continue;
        }
        let name_end = rest[offset..]
            .find(|c: char| c == '=' || c.is_whitespace())
            .map(|relative| offset + relative)
            .unwrap_or(rest.len());
        let name = rest[offset..name_end].to_ascii_lowercase();
        let mut cursor = name_end;
        while rest[cursor..]
            .chars()
            .next()
            .is_some_and(char::is_whitespace)
        {
            cursor += 1;
        }
        if !rest[cursor..].starts_with('=') {
            attrs.insert(name, String::new());
            continue;
        }
        cursor += 1;
        while rest[cursor..]
            .chars()
            .next()
            .is_some_and(char::is_whitespace)
        {
            cursor += 1;
        }
        let quote = rest[cursor..].chars().next();
        let value = if matches!(quote, Some('"' | '\'')) {
            let quote = quote.expect("matched");
            cursor += 1;
            let end = rest[cursor..]
                .find(quote)
                .map(|relative| cursor + relative)
                .unwrap_or(rest.len());
            let value = rest[cursor..end].to_string();
            cursor = (end + 1).min(rest.len());
            value
        } else {
            let end = rest[cursor..]
                .find(char::is_whitespace)
                .map(|relative| cursor + relative)
                .unwrap_or(rest.len());
            let value = rest[cursor..end].to_string();
            cursor = end;
            value
        };
        attrs.insert(name, value);
        while cursor < rest.len() {
            let next = rest[cursor..].chars().next().expect("bounds");
            if next.is_whitespace() {
                cursor += next.len_utf8();
            } else {
                break;
            }
        }
        // Continue from the end of this attribute. `chars` is rebuilt below when needed.
        rest = &rest[cursor..];
        chars = rest.char_indices().peekable();
    }
    attrs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flex_row_distributes_grow_and_gap_like_the_browser() {
        let document = parse(
            "<div style=\"display:flex;gap:20px\">\
               <div style=\"flex:1\">Links</div>\
               <div style=\"flex:1\">Rechts</div>\
             </div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        assert_eq!(container.items.len(), 2);
        assert!((container.column_gap - 15.0).abs() < 0.001);
        assert_eq!(container.justify, Justify::Start);
        assert_eq!(container.align, AlignItems::Stretch);
        let layout = layout_container(container, 300.0);
        assert_eq!(layout.rows.len(), 1);
        let slots = &layout.rows[0].slots;
        assert!((slots[0].width - 142.5).abs() < 0.01, "{:?}", slots[0]);
        assert!((slots[1].width - 142.5).abs() < 0.01, "{:?}", slots[1]);
        assert!((slots[0].x).abs() < 0.01);
        assert!((slots[1].x - 157.5).abs() < 0.01, "{:?}", slots[1]);
        assert_eq!(
            document.plain_text().lines().collect::<Vec<_>>(),
            ["Links", "Rechts"]
        );
    }

    #[test]
    fn flex_justify_content_moves_items_along_the_main_axis() {
        let positions = |justify: &str| {
            let html = format!(
                "<div style=\"display:flex;justify-content:{justify}\">\
                   <div style=\"width:100px\">A</div>\
                   <div style=\"width:50px\">B</div></div>"
            );
            let document = parse(&html);
            let RichBlock::Container(container) = &document.blocks[0] else {
                panic!("flex container expected");
            };
            layout_container(container, 400.0).rows[0]
                .slots
                .iter()
                .map(|slot| (slot.x, slot.width))
                .collect::<Vec<_>>()
        };
        let start = positions("flex-start");
        assert!((start[0].0).abs() < 0.01);
        assert!((start[0].1 - 75.0).abs() < 0.01);
        assert!((start[1].0 - 75.0).abs() < 0.01);
        assert!((start[1].1 - 37.5).abs() < 0.01);
        assert!((positions("flex-end")[0].0 - 287.5).abs() < 0.01);
        assert!((positions("center")[0].0 - 143.75).abs() < 0.01);
        let between = positions("space-between");
        assert!((between[0].0).abs() < 0.01);
        assert!((between[1].0 - 362.5).abs() < 0.01, "{:?}", between[1]);
        let around = positions("space-around");
        assert!((around[0].0 - 71.875).abs() < 0.01, "{:?}", around[0]);
        let evenly = positions("space-evenly");
        assert!((evenly[0].0 - 95.833).abs() < 0.05, "{:?}", evenly[0]);
    }

    #[test]
    fn flex_direction_column_and_reverse_follow_the_axis() {
        let document = parse(
            "<div style=\"display:flex;flex-direction:column;align-items:center\">\
               <div style=\"width:100px\">A</div>\
               <div style=\"width:200px\">B</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        let layout = layout_container(container, 300.0);
        assert_eq!(layout.rows.len(), 2);
        assert!((layout.rows[0].slots[0].width - 75.0).abs() < 0.01);
        assert!((layout.rows[1].slots[0].width - 150.0).abs() < 0.01);
        assert!((layout.rows[0].slots[0].x - 112.5).abs() < 0.01);
        assert!((layout.rows[1].slots[0].x - 75.0).abs() < 0.01);

        let document = parse(
            "<div style=\"display:flex;flex-direction:row-reverse;gap:10px\">\
               <div style=\"width:100px\">A</div>\
               <div style=\"width:50px\">B</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        let layout = layout_container(container, 300.0);
        let first = layout.rows[0]
            .slots
            .iter()
            .find(|slot| slot.item == 0)
            .unwrap();
        let second = layout.rows[0]
            .slots
            .iter()
            .find(|slot| slot.item == 1)
            .unwrap();
        assert!((first.x + first.width - 300.0).abs() < 0.01);
        assert!((second.x + second.width - 217.5).abs() < 0.01);
        assert!(first.x > second.x, "A sits right of B");
    }

    #[test]
    fn grid_tracks_repeat_wrap_and_keep_the_gap() {
        let document = parse(
            "<div style=\"display:grid;grid-template-columns:repeat(4, 1fr);gap:16px\">\
               <div>Eins</div><div>Zwei</div><div>Drei</div><div>Vier</div>\
               <div>Fünf</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("grid container expected");
        };
        assert!((container.column_gap - 12.0).abs() < 0.001);
        let layout = layout_container(container, 340.0);
        assert_eq!(layout.rows.len(), 2);
        assert_eq!(layout.rows[0].slots.len(), 4);
        assert_eq!(layout.rows[1].slots.len(), 1);
        let width = (340.0 - 3.0 * 12.0) / 4.0;
        for (index, slot) in layout.rows[0].slots.iter().enumerate() {
            assert!((slot.width - width).abs() < 0.01, "{:?}", slot);
            assert!(
                (slot.x - index as f32 * (width + 12.0)).abs() < 0.01,
                "{:?}",
                slot
            );
        }
        assert_eq!(layout.rows[1].slots[0].item, 4);
        assert!((layout.rows[1].slots[0].x).abs() < 0.01);

        let two_columns = parse(
            "<div style=\"display:grid;grid-template-columns:1fr 2fr;gap:10px 20px\">\
               <div>A</div><div>B</div></div>",
        );
        let RichBlock::Container(container) = &two_columns.blocks[0] else {
            panic!("grid container expected");
        };
        assert!((container.row_gap - 7.5).abs() < 0.001);
        assert!((container.column_gap - 15.0).abs() < 0.001);
        let layout = layout_container(container, 300.0);
        let slots = &layout.rows[0].slots;
        assert!((slots[0].width - 95.0).abs() < 0.01, "{:?}", slots[0]);
        assert!((slots[1].width - 190.0).abs() < 0.01, "{:?}", slots[1]);
        assert!((slots[1].x - 110.0).abs() < 0.01);
    }

    #[test]
    fn nested_containers_and_missing_declarations_keep_the_css_defaults() {
        let document = parse(
            "<div style=\"display:flex;justify-content:space-between\">\
               <div>Links</div>\
               <div style=\"display:flex;justify-content:space-between;width:120px\">\
                 <span>Netto</span><span>10,00 €</span></div>\
             </div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        assert_eq!(container.column_gap, 0.0);
        assert_eq!(container.row_gap, 0.0);
        assert_eq!(container.align, AlignItems::Stretch);
        let RichBlock::Container(inner) = &container.items[1].blocks[0] else {
            panic!("nested container expected");
        };
        assert_eq!(inner.items.len(), 2);
        let layout = layout_container(inner, 90.0);
        assert!((layout.rows[0].slots[0].x).abs() < 0.01);
        assert!((layout.rows[0].slots[1].x + layout.rows[0].slots[1].width - 90.0).abs() < 0.01);

        // Without `justify-content`/`align-items`/`gap` the browser defaults apply.
        let document = parse(
            "<div style=\"display:flex\"><div style=\"width:40px\">A</div>\
             <div style=\"width:40px\">B</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        assert_eq!(container.justify, Justify::Start);
        assert_eq!(container.align, AlignItems::Stretch);
        let layout = layout_container(container, 300.0);
        assert!((layout.rows[0].slots[1].x - 30.0).abs() < 0.01);
    }

    #[test]
    fn empty_containers_render_nothing() {
        let document =
            parse("<div style=\"display:flex\"><div></div><div> </div></div><p>Text</p>");
        assert_eq!(document.blocks.len(), 1);
        assert!(matches!(&document.blocks[0], RichBlock::Paragraph { .. }));
        assert!(parse("<div style=\"display:grid;gap:20px\"></div>")
            .blocks
            .is_empty());
        assert!(parse("<div style=\"display:none\"><p>x</p></div>")
            .blocks
            .is_empty());
    }

    #[test]
    fn align_items_offsets_shorter_items_inside_the_line() {
        let document = parse(
            "<div style=\"display:flex;align-items:center\">\
               <div style=\"width:40px\">kurz</div>\
               <div style=\"width:200px\">ein deutlich längerer Text, der in der Spalte umbricht</div>\
             </div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        let layout = layout_container(container, 300.0);
        let row = &layout.rows[0];
        assert!(row.height > row.slots[0].height + 1.0, "{:?}", row);
        assert!((row.slots[0].y - (row.height - row.slots[0].height) / 2.0).abs() < 0.01);
        assert!(row.slots[0].y > 0.0);
        assert_eq!(row.slots[1].y, 0.0);
    }

    #[test]
    fn realistic_template_places_header_cards_totals_and_footer_columns() {
        let document = parse(
            "<div style=\"display:flex;justify-content:space-between;align-items:flex-start\">\
               <div><div>Firma</div></div>\
               <div style=\"text-align:right\"><div>Rechnung</div></div></div>\
             <div style=\"display:flex;justify-content:space-between;gap:20px\">\
               <div style=\"flex:1;padding:16px\"><div>Kunde</div></div>\
               <div style=\"width:220px;padding:16px\"><div>Zahlung</div></div></div>\
             <div style=\"display:flex;justify-content:flex-end\">\
               <div style=\"width:280px\">\
                 <div style=\"display:flex;justify-content:space-between\">\
                   <span>Netto</span><span>10,00 €</span></div></div></div>\
             <div style=\"display:grid;grid-template-columns:repeat(4, 1fr);gap:16px\">\
               <div>Anschrift</div><div>Kontakt</div><div>Bank</div><div>Recht</div></div>",
        );
        let width = DIN5008_TEXT_WIDTH_PT;
        assert_eq!(document.blocks.len(), 4);

        let RichBlock::Container(header) = &document.blocks[0] else {
            panic!("header");
        };
        let header = layout_container(header, width);
        let first = &header.rows[0].slots[0];
        let second = &header.rows[0].slots[1];
        assert!((first.x).abs() < 0.01);
        assert!(
            (second.x + second.width - width).abs() < 0.01,
            "{:?}",
            second
        );

        let RichBlock::Container(cards) = &document.blocks[1] else {
            panic!("flex cards");
        };
        let cards = layout_container(cards, width);
        let left = &cards.rows[0].slots[0];
        let right = &cards.rows[0].slots[1];
        assert!((right.width - 165.0).abs() < 0.01, "220px = 165pt");
        assert!(
            (left.width - (width - 15.0 - 165.0)).abs() < 0.01,
            "{:?}",
            left
        );
        assert!((left.x).abs() < 0.01);
        assert!((right.x - (left.width + 15.0)).abs() < 0.01);

        let RichBlock::Container(totals) = &document.blocks[2] else {
            panic!("flex totals");
        };
        let totals_layout = layout_container(totals, width);
        assert!(
            (totals_layout.rows[0].slots[0].width - 210.0).abs() < 0.01,
            "280px = 210pt"
        );
        assert!((totals_layout.rows[0].slots[0].x + 210.0 - width).abs() < 0.01);
        let RichBlock::Container(totals_row) = &totals.items[0].blocks[0] else {
            panic!("nested totals row");
        };
        let row_layout = layout_container(totals_row, 210.0);
        assert!((row_layout.rows[0].slots[0].x).abs() < 0.01);
        assert!(
            (row_layout.rows[0].slots[1].x + row_layout.rows[0].slots[1].width - 210.0).abs()
                < 0.01
        );

        let RichBlock::Container(footer) = &document.blocks[3] else {
            panic!("footer grid");
        };
        let footer = layout_container(footer, width);
        let column = (width - 3.0 * 12.0) / 4.0;
        assert_eq!(footer.rows[0].slots.len(), 4);
        for (index, slot) in footer.rows[0].slots.iter().enumerate() {
            assert!((slot.width - column).abs() < 0.01);
            assert!((slot.x - index as f32 * (column + 12.0)).abs() < 0.01);
        }
    }

    #[test]
    fn parses_headings_paragraphs_tables_and_styles() {
        let document = parse(
            "<h1 style=\"color:#ff0000\">Titel</h1><p>Hallo <strong>Welt</strong><br>Zeile</p><table><tr><th>Pos.</th><th>Text</th></tr><tr><td>1</td><td>Beratung</td></tr></table>",
        );
        assert!(matches!(
            &document.blocks[0],
            RichBlock::Heading { level: 1, .. }
        ));
        assert_eq!(document.blocks.len(), 3);
        let RichBlock::Table(table) = &document.blocks[2] else {
            panic!("table expected");
        };
        assert_eq!(table.rows.len(), 2);
        assert_eq!(table.rows[1][1].text(), "Beratung");
        assert!(table.rows[0][0].header);
        assert!(document.plain_text().contains("Hallo"));
    }

    #[test]
    fn parses_page_breaks_and_hex_colours() {
        let document = parse("<p>A</p><div class=\"docx-page-break\"></div><p>B</p>");
        assert_eq!(document.blocks.len(), 3);
        assert_eq!(parse_color("#2563eb"), Some([37, 99, 235]));
        assert_eq!(parse_color("rgb(1, 2, 3)"), Some([1, 2, 3]));
    }

    #[test]
    fn flex_wrap_breaks_lines_and_nowrap_shrinks_them_like_the_browser() {
        let html = |wrap: &str| {
            format!(
                "<div style=\"display:flex;{wrap};gap:10px\">\
                   <div style=\"width:100px\">A</div>\
                   <div style=\"width:100px\">B</div>\
                   <div style=\"width:100px\">C</div></div>"
            )
        };

        let document = parse(&html("flex-wrap:wrap"));
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        assert_eq!(container.wrap, FlexWrap::Wrap);
        assert!((container.row_gap - 7.5).abs() < 0.001);
        let layout = layout_container(container, 200.0);
        assert_eq!(layout.rows.len(), 2);
        assert_eq!(layout.rows[0].slots.len(), 2);
        assert_eq!(layout.rows[1].slots.len(), 1);
        assert!((layout.rows[0].slots[0].width - 75.0).abs() < 0.01);
        assert!((layout.rows[0].slots[1].x - 82.5).abs() < 0.01);
        assert!((layout.rows[1].slots[0].x).abs() < 0.01);
        assert_eq!(layout.rows[1].slots[0].item, 2);

        let document = parse(&html("flex-wrap:nowrap"));
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        let layout = layout_container(container, 200.0);
        assert_eq!(layout.rows.len(), 1);
        let slots = &layout.rows[0].slots;
        assert_eq!(slots.len(), 3);
        // 200pt minus two 7.5pt gaps; the 225pt base total shrinks by 185/225.
        for slot in slots {
            assert!((slot.width - 61.6667).abs() < 0.01, "{slot:?}");
        }
        assert!((slots[0].x).abs() < 0.01);
        assert!((slots[1].x - 69.1667).abs() < 0.01, "{slots:?}");
    }

    #[test]
    fn flex_wrap_reverse_stacks_the_last_line_at_the_cross_start() {
        let document = parse(
            "<div style=\"display:flex;flex-wrap:wrap-reverse;gap:10px\">\
               <div style=\"width:100px\">A</div>\
               <div style=\"width:100px\">B</div>\
               <div style=\"width:100px\">C</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        assert_eq!(container.wrap, FlexWrap::WrapReverse);
        let layout = layout_container(container, 200.0);
        assert_eq!(layout.rows.len(), 2);
        assert_eq!(layout.rows[0].slots[0].item, 2);
        assert_eq!(layout.rows[1].slots.len(), 2);
    }

    #[test]
    fn explicit_grid_rows_keep_fixed_fractional_percentage_and_auto_heights() {
        let document = parse(
            "<div style=\"display:grid;grid-template-columns:1fr 1fr;\
               grid-template-rows:40px 1fr 20px;gap:10px;height:150px\">\
               <div>A</div><div>B</div><div>C</div><div>D</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("grid container expected");
        };
        assert_eq!(container.rows.len(), 3);
        let layout = layout_container(container, 200.0);
        assert_eq!(layout.rows.len(), 3);
        // 40px = 30pt, 20px = 15pt, two 10px row gaps = 15pt; the fr row gets the rest.
        assert!(
            (layout.rows[0].height - 30.0).abs() < 0.01,
            "{:?}",
            layout.rows
        );
        assert!(
            (layout.rows[1].height - 52.5).abs() < 0.01,
            "{:?}",
            layout.rows
        );
        assert!(
            (layout.rows[2].height - 15.0).abs() < 0.01,
            "{:?}",
            layout.rows
        );
        assert!((layout.rows[0].slots[0].y).abs() < 0.01);

        let document = parse(
            "<div style=\"display:grid;grid-template-columns:1fr 1fr;\
               grid-template-rows:25% 75%;height:200px\">\
               <div>A</div><div>B</div><div>C</div><div>D</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("grid container expected");
        };
        let layout = layout_container(container, 200.0);
        assert!(
            (layout.rows[0].height - 37.5).abs() < 0.01,
            "{:?}",
            layout.rows
        );
        assert!(
            (layout.rows[1].height - 112.5).abs() < 0.01,
            "{:?}",
            layout.rows
        );

        let document = parse(
            "<div style=\"display:grid;grid-template-columns:1fr 1fr;\
               grid-template-rows:40px auto\">\
               <div>A</div><div>B</div><div>C</div><div>D</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("grid container expected");
        };
        let layout = layout_container(container, 200.0);
        assert!(
            (layout.rows[0].height - 30.0).abs() < 0.01,
            "{:?}",
            layout.rows
        );
        assert!((layout.rows[1].height - layout.rows[1].slots[0].height).abs() < 0.01);
        assert!(layout.rows[1].height > 0.0);

        let document = parse(
            "<div style=\"display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:24px\">\
               <div>A</div><div>B</div><div>C</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("grid container expected");
        };
        let layout = layout_container(container, 200.0);
        assert_eq!(layout.rows.len(), 2);
        assert!(
            (layout.rows[1].height - 18.0).abs() < 0.01,
            "{:?}",
            layout.rows
        );
    }

    #[test]
    fn block_margins_collapse_but_flex_item_margins_do_not() {
        let document = parse(
            "<p style=\"margin-bottom:20px\">A</p>\
             <p style=\"margin-top:10px\">B</p>",
        );
        let a = block_content_height(&document.blocks[0], 300.0);
        let b = block_content_height(&document.blocks[1], 300.0);
        let height = measure_blocks(&document.blocks, 300.0);
        assert!(
            (height - (a + 15.0 + b + 1.8)).abs() < 0.01,
            "15pt is max(20px bottom, 10px top): {height}"
        );

        let document = parse(
            "<div style=\"display:flex;gap:10px\">\
               <div style=\"width:100px;margin-top:10px;margin-bottom:20px\">A</div>\
               <div style=\"width:100px;margin-top:20px;margin-bottom:10px\">B</div></div>",
        );
        let RichBlock::Container(container) = &document.blocks[0] else {
            panic!("flex container expected");
        };
        let layout = layout_container(container, 300.0);
        let row = &layout.rows[0];
        for slot in &row.slots {
            let item = &container.items[slot.item];
            assert!((slot.y - item.margin.top()).abs() < 0.01, "{slot:?}");
            assert!(
                (row.height - (slot.height + item.margin.vertical())).abs() < 0.01,
                "flex margins must add instead of collapsing: {slot:?} in {row:?}"
            );
        }
        // 10px + 20px = 22.5pt; collapsing would leave only max(10px, 20px) = 15pt.
        assert!((row.height - row.slots[0].height - 22.5).abs() < 0.01);
    }

    #[test]
    fn wrapper_margins_reach_the_first_and_last_block() {
        let document =
            parse("<div style=\"margin-bottom:24px\"><div>Text</div></div><p>Danach</p>");
        assert_eq!(document.blocks.len(), 2);
        assert_eq!(block_margins(&document.blocks[0]).bottom, Some(18.0));
        assert_eq!(block_margins(&document.blocks[1]).bottom, None);
    }
}
