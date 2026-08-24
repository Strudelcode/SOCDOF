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
    label: 'Odoo Purple',
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

export function getAccentPreset(id?: string): AccentPreset {
  if (!id) return ACCENT_PRESETS.indigo;
  if (ACCENT_PRESETS[id]) {
    return ACCENT_PRESETS[id];
  }
  // Check if it's a custom hex string or custom id
  if (id.startsWith('custom_') || id.startsWith('#')) {
    const hex = id.startsWith('custom_') ? `#${id.replace('custom_', '')}` : id;
    return generateCustomAccent(hex, 'Color Picasso (Benutzerdefiniert)');
  }
  return ACCENT_PRESETS.indigo;
}

export function applyAccentColor(accentId?: string): AccentPreset {
  const preset = getAccentPreset(accentId);
  
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--accent', preset.hex);
    root.style.setProperty('--accent-hover', preset.hoverHex);
    root.style.setProperty('--accent-light', preset.lightRgba);
    root.style.setProperty('--accent-ring', preset.ringRgba);
    root.style.setProperty('--accent-border', preset.borderHex);
    root.style.setProperty('--accent-dark-text', preset.darkTextHex);
    
    // Also save in localStorage for instant retrieval on next boot
    try {
      localStorage.setItem('socdof_accent_color', preset.id);
    } catch {}

    // Update meta theme-color
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', preset.hex);
    }
  }

  return preset;
}
