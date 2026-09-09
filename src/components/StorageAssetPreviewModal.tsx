import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Trash2, 
  ExternalLink, 
  Folder, 
  Calendar, 
  HardDrive, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  FileCode, 
  Archive, 
  File,
  Check,
  Tag
} from 'lucide-react';
import { StorageAsset, DesktopFolder } from '../types';
import { formatFileSize, downloadStorageAsset } from '../lib/storageAssets';
import { sounds } from '../lib/sound';

interface StorageAssetPreviewModalProps {
  asset: StorageAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteAsset: (id: string) => void;
  onLinkFolder: (assetId: string, folderId?: string) => void;
  folders: DesktopFolder[];
  isDark: boolean;
}

export const StorageAssetPreviewModal: React.FC<StorageAssetPreviewModalProps> = ({
  asset,
  isOpen,
  onClose,
  onDeleteAsset,
  onLinkFolder,
  folders,
  isDark
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>(asset?.folderId || '');
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen || !asset) return null;

  const getCategoryIcon = () => {
    switch (asset.category) {
      case 'image': return <ImageIcon className="w-5 h-5 text-purple-500" />;
      case 'pdf': return <FileText className="w-5 h-5 text-rose-500" />;
      case 'spreadsheet': return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
      case 'code': return <FileCode className="w-5 h-5 text-blue-500" />;
      case 'archive': return <Archive className="w-5 h-5 text-amber-500" />;
      default: return <File className="w-5 h-5 text-indigo-500" />;
    }
  };

  const handleFolderChange = (newFolderId: string) => {
    setSelectedFolderId(newFolderId);
    onLinkFolder(asset.id, newFolderId ? newFolderId : undefined);
    setIsSaved(true);
    sounds.playSuccess();
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDownload = () => {
    sounds.playClick();
    downloadStorageAsset(asset);
  };

  const handleDelete = () => {
    sounds.playDelete();
    onDeleteAsset(asset.id);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl border transition-all animate-scale-up overflow-hidden ${
          isDark 
            ? 'bg-slate-900 border-slate-700/80 text-white' 
            : 'bg-white border-slate-200/90 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 flex items-center justify-center shrink-0">
              {getCategoryIcon()}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold truncate">{asset.name}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>{formatFileSize(asset.size)}</span>
                <span>•</span>
                <span className="uppercase">{asset.category}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
              title="Herunterladen"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Visual Preview */}
          {asset.category === 'image' && asset.dataUrl ? (
            <div className="flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 max-h-[380px] overflow-hidden">
              <img 
                src={asset.dataUrl} 
                alt={asset.name} 
                className="max-h-[350px] max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          ) : asset.category === 'pdf' && asset.dataUrl ? (
            <div className="p-6 bg-rose-50/40 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/40 text-center space-y-3">
              <FileText className="w-12 h-12 text-rose-500 mx-auto" />
              <div>
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100">PDF-Dokument</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dieses Dokument ist offline lokal gespeichert und kann jederzeit heruntergeladen oder geöffnet werden.
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF herunterladen</span>
                </button>
                {asset.dataUrl && (
                  <a
                    href={asset.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>In neuem Fenster öffnen</span>
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                {getCategoryIcon()}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">{asset.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {asset.mimeType} • {formatFileSize(asset.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Datei herunterladen ({formatFileSize(asset.size)})</span>
              </button>
            </div>
          )}

          {/* Details & Location Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                <span>Speicherort &amp; Herkunft</span>
              </span>
              <p className="text-slate-600 dark:text-slate-400 break-all font-mono text-[11px]">
                {asset.storageLocationName || 'Lokaler Speicherplatz'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>Hinzugefügt am</span>
              </span>
              <p className="text-slate-600 dark:text-slate-400">
                {new Date(asset.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Folder Linking Selector */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                <Folder className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Mit Desktop-Ordner verknüpfen</span>
              </span>
              {isSaved && (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1 animate-fade-in">
                  <Check className="w-3 h-3" /> Verknüpfung aktualisiert
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Wähle den Desktop-Ordner aus, in dem diese Datei angezeigt werden soll.
            </p>
            <select
              value={selectedFolderId}
              onChange={(e) => handleFolderChange(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">(Kein Ordner / Globaler Speicherort)</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>
                  📁 {f.name} ({f.modules.length} Apps)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <button
            type="button"
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition cursor-pointer border border-rose-200 dark:border-rose-900/40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Aus Speicher löschen</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Herunterladen</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
