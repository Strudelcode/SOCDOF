//! A small XML reader for the WordprocessingML parts.
//!
//! The parts of a Word package are plain XML without DTDs or exotic features, so a compact
//! namespace-agnostic parser is enough: elements carry their qualified name and attributes, text is
//! kept as its own node, entities are decoded and comments, processing instructions and CDATA are
//! handled. Malformed input returns an error with the offset instead of panicking.

use super::DocxError;

/// Depth beyond which nested elements are rejected, so hostile input cannot exhaust the stack.
const MAX_DEPTH: usize = 128;

/// One node of the tree.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Node {
    /// An element with its children.
    Element(Element),
    /// Character data.
    Text(String),
}

/// An XML element.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Element {
    /// Qualified name as written, for example `w:p`.
    pub name: String,
    /// Attributes in document order, qualified names included.
    pub attributes: Vec<(String, String)>,
    /// Child nodes in document order.
    pub children: Vec<Node>,
}

impl Element {
    /// Name without its namespace prefix.
    pub fn local(&self) -> &str {
        self.name.rsplit(':').next().unwrap_or(&self.name)
    }

    /// Whether the element is the given local name.
    pub fn is(&self, local: &str) -> bool {
        self.local() == local
    }

    /// Child elements, text nodes skipped.
    pub fn elements(&self) -> impl Iterator<Item = &Element> {
        self.children.iter().filter_map(|node| match node {
            Node::Element(element) => Some(element),
            Node::Text(_) => None,
        })
    }

    /// Child elements with the given local name.
    pub fn children_named<'a>(&'a self, local: &str) -> impl Iterator<Item = &'a Element> + 'a {
        let local = local.to_string();
        self.elements()
            .filter(move |element| element.local() == local)
    }

    /// First direct child with the given local name.
    pub fn child(&self, local: &str) -> Option<&Element> {
        self.children_named(local).next()
    }

    /// First descendant (self included) with the given local name, depth first.
    pub fn find(&self, local: &str) -> Option<&Element> {
        if self.is(local) {
            return Some(self);
        }
        self.elements().find_map(|element| element.find(local))
    }

    /// Value of the attribute with the given local name.
    pub fn attribute(&self, local: &str) -> Option<&str> {
        self.attributes
            .iter()
            .find(|(name, _)| name.rsplit(':').next() == Some(local))
            .map(|(_, value)| value.as_str())
    }

    /// Concatenated character data of this element and its descendants.
    pub fn text(&self) -> String {
        let mut text = String::new();
        self.collect_text(&mut text);
        text
    }

    fn collect_text(&self, text: &mut String) {
        for node in &self.children {
            match node {
                Node::Text(value) => text.push_str(value),
                Node::Element(element) => element.collect_text(text),
            }
        }
    }
}

/// Parses a document and returns its root element.
pub fn parse(input: &str) -> Result<Element, DocxError> {
    let mut parser = Parser {
        chars: input.chars().collect(),
        position: 0,
    };
    parser.skip_prologue()?;
    let root = parser.element(0)?;
    parser.skip_misc();
    Ok(root)
}

/// Escapes text for an XML attribute or element body.
pub fn escape(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&apos;"),
            other => escaped.push(other),
        }
    }
    escaped
}

struct Parser {
    chars: Vec<char>,
    position: usize,
}

impl Parser {
    fn peek(&self) -> Option<char> {
        self.chars.get(self.position).copied()
    }

    fn starts_with(&self, pattern: &str) -> bool {
        pattern
            .chars()
            .enumerate()
            .all(|(offset, expected)| self.chars.get(self.position + offset) == Some(&expected))
    }

    fn advance(&mut self, count: usize) {
        self.position = (self.position + count).min(self.chars.len());
    }

