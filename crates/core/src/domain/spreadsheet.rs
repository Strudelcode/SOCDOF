//! Spreadsheet domain of the `table` module.
//!
//! Ported from `SOCDOF - TS/src/components/sales/TableModule.tsx`. The reference is a small
//! spreadsheet: a fixed grid of at least 8 × 20 and at most 26 × 200 cells, per-cell styles, a
//! formula language (`=`, A1 references, ranges and `SUMME`, `MITTELWERT`, `MAX`, `MIN`, `ANZAHL`)
//! and CSV import/export with semicolons and quoted fields.
//!
//! Formulas are evaluated with a real parser instead of the reference's `Function` evaluation: the
//! accepted grammar and the results are the same (`#FEHLER` for anything invalid, text cells read as
//! zero inside a formula, cycles read as zero), but nothing is ever handed to a JavaScript engine.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// Smallest grid the reference creates for a new sheet.
pub const MIN_ROWS: usize = 20;
/// Smallest number of columns of a new sheet.
pub const MIN_COLS: usize = 8;
/// Largest number of rows a sheet may have.
pub const MAX_ROWS: usize = 200;
/// Largest number of columns a sheet may have (`A` … `Z`).
pub const MAX_COLS: usize = 26;

/// Shown for a formula that cannot be evaluated, exactly like the reference.
pub const FORMULA_ERROR: &str = "#FEHLER";

/// One value of the evaluation pass.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValue {
    /// The cell is empty.
    Empty,
    /// A number, either typed or computed.
    Number(f64),
    /// Text that is not a number.
    Text(String),
    /// A formula that failed.
    Error,
}

impl CellValue {
    /// Text shown in the grid.
    pub fn display(&self) -> String {
        match self {
            CellValue::Empty => String::new(),
            CellValue::Number(number) => format_number(*number),
            CellValue::Text(text) => text.clone(),
            CellValue::Error => FORMULA_ERROR.to_string(),
        }
    }

    /// Numeric value used inside formulas; text, empty cells and errors count as zero.
    pub fn as_number(&self) -> f64 {
        match self {
            CellValue::Number(number) => *number,
            _ => 0.0,
        }
    }

    /// Whether the value is a number (the grid aligns those to the right by default).
    pub fn is_number(&self) -> bool {
        matches!(self, CellValue::Number(_))
    }

    /// Whether the value counts as filled in the status bar.
    pub fn is_filled(&self) -> bool {
        !matches!(self, CellValue::Empty)
    }
}

/// Formats a number the way JavaScript's `String(number)` does for the values this module sees:
/// no thousands separator, a dot as decimal mark and no trailing zeros.
pub fn format_number(number: f64) -> String {
    if !number.is_finite() {
        return FORMULA_ERROR.to_string();
    }
    if number == number.trunc() && number.abs() < 1e15 {
        return format!("{}", number as i64);
    }
    let mut text = format!("{number}");
    if text.contains('e') || text.contains('E') {
        return text;
    }
    if text.contains('.') {
        while text.ends_with('0') {
            text.pop();
        }
        if text.ends_with('.') {
            text.pop();
        }
    }
    text
}

/// Horizontal alignment of a cell.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CellAlign {
    /// Flush left.
    Left,
    /// Centred.
    Center,
    /// Flush right.
    Right,
}

impl CellAlign {
    /// Stable storage representation.
    pub fn as_str(self) -> &'static str {
        match self {
            CellAlign::Left => "left",
            CellAlign::Center => "center",
            CellAlign::Right => "right",
        }
    }

    /// Parses the storage representation.
    pub fn from_storage(value: &str) -> Option<Self> {
        match value {
            "left" => Some(CellAlign::Left),
            "center" => Some(CellAlign::Center),
            "right" => Some(CellAlign::Right),
            _ => None,
        }
    }
}

