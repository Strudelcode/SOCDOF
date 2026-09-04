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

// Built-in crisp vector flags for standard languages
const BuiltInFlags: Record<string, React.FC<{ className?: string }>> = {
  de: ({ className }) => (
    <svg viewBox="0 0 5 3" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="5" height="3" fill="#000000" />
      <rect width="5" height="2" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  ),
  ger: ({ className }) => (
    <svg viewBox="0 0 5 3" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="5" height="3" fill="#000000" />
      <rect width="5" height="2" y="1" fill="#DD0000" />
      <rect width="5" height="1" y="2" fill="#FFCE00" />
    </svg>
  ),
  fr: ({ className }) => (
    <svg viewBox="0 0 3 2" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="1" height="2" x="0" fill="#002654" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#ED2939" />
    </svg>
  ),
  fra: ({ className }) => (
    <svg viewBox="0 0 3 2" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="1" height="2" x="0" fill="#002654" />
      <rect width="1" height="2" x="1" fill="#FFFFFF" />
      <rect width="1" height="2" x="2" fill="#ED2939" />
    </svg>
  ),
  es: ({ className }) => (
    <svg viewBox="0 0 3 2" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="3" height="2" fill="#AA151B" />
      <rect width="3" height="1" y="0.5" fill="#F1BF00" />
    </svg>
  ),
  esp: ({ className }) => (
    <svg viewBox="0 0 3 2" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="3" height="2" fill="#AA151B" />
      <rect width="3" height="1" y="0.5" fill="#F1BF00" />
    </svg>
  ),
  en: ({ className }) => (
    <svg viewBox="0 0 19 10" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="19" height="10" fill="#B22234" />
      <path d="M0,1.54H19M0,3.08H19M0,4.62H19M0,6.15H19M0,7.69H19M0,9.23H19" stroke="#fff" strokeWidth="0.77" />
      <rect width="7.6" height="5.38" fill="#3C3B6E" />
      <g fill="#fff" opacity="0.9">
        <circle cx="1.3" cy="0.9" r="0.25" /><circle cx="2.6" cy="0.9" r="0.25" /><circle cx="3.9" cy="0.9" r="0.25" /><circle cx="5.2" cy="0.9" r="0.25" /><circle cx="6.5" cy="0.9" r="0.25" />
        <circle cx="1.9" cy="1.8" r="0.25" /><circle cx="3.2" cy="1.8" r="0.25" /><circle cx="4.5" cy="1.8" r="0.25" /><circle cx="5.8" cy="1.8" r="0.25" />
        <circle cx="1.3" cy="2.7" r="0.25" /><circle cx="2.6" cy="2.7" r="0.25" /><circle cx="3.9" cy="2.7" r="0.25" /><circle cx="5.2" cy="2.7" r="0.25" /><circle cx="6.5" cy="2.7" r="0.25" />
        <circle cx="1.9" cy="3.6" r="0.25" /><circle cx="3.2" cy="3.6" r="0.25" /><circle cx="4.5" cy="3.6" r="0.25" /><circle cx="5.8" cy="3.6" r="0.25" />
        <circle cx="1.3" cy="4.5" r="0.25" /><circle cx="2.6" cy="4.5" r="0.25" /><circle cx="3.9" cy="4.5" r="0.25" /><circle cx="5.2" cy="4.5" r="0.25" /><circle cx="6.5" cy="4.5" r="0.25" />
      </g>
    </svg>
  ),
  us: ({ className }) => (
    <svg viewBox="0 0 19 10" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="19" height="10" fill="#B22234" />
      <path d="M0,1.54H19M0,3.08H19M0,4.62H19M0,6.15H19M0,7.69H19M0,9.23H19" stroke="#fff" strokeWidth="0.77" />
      <rect width="7.6" height="5.38" fill="#3C3B6E" />
      <g fill="#fff" opacity="0.9">
        <circle cx="1.3" cy="0.9" r="0.25" /><circle cx="2.6" cy="0.9" r="0.25" /><circle cx="3.9" cy="0.9" r="0.25" /><circle cx="5.2" cy="0.9" r="0.25" /><circle cx="6.5" cy="0.9" r="0.25" />
        <circle cx="1.9" cy="1.8" r="0.25" /><circle cx="3.2" cy="1.8" r="0.25" /><circle cx="4.5" cy="1.8" r="0.25" /><circle cx="5.8" cy="1.8" r="0.25" />
        <circle cx="1.3" cy="2.7" r="0.25" /><circle cx="2.6" cy="2.7" r="0.25" /><circle cx="3.9" cy="2.7" r="0.25" /><circle cx="5.2" cy="2.7" r="0.25" /><circle cx="6.5" cy="2.7" r="0.25" />
        <circle cx="1.9" cy="3.6" r="0.25" /><circle cx="3.2" cy="3.6" r="0.25" /><circle cx="4.5" cy="3.6" r="0.25" /><circle cx="5.8" cy="3.6" r="0.25" />
        <circle cx="1.3" cy="4.5" r="0.25" /><circle cx="2.6" cy="4.5" r="0.25" /><circle cx="3.9" cy="4.5" r="0.25" /><circle cx="5.2" cy="4.5" r="0.25" /><circle cx="6.5" cy="4.5" r="0.25" />
      </g>
    </svg>
  ),
  gb: ({ className }) => (
    <svg viewBox="0 0 60 30" className={className} xmlns="http://www.w3.org/2000/svg">
      <clipPath id="s_clip"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
      <clipPath id="t_clip"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
      <g clipPath="url(#s_clip)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t_clip)" stroke="#C8102E" strokeWidth="4"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  ),
  uk: ({ className }) => (
    <svg viewBox="0 0 60 30" className={className} xmlns="http://www.w3.org/2000/svg">
      <clipPath id="s_clip_uk"><path d="M0,0 v30 h60 v-30 z"/></clipPath>
      <clipPath id="t_clip_uk"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>
      <g clipPath="url(#s_clip_uk)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t_clip_uk)" stroke="#C8102E" strokeWidth="4"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  )
};

