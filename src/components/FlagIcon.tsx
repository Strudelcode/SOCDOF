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

// Built-in crisp SVG flags to guarantee authentic graphic rendering across Windows,
// Linux, and web environments where Unicode country flag emojis degrade to 2-letter codes.
const BUILTIN_SVG_FLAGS: Record<string, React.ReactNode> = {
  de: (
    <svg viewBox="0 0 5 3" className="w-full h-full object-cover">
      <rect width="5" height="1" y="0" fill="#000000" />
      <rect width="5" height="1" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  ),
  ger: (
    <svg viewBox="0 0 5 3" className="w-full h-full object-cover">
      <rect width="5" height="1" y="0" fill="#000000" />
      <rect width="5" height="1" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  ),
  en: (
    <svg viewBox="0 0 19 10" className="w-full h-full object-cover">
      <rect width="19" height="10" fill="#b22234" />
      <path d="M0,1.54h19 M0,3.08h19 M0,4.62h19 M0,6.15h19 M0,7.69h19 M0,9.23h19" stroke="#ffffff" strokeWidth="0.77" />
      <rect width="7.6" height="5.38" fill="#3c3b6e" />
      <circle cx="1.9" cy="1.3" r="0.4" fill="#ffffff" />
      <circle cx="3.8" cy="1.3" r="0.4" fill="#ffffff" />
      <circle cx="5.7" cy="1.3" r="0.4" fill="#ffffff" />
      <circle cx="2.8" cy="2.7" r="0.4" fill="#ffffff" />
      <circle cx="4.7" cy="2.7" r="0.4" fill="#ffffff" />
      <circle cx="1.9" cy="4.0" r="0.4" fill="#ffffff" />
      <circle cx="3.8" cy="4.0" r="0.4" fill="#ffffff" />
      <circle cx="5.7" cy="4.0" r="0.4" fill="#ffffff" />
    </svg>
  ),
  us: (
    <svg viewBox="0 0 19 10" className="w-full h-full object-cover">
      <rect width="19" height="10" fill="#b22234" />
      <path d="M0,1.54h19 M0,3.08h19 M0,4.62h19 M0,6.15h19 M0,7.69h19 M0,9.23h19" stroke="#ffffff" strokeWidth="0.77" />
      <rect width="7.6" height="5.38" fill="#3c3b6e" />
      <circle cx="1.9" cy="1.3" r="0.4" fill="#ffffff" />
      <circle cx="3.8" cy="1.3" r="0.4" fill="#ffffff" />
      <circle cx="5.7" cy="1.3" r="0.4" fill="#ffffff" />
      <circle cx="2.8" cy="2.7" r="0.4" fill="#ffffff" />
      <circle cx="4.7" cy="2.7" r="0.4" fill="#ffffff" />
      <circle cx="1.9" cy="4.0" r="0.4" fill="#ffffff" />
      <circle cx="3.8" cy="4.0" r="0.4" fill="#ffffff" />
      <circle cx="5.7" cy="4.0" r="0.4" fill="#ffffff" />
    </svg>
  ),
  gb: (
    <svg viewBox="0 0 60 30" className="w-full h-full object-cover">
      <clipPath id="flag_gb_clip"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
      <g clipPath="url(#flag_gb_clip)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="3"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  ),
  uk: (
    <svg viewBox="0 0 60 30" className="w-full h-full object-cover">
      <clipPath id="flag_uk_clip"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
      <g clipPath="url(#flag_uk_clip)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#ffffff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="3"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#ffffff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  ),
  fr: (
    <svg viewBox="0 0 3 2" className="w-full h-full object-cover">
      <rect width="1" height="2" x="0" fill="#002654" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#ED2939" />
    </svg>
  ),
  fra: (
    <svg viewBox="0 0 3 2" className="w-full h-full object-cover">
      <rect width="1" height="2" x="0" fill="#002654" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#ED2939" />
    </svg>
  ),
  es: (
    <svg viewBox="0 0 3 2" className="w-full h-full object-cover">
      <rect width="3" height="2" fill="#AA151B" />
      <rect width="3" height="1" y="0.5" fill="#F1BF00" />
    </svg>
  ),
  esp: (
    <svg viewBox="0 0 3 2" className="w-full h-full object-cover">
      <rect width="3" height="2" fill="#AA151B" />
      <rect width="3" height="1" y="0.5" fill="#F1BF00" />
    </svg>
  ),
  it: (
    <svg viewBox="0 0 3 2" className="w-full h-full object-cover">
      <rect width="1" height="2" x="0" fill="#009246" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#CE2B37" />
    </svg>
  ),
  ita: (
    <svg viewBox="0 0 3 2" className="w-full h-full object-cover">
      <rect width="1" height="2" x="0" fill="#009246" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#CE2B37" />
    </svg>
  ),
  nl: (
    <svg viewBox="0 0 3 2" className="w-full h-full object-cover">
      <rect width="3" height="0.67" y="0" fill="#AE1C28" />
      <rect width="3" height="0.67" y="0.67" fill="#FFFFFF" />
      <rect width="3" height="0.67" y="1.33" fill="#21468B" />
    </svg>
  ),
  at: (
    <svg viewBox="0 0 3 2" className="w-full h-full object-cover">
      <rect width="3" height="0.67" y="0" fill="#ED2939" />
      <rect width="3" height="0.67" y="0.67" fill="#FFFFFF" />
      <rect width="3" height="0.67" y="1.33" fill="#ED2939" />
    </svg>
  ),
  ch: (
    <svg viewBox="0 0 1 1" className="w-full h-full object-cover">
      <rect width="1" height="1" fill="#D52B1E" />
      <rect width="0.2" height="0.6" x="0.4" y="0.2" fill="#FFFFFF" />
      <rect width="0.6" height="0.2" x="0.2" y="0.4" fill="#FFFFFF" />
    </svg>
  )
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

  // 2. Priority 2: Crisp vector SVG flag (eliminates Windows Unicode font 2-letter emoji fallback)
  if (!emoji && BUILTIN_SVG_FLAGS[cleanCode]) {
    return (
      <div 
        className={`rounded-[3px] overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700/80 shrink-0 flex items-center justify-center ${selectedSize.box} ${className}`}
        title={title || code.toUpperCase()}
        aria-label={title || code.toUpperCase()}
      >
        {BUILTIN_SVG_FLAGS[cleanCode]}
      </div>
    );
  }

  // 3. Priority 3: Use authentic Unicode Flag Emoji (from explicit prop or recognized country code)
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

  // 4. Fallback / Standard: Black flag with a question mark (?)
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


