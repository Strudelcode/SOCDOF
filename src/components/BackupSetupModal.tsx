import React, { useEffect, useRef, useState } from 'react';
import { Shield, FolderOpen, Check, X, ArrowRight, HardDrive, ExternalLink, CheckCircle2 } from 'lucide-react';
import { CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { db } from '../lib/db';
import { t } from '../lib/i18n';
import { isElectron } from '../lib/platform';

interface BackupSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyProfile;
  onUpdateCompany: (updated: CompanyProfile) => void;
}

export function BackupSetupModal({
  isOpen,
  onClose,
  company,
  onUpdateCompany
}: BackupSetupModalProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [defaultDir, setDefaultDir] = useState<string>('');
  const [selectedPath, setSelectedPath] = useState<string>(company.backup_folder_path || '');
  const [isPicking, setIsPicking] = useState<boolean>(false);
  const [justPicked, setJustPicked] = useState<boolean>(false);

  // Initialize desktop default directory (Documents/SOCDOF/backups)
  useEffect(() => {
    let isMounted = true;
    async function initDefault() {
      if (typeof window !== 'undefined' && window.electronAPI?.getBackupFolderPath) {
        try {
          const res = await window.electronAPI.getBackupFolderPath();
          if (isMounted && res?.backupDir) {
            setDefaultDir(res.backupDir);
            if (!company.backup_folder_path) {
              setSelectedPath(res.backupDir);
            }
          }
        } catch (e) {
          console.warn('Failed to resolve default desktop backup folder:', e);
        }
      }
    }
    if (isOpen) {
      initDefault();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, company.backup_folder_path]);

  if (!isOpen) return null;

  const markCompleted = () => {
    try {
      localStorage.setItem('socdof_backup_setup_initialized', 'true');
    } catch {
      // ignore
    }
  };

  const effectivePath = selectedPath || defaultDir || 'Dokumente/SOCDOF/backups';

  const handlePickFolder = async () => {
    sounds.playClick();
    setIsPicking(true);
    let chosenPath = '';

    try {
      // 1. Native Desktop Electron folder picker (Directly in SOCDOF folder with backups visible)
      if (typeof window !== 'undefined' && window.electronAPI?.selectBackupFolder) {
        const result = await window.electronAPI.selectBackupFolder();
        if (!result.canceled && result.folderPath) {
          chosenPath = result.folderPath;
        }
      } else if ('showDirectoryPicker' in window) {
        // 2. Web File System Access API fallback
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (dirHandle && dirHandle.name) {
          chosenPath = `Documents/SOCDOF/${dirHandle.name}`;
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Folder picker warning:', err);
      }
    } finally {
      setIsPicking(false);
    }

    if (chosenPath) {
      setSelectedPath(chosenPath);
      setJustPicked(true);
      sounds.playSuccess();
      setTimeout(() => setJustPicked(false), 3000);
    } else if (!chosenPath && !window.electronAPI?.selectBackupFolder) {
      // Web input fallback
      folderInputRef.current?.click();
    }
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const relPath = files[0].webkitRelativePath || '';
      const dirName = relPath.split('/')[0] || files[0].name || 'backups';
      const pickedPath = `Documents/SOCDOF/${dirName}`;
      setSelectedPath(pickedPath);
      setJustPicked(true);
      sounds.playSuccess();
      setTimeout(() => setJustPicked(false), 3000);
    }
  };

  const handleOpenFolderInExplorer = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.openBackupFolder) {
      sounds.playClick();
      await window.electronAPI.openBackupFolder(effectivePath);
    }
  };

  const applyAndFinish = async (enabled: boolean, path: string) => {
    const finalPath = enabled ? (path || effectivePath) : '';
    const updated: CompanyProfile = {
      ...company,
      auto_backup_enabled: enabled,
      backup_folder_path: finalPath
    };

    try {
      await db.settings.put({ key: 'company_profile', value: updated });
    } catch (err) {
      console.warn('Error saving company profile:', err);
    }

    onUpdateCompany(updated);
    markCompleted();
    sounds.playSuccess();
    onClose();
  };

  const handleConfirmFinish = async () => {
    sounds.playClick();
    await applyAndFinish(true, effectivePath);
  };

  const handleSkipOrDisable = async () => {
    sounds.playClick();
    await applyAndFinish(false, '');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      {/* Hidden input fallback for browser directory selection */}
      <input
        ref={folderInputRef}
        type="file"
        /* @ts-ignore */
        webkitdirectory=""
        directory=""
        onChange={handleFolderInputChange}
        className="hidden"
      />

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0 shadow-xs">
            <Shield className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('backup.wizard_title')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('backup.wizard_desc')}
            </p>
          </div>
        </div>

        {/* Selected / Pre-configured Backup Folder Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-xs text-slate-800 dark:text-slate-200">
              <HardDrive className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>{t('backup.selected_folder_label')}</span>
            </div>
            {isElectron() && (
              <button
                type="button"
                onClick={handleOpenFolderInExplorer}
                title={t('backup.btn_open_folder')}
                className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 transition"
              >
                <ExternalLink className="w-3 h-3" />
                <span>{t('backup.btn_open_folder')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
            <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-xs font-mono text-slate-800 dark:text-slate-200 truncate select-all flex-1" title={effectivePath}>
              {effectivePath}
            </span>
            {justPicked && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md shrink-0 animate-fade-in">
                <CheckCircle2 className="w-3 h-3" />
                <span>OK</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>{t('backup.folder_ready_badge')}</span>
            </div>
            <button
              type="button"
              onClick={handlePickFolder}
              disabled={isPicking}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold flex items-center gap-1 transition disabled:opacity-50"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{t('backup.btn_change_folder')}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-1">
          {/* 1. Primary: Finish & Enable Backups */}
          <button
            type="button"
            onClick={handleConfirmFinish}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-indigo-500/20 transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <Check className="w-4 h-4" />
              <span>{t('backup.btn_finish_setup')}</span>
            </div>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* 2. Secondary: Change folder button (if not already picked) */}
          <button
            type="button"
            onClick={handlePickFolder}
            disabled={isPicking}
            className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <FolderOpen className="w-4 h-4 text-indigo-500" />
            <span>{t('backup.btn_change_folder')}</span>
          </button>

          {/* 3. Tertiary: Continue without backups */}
          <button
            type="button"
            onClick={handleSkipOrDisable}
            className="w-full py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium text-[11px] transition flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t('backup.btn_skip_later')}</span>
          </button>
        </div>

        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
          {t('backup.note_change_later')}
        </p>
      </div>
    </div>
  );
}