export const FlagIcon: React.FC<FlagIconProps> = ({ 
  code, 
  customImage, 
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
    sm: { box: 'w-4 h-3', text: 'text-[9px]', img: 'w-4 h-3' },
    md: { box: 'w-6 h-4', text: 'text-[11px]', img: 'w-6 h-4' },
    lg: { box: 'w-8 h-5.5', text: 'text-xs', img: 'w-8 h-5.5' },
    xl: { box: 'w-10 h-7', text: 'text-sm', img: 'w-10 h-7' }
  };

  const selectedSize = sizeDimensions[size] || sizeDimensions.md;
  const cleanCode = (code || '').toLowerCase().trim();

  // 1. Check if a custom image was provided directly or discovered in languages/flags/
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

  // 2. Check for built-in vector flag (de, en, us, gb, fr, es)
  const BuiltInComponent = BuiltInFlags[cleanCode];
  if (BuiltInComponent) {
    return (
      <div
        className={`rounded-[3px] overflow-hidden shadow-xs border border-slate-200/80 dark:border-slate-700/80 shrink-0 flex items-center justify-center ${selectedSize.box} ${className}`}
        title={title || code.toUpperCase()}
      >
        <BuiltInComponent className="w-full h-full object-cover" />
      </div>
    );
  }

  // 3. Fallback: If no flag image exists in flags/ folder, display a clean "?"
  return (
    <div 
      className={`rounded-[3px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold border border-slate-300 dark:border-slate-700 flex items-center justify-center shrink-0 select-none ${selectedSize.box} ${className}`}
      title={title || code.toUpperCase()}
      aria-label={title || code.toUpperCase()}
    >
      <span className={`${selectedSize.text} font-black leading-none select-none`}>?</span>
    </div>
  );
};


