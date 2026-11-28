//! Product link extraction for the catalogue.
//!
//! Port of `SOCDOF - TS/src/lib/productLinkExtractor.ts`: a pasted marketplace or shop URL yields
//! the article name, a SKU, the Amazon ASIN and the shop label that the product form fills in. The
//! module never opens a network connection; every value is derived from the URL itself.
//!
//! The reference generates random SKU numbers and fallback names. Here the SKU is derived
//! deterministically from the URL (the same link always produces the same SKU), and the fallback
//! names live in the UI catalogue instead of this module, because core code carries no visible
//! strings. The reference's `image_url` has no counterpart: the native catalogue has no image
//! backend and uses the emoji preview instead.

/// Marketplace or shop a link points to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LinkStore {
    /// Amazon with any regional domain.
    Amazon,
    /// OTTO.
    Otto,
    /// MediaMarkt.
    MediaMarkt,
    /// Saturn.
    Saturn,
    /// Digitec (Switzerland).
    Digitec,
    /// Galaxus.
    Galaxus,
    /// Geizhals price comparison.
    Geizhals,
    /// Idealo price comparison.
    Idealo,
    /// eBay marketplace.
    Ebay,
    /// Any other supplier or shop.
    Shop,
}

impl LinkStore {
    /// Label stored in `Product::source_domain`.
    ///
    /// Amazon keeps its regional domain (`Amazon (DE)`), the generic shop keeps the bare host, so
    /// the catalogue shows where the article came from without translating a brand.
    pub fn source_domain(self, host: &str) -> String {
        match self {
            LinkStore::Amazon => {
                let region = host.rsplit('.').next().unwrap_or_default().to_uppercase();
                format!("Amazon ({region})")
            }
            LinkStore::Otto => "OTTO".to_string(),
            LinkStore::MediaMarkt => "MediaMarkt".to_string(),
            LinkStore::Saturn => "Saturn".to_string(),
            LinkStore::Digitec => "Digitec Switzerland".to_string(),
            LinkStore::Galaxus => "Galaxus".to_string(),
            LinkStore::Geizhals => "Geizhals Preisvergleich".to_string(),
            LinkStore::Idealo => "Idealo".to_string(),
            LinkStore::Ebay => "eBay".to_string(),
            LinkStore::Shop => host.to_string(),
        }
    }
}

/// Data extracted from one product link.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ExtractedProduct {
    /// Marketplace the link belongs to.
    pub store: LinkStore,
    /// Label written to `Product::source_domain`.
    pub source_domain: String,
    /// Article name derived from the URL slug; `None` when the URL carries no usable title.
    pub name: Option<String>,
    /// SKU proposal (`AMZ-…`, `OTTO-…`, `WEB-…`).
    pub sku: Option<String>,
    /// Amazon ASIN, when the link carries one.
    pub asin: Option<String>,
    /// eBay item number, kept apart so the UI can format its own label.
    pub item_number: Option<String>,
}

/// Returns the Amazon ASIN of a bare ASIN, an Amazon URL or a query string.
pub fn extract_amazon_asin(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    if is_asin(trimmed) {
        return Some(trimmed.to_ascii_uppercase());
    }
    asin_in(trimmed).or_else(|| query_asin(trimmed))
}