/// Formatting of one cell. Every field is optional, exactly like the reference's `CellStyle`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct CellStyle {
    /// Bold text.
    pub bold: bool,
    /// Italic text.
    pub italic: bool,
    /// Underlined text.
    pub underline: bool,
    /// Explicit alignment; `None` aligns numbers right and everything else left.
    pub align: Option<CellAlign>,
    /// Font colour as `#rrggbb`.
    pub color: Option<String>,
    /// Background colour as `#rrggbb`.
    pub fill: Option<String>,
    /// Font family name from the reference list.
    pub font: Option<String>,
}

impl CellStyle {
    /// Whether the style carries no formatting and can be dropped from the map.
    pub fn is_empty(&self) -> bool {
        !self.bold
            && !self.italic
            && !self.underline
            && self.align.is_none()
            && self.color.is_none()
            && self.fill.is_none()
            && self.font.is_none()
    }
}

/// Font families the reference offers in the toolbar.
pub const FONT_FAMILIES: [&str; 5] = ["Arial", "Calibri", "Georgia", "Courier New", "Verdana"];

/// The fixed "standard colours" row of the reference, in its order.
pub const STANDARD_COLORS: [&str; 10] = [
    "#c00000", "#ff0000", "#ffc000", "#ffff00", "#92d050", "#00b050", "#00b0f0", "#0070c0",
    "#002060", "#7030a0",
];

/// Column name of a zero-based index (`0` → `A`).
pub fn column_name(index: usize) -> String {
    let letter = b'A' + (index.min(MAX_COLS - 1)) as u8;
    char::from(letter).to_string()
}

/// Cell id of a zero-based column and row (`0, 0` → `A1`).
pub fn cell_id(col: usize, row: usize) -> String {
    format!("{}{}", column_name(col), row + 1)
}

/// Parses an `A1` reference into zero-based coordinates.
pub fn parse_ref(reference: &str) -> Option<(usize, usize)> {
    let text = reference.trim().to_uppercase();
    let mut chars = text.chars();
    let column = chars.next()?;
    if !column.is_ascii_uppercase() {
        return None;
    }
    let rest: String = chars.collect();
    if rest.is_empty() || !rest.chars().all(|ch| ch.is_ascii_digit()) {
        return None;
    }
    let col = (column as u8 - b'A') as usize;
    let row: usize = rest.parse().ok()?;
    if col >= MAX_COLS || row == 0 || row > MAX_ROWS {
        return None;
    }
    Some((col, row - 1))
}

/// Per-cell styles keyed by cell id (`B3`).
pub type StyleMap = BTreeMap<String, CellStyle>;

/// Moves styles when a row or column is inserted or deleted, like the reference.
///
/// Styles stay with their cells: everything before the index is untouched, everything after it
/// moves by `delta`, and a style on a deleted index is dropped.
pub fn shift_styles(styles: &mut StyleMap, by_row: bool, index: usize, delta: i32) {
    let mut next = StyleMap::new();
    for (id, style) in styles.iter() {
        let Some((col, row)) = parse_ref(id) else {
            continue;
        };
        let at = if by_row { row } else { col };
        if at < index {
            next.insert(id.clone(), style.clone());
        } else if delta < 0 && at == index {
            continue;
        } else {
            let moved = if by_row {
                cell_id(col, row.saturating_add_signed(delta as isize))
            } else {
                cell_id(col.saturating_add_signed(delta as isize), row)
            };
            next.insert(moved, style.clone());
        }
    }
    *styles = next;
}

/// A sheet: a rectangular grid of raw cell texts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Sheet {
    rows: Vec<Vec<String>>,
}

impl Default for Sheet {
    fn default() -> Self {
        Self::empty()
    }
}

impl Sheet {
    /// A new sheet with the reference's minimum size.
    pub fn empty() -> Self {
        Self::sized(MIN_ROWS, MIN_COLS)
    }

    /// A sheet of exactly the given size, clamped to the allowed grid.
    pub fn sized(rows: usize, cols: usize) -> Self {
        let rows = rows.clamp(1, MAX_ROWS);
        let cols = cols.clamp(1, MAX_COLS);
        Self {
            rows: vec![vec![String::new(); cols]; rows],
        }
    }

