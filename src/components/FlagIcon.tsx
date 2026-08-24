import React from 'react';
import { LanguageCode } from '../lib/i18n';

interface FlagIconProps {
  code: LanguageCode | string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const FlagIcon: React.FC<FlagIconProps> = ({ code, className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-3',
    md: 'w-6 h-4',
    lg: 'w-8 h-5.5',
    xl: 'w-10 h-7'
  };

  const selectedSize = sizeClasses[size] || sizeClasses.md;

  switch (code) {
    case 'en':
    case 'us':
    case 'uk':
      // USA Flag Vector (13 stripes + canton with stars)
      return (
        <svg 
          viewBox="0 0 7410 3900" 
          className={`rounded-[3px] shadow-xs shrink-0 object-cover ${selectedSize} ${className}`}
          aria-label="English / USA Flag"
        >
          <rect width="7410" height="3900" fill="#b22234"/>
          <path d="M0,450H7410M0,1050H7410M0,1650H7410M0,2250H7410M0,2850H7410M0,3450H7410" stroke="#fff" strokeWidth="300"/>
          <rect width="2964" height="2100" fill="#3c3b6e"/>
          <g fill="#fff">
            <g id="s18">
              <g id="s9">
                <g id="s5">
                  <g id="s4">
                    <path id="s" d="M247,90 317,307 134,173h226L177,307z"/>
                    <use href="#s" y="420"/>
                    <use href="#s" y="840"/>
                    <use href="#s" y="1260"/>
                  </g>
                  <use href="#s" y="1680"/>
                </g>
                <use href="#s4" x="247" y="210"/>
              </g>
              <use href="#s9" x="494"/>
            </g>
            <use href="#s18" x="988"/>
            <use href="#s9" x="1976"/>
            <use href="#s5" x="2470"/>
          </g>
        </svg>
      );

    case 'de':
      // German Flag Vector (Black, Red, Gold)
      return (
        <svg 
          viewBox="0 0 5 3" 
          className={`rounded-[3px] shadow-xs shrink-0 object-cover ${selectedSize} ${className}`}
          aria-label="German Flag"
        >
          <rect width="5" height="1" y="0" fill="#000000"/>
          <rect width="5" height="1" y="1" fill="#DD0000"/>
          <rect width="5" height="1" y="2" fill="#FFCE00"/>
        </svg>
      );

    case 'fr':
      // French Flag Vector (Blue, White, Red)
      return (
        <svg 
          viewBox="0 0 3 2" 
          className={`rounded-[3px] shadow-xs shrink-0 object-cover ${selectedSize} ${className}`}
          aria-label="French Flag"
        >
          <rect width="1" height="2" x="0" fill="#002395"/>
          <rect width="1" height="2" x="1" fill="#FFFFFF"/>
          <rect width="1" height="2" x="2" fill="#ED2939"/>
        </svg>
      );

    case 'es':
      // Spanish Flag Vector (Red, Yellow, Red with Crown/Shield touch)
      return (
        <svg 
          viewBox="0 0 750 500" 
          className={`rounded-[3px] shadow-xs shrink-0 object-cover ${selectedSize} ${className}`}
          aria-label="Spanish Flag"
        >
          <rect width="750" height="500" fill="#AA151B"/>
          <rect width="750" height="250" y="125" fill="#F1BF00"/>
          {/* Subtle Coat of Arms indicator */}
          <circle cx="200" cy="250" r="45" fill="#AA151B" opacity="0.85"/>
          <rect x="185" y="230" width="30" height="40" rx="6" fill="#F1BF00"/>
          <circle cx="200" cy="225" r="10" fill="#AA151B"/>
        </svg>
      );

    default:
      return (
        <div className={`rounded bg-slate-300 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold ${selectedSize} ${className}`}>
          {code.toUpperCase()}
        </div>
      );
  }
};
