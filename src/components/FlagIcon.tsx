import React, { useState, useEffect } from 'react';
import { LanguageCode, getCustomFlagImage, subscribeFlags } from '../lib/i18n';

interface FlagIconProps {
  code: LanguageCode | string;
  customImage?: string | null;
  emoji?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
}

// Crisp standard Unicode flag emojis for languages/regions
const LANGUAGE_EMOJIS: Record<string, string> = {
  de: '🇩🇪',
  ger: '🇩🇪',
  en: '🇺🇸',
  us: '🇺🇸',
  gb: '🇬🇧',
  uk: '🇬🇧',
  fr: '🇫🇷',
  fra: '🇫🇷',
  es: '🇪🇸',
  esp: '🇪🇸',
  it: '🇮🇹',
  ita: '🇮🇹',
  nl: '🇳🇱',
  nld: '🇳🇱',
  pl: '🇵🇱',
  pol: '🇵🇱',
  pt: '🇵🇹',
  por: '🇵🇹',
  tr: '🇹🇷',
  tur: '🇹🇷',
  ru: '🇷🇺',
  rus: '🇷🇺',
  ja: '🇯🇵',
  jpn: '🇯🇵',
  zh: '🇨🇳',
  chi: '🇨🇳',
  zho: '🇨🇳',
  ko: '🇰🇷',
  kor: '🇰🇷',
  sv: '🇸🇪',
  swe: '🇸🇪',
  no: '🇳🇴',
  nor: '🇳🇴',
  da: '🇩🇰',
  dan: '🇩🇰',
  fi: '🇫🇮',
  fin: '🇫🇮',
  cs: '🇨🇿',
  ces: '🇨🇿',
  el: '🇬🇷',
  ell: '🇬🇷',
  ro: '🇷🇴',
  ron: '🇷🇴',
  hu: '🇭🇺',
  hun: '🇭🇺',
  ua: '🇺🇦',
  ukr: '🇺🇦',
  at: '🇦🇹',
  ch: '🇨🇭'
};

export const FlagIcon: React.FC<FlagIconProps> = ({ 
  code, 
  customImage, 
  emoji,
  className = '', 
  size = 'md',
  title
}) => {
  const [, setFlagUpdateTick] = useState(0);

  // Subscribe to live flag updates from desktop flags folder
  useEffect(() => {
    return subscribeFlags(() => {
      setFlagUpdateTick(t => t + 1);
    });
  }, []);

  const sizeDimensions = {
    sm: { box: 'w-5 h-3.5', text: 'text-[9px]', img: 'w-5 h-3.5', emoji: 'text-sm' },
    md: { box: 'w-6 h-4', text: 'text-[10px]', img: 'w-6 h-4', emoji: 'text-base' },
    lg: { box: 'w-8 h-5.5', text: 'text-xs', img: 'w-8 h-5.5', emoji: 'text-lg' },
    xl: { box: 'w-10 h-7', text: 'text-sm', img: 'w-10 h-7', emoji: 'text-2xl' }
  };

  const selectedSize = sizeDimensions[size] || sizeDimensions.md;
  const cleanCode = (code || '').toLowerCase().trim();

  // 1. Priority 1: Check if a custom image was dropped into languages/flags/ folder
  const resolvedImage = customImage || getCustomFlagImage(cleanCode);

  if (resolvedImage) {
    return (
      <img
        src={resolvedImage}
        alt={title || code}
        title={title || code.toUpperCase()}
        className={`rounded-[3px] object-cover shadow-xs border border-slate-200/80 dark:border-slate-700/80 shrink-0 ${selectedSize.img} ${className}`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // 2. Priority 2: Use authentic Unicode Flag Emoji (from prop or recognized country code)
  const resolvedEmoji = emoji || LANGUAGE_EMOJIS[cleanCode];
  if (resolvedEmoji) {
    return (
      <span 
        role="img" 
        aria-label={title || code}
        title={title || code.toUpperCase()}
        className={`inline-flex items-center justify-center leading-none select-none shrink-0 ${selectedSize.emoji} ${className}`}
      >
        {resolvedEmoji}
      </span>
    );
  }

  // 3. Fallback / Standard: Black flag with a question mark (?)
  return (
    <div 
      className={`rounded-[3px] bg-slate-950 text-white font-bold border border-slate-700/80 flex items-center justify-center shrink-0 select-none overflow-hidden relative ${selectedSize.box} ${className}`}
      title={title || (code ? `${code.toUpperCase()} (?)` : '?')}
      aria-label={title || (code ? `${code.toUpperCase()} (?)` : '?')}
    >
      <svg viewBox="0 0 20 14" className="w-full h-full text-black fill-current" preserveAspectRatio="none">
        <rect width="20" height="14" fill="#090d16" />
        <path d="M2 1h16l-2.5 6 2.5 6H2V1z" fill="#1e293b" />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center ${selectedSize.text} font-black text-amber-300 dark:text-amber-200 leading-none select-none pl-0.5`}>
        ?
      </span>
    </div>
  );
};


