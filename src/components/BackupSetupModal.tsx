import React, { useRef, useState } from 'react';
import { Shield, FolderOpen, Check, X, ArrowRight, HardDrive } from 'lucide-react';
import { CompanyProfile } from '../types';
import { sounds } from '../lib/sound';
import { db } from '../lib/db';
import { t } from '../lib/i18n';

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
  const [selectedPath, setSelectedPath] = useState<string>(company.backup_folder_path || '');

  if (!isOpen) return null;

  const markCompleted = () => {
    try {
      localStorage.setItem('socdof_backup_setup_initialized', 'true');
    } catch {
      // ignore
    }
  };

  const handlePickFolderAndEnable = async () => {
    sounds.playClick();
    let pickedPath = '';

    try {
      // 1. Modern File System Access API
      if ('showDirectoryPicker' in window) {
        const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        if (dirHandle && dirHandle.name) {
          pickedPath = `C:\\${dirHandle.name}\\SOCDOF_Backups`;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return; // user cancelled
      }
      console.warn('showDirectoryPicker unavailable:', err);
    }

    if (!pickedPath) {
      // Fallback via input
      folderInputRef.current?.click();
      return;
    }

    await applyAndFinish(true, pickedPath);
  };

  const handleFolderInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const relPath = files[0].webkitRelativePath || '';
      const dirName = relPath.split('/')[0] || files[0].name || 'Sicherungen';
      const pickedPath = `C:\\${dirName}\\SOCDOF_Backups`;
      await applyAndFinish(true, pickedPath);
    }
  };

  const applyAndFinish = async (enabled: boolean, path: string) => {
    const updated: CompanyProfile = {
      ...company,
      auto_backup_enabled: enabled,
      backup_folder_path: path
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

  const handleSkipDefault = async () => {
    sounds.playClick();
    await applyAndFinish(true, '');
  };

  const handleDisableBackups = async () => {
    sounds.playClick();
    await applyAndFinish(false, '');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      {/* Hidden input fallback for directory selection */}
      <input
        ref={folderInputRef}
        type="file"
        /* @ts-ignore */
        webkitdirectory=""
        directory=""
        onChange={handleFolderInputChange}
        className="hidden"
      />

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 sm:p-7 space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl text-indigo-600 dark:text-indigo-400 shrink-0">
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

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
            <HardDrive className="w-4 h-4 text-indigo-500" />
            <span>{t('backup.default_label')}</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {t('backup.default_desc')}
          </p>
        </div>

        <div className="space-y-2.5 pt-1">
          {/* 1. Primary: Enable & Pick Folder */}
          <button
            type="button"
            onClick={handlePickFolderAndEnable}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-between group"
          >
            <div className="flex items-center gap-2.5">
              <FolderOpen className="w-4 h-4" />
              <span>{t('backup.btn_enable_and_pick')}</span>
            </div>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* 2. Secondary: Skip and keep default */}
          <button
            type="button"
            onClick={handleSkipDefault}
            className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold text-xs transition flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{t('backup.btn_skip_default')}</span>
          </button>

          {/* 3. Tertiary: Disable backups */}
          <button
            type="button"
            onClick={handleDisableBackups}
            className="w-full py-2 px-4 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-medium text-[11px] transition flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t('backup.btn_disable')}</span>
          </button>
        </div>

        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
          {t('backup.note_change_later')}
        </p>
      </div>
    </div>
  );
}
