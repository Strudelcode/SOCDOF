//! Native QR code encoding after ISO/IEC 18004.
//!
//! The encoder chooses the smallest version that fits the payload, picks numeric, alphanumeric or
//! byte mode, adds the Reed-Solomon codewords over GF(2^8), interleaves the blocks, evaluates all
//! eight data masks with the penalty rules of the norm and writes the format and version
//! information. The result is a plain module matrix: `true` is a dark module. A printer or PDF
//! writer scales it to its millimetre grid.
//!
//! Byte mode encodes the UTF-8 bytes of the payload, which is what the rest of the application
//! handles; no ECI header is emitted, so scanners read the bytes back as UTF-8 by default.
//!
//! The error correction tables, the block structure and the reference matrices used by the tests
//! come from two independent implementations (the `qrcode` package used by the TypeScript app and
//! the Python `segno` encoder), which agree module for module on every test vector.

use std::fmt::{self, Display, Formatter};

/// Number of Reed-Solomon blocks per version (row) and level (column L, M, Q, H).
const EC_BLOCKS: [[u8; 4]; 40] = [
    [1, 1, 1, 1],
    [1, 1, 1, 1],
    [1, 1, 2, 2],
    [1, 2, 2, 4],
    [1, 2, 4, 4],
    [2, 4, 4, 4],
    [2, 4, 6, 5],
    [2, 4, 6, 6],
    [2, 5, 8, 8],
    [4, 5, 8, 8],
    [4, 5, 8, 11],
    [4, 8, 10, 11],
    [4, 9, 12, 16],
    [4, 9, 16, 16],
    [6, 10, 12, 18],
    [6, 10, 17, 16],
    [6, 11, 16, 19],
    [6, 13, 18, 21],
    [7, 14, 21, 25],
    [8, 16, 20, 25],
    [8, 17, 23, 25],
    [9, 17, 23, 34],
    [9, 18, 25, 30],
    [10, 20, 27, 32],
    [12, 21, 29, 35],
    [12, 23, 34, 37],
    [12, 25, 34, 40],
    [13, 26, 35, 42],
    [14, 28, 38, 45],
    [15, 29, 40, 48],
    [16, 31, 43, 51],
    [17, 33, 45, 54],
    [18, 35, 48, 57],
    [19, 37, 51, 60],
    [19, 38, 53, 63],
    [20, 40, 56, 66],
    [21, 43, 59, 70],
    [22, 45, 62, 74],
    [24, 47, 65, 77],
    [25, 49, 68, 81],
];

/// Error correction codewords per block, per version and level.
const EC_CODEWORDS_PER_BLOCK: [[u8; 4]; 40] = [
    [7, 10, 13, 17],
    [10, 16, 22, 28],
    [15, 26, 18, 22],
    [20, 18, 26, 16],
    [26, 24, 18, 22],
    [18, 16, 24, 28],
    [20, 18, 18, 26],
    [24, 22, 22, 26],
    [30, 22, 20, 24],
    [18, 26, 24, 28],
    [20, 30, 28, 24],
    [24, 22, 26, 28],
    [26, 22, 24, 22],
    [30, 24, 20, 24],
    [22, 24, 30, 24],
    [24, 28, 24, 30],
    [28, 28, 28, 28],
    [30, 26, 28, 28],
    [28, 26, 26, 26],
    [28, 26, 30, 28],
    [28, 26, 28, 30],
    [28, 28, 30, 24],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [26, 28, 30, 30],
    [28, 28, 28, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
    [30, 28, 30, 30],
];

/// Total codewords of a version, data and error correction together.
const TOTAL_CODEWORDS: [u16; 40] = [
    26, 44, 70, 100, 134, 172, 196, 242, 292, 346, 404, 466, 532, 581, 655, 733, 815, 901, 991,
    1085, 1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185, 2323, 2465, 2611, 2761, 2876,
    3034, 3196, 3362, 3532, 3706,
];

/// Error correction level of a symbol; the more redundancy, the smaller the capacity.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EcLevel {
    /// About 7 % of the codewords may be restored.
    Low,
    /// About 15 %.
    Medium,
    /// About 25 %.
    Quartile,
    /// About 30 %.
    High,
}

impl EcLevel {
    /// All levels in the order of the error correction tables.
    pub const ALL: [EcLevel; 4] = [
        EcLevel::Low,
        EcLevel::Medium,
        EcLevel::Quartile,
        EcLevel::High,
    ];

