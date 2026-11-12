export interface AccentPreset {
  id: string;
  label: string;
  hex: string;
  hoverHex: string;
  lightRgba: string;
  ringRgba: string;
  borderHex: string;
  darkTextHex: string;
  gradient: string;
  previewBg: string;
  isCustom?: boolean;
}

// Convert Hex to RGBA
function hexToRgba(hex: string, alpha: number): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 79;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 70;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 229;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Convert Hex to raw RGB comma-separated string (e.g. "79, 70, 229")
function hexToRgbValues(hex: string): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) || 79;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 70;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 229;
  return `${r}, ${g}, ${b}`;
}

// Adjust Hex Brightness
function adjustHex(hex: string, amount: number): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  let r = Math.max(0, Math.min(255, (parseInt(cleanHex.substring(0, 2), 16) || 0) + amount));
  let g = Math.max(0, Math.min(255, (parseInt(cleanHex.substring(2, 4), 16) || 0) + amount));
  let b = Math.max(0, Math.min(255, (parseInt(cleanHex.substring(4, 6), 16) || 0) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function generateCustomAccent(hex: string, label: string = 'Color Picasso'): AccentPreset {
  const formattedHex = hex.startsWith('#') ? hex : `#${hex}`;
  return {
    id: `custom_${formattedHex.replace('#', '')}`,
    label,
    hex: formattedHex,
    hoverHex: adjustHex(formattedHex, -25),
    lightRgba: hexToRgba(formattedHex, 0.14),
    ringRgba: hexToRgba(formattedHex, 0.35),
    borderHex: adjustHex(formattedHex, 20),
    darkTextHex: adjustHex(formattedHex, 45),
    gradient: 'from-slate-800 to-slate-900',
    previewBg: formattedHex,
    isCustom: true
  };
}

export const ACCENT_PRESETS: Record<string, AccentPreset> = {
  indigo: {
    id: 'indigo',
    label: 'Windows Indigo',
    hex: '#4f46e5',
    hoverHex: '#4338ca',
    lightRgba: 'rgba(79, 70, 229, 0.12)',
    ringRgba: 'rgba(79, 70, 229, 0.35)',
    borderHex: '#6366f1',
    darkTextHex: '#818cf8',
    gradient: 'from-indigo-600 to-indigo-800',
    previewBg: 'bg-indigo-600'
  },
  purple: {
    id: 'purple',
    label: 'SOCDOF Aubergine',
    hex: '#714B67',
    hoverHex: '#5a3b52',
    lightRgba: 'rgba(113, 75, 103, 0.14)',
    ringRgba: 'rgba(113, 75, 103, 0.35)',
    borderHex: '#8e5f82',
    darkTextHex: '#c084fc',
    gradient: 'from-[#714B67] to-[#51354a]',
    previewBg: 'bg-[#714B67]'
  },
  blue: {
    id: 'blue',
    label: 'Cyber Blue',
    hex: '#2563eb',
    hoverHex: '#1d4ed8',
    lightRgba: 'rgba(37, 99, 235, 0.12)',
    ringRgba: 'rgba(37, 99, 235, 0.35)',
    borderHex: '#3b82f6',
    darkTextHex: '#60a5fa',
    gradient: 'from-blue-600 to-blue-800',
    previewBg: 'bg-blue-600'
  },
  emerald: {
    id: 'emerald',
    label: 'Emerald Green',
    hex: '#059669',
    hoverHex: '#047857',
    lightRgba: 'rgba(5, 150, 105, 0.12)',
    ringRgba: 'rgba(5, 150, 105, 0.35)',
    borderHex: '#10b981',
    darkTextHex: '#34d399',
    gradient: 'from-emerald-600 to-emerald-800',
    previewBg: 'bg-emerald-600'
  },
  sky: {
    id: 'sky',
    label: 'Vibrant Sky',
    hex: '#0284c7',
    hoverHex: '#0369a1',
    lightRgba: 'rgba(2, 132, 199, 0.12)',
    ringRgba: 'rgba(2, 132, 199, 0.35)',
    borderHex: '#0ea5e9',
    darkTextHex: '#38bdf8',
    gradient: 'from-sky-600 to-sky-800',
    previewBg: 'bg-sky-500'
  },
  amber: {
    id: 'amber',
    label: 'Sunset Gold',
    hex: '#d97706',
    hoverHex: '#b45309',
    lightRgba: 'rgba(217, 119, 6, 0.12)',
    ringRgba: 'rgba(217, 119, 6, 0.35)',
    borderHex: '#f59e0b',
    darkTextHex: '#fbbf24',
    gradient: 'from-amber-600 to-amber-800',
    previewBg: 'bg-amber-500'
  },
  rose: {
    id: 'rose',
    label: 'Berry Rose',
    hex: '#e11d48',
    hoverHex: '#be123c',
    lightRgba: 'rgba(225, 29, 72, 0.12)',
    ringRgba: 'rgba(225, 29, 72, 0.35)',
    borderHex: '#f43f5e',
    darkTextHex: '#fb7185',
    gradient: 'from-rose-600 to-rose-800',
    previewBg: 'bg-rose-500'
  },
  teal: {
    id: 'teal',
    label: 'Nordic Teal',
    hex: '#0d9488',
    hoverHex: '#0f766e',
    lightRgba: 'rgba(13, 148, 136, 0.12)',
    ringRgba: 'rgba(13, 148, 136, 0.35)',
    borderHex: '#14b8a6',
    darkTextHex: '#2dd4bf',
    gradient: 'from-teal-600 to-teal-800',
    previewBg: 'bg-teal-600'
  },
  violet: {
    id: 'violet',
    label: 'Neon Violet',
    hex: '#7c3aed',
    hoverHex: '#6d28d9',
    lightRgba: 'rgba(124, 58, 237, 0.12)',
    ringRgba: 'rgba(124, 58, 237, 0.35)',
    borderHex: '#8b5cf6',
    darkTextHex: '#a78bfa',
    gradient: 'from-violet-600 to-violet-800',
    previewBg: 'bg-violet-600'
  }
};

export const ACCENT_LIST: AccentPreset[] = Object.values(ACCENT_PRESETS);

export const SOCDOF_ACCENT_EVENT = 'socdof-accent-changed';

export function getAccentPreset(id?: string): AccentPreset {
  let effectiveId = id;
  if (!effectiveId && typeof localStorage !== 'undefined') {
    try {
      effectiveId = localStorage.getItem('socdof_accent_color') || undefined;
    } catch {}
  }
  if (!effectiveId) return ACCENT_PRESETS.indigo;

  const lowerId = effectiveId.toLowerCase();
  if (ACCENT_PRESETS[lowerId]) {
    return ACCENT_PRESETS[lowerId];
  }
  // Check if it matches any preset hex
  const matchedByHex = Object.values(ACCENT_PRESETS).find(
    p => p.hex.toLowerCase() === lowerId || p.hex.toLowerCase() === `#${lowerId.replace('#', '')}`
  );
  if (matchedByHex) {
    return matchedByHex;
  }

  // Check if it's a custom hex string or custom id
  if (lowerId.startsWith('custom_') || lowerId.startsWith('#') || /^[0-9a-f]{3,8}$/i.test(lowerId)) {
    const clean = lowerId.replace('custom_', '').replace('#', '');
    const hex = `#${clean}`;
    return generateCustomAccent(hex, 'Color Picasso (Benutzerdefiniert)');
  }
  return ACCENT_PRESETS.indigo;
}

export function getHue(hex: string): number {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
  const r = (parseInt(cleanHex.substring(0, 2), 16) || 0) / 255;
  const g = (parseInt(cleanHex.substring(2, 4), 16) || 0) / 255;
  const b = (parseInt(cleanHex.substring(4, 6), 16) || 0) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  if (max === min) h = 0;
  else if (max === r) h = ((g - b) / (max - min) + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / (max - min) + 2) * 60;
  else if (max === b) h = ((r - g) / (max - min) + 4) * 60;
  return Math.round(h);
}

export interface CompanionColor {
  hex: string;
  hoverHex: string;
  lightRgba: string;
  borderHex: string;
}

export function getContrastingCompanionColor(hex: string): CompanionColor {
  const h = getHue(hex);
  let companionHex = '#6366f1'; // Default Indigo

  // Harmonic contrasting companion color computation:
  // Eliminates unpleasing green/cyan hue clashes across warm and neutral accents.
  if (h >= 65 && h <= 185) {
    // If accent is in the Green / Teal spectrum (65° to 185°), companion is vibrant Indigo/Purple so they never collide
    companionHex = '#6366f1'; // Indigo
  } else if (h >= 186 && h <= 250) {
    // If accent is Blue / Indigo, companion is warm, vibrant Amber/Gold for high-contrast duality
    companionHex = '#f59e0b'; // Amber
  } else if (h >= 251 && h <= 325) {
    // If accent is Purple / Pink / Violet, companion is warm Amber / Coral
    companionHex = '#f59e0b'; // Amber
  } else {
    // If accent is Red / Orange / Amber / Gold (Warm tones, 0-64° or 326-360°),
    // companion is a refined, complementary Indigo / Violet — NEVER green or cyan!
    companionHex = '#6366f1'; // Indigo
  }

  return {
    hex: companionHex,
    hoverHex: adjustHex(companionHex, -20),
    lightRgba: hexToRgba(companionHex, 0.18),
    borderHex: adjustHex(companionHex, 20)
  };
}

export function applyAccentColor(accentId?: string): AccentPreset {
  const preset = getAccentPreset(accentId);
  
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--accent', preset.hex);
    root.style.setProperty('--accent-rgb', hexToRgbValues(preset.hex));
    root.style.setProperty('--accent-hover', preset.hoverHex);
    root.style.setProperty('--accent-light', preset.lightRgba);
    root.style.setProperty('--accent-ring', preset.ringRgba);
    root.style.setProperty('--accent-border', preset.borderHex);
    root.style.setProperty('--accent-dark-text', preset.darkTextHex);
    root.style.setProperty('--accent-text', preset.hex);
    root.style.setProperty('--accent-taskbar-bg', hexToRgba(preset.hex, 0.22));
    root.style.setProperty('--accent-taskbar-border', hexToRgba(preset.hex, 0.45));
    root.style.setProperty('--accent-glow', `0 0 20px ${hexToRgba(preset.hex, 0.35)}`);
    root.style.setProperty('--accent-glow-subtle', `0 0 14px ${hexToRgba(preset.hex, 0.20)}`);
    root.style.setProperty('--accent-border-subtle', hexToRgba(preset.hex, 0.22));
    root.style.setProperty('--accent-border-hover', hexToRgba(preset.hex, 0.48));
    root.style.setProperty('--accent-dark-border-subtle', hexToRgba(preset.hex, 0.30));
    root.style.setProperty('--accent-ambient-glow', hexToRgba(preset.hex, 0.07));
    root.style.setProperty('--accent-ambient-glow-dark', hexToRgba(preset.hex, 0.16));
    root.style.setProperty('--accent-card-shadow', `0 4px 20px -2px ${hexToRgba(preset.hex, 0.07)}, 0 1px 3px 0 rgba(0, 0, 0, 0.03)`);
    root.style.setProperty('--accent-card-shadow-hover', `0 8px 30px -4px ${hexToRgba(preset.hex, 0.20)}, 0 2px 6px 0 rgba(0, 0, 0, 0.04)`);
    
    // Dynamic Contrasting Companion Color for charts and dual indicators
    const companion = getContrastingCompanionColor(preset.hex);
    root.style.setProperty('--accent-companion', companion.hex);
    root.style.setProperty('--accent-companion-rgb', hexToRgbValues(companion.hex));
    root.style.setProperty('--accent-companion-hover', companion.hoverHex);
    root.style.setProperty('--accent-companion-light', companion.lightRgba);
    root.style.setProperty('--accent-companion-border', companion.borderHex);
    
    // Also save in localStorage for instant retrieval on next boot
    try {
      localStorage.setItem('socdof_accent_color', preset.id);
    } catch {}

    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', preset.hex);
    }

    // Broadcast accent update across workspace components
    try {
      window.dispatchEvent(new CustomEvent(SOCDOF_ACCENT_EVENT, { detail: preset }));
    } catch {}
  }

  return preset;
}
