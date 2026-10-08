import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { sounds } from '../lib/sound';
import { DiscordFeedbackApp } from './DiscordFeedbackApp';

interface DiscordFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'bug' | 'idea' | 'feedback';
}

export const DiscordFeedbackModal: React.FC<DiscordFeedbackModalProps> = ({
  isOpen,
  onClose,
  initialType = 'bug',
}) => {
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
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          sounds.playClick();
          onClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-5xl h-[92vh] max-h-[880px] bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close Button in Modal Corner */}
        <button
          type="button"
          onClick={() => {
            sounds.playClick();
            onClose();
          }}
          className="absolute top-4 right-4 z-50 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition cursor-pointer shadow-sm border border-slate-200 dark:border-slate-700"
          title="Schließen / Close (ESC)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Embedded Full DiscordFeedbackApp with Wizard & Live Preview */}
        <div className="flex-1 overflow-hidden">
          <DiscordFeedbackApp 
            initialType={initialType} 
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};
