import React, { useState } from 'react';
import { 
  Folder, 
  X, 
  Edit3, 
  Trash2, 
  ArrowUpRight, 
  Plus, 
  Check, 
  LogOut,
  Maximize2
} from 'lucide-react';
import { ActiveModule, DesktopFolder } from '../types';
import { sounds } from '../lib/sound';

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md p-6 rounded-3xl shadow-2xl border transition-all animate-scale-up ${
          isDark 
            ? 'bg-slate-900/95 border-slate-700/80 text-white' 
            : 'bg-white/95 border-slate-200 text-slate-900'
        }`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)'
        }}
      >
        {/* Header with Folder Icon, Title & Close */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-500 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Folder className="w-5 h-5" />
            </div>

            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  autoFocus
                  className="px-2.5 py-1 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 border border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  <Check className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartEdit}
                className="group flex items-center gap-2 text-left"
                title="Klicken zum Umbenennen"
              >
                <span className="text-base font-extrabold tracking-tight hover:underline">
                  {folder.name}
                </span>
                <Edit3 className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contained Apps Grid */}
        <div className="py-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
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
                    className="flex flex-col items-center text-center p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition active:scale-95 w-full"
                  >
                    <div className={`w-12 h-12 rounded-2xl ${meta.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="mt-2 text-xs font-semibold truncate max-w-[76px] leading-tight">
                      {meta.title}
                    </span>
                  </button>

                  {/* Quick Remove from Folder Button */}
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playPop();
                      onRemoveFromFolder(folder.id, mod);
                    }}
                    title="Vom Ordner auf den Desktop verschieben"
                    className="absolute -top-1 -right-1 p-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-rose-500 hover:text-white opacity-0 group-hover:opacity-100 transition shadow-xs"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>{folder.modules.length} Apps im Ordner</span>
          
          <button
            type="button"
            onClick={() => {
              sounds.playDelete();
              onDissolveFolder(folder.id);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Ordner auflösen</span>
          </button>
        </div>
      </div>
    </div>
  );
};