    /// Builds a sheet from stored rows, padding it to the reference's minimum size.
    pub fn from_rows(rows: Vec<Vec<String>>) -> Self {
        let width = rows.iter().map(Vec::len).max().unwrap_or(0).min(MAX_COLS);
        let height = rows.len().min(MAX_ROWS);
        let mut sheet = Self::sized(height.max(MIN_ROWS), width.max(MIN_COLS));
        for (row, values) in rows.into_iter().take(MAX_ROWS).enumerate() {
            for (col, value) in values.into_iter().take(MAX_COLS).enumerate() {
                sheet.rows[row][col] = value;
            }
        }
        sheet
    }

    /// Number of rows.
    pub fn row_count(&self) -> usize {
        self.rows.len()
    }

    /// Number of columns.
    pub fn col_count(&self) -> usize {
        self.rows.first().map(Vec::len).unwrap_or(0)
    }

    /// Raw text of a cell.
    pub fn raw(&self, col: usize, row: usize) -> &str {
        self.rows
            .get(row)
            .and_then(|line| line.get(col))
            .map(String::as_str)
            .unwrap_or("")
    }

    /// Writes a cell; out-of-range writes are ignored.
    pub fn set(&mut self, col: usize, row: usize, value: impl Into<String>) {
        if let Some(line) = self.rows.get_mut(row) {
            if let Some(cell) = line.get_mut(col) {
                *cell = value.into();
            }
        }
    }

    /// Raw rows, used for persistence and the CSV writer.
    pub fn rows(&self) -> &[Vec<String>] {
        &self.rows
    }

    /// Number of non-empty cells, shown in the status bar.
    pub fn filled_count(&self) -> usize {
        self.rows
            .iter()
            .map(|line| line.iter().filter(|cell| !cell.trim().is_empty()).count())
            .sum()
    }

    /// Inserts an empty row at `index`; ignored at the maximum height.
    pub fn insert_row(&mut self, index: usize) -> bool {
        if self.row_count() >= MAX_ROWS {
            return false;
        }
        let width = self.col_count();
        self.rows
            .insert(index.min(self.rows.len()), vec![String::new(); width]);
        true
    }

    /// Inserts an empty column at `index`; ignored at the maximum width.
    pub fn insert_col(&mut self, index: usize) -> bool {
        if self.col_count() >= MAX_COLS {
            return false;
        }
        let index = index.min(self.col_count());
        for line in &mut self.rows {
            line.insert(index, String::new());
        }
        true
    }

    /// Deletes a row; the last remaining row cannot be deleted.
    pub fn delete_row(&mut self, index: usize) -> bool {
        if self.row_count() <= 1 || index >= self.row_count() {
            return false;
        }
        self.rows.remove(index);
        true
    }

    /// Deletes a column; the last remaining column cannot be deleted.
    pub fn delete_col(&mut self, index: usize) -> bool {
        if self.col_count() <= 1 || index >= self.col_count() {
            return false;
        }
        for line in &mut self.rows {
            line.remove(index);
        }
        true
    }

    /// Evaluates every cell. Formula cells are resolved recursively; cycles read as zero.
    pub fn values(&self) -> Vec<Vec<CellValue>> {
        let mut cache: BTreeMap<String, CellValue> = BTreeMap::new();
        let mut grid = Vec::with_capacity(self.row_count());
        for row in 0..self.row_count() {
            let mut line = Vec::with_capacity(self.col_count());
            for col in 0..self.col_count() {
                if !cache.contains_key(&cell_id(col, row)) {
                    self.evaluate_into(col, row, &mut cache, &mut Vec::new());
                }
                line.push(
                    cache
                        .get(&cell_id(col, row))
                        .cloned()
                        .unwrap_or(CellValue::Empty),
                );
            }
            grid.push(line);
        }
        grid
    }

    /// Evaluates one cell without a shared cache.
    pub fn value(&self, col: usize, row: usize) -> CellValue {
        let mut cache = BTreeMap::new();
        self.evaluate_into(col, row, &mut cache, &mut Vec::new())
    }

