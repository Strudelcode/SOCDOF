import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, 
  X, 
  Edit3, 
  Trash2, 
  Check, 
  Upload,
  HardDrive,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  Archive,
  File,
  Download,
  Eye,
  Plus,
  ArrowUpRight
} from 'lucide-react';
import { ActiveModule, DesktopFolder, StorageAsset } from '../types';
import { sounds } from '../lib/sound';
import { DynamicCalendarIcon } from './DynamicCalendarIcon';
import { 
  getAssetsForFolder, 
  uploadFileFromStorage, 
  deleteStorageAsset, 
  formatFileSize, 
  downloadStorageAsset,
  linkAssetToFolder
} from '../lib/storageAssets';
import { StorageAssetPreviewModal } from './StorageAssetPreviewModal';

interface DesktopFolderModalProps {
  folder: DesktopFolder | null;
  isOpen: boolean;
  onClose: () => void;
  onLaunchModule: (mod: ActiveModule) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onRemoveFromFolder: (folderId: string, mod: ActiveModule) => void;
  onDissolveFolder: (folderId: string) => void;
  shortcutMeta: Record<ActiveModule, { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; color: string }>;
  isDark: boolean;
  allFolders?: DesktopFolder[];
}

export const DesktopFolderModal: React.FC<DesktopFolderModalProps> = ({
  folder,
  isOpen,
  onClose,
  onLaunchModule,
  onRenameFolder,
  onRemoveFromFolder,
  onDissolveFolder,
  shortcutMeta,
  isDark,
  allFolders = []
}) => {
  const [activeTab, setActiveTab] = useState<'apps' | 'files'>('apps');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [folderAssets, setFolderAssets] = useState<StorageAsset[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<StorageAsset | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load files for this folder whenever opened or updated
  const refreshAssets = () => {
    if (folder) {
      setFolderAssets(getAssetsForFolder(folder.id));
    }
  };

  useEffect(() => {
    if (isOpen && folder) {
      refreshAssets();
    }
  }, [isOpen, folder]);

  // Listen to custom update events from storageAssets
  useEffect(() => {
    const handleStorageUpdate = () => {
      refreshAssets();
    };
    window.addEventListener('socdof-storage-assets-updated', handleStorageUpdate);
    return () => window.removeEventListener('socdof-storage-assets-updated', handleStorageUpdate);
  }, [folder]);

  if (!isOpen || !folder) return null;

  const handleStartEdit = () => {
    setNameInput(folder.name);
    setIsEditingName(true);
  };

  const handleSaveEdit = () => {
    if (nameInput.trim()) {
      onRenameFolder(folder.id, nameInput.trim());
      sounds.playSuccess();
    }
    setIsEditingName(false);
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    sounds.playPop();

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        await uploadFileFromStorage(file, folder.id, `Speicherort: ${folder.name} (Lokal)`);
      }
      sounds.playSuccess();
      refreshAssets();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    deleteStorageAsset(assetId);
    refreshAssets();
  };

  const handleLinkFolder = (assetId: string, targetFolderId?: string) => {
    linkAssetToFolder(assetId, targetFolderId);
    refreshAssets();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'image': return <ImageIcon className="w-4 h-4 text-purple-500" />;
      case 'pdf': return <FileText className="w-4 h-4 text-rose-500" />;
      case 'spreadsheet': return <FileSpreadsheet className="w-4 h-4 text-emerald-500" />;
      case 'code': return <FileCode className="w-4 h-4 text-blue-500" />;
      case 'archive': return <Archive className="w-4 h-4 text-amber-500" />;
      default: return <File className="w-4 h-4 text-indigo-500" />;
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          className={`w-full max-w-xl p-6 rounded-3xl shadow-2xl border transition-all animate-scale-up ${
            isDark 
              ? 'bg-slate-900/95 border-slate-700/80 text-white' 
              : 'bg-white/95 border-slate-200/90 text-slate-900'
          }`}
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
          }}
        >
          {/* Header with Folder Icon, Title & Tabs */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/25 shadow-xs">
                <Folder className="w-6 h-6" />
              </div>

              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') setIsEditingName(false);
                    }}
                    autoFocus
                    className="px-3 py-1.5 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 transition shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="group flex items-center gap-2 text-left cursor-pointer"
                  title="Klicken zum Umbenennen"
                >
                  <span className="text-lg font-black tracking-tight hover:underline">
                    {folder.name}
                  </span>
                  <span className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 group-hover:text-indigo-500 transition">
                    <Edit3 className="w-3.5 h-3.5" />
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Dual Tabs: Apps vs Dateien/Assets */}
          <div className="flex items-center gap-2 mt-4 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('apps');
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'apps'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span>Apps &amp; Module</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                {folder.modules.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                setActiveTab('files');
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Dateien &amp; Speicherorte</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                {folderAssets.length}
              </span>
            </button>
          </div>

          {/* TAB 1: Apps Grid */}
          {activeTab === 'apps' && (
            <div className="py-5">
              {folder.modules.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <p className="text-xs">Keine Apps in diesem Ordner.</p>
                  <p className="text-[11px] text-slate-500">
                    Ziehe Desktop-Symbole auf diesen Ordner, um sie hier einzubetten.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[320px] overflow-y-auto pr-1">
                  {folder.modules.map((mod) => {
                    const meta = shortcutMeta[mod];
                    if (!meta) return null;
                    const Icon = meta.icon;

                    return (
                      <div key={mod} className="group relative flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            onLaunchModule(mod);
                            onClose();
                          }}
                          className="flex flex-col items-center text-center p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition active:scale-95 w-full cursor-pointer group"
                        >
                          <div className="relative">
                            {mod === 'calendar' ? (
                              <div className="group-hover:scale-108 transition-transform duration-200">
                                <DynamicCalendarIcon size="lg" />
                              </div>
                            ) : (
                              <div className={`w-13 h-13 rounded-2xl ${meta.color} text-white flex items-center justify-center shadow-lg group-hover:scale-108 transition-transform duration-200`}>
                                <Icon className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <span className="mt-2.5 text-xs font-bold truncate max-w-[88px] leading-tight text-slate-800 dark:text-slate-100">
                            {meta.title}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-400 truncate max-w-[88px] leading-none mt-0.5">
                            {meta.subtitle}
                          </span>
                        </button>

                        {/* Quick Remove from Folder Button */}
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playPop();
                            onRemoveFromFolder(folder.id, mod);
                          }}
                          title="Vom Ordner zurück auf den Desktop verschieben"
                          className="absolute top-1 right-1 p-1 rounded-full bg-slate-200/90 dark:bg-slate-700/90 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white opacity-0 group-hover:opacity-100 transition shadow-sm cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Files, Storage & Upload Zone */}
          {activeTab === 'files' && (
            <div className="py-4 space-y-4">
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />

              {/* Upload Drop Zone & Action */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files.length > 0) {
                    handleFilesSelected(e.dataTransfer.files);
                  }
                }}
                className={`p-4 rounded-2xl border-2 border-dashed text-center transition cursor-pointer ${
                  isDragOver
                    ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 scale-[1.01]'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/60 dark:bg-slate-800/40'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-2xs">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      {isUploading ? 'Wird vom Speicherort hochgeladen...' : 'Vom Speicherort öffnen zum Hochladen'}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Dateien hier ablegen oder klicken, um Dokumente, Bilder oder Belege auszuwählen
                    </p>
                  </div>
                </div>
              </div>

              {/* Files List in this Folder */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {folderAssets.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    Noch keine Dateien in diesem Ordner verknüpft.
                  </div>
                ) : (
                  folderAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/70 hover:border-indigo-300 dark:hover:border-indigo-600 transition group"
                    >
                      <div 
                        onClick={() => setPreviewAsset(asset)}
                        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                          {getCategoryIcon(asset.category)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                            {asset.name}
                          </p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span>{formatFileSize(asset.size)}</span>
                            <span>•</span>
                            <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewAsset(asset)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                          title="Vorschau & Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            downloadStorageAsset(asset);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                          title="Herunterladen"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            sounds.playDelete();
                            handleDeleteAsset(asset.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="Löschen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="text-slate-500 dark:text-slate-400">
              {activeTab === 'apps' 
                ? 'Tipp: Klicke auf eine App zum Starten' 
                : `${folderAssets.length} Datei(en) im Ordner`}
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  sounds.playDelete();
                  onDissolveFolder(folder.id);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold transition cursor-pointer border border-rose-200 dark:border-rose-900/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ordner auflösen</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Preview / Details Modal */}
      {previewAsset && (
        <StorageAssetPreviewModal
          asset={previewAsset}
          isOpen={!!previewAsset}
          onClose={() => setPreviewAsset(null)}
          onDeleteAsset={handleDeleteAsset}
          onLinkFolder={handleLinkFolder}
          folders={allFolders}
          isDark={isDark}
        />
      )}
    </>
  );
};