    /// Column of this level in the error correction tables.
    fn index(self) -> usize {
        match self {
            EcLevel::Low => 0,
            EcLevel::Medium => 1,
            EcLevel::Quartile => 2,
            EcLevel::High => 3,
        }
    }

    /// Two-bit value that the format information carries for this level.
    fn format_bits(self) -> u32 {
        match self {
            EcLevel::Low => 1,
            EcLevel::Medium => 0,
            EcLevel::Quartile => 3,
            EcLevel::High => 2,
        }
    }

    /// Single letter of this level, as printed on labels and in the CLI.
    pub fn label(self) -> &'static str {
        match self {
            EcLevel::Low => "L",
            EcLevel::Medium => "M",
            EcLevel::Quartile => "Q",
            EcLevel::High => "H",
        }
    }

    /// Parses a single letter (`L`, `M`, `Q`, `H`), case insensitive.
    pub fn from_label(label: &str) -> Option<EcLevel> {
        match label.to_ascii_uppercase().as_str() {
            "L" => Some(EcLevel::Low),
            "M" => Some(EcLevel::Medium),
            "Q" => Some(EcLevel::Quartile),
            "H" => Some(EcLevel::High),
            _ => None,
        }
    }
}

/// Encoding mode the payload is compressed with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Mode {
    /// Digits only, three characters per ten bits.
    Numeric,
    /// Digits, upper case letters and ` $%*+-./:`, two characters per eleven bits.
    Alphanumeric,
    /// Any UTF-8 payload, eight bits per byte.
    Byte,
}

impl Mode {
    /// Mode indicator in front of the data bits.
    fn indicator(self) -> u32 {
        match self {
            Mode::Numeric => 0b0001,
            Mode::Alphanumeric => 0b0010,
            Mode::Byte => 0b0100,
        }
    }

    /// Width of the character count field, which grows with the version.
    fn count_bits(self, version: u8) -> u32 {
        let range = if version <= 9 {
            0
        } else if version <= 26 {
            1
        } else {
            2
        };
        match self {
            Mode::Numeric => [10, 12, 14][range],
            Mode::Alphanumeric => [9, 11, 13][range],
            Mode::Byte => [8, 16, 16][range],
        }
    }

    /// Picks the densest mode that can represent `text`.
    fn select(text: &str) -> Mode {
        if text.chars().all(|c| c.is_ascii_digit()) {
            Mode::Numeric
        } else if text.chars().all(|c| ALPHANUMERIC.contains(c)) {
            Mode::Alphanumeric
        } else {
            Mode::Byte
        }
    }

    /// Number of characters the count field announces.
    fn count(self, text: &str) -> usize {
        match self {
            Mode::Byte => text.len(),
            _ => text.chars().count(),
        }
    }

    /// Bits the payload needs before padding, without the mode and count fields.
    fn data_bits(self, text: &str) -> usize {
        self.data_bits_for(self.count(text))
    }

    /// Bits a payload of `count` characters needs before padding.
    fn data_bits_for(self, count: usize) -> usize {
        match self {
            Mode::Numeric => count / 3 * 10 + [0, 4, 7][count % 3],
            Mode::Alphanumeric => count / 2 * 11 + count % 2 * 6,
            Mode::Byte => count * 8,
        }
    }

    /// Writes the payload bits.
    fn encode(self, text: &str, bits: &mut Bits) {
        match self {
            Mode::Numeric => {
                for chunk in text.as_bytes().chunks(3) {
                    let value: u32 = chunk
                        .iter()
                        .fold(0, |value, digit| value * 10 + u32::from(digit - b'0'));
                    bits.push(value, [0, 4, 7, 10][chunk.len()]);
                }
            }
            Mode::Alphanumeric => {
                let values: Vec<u32> = text.chars().map(alphanumeric_value).collect();
                for chunk in values.chunks(2) {
                    match chunk {
                        [first, second] => bits.push(first * 45 + second, 11),
                        [single] => bits.push(*single, 6),
                        _ => {}
                    }
                }
            }
            Mode::Byte => {
                for byte in text.as_bytes() {
                    bits.push(u32::from(*byte), 8);
                }
            }
        }
    }
}

/// Characters of the alphanumeric mode in their code order.
const ALPHANUMERIC: &str = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/// Code of an alphanumeric character.
fn alphanumeric_value(character: char) -> u32 {
    ALPHANUMERIC
        .find(character)
        .expect("mode selection only accepts alphanumeric characters") as u32
}

