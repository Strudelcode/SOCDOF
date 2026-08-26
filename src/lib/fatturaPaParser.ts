import { Invoice, InvoiceItem, Contact } from '../types';

export interface ParsedFatturaPa {
  documentType: string; // e.g. TD01 (Fattura), TD04 (Nota di credito)
  currency: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  subtotal: number;
  taxTotal: number;
  
  // Seller / Supplier
  seller: {
    name: string;
    taxId: string;
    vatCountry: string;
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
    pec?: string;
  };

  // Buyer / Customer
  buyer: {
    name: string;
    taxId: string;
    vatCountry: string;
    street?: string;
    zip?: string;
    city?: string;
    country?: string;
    pec?: string;
    recipientCode?: string;
  };

  // Line items
  items: InvoiceItem[];

  // Payment details
  payment?: {
    method?: string;
    dueDate?: string;
    amount?: number;
    iban?: string;
    bankName?: string;
  };

  rawXml?: string;
}

/**
 * Parses an official Italian FatturaPA (SdI) XML string into structured data.
 */
export function parseFatturaPaXml(xmlString: string): ParsedFatturaPa {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // Check for XML parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML-Parsing-Fehler: ${parseError.textContent || 'Ungültige XML-Struktur'}`);
  }

  // Helper to extract text safely from first matching tag (supports namespaces)
  const getText = (selector: string, context: Element | Document = doc): string => {
    // Try standard selector or lower-case / tag name match
    const el = context.querySelector(selector);
    if (el && el.textContent) return el.textContent.trim();

    // Fallback: search by localName ignoring namespace prefix
    const tags = selector.split(' ');
    let currentCtx: Element | Document = context;
    for (const tag of tags) {
      const allEls = currentCtx.getElementsByTagName('*');
      let found: Element | null = null;
      for (let i = 0; i < allEls.length; i++) {
        if (allEls[i].localName.toLowerCase() === tag.toLowerCase()) {
          found = allEls[i];
          break;
        }
      }
      if (!found) return '';
      currentCtx = found;
    }
    return (currentCtx as Element).textContent?.trim() || '';
  };

  const getNum = (selector: string, context: Element | Document = doc): number => {
    const val = getText(selector, context);
    if (!val) return 0;
    const clean = val.replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };

  // 1. Document general data
  const docType = getText('TipoDocumento') || 'TD01';
  const currency = getText('Divisa') || 'EUR';
  const invoiceNumber = getText('Numero') || `PA-${Date.now().toString().slice(-6)}`;
  const rawDate = getText('Data') || new Date().toISOString().slice(0, 10);
  const invoiceDate = rawDate.slice(0, 10);
  const totalAmount = getNum('ImportoTotaleDocumento');

  // 2. Seller (CedentePrestatore)
  const sellerEl = doc.querySelector('CedentePrestatore') || doc.getElementsByTagName('CedentePrestatore')[0];
  const sellerDenom = getText('Denominazione', sellerEl) || 
    `${getText('Nome', sellerEl)} ${getText('Cognome', sellerEl)}`.trim();
  const sellerVat = getText('IdCodice', sellerEl) || getText('CodiceFiscale', sellerEl);
  const sellerCountry = getText('IdPaese', sellerEl) || 'IT';
  const sellerStreet = getText('Indirizzo', sellerEl);
  const sellerZip = getText('CAP', sellerEl);
  const sellerCity = getText('Comune', sellerEl);

  // 3. Buyer (CessionarioCommittente)
  const buyerEl = doc.querySelector('CessionarioCommittente') || doc.getElementsByTagName('CessionarioCommittente')[0];
  const buyerDenom = getText('Denominazione', buyerEl) || 
    `${getText('Nome', buyerEl)} ${getText('Cognome', buyerEl)}`.trim();
  const buyerVat = getText('IdCodice', buyerEl) || getText('CodiceFiscale', buyerEl);
  const buyerCountry = getText('IdPaese', buyerEl) || 'IT';
  const buyerStreet = getText('Indirizzo', buyerEl);
  const buyerZip = getText('CAP', buyerEl);
  const buyerCity = getText('Comune', buyerEl);
  const recipientCode = getText('CodiceDestinatario');
  const pecDestinatario = getText('PECDestinatario');

  // 4. Line items (DettaglioLinee)
  const lineNodes = doc.getElementsByTagName('DettaglioLinee');
  const items: InvoiceItem[] = [];

  let calcSubtotal = 0;
  let calcTaxTotal = 0;

  for (let i = 0; i < lineNodes.length; i++) {
    const node = lineNodes[i];
    const desc = getText('Descrizione', node) || `Pos. ${i + 1}`;
    const qty = getNum('Quantita', node) || 1;
    const unitPrice = getNum('PrezzoUnitario', node) || 0;
    const lineTotal = getNum('PrezzoTotale', node) || (qty * unitPrice);
    const taxRate = getNum('AliquotaIVA', node) || 22;

    const itemSub = lineTotal;
    const itemTax = (itemSub * taxRate) / 100;
    calcSubtotal += itemSub;
    calcTaxTotal += itemTax;

    items.push({
      id: `item_${Date.now()}_${i}`,
      product_id: 1,
      product_name: desc,
      sku: `POS-${(i + 1).toString().padStart(3, '0')}`,
      qty,
      unit_price: unitPrice,
      tax_rate: taxRate,
      discount: 0,
      subtotal: itemSub
    });
  }

  // If no detailed lines were found, synthesize a single general line
  if (items.length === 0 && totalAmount > 0) {
    items.push({
      id: `item_${Date.now()}_0`,
      product_id: 1,
      product_name: `Fattura elettronica ${invoiceNumber}`,
      sku: 'POS-001',
      qty: 1,
      unit_price: totalAmount / 1.22,
      tax_rate: 22,
      discount: 0,
      subtotal: totalAmount / 1.22
    });
    calcSubtotal = totalAmount / 1.22;
    calcTaxTotal = totalAmount - calcSubtotal;
  }

  // 5. Payment details (DatiPagamento)
  const paymentMethod = getText('ModalitaPagamento') || undefined;
  const paymentDueDate = getText('DataScadenzaPagamento') || undefined;
  const paymentAmount = getNum('ImportoPagamento') || totalAmount;
  const paymentIban = getText('IBAN') || undefined;
  const bankName = getText('IstitutoFinanziario') || undefined;

  const parsed: ParsedFatturaPa = {
    documentType: docType,
    currency,
    invoiceNumber,
    invoiceDate,
    totalAmount: totalAmount > 0 ? totalAmount : (calcSubtotal + calcTaxTotal),
    subtotal: calcSubtotal,
    taxTotal: calcTaxTotal,
    seller: {
      name: sellerDenom || 'Fornitore sconosciuto',
      taxId: sellerVat,
      vatCountry: sellerCountry,
      street: sellerStreet,
      zip: sellerZip,
      city: sellerCity
    },
    buyer: {
      name: buyerDenom || 'Cliente sconosciuto',
      taxId: buyerVat,
      vatCountry: buyerCountry,
      street: buyerStreet,
      zip: buyerZip,
      city: buyerCity,
      pec: pecDestinatario || undefined,
      recipientCode: recipientCode || undefined
    },
    items,
    payment: {
      method: paymentMethod,
      dueDate: paymentDueDate,
      amount: paymentAmount,
      iban: paymentIban,
      bankName
    },
    rawXml: xmlString
  };

  return parsed;
}

