import React, { useState } from 'react';
import { 
  FileCode, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Download, 
  Copy, 
  Check, 
  X, 
  Send, 
  ShieldCheck, 
  Upload, 
  Building2, 
  Calendar, 
  CreditCard, 
  RefreshCw,
  HelpCircle,
  FileCheck,
  FileX
} from 'lucide-react';
import { Invoice, CompanyProfile, Contact, SdIStatus } from '../types';
import { generateFatturaPaXml, validateFatturaPaXml, getFatturaPaFileName, downloadFatturaPaXml } from '../lib/fatturaPaGenerator';
import { parseSdIReceiptXml, ParsedSdIReceipt, SDI_ERROR_CATALOG } from '../lib/sdiReceiptParser';
import { db } from '../lib/db';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';

interface FatturaPaInspectorModalProps {
  invoice: Invoice;
  company: CompanyProfile;
  customer?: Contact;
  onClose: () => void;
  onUpdateInvoice: (updatedInvoice: Invoice) => void;
}

export const FatturaPaInspectorModal: React.FC<FatturaPaInspectorModalProps> = ({
  invoice,
  company,
  customer,
  onClose,
  onUpdateInvoice
}) => {
  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'xml'>('status');
  const [copied, setCopied] = useState(false);
  const [editingParams, setEditingParams] = useState({
    document_type: invoice.document_type || 'TD01',
    sdi_recipient_code: invoice.sdi_recipient_code || customer?.sdi_recipient_code || company.sdi_default_recipient_code || '0000000',
    sdi_pec: invoice.sdi_pec || customer?.pec || '',
    regime_fiscale: invoice.regime_fiscale || company.sdi_regime_fiscale || 'RF01',
    bollo_virtuale: invoice.bollo_virtuale || false,
    bollo_amount: invoice.bollo_amount || 2.00,
    pa_cup: invoice.pa_cup || '',
    pa_cig: invoice.pa_cig || '',
    sdi_status: invoice.sdi_status || 'not_sent',
    sdi_identifier: invoice.sdi_identifier || '',
    sdi_date: invoice.sdi_date || ''
  });

  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [uploadedReceipt, setUploadedReceipt] = useState<ParsedSdIReceipt | null>(null);

  // Generate real-time XML for current state
  const currentInvoiceForXml: Invoice = {
    ...invoice,
    ...editingParams
  };

  const xmlString = generateFatturaPaXml(currentInvoiceForXml, company, customer);
  const validation = validateFatturaPaXml(xmlString);
  const sdiFileName = getFatturaPaFileName(currentInvoiceForXml, company);

  const handleCopyXml = async () => {
    try {
      await navigator.clipboard.writeText(xmlString);
      setCopied(true);
      sounds.playClick();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSaveParameters = async () => {
    try {
      const updated: Invoice = {
        ...invoice,
        ...editingParams,
        sdi_filename: sdiFileName
      };
      if (invoice.id) {
        await db.invoices.update(invoice.id, updated as any);
      }
      sounds.playSuccess();
      onUpdateInvoice(updated);
    } catch (err: any) {
      console.error(err);
      sounds.playError();
      alert(`Fehler beim Speichern: ${err?.message || err}`);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setReceiptError(null);
      sounds.playClick();
      const text = await file.text();
      const parsed = parseSdIReceiptXml(text);
      setUploadedReceipt(parsed);
      sounds.playPop();
    } catch (err: any) {
      console.error(err);
      setReceiptError(err?.message || 'Ungültiges SdI-Notifikationsformat.');
      sounds.playError();
    } finally {
      e.target.value = '';
    }
  };

  const handleApplyReceiptToInvoice = async () => {
    if (!uploadedReceipt) return;
    try {
      const updated: Invoice = {
        ...invoice,
        ...editingParams,
        sdi_status: uploadedReceipt.sdiStatus,
        sdi_identifier: uploadedReceipt.identifierSdI || invoice.sdi_identifier,
        sdi_date: uploadedReceipt.deliveryDate || uploadedReceipt.receiptDate || new Date().toISOString(),
        sdi_receipt_type: uploadedReceipt.receiptType,
        sdi_error_code: uploadedReceipt.errors.length > 0 ? uploadedReceipt.errors[0].code : undefined,
        sdi_error_message: uploadedReceipt.errors.length > 0 ? uploadedReceipt.errors[0].description : undefined,
        sdi_filename: uploadedReceipt.fileName || sdiFileName
      };

      if (invoice.id) {
        await db.invoices.update(invoice.id, updated as any);
      }

      setEditingParams(prev => ({
        ...prev,
        sdi_status: updated.sdi_status || 'not_sent',
        sdi_identifier: updated.sdi_identifier || '',
        sdi_date: updated.sdi_date || ''
      }));

      sounds.playSuccess();
      setUploadedReceipt(null);
      onUpdateInvoice(updated);
    } catch (err: any) {
      console.error(err);
      sounds.playError();
      alert(`Fehler beim Zuweisen: ${err?.message || err}`);
    }
  };

  const renderStatusBadge = (status?: SdIStatus) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>SdI: Consegnata (Zugestellt)</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>SdI: Scartata (Abgelehnt / NS)</span>
          </span>
        );
      case 'failed_delivery':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>SdI: Mancata Consegna (Steuerfach)</span>
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>SdI: Accettata da PA (Genehmigt)</span>
          </span>
        );
      case 'refused':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>SdI: Rifiutata da PA (Abgelehnt)</span>
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>SdI: Inviata (Übermittelt)</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            <FileCode className="w-3.5 h-3.5 text-slate-500" />
            <span>SdI: Nicht übermittelt (Entwurf)</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  FatturaPA &amp; SdI Manager
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
                  {sdiFileName}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Rechnung {invoice.number} • {customer?.company || customer?.name || invoice.contact_name || 'Kunde'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition ${
              activeTab === 'status'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            SdI Status &amp; Rückmeldungen
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition ${
              activeTab === 'config'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            FatturaPA Parameter &amp; Behördendaten
          </button>
          <button
            onClick={() => setActiveTab('xml')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition ${
              activeTab === 'xml'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            XML Vorschau &amp; Validierung
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* TAB 1: SDI STATUS & RECEIPTS */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* Current Status Banner */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                    Aktueller SdI Übermittlungsstatus
                  </span>
                  <div className="flex items-center gap-2">
                    {renderStatusBadge(editingParams.sdi_status)}
                    {editingParams.sdi_identifier && (
                      <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                        (SdI-ID: {editingParams.sdi_identifier})
                      </span>
                    )}
                  </div>
                  {editingParams.sdi_date && (
                    <span className="text-[11px] text-slate-500 block">
                      Zuletzt aktualisiert: {editingParams.sdi_date}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => downloadFatturaPaXml(currentInvoiceForXml, company, customer)}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs transition active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    <span>XML für SdI herunterladen</span>
                  </button>
                </div>
              </div>

              {/* Error Callout if Rejected */}
              {invoice.sdi_error_code && (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>SdI Fehlercode {invoice.sdi_error_code}: {invoice.sdi_error_message || 'Validierungsfehler'}</span>
                  </div>
                  {SDI_ERROR_CATALOG[invoice.sdi_error_code]?.hint && (
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 pl-6">
                      <strong>Lösungshinweis:</strong> {SDI_ERROR_CATALOG[invoice.sdi_error_code].hint}
                    </p>
                  )}
                </div>
              )}

              {/* Upload SdI Receipt / Notification XML */}
              <div className="p-5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs">
                      SdI Rückmeldung (Notifica / Ricevuta) importieren
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Laden Sie die vom SdI erhaltene XML-Quittung (RC, NS, MC, NE, DT) hoch, um den Status automatisch zu setzen.
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold border border-indigo-200 dark:border-indigo-800 shadow-2xs cursor-pointer transition active:scale-95">
                    <Upload className="w-3.5 h-3.5" />
                    <span>SdI XML auswählen</span>
                    <input
                      type="file"
                      accept=".xml,.p7m"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {receiptError && (
                  <div className="p-3 bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-200 rounded-xl text-xs flex items-center justify-between">
                    <span>{receiptError}</span>
                    <button onClick={() => setReceiptError(null)} className="text-rose-500 hover:text-rose-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Uploaded Receipt Preview */}
                {uploadedReceipt && (
                  <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-slate-900 dark:text-white">
                          Erkannte SdI Notifikation: {uploadedReceipt.receiptTypeName}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {uploadedReceipt.fileName}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                        <span className="text-slate-400 block font-bold">SdI-Kennung:</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {uploadedReceipt.identifierSdI || 'N/A'}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                        <span className="text-slate-400 block font-bold">Empfangsdatum:</span>
                        <span className="text-slate-800 dark:text-slate-200">
                          {uploadedReceipt.receiptDate}
                        </span>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                        <span className="text-slate-400 block font-bold">Zustellstatus:</span>
                        {renderStatusBadge(uploadedReceipt.sdiStatus)}
                      </div>
                    </div>

                    {uploadedReceipt.errors.length > 0 && (
                      <div className="p-3 bg-rose-50 dark:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 space-y-1">
                        <div className="font-bold text-[11px]">Enthaltene Fehler / Abweisungsgründe:</div>
                        {uploadedReceipt.errors.map((err, i) => (
                          <div key={i} className="text-[11px]">
                            • <strong>[{err.code}]</strong> {err.description}
                            {err.solutionHint && <div className="text-rose-600 dark:text-rose-300 pl-3">↳ {err.solutionHint}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={() => setUploadedReceipt(null)}
                        className="px-3 py-1.5 text-slate-500 hover:text-slate-700 rounded-lg"
                      >
                        Verwerfen
                      </button>
                      <button
                        onClick={handleApplyReceiptToInvoice}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition flex items-center gap-1.5 active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Status jetzt auf Rechnung übernehmen</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Status Override */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                  SdI-Status manuell aktualisieren
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Status festlegen
                    </label>
                    <select
                      value={editingParams.sdi_status}
                      onChange={(e) => setEditingParams({ ...editingParams, sdi_status: e.target.value as SdIStatus })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                    >
                      <option value="not_sent">Nicht an SdI übermittelt</option>
                      <option value="sent">An SdI übermittelt (Inviata)</option>
                      <option value="delivered">Consegnata (Zugestellt / RC)</option>
                      <option value="failed_delivery">Mancata Consegna (Steuerfach / MC)</option>
                      <option value="rejected">Scartata (Abgelehnt / NS)</option>
                      <option value="accepted">Accettata da PA (Genehmigt)</option>
                      <option value="refused">Rifiutata da PA (Abgelehnt)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Identificativo SdI (optional)
                    </label>
                    <input
                      type="text"
                      placeholder="z.B. 12948102"
                      value={editingParams.sdi_identifier}
                      onChange={(e) => setEditingParams({ ...editingParams, sdi_identifier: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Datum / Zeitstempel
                    </label>
                    <input
                      type="text"
                      placeholder={new Date().toISOString().slice(0, 10)}
                      value={editingParams.sdi_date}
                      onChange={(e) => setEditingParams({ ...editingParams, sdi_date: e.target.value })}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIG & PARAMETERS */}
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Dokumenttyp (TipoDocumento)
                  </label>
                  <select
                    value={editingParams.document_type}
                    onChange={(e) => setEditingParams({ ...editingParams, document_type: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                  >
                    <option value="TD01">TD01 - Fattura (Standardrechnung)</option>
                    <option value="TD02">TD02 - Acconto / Anticipo su fattura (Anzahlung)</option>
                    <option value="TD04">TD04 - Nota di Credito (Gutschrift)</option>
                    <option value="TD24">TD24 - Fattura differita (Sammelrechnung)</option>
                    <option value="TD25">TD25 - Fattura differita triangolare</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Steuerregime (Regime Fiscale)
                  </label>
                  <select
                    value={editingParams.regime_fiscale}
                    onChange={(e) => setEditingParams({ ...editingParams, regime_fiscale: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold"
                  >
                    <option value="RF01">RF01 - Regime Ordinario</option>
                    <option value="RF19">RF19 - Regime Forfettario (Pauschalbesteuert)</option>
                    <option value="RF02">RF02 - Contribuenti minimi</option>
                    <option value="RF18">RF18 - Altro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Empfängercode (Codice Destinatario - 7 Zeichen / 6 Zeichen PA)
                  </label>
                  <input
                    type="text"
                    maxLength={7}
                    placeholder="0000000 oder SUBM70N"
                    value={editingParams.sdi_recipient_code}
                    onChange={(e) => setEditingParams({ ...editingParams, sdi_recipient_code: e.target.value.toUpperCase() })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    '0000000' für B2B/B2C mit PEC, 'XXXXXXX' für Auslandskunden.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    PEC-Zustelladresse (PECDestinatario)
                  </label>
                  <input
                    type="email"
                    placeholder="empfaenger@pec.it"
                    value={editingParams.sdi_pec}
                    onChange={(e) => setEditingParams({ ...editingParams, sdi_pec: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CUP-Code (Codice Unitario Progetto - für PA)
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. E12C18000010006"
                    value={editingParams.pa_cup}
                    onChange={(e) => setEditingParams({ ...editingParams, pa_cup: e.target.value.toUpperCase() })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CIG-Code (Codice Identificativo Gara - für PA)
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. 8192847291"
                    value={editingParams.pa_cig}
                    onChange={(e) => setEditingParams({ ...editingParams, pa_cig: e.target.value.toUpperCase() })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
              </div>

              {/* Bollo Virtuale */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-xs">
                    Imposta di Bollo Virtuale (Stempelsteuer 2,00 €)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Für steuerfreie Rechnungen über 77,47 € (z.B. Regime Forfettario oder Art. 10/15).
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={editingParams.bollo_virtuale}
                    onChange={(e) => setEditingParams({ ...editingParams, bollo_virtuale: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  {editingParams.bollo_virtuale && (
                    <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      2,00 €
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: XML PREVIEW & VALIDATION */}
          {activeTab === 'xml' && (
            <div className="space-y-4">
              {/* Validation status badge */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                validation.isValid 
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-xs">
                  {validation.isValid ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>FatturaPA 1.2.1 / 1.2.2 Schema-Validierung erfolgreich</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span>Validierungsfehler im XML-Dokument</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyXml}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold flex items-center gap-1 hover:bg-slate-100 transition shadow-2xs"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Kopiert!' : 'XML Kopieren'}</span>
                  </button>
                  <button
                    onClick={() => downloadFatturaPaXml(currentInvoiceForXml, company, customer)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 transition shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              </div>

              {/* Raw XML Viewer */}
              <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 p-4 font-mono text-[11px] overflow-x-auto max-h-80 select-all">
                <pre>{xmlString}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            Schließen
          </button>

          <button
            type="button"
            onClick={handleSaveParameters}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>FatturaPA Einstellungen speichern</span>
          </button>
        </div>
      </div>
    </div>
  );
};