/// Reasons a payload cannot become a symbol.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum QrError {
    /// An empty payload carries no information, so no symbol is produced.
    Empty,
    /// The payload does not fit even the largest version at this error correction level.
    TooLong {
        /// Characters the payload occupies.
        bytes: usize,
        /// Characters the largest version holds at this level and mode.
        capacity: usize,
    },
}

impl Display for QrError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            QrError::Empty => write!(formatter, "an empty payload has no QR code"),
            QrError::TooLong { bytes, capacity } => write!(
                formatter,
                "payload of {bytes} bytes exceeds the {capacity} bytes the largest QR version holds"
            ),
        }
    }
}

impl std::error::Error for QrError {}

/// A finished symbol.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct QrCode {
    version: u8,
    level: EcLevel,
    mode: Mode,
    mask: u8,
    size: usize,
    modules: Vec<bool>,
}

impl QrCode {
    /// Version 1 to 40; the symbol measures `17 + 4 * version` modules per side.
    pub fn version(&self) -> u8 {
        self.version
    }

    /// Error correction level the symbol was built with.
    pub fn level(&self) -> EcLevel {
        self.level
    }

    /// Mode the payload was encoded in.
    pub fn mode(&self) -> Mode {
        self.mode
    }

    /// Data mask that scored the lowest penalty.
    pub fn mask(&self) -> u8 {
        self.mask
    }

    /// Number of modules per side, without the quiet zone.
    pub fn size(&self) -> usize {
        self.size
    }

    /// The matrix in row-major order, `true` for a dark module.
    pub fn modules(&self) -> &[bool] {
        &self.modules
    }

    /// Whether the module at `row` and `column` is dark.
    pub fn dark(&self, row: usize, column: usize) -> bool {
        self.modules[row * self.size + column]
    }

    /// The matrix as rows of `1` (dark) and `0` (light), which is how tests and the CLI print it.
    pub fn rows(&self) -> Vec<String> {
        self.modules
            .chunks(self.size)
            .map(|row| {
                row.iter()
                    .map(|dark| if *dark { '1' } else { '0' })
                    .collect()
            })
            .collect()
    }
}

/// Encodes `text` at error correction level `level`.
///
/// The smallest version that holds the payload is chosen; the mode follows from the characters.
pub fn qr(text: &str, level: EcLevel) -> Result<QrCode, QrError> {
    if text.is_empty() {
        return Err(QrError::Empty);
    }
    let mode = Mode::select(text);
    let version = smallest_version(text, mode, level)?;
    let codewords = codewords(text, mode, version, level);
    let matrix = Matrix::draw(version, level, &codewords);
    Ok(matrix.into_code(level, mode))
}

/// Largest version whose data capacity holds the payload.
fn smallest_version(text: &str, mode: Mode, level: EcLevel) -> Result<u8, QrError> {
    for version in 1..=40u8 {
        let capacity = data_codewords(version, level) * 8;
        let needed = 4 + mode.count_bits(version) as usize + mode.data_bits(text);
        if needed <= capacity {
            return Ok(version);
        }
    }
    // Largest count the last version still holds in this mode, for the error message.
    let last = 40u8;
    let capacity_bits = data_codewords(last, level) * 8;
    let mut capacity = 0;
    while 4 + mode.count_bits(last) as usize + mode.data_bits_for(capacity + 1) <= capacity_bits {
        capacity += 1;
    }
    Err(QrError::TooLong {
        bytes: mode.count(text),
        capacity,
    })
}

/// Data codewords (without error correction) of a version at a level.
fn data_codewords(version: u8, level: EcLevel) -> usize {
    let index = (version - 1) as usize;
    usize::from(TOTAL_CODEWORDS[index])
        - usize::from(EC_BLOCKS[index][level.index()])
            * usize::from(EC_CODEWORDS_PER_BLOCK[index][level.index()])
}