    fn evaluate_into(
        &self,
        col: usize,
        row: usize,
        cache: &mut BTreeMap<String, CellValue>,
        stack: &mut Vec<String>,
    ) -> CellValue {
        let id = cell_id(col, row);
        if let Some(value) = cache.get(&id) {
            return value.clone();
        }
        if stack.contains(&id) {
            return CellValue::Empty;
        }
        stack.push(id.clone());
        let value = self.evaluate_raw(self.raw(col, row), cache, stack);
        stack.pop();
        cache.insert(id, value.clone());
        value
    }

    fn read(
        &self,
        col: usize,
        row: usize,
        cache: &mut BTreeMap<String, CellValue>,
        stack: &mut Vec<String>,
    ) -> f64 {
        self.evaluate_into(col, row, cache, stack).as_number()
    }

    fn evaluate_raw(
        &self,
        raw: &str,
        cache: &mut BTreeMap<String, CellValue>,
        stack: &mut Vec<String>,
    ) -> CellValue {
        let text = raw.trim();
        if text.is_empty() {
            return CellValue::Empty;
        }
        if !text.starts_with('=') {
            return parse_number(text)
                .map(CellValue::Number)
                .unwrap_or_else(|| CellValue::Text(text.to_string()));
        }
        let mut parser = FormulaParser {
            sheet: self,
            cache,
            stack,
            tokens: tokenize(&text[1..]),
            position: 0,
        };
        match parser.parse_expression() {
            Some(number) if number.is_finite() => CellValue::Number(round_ten(number)),
            _ => CellValue::Error,
        }
    }

