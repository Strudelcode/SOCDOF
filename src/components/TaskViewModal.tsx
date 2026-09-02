import React, { useState } from 'react';
import { 
  Plus, 
  X, 
  Monitor, 
  Check, 
  Trash2, 
  ExternalLink,
  Layers,
  Sparkles,
  Edit2
} from 'lucide-react';
import { AppWindow, VirtualDesktop, ActiveModule } from '../types';
import { sounds } from '../lib/sound';
import { t, useLanguage } from '../lib/i18n';

interface TaskViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  virtualDesktops: VirtualDesktop[];
  activeDesktopId: string;
  onSelectDesktop: (id: string) => void;
  onAddDesktop: () => void;
  onRemoveDesktop: (id: string) => void;
  onRenameDesktop: (id: string, name: string) => void;
  windows: AppWindow[];
  onSelectWindow: (win: AppWindow) => void;
  onCloseWindow: (id: string) => void;
  onMoveWindowToDesktop: (windowId: string, targetDesktopId: string) => void;
}

export const TaskViewModal: React.FC<TaskViewModalProps> = ({
  isOpen,
  onClose,
  virtualDesktops,
  activeDesktopId,
  onSelectDesktop,
  onAddDesktop,
  onRemoveDesktop,
  onRenameDesktop,
  windows,
  onSelectWindow,
  onCloseWindow,
  onMoveWindowToDesktop
}) => {
  const currentLang = useLanguage();
  const [editingDesktopId, setEditingDesktopId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  if (!isOpen) return null;

  const currentDesktopWindows = windows.filter(
    w => !w.desktopId || w.desktopId === 'all' || w.desktopId === activeDesktopId
  );

  const handleStartRename = (desk: VirtualDesktop, e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playClick();
    setEditingDesktopId(desk.id);
    setEditName(desk.name);
  };

  const handleSaveRename = (id: string) => {
    if (editName.trim()) {
      onRenameDesktop(id, editName.trim());
      sounds.playSuccess();
    }
    setEditingDesktopId(null);
  };

  return (
    <div 
      className="fixed inset-0 z-[99990] bg-slate-950/85 backdrop-blur-md flex flex-col animate-fade-in text-white select-none overflow-hidden"
      onClick={onClose}
    >
      {/* 1. Top Section: Windows 11 Style Virtual Desktops Bar */}
      <div 
        className="pt-6 pb-5 px-6 sm:px-12 bg-slate-900/60 border-b border-slate-800/80 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>{t('taskview.desktops_title', currentLang, 'Virtuelle Desktops')}</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Task-Ansicht schließen (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Desktops Strip */}
        <div className="max-w-7xl mx-auto flex items-center gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {virtualDesktops.map((desk, idx) => {
            const isActive = desk.id === activeDesktopId;
            const isEditing = editingDesktopId === desk.id;
            const deskWindowsCount = windows.filter(w => !w.desktopId || w.desktopId === 'all' || w.desktopId === desk.id).length;

            return (
              <div
                key={desk.id}
                onClick={() => {
                  if (!isEditing) {
                    sounds.playClick();
                    onSelectDesktop(desk.id);
                  }
                }}
                className={`relative group flex flex-col items-center gap-2 p-3 rounded-2xl cursor-pointer transition-all duration-150 shrink-0 ${
                  isActive 
                    ? 'bg-indigo-600/30 border-2 border-indigo-500 shadow-lg shadow-indigo-500/20' 
                    : 'bg-slate-800/60 border border-slate-700/60 hover:bg-slate-800 hover:border-slate-600'
                }`}
                style={{ width: 170 }}
              >
                {/* Mini desktop preview card */}
                <div className="w-full h-20 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/70 border border-slate-700/50 flex flex-col items-center justify-center p-2 relative overflow-hidden shadow-inner">
                  <Monitor className={`w-6 h-6 mb-1 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  <span className="text-[10px] text-slate-400">
                    {deskWindowsCount} {deskWindowsCount === 1 ? 'Fenster' : 'Fenster'}
                  </span>

                  {/* Active Indicator dot */}
                  {isActive && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-950" />
                  )}

                  {/* Delete Desktop Button */}
                  {virtualDesktops.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playDelete();
                        onRemoveDesktop(desk.id);
                      }}
                      className="absolute top-1 left-1 p-1 rounded-lg bg-rose-500/80 hover:bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition shadow-xs"
                      title="Desktop schließen"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Desktop Title / Inline Editor */}
                <div className="w-full flex items-center justify-center gap-1">
                  {isEditing ? (
                    <input
                      type="text"
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleSaveRename(desk.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(desk.id);
                        if (e.key === 'Escape') setEditingDesktopId(null);
                      }}
                      className="w-full text-xs font-bold text-center px-1.5 py-0.5 rounded bg-slate-950 border border-indigo-500 text-white focus:outline-none"
                    />
                  ) : (
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-xs font-semibold truncate text-slate-200">
                        {desk.name}
                      </span>
                      <button
                        onClick={(e) => handleStartRename(desk, e)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white transition"
                        title="Desktop umbenennen"
                      >
                        <Edit2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add New Desktop Button */}
          <button
            onClick={() => {
              sounds.playPop();
              onAddDesktop();
            }}
            className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-slate-800/40 hover:bg-slate-800/80 border border-dashed border-slate-700 hover:border-indigo-400 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
            style={{ width: 150, height: 135 }}
            title="Neuen virtuellen Desktop hinzufügen"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-700/60 flex items-center justify-center">
              <Plus className="w-5 h-5 text-indigo-400" />
            </div>
            <span className="text-xs font-medium">{t('taskview.new_desktop', currentLang, 'Neuer Desktop')}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Windows Grid: Live Task-Switching Cards */}
      <div 
        className="flex-1 p-6 sm:p-12 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <span>{t('taskview.open_windows', currentLang, 'Geöffnete Fenster')}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[11px] text-slate-400">
                {currentDesktopWindows.length}
              </span>
            </h3>
            <span className="text-xs text-slate-500">
              {t('taskview.hint_switch', currentLang, 'Klicken Sie auf ein Fenster, um direkt dorthin zu wechseln')}
            </span>
          </div>

          {currentDesktopWindows.length === 0 ? (
            <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
              <Monitor className="w-12 h-12 text-slate-700 stroke-1" />
              <p className="text-sm">{t('taskview.no_windows', currentLang, 'Keine geöffneten Fenster auf diesem Desktop.')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {currentDesktopWindows.map((win) => (
                <div
                  key={win.id}
                  onClick={() => {
                    sounds.playClick();
                    onSelectWindow(win);
                    onClose();
                  }}
                  className="group relative bg-slate-900/90 hover:bg-slate-850 rounded-2xl border border-slate-700/70 hover:border-indigo-500/80 p-3 flex flex-col gap-2.5 cursor-pointer shadow-xl hover:shadow-2xl hover:scale-[1.02] transition duration-150 overflow-hidden"
                >
                  {/* Card Titlebar */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-lg bg-indigo-600/60 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                        {win.title.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-slate-200 truncate group-hover:text-indigo-300 transition">
                        {win.title}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        sounds.playWindowClose();
                        onCloseWindow(win.id);
                      }}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-rose-600/80 transition shrink-0"
                      title="Fenster schließen"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Window Thumbnail Simulation */}
                  <div className="w-full h-36 rounded-xl bg-slate-950/80 border border-slate-800 p-3 flex flex-col justify-between relative overflow-hidden group-hover:border-slate-700 transition">
                    <div className="space-y-1.5 opacity-60">
                      <div className="w-1/3 h-2 rounded bg-slate-700" />
                      <div className="w-full h-1.5 rounded bg-slate-800" />
                      <div className="w-4/5 h-1.5 rounded bg-slate-800" />
                      <div className="w-2/3 h-1.5 rounded bg-slate-800" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-slate-400">
                      <span className="capitalize">{win.module}</span>
                      {win.isMinimized && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 text-[9px]">
                          Minimiert
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Move to Desktop Action dropdown/button */}
                  {virtualDesktops.length > 1 && (
                    <div 
                      className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>Verschieben nach:</span>
                      <div className="flex items-center gap-1">
                        {virtualDesktops.map((d) => (
                          <button
                            key={d.id}
                            onClick={() => {
                              sounds.playPop();
                              onMoveWindowToDesktop(win.id, d.id);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                              win.desktopId === d.id || (!win.desktopId && d.id === 'desktop-1')
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                            title={`Auf ${d.name} verschieben`}
                          >
                            {d.name.replace('Desktop ', 'D')}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