/// Extracts the catalogue fields of a product link, or `None` when the input is no usable URL.
pub fn extract_product_from_url(raw: &str) -> Option<ExtractedProduct> {
    let url = parse_url(raw)?;
    let host = url.host.as_str();
    let store = classify(host)?;
    let source_domain = store.source_domain(host);
    let segments: Vec<&str> = url
        .path
        .split('/')
        .filter(|part| !part.is_empty())
        .collect();
    let last = segments.last().copied().unwrap_or_default();

    let (name, sku, asin, item_number) = match store {
        LinkStore::Amazon => {
            let asin = asin_in(&url.path).or_else(|| query_asin(&url.query));
            let title = amazon_title(&segments);
            let sku = match &asin {
                Some(code) => format!("AMZ-{code}"),
                None => format!("AMZ-{}", code(host, 1_000, 9_000)),
            };
            (title, Some(sku), asin, None)
        }
        LinkStore::Otto => {
            let title = slug_title(last);
            (
                title,
                Some(format!("OTTO-{}", code(host, 10_000, 90_000))),
                None,
                None,
            )
        }
        LinkStore::MediaMarkt | LinkStore::Saturn => {
            let title = slug_title(last.strip_suffix(".html").unwrap_or(last));
            (
                title,
                Some(format!("MM-{}", code(host, 10_000, 90_000))),
                None,
                None,
            )
        }
        LinkStore::Digitec | LinkStore::Galaxus => {
            let title = slug_title(last);
            (
                title,
                Some(format!("DG-{}", code(host, 10_000, 90_000))),
                None,
                None,
            )
        }
        LinkStore::Geizhals | LinkStore::Idealo => {
            let title = slug_title(strip_extension(last));
            (
                title,
                Some(format!("CMP-{}", code(host, 1_000, 9_000))),
                None,
                None,
            )
        }
        LinkStore::Ebay => {
            let number = ebay_item(&url.path);
            let sku = match &number {
                Some(number) => format!("EBAY-{number}"),
                None => format!("EBAY-{}", code(host, 1_000, 9_000)),
            };
            (None, Some(sku), None, number)
        }
        LinkStore::Shop => {
            let title = slug_title(strip_extension(last)).filter(|title| title.chars().count() > 2);
            (
                title,
                Some(format!("WEB-{}", code(host, 1_000, 9_000))),
                None,
                None,
            )
        }
    };

    Some(ExtractedProduct {
        store,
        source_domain,
        name,
        sku,
        asin,
        item_number,
    })
}

/// One parsed URL: host without `www.`, path and query.
struct ParsedUrl {
    host: String,
    path: String,
    query: String,
}

fn parse_url(raw: &str) -> Option<ParsedUrl> {
    let trimmed = raw.trim();
    if trimmed.is_empty() || trimmed.split_whitespace().count() > 1 {
        return None;
    }
    let without_scheme = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))
        .unwrap_or(trimmed);
    let (authority, rest) = match without_scheme.find('/') {
        Some(index) => (&without_scheme[..index], &without_scheme[index..]),
        None => (without_scheme, ""),
    };
    let authority = authority.rsplit('@').next().unwrap_or(authority);
    let host = authority
        .split(':')
        .next()
        .unwrap_or(authority)
        .to_lowercase();
    let host = host.strip_prefix("www.").unwrap_or(&host).to_string();
    if !host.contains('.') || host.starts_with('.') || host.ends_with('.') {
        return None;
    }

    let (path, query) = match rest.find('?') {
        Some(index) => (&rest[..index], &rest[index + 1..]),
        None => (rest, ""),
    };
    let query = query.split('#').next().unwrap_or_default();
    Some(ParsedUrl {
        host,
        path: path.to_string(),
        query: query.to_string(),
    })
}

fn classify(host: &str) -> Option<LinkStore> {
    if host.contains("amazon.") {
        return Some(LinkStore::Amazon);
    }
    if host.contains("otto.de") {
        return Some(LinkStore::Otto);
    }
    if host.contains("mediamarkt.") {
        return Some(LinkStore::MediaMarkt);
    }
    if host.contains("saturn.") {
        return Some(LinkStore::Saturn);
    }
    if host.contains("digitec.ch") {
        return Some(LinkStore::Digitec);
    }
    if host.contains("galaxus.") {
        return Some(LinkStore::Galaxus);
    }
    if host.contains("geizhals.") {
        return Some(LinkStore::Geizhals);
    }
    if host.contains("idealo.") {
        return Some(LinkStore::Idealo);
    }
    if host.contains("ebay.") {
        return Some(LinkStore::Ebay);
    }
    Some(LinkStore::Shop)
}

/// Path prefixes that carry an Amazon ASIN.
const ASIN_PREFIXES: [&str; 5] = [
    "/dp/",
    "/gp/product/",
    "/gp/aw/d/",
    "/d/",
    "/exec/obidos/ASIN/",
];