    /// Writes the sheet as CSV, exactly like the reference's `toCsv`: semicolons, quoted fields for
    /// `;`, `"` and line breaks, no trailing newline.
    pub fn to_csv(&self) -> String {
        self.rows
            .iter()
            .map(|line| {
                line.iter()
                    .map(|cell| {
                        if cell.contains(';') || cell.contains('"') || cell.contains('\n') {
                            format!("\"{}\"", cell.replace('"', "\"\""))
                        } else {
                            cell.clone()
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(";")
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    /// Reads CSV with the reference's rules: semicolon separator, `""` escapes, at most
    /// [`MAX_ROWS`] rows and [`MAX_COLS`] columns, and the minimum grid size.
    pub fn from_csv(text: &str) -> Self {
        let text = text.strip_prefix('\u{feff}').unwrap_or(text);
        let mut parsed: Vec<Vec<String>> = Vec::new();
        for line in text.split('\n').take(MAX_ROWS) {
            let line = line.strip_suffix('\r').unwrap_or(line);
            parsed.push(parse_csv_line(line));
        }
        Self::from_rows(parsed)
    }
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    let chars: Vec<char> = line.chars().collect();
    let mut index = 0;
    while index < chars.len() {
        let ch = chars[index];
        if quoted {
            if ch == '"' && chars.get(index + 1) == Some(&'"') {
                current.push('"');
                index += 1;
            } else if ch == '"' {
                quoted = false;
            } else {
                current.push(ch);
            }
        } else if ch == '"' {
            quoted = true;
        } else if ch == ';' {
            cells.push(std::mem::take(&mut current));
        } else {
            current.push(ch);
        }
        index += 1;
    }
    cells.push(current);
    cells.into_iter().take(MAX_COLS).collect()
}

/// Parses a typed number; the reference accepts a comma as the decimal mark.
fn parse_number(text: &str) -> Option<f64> {
    let normalised = text.replace(',', ".");
    normalised
        .parse::<f64>()
        .ok()
        .filter(|value| value.is_finite())
}

/// Rounds like the reference's `Number(result.toFixed(10))`.
fn round_ten(number: f64) -> f64 {
    let factor = 1e10;
    (number * factor).round() / factor
}

#[derive(Debug, Clone, PartialEq)]
enum Token {
    Number(f64),
    Ref(usize, usize),
    Function(String),
    Plus,
    Minus,
    Star,
    Slash,
    Open,
    Close,
    Colon,
    Comma,
}

fn tokenize(expression: &str) -> Vec<Token> {
    let uppercase = expression.to_uppercase();
    let chars: Vec<char> = uppercase.chars().collect();
    let mut tokens = Vec::new();
    let mut index = 0;
    while index < chars.len() {
        let ch = chars[index];
        if ch.is_whitespace() {
            index += 1;
            continue;
        }
        match ch {
            '+' => {
                tokens.push(Token::Plus);
                index += 1;
            }
            '-' => {
                tokens.push(Token::Minus);
                index += 1;
            }
            '*' => {
                tokens.push(Token::Star);
                index += 1;
            }
            '/' => {
                tokens.push(Token::Slash);
                index += 1;
            }
            '(' => {
                tokens.push(Token::Open);
                index += 1;
            }
            ')' => {
                tokens.push(Token::Close);
                index += 1;
            }
            ':' => {
                tokens.push(Token::Colon);
                index += 1;
            }
            ',' | ';' => {
                tokens.push(Token::Comma);
                index += 1;
            }
            _ if ch.is_ascii_digit() || ch == '.' => {
                let start = index;
                while index < chars.len() && (chars[index].is_ascii_digit() || chars[index] == '.')
                {
                    index += 1;
                }
                let text: String = chars[start..index].iter().collect();
                match text.parse::<f64>() {
                    Ok(number) => tokens.push(Token::Number(number)),
                    Err(_) => return tokens,
                }
            }
            _ if ch.is_ascii_uppercase() => {
                let start = index;
                while index < chars.len() && chars[index].is_ascii_alphanumeric() {
                    index += 1;
                }
                let word: String = chars[start..index].iter().collect();
                if let Some((col, row)) = parse_ref(&word) {
                    tokens.push(Token::Ref(col, row));
                } else if is_function(&word) {
                    tokens.push(Token::Function(word));
                } else {
                    return tokens;
                }
            }
            _ => return tokens,
        }
    }
    tokens
}

fn is_function(name: &str) -> bool {
    matches!(name, "SUMME" | "MITTELWERT" | "MAX" | "MIN" | "ANZAHL")
}

struct FormulaParser<'a> {
    sheet: &'a Sheet,
    cache: &'a mut BTreeMap<String, CellValue>,
    stack: &'a mut Vec<String>,
    tokens: Vec<Token>,
    position: usize,
}

impl FormulaParser<'_> {
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.position)
    }

    fn next(&mut self) -> Option<Token> {
        let token = self.tokens.get(self.position).cloned();
        if token.is_some() {
            self.position += 1;
        }
        token
    }

    fn parse_expression(&mut self) -> Option<f64> {
        let mut value = self.parse_term()?;
        loop {
            match self.peek() {
                Some(Token::Plus) => {
                    self.position += 1;
                    value += self.parse_term()?;
                }
                Some(Token::Minus) => {
                    self.position += 1;
                    value -= self.parse_term()?;
                }
                _ => break,
            }
        }
        Some(value)
    }

    fn parse_term(&mut self) -> Option<f64> {
        let mut value = self.parse_unary()?;
        loop {
            match self.peek() {
                Some(Token::Star) => {
                    self.position += 1;
                    value *= self.parse_unary()?;
                }
                Some(Token::Slash) => {
                    self.position += 1;
                    value /= self.parse_unary()?;
                }
                _ => break,
            }
        }
        Some(value)
    }

    fn parse_unary(&mut self) -> Option<f64> {
        if matches!(self.peek(), Some(Token::Minus)) {
            self.position += 1;
            return Some(-self.parse_unary()?);
        }
        if matches!(self.peek(), Some(Token::Plus)) {
            self.position += 1;
            return self.parse_unary();
        }
        self.parse_primary()
    }

    fn parse_primary(&mut self) -> Option<f64> {
        match self.next()? {
            Token::Number(number) => Some(number),
            Token::Ref(col, row) => Some(self.sheet.read(col, row, self.cache, self.stack)),
            Token::Open => {
                let value = self.parse_expression()?;
                matches!(self.next(), Some(Token::Close)).then_some(value)
            }
            Token::Function(name) => self.parse_function(&name),
            _ => None,
        }
    }

    fn parse_function(&mut self, name: &str) -> Option<f64> {
        // The reference only accepts exactly one range argument, `FN(A1:B3)`; a single reference,
        // no argument or a second argument makes the whole formula fail.
        if !matches!(self.next(), Some(Token::Open)) {
            return None;
        }
        let start = match self.next()? {
            Token::Ref(col, row) => (col, row),
            _ => return None,
        };
        if !matches!(self.next(), Some(Token::Colon)) {
            return None;
        }
        let end = match self.next()? {
            Token::Ref(col, row) => (col, row),
            _ => return None,
        };
        if !matches!(self.next(), Some(Token::Close)) {
            return None;
        }
        let mut values = Vec::new();
        for row in start.1.min(end.1)..=start.1.max(end.1) {
            for col in start.0.min(end.0)..=start.0.max(end.0) {
                values.push(self.sheet.read(col, row, self.cache, self.stack));
            }
        }
        let sum: f64 = values.iter().sum();
        Some(match name {
            "SUMME" => sum,
            "MITTELWERT" => sum / values.len() as f64,
            "MAX" => values.iter().copied().fold(f64::NEG_INFINITY, f64::max),
            "MIN" => values.iter().copied().fold(f64::INFINITY, f64::min),
            "ANZAHL" => values.len() as f64,
            _ => return None,
        })
    }
}

/// One stored spreadsheet.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SpreadsheetDocument {
    /// Stable identifier.
    pub id: uuid::Uuid,
    /// File name shown in the title bar and used for the CSV export.
    pub name: String,
    /// Cell contents.
    pub sheet: Sheet,
    /// Per-cell formatting keyed by `A1` ids.
    pub styles: StyleMap,
    /// Whether the grid lines are painted.
    pub show_gridlines: bool,
    /// Whether the formula bar is visible.
    pub show_formula_bar: bool,
    /// Creation time in milliseconds since the Unix epoch.
    pub created_at: i64,
    /// Last change in milliseconds since the Unix epoch.
    pub updated_at: i64,
}

impl SpreadsheetDocument {
    /// A new document with the reference's default file name.
    pub fn new(name: impl Into<String>, now: i64) -> Self {
        Self {
            id: uuid::Uuid::new_v4(),
            name: name.into(),
            sheet: Sheet::empty(),
            styles: StyleMap::new(),
            show_gridlines: true,
            show_formula_bar: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Validates the document before it is stored.
    pub fn validate(&self) -> Result<(), String> {
        if self.name.trim().is_empty() {
            return Err("name_required".to_string());
        }
        if self.name.chars().count() > 120 {
            return Err("name_too_long".to_string());
        }
        if self.sheet.row_count() == 0 || self.sheet.col_count() == 0 {
            return Err("sheet_empty".to_string());
        }
        if self.sheet.row_count() > MAX_ROWS || self.sheet.col_count() > MAX_COLS {
            return Err("sheet_too_large".to_string());
        }
        Ok(())
    }

    /// CSV export text including the UTF-8 byte order mark the reference writes.
    pub fn csv_export(&self) -> String {
        format!("\u{feff}{}", self.sheet.to_csv())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_parse_with_comma_and_text_stays_text() {
        let mut sheet = Sheet::empty();
        sheet.set(0, 0, "12,5");
        sheet.set(1, 0, "Hallo");
        sheet.set(2, 0, "");
        assert_eq!(sheet.value(0, 0), CellValue::Number(12.5));
        assert_eq!(sheet.value(1, 0), CellValue::Text("Hallo".to_string()));
        assert_eq!(sheet.value(2, 0), CellValue::Empty);
        assert_eq!(format_number(12.5), "12.5");
        assert_eq!(format_number(12.0), "12");
        assert_eq!(format_number(0.1 + 0.2), "0.30000000000000004");
    }

    #[test]
    fn formulas_sum_ranges_and_resolve_references() {
        let mut sheet = Sheet::empty();
        for (row, value) in ["10", "20", "30", "40"].iter().enumerate() {
            sheet.set(0, row, *value);
        }
        sheet.set(1, 0, "=A1+A2");
        sheet.set(1, 1, "=SUMME(A1:A4)");
        sheet.set(1, 2, "=MITTELWERT(A1:A4)");
        sheet.set(1, 3, "=MAX(A1:A4)");
        sheet.set(1, 4, "=MIN(A1:A4)");
        sheet.set(1, 5, "=ANZAHL(A1:A4)");
        sheet.set(1, 6, "=B1*2");
        sheet.set(1, 7, "=SUMME(A1:A4)/4");
        assert_eq!(sheet.value(1, 0), CellValue::Number(30.0));
        assert_eq!(sheet.value(1, 1), CellValue::Number(100.0));
        assert_eq!(sheet.value(1, 2), CellValue::Number(25.0));
        assert_eq!(sheet.value(1, 3), CellValue::Number(40.0));
        assert_eq!(sheet.value(1, 4), CellValue::Number(10.0));
        assert_eq!(sheet.value(1, 5), CellValue::Number(4.0));
        assert_eq!(sheet.value(1, 6), CellValue::Number(60.0));
        assert_eq!(sheet.value(1, 7), CellValue::Number(25.0));
    }

    #[test]
    fn invalid_formulas_cycles_and_unknown_names_are_errors_or_zero() {
        let mut sheet = Sheet::empty();
        sheet.set(0, 0, "=A2");
        sheet.set(0, 1, "=A1");
        // A cycle reads as zero inside the formula instead of failing the whole sheet.
        assert_eq!(sheet.value(0, 0), CellValue::Number(0.0));
        sheet.set(1, 0, "=1+");
        sheet.set(1, 1, "=SUMME(A1)");
        sheet.set(1, 2, "=unbekannt(1)");
        sheet.set(1, 3, "=1/0");
        sheet.set(1, 4, "=SUMME()");
        sheet.set(1, 5, "=MAX()");
        assert_eq!(sheet.value(1, 0), CellValue::Error);
        assert_eq!(sheet.value(1, 0).display(), FORMULA_ERROR);
        assert_eq!(sheet.value(1, 1), CellValue::Error);
        assert_eq!(sheet.value(1, 2), CellValue::Error);
        assert_eq!(sheet.value(1, 3), CellValue::Error);
        // The reference only accepts `FN(A1:B3)`; an empty or single-reference call fails.
        assert_eq!(sheet.value(1, 4), CellValue::Error);
        assert_eq!(sheet.value(1, 5), CellValue::Error);
    }

    #[test]
    fn text_cells_count_as_zero_inside_formulas() {
        let mut sheet = Sheet::empty();
        sheet.set(0, 0, "Text");
        sheet.set(0, 1, "5");
        sheet.set(1, 0, "=A1+A2");
        assert_eq!(sheet.value(1, 0), CellValue::Number(5.0));
    }

    #[test]
    fn insert_and_delete_rows_and_columns_keep_the_grid_rectangular() {
        let mut sheet = Sheet::empty();
        sheet.set(0, 0, "A");
        sheet.set(7, 19, "Z20");
        assert!(sheet.insert_row(0));
        assert_eq!(sheet.row_count(), 21);
        assert_eq!(sheet.raw(7, 20), "Z20");
        assert!(sheet.insert_col(2));
        assert_eq!(sheet.col_count(), 9);
        assert_eq!(sheet.col_count(), sheet.rows()[0].len());
        assert!(sheet.delete_row(0));
        assert!(sheet.delete_col(2));
        assert_eq!(sheet.raw(7, 19), "Z20");
        while sheet.row_count() > 1 {
            assert!(sheet.delete_row(0));
        }
        assert!(!sheet.delete_row(0), "the last row must stay");
        while sheet.col_count() > 1 {
            assert!(sheet.delete_col(0));
        }
        assert!(!sheet.delete_col(0), "the last column must stay");
    }

    #[test]
    fn styles_move_with_their_cells_and_drop_on_delete() {
        let mut styles = StyleMap::new();
        styles.insert(
            "A1".to_string(),
            CellStyle {
                bold: true,
                ..CellStyle::default()
            },
        );
        styles.insert(
            "A3".to_string(),
            CellStyle {
                italic: true,
                ..CellStyle::default()
            },
        );
        shift_styles(&mut styles, true, 2, 1);
        assert!(styles.contains_key("A1"));
        assert!(styles.contains_key("A4"));
        assert!(!styles.contains_key("A3"));
        shift_styles(&mut styles, true, 1, -1);
        assert!(styles.contains_key("A3"));
        assert!(!styles.contains_key("A4"));
        shift_styles(&mut styles, false, 0, 1);
        assert!(styles.contains_key("B1"));
        assert!(styles.contains_key("B3"));
    }

    #[test]
    fn csv_round_trip_quotes_separators_quotes_and_newlines() {
        let mut sheet = Sheet::empty();
        sheet.set(0, 0, "Name");
        sheet.set(1, 0, "Betrag; brutto");
        sheet.set(2, 0, "12,50");
        sheet.set(0, 1, "Zitat \"innen\"");
        let csv = sheet.to_csv();
        assert!(csv.contains("\"Betrag; brutto\""));
        assert!(csv.contains("\"Zitat \"\"innen\"\"\""));
        let loaded = Sheet::from_csv(&csv);
        assert_eq!(loaded.raw(1, 0), "Betrag; brutto");
        assert_eq!(loaded.raw(0, 1), "Zitat \"innen\"");

        // A line break inside a field is quoted on export. The reference imports line by line, so a
        // re-import splits it into two rows; the port keeps that behaviour instead of silently
        // accepting something the reference cannot read back.
        let mut multi = Sheet::empty();
        multi.set(1, 1, "Zeile\nzwei");
        assert!(multi.to_csv().contains("\"Zeile\nzwei\""));
        let reread = Sheet::from_csv(&multi.to_csv());
        assert_eq!(reread.raw(1, 1), "Zeile");
        assert!(
            reread.raw(0, 2).starts_with("zwei"),
            "the second line of the field moves to the next row: {:?}",
            reread.raw(0, 2)
        );
        assert_eq!(loaded.col_count(), MIN_COLS.max(3));
        assert_eq!(loaded.row_count(), MIN_ROWS);
    }

    #[test]
    fn csv_import_caps_the_grid_and_strips_the_bom() {
        let wide = (0..40)
            .map(|index| format!("c{index}"))
            .collect::<Vec<_>>()
            .join(";");
        let text = format!("\u{feff}{}", vec![wide; 260].join("\n"));
        let sheet = Sheet::from_csv(&text);
        assert_eq!(sheet.row_count(), MAX_ROWS);
        assert_eq!(sheet.col_count(), MAX_COLS);
        assert_eq!(sheet.raw(25, 199), "c25");
    }

    #[test]
    fn documents_validate_and_export_with_a_bom() {
        let mut document = SpreadsheetDocument::new("tabelle.csv", 1_000);
        assert!(document.validate().is_ok());
        document.sheet.set(0, 0, "1");
        assert!(document.csv_export().starts_with('\u{feff}'));
        document.name = "  ".to_string();
        assert_eq!(document.validate(), Err("name_required".to_string()));
        document.name = "x".repeat(121);
        assert_eq!(document.validate(), Err("name_too_long".to_string()));
    }

    #[test]
    fn references_parse_only_inside_the_grid() {
        assert_eq!(parse_ref("a1"), Some((0, 0)));
        assert_eq!(parse_ref("Z200"), Some((25, 199)));
        assert_eq!(parse_ref("Z201"), None);
        assert_eq!(parse_ref("AA1"), None);
        assert_eq!(parse_ref("A0"), None);
        assert_eq!(parse_ref("1A"), None);
        assert_eq!(cell_id(2, 4), "C5");
        assert_eq!(column_name(25), "Z");
    }
}
