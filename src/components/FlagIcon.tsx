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

const KNOWN_FLAG_EMOJIS: Record<string, string> = {
  en: '🇺🇸',
  us: '🇺🇸',
  uk: '🇬🇧',
  gb: '🇬🇧',
  de: '🇩🇪',
  at: '🇦🇹',
  ch: '🇨🇭',
  fr: '🇫🇷',
  es: '🇪🇸',
  it: '🇮🇹',
  nl: '🇳🇱',
  pt: '🇵🇹',
  br: '🇧🇷',
  pl: '🇵🇱',
  ru: '🇷🇺',
  tr: '🇹🇷',
  ua: '🇺🇦',
  ukr: '🇺🇦',
  zh: '🇨🇳',
  cn: '🇨🇳',
  ja: '🇯🇵',
  jp: '🇯🇵',
  ko: '🇰🇷',
  kr: '🇰🇷',
  sv: '🇸🇪',
  se: '🇸🇪',
  no: '🇳🇴',
  da: '🇩🇰',
  dk: '🇩🇰',
  fi: '🇫🇮',
  cs: '🇨🇿',
  cz: '🇨🇿',
  el: '🇬🇷',
  gr: '🇬🇷',
  hu: '🇭🇺',
  ro: '🇷🇴',
  ar: '🇸🇦',
  hi: '🇮🇳'
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
    sm: { box: 'w-4 h-3', text: 'text-xs', img: 'w-4 h-3' },
    md: { box: 'w-6 h-4', text: 'text-sm', img: 'w-6 h-4' },
    lg: { box: 'w-8 h-6', text: 'text-lg', img: 'w-8 h-6' },
    xl: { box: 'w-10 h-7', text: 'text-2xl', img: 'w-10 h-7' }
  };

  const selectedSize = sizeDimensions[size] || sizeDimensions.md;
  const cleanCode = (code || '').toLowerCase().trim();

  // 1. Check if a custom image was provided directly or discovered in %APPDATA%/socdof/languages/flags/
  const resolvedImage = customImage || getCustomFlagImage(cleanCode);

  if (resolvedImage) {
    return (
      <img
        src={resolvedImage}
        alt={title || code}
        title={title || code.toUpperCase()}
        className={`rounded-[3px] object-cover shadow-xs border border-slate-200/80 dark:border-slate-700/80 shrink-0 ${selectedSize.img} ${className}`}
        onError={(e) => {
          // Hide image if broken and fallback below
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // 2. Check for real emoji flag
  const resolvedEmoji = emoji || KNOWN_FLAG_EMOJIS[cleanCode];

  if (resolvedEmoji) {
    return (
      <span 
        className={`inline-flex items-center justify-center shrink-0 leading-none select-none filter drop-shadow-xs transition-transform ${selectedSize.text} ${className}`}
        role="img"
        aria-label={title || code}
        title={title || code.toUpperCase()}
      >
        {resolvedEmoji}
      </span>
    );
  }

  // 3. Fallback: Black flag with a question mark (Standard schwarze Flagge mit Fragezeichen)
  return (
    <div 
      className={`rounded-[3px] bg-slate-950 dark:bg-black text-white border border-slate-700/80 dark:border-slate-800 shadow-xs flex items-center justify-center shrink-0 select-none overflow-hidden ${selectedSize.box} ${className}`}
      title={title || `Custom Flag (${code})`}
      aria-label={title || `Custom Flag (${code})`}
    >
      <svg 
        viewBox="0 0 24 18" 
        className="w-full h-full p-0.5" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dark canvas */}
        <rect width="24" height="18" rx="2" fill="#09090b"/>
        {/* Flag pole */}
        <path d="M4 3.5v11" stroke="#71717a" strokeWidth="1.2" strokeLinecap="round"/>
        {/* Black wave banner */}
        <path d="M4.5 4.5c3-1.2 5.5 1.2 8.5 0v6.5c-3 1.2-5.5-1.2-8.5 0V4.5z" fill="#27272a" stroke="#52525b" strokeWidth="0.8"/>
        {/* Bold question mark centered on the black flag */}
        <text 
          x="8.8" 
          y="8.8" 
          textAnchor="middle" 
          dominantBaseline="central" 
          fill="#ffffff" 
          fontSize="5.5" 
          fontWeight="900" 
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          ?
        </text>
      </svg>
    </div>
  );
};