fn is_asin(value: &str) -> bool {
    value.len() == 10 && value.chars().all(|ch| ch.is_ascii_alphanumeric())
}

fn asin_in(value: &str) -> Option<String> {
    for prefix in ASIN_PREFIXES {
        let mut search = value;
        while let Some(index) = search.find(prefix) {
            let start = index + prefix.len();
            if let Some(candidate) = value.get(start..start + 10) {
                if is_asin(candidate) {
                    return Some(candidate.to_ascii_uppercase());
                }
            }
            search = &search[index + prefix.len()..];
        }
    }
    None
}

fn query_asin(value: &str) -> Option<String> {
    // Accepts a bare query as well as a whole URL, so a `?asin=` link is found either way.
    let query = match value.find('?') {
        Some(index) => &value[index + 1..],
        None => value,
    };
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
        if key.eq_ignore_ascii_case("asin") && is_asin(value) {
            return Some(value.to_ascii_uppercase());
        }
    }
    None
}

/// Title of the `/<slug>/dp/<ASIN>` form of an Amazon URL.
fn amazon_title(segments: &[&str]) -> Option<String> {
    if segments.len() < 2 || segments[1] != "dp" {
        return None;
    }
    slug_title(segments[0])
}

fn ebay_item(path: &str) -> Option<String> {
    let index = path.find("/itm/")?;
    let rest = &path[index + "/itm/".len()..];
    let digits: String = rest.chars().take_while(char::is_ascii_digit).collect();
    (!digits.is_empty()).then_some(digits)
}

fn strip_extension(value: &str) -> &str {
    for extension in [".html", ".php", ".asp", ".jsp"] {
        if let Some(stripped) = value.strip_suffix(extension) {
            return stripped;
        }
    }
    value
}

