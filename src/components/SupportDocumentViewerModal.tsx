import React from 'react';
import { 
  X, 
  Download, 
  ExternalLink, 
  FileText, 
  Image as ImageIcon, 
  File
} from 'lucide-react';
import { SupportWorkAttachment } from '../types';
import { formatFileSize } from '../lib/storageAssets';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';

interface SupportDocumentViewerModalProps {
  attachment: SupportWorkAttachment | null;
  isOpen: boolean;
  onClose: () => void;
  isDark?: boolean;
}

export const SupportDocumentViewerModal: React.FC<SupportDocumentViewerModalProps> = ({
  attachment,
  isOpen,
  onClose,
  isDark = false
}) => {
  if (!isOpen || !attachment) return null;

  const handleDownload = () => {
    sounds.playClick();
    const a = document.createElement('a');
    a.href = attachment.dataUrl;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenInNewTab = () => {
    sounds.playClick();
    const win = window.open();
    if (win) {
      if (attachment.category === 'pdf') {
        win.document.write(
          `<iframe src="${attachment.dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
        win.document.title = attachment.name;
      } else {
        win.location.href = attachment.dataUrl;
      }
    }
  };

  const getFileIcon = () => {
    switch (attachment.category) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-500" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white transition-all animate-scale-up overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0">
              {getFileIcon()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{attachment.name}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>{formatFileSize(attachment.size)}</span>
                <span>•</span>
                <span className="uppercase font-semibold text-[10px] tracking-wide">{attachment.category}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenInNewTab}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              title={t('support.doc_viewer_open_tab', undefined, 'In neuem Tab öffnen')}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">{t('support.doc_viewer_open_tab', undefined, 'In neuem Tab')}</span>
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-600 dark:text-cyan-400 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title={t('support.doc_viewer_download', undefined, 'Herunterladen')}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{t('support.doc_viewer_download', undefined, 'Herunterladen')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
              title={t('action.close', undefined, 'Schließen')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/40">
          {attachment.category === 'pdf' && attachment.dataUrl ? (
            <div className="w-full h-[68vh] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-inner">
              <iframe
                src={attachment.dataUrl}
                title={attachment.name}
                className="w-full h-full"
              />
            </div>
          ) : attachment.category === 'image' && attachment.dataUrl ? (
            <div className="flex items-center justify-center p-4 bg-slate-100/70 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[70vh] overflow-hidden">
              <img 
                src={attachment.dataUrl} 
                alt={attachment.name} 
                className="max-h-[66vh] max-w-full object-contain rounded-xl shadow-md"
              />
            </div>
          ) : (
            <div className="py-14 px-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-cyan-100 dark:bg-cyan-950/50 flex items-center justify-center mx-auto text-cyan-600 dark:text-cyan-400">
                <File className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-base text-slate-800 dark:text-slate-100">{attachment.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {t('support.doc_viewer_no_preview', undefined, 'Für dieses Dateiformat steht keine direkte In-App-Vorschau bereit. Laden Sie die Datei herunter, um sie zu öffnen.')}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('support.doc_viewer_download', undefined, 'Datei jetzt herunterladen')}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
