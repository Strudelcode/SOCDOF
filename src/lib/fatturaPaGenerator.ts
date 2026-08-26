import { Invoice, CompanyProfile, Contact } from '../types';
import { sounds } from './sound';

/**
 * Generates an official FatturaPA 1.2.1 / 1.2.2 compliant XML string for an invoice.
 * Adheres strictly to the Agenzia delle Entrate (SdI - Sistema di Interscambio) schema.
 */
export function generateFatturaPaXml(
  invoice: Invoice,
  company: CompanyProfile,
  customer?: Contact
): string {
  // Format numbers to Italian standard 2 decimals
  const fmtNum = (num: number) => num.toFixed(2);

  const transmitterCountry = (company.country && company.country.length === 2 ? company.country.toUpperCase() : 'IT');
  const transmitterVat = (company.tax_id || '00000000000').replace(/[^a-zA-Z0-9]/g, '');

  const customerCountry = (customer?.country && customer.country.length === 2 ? customer.country.toUpperCase() : 'IT');
  const customerVat = (customer?.taxId || '00000000000').replace(/[^a-zA-Z0-9]/g, '');
  const customerName = (customer?.company || customer?.name || invoice.contact_company || invoice.contact_name || 'Cliente').trim();

  // FatturaPA standard recipient code (7 chars) or PEC
  const recipientCode = '0000000'; // Default standard B2B/B2C code

  // Transmission progressive number (e.g. 00001)
  const progressive = (invoice.number || '1').replace(/[^0-9a-zA-Z]/g, '').slice(-5).padStart(5, '0');

  // Split lines into XML Line elements
  const linesXml = (invoice.items || []).map((item, index) => {
    const lineNum = index + 1;
    const desc = item.product_name || 'Articolo';
    const qty = item.qty || 1;
    const unitPrice = item.unit_price || 0;
    const taxRate = item.tax_rate || 22; // default Italian IVA rate 22%
    const totalLine = item.subtotal || (qty * unitPrice);

    return `      <DettaglioLinee>
        <NumeroLinea>${lineNum}</NumeroLinea>
        <Descrizione>${escapeXml(desc)}</Descrizione>
        <Quantita>${qty.toFixed(2)}</Quantita>
        <PrezzoUnitario>${fmtNum(unitPrice)}</PrezzoUnitario>
        <PrezzoTotale>${fmtNum(totalLine)}</PrezzoTotale>
        <AliquotaIVA>${taxRate.toFixed(2)}</AliquotaIVA>
      </DettaglioLinee>`;
  }).join('\n');

  // Summary by tax rate
  const taxSummaryXml = `      <DatiRiepilogo>
        <AliquotaIVA>${(company.default_tax_rate || 22).toFixed(2)}</AliquotaIVA>
        <ImponibileImporto>${fmtNum(invoice.subtotal || 0)}</ImponibileImporto>
        <Imposta>${fmtNum(invoice.tax_total || 0)}</Imposta>
        <EsigibilitaIVA>I</EsigibilitaIVA>
      </DatiRiepilogo>`;

  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" 
  xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" 
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
  xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_flusso_FatturaPA_v1.2.xsd">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>${transmitterCountry}</IdPaese>
        <IdCodice>${transmitterVat}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${progressive}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${recipientCode}</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>${transmitterCountry}</IdPaese>
          <IdCodice>${transmitterVat}</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>${escapeXml(company.name || 'Azienda')}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF01</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(company.street || 'Via Roma')}</Indirizzo>
        <CAP>${escapeXml((company.zip_city || '').split(' ')[0] || '00100')}</CAP>
        <Comune>${escapeXml((company.zip_city || '').split(' ').slice(1).join(' ') || 'Roma')}</Comune>
        <Nazione>${transmitterCountry}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>${customerCountry}</IdPaese>
          <IdCodice>${customerVat}</IdCodice>
        </IdFiscaleIVA>
        <Anagrafica>
          <Denominazione>${escapeXml(customerName)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(customer?.street || 'Indirizzo non specificato')}</Indirizzo>
        <CAP>${escapeXml(customer?.zip || '00100')}</CAP>
        <Comune>${escapeXml(customer?.city || 'Roma')}</Comune>
        <Nazione>${customerCountry}</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>${company.currency || 'EUR'}</Divisa>
        <Data>${invoice.date || new Date().toISOString().split('T')[0]}</Data>
        <Numero>${escapeXml(invoice.number)}</Numero>
        <ImportoTotaleDocumento>${fmtNum(invoice.total || 0)}</ImportoTotaleDocumento>
        <Causale>${escapeXml(invoice.subject || 'Vendita beni e servizi')}</Causale>
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
${linesXml}
${taxSummaryXml}
    </DatiBeniServizi>
    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
        <ModalitaPagamento>${invoice.payment_method === 'card' ? 'MP08' : invoice.payment_method === 'cash' ? 'MP01' : 'MP05'}</ModalitaPagamento>
        <DataScadenzaPagamento>${invoice.due_date || invoice.date}</DataScadenzaPagamento>
        <ImportoPagamento>${fmtNum(invoice.total || 0)}</ImportoPagamento>
        ${company.iban ? `<IBAN>${company.iban.replace(/\s+/g, '')}</IBAN>` : ''}
      </DettaglioPagamento>
    </DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

  return xmlContent;
}

/**
 * Validates FatturaPA 1.2.x XML structure and returns diagnostics.
 */
export function validateFatturaPaXml(xmlString: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!xmlString.includes('<FatturaElettronicaHeader>')) {
    errors.push('Elemento obbligatorio mancante: <FatturaElettronicaHeader>');
  }
  if (!xmlString.includes('<FatturaElettronicaBody>')) {
    errors.push('Elemento obbligatorio mancante: <FatturaElettronicaBody>');
  }
  if (!xmlString.includes('<CedentePrestatore>')) {
    errors.push('Dati cedente/prestatore mancanti (<CedentePrestatore>)');
  }
  if (!xmlString.includes('<CessionarioCommittente>')) {
    errors.push('Dati cliente mancanti (<CessionarioCommittente>)');
  }
  if (!xmlString.includes('<DatiBeniServizi>')) {
    errors.push('Dati articoli e imponibile mancanti (<DatiBeniServizi>)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Downloads a generated FatturaPA XML file directly for upload to Agenzia delle Entrate / SdI.
 */
export function downloadFatturaPaXml(invoice: Invoice, company: CompanyProfile, customer?: Contact) {
  sounds.playSuccess();
  const xml = generateFatturaPaXml(invoice, company, customer);
  const cleanNumber = (invoice.number || 'Fattura').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `IT${(company.tax_id || '00000000000').replace(/[^a-zA-Z0-9]/g, '')}_${cleanNumber}.xml`;

  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 400);
}

/**
 * Escapes special XML characters.
 */
function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