/// Builds the interleaved codeword sequence for the symbol.
fn codewords(text: &str, mode: Mode, version: u8, level: EcLevel) -> Vec<u8> {
    let index = (version - 1) as usize;
    let blocks = usize::from(EC_BLOCKS[index][level.index()]);
    let ec_per_block = usize::from(EC_CODEWORDS_PER_BLOCK[index][level.index()]);
    let total = usize::from(TOTAL_CODEWORDS[index]);
    let data_total = total - blocks * ec_per_block;

    let mut bits = Bits::default();
    bits.push(mode.indicator(), 4);
    bits.push(mode.count(text) as u32, mode.count_bits(version));
    mode.encode(text, &mut bits);
    let capacity = data_total * 8;
    bits.push(0, (capacity - bits.len()).min(4) as u32);
    while bits.len() % 8 != 0 {
        bits.push(0, 1);
    }
    let mut data: Vec<u8> = bits.bytes();
    let mut pad = 0xEC;
    while data.len() < data_total {
        data.push(pad);
        pad = if pad == 0xEC { 0x11 } else { 0xEC };
    }

    // The last blocks hold one codeword more than the short ones.
    let short = data_total / blocks;
    let long_blocks = data_total % blocks;
    let mut chunks: Vec<&[u8]> = Vec::with_capacity(blocks);
    let mut offset = 0;
    for block in 0..blocks {
        let length = if block < blocks - long_blocks {
            short
        } else {
            short + 1
        };
        chunks.push(&data[offset..offset + length]);
        offset += length;
    }
    let mut error_blocks: Vec<Vec<u8>> = chunks
        .iter()
        .map(|chunk| reed_solomon(chunk, ec_per_block))
        .collect();

    let mut result = Vec::with_capacity(total);
    for position in 0..=short {
        for chunk in &chunks {
            if let Some(byte) = chunk.get(position) {
                result.push(*byte);
            }
        }
    }
    for position in 0..ec_per_block {
        for block in &mut error_blocks {
            result.push(block[position]);
        }
    }
    debug_assert_eq!(result.len(), total);
    result
}

/// Reed-Solomon error correction codewords for one block.
fn reed_solomon(data: &[u8], degree: usize) -> Vec<u8> {
    let divisor = generator(degree);
    let mut remainder = vec![0u8; degree];
    for byte in data {
        let factor = *byte ^ remainder[0];
        remainder.remove(0);
        remainder.push(0);
        for (slot, coefficient) in remainder.iter_mut().zip(divisor.iter()) {
            *slot ^= multiply(*coefficient, factor);
        }
    }
    remainder
}

/// Coefficients of the generator polynomial `(x - a^0) … (x - a^{degree-1})`, without the leading 1.
fn generator(degree: usize) -> Vec<u8> {
    let mut result = vec![0u8; degree];
    result[degree - 1] = 1;
    let mut root = 1u8;
    for _ in 0..degree {
        for index in 0..degree {
            result[index] = multiply(result[index], root);
            if index + 1 < degree {
                result[index] ^= result[index + 1];
            }
        }
        root = multiply(root, 0x02);
    }
    result
}

/// Multiplication in GF(2^8) with the QR polynomial `x^8 + x^4 + x^3 + x^2 + 1`.
fn multiply(left: u8, right: u8) -> u8 {
    let mut product = 0u32;
    let mut a = u32::from(left);
    let mut b = u32::from(right);
    while b != 0 {
        if b & 1 != 0 {
            product ^= a;
        }
        b >>= 1;
        a <<= 1;
        if a & 0x100 != 0 {
            a ^= 0x11D;
        }
    }
    product as u8
}

/// Bit buffer of the encoder.
#[derive(Default)]
struct Bits {
    bits: Vec<bool>,
}

impl Bits {
    /// Appends the `length` low bits of `value`, most significant first.
    fn push(&mut self, value: u32, length: u32) {
        for shift in (0..length).rev() {
            self.bits.push((value >> shift) & 1 == 1);
        }
    }

    fn len(&self) -> usize {
        self.bits.len()
    }

    /// Collects the finished bits into bytes; the buffer is a multiple of eight bits.
    fn bytes(&self) -> Vec<u8> {
        self.bits
            .chunks(8)
            .map(|chunk| {
                chunk
                    .iter()
                    .fold(0u8, |byte, bit| (byte << 1) | u8::from(*bit))
            })
            .collect()
    }
}

/// Module grid while the symbol is built.
struct Matrix {
    version: u8,
    mask: u8,
    size: usize,
    modules: Vec<bool>,
    function: Vec<bool>,
}

impl Matrix {
    fn new(version: u8) -> Self {
        let size = usize::from(version) * 4 + 17;
        Matrix {
            version,
            mask: 0,
            size,
            modules: vec![false; size * size],
            function: vec![false; size * size],
        }
    }