/**
 * Converts a parsed FatturaPA document into a SOCDOF Invoice model.
 */
export function convertFatturaPaToInvoice(
  parsed: ParsedFatturaPa,
  direction: 'incoming' | 'outgoing' = 'incoming'
): { invoice: Partial<Invoice>; contact: Partial<Contact> } {
  const isIncoming = direction === 'incoming';
  const partner = isIncoming ? parsed.seller : parsed.buyer;

  const contact: Partial<Contact> = {
    name: partner.name,
    company: partner.name,
    taxId: partner.taxId,
    street: partner.street || '',
    zip: partner.zip || '',
    city: partner.city || '',
    country: partner.vatCountry || 'IT',
    email: partner.pec || '',
    type: isIncoming ? 'vendor' : 'customer',
    createdAt: new Date().toISOString()
  };

  const invoice: Partial<Invoice> = {
    number: parsed.invoiceNumber,
    date: parsed.invoiceDate,
    due_date: parsed.payment?.dueDate || parsed.invoiceDate,
    type: isIncoming ? 'in_invoice' : 'out_invoice',
    contact_name: partner.name,
    contact_company: partner.name,
    subtotal: parsed.subtotal,
    tax_total: parsed.taxTotal,
    total: parsed.totalAmount,
    status: 'draft',
    payment_terms: parsed.payment?.iban ? `IBAN: ${parsed.payment.iban}${parsed.payment.bankName ? ` (${parsed.payment.bankName})` : ''}` : undefined,
    items: parsed.items,
    notes: `Importiert aus FatturaPA XML (${parsed.documentType}) - SDI-Format`
  };

  return { invoice, contact };
}
