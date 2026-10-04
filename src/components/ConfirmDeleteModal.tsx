import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';
import { sounds } from '../lib/sound';

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  description,
  itemName,
  confirmLabel,
  cancelLabel,
  isDangerous = true,
  onConfirm,
  onClose
}) => {
  const lang = useLanguage();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200/90 dark:border-slate-800 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isDangerous 
                ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' 
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
            }`}>
              {isDangerous ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {title || (
                  lang === 'de' ? 'Löschen bestätigen' :
                  lang === 'fr' ? 'Confirmer la suppression' :
                  lang === 'es' ? 'Confirmar eliminación' :
                  'Confirm Deletion'
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === 'de' ? 'Diese Aktion kann nicht rückgängig gemacht werden.' :
                 lang === 'fr' ? 'Cette action est irréversible.' :
                 lang === 'es' ? 'Esta acción no se puede deshacer.' :
                 'This action cannot be undone.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
          {description || (
            lang === 'de'
              ? `Möchten Sie diesen Eintrag${itemName ? ` („${itemName}“)` : ''} wirklich unwiderruflich löschen?`
              : lang === 'fr'
              ? `Voulez-vous vraiment supprimer définitivement cet élément${itemName ? ` (« ${itemName} »)` : ''} ?`
              : lang === 'es'
              ? `¿Realmente desea eliminar definitivamente este elemento${itemName ? ` («${itemName}»)` : ''}?`
              : `Are you sure you want to permanently delete this item${itemName ? ` ("${itemName}")` : ''}?`
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
          >
            {cancelLabel || (
              lang === 'de' ? 'Abbrechen' :
              lang === 'fr' ? 'Annuler' :
              lang === 'es' ? 'Cancelar' :
              'Cancel'
            )}
          </button>
          <button
            type="button"
            onClick={async () => {
              sounds.playClick();
              await onConfirm();
              onClose();
            }}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-md hover:shadow-lg transition cursor-pointer active:scale-95 ${
              isDangerous 
                ? 'bg-rose-600 hover:bg-rose-700' 
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isDangerous ? <Trash2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>
              {confirmLabel || (
                lang === 'de' ? 'Unwiderruflich löschen' :
                lang === 'fr' ? 'Supprimer définitivement' :
                lang === 'es' ? 'Eliminar definitivamente' :
                'Delete Permanently'
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
