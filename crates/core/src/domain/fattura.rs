//! FatturaPA 1.2 XML generation, ported from `lib/fatturaPaGenerator.ts`.
//!
//! The generator works completely offline: it turns the stored invoice, company and contact into
//! the SdI XML, derives the standard file name and validates the required sections.

use std::collections::BTreeMap;

use crate::date;
use crate::domain::contact::Contact;
use crate::domain::invoice::Invoice;
use crate::domain::settings::CompanyProfile;

/// Optional fields of the SdI inspector.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct FatturaOptions {
    /// `TD01` (invoice), `TD04` (credit note), `TD24` (deferred invoice).
    pub document_type: String,
    /// `RF01` (ordinary) or another regime code.
    pub regime_fiscale: String,
    /// Seven-character recipient code, six for a public administration.
    pub recipient_code: String,
    /// Certified e-mail of the recipient.
    pub pec: String,
    /// Whether the two-euro stamp duty applies.
    pub bollo: bool,
    /// Tender reference CUP.
    pub cup: String,
    /// Tender reference CIG.
    pub cig: String,
}

/// Generated XML and the SdI file name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FatturaDocument {
    /// Complete `p:FatturaElettronica` document.
    pub xml: String,
    /// Standard file name `IT<VAT>_<PROGRESSIVE>.xml`.
    pub file_name: String,
}

fn alphanumeric(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect()
}

fn progressive(invoice: &Invoice) -> String {
    let digits = alphanumeric(&invoice.number);
    let tail: String = digits
        .chars()
        .rev()
        .take(5)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect();
    format!("{tail:0>5}")
}

fn transmitter_vat(company: &CompanyProfile) -> String {
    let vat = alphanumeric(&company.tax_id);
    if vat.is_empty() {
        "00000000000".to_string()
    } else {
        vat
    }
}

fn transmitter_country(company: &CompanyProfile) -> String {
    let country = company.country.trim();
    if country.len() == 2 {
        country.to_uppercase()
    } else {
        "IT".to_string()
    }
}

fn customer_country(contact: Option<&Contact>) -> String {
    contact
        .and_then(|contact| contact.country.as_deref())
        .map(str::trim)
        .filter(|country| country.len() == 2)
        .map(str::to_uppercase)
        .unwrap_or_else(|| "IT".to_string())
}

fn customer_name(contact: Option<&Contact>) -> String {
    contact
        .and_then(|contact| {
            contact
                .company_name
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .or_else(|| {
                    contact
                        .name
                        .as_deref()
                        .map(str::trim)
                        .filter(|value| !value.is_empty())
                })
        })
        .unwrap_or("Cliente")
        .to_string()
}

/// Standard Italian file name for the invoice.
pub fn file_name(invoice: &Invoice, company: &CompanyProfile) -> String {
    format!(
        "IT{}_{}.xml",
        transmitter_vat(company),
        progressive(invoice)
    )
}