    fn set(&mut self, row: usize, column: usize, dark: bool) {
        self.modules[row * self.size + column] = dark;
    }

    fn set_function(&mut self, row: usize, column: usize, dark: bool) {
        self.set(row, column, dark);
        self.function[row * self.size + column] = true;
    }

    fn get(&self, row: usize, column: usize) -> bool {
        self.modules[row * self.size + column]
    }

    fn is_function(&self, row: usize, column: usize) -> bool {
        self.function[row * self.size + column]
    }

    /// Draws the function patterns, places the codewords and applies the best mask.
    fn draw(version: u8, level: EcLevel, codewords: &[u8]) -> Self {
        let mut matrix = Matrix::new(version);
        matrix.draw_finders();
        matrix.draw_timing();
        matrix.draw_alignment();
        matrix.draw_version();
        // Reserve the format areas so the data placement skips them; the bits are written with the
        // chosen mask at the end.
        matrix.draw_format(level, 0);
        matrix.draw_codewords(codewords);

        let mut best: Option<(u32, u8, Vec<bool>)> = None;
        for mask in 0..8u8 {
            let mut candidate = matrix.modules.clone();
            for row in 0..matrix.size {
                for column in 0..matrix.size {
                    if !matrix.is_function(row, column) && masked(mask, row, column) {
                        let index = row * matrix.size + column;
                        candidate[index] = !candidate[index];
                    }
                }
            }
            let mut scored = Matrix {
                version,
                mask,
                size: matrix.size,
                modules: candidate,
                function: matrix.function.clone(),
            };
            scored.write_format(level, mask);
            let penalty = scored.penalty();
            let better = match &best {
                None => true,
                Some((score, ..)) => penalty < *score,
            };
            if better {
                best = Some((penalty, mask, scored.modules));
            }
        }
        let (_, mask, modules) = best.expect("eight masks are evaluated");
        matrix.modules = modules;
        matrix.mask = mask;
        matrix
    }

    /// Finder patterns with their separators in three corners.
    fn draw_finders(&mut self) {
        for (row, column) in [(0usize, 0usize), (0, self.size - 7), (self.size - 7, 0)] {
            for dy in -1i32..=7 {
                for dx in -1i32..=7 {
                    let y = row as i32 + dy;
                    let x = column as i32 + dx;
                    if y < 0 || x < 0 || y >= self.size as i32 || x >= self.size as i32 {
                        continue;
                    }
                    let inside = (0..7).contains(&dy) && (0..7).contains(&dx);
                    let border = matches!(dy, 0 | 6) || matches!(dx, 0 | 6);
                    let core = (2..=4).contains(&dy) && (2..=4).contains(&dx);
                    let dark = inside && (border || core);
                    self.set_function(y as usize, x as usize, dark);
                }
            }
        }
    }

    /// Timing patterns along row and column six.
    fn draw_timing(&mut self) {
        for index in 0..self.size {
            let dark = index % 2 == 0;
            if !self.is_function(6, index) {
                self.set_function(6, index, dark);
            }
            if !self.is_function(index, 6) {
                self.set_function(index, 6, dark);
            }
        }
    }

    /// Alignment patterns on the norm's grid, skipping the three finder corners.
    fn draw_alignment(&mut self) {
        let positions = alignment_positions(self.version);
        if positions.is_empty() {
            return;
        }
        let last = positions.len() - 1;
        for (row_index, row) in positions.iter().enumerate() {
            for (column_index, column) in positions.iter().enumerate() {
                let corner = (row_index == 0 && column_index == 0)
                    || (row_index == 0 && column_index == last)
                    || (row_index == last && column_index == 0);
                if corner {
                    continue;
                }
                for dy in -2i32..=2 {
                    for dx in -2i32..=2 {
                        let dark = dx.abs().max(dy.abs()) != 1;
                        self.set_function(
                            (*row as i32 + dy) as usize,
                            (*column as i32 + dx) as usize,
                            dark,
                        );
                    }
                }
            }
        }
    }

    /// Version information blocks for versions seven and above.
    fn draw_version(&mut self) {
        if self.version < 7 {
            return;
        }
        let bits = version_bits(self.version);
        for index in 0..18 {
            let dark = (bits >> index) & 1 == 1;
            let a = self.size - 11 + index % 3;
            let b = index / 3;
            self.set_function(b, a, dark);
            self.set_function(a, b, dark);
        }
    }

