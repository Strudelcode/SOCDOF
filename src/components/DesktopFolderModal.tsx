import React, { useState } from 'react';
import { 
  Folder, 
  X, 
  Edit3, 
  Trash2, 
  Check, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { ActiveModule, DesktopFolder } from '../types';
import { sounds } from '../lib/sound';
import { DynamicCalendarIcon } from './DynamicCalendarIcon';

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
  isDark
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');

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

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg p-6 rounded-3xl shadow-2xl border transition-all animate-scale-up ${
          isDark 
            ? 'bg-slate-900/95 border-slate-700/80 text-white' 
            : 'bg-white/95 border-slate-200/90 text-slate-900'
        }`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
        }}
      >
        {/* Header with Folder Icon, Title & Close */}
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
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700">
              {folder.modules.length} Apps
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contained Apps Grid */}
        <div className="py-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[360px] overflow-y-auto pr-1">
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
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            Tipp: Klicke auf eine App zum Starten
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
  );
};
