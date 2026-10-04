import React, { useState, useEffect } from 'react';
import { 
  Clock3, 
  X, 
  Calendar, 
  User, 
  CreditCard, 
  Trash2, 
  Sparkles, 
  CheckCircle2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { Session, Client } from './types';
import { useLanguage, t, type LanguageCode } from '../../lib/i18n';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { sounds } from '../../lib/sound';

export interface TherapySessionModalProps {
  isOpen: boolean;
  session: Session | null;
  clients: Client[];
  currency: string;
  onSave: (session: Session, autoBilling?: boolean) => void;
  onClose: () => void;
  onDelete?: (sessionId: string) => void;
  onSelectClient?: (clientId: string) => void;
}

export const TherapySessionModal: React.FC<TherapySessionModalProps> = ({
  isOpen,
  session,
  clients,
  currency,
  onSave,
  onClose,
  onDelete,
  onSelectClient
}) => {
  const lang = useLanguage();
  const [formData, setFormData] = useState<Session | null>(null);
  const [autoCreateBilling, setAutoCreateBilling] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isNew = Boolean(session && session.id.startsWith('sess_new_'));

  useEffect(() => {
    if (session) {
      setFormData({ ...session });
      // If it's a freshly created new session, default billing draft to true; for editing existing sessions, default to false
      setAutoCreateBilling(Boolean(session.id.startsWith('sess_new_')));
    } else {
      setFormData(null);
    }
  }, [session]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape' && !showDeleteConfirm) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, showDeleteConfirm]);

  if (!isOpen || !formData) return null;

  const activeClient = clients.find(c => c.id === formData.clientId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) {
      return;
    }
    sounds.playSuccess();
    const finalSession: Session = {
      ...formData,
      id: formData.id.startsWith('sess_new_') ? `sess_${Date.now()}` : formData.id
    };
    onSave(finalSession, autoCreateBilling);
    onClose();
  };

  const interventionSuggestions = [
    lang === 'de' ? 'Erstgespräch / Anamnese' : 'Initial consultation / Intake',
    lang === 'de' ? 'Reguläre Beratung / Einzelsitzung' : 'Standard session / Individual therapy',
    lang === 'de' ? 'Kognitive Umstrukturierung' : 'Cognitive restructuring',
    lang === 'de' ? 'Ressourcenaktivierung' : 'Resource activation',
    lang === 'de' ? 'Krisenintervention' : 'Crisis intervention',
    lang === 'de' ? 'Abschlussgespräch / Bilanz' : 'Final evaluation & review'
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-8 animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
          <div className="flex items-center gap-3">
            <div 
              style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.14))', color: 'var(--accent, #4f46e5)' }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs"
            >
              <Clock3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {isNew 
                    ? (lang === 'de' ? 'Neue Sitzung dokumentieren' : 'Document New Session') 
                    : (lang === 'de' ? 'Sitzung bearbeiten' : 'Edit Session')}
                </h3>
                {activeClient && (
                  <span 
                    onClick={() => onSelectClient?.(activeClient.id)}
                    className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition"
                    style={{ backgroundColor: 'var(--accent-light, rgba(79, 70, 229, 0.12))', color: 'var(--accent, #4f46e5)' }}
                    title={lang === 'de' ? 'Zum Klienten-Dossier wechseln' : 'Go to client dossier'}
                  >
                    <User className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">{activeClient.name}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'de' 
                  ? 'Dokumentation von Datum, Dauer, Thema, Interventionsverlauf und Honorar' 
                  : 'Document date, duration, intervention progress notes, and billing'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title={lang === 'de' ? 'Schließen' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Client Selection */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              {lang === 'de' ? 'Klient / Patient' : 'Client / Patient'} <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.clientId}
              onChange={e => {
                const selectedC = clients.find(c => c.id === e.target.value);
                setFormData({
                  ...formData,
                  clientId: e.target.value,
                  fee: selectedC?.hourlyRate || formData.fee
                });
              }}
              required
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent,teal)]"
            >
              <option value="" disabled>{lang === 'de' ? '– Bitte Klient auswählen –' : '– Please select client –'}</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.diagnosis ? `(${c.diagnosis})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date, Start Time, Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'de' ? 'Datum' : 'Date'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent,teal)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'de' ? 'Beginn (Uhrzeit)' : 'Start Time'}
              </label>
              <input
                type="time"
                value={formData.startTime || ''}
                onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent,teal)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'de' ? 'Dauer (Minuten)' : 'Duration (min)'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="5"
                value={formData.duration || 60}
                onChange={e => setFormData({ ...formData, duration: Number(e.target.value) || 0 })}
                required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent,teal)]"
              />
            </div>
          </div>

          {/* Quick Duration Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">{lang === 'de' ? 'Schnellauswahl Dauer:' : 'Quick duration:'}</span>
            {[30, 45, 50, 60, 90, 120].map(mins => {
              const isSelected = formData.duration === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setFormData({ ...formData, duration: mins });
                  }}
                  style={isSelected ? { backgroundColor: 'var(--accent, #4f46e5)', color: '#ffffff' } : undefined}
                  className={`px-2.5 py-1 text-[11px] rounded-lg font-bold transition cursor-pointer ${
                    isSelected
                      ? 'shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {mins} min
                </button>
              );
            })}
          </div>

          {/* Intervention & Topic */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'de' ? 'Thema, Methoden & Intervention' : 'Topic & Intervention'}
              </label>
              <span className="text-[10px] text-slate-400">{lang === 'de' ? 'Kurzbeschreibung der Sitzung' : 'Brief session summary'}</span>
            </div>
            <input
              type="text"
              value={formData.intervention || ''}
              onChange={e => setFormData({ ...formData, intervention: e.target.value })}
              placeholder={lang === 'de' ? 'z.B. Kognitive Umstrukturierung, Klärungsgespräch, Psychoedukation...' : 'e.g. Cognitive restructuring, psychoeducation, intake...'}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent,teal)]"
            />

            {/* Quick intervention suggestion pills */}
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {interventionSuggestions.map(sugg => (
                <button
                  key={sugg}
                  type="button"
                  onClick={() => setFormData({ ...formData, intervention: sugg })}
                  className="text-[10px] px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  + {sugg}
                </button>
              ))}
            </div>
          </div>

          {/* Progress Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'de' ? 'Verlauf, Beobachtungen & Nächste Schritte' : 'Progress, Clinical Notes & Next Steps'}
              </label>
              <span className="text-[10px] text-slate-400">{lang === 'de' ? 'Ausführliche Notizen' : 'Detailed notes'}</span>
            </div>
            <textarea
              rows={5}
              value={formData.progress || ''}
              onChange={e => setFormData({ ...formData, progress: e.target.value })}
              placeholder={lang === 'de' 
                ? 'Themen der Sitzung, emotionale Verfassung des Klienten, Vereinbarungen für die nächste Woche, Beobachtungen...' 
                : 'Session discussion, client reaction, assigned homework, observations, next steps...'}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white resize-y font-normal leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--accent,teal)]"
            />
          </div>

          {/* Fee & Billing Draft */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {lang === 'de' ? `Sitzungshonorar (${currency})` : `Session Fee (${currency})`}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.fee !== undefined && formData.fee !== null ? formData.fee : ''}
                onChange={e => setFormData({ ...formData, fee: e.target.value === '' ? undefined : Number(e.target.value) })}
                placeholder="90.00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent,teal)]"
              />
            </div>

            <div className="flex items-end pb-1.5">
              <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300 font-medium select-none">
                <input
                  type="checkbox"
                  checked={autoCreateBilling}
                  onChange={e => setAutoCreateBilling(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                />
                <span>{lang === 'de' ? 'Abrechnungsposten / Honorarrechnung erzeugen' : 'Generate invoice draft item'}</span>
              </label>
            </div>
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div>
              {!isNew && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-1.5 font-semibold cursor-pointer"
                  title={lang === 'de' ? 'Sitzung löschen' : 'Delete Session'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'de' ? 'Löschen' : 'Delete'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition font-medium cursor-pointer"
              >
                {lang === 'de' ? 'Abbrechen' : 'Cancel'}
              </button>
              <button
                type="submit"
                style={{ backgroundColor: 'var(--accent, #4f46e5)' }}
                className="px-5 py-2 font-bold text-white rounded-xl transition shadow-xs hover:brightness-110 active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{lang === 'de' ? 'Sitzung speichern' : 'Save Session'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          isOpen={showDeleteConfirm}
          title={lang === 'de' ? 'Sitzungseintrag löschen?' : 'Delete Session?'}
          itemName={formData ? `${formData.date} • ${formData.intervention || (lang === 'de' ? 'Sitzung' : 'Session')}` : ''}
          description={lang === 'de' 
            ? 'Möchten Sie dieses Sitzungsprotokoll wirklich unwiderruflich löschen?' 
            : 'Are you sure you want to permanently delete this clinical session note?'}
          onConfirm={() => {
            if (formData && onDelete) {
              onDelete(formData.id);
              setShowDeleteConfirm(false);
              onClose();
            }
          }}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
};
