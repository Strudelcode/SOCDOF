import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Check, 
  Clock, 
  Calendar, 
  User, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Trash2, 
  Eye, 
  DollarSign 
} from 'lucide-react';
import { SupportTimesheetEntry, SupportWorkAttachment } from '../types';
import { determineAssetCategory, formatFileSize } from '../lib/storageAssets';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';
import { SupportDocumentViewerModal } from './SupportDocumentViewerModal';

interface SupportTimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Partial<SupportTimesheetEntry>) => void;
  initialEntry?: SupportTimesheetEntry | null;
  staffList?: string[];
  staffOptions?: string[];
  defaultStaff?: string;
  defaultHourlyRate?: number;
  defaultRate?: number;
  currency?: string;
  isDark?: boolean;
}

export const SupportTimesheetModal: React.FC<SupportTimesheetModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialEntry,
  staffList,
  staffOptions,
  defaultStaff,
  defaultHourlyRate,
  defaultRate,
  currency = '€',
  isDark = false
}) => {
  const effectiveStaffList = useMemo(() => {
    if (staffList && Array.isArray(staffList) && staffList.length > 0) return staffList;
    if (staffOptions && Array.isArray(staffOptions) && staffOptions.length > 0) return staffOptions;
    return ['Mitarbeiter'];
  }, [staffList, staffOptions]);

  const effectiveDefaultRate = defaultHourlyRate ?? defaultRate;

  const [date, setDate] = useState('');
  const [staff, setStaff] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('1.0');
  const [hourlyRate, setHourlyRate] = useState<string>('');
  const [billable, setBillable] = useState(true);
  const [attachments, setAttachments] = useState<SupportWorkAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<SupportWorkAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const fallbackStaff = defaultStaff || effectiveStaffList[0] || '';
      if (initialEntry) {
        setDate(initialEntry.date || new Date().toISOString().split('T')[0]);
        setStaff(initialEntry.staff || fallbackStaff);
        setDescription(initialEntry.description || '');
        setHours(initialEntry.hours ? String(initialEntry.hours) : '1.0');
        setHourlyRate(initialEntry.hourlyRate !== undefined ? String(initialEntry.hourlyRate) : (effectiveDefaultRate !== undefined ? String(effectiveDefaultRate) : ''));
        setBillable(initialEntry.billable !== false);
        setAttachments(initialEntry.attachments || []);
      } else {
        setDate(new Date().toISOString().split('T')[0]);
        setStaff(fallbackStaff);
        setDescription('');
        setHours('1.0');
        setHourlyRate(effectiveDefaultRate !== undefined ? String(effectiveDefaultRate) : '');
        setBillable(true);
        setAttachments([]);
      }
    }
  }, [isOpen, initialEntry, effectiveStaffList, effectiveDefaultRate, defaultStaff]);

  if (!isOpen) return null;

  const handleProcessFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    sounds.playClick();
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        const cat = determineAssetCategory(file.type, file.name);
        let finalCategory: 'pdf' | 'image' | 'document' | 'other' = 'other';
        if (cat === 'pdf') finalCategory = 'pdf';
        else if (cat === 'image') finalCategory = 'image';
        else if (cat === 'document' || cat === 'spreadsheet') finalCategory = 'document';

        const newAttachment: SupportWorkAttachment = {
          id: 'ts_att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          category: finalCategory,
          dataUrl,
          createdAt: new Date().toISOString()
        };

        setAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    sounds.playDelete();
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedHours = parseFloat(hours.replace(',', '.'));
    if (isNaN(parsedHours) || parsedHours <= 0) return;

    const parsedRate = hourlyRate.trim() ? parseFloat(hourlyRate.replace(',', '.')) : undefined;

    onSave({
      date,
      staff,
      description: description.trim(),
      hours: parsedHours,
      hourlyRate: isNaN(parsedRate as number) ? undefined : parsedRate,
      billable,
      attachments
    });

    onClose();
  };

  const getAttachmentIcon = (category: string) => {
    switch (category) {
      case 'pdf': return <FileText className="w-4 h-4 text-rose-500" />;
      case 'image': return <ImageIcon className="w-4 h-4 text-purple-500" />;
      default: return <File className="w-4 h-4 text-cyan-600" />;
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-all animate-scale-up overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {initialEntry 
                    ? t('support.timesheet_modal_edit_title', undefined, 'Zeiteintrag bearbeiten')
                    : t('support.timesheet_modal_create_title', undefined, 'Zeiteintrag erfassen')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('support.timesheet_modal_subtitle', undefined, 'Arbeitszeiten erfassen, Stundensatz festlegen und Belege anhängen')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={t('action.close', undefined, 'Schließen')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{t('support.th_date', undefined, 'Datum')}</span>
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
              </div>

              {/* Staff / Technician */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{t('support.th_staff', undefined, 'Mitarbeiter / Techniker')}</span>
                </label>
                <select
                  value={staff}
                  onChange={(e) => setStaff(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                >
                  {effectiveStaffList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Work Description (Localized cleanly, no slashes!) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('support.timesheet_desc_label', undefined, 'Tätigkeitsbeschreibung')} *
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('support.timesheet_desc_placeholder', undefined, 'Beschreibung der ausgeführten Arbeiten (z.B. Fehleranalyse, Reparatur, Kundengespräch)...')}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden resize-none"
              />
            </div>

            {/* Hours & Quick Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{t('support.th_hours', undefined, 'Arbeitszeit (Stunden)')} *</span>
                </label>
                <div className="flex items-center gap-1">
                  {[0.25, 0.5, 1.0, 1.5, 2.0, 4.0].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setHours(String(val))}
                      className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-mono font-semibold text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    >
                      {val}h
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.05"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                  className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold pointer-events-none">h</span>
              </div>
            </div>

            {/* Hourly Rate & Billable */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('support.label_hourly_rate', undefined, 'Stundensatz (€ / Std.)')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder={effectiveDefaultRate !== undefined ? String(effectiveDefaultRate) : "0,00"}
                    className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2 text-xs text-slate-400 font-semibold pointer-events-none">{currency}/h</span>
                </div>
              </div>

              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={billable}
                    onChange={(e) => setBillable(e.target.checked)}
                    className="w-4 h-4 rounded-md text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('support.billable_label', undefined, 'Abrechenbare Leistung')}
                  </span>
                </label>
              </div>
            </div>

            {/* Attachments / Beilagen for Timesheet */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{t('support.timesheet_attachments_label', undefined, 'Belege & Dokumente (PDF, Fotos, Stundenzettel)')}</span>
                </label>
                <span className="text-[11px] text-slate-400">
                  {attachments.length} {t('support.attachments_count_suffix', undefined, 'angehängt')}
                </span>
              </div>

              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-3.5 rounded-2xl border-2 border-dashed transition text-center cursor-pointer ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-cyan-400 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/*,.doc,.docx,.txt"
                  onChange={(e) => e.target.files && handleProcessFiles(e.target.files)}
                  className="hidden"
                />
                <div className="flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t('support.timesheet_dropzone_hint', undefined, 'Beleg oder PDF hier ablegen / auswählen')}
                  </span>
                </div>
              </div>

              {/* Attached Files List */}
              {attachments.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {attachments.map(att => (
                    <div 
                      key={att.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center shrink-0">
                          {getAttachmentIcon(att.category)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{att.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{formatFileSize(att.size)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewAttachment(att)}
                          className="p-1 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 rounded-md transition cursor-pointer"
                          title={t('support.work_item_btn_view_doc', undefined, 'Dokument anzeigen')}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition cursor-pointer"
                          title={t('action.delete', undefined, 'Löschen')}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {t('action.cancel', undefined, 'Abbrechen')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{t('action.save', undefined, 'Speichern')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {previewAttachment && (
        <SupportDocumentViewerModal
          attachment={previewAttachment}
          isOpen={true}
          onClose={() => setPreviewAttachment(null)}
          isDark={isDark}
        />
      )}
    </>
  );
};