    /// Reserves and writes the format information for `level` and `mask`.
    fn draw_format(&mut self, level: EcLevel, mask: u8) {
        let bits = format_bits(level, mask);
        for index in 0..=5 {
            self.set_function(index, 8, (bits >> index) & 1 == 1);
        }
        self.set_function(7, 8, (bits >> 6) & 1 == 1);
        self.set_function(8, 8, (bits >> 7) & 1 == 1);
        self.set_function(8, 7, (bits >> 8) & 1 == 1);
        for index in 9..15 {
            self.set_function(8, 14 - index, (bits >> index) & 1 == 1);
        }
        for index in 0..8 {
            self.set_function(8, self.size - 1 - index, (bits >> index) & 1 == 1);
        }
        for index in 8..15 {
            self.set_function(self.size - 15 + index, 8, (bits >> index) & 1 == 1);
        }
        self.set_function(self.size - 8, 8, true);
    }

    /// Writes the format bits without reserving modules again.
    fn write_format(&mut self, level: EcLevel, mask: u8) {
        let bits = format_bits(level, mask);
        for index in 0..=5 {
            self.set(index, 8, (bits >> index) & 1 == 1);
        }
        self.set(7, 8, (bits >> 6) & 1 == 1);
        self.set(8, 8, (bits >> 7) & 1 == 1);
        self.set(8, 7, (bits >> 8) & 1 == 1);
        for index in 9..15 {
            self.set(8, 14 - index, (bits >> index) & 1 == 1);
        }
        for index in 0..8 {
            self.set(8, self.size - 1 - index, (bits >> index) & 1 == 1);
        }
        for index in 8..15 {
            self.set(self.size - 15 + index, 8, (bits >> index) & 1 == 1);
        }
        self.set(self.size - 8, 8, true);
    }

    /// Places the codeword bits in the norm's two-module zigzag, bottom right first.
    fn draw_codewords(&mut self, codewords: &[u8]) {
        let mut index = 0usize;
        let mut right = self.size as i32 - 1;
        while right >= 1 {
            if right == 6 {
                right = 5;
            }
            for vertical in 0..self.size {
                for offset in 0..2 {
                    let column = (right - offset) as usize;
                    let upward = (right + 1) & 2 == 0;
                    let row = if upward {
                        self.size - 1 - vertical
                    } else {
                        vertical
                    };
                    if self.is_function(row, column) {
                        continue;
                    }
                    if index < codewords.len() * 8 {
                        let byte = codewords[index / 8];
                        let bit = (byte >> (7 - index % 8)) & 1 == 1;
                        self.set(row, column, bit);
                        index += 1;
                    }
                }
            }
            right -= 2;
        }
    }

    /// Penalty score of the norm for the current mask.
    fn penalty(&self) -> u32 {
        let size = self.size;
        let mut score = 0u32;

        for line in 0..size {
            let mut run = 1u32;
            let mut last = self.get(line, 0);
            for index in 1..size {
                let module = self.get(line, index);
                if module == last {
                    run += 1;
                } else {
                    if run >= 5 {
                        score += 3 + run - 5;
                    }
                    last = module;
                    run = 1;
                }
            }
            if run >= 5 {
                score += 3 + run - 5;
            }

            let mut run = 1u32;
            let mut last = self.get(0, line);
            for index in 1..size {
                let module = self.get(index, line);
                if module == last {
                    run += 1;
                } else {
                    if run >= 5 {
                        score += 3 + run - 5;
                    }
                    last = module;
                    run = 1;
                }
            }
            if run >= 5 {
                score += 3 + run - 5;
            }
        }

        for row in 0..size - 1 {
            for column in 0..size - 1 {
                let module = self.get(row, column);
                if module == self.get(row, column + 1)
                    && module == self.get(row + 1, column)
                    && module == self.get(row + 1, column + 1)
                {
                    score += 3;
                }
            }
        }

        for line in 0..size {
            let mut across = 0u32;
            let mut down = 0u32;
            for index in 0..size {
                across = ((across << 1) & 0x7FF) | u32::from(self.get(line, index));
                if index >= 10 && (across == 0x5D0 || across == 0x05D) {
                    score += 40;
                }
                down = ((down << 1) & 0x7FF) | u32::from(self.get(index, line));
                if index >= 10 && (down == 0x5D0 || down == 0x05D) {
                    score += 40;
                }
            }
        }

        let dark = self.modules.iter().filter(|module| **module).count() as u32;
        let total = (size * size) as u32;
        let steps = (dark * 100).div_ceil(total * 5);
        score += (steps as i32 - 10).unsigned_abs() * 10;
        score
    }

