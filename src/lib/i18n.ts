import { useState, useEffect } from 'react';

export type LanguageCode = 'en' | 'de' | 'fr' | 'es';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  flag: string;
  badge?: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English (US/UK)', nativeLabel: 'English', flag: '🇺🇸', badge: 'Default' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', flag: '🇪🇸' }
];

export const translations: Record<LanguageCode, Record<string, string>> = {