/// Escapes the five XML special characters.
pub fn escape_xml(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn iso_date(ms: i64) -> String {
    let (year, month, day) = date::civil_from_millis(ms);
    format!("{year:04}-{month:02}-{day:02}")
}

fn amount(cents: i64) -> String {
    format!("{:.2}", cents as f64 / 100.0)
}

fn quantity(milli: i64) -> String {
    format!("{:.2}", milli as f64 / 1000.0)
}

/// Generates the FatturaPA 1.2 XML from the stored business data.
pub fn generate(
    invoice: &Invoice,
    company: &CompanyProfile,
    contact: Option<&Contact>,
    payment_method: Option<&str>,
    options: &FatturaOptions,
) -> FatturaDocument {
    let transmitter_country = transmitter_country(company);
    let transmitter_vat = transmitter_vat(company);
    let regime = if options.regime_fiscale.trim().is_empty() {
        "RF01"
    } else {
        options.regime_fiscale.trim()
    };
    let customer_country = customer_country(contact);
    let customer_vat = contact
        .and_then(|contact| contact.tax_id.as_deref())
        .map(alphanumeric)
        .unwrap_or_default();
    let fiscal_code = if customer_vat.len() == 16 {
        format!("<CodiceFiscale>{customer_vat}</CodiceFiscale>")
    } else {
        String::new()
    };
    let vat_block = if customer_vat.is_empty() {
        String::new()
    } else {
        format!(
            "<IdFiscaleIVA><IdPaese>{customer_country}</IdPaese><IdCodice>{customer_vat}</IdCodice></IdFiscaleIVA>"
        )
    };
    let is_pa = options.recipient_code.trim().len() == 6;
    let transmission_format = if is_pa { "FPA12" } else { "FPR12" };
    let recipient_code = if options.recipient_code.trim().is_empty() {
        if is_pa { "999999" } else { "0000000" }.to_string()
    } else {
        options.recipient_code.trim().to_uppercase()
    };
    let pec = if !options.pec.trim().is_empty() {
        options.pec.trim().to_string()
    } else {
        contact
            .and_then(|contact| contact.email.clone())
            .filter(|email| email.contains('@'))
            .unwrap_or_default()
    };
    let pec_xml = if !pec.is_empty() && recipient_code == "0000000" {
        format!("<PECDestinatario>{}</PECDestinatario>", escape_xml(&pec))
    } else {
        String::new()
    };
    let document_type = if options.document_type.trim().is_empty() {
        "TD01"
    } else {
        options.document_type.trim()
    };
    let currency = {
        let value = company.currency.trim();
        if value.len() == 3 && value.chars().all(|ch| ch.is_ascii_alphabetic()) {
            value.to_uppercase()
        } else {
            "EUR".to_string()
        }
    };
    let payment_code = match payment_method.unwrap_or("transfer") {
        "card" => "MP08",
        "cash" => "MP01",
        _ => "MP05",
    };
    let street = company.street.trim();
    let (zip, city) = {
        let mut parts = company.zip_city.trim().splitn(2, ' ');
        (
            parts.next().unwrap_or("00100").to_string(),
            parts.next().unwrap_or("Roma").to_string(),
        )
    };
    let customer_street = contact
        .and_then(|contact| contact.street.as_deref())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Indirizzo non specificato");
    let customer_zip = contact
        .and_then(|contact| contact.zip.as_deref())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("00100");
    let customer_city = contact
        .and_then(|contact| contact.city.as_deref())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("Roma");

    let mut lines_xml = String::new();
    let mut summaries: BTreeMap<i64, (i64, i64)> = BTreeMap::new();
    for (index, line) in invoice.lines.iter().enumerate() {
        let net = line.net().cents();
        let tax = line.tax().cents();
        let entry = summaries.entry(line.tax_rate_bp).or_insert((0, 0));
        entry.0 += net;
        entry.1 += tax;
        lines_xml.push_str(&format!(
            "      <DettaglioLinee>\n        <NumeroLinea>{}</NumeroLinea>\n        <Descrizione>{}</Descrizione>\n        <Quantita>{}</Quantita>\n        <PrezzoUnitario>{}</PrezzoUnitario>\n        <PrezzoTotale>{}</PrezzoTotale>\n        <AliquotaIVA>{:.2}</AliquotaIVA>\n      </DettaglioLinee>\n",
            index + 1,
            escape_xml(if line.description.trim().is_empty() {
                "Articolo"
            } else {
                line.description.trim()
            }),
            quantity(line.quantity_milli),
            amount(line.unit_price.cents()),
            amount(net),
            line.tax_rate_bp as f64 / 100.0
        ));
    }
    let mut summary_xml = String::new();
    for (rate, (net, tax)) in summaries {
        summary_xml.push_str(&format!(
            "      <DatiRiepilogo>\n        <AliquotaIVA>{:.2}</AliquotaIVA>\n        <ImponibileImporto>{}</ImponibileImporto>\n        <Imposta>{}</Imposta>\n        <EsigibilitaIVA>I</EsigibilitaIVA>\n      </DatiRiepilogo>\n",
            rate as f64 / 100.0,
            amount(net),
            amount(tax)
        ));
    }
    let bollo_xml = if options.bollo {
        "<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>2.00</ImportoBollo></DatiBollo>"
            .to_string()
    } else {
        String::new()
    };
    let order_xml = if options.cup.trim().is_empty() && options.cig.trim().is_empty() {
        String::new()
    } else {
        let cup = if options.cup.trim().is_empty() {
            String::new()
        } else {
            format!("<CodiceCUP>{}</CodiceCUP>", escape_xml(options.cup.trim()))
        };
        let cig = if options.cig.trim().is_empty() {
            String::new()
        } else {
            format!("<CodiceCIG>{}</CodiceCIG>", escape_xml(options.cig.trim()))
        };
        format!("<DatiOrdineAcquisto><RiferimentoNumeroLinea>1</RiferimentoNumeroLinea>{cup}{cig}</DatiOrdineAcquisto>")
    };
    let causale = invoice
        .note
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Vendita beni e servizi");
    let iban = company.iban.replace(' ', "");
    let iban_xml = if iban.is_empty() {
        String::new()
    } else {
        format!("<IBAN>{}</IBAN>", escape_xml(&iban))
    };

    let xml = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<p:FatturaElettronica versione=\"{transmission_format}\" xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\" xmlns:p=\"http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2\" xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xsi:schemaLocation=\"http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_flusso_FatturaPA_v1.2.xsd\">\n  <FatturaElettronicaHeader>\n    <DatiTrasmissione>\n      <IdTrasmittente><IdPaese>{transmitter_country}</IdPaese><IdCodice>{transmitter_vat}</IdCodice></IdTrasmittente>\n      <ProgressivoInvio>{}</ProgressivoInvio>\n      <FormatoTrasmissione>{transmission_format}</FormatoTrasmissione>\n      <CodiceDestinatario>{recipient_code}</CodiceDestinatario>{pec_xml}\n    </DatiTrasmissione>\n    <CedentePrestatore>\n      <DatiAnagrafici>\n        <IdFiscaleIVA><IdPaese>{transmitter_country}</IdPaese><IdCodice>{transmitter_vat}</IdCodice></IdFiscaleIVA>\n        <Anagrafica><Denominazione>{}</Denominazione></Anagrafica>\n        <RegimeFiscale>{regime}</RegimeFiscale>\n      </DatiAnagrafici>\n      <Sede><Indirizzo>{}</Indirizzo><CAP>{zip}</CAP><Comune>{}</Comune><Nazione>{transmitter_country}</Nazione></Sede>\n    </CedentePrestatore>\n    <CessionarioCommittente>\n      <DatiAnagrafici>{vat_block}{fiscal_code}<Anagrafica><Denominazione>{}</Denominazione></Anagrafica></DatiAnagrafici>\n      <Sede><Indirizzo>{}</Indirizzo><CAP>{}</CAP><Comune>{}</Comune><Nazione>{customer_country}</Nazione></Sede>\n    </CessionarioCommittente>\n  </FatturaElettronicaHeader>\n  <FatturaElettronicaBody>\n    <DatiGenerali>\n      <DatiGeneraliDocumento>\n        <TipoDocumento>{document_type}</TipoDocumento>\n        <Divisa>{currency}</Divisa>\n        <Data>{}</Data>\n        <Numero>{}</Numero>\n        <ImportoTotaleDocumento>{}</ImportoTotaleDocumento>\n        <Causale>{}</Causale>{bollo_xml}\n      </DatiGeneraliDocumento>{order_xml}\n    </DatiGenerali>\n    <DatiBeniServizi>\n{lines_xml}{summary_xml}    </DatiBeniServizi>\n    <DatiPagamento>\n      <CondizioniPagamento>TP02</CondizioniPagamento>\n      <DettaglioPagamento>\n        <ModalitaPagamento>{payment_code}</ModalitaPagamento>\n        <DataScadenzaPagamento>{}</DataScadenzaPagamento>\n        <ImportoPagamento>{}</ImportoPagamento>{iban_xml}\n      </DettaglioPagamento>\n    </DatiPagamento>\n  </FatturaElettronicaBody>\n</p:FatturaElettronica>",
        progressive(invoice),
        escape_xml(if company.name.trim().is_empty() {
            "Azienda"
        } else {
            company.name.trim()
        }),
        escape_xml(if street.is_empty() { "Via Roma" } else { street }),
        escape_xml(if city.is_empty() { "Roma" } else { &city }),
        escape_xml(&customer_name(contact)),
        escape_xml(customer_street),
        escape_xml(customer_zip),
        escape_xml(customer_city),
        iso_date(invoice.issued_at),
        escape_xml(&invoice.number),
        amount(invoice.total_gross().cents()),
        escape_xml(causale),
        iso_date(if invoice.due_at > 0 {
            invoice.due_at
        } else {
            invoice.issued_at
        }),
        amount(invoice.total_gross().cents()),
    );
    FatturaDocument {
        xml,
        file_name: file_name(invoice, company),
    }
}