    fn into_code(self, level: EcLevel, mode: Mode) -> QrCode {
        QrCode {
            version: self.version,
            level,
            mode,
            mask: self.mask,
            size: self.size,
            modules: self.modules,
        }
    }
}

/// Mask condition of the norm for data module `(row, column)`.
fn masked(mask: u8, row: usize, column: usize) -> bool {
    match mask {
        0 => (row + column) % 2 == 0,
        1 => row % 2 == 0,
        2 => column % 3 == 0,
        3 => (row + column) % 3 == 0,
        4 => (row / 2 + column / 3) % 2 == 0,
        5 => (row * column) % 2 + (row * column) % 3 == 0,
        6 => ((row * column) % 2 + (row * column) % 3) % 2 == 0,
        _ => ((row * column) % 3 + (row + column) % 2) % 2 == 0,
    }
}

/// Centre coordinates of the alignment patterns of a version.
fn alignment_positions(version: u8) -> Vec<usize> {
    if version == 1 {
        return Vec::new();
    }
    let version_usize = usize::from(version);
    let count = version_usize / 7 + 2;
    let size = version_usize * 4 + 17;
    let step = if version == 32 {
        26
    } else {
        (version_usize * 4 + count * 2 + 1) / (count * 2 - 2) * 2
    };
    let mut positions = vec![0usize; count];
    positions[0] = 6;
    let mut position = size - 7;
    for slot in (1..count).rev() {
        positions[slot] = position;
        position -= step;
    }
    positions
}

/// Fifteen format bits: five data bits with the BCH(15, 5) check and the norm's mask.
fn format_bits(level: EcLevel, mask: u8) -> u32 {
    let data = (level.format_bits() << 3) | u32::from(mask);
    let mut remainder = data;
    for _ in 0..10 {
        remainder = (remainder << 1) ^ ((remainder >> 9) * 0x537);
    }
    ((data << 10) | remainder) ^ 0x5412
}

