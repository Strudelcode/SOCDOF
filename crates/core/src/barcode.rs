//! Native Code 128 barcode encoding.
//!
//! The application prints barcodes without a JavaScript library, so the encoder lives in the core
//! and returns plain module bits: `true` is a bar, `false` a space. [`code128`] encodes the whole
//! printable ASCII range with code set B and appends the mandatory check symbol and the stop
//! pattern. A printer or PDF writer scales the returned modules to its millimetre grid.

/// Bar and space widths of every Code 128 symbol, indexed by symbol value.
///
/// Values 0 to 102 are data, 103 to 105 are the start symbols (A, B, C) and 106 is the stop
/// pattern, which is thirteen modules wide instead of eleven.
pub const CODE128_PATTERNS: [&str; 107] = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212",
    "221213", "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221",
    "223211", "221132", "221231", "213212", "223112", "312131", "311222", "321122", "321221",
    "312212", "322112", "322211", "212123", "212321", "232121", "111323", "131123", "131321",
    "112313", "132113", "132311", "211313", "231113", "231311", "112133", "112331", "132131",
    "113123", "113321", "133121", "313121", "211331", "231131", "213113", "213311", "213131",
    "311123", "311321", "331121", "312113", "312311", "332111", "314111", "221411", "431111",
    "111224", "111422", "121124", "121421", "141122", "141221", "112214", "112412", "122114",
    "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", "111242",
    "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
    "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311",
    "113141", "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

/// Symbol value of the start symbol for code set B.
pub const START_B: u32 = 104;
/// Symbol value of the stop pattern.
pub const STOP: u32 = 106;

/// Encodes `text` with Code 128 code set B.
///
/// Returns one entry per module in drawing order, or `None` when the text contains a character
/// outside the printable ASCII range (32 to 126) that code set B cannot represent.
pub fn code128(text: &str) -> Option<Vec<bool>> {
    let mut symbols = vec![START_B];
    for character in text.chars() {
        let code = character as u32;
        if !(32..=126).contains(&code) {
            return None;
        }
        symbols.push(code - 32);
    }
    let mut checksum = START_B;
    for (index, value) in symbols.iter().skip(1).enumerate() {
        checksum += value * (index as u32 + 1);
    }
    symbols.push(checksum % 103);
    symbols.push(STOP);
    Some(modules(&symbols))
}

/// Expands symbol values into modules; every symbol starts with a bar.
fn modules(symbols: &[u32]) -> Vec<bool> {
    let mut bits = Vec::new();
    for value in symbols {
        let pattern = CODE128_PATTERNS[*value as usize];
        let mut bar = true;
        for width in pattern.chars() {
            let length = width.to_digit(10).expect("pattern digit") as usize;
            bits.extend(std::iter::repeat(bar).take(length));
            bar = !bar;
        }
    }
    bits
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_pattern_table_has_the_published_widths() {
        assert_eq!(CODE128_PATTERNS.len(), 107);
        for (value, pattern) in CODE128_PATTERNS.iter().enumerate() {
            let width: u32 = pattern.chars().filter_map(|c| c.to_digit(10)).sum();
            let expected = if value == STOP as usize { 13 } else { 11 };
            assert_eq!(width, expected, "symbol {value} is {pattern}");
        }
    }

    #[test]
    fn encoding_starts_and_stops_with_the_standard_patterns() {
        let bits = code128("SOCDOF").expect("encodes");
        // start, six data symbols, check symbol, stop
        assert_eq!(bits.len(), 11 * 8 + 13);
        assert!(bits[0], "every symbol starts with a bar");
        assert_eq!(
            &bits[..11],
            modules(&[START_B]).as_slice(),
            "start symbol is code set B"
        );
        assert_eq!(
            &bits[bits.len() - 13..],
            modules(&[STOP]).as_slice(),
            "stop symbol closes the barcode"
        );
    }

    #[test]
    fn the_check_symbol_is_the_modulo_103_sum() {
        let bits = code128("SOCDOF").expect("encodes");
        // 104 + 51*1 + 47*2 + 35*3 + 36*4 + 47*5 + 38*6 = 961; 961 modulo 103 is 34.
        let expected = modules(&[34]);
        assert_eq!(&bits[11 * 7..11 * 8], expected.as_slice());
    }

    #[test]
    fn unsupported_characters_are_rejected() {
        assert!(code128("Socdof \u{00e4}").is_none());
        assert!(code128("\u{0007}").is_none());
        assert!(code128("").is_some(), "an empty payload is a valid barcode");
    }
}