/// Validates the required FatturaPA sections, matching the TypeScript inspector.
pub fn validate(xml: &str) -> Vec<String> {
    let required = [
        (
            "<FatturaElettronicaHeader>",
            "Elemento obbligatorio mancante: <FatturaElettronicaHeader>",
        ),
        (
            "<FatturaElettronicaBody>",
            "Elemento obbligatorio mancante: <FatturaElettronicaBody>",
        ),
        (
            "<CedentePrestatore>",
            "Dati cedente/prestatore mancanti (<CedentePrestatore>)",
        ),
        (
            "<CessionarioCommittente>",
            "Dati cliente mancanti (<CessionarioCommittente>)",
        ),
        (
            "<DatiBeniServizi>",
            "Dati articoli e imponibile mancanti (<DatiBeniServizi>)",
        ),
    ];
    required
        .iter()
        .filter(|(tag, _)| !xml.contains(tag))
        .map(|(_, message)| (*message).to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::invoice::{InvoiceLine, InvoiceStatus};
    use crate::money::Money;
    use uuid::Uuid;

    fn company() -> CompanyProfile {
        CompanyProfile {
            name: "Beispiel GmbH".to_string(),
            street: "Hauptstraße 1".to_string(),
            zip_city: "10115 Berlin".to_string(),
            country: "DE".to_string(),
            tax_id: "DE123456789".to_string(),
            currency: "EUR".to_string(),
            iban: "DE12 3456 7890".to_string(),
            ..CompanyProfile::default()
        }
    }

    fn invoice() -> Invoice {
        Invoice {
            id: Uuid::nil(),
            number: "2026-0001".to_string(),
            contact_id: Uuid::nil(),
            status: InvoiceStatus::Sent,
            issued_at: 1_760_000_000_000,
            due_at: 1_762_592_000_000,
            currency_symbol: "€".to_string(),
            note: Some("Beratung <&> Service".to_string()),
            tax_total_override_cents: None,
            lines: vec![InvoiceLine {
                description: "Beratung".to_string(),
                quantity_milli: 2_000,
                unit_price: Money::from_cents(10_000),
                tax_rate_bp: 1900,
            }],
        }
    }

    #[test]
    fn generates_a_valid_document_and_file_name() {
        let document = generate(
            &invoice(),
            &company(),
            None,
            Some("card"),
            &FatturaOptions::default(),
        );
        assert!(document.file_name.starts_with("ITDE123456789_"));
        assert!(document.file_name.ends_with(".xml"));
        assert!(document
            .xml
            .starts_with("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
        assert!(document
            .xml
            .contains("<FormatoTrasmissione>FPR12</FormatoTrasmissione>"));
        assert!(document
            .xml
            .contains("<CodiceDestinatario>0000000</CodiceDestinatario>"));
        assert!(document.xml.contains("<NumeroLinea>1</NumeroLinea>"));
        assert!(document
            .xml
            .contains("<ImportoTotaleDocumento>238.00</ImportoTotaleDocumento>"));
        assert!(document
            .xml
            .contains("<ModalitaPagamento>MP08</ModalitaPagamento>"));
        assert!(document.xml.contains("Beratung &lt;&amp;&gt; Service"));
        assert!(validate(&document.xml).is_empty());
    }

    #[test]
    fn public_administration_uses_six_character_code() {
        let options = FatturaOptions {
            recipient_code: "ABCDEF".to_string(),
            pec: "pa@example.it".to_string(),
            document_type: "TD04".to_string(),
            bollo: true,
            cup: "CUP123".to_string(),
            cig: "CIG456".to_string(),
            ..FatturaOptions::default()
        };
        let document = generate(&invoice(), &company(), None, None, &options);
        assert!(document
            .xml
            .contains("<FormatoTrasmissione>FPA12</FormatoTrasmissione>"));
        assert!(document.xml.contains("<TipoDocumento>TD04</TipoDocumento>"));
        assert!(document.xml.contains("<BolloVirtuale>SI</BolloVirtuale>"));
        assert!(document.xml.contains("<CodiceCUP>CUP123</CodiceCUP>"));
        assert!(document
            .xml
            .contains("<ModalitaPagamento>MP05</ModalitaPagamento>"));
    }

    #[test]
    fn validation_reports_every_missing_section() {
        assert_eq!(validate("").len(), 5);
        assert!(validate(
            &generate(
                &invoice(),
                &company(),
                None,
                None,
                &FatturaOptions::default()
            )
            .xml
        )
        .is_empty());
    }
}