    fn error(&self, message: &str) -> DocxError {
        DocxError::Xml(format!("{message} at offset {}", self.position))
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.peek(), Some(' ' | '\t' | '\r' | '\n')) {
            self.advance(1);
        }
    }

    /// Skips the XML declaration, doctypes, comments and whitespace before the root element.
    fn skip_prologue(&mut self) -> Result<(), DocxError> {
        loop {
            self.skip_whitespace();
            if self.starts_with("<?") {
                self.skip_until("?>")?;
            } else if self.starts_with("<!--") {
                self.skip_until("-->")?;
            } else if self.starts_with("<!") {
                self.skip_until(">")?;
            } else {
                return Ok(());
            }
        }
    }

    /// Skips comments, processing instructions and whitespace after the root element.
    fn skip_misc(&mut self) {
        loop {
            self.skip_whitespace();
            let skipped = if self.starts_with("<!--") {
                self.skip_until("-->").is_ok()
            } else if self.starts_with("<?") {
                self.skip_until("?>").is_ok()
            } else {
                false
            };
            if !skipped {
                return;
            }
        }
    }

    fn skip_until(&mut self, terminator: &str) -> Result<(), DocxError> {
        while self.position < self.chars.len() {
            if self.starts_with(terminator) {
                self.advance(terminator.chars().count());
                return Ok(());
            }
            self.advance(1);
        }
        Err(self.error(&format!("missing {terminator}")))
    }

    fn element(&mut self, depth: usize) -> Result<Element, DocxError> {
        if depth > MAX_DEPTH {
            return Err(self.error("elements are nested too deeply"));
        }
        if self.peek() != Some('<') {
            return Err(self.error("expected an element"));
        }
        self.advance(1);
        let mut name = String::new();
        while let Some(character) = self.peek() {
            if character.is_whitespace() || character == '/' || character == '>' {
                break;
            }
            name.push(character);
            self.advance(1);
        }
        if name.is_empty() {
            return Err(self.error("an element has no name"));
        }

        let mut attributes = Vec::new();
        loop {
            self.skip_whitespace();
            match self.peek() {
                None => return Err(self.error("the document ends inside an element")),
                Some('/') => {
                    self.advance(1);
                    if self.peek() != Some('>') {
                        return Err(self.error("expected > after /"));
                    }
                    self.advance(1);
                    return Ok(Element {
                        name,
                        attributes,
                        children: Vec::new(),
                    });
                }
                Some('>') => {
                    self.advance(1);
                    break;
                }
                Some(_) => {
                    let mut attribute = String::new();
                    while let Some(character) = self.peek() {
                        if character == '=' || character.is_whitespace() {
                            break;
                        }
                        attribute.push(character);
                        self.advance(1);
                    }
                    self.skip_whitespace();
                    if self.peek() != Some('=') {
                        return Err(self.error("an attribute has no value"));
                    }
                    self.advance(1);
                    self.skip_whitespace();
                    let quote = match self.peek() {
                        Some(quote @ ('"' | '\'')) => quote,
                        _ => return Err(self.error("an attribute value is not quoted")),
                    };
                    self.advance(1);
                    let mut value = String::new();
                    loop {
                        match self.peek() {
                            None => return Err(self.error("the document ends inside an attribute")),
                            Some(character) if character == quote => {
                                self.advance(1);
                                break;
                            }
                            Some('&') => value.push(self.entity()?),
                            Some(character) => {
                                value.push(character);
                                self.advance(1);
                            }
                        }
                    }
                    attributes.push((attribute, value));
                }
            }
        }

        let mut children = Vec::new();
        loop {
            if self.position >= self.chars.len() {
                return Err(self.error(&format!("element {name} is not closed")));
            }
            if self.starts_with("</") {
                self.advance(2);
                let mut closing = String::new();
                while let Some(character) = self.peek() {
                    if character == '>' {
                        break;
                    }
                    closing.push(character);
                    self.advance(1);
                }
                if self.peek() != Some('>') {
                    return Err(self.error("a closing tag is not terminated"));
                }
                self.advance(1);
                if closing.trim() != name {
                    return Err(self.error(&format!("element {name} is closed by {closing}")));
                }
                return Ok(Element {
                    name,
                    attributes,
                    children,
                });
            }
            if self.starts_with("<!--") {
                self.skip_until("-->")?;
                continue;
            }
            if self.starts_with("<?") {
                self.skip_until("?>")?;
                continue;
            }
            if self.starts_with("<![CDATA[") {
                self.advance("<![CDATA[".chars().count());
                let mut literal = String::new();
                loop {
                    if self.position >= self.chars.len() {
                        return Err(self.error("CDATA is not terminated"));
                    }
                    if self.starts_with("]]>") {
                        self.advance(3);
                        break;
                    }
                    literal.push(self.chars[self.position]);
                    self.advance(1);
                }
                children.push(Node::Text(literal));
                continue;
            }
            if self.peek() == Some('<') {
                children.push(Node::Element(self.element(depth + 1)?));
                continue;
            }
            let mut text = String::new();
            while let Some(character) = self.peek() {
                if character == '<' {
                    break;
                }
                if character == '&' {
                    text.push(self.entity()?);
                } else {
                    text.push(character);
                    self.advance(1);
                }
            }
            children.push(Node::Text(text));
        }
    }

    /// Reads an entity reference, `&` included.
    fn entity(&mut self) -> Result<char, DocxError> {
        if !self.starts_with("&") {
            return Err(self.error("expected an entity"));
        }
        self.advance(1);
        let mut reference = String::new();
        loop {
            match self.peek() {
                None => return Err(self.error("an entity is not terminated")),
                Some(';') => {
                    self.advance(1);
                    break;
                }
                Some(character) => {
                    reference.push(character);
                    self.advance(1);
                }
            }
        }
        let decoded = match reference.as_str() {
            "amp" => Some('&'),
            "lt" => Some('<'),
            "gt" => Some('>'),
            "quot" => Some('"'),
            "apos" => Some('\''),
            other => {
                let code = other
                    .strip_prefix("#x")
                    .or_else(|| other.strip_prefix("#X"))
                    .and_then(|hex| u32::from_str_radix(hex, 16).ok())
                    .or_else(|| other.strip_prefix('#').and_then(|dec| dec.parse().ok()));
                code.and_then(char::from_u32)
            }
        };
        decoded.ok_or_else(|| self.error(&format!("unknown entity &{reference};")))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_elements_attributes_and_text() {
        let root = parse(
            r#"<?xml version="1.0"?><!-- note --><w:document xmlns:w="urn:x"><w:body>
            <w:p><w:r><w:b/><w:t xml:space="preserve">Hallo &amp; Tschüss</w:t></w:r></w:p>
            <w:p/></w:body></w:document>"#,
        )
        .expect("parses");
        assert!(root.is("document"));
        // Namespace declarations keep their prefix, so the local name is the prefix itself.
        assert_eq!(root.attribute("w"), Some("urn:x"));
        let body = root.find("body").expect("body");
        assert_eq!(body.find("t").unwrap().attribute("space"), Some("preserve"));
        assert_eq!(body.children_named("p").count(), 2);
        let text = body.find("t").expect("t").text();
        assert_eq!(text, "Hallo & Tschüss");
    }

    #[test]
    fn decodes_numeric_entities_and_cdata() {
        let root = parse(r#"<a>&#65;&#x42;<![CDATA[<b>]]></a>"#).expect("parses");
        assert_eq!(root.text(), "AB<b>");
    }

    #[test]
    fn rejects_broken_input_without_panicking() {
        for source in [
            "",
            "<a>",
            "<a></b>",
            "<a b></a>",
            "<a b=1></a>",
            "text",
            "<a>&unknown;</a>",
            "<a><b></a>",
        ] {
            assert!(parse(source).is_err(), "{source} should not parse");
        }
    }

    #[test]
    fn rejects_deep_nesting() {
        let source = format!("{}{}", "<a>".repeat(300), "</a>".repeat(300));
        assert!(parse(&source).is_err());
    }

    #[test]
    fn escapes_all_markup_characters() {
        assert_eq!(
            escape("Müller & Söhne <GmbH> \"x\" 'y'"),
            "Müller &amp; Söhne &lt;GmbH&gt; &quot;x&quot; &apos;y&apos;"
        );
    }
}
