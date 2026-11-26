//! FatturaPA 1.2 importer. Mirrors the TypeScript `fatturaPaParser.ts` so the
//! invoice XML button creates a draft invoice and vendor instead of only
//! printing a hint. Parsing stays in the webview (DOMParser), persistence uses
//! the normal contact and invoice commands.

export interface ParsedFatturaLine {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface ParsedFattura {
  documentType: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  subject: string;
  seller: {
    name: string;
    taxId: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    pec: string;
  };
  buyer: {
    name: string;
    recipientCode: string;
  };
  lines: ParsedFatturaLine[];
  dueDate: string;
  paymentIban: string;
  paymentBank: string;
  bollo: boolean;
  bolloAmount: number;
  cup: string;
  cig: string;
}

function textOf(tag: string, context: ParentNode): string {
  const elements = context.querySelectorAll("*");
  for (const element of elements) {
    if (element.localName.toLowerCase() === tag.toLowerCase()) {
      return (element.textContent ?? "").trim();
    }
  }
  return "";
}

function numberValue(value: string): number {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function blockOf(tag: string, context: ParentNode): ParentNode {
  const elements = context.querySelectorAll("*");
  for (const element of elements) {
    if (element.localName.toLowerCase() === tag.toLowerCase()) {
      return element;
    }
  }
  return context;
}

export function parseFatturaPa(xml: string): ParsedFattura {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("XML-Parsing-Fehler: ungültige FatturaPA-Struktur");
  }
  const seller = blockOf("CedentePrestatore", doc);
  const buyer = blockOf("CessionarioCommittente", doc);
  const payment = blockOf("DatiPagamento", doc);
  const bollo = blockOf("DatiBollo", doc);

  const sellerName =
    textOf("Denominazione", seller) ||
    `${textOf("Nome", seller)} ${textOf("Cognome", seller)}`.trim();
  const buyerName =
    textOf("Denominazione", buyer) ||
    `${textOf("Nome", buyer)} ${textOf("Cognome", buyer)}`.trim();

  const lines: ParsedFatturaLine[] = [];
  for (const element of doc.querySelectorAll("*")) {
    if (element.localName.toLowerCase() !== "dettagliolinee") continue;
    const quantity = numberValue(textOf("Quantita", element)) || 1;
    const unitPrice = numberValue(textOf("PrezzoUnitario", element));
    const lineTotal = numberValue(textOf("PrezzoTotale", element)) || quantity * unitPrice;
    lines.push({
      description: textOf("Descrizione", element) || `Pos. ${lines.length + 1}`,
      quantity,
      unitPrice: unitPrice || lineTotal / quantity,
      taxRate: numberValue(textOf("AliquotaIVA", element)) || 22,
    });
  }

  const total = numberValue(textOf("ImportoTotaleDocumento", doc));
  const rawDate = textOf("Data", doc).slice(0, 10);
  const invoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : new Date().toISOString().slice(0, 10);
  const dueDate =
    textOf("DataScadenzaPagamento", payment).slice(0, 10) || invoiceDate;

  if (lines.length === 0 && total > 0) {
    lines.push({
      description: `Fattura elettronica ${textOf("Numero", doc)}`,
      quantity: 1,
      unitPrice: total / 1.22,
      taxRate: 22,
    });
  }
  if (lines.length === 0) {
    throw new Error("FatturaPA enthält keine Rechnungspositionen");
  }

  return {
    documentType: textOf("TipoDocumento", doc) || "TD01",
    invoiceNumber: textOf("Numero", doc) || `PA-${Date.now().toString().slice(-6)}`,
    invoiceDate,
    totalAmount: total || lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    subject: textOf("Causale", doc),
    seller: {
      name: sellerName || "Fornitore sconosciuto",
      taxId: textOf("IdCodice", seller) || textOf("CodiceFiscale", seller),
      street: textOf("Indirizzo", seller),
      zip: textOf("CAP", seller),
      city: textOf("Comune", seller),
      country: textOf("IdPaese", seller) || "IT",
      pec: textOf("PECDestinatario", seller),
    },
    buyer: {
      name: buyerName || "Cliente sconosciuto",
      recipientCode: textOf("CodiceDestinatario", buyer),
    },
    lines,
    dueDate,
    paymentIban: textOf("IBAN", payment),
    paymentBank: textOf("IstitutoFinanziario", payment),
    bollo: Boolean(textOf("BolloVirtuale", bollo)) || bollo !== doc,
    bolloAmount: numberValue(textOf("ImportoBollo", bollo)) || 2,
    cup: textOf("CodiceCUP", doc),
    cig: textOf("CodiceCIG", doc),
  };
}
