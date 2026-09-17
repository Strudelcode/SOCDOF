import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  File, 
  Trash2, 
  Eye, 
  User, 
  Plus, 
  DollarSign, 
  Layers
} from 'lucide-react';
import { SupportWorkItem, SupportWorkAttachment } from '../types';
import { determineAssetCategory, formatFileSize } from '../lib/storageAssets';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';
import { SupportDocumentViewerModal } from './SupportDocumentViewerModal';

interface SupportWorkItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<SupportWorkItem>, addAnother?: boolean) => void;
  initialItem?: SupportWorkItem | null;
  ticketContact?: {
    id?: number;
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
  };
  onOpenCustomerPicker?: () => void;
  isDark?: boolean;
}

export const SupportWorkItemModal: React.FC<SupportWorkItemModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  ticketContact,
  onOpenCustomerPicker,
  isDark = false
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [isDocumentOnly, setIsDocumentOnly] = useState(false);
  const [attachments, setAttachments] = useState<SupportWorkAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<SupportWorkAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        setTitle(initialItem.title || '');
        setDescription(initialItem.description || '');
        setPrice(initialItem.price !== undefined ? String(initialItem.price) : '');
        setIsCompleted(!!initialItem.isCompleted);
        setIsDocumentOnly(!!initialItem.isDocumentOnly);
        setAttachments(initialItem.attachments || []);
      } else {
        setTitle('');
        setDescription('');
        setPrice('');
        setIsCompleted(false);
        setIsDocumentOnly(false);
        setAttachments([]);
      }
    }
  }, [isOpen, initialItem]);

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
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          category: finalCategory,
          dataUrl,
          createdAt: new Date().toISOString()
        };

        setAttachments(prev => [...prev, newAttachment]);

        // If title is currently empty, pre-fill with file name
        setTitle(prev => {
          if (!prev.trim()) {
            return file.name.replace(/\.[^/.]+$/, '');
          }
          return prev;
        });
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

  const handleSubmit = (addAnother = false) => {
    if (!title.trim() && attachments.length === 0) {
      return;
    }

    const finalTitle = title.trim() || (attachments[0] ? attachments[0].name : t('support.work_item_default_title', undefined, 'Service-Position'));
    const parsedPrice = price.trim() ? parseFloat(price.replace(',', '.')) : undefined;

    onSave(
      {
        title: finalTitle,
        description: description.trim() || undefined,
        price: isNaN(parsedPrice as number) ? undefined : parsedPrice,
        isCompleted,
        isDocumentOnly,
        attachments
      },
      addAnother
    );

    if (addAnother) {
      setTitle('');
      setDescription('');
      setPrice('');
      setIsCompleted(false);
      setIsDocumentOnly(false);
      setAttachments([]);
    } else {
      onClose();
    }
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
          className={`w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border transition-all animate-scale-up overflow-hidden ${
            isDark 
              ? 'bg-slate-900 border-slate-700/80 text-white' 
              : 'bg-white border-slate-200/90 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">
                  {initialItem 
                    ? t('support.work_item_modal_edit_title', undefined, 'Service-Position / Aufgabe bearbeiten')
                    : t('support.work_item_modal_create_title', undefined, 'Neue Position / Aufgabe hinzufügen')}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('support.work_item_modal_subtitle', undefined, 'Erfassen Sie Arbeitsschritte, Pauschalpreise oder Beilagendokumente')}
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

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Customer Reference Bar (User: "wo man den Kunden öffnen, den Kunden auswählen...") */}
            {ticketContact && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] block">
                      {t('support.work_item_customer_assigned', undefined, 'Zugeordneter Kunde für dieses Ticket:')}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {ticketContact.name || t('support.no_customer_assigned', undefined, 'Kein Kunde hinterlegt')}
                      {ticketContact.company ? ` (${ticketContact.company})` : ''}
                    </span>
                  </div>
                </div>

                {onOpenCustomerPicker && (
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      onOpenCustomerPicker();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-cyan-600 dark:text-cyan-400 text-[11px] font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
                  >
                    {t('support.work_item_customer_change', undefined, 'Kunde wählen')}
                  </button>
                )}
              </div>
            )}

            {/* Mode Switch: Standard vs. Only Document */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setIsDocumentOnly(false)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  !isDocumentOnly
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('support.work_item_mode_standard', undefined, 'Standard-Aufgabe / Position')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDocumentOnly(true)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  isDocumentOnly
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t('support.work_item_mode_doc_only', undefined, 'Nur Dokument / Beilage')}</span>
              </button>
            </div>

            {isDocumentOnly && (
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                {t('support.work_item_mode_doc_only_hint', undefined, 'Wird als Dokumenteneintrag in der Aufgabenliste dargestellt (z.B. Messprotokoll, Schaltplan oder PDF-Beilage) mit Direkt-Vorschau in der App.')}
              </div>
            )}

            {/* Title / Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {isDocumentOnly 
                  ? t('support.work_item_doc_title_label', undefined, 'Dokumentenbezeichnung / Titel *')
                  : t('support.work_item_title_label', undefined, 'Titel / Arbeitsschritt *')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isDocumentOnly 
                  ? t('support.work_item_doc_title_placeholder', undefined, 'z.B. Messprotokoll_2026.pdf, Prüfbericht, Lieferschein...')
                  : t('support.work_item_title_placeholder', undefined, 'z.B. Fehlerdiagnose, Displaytausch, Windows neu aufsetzen...')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
              />
            </div>

            {/* Additional Description */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {t('support.work_item_desc_label', undefined, 'Zusätzliche Notizen / Beschreibung')}
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('support.work_item_desc_placeholder', undefined, 'Detaillierte Beobachtungen, Seriennummern, Spezifikationen oder Hinweise...')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden resize-none"
              />
            </div>

            {/* Price and Status (Hidden or optional if document only) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('support.work_item_price_label', undefined, 'Pauschalbetrag / Kosten (€ optional)')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0,00"
                    className="w-full pl-3.5 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-mono font-medium focus:ring-2 focus:ring-cyan-500 focus:outline-hidden"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-semibold pointer-events-none">€</span>
                </div>
              </div>

              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isCompleted}
                    onChange={(e) => setIsCompleted(e.target.checked)}
                    className="w-4 h-4 rounded-md text-cyan-600 focus:ring-cyan-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('support.work_item_mark_completed', undefined, 'Bereits als erledigt markieren')}
                  </span>
                </label>
              </div>
            </div>

            {/* Attachments / Document Dropzone */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>{t('support.work_item_attachments_title', undefined, 'Dokumente & Beilagen (PDF, Bilder, Dokumente)')}</span>
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
                className={`p-4 rounded-2xl border-2 border-dashed transition text-center cursor-pointer ${
                  isDragging
                    ? 'border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/30'
                    : 'border-slate-200 dark:border-slate-700 hover:border-cyan-400 bg-slate-50/50 dark:bg-slate-800/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/*,.doc,.docx,.txt,.csv,.xlsx"
                  onChange={(e) => e.target.files && handleProcessFiles(e.target.files)}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t('support.work_item_dropzone_hint', undefined, 'Dateien hier per Drag & Drop ablegen oder klicken zum Auswählen')}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    PDF, Bilder (PNG/JPG), Office-Dokumente • Offline lokal gespeichert
                  </p>
                </div>
              </div>

              {/* Attached Files List */}
              {attachments.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {attachments.map(att => (
                    <div 
                      key={att.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center shrink-0">
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
                          className="p-1.5 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 rounded-lg transition cursor-pointer"
                          title={t('support.work_item_btn_view_doc', undefined, 'Dokument anzeigen')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                          title={t('action.delete', undefined, 'Löschen')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {t('action.cancel', undefined, 'Abbrechen')}
            </button>

            <div className="flex items-center gap-2">
              {!initialItem && (
                <button
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={!title.trim() && attachments.length === 0}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-cyan-300 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('support.btn_add_and_next', undefined, 'Speichern & Weiteres anlegen')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={!title.trim() && attachments.length === 0}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{t('action.save', undefined, 'Speichern')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Document Viewer Modal */}
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
