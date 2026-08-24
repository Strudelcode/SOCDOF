import React, { useState } from 'react';
import { 
  X, 
  Palette, 
  Building2, 
  FileText, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Trash2, 
  Save, 
  Check, 
  Receipt, 
  Coins, 
  Sliders,
  Upload,
  RefreshCw,
  Sun,
  Moon
} from 'lucide-react';
import { CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { db } from '../lib/db';

interface StudioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyProfile;
  onSaveCompany: (updated: CompanyProfile) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isMuted: boolean;
  onToggleSound: () => void;
  onClearDatabase: () => void;
  onLoadDemoData: () => void;
  recordCounts: {
    contacts: number;
    products: number;
    invoices: number;
    purchases: number;
    posOrders: number;
    stockMoves: number;
  };
}

export const StudioDrawer: React.FC<StudioDrawerProps> = ({
  isOpen,
  onClose,
  company,
  onSaveCompany,
  isDark,
  onToggleTheme,
  isMuted,
  onToggleSound,
  onClearDatabase,
  onLoadDemoData,
  recordCounts
}) => {
  const [formData, setFormData] = useState<CompanyProfile>({ ...company });
  const [activeTab, setActiveTab] = useState<'brand' | 'theme' | 'accounting' | 'data'>('brand');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    sounds.playSuccess();
    await db.settings.put({ key: 'company_profile', value: formData });
    onSaveCompany(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const themeOptions = [
    { id: 'odoo-purple', name: 'Odoo Aubergine (Klassisch)', color: '#714B67', accent: '#875A7B' },
    { id: 'odoo-teal', name: 'Odoo Teal (Modern Enterprise)', color: '#017e84', accent: '#00a09d' },
    { id: 'odoo-blue', name: 'Sapphire Enterprise', color: '#1e3a8a', accent: '#2563eb' },
    { id: 'odoo-emerald', name: 'Emerald Forest', color: '#065f46', accent: '#059669' },
    { id: 'odoo-dark', name: 'Midnight Obsidian', color: '#0f172a', accent: '#334155' }
  ];

  const totalRecords = recordCounts.contacts + recordCounts.products + recordCounts.invoices + recordCounts.purchases + recordCounts.posOrders + recordCounts.stockMoves;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 shadow-2xl z-10 flex flex-col h-full border-l border-slate-200 dark:border-slate-800 animate-slide-in-right">
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#714B67] text-white flex items-center justify-center shadow-sm">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Odoo Studio & Anpassung
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-semibold">
                  Customizer
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unternehmensdaten, Farbschema, Layouts und Datenbank anpassen
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 bg-white dark:bg-slate-900 text-xs font-medium gap-2">
          <button
            onClick={() => setActiveTab('brand')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'brand' 
                ? 'border-[#714B67] text-[#714B67] dark:text-purple-400 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Firma & Profil</span>
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'theme' 
                ? 'border-[#714B67] text-[#714B67] dark:text-purple-400 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Farbschema & Design</span>
          </button>
          <button
            onClick={() => setActiveTab('accounting')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'accounting' 
                ? 'border-[#714B67] text-[#714B67] dark:text-purple-400 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Währung & Steuern</span>
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition ${
              activeTab === 'data' 
                ? 'border-[#714B67] text-[#714B67] dark:text-purple-400 font-bold' 
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Datenbank ({totalRecords})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: BRANDING & PROFILE */}
          {activeTab === 'brand' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Unternehmensname (Wird in Kopfzeile & Belegen angezeigt)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                  placeholder="z.B. Meine Firma GmbH"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rechtsform
                  </label>
                  <input
                    type="text"
                    value={formData.legal_form || ''}
                    onChange={(e) => setFormData({ ...formData, legal_form: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    placeholder="GmbH / AG / Einzelunternehmen"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    USt-IdNr. / Steuernummer
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    placeholder="DE 123456789"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Straße & Hausnummer
                </label>
                <input
                  type="text"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                  placeholder="Musterstraße 1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    PLZ & Ort
                  </label>
                  <input
                    type="text"
                    value={formData.zip_city}
                    onChange={(e) => setFormData({ ...formData, zip_city: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    placeholder="10115 Berlin"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Land
                  </label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    placeholder="Deutschland"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    E-Mail
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    placeholder="info@firma.de"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Telefon
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    placeholder="+49 30 123456"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white">Bankverbindung für Rechnungsfußzeile</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      IBAN
                    </label>
                    <input
                      type="text"
                      value={formData.iban}
                      onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                      className="w-full px-3 py-2.5 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      BIC & Bank
                    </label>
                    <input
                      type="text"
                      value={formData.bic}
                      onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                      className="w-full px-3 py-2.5 font-mono text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: THEME & COLOR */}
          {activeTab === 'theme' && (
            <div className="space-y-6 animate-fade-in text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Odoo Primärfarbschema (Header & Akzente)
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {themeOptions.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, theme_color: t.id as any })}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                        (formData.theme_color || 'odoo-purple') === t.id
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-6 h-6 rounded-lg shadow-xs flex items-center justify-center text-white"
                          style={{ backgroundColor: t.color }}
                        >
                          {(formData.theme_color || 'odoo-purple') === t.id && <Check className="w-3.5 h-3.5" />}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {t.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {t.color}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode toggles */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">Erscheinungsbild</span>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Zwischen Hell- und Dunkelmodus wechseln</p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleTheme}
                    className="p-2 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 flex items-center gap-2 font-medium text-xs shadow-xs"
                  >
                    {isDark ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                    <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-slate-700">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white">Audio-Feedback (Web Audio API)</span>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px]">Tastentöne, Kassen-Ping & Erfolgsfanfaren</p>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className={`p-2 rounded-xl border flex items-center gap-2 font-medium text-xs shadow-xs transition ${
                      !isMuted 
                        ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300' 
                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500'
                    }`}
                  >
                    {!isMuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span>{!isMuted ? 'Aktiviert' : 'Stumm'}</span>
                  </button>
                </div>
              </div>

              {/* Document Template Style */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Rechnungs- & Belegvorlage
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'odoo-modern', name: 'Odoo Modern 18', desc: 'Strukturierte Farbakzente & QR-Zahlteil' },
                    { id: 'din5008', name: 'DIN 5008 Standard', desc: 'Deutscher Geschäftsbrief nach Norm' },
                    { id: 'clean', name: 'Minimalist Clean', desc: 'Schlankes reduziertes Layout' },
                    { id: 'compact', name: 'Kompakt Retail', desc: 'Für dichte Artikellisten' }
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, invoice_template: t.id as any })}
                      className={`p-3 rounded-xl border text-left transition ${
                        (formData.invoice_template || 'odoo-modern') === t.id
                          ? 'border-[#714B67] bg-purple-50/40 dark:bg-purple-950/30'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40'
                      }`}
                    >
                      <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>{t.name}</span>
                        {(formData.invoice_template || 'odoo-modern') === t.id && <Check className="w-3.5 h-3.5 text-[#714B67]" />}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNTING & TAXES */}
          {activeTab === 'accounting' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Standardwährung
                </label>
                <div className="flex gap-2">
                  {['€', '$', 'CHF', '£', '¥'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, currency: c })}
                      className={`px-4 py-2 rounded-xl border font-bold text-sm transition ${
                        formData.currency === c
                          ? 'bg-[#714B67] text-white border-[#714B67] shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Standard-Umsatzsteuersatz (%)
                </label>
                <div className="flex gap-2">
                  {[19, 7, 0, 20, 8.1].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => setFormData({ ...formData, default_tax_rate: rate })}
                      className={`px-3 py-2 rounded-xl border font-medium transition ${
                        formData.default_tax_rate === rate
                          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Standard-Zahlungsziel
                </label>
                <input
                  type="text"
                  value={formData.default_payment_terms || '14 Tage netto'}
                  onChange={(e) => setFormData({ ...formData, default_payment_terms: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                  placeholder="z.B. 14 Tage netto"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white">Kassenbon (POS) Texte</h4>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bon-Kopfzeile
                  </label>
                  <input
                    type="text"
                    value={formData.pos_header_text || ''}
                    onChange={(e) => setFormData({ ...formData, pos_header_text: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    placeholder="Herzlich Willkommen!"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bon-Fußzeile
                  </label>
                  <input
                    type="text"
                    value={formData.pos_footer_text || ''}
                    onChange={(e) => setFormData({ ...formData, pos_footer_text: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-[#714B67] focus:outline-none"
                    placeholder="Vielen Dank für Ihren Einkauf!"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE & ZERO-STATE CONTROLS */}
          {activeTab === 'data' && (
            <div className="space-y-5 animate-fade-in text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <h3 className="font-bold text-slate-900 dark:text-white mb-2">Aktueller Datenbankstatus</h3>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="block text-base font-bold text-slate-900 dark:text-white font-mono">{recordCounts.invoices}</span>
                    <span className="text-[10px] text-slate-400">Rechnungen</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="block text-base font-bold text-slate-900 dark:text-white font-mono">{recordCounts.products}</span>
                    <span className="text-[10px] text-slate-400">Produkte</span>
                  </div>
                  <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="block text-base font-bold text-slate-900 dark:text-white font-mono">{recordCounts.contacts}</span>
                    <span className="text-[10px] text-slate-400">Kontakte</span>
                  </div>
                </div>
              </div>

              {/* Zero data button (Clean Start) */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold">
                  <Trash2 className="w-4 h-4" />
                  <span>Komplett leeren (0 Daten / Keine Beispiele)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Setzt alle Tabellen und Umsätze sofort auf 0 zurück. Ideal für den direkten produktiven Start ohne Musterdaten.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Möchten Sie alle Daten unwiderruflich leeren und auf 0,00 € starten?')) {
                      sounds.playSuccess();
                      onClearDatabase();
                    }
                  }}
                  className="w-full mt-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Jetzt auf 0 zurücksetzen (Clean Mode)</span>
                </button>
              </div>

              {/* Demo data loader */}
              <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/20 space-y-2">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>Beispieldaten laden</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px]">
                  Lädt ein vollständiges Musterszenario mit Produkten, Kunden, Lieferanten und Buchungen für Testzwecke.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    sounds.playSuccess();
                    onLoadDemoData();
                  }}
                  className="w-full mt-2 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Demodatensatz einspielen</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {savedSuccess ? (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> Gespeichert!
              </span>
            ) : (
              'Änderungen wirken sofort'
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition"
            >
              Schließen
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold bg-[#714B67] hover:bg-[#875A7B] text-white rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Speichern</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