/// Eighteen version bits: six data bits with the BCH(18, 6) check.
fn version_bits(version: u8) -> u32 {
    let mut remainder = u32::from(version);
    for _ in 0..12 {
        remainder = (remainder << 1) ^ ((remainder >> 11) * 0x1F25);
    }
    (u32::from(version) << 12) | remainder
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_grow_by_four_modules() {
        for version in 1..=40u8 {
            assert_eq!(Matrix::new(version).size, usize::from(version) * 4 + 17);
            let code = qr("SOCDOF", EcLevel::Low).expect("encodes");
            assert_eq!(code.size(), 21, "a short payload stays at version one");
        }
    }

    #[test]
    fn the_mode_follows_the_payload() {
        assert_eq!(
            qr("0123456789", EcLevel::Medium).unwrap().mode(),
            Mode::Numeric
        );
        assert_eq!(
            qr("HELLO WORLD", EcLevel::Medium).unwrap().mode(),
            Mode::Alphanumeric
        );
        assert_eq!(
            qr("Hallo Welt", EcLevel::Medium).unwrap().mode(),
            Mode::Byte
        );
        assert_eq!(
            qr("https://socdof.app", EcLevel::Low).unwrap().mode(),
            Mode::Byte
        );
    }

    #[test]
    fn the_smallest_version_holds_the_payload() {
        // Version 1 holds 41 numeric characters at level L, 42 need version 2.
        assert_eq!(qr(&"1".repeat(41), EcLevel::Low).unwrap().version(), 1);
        assert_eq!(qr(&"1".repeat(42), EcLevel::Low).unwrap().version(), 2);
        // 7 bytes fit version 1 at level H, 8 need version 2.
        assert_eq!(qr(&"a".repeat(7), EcLevel::High).unwrap().version(), 1);
        assert_eq!(qr(&"a".repeat(8), EcLevel::High).unwrap().version(), 2);
        // 17 digits still fit version 1 at level H because numeric mode packs ten bits per three.
        assert_eq!(qr(&"1".repeat(17), EcLevel::High).unwrap().version(), 1);
        assert_eq!(qr(&"1".repeat(18), EcLevel::High).unwrap().version(), 2);
    }

    #[test]
    fn finder_timing_patterns_and_the_dark_module_are_placed() {
        let code = qr("SOCDOF", EcLevel::Medium).expect("encodes");
        let size = code.size();
        for (row, column) in [(0, 0), (0, size - 7), (size - 7, 0)] {
            for dy in 0..7 {
                for dx in 0..7 {
                    let border = matches!(dy, 0 | 6) || matches!(dx, 0 | 6);
                    let core = (2..=4).contains(&dy) && (2..=4).contains(&dx);
                    assert_eq!(
                        code.dark(row + dy, column + dx),
                        border || core,
                        "finder at {row},{column} offset {dy},{dx}"
                    );
                }
            }
        }
        for index in 8..size - 8 {
            assert_eq!(code.dark(6, index), index % 2 == 0, "timing row");
            assert_eq!(code.dark(index, 6), index % 2 == 0, "timing column");
        }
        assert!(code.dark(size - 8, 8), "the dark module is always set");
    }

    /// Remainder of a polynomial division over GF(2), used by the BCH checks below.
    fn remainder(mut value: u32, generator: u32) -> u32 {
        let generator_bits = 32 - generator.leading_zeros();
        while value != 0 && 32 - value.leading_zeros() >= generator_bits {
            value ^= generator << ((32 - value.leading_zeros()) - generator_bits);
        }
        value
    }

    #[test]
    fn the_format_bits_decode_to_the_level_and_mask() {
        for level in EcLevel::ALL {
            for mask in 0..8u8 {
                let bits = format_bits(level, mask);
                // The unmasked word is a BCH(15, 5) codeword, so it divides without remainder.
                assert_eq!(remainder(bits ^ 0x5412, 0x537), 0, "{level:?} mask {mask}");
                let data = (bits ^ 0x5412) >> 10;
                assert_eq!(data >> 3, level.format_bits());
                assert_eq!(data & 7, u32::from(mask));
            }
        }
    }

    #[test]
    fn the_published_format_strings_are_reproduced() {
        // The table of the norm, level L and masks 0 to 7.
        let published = [
            0b111011111000100,
            0b111001011110011,
            0b111110110101010,
            0b111100010011101,
            0b110011000101111,
            0b110001100011000,
            0b110110001000001,
            0b110100101110110,
        ];
        for (mask, expected) in published.iter().enumerate() {
            assert_eq!(
                format_bits(EcLevel::Low, mask as u8),
                *expected,
                "mask {mask}"
            );
        }
    }

    #[test]
    fn the_version_bits_carry_a_valid_bch_check() {
        for version in 7..=40u8 {
            let bits = version_bits(version);
            assert_eq!(remainder(bits, 0x1F25), 0, "version {version}");
            assert_eq!(bits >> 12, u32::from(version));
        }
        // The norm lists the eighteen bits of version seven as this value.
        assert_eq!(version_bits(7), 0b000111110010010100);
    }

    #[test]
    fn every_mask_is_used_somewhere() {
        let mut seen = std::collections::BTreeSet::new();
        for length in 1..40 {
            let code = qr(&"K".repeat(length), EcLevel::Medium).expect("encodes");
            seen.insert(code.mask());
        }
        assert!(seen.len() >= 4, "masks chosen: {seen:?}");
    }

    #[test]
    fn an_empty_payload_is_rejected() {
        assert_eq!(qr("", EcLevel::Medium), Err(QrError::Empty));
        assert_eq!(
            QrError::Empty.to_string(),
            "an empty payload has no QR code"
        );
    }

    #[test]
    fn a_payload_beyond_version_40_is_a_defined_error() {
        let error = qr(&"a".repeat(5000), EcLevel::High).unwrap_err();
        match error {
            QrError::TooLong { bytes, capacity } => {
                assert_eq!(bytes, 5000);
                assert_eq!(capacity, 1273, "version 40 at level H holds 1273 bytes");
            }
            other => panic!("unexpected error: {other:?}"),
        }
        // The largest version itself still encodes; one byte more does not.
        assert!(qr(&"a".repeat(1273), EcLevel::High).is_ok());
        assert!(qr(&"a".repeat(1274), EcLevel::High).is_err());
    }

    #[test]
    fn multibyte_payloads_count_bytes_in_byte_mode() {
        let text = "Müller & Söhne GmbH";
        let code = qr(text, EcLevel::Medium).expect("encodes");
        assert_eq!(code.mode(), Mode::Byte);
        assert_eq!(Mode::Byte.count(text), text.len());
        assert!(text.len() > text.chars().count());
    }
}