/// Turns a URL slug into a display name; `None` when nothing usable is left.
fn slug_title(slug: &str) -> Option<String> {
    let decoded = decode_component(slug);
    let title = decoded
        .replace(['-', '_'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if title.is_empty() {
        return None;
    }
    let mut chars = title.chars();
    chars
        .next()
        .map(|first| format!("{}{}", first.to_uppercase(), chars.as_str()))
}

/// Decodes `%XX` escapes and `+` as a space.
fn decode_component(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%'
            && index + 2 < bytes.len()
            && bytes[index + 1].is_ascii_hexdigit()
            && bytes[index + 2].is_ascii_hexdigit()
        {
            if let Ok(byte) = u8::from_str_radix(&value[index + 1..index + 3], 16) {
                out.push(byte);
                index += 3;
                continue;
            }
        }
        if bytes[index] == b'+' {
            out.push(b' ');
        } else {
            out.push(bytes[index]);
        }
        index += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Deterministic number in `start..start + span` for the given input (FNV-1a).
fn code(value: &str, start: u32, span: u32) -> String {
    let mut hash: u32 = 2_166_136_261;
    for byte in value.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(16_777_619);
    }
    format!("{}", start + hash % span)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_asin_from_bare_codes_urls_and_queries() {
        assert_eq!(
            extract_amazon_asin("b08n5wrwnw"),
            Some("B08N5WRWNW".to_string())
        );
        assert_eq!(
            extract_amazon_asin("https://www.amazon.de/dp/B08N5WRWNW?tag=x"),
            Some("B08N5WRWNW".to_string())
        );
        assert_eq!(
            extract_amazon_asin("https://www.amazon.de/gp/product/B08N5WRWNW"),
            Some("B08N5WRWNW".to_string())
        );
        assert_eq!(
            extract_amazon_asin("https://www.amazon.de/s?asin=B08N5WRWNW"),
            Some("B08N5WRWNW".to_string())
        );
        assert_eq!(extract_amazon_asin("https://example.com/dp/short"), None);
        assert_eq!(extract_amazon_asin(""), None);
    }

    #[test]
    fn extracts_an_amazon_article_with_slug_currency_and_sku() {
        let link = extract_product_from_url(
            "https://www.amazon.de/Kaffee-Vollautomat-Edelstahl/dp/B08N5WRWNW?ref=x",
        )
        .expect("amazon link");

        assert_eq!(link.store, LinkStore::Amazon);
        assert_eq!(link.source_domain, "Amazon (DE)");
        assert_eq!(link.name.as_deref(), Some("Kaffee Vollautomat Edelstahl"));
        assert_eq!(link.asin.as_deref(), Some("B08N5WRWNW"));
        assert_eq!(link.sku.as_deref(), Some("AMZ-B08N5WRWNW"));

        let without_slug = extract_product_from_url("https://amazon.co.uk/dp/B08N5WRWNW")
            .expect("amazon link without slug");
        assert_eq!(without_slug.source_domain, "Amazon (UK)");
        assert_eq!(without_slug.name, None);
    }

    #[test]
    fn extracts_the_title_of_every_supported_marketplace() {
        let otto =
            extract_product_from_url("https://www.otto.de/p/kuechenmaschine-1234/").expect("otto");
        assert_eq!(otto.store, LinkStore::Otto);
        assert_eq!(otto.source_domain, "OTTO");
        assert_eq!(otto.name.as_deref(), Some("Kuechenmaschine 1234"));

        let media =
            extract_product_from_url("https://www.mediamarkt.de/de/product/kaffeemaschine-42.html")
                .expect("mediamarkt");
        assert_eq!(media.store, LinkStore::MediaMarkt);
        assert_eq!(media.name.as_deref(), Some("Kaffeemaschine 42"));

        let saturn =
            extract_product_from_url("https://www.saturn.de/de/product/staubsauger-7.html")
                .expect("saturn");
        assert_eq!(saturn.store, LinkStore::Saturn);
        assert_eq!(saturn.source_domain, "Saturn");

        let digitec =
            extract_product_from_url("https://www.digitec.ch/de/s1/product/kopfhoerer-55")
                .expect("digitec");
        assert_eq!(digitec.store, LinkStore::Digitec);
        assert_eq!(digitec.source_domain, "Digitec Switzerland");
        assert_eq!(digitec.name.as_deref(), Some("Kopfhoerer 55"));

        let geizhals =
            extract_product_from_url("https://geizhals.de/tastatur-99.html").expect("geizhals");
        assert_eq!(geizhals.store, LinkStore::Geizhals);
        assert_eq!(geizhals.source_domain, "Geizhals Preisvergleich");

        let ebay = extract_product_from_url("https://www.ebay.de/itm/1234567890").expect("ebay");
        assert_eq!(ebay.store, LinkStore::Ebay);
        assert_eq!(ebay.source_domain, "eBay");
        assert_eq!(ebay.item_number.as_deref(), Some("1234567890"));
        assert_eq!(ebay.sku.as_deref(), Some("EBAY-1234567890"));
        assert_eq!(ebay.name, None);
    }

    #[test]
    fn extracts_a_generic_shop_link_and_decodes_the_slug() {
        let link = extract_product_from_url(
            "https://shop.example.com/produkte/bohrmaschine%20pro.html?ref=1",
        )
        .expect("shop link");
        assert_eq!(link.store, LinkStore::Shop);
        assert_eq!(link.source_domain, "shop.example.com");
        assert_eq!(link.name.as_deref(), Some("Bohrmaschine pro"));
        assert!(link
            .sku
            .as_deref()
            .is_some_and(|sku| sku.starts_with("WEB-")));

        let bare_host = extract_product_from_url("example.com").expect("host only");
        assert_eq!(bare_host.name, None);
        assert_eq!(bare_host.source_domain, "example.com");
    }

    #[test]
    fn the_same_link_always_yields_the_same_shop_sku() {
        let first = extract_product_from_url("https://example.com/artikel-1").expect("first");
        let second = extract_product_from_url("https://example.com/artikel-1").expect("second");
        assert_eq!(first.sku, second.sku);
        assert_eq!(first, second);
    }

    #[test]
    fn rejects_input_without_a_usable_host() {
        assert_eq!(extract_product_from_url(""), None);
        assert_eq!(extract_product_from_url("   "), None);
        assert_eq!(extract_product_from_url("kein link"), None);
        assert_eq!(extract_product_from_url("http://localhost/artikel"), None);
    }
}
