import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Speller } from 'nspell';
import type { LucideIcon } from 'lucide-react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BookOpen,
  Bold,
  ListTree,
  CalendarDays,
  Download,
  FilePlus,
  FileText,
  FolderOpen,
  Heading1,
  Heading2,
  Highlighter,
  Hash,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  Palette,
  PenLine,
  Printer,
  Table,
  Quote,
  Redo2,
  Replace,
  Ruler,
  RectangleHorizontal,
  RectangleVertical,
  ArrowLeft,
  Save,
  Search,
  SpellCheck,
  Strikethrough,
  Type,
  Underline,
  Undo2,
  X,
  ListChecks,
  Plus,
  EyeOff,
  Baseline,
  Clock,
  Frame,
  RemoveFormatting,
  Subscript,
  Superscript,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';
import {
  addUserWord,
  collectIssues,
  countWords,
  findMisspelledRanges,
  loadGermanSpeller,
  wordFrequencies,
  type SpellIssue
} from '../lib/spellcheck';

type RibbonTab = 'file' | 'home' | 'insert' | 'layout' | 'view' | 'review';
type SidePanel = 'spelling' | 'words' | 'find';

const RIBBON_TABS: Array<{ id: RibbonTab; key: string }> = [
  { id: 'file', key: 'textwerk.tab_file' },
  { id: 'home', key: 'textwerk.tab_home' },
  { id: 'insert', key: 'textwerk.tab_insert' },
  { id: 'layout', key: 'textwerk.tab_layout' },
  { id: 'view', key: 'textwerk.tab_view' },
  { id: 'review', key: 'textwerk.tab_review' }
];

const FONT_FAMILIES = ['Aptos', 'Calibri', 'Arial', 'Times New Roman', 'Georgia', 'Verdana'];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36];
const SPELL_HIGHLIGHT = 'textwerk-spelling';
const SUPPORTED_LOCALES = ['de', 'en', 'fr', 'es'];
const WORD_LIST_LIMIT = 300;
const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const PAGE_SIZES = {
  portrait: { w: 794, h: 1123 },
  landscape: { w: 1123, h: 794 }
} as const;
type Orientation = keyof typeof PAGE_SIZES;
const PAGE_MARGIN = 96;
const MARGIN_SIZES = { normal: 96, narrow: 48, wide: 144 } as const;
type MarginPreset = keyof typeof MARGIN_SIZES;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const safeFileName = (name: string) => name.trim().replace(/[\\/:*?"<>|]/g, '_') || 'Dokument1';

const SMART_QUOTE_OPENERS = /[\s([{\-–—/]/;

// German typography: „low“ at the start and “high“ at the end; other languages use the curly English pair.
function smartQuote(previous: string, double: boolean, locale: string): string {
  const opening = !previous || SMART_QUOTE_OPENERS.test(previous);
  if (!double) return opening ? '‚' : '’';
  if (locale === 'de') return opening ? '„' : '“';
  return opening ? '“' : '”';
}

// Plain text files become one paragraph per line.
function textToEditorHtml(text: string): string {
  return text
    .split(/\r?\n/)
    .map(line => `<div>${escapeHtml(line) || '<br>'}</div>`)
    .join('');
}

// Opened HTML files keep their text and basic formatting, but lose scripts, images and links.
function htmlToEditorHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, link, meta, img, svg, form').forEach(el => el.remove());
  doc.body.querySelectorAll('*').forEach(el => {
    const style = el.getAttribute('style');
    Array.from(el.attributes).forEach(attr => el.removeAttribute(attr.name));
    if (style && !/url\(|expression|javascript:/i.test(style)) el.setAttribute('style', style);
  });
  return doc.body.innerHTML;
}

function downloadFile(content: string, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface HighlightRegistryLike {
  set(name: string, value: unknown): unknown;
  delete(name: string): boolean;
}

type HighlightConstructorLike = new (...ranges: Range[]) => unknown;

// Underlines misspelled words via the CSS Custom Highlight API, so the editor's DOM is never changed.
function paintSpellingHighlights(ranges: Range[]) {
  const registry = (globalThis as unknown as { CSS?: { highlights?: HighlightRegistryLike } }).CSS?.highlights;
  const HighlightCtor = (globalThis as unknown as { Highlight?: HighlightConstructorLike }).Highlight;
  if (!registry || !HighlightCtor) return;
  if (ranges.length === 0) registry.delete(SPELL_HIGHLIGHT);
  else registry.set(SPELL_HIGHLIGHT, new HighlightCtor(...ranges));
}

function buildMisspellingRanges(root: HTMLElement, speller: Speller, ignored: Set<string>): Range[] {
  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    for (const { start, end } of findMisspelledRanges(node.data, speller, ignored)) {
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
    }
  }
  return ranges;
}

// Replaces the first (or every) whole-word occurrence inside the editor's text nodes, keeping formatting.
function replaceWordInEditor(root: HTMLElement, word: string, replacement: string, all: boolean) {
  const boundary = `(?<![\\p{L}\\p{M}])${escapeRegExp(word)}(?![\\p{L}\\p{M}])`;
  const single = new RegExp(boundary, 'u');
  const every = new RegExp(boundary, 'gu');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!single.test(node.data)) continue;
    node.data = node.data.replace(all ? every : single, () => replacement);
    if (!all) break;
  }
}

// Find and replace across every text node; returns how many occurrences changed.
function replaceTextInEditor(root: HTMLElement, search: string, replacement: string): number {
  if (!search) return 0;
  const pattern = new RegExp(escapeRegExp(search), 'giu');
  let changed = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const matches = node.data.match(pattern);
    if (!matches) continue;
    changed += matches.length;
    node.data = node.data.replace(pattern, () => replacement);
  }
  return changed;
}

interface ToolButtonProps {
  icon: LucideIcon;
  label: string;
  onAction: () => void;
  active?: boolean;
  disabled?: boolean;
}

// Buttons keep the editor selection by cancelling mousedown, like Word's ribbon.
const ToolButton: React.FC<ToolButtonProps> = ({ icon: Icon, label, onAction, active, disabled }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={event => event.preventDefault()}
    onClick={onAction}
    className={`flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-1.5 py-1 rounded text-[11px] transition-colors disabled:opacity-40 ${
      active
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200'
        : 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800'
    }`}
  >
    <Icon className="w-4 h-4" />
    <span className="whitespace-nowrap">{label}</span>
  </button>
);

const RibbonGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col justify-between border-r border-slate-200 dark:border-slate-700 px-2 last:border-r-0">
    <div className="flex items-center gap-0.5">{children}</div>
    <span className="text-[10px] text-slate-500 text-center pt-0.5">{label}</span>
  </div>
);

// Word's fixed „Standard colours“ row, in Word's order.
const WORD_STANDARD_COLORS: string[] = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];

const COLOR_PALETTES: Record<string, { label: string; colors: string[] }> = {
  office: {
    label: 'Office-Standard',
    colors: ['#000000', '#ffffff', '#44546a', '#4472c4', '#ed7d31', '#a5a5a5', '#ffc000', '#5b9bd5', '#70ad47', '#c00000']
  },
  ocean: {
    label: 'Ozean',
    colors: ['#0b3d91', '#1f77b4', '#17becf', '#9edae5', '#003f5c', '#2f4b7c', '#a0c4ff', '#caf0f8', '#023e8a', '#00b4d8']
  },
  forest: {
    label: 'Wald',
    colors: ['#1b4332', '#2d6a4f', '#40916c', '#74c69d', '#52796f', '#95d5b2', '#606c38', '#283618', '#dda15e', '#bc6c25']
  },
  sunset: {
    label: 'Sonnenuntergang',
    colors: ['#9d0208', '#d00000', '#e85d04', '#f48c06', '#faa307', '#ffba08', '#6a040f', '#370617', '#ff7b00', '#ffd6a5']
  },
  pastel: {
    label: 'Pastell',
    colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#bdb2ff', '#ffc6ff', '#e0e0e0', '#b8b8b8']
  },
  contrast: {
    label: 'Kontrast',
    colors: ['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#800000', '#008000']
  },
  mono: {
    label: 'Monochrom',
    colors: ['#000000', '#262626', '#404040', '#595959', '#7f7f7f', '#a6a6a6', '#bfbfbf', '#d9d9d9', '#f2f2f2', '#ffffff']
  },
  nature: {
    label: 'Natur',
    colors: ['#386641', '#6a994e', '#a7c957', '#f2e8cf', '#bc4749', '#8d5524', '#c68642', '#588157', '#3a5a40', '#dad7cd']
  }
};

const PAGE_THEMES: Array<{ id: 'white' | 'cream' | 'dark' | 'match'; labelKey: string; background: string; text: string }> = [
  { id: 'white', labelKey: 'page_white', background: '#ffffff', text: '#0f172a' },
  { id: 'cream', labelKey: 'page_cream', background: '#fdf6e3', text: '#1f2937' },
  { id: 'dark', labelKey: 'page_dark', background: '#1e293b', text: '#f1f5f9' },
  { id: 'match', labelKey: 'page_match', background: 'transparent', text: 'inherit' }
];

// Labels for the colour and page-background controls, per UI language.
const EXTRA_LABELS: Record<string, Record<string, string>> = {
  de: { time: 'Uhrzeit', clear_format: 'Formatierung löschen', superscript: 'Hochgestellt', subscript: 'Tiefgestellt', margins: 'Seitenränder', margin_normal: 'Normal', margin_narrow: 'Schmal', margin_wide: 'Breit', group_margins: 'Ränder', doc_title: 'Dokumenttitel', table: 'Tabelle', page_number: 'Seitenzahl', print: 'Drucken', group_orientation: 'Seitenausrichtung', portrait: 'Hochformat', landscape: 'Querformat', back_to_doc: 'Zurück zum Dokument', backstage_info: 'Info', group_page_color: 'Seitenfarbe', group_palette: 'Farbpalette', palette: 'Farbpalette', page_white: 'Weiß', page_cream: 'Cremeweiß', page_dark: 'Dunkel', page_match: 'Wie App', standard_colors: 'Standardfarben', theme_colors: 'Designfarben' },
  en: { time: 'Time', clear_format: 'Clear formatting', superscript: 'Superscript', subscript: 'Subscript', margins: 'Margins', margin_normal: 'Normal', margin_narrow: 'Narrow', margin_wide: 'Wide', group_margins: 'Margins', doc_title: 'Document title', table: 'Table', page_number: 'Page number', print: 'Print', group_orientation: 'Orientation', portrait: 'Portrait', landscape: 'Landscape', back_to_doc: 'Back to document', backstage_info: 'Info', group_page_color: 'Page color', group_palette: 'Color palette', palette: 'Color palette', page_white: 'White', page_cream: 'Cream', page_dark: 'Dark', page_match: 'Match app', standard_colors: 'Standard colors', theme_colors: 'Theme colors' },
  fr: { time: 'Heure', clear_format: 'Effacer la mise en forme', superscript: 'Exposant', subscript: 'Indice', margins: 'Marges', margin_normal: 'Normales', margin_narrow: 'Étroites', margin_wide: 'Larges', group_margins: 'Marges', doc_title: 'Titre du document', table: 'Tableau', page_number: 'Numéro de page', print: 'Imprimer', group_orientation: 'Orientation', portrait: 'Portrait', landscape: 'Paysage', back_to_doc: 'Retour au document', backstage_info: 'Infos', group_page_color: 'Couleur de page', group_palette: 'Palette', palette: 'Palette de couleurs', page_white: 'Blanc', page_cream: 'Crème', page_dark: 'Sombre', page_match: 'Comme l\'app', standard_colors: 'Couleurs standard', theme_colors: 'Couleurs du thème' },
  es: { time: 'Hora', clear_format: 'Borrar formato', superscript: 'Superíndice', subscript: 'Subíndice', margins: 'Márgenes', margin_normal: 'Normales', margin_narrow: 'Estrechos', margin_wide: 'Amplios', group_margins: 'Márgenes', doc_title: 'Título del documento', table: 'Tabla', page_number: 'Número de página', print: 'Imprimir', group_orientation: 'Orientación', portrait: 'Vertical', landscape: 'Horizontal', back_to_doc: 'Volver al documento', backstage_info: 'Información', group_page_color: 'Color de página', group_palette: 'Paleta', palette: 'Paleta de colores', page_white: 'Blanco', page_cream: 'Crema', page_dark: 'Oscuro', page_match: 'Como la app', standard_colors: 'Colores estándar', theme_colors: 'Colores del tema' }
};

const selectClass =
  'h-6 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-1 text-[11px] outline-none';

export const TextwerkModule: React.FC = () => {
  const currentLang = useLanguage();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<RibbonTab>('home');
  const [sidePanel, setSidePanel] = useState<SidePanel | null>(null);
  const [spellingOn, setSpellingOn] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [zoom, setZoom] = useState(100);
  const [documentName, setDocumentName] = useState('Dokument1');
  const [plainText, setPlainText] = useState('');
  const [speller, setSpeller] = useState<Speller | null>(null);
  const [spellFailed, setSpellFailed] = useState(false);
  const [issues, setIssues] = useState<SpellIssue[]>([]);
  const [ignored, setIgnored] = useState<Set<string>>(() => new Set());
  const [dictionaryRevision, setDictionaryRevision] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [findText, setFindText] = useState('');
  const [replaceWith, setReplaceWith] = useState('');
  const [fontFamily, setFontFamily] = useState('Aptos');
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [margins, setMargins] = useState<MarginPreset>('normal');
  const sheetRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(12);
  const [paletteId, setPaletteId] = useState<string>('office');
  const [pageTheme, setPageTheme] = useState<'white' | 'cream' | 'dark' | 'match'>('white');
  const [textColor, setTextColor] = useState('#000000');

  const tx = (key: string) => t(key, currentLang);
  const documentLocale = SUPPORTED_LOCALES.includes(currentLang) ? currentLang : 'de';
  const ex = (key: string) => EXTRA_LABELS[documentLocale]?.[key] ?? EXTRA_LABELS.de[key];

  const syncText = useCallback(() => {
    setPlainText(editorRef.current?.innerText ?? '');
  }, []);

  const flash = useCallback((message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2500);
  }, []);

  // Keeps each manual page break pushing the text after it to the top of the next page.
  const layoutPageBreaks = useCallback(() => {
    const sheet = sheetRef.current;
    const root = editorRef.current;
    if (!sheet || !root) return;
    const scale = zoom / 100;
    const sheetTop = sheet.getBoundingClientRect().top;
    const pageHeight = PAGE_SIZES[orientation].h;
    root.querySelectorAll<HTMLElement>('.textwerk-pagebreak').forEach(marker => {
      marker.style.height = '0px';
      const top = (marker.getBoundingClientRect().top - sheetTop) / scale;
      const next = (Math.floor(top / pageHeight) + 1) * pageHeight + MARGIN_SIZES[margins];
      marker.style.height = `${Math.max(0, next - top)}px`;
    });
  }, [orientation, zoom, margins]);

  useEffect(() => {
    layoutPageBreaks();
  }, [plainText, layoutPageBreaks]);

  useEffect(() => {
    let cancelled = false;
    loadGermanSpeller()
      .then(loaded => {
        if (!cancelled) setSpeller(loaded);
      })
      .catch(() => {
        if (!cancelled) setSpellFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => paintSpellingHighlights([]), []);

  // Re-check after typing pauses; ranges and the issue list always reflect the current text.
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const root = editorRef.current;
      if (!root || !speller || !spellingOn) {
        setIssues([]);
        paintSpellingHighlights([]);
        return;
      }
      paintSpellingHighlights(buildMisspellingRanges(root, speller, ignored));
      setIssues(collectIssues(plainText, speller, ignored));
    }, 350);
    return () => window.clearTimeout(handle);
  }, [plainText, speller, ignored, spellingOn, dictionaryRevision]);

  const frequencies = useMemo(() => wordFrequencies(plainText), [plainText]);
  const wordCount = useMemo(() => countWords(plainText), [plainText]);
  const charCount = plainText.replace(/\s/g, '').length;
  const fontOptions = useMemo(() => Array.from(new Set([...FONT_FAMILIES, ...systemFonts])), [systemFonts]);
  const findCount = useMemo(
    () => (findText ? (plainText.match(new RegExp(escapeRegExp(findText), 'giu'))?.length ?? 0) : 0),
    [plainText, findText]
  );

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncText();
  };

  // Word-style paragraph styles map onto native block elements.
  const applyBlockStyle = (block: 'P' | 'H1' | 'H2' | 'BLOCKQUOTE') => runCommand('formatBlock', block);

  // Lists installed fonts where the browser offers local font access; otherwise the built-in list stays.
  const loadSystemFonts = async () => {
    if (systemFonts.length > 0) return;
    const queryFonts = (window as unknown as { queryLocalFonts?: () => Promise<Array<{ family: string }>> }).queryLocalFonts;
    if (!queryFonts) return;
    try {
      const fonts = await queryFonts();
      setSystemFonts(Array.from(new Set(fonts.map(font => font.family))).sort((a, b) => a.localeCompare(b, documentLocale)));
    } catch {
      // Permission denied or unavailable: keep the built-in list.
    }
  };

  const insertPageBreak = () => {
    runCommand('insertHTML', '<div class="textwerk-pagebreak" contenteditable="false"></div>');
    layoutPageBreaks();
  };

  const applyFontFamily = (family: string) => {
    setFontFamily(family);
    runCommand('styleWithCSS', 'true');
    runCommand('fontName', family);
  };

  // execCommand only offers sizes 1-7, so the selection is marked and rewritten to exact point sizes.
  const applyTextColor = (color: string) => {
    setTextColor(color);
    runCommand('styleWithCSS', 'true');
    runCommand('foreColor', color);
  };

  // Highlight colour uses the same palette as the text colour.
  const applyHighlight = (color: string) => {
    runCommand('styleWithCSS', 'true');
    runCommand('hiliteColor', color);
  };

  const insertText = (text: string) => runCommand('insertText', text);

  const insertTable = () => {
    runCommand(
      'insertHTML',
      '<table style="border-collapse:collapse;width:100%"><tbody>' +
        '<tr><td style="border:1px solid #94a3b8;padding:4px">&nbsp;</td><td style="border:1px solid #94a3b8;padding:4px">&nbsp;</td></tr>' +
        '<tr><td style="border:1px solid #94a3b8;padding:4px">&nbsp;</td><td style="border:1px solid #94a3b8;padding:4px">&nbsp;</td></tr>' +
        '</tbody></table><p><br></p>'
    );
  };

  const applyFontSize = (pt: number) => {
    setFontSize(pt);
    editorRef.current?.focus();
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('fontSize', false, '7');
    editorRef.current?.querySelectorAll('font[size="7"]').forEach(el => {
      const span = document.createElement('span');
      span.style.fontSize = `${pt}pt`;
      span.innerHTML = el.innerHTML;
      el.replaceWith(span);
    });
    syncText();
  };

  const newDocument = () => {
    if (plainText.trim() && !window.confirm(tx('textwerk.confirm_new'))) return;
    if (editorRef.current) editorRef.current.innerHTML = '';
    setDocumentName('Dokument1');
    setIgnored(new Set());
    syncText();
  };

  const saveDocument = async () => {
    const name = safeFileName(documentName);
    const body = editorRef.current?.innerHTML ?? '';
    const html = `<!doctype html><html lang="${documentLocale}"><head><meta charset="utf-8"><title>${escapeHtml(name)}</title></head><body>${body}</body></html>`;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.textwerkSaveDialog) {
      const result = await electronAPI.textwerkSaveDialog({ defaultName: `${name}.html`, content: html });
      if (result?.canceled) return;
      if (result?.error) {
        flash(tx('textwerk.save_failed'));
        return;
      }
      flash(tx('textwerk.saved'));
      return;
    }
    downloadFile(html, 'text/html;charset=utf-8', `${name}.html`);
    flash(tx('textwerk.saved'));
  };

  const exportText = () => {
    const name = safeFileName(documentName);
    downloadFile(editorRef.current?.innerText ?? '', 'text/plain;charset=utf-8', `${name}.txt`);
    flash(tx('textwerk.exported'));
  };

  const loadContent = (fileName: string, content: string) => {
    const root = editorRef.current;
    if (!root) return;
    root.innerHTML = /\.html?$/i.test(fileName) ? htmlToEditorHtml(content) : textToEditorHtml(content);
    setDocumentName(fileName.replace(/\.(txt|html?)$/i, ''));
    setIgnored(new Set());
    syncText();
    flash(tx('textwerk.opened'));
  };

  const openFromDesktop = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI?.textwerkOpenDialog) {
      fileInputRef.current?.click();
      return;
    }
    const result = await electronAPI.textwerkOpenDialog();
    if (result?.canceled || result?.error) return;
    loadContent(result.fileName ?? 'Dokument1', result.content ?? '');
  };

  const handleOpenFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    loadContent(file.name, await file.text());
  };

  const ignoreWord = (word: string) => setIgnored(prev => new Set(prev).add(word));

  const addWordToDictionary = (word: string) => {
    if (!speller) return;
    addUserWord(speller, word);
    setDictionaryRevision(revision => revision + 1);
  };

  const replaceWord = (word: string, replacement: string) => {
    if (!editorRef.current) return;
    replaceWordInEditor(editorRef.current, word, replacement, true);
    syncText();
  };

  const replaceAllMatches = () => {
    if (!editorRef.current || !findText) return;
    const changed = replaceTextInEditor(editorRef.current, findText, replaceWith);
    syncText();
    flash(t('textwerk.find_count', { count: changed }));
  };

  const insertDate = () => {
    runCommand('insertText', new Date().toLocaleDateString(documentLocale));
  };

  const insertTime = () => {
    runCommand('insertText', new Date().toLocaleTimeString(documentLocale, { hour: '2-digit', minute: '2-digit' }));
  };

  // Builds a table of contents from the Heading 1 and Heading 2 paragraphs of the document.
  const insertTableOfContents = () => {
    const headingNodes: HTMLElement[] = Array.from(editorRef.current?.querySelectorAll<HTMLElement>('h1, h2') ?? []);
    const headings = headingNodes
      .map(heading => ({ level: heading.tagName === 'H1' ? 1 : 2, text: heading.innerText.trim() }))
      .filter(heading => heading.text);
    if (headings.length === 0) {
      flash(tx('textwerk.toc_empty'));
      return;
    }
    const items = headings
      .map(heading => `<li style="margin-left:${(heading.level - 1) * 24}px">${escapeHtml(heading.text)}</li>`)
      .join('');
    runCommand('insertHTML', `<div class="textwerk-toc"><p><strong>${escapeHtml(tx('textwerk.toc'))}</strong></p><ul>${items}</ul></div><p><br></p>`);
  };

  const adjustZoom = (delta: number) => setZoom(current => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + delta)));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    // Typed quotes become typographic quotes, based on the character before the cursor.
    if ((event.key === '"' || event.key === "'") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const root = editorRef.current;
      const selection = window.getSelection();
      let previous = '';
      if (root && selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const before = document.createRange();
        before.setStart(root, 0);
        before.setEnd(range.startContainer, range.startOffset);
        previous = before.toString().slice(-1);
      }
      runCommand('insertText', smartQuote(previous, event.key === '"', documentLocale));
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      saveDocument();
    }
  };

  const spellStatus = spellFailed
    ? tx('textwerk.spell_error')
    : !speller
      ? tx('textwerk.spell_loading')
      : !spellingOn
        ? tx('textwerk.spell_off')
        : issues.length === 0
          ? tx('textwerk.spell_ok')
          : t('textwerk.spell_count', { count: issues.length });

  const languageLabel = tx('textwerk.language');

  const renderRibbon = () => {
    switch (tab) {
      case 'file':
        return (
          <RibbonGroup label={tx('textwerk.group_file')}>
            <ToolButton icon={FilePlus} label={tx('textwerk.new')} onAction={newDocument} />
            <ToolButton icon={FolderOpen} label={tx('textwerk.open')} onAction={openFromDesktop} />
            <ToolButton icon={Save} label={tx('textwerk.save')} onAction={saveDocument} />
            <ToolButton icon={Download} label={tx('textwerk.export_text')} onAction={exportText} />
          </RibbonGroup>
        );
      case 'home':
        return (
          <>
            <RibbonGroup label={tx('textwerk.group_history')}>
              <ToolButton icon={Undo2} label={tx('textwerk.undo')} onAction={() => runCommand('undo')} />
              <ToolButton icon={Redo2} label={tx('textwerk.redo')} onAction={() => runCommand('redo')} />
            </RibbonGroup>
            <RibbonGroup label={tx('textwerk.group_styles')}>
              <ToolButton icon={Type} label={tx('textwerk.style_normal')} onAction={() => applyBlockStyle('P')} />
              <ToolButton icon={Heading1} label={tx('textwerk.style_heading1')} onAction={() => applyBlockStyle('H1')} />
              <ToolButton icon={Heading2} label={tx('textwerk.style_heading2')} onAction={() => applyBlockStyle('H2')} />
              <ToolButton icon={Quote} label={tx('textwerk.style_quote')} onAction={() => applyBlockStyle('BLOCKQUOTE')} />
            </RibbonGroup>
            <RibbonGroup label={tx('textwerk.group_font')}>
              <div className="flex flex-col gap-1 px-1">
                <div className="flex items-center gap-1">
                  <select
                    aria-label={tx('textwerk.font_family')}
                    title={tx('textwerk.font_family')}
                    value={fontFamily}
                    onFocus={() => void loadSystemFonts()}
                    onChange={event => applyFontFamily(event.target.value)}
                    className={`${selectClass} w-[118px]`}
                  >
                    {fontOptions.map(family => (
                      <option key={family} value={family}>{family}</option>
                    ))}
                  </select>
                  <select
                    aria-label={tx('textwerk.font_size')}
                    title={tx('textwerk.font_size')}
                    value={fontSize}
                    onChange={event => applyFontSize(Number(event.target.value))}
                    className={`${selectClass} w-14`}
                  >
                    {FONT_SIZES.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-0.5">
                  <ToolButton icon={Bold} label={tx('textwerk.bold')} onAction={() => runCommand('bold')} />
                  <ToolButton icon={Italic} label={tx('textwerk.italic')} onAction={() => runCommand('italic')} />
                  <ToolButton icon={Underline} label={tx('textwerk.underline')} onAction={() => runCommand('underline')} />
                  <ToolButton icon={Strikethrough} label={tx('textwerk.strike')} onAction={() => runCommand('strikeThrough')} />
                  <ToolButton icon={Superscript} label={ex('superscript')} onAction={() => runCommand('superscript')} />
                  <ToolButton icon={Subscript} label={ex('subscript')} onAction={() => runCommand('subscript')} />
                  <ToolButton icon={RemoveFormatting} label={ex('clear_format')} onAction={() => runCommand('removeFormat')} />
                </div>
                <div className="flex items-center gap-1">
                  <Baseline className="w-3.5 h-3.5 text-slate-500" />
                  {COLOR_PALETTES[paletteId].colors.map(color => (
                    <button
                      key={`fc-${color}`}
                      type="button"
                      title={color}
                      aria-label={color}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => applyTextColor(color)}
                      className="w-3.5 h-3.5 rounded-sm border border-slate-400 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <span className="w-px h-3.5 bg-slate-300 mx-0.5" />
                  {WORD_STANDARD_COLORS.map(color => (
                    <button
                      key={`fs-${color}`}
                      type="button"
                      title={`${ex('standard_colors')}: ${color}`}
                      aria-label={color}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => applyTextColor(color)}
                      className="w-3.5 h-3.5 rounded-sm border border-slate-400 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <Highlighter className="w-3.5 h-3.5 ml-1 text-slate-500" />
                  {COLOR_PALETTES[paletteId].colors.map(color => (
                    <button
                      key={`hl-${color}`}
                      type="button"
                      title={color}
                      aria-label={color}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => applyHighlight(color)}
                      className="w-3.5 h-3.5 rounded-sm border border-slate-400 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </RibbonGroup>
            <RibbonGroup label={tx('textwerk.group_paragraph')}>
              <ToolButton icon={AlignLeft} label={tx('textwerk.align_left')} onAction={() => runCommand('justifyLeft')} />
              <ToolButton icon={AlignCenter} label={tx('textwerk.align_center')} onAction={() => runCommand('justifyCenter')} />
              <ToolButton icon={AlignRight} label={tx('textwerk.align_right')} onAction={() => runCommand('justifyRight')} />
              <ToolButton icon={AlignJustify} label={tx('textwerk.justify')} onAction={() => runCommand('justifyFull')} />
              <ToolButton icon={List} label={tx('textwerk.bullets')} onAction={() => runCommand('insertUnorderedList')} />
              <ToolButton icon={ListOrdered} label={tx('textwerk.numbers')} onAction={() => runCommand('insertOrderedList')} />
            </RibbonGroup>
            <RibbonGroup label={tx('textwerk.group_editing')}>
              <ToolButton
                icon={Search}
                label={tx('textwerk.find')}
                active={sidePanel === 'find'}
                onAction={() => setSidePanel(panel => (panel === 'find' ? null : 'find'))}
              />
              <ToolButton
                icon={Replace}
                label={tx('textwerk.replace')}
                active={sidePanel === 'find'}
                onAction={() => setSidePanel('find')}
              />
            </RibbonGroup>
          </>
        );
      case 'insert':
        return (
          <RibbonGroup label={tx('textwerk.group_insert')}>
            <ToolButton icon={Table} label={ex('table')} onAction={insertTable} />
            <ToolButton icon={CalendarDays} label={tx('textwerk.date')} onAction={insertDate} />
            <ToolButton icon={Clock} label={ex('time')} onAction={insertTime} />
            <ToolButton icon={ListTree} label={tx('textwerk.toc')} onAction={insertTableOfContents} />
            <ToolButton icon={Hash} label={ex('page_number')} onAction={() => insertText('[Seite]')} />
            <ToolButton icon={Minus} label={tx('textwerk.rule')} onAction={() => runCommand('insertHorizontalRule')} />
            <ToolButton icon={FileText} label={tx('textwerk.page_break')} onAction={() => insertPageBreak()} />
          </RibbonGroup>
        );
      case 'layout':
        return (
          <>
            <RibbonGroup label={tx('textwerk.group_paragraph')}>
              <ToolButton icon={IndentDecrease} label={tx('textwerk.indent_out')} onAction={() => runCommand('outdent')} />
              <ToolButton icon={IndentIncrease} label={tx('textwerk.indent_in')} onAction={() => runCommand('indent')} />
            </RibbonGroup>
            <RibbonGroup label={tx('textwerk.group_page')}>
              <ToolButton icon={FileText} label={tx('textwerk.page_break')} onAction={() => insertPageBreak()} />
            </RibbonGroup>
            <RibbonGroup label={ex('group_orientation')}>
              <ToolButton icon={RectangleVertical} label={ex('portrait')} active={orientation === 'portrait'} onAction={() => setOrientation('portrait')} />
              <ToolButton icon={RectangleHorizontal} label={ex('landscape')} active={orientation === 'landscape'} onAction={() => setOrientation('landscape')} />
            </RibbonGroup>
            <RibbonGroup label={ex('group_margins')}>
              {(Object.keys(MARGIN_SIZES) as MarginPreset[]).map(preset => (
                <ToolButton
                  key={preset}
                  icon={Frame}
                  label={ex(`margin_${preset}`)}
                  active={margins === preset}
                  onAction={() => setMargins(preset)}
                />
              ))}
            </RibbonGroup>
            <RibbonGroup label={ex('group_palette')}>
              <div className="flex flex-col gap-1 px-1">
                <select
                  aria-label={ex('palette')}
                  title={ex('palette')}
                  value={paletteId}
                  onChange={event => setPaletteId(event.target.value)}
                  className={`${selectClass} w-[140px]`}
                >
                  {Object.entries(COLOR_PALETTES).map(([id, palette]) => (
                    <option key={id} value={id}>{palette.label}</option>
                  ))}
                </select>
                <div className="flex flex-wrap gap-0.5 w-[140px]">
                  {COLOR_PALETTES[paletteId].colors.map(color => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      aria-label={color}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => applyTextColor(color)}
                      className="w-[20px] h-[20px] rounded-sm border border-slate-400 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </RibbonGroup>
          </>
        );
      case 'view':
        return (
          <>
            <RibbonGroup label={tx('textwerk.group_show')}>
              <ToolButton icon={Ruler} label={tx('textwerk.show_ruler')} active={showRuler} onAction={() => setShowRuler(on => !on)} />
              <ToolButton
                icon={BookOpen}
                label={tx('textwerk.panel_spelling')}
                active={sidePanel === 'spelling'}
                onAction={() => setSidePanel(panel => (panel === 'spelling' ? null : 'spelling'))}
              />
              <ToolButton
                icon={ListChecks}
                label={tx('textwerk.panel_words')}
                active={sidePanel === 'words'}
                onAction={() => setSidePanel(panel => (panel === 'words' ? null : 'words'))}
              />
            </RibbonGroup>
            <RibbonGroup label={tx('textwerk.group_zoom')}>
              <ToolButton icon={ZoomOut} label={tx('textwerk.zoom_out')} onAction={() => adjustZoom(-10)} />
              <ToolButton icon={ZoomIn} label={tx('textwerk.zoom_in')} onAction={() => adjustZoom(10)} />
              <ToolButton icon={Search} label="100 %" onAction={() => setZoom(100)} />
            </RibbonGroup>
            <RibbonGroup label={ex('group_page_color')}>
              {PAGE_THEMES.map(theme => (
                <ToolButton
                  key={theme.id}
                  icon={Palette}
                  label={ex(theme.labelKey)}
                  active={pageTheme === theme.id}
                  onAction={() => setPageTheme(theme.id)}
                />
              ))}
            </RibbonGroup>
          </>
        );
      case 'review':
        return (
          <RibbonGroup label={tx('textwerk.group_review')}>
            <ToolButton
              icon={spellingOn ? SpellCheck : EyeOff}
              label={tx('textwerk.spelling_toggle')}
              active={spellingOn}
              onAction={() => setSpellingOn(on => !on)}
            />
          </RibbonGroup>
        );
    }
  };

  const renderSpellingPanel = () => {
    if (!spellingOn) return <p className="text-xs text-slate-500">{tx('textwerk.spell_off')}</p>;
    if (spellFailed) return <p className="text-xs text-red-600">{tx('textwerk.spell_error')}</p>;
    if (!speller) return <p className="text-xs text-slate-500">{tx('textwerk.spell_loading')}</p>;
    if (issues.length === 0) return <p className="text-xs text-slate-500">{tx('textwerk.spell_empty')}</p>;
    return (
      <div className="space-y-2">
        {issues.map(issue => (
          <div key={issue.word} className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-red-600 dark:text-red-400 break-all">{issue.word}</span>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">×{issue.count}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {issue.suggestions.length === 0 ? (
                <span className="text-[11px] text-slate-500">{tx('textwerk.spell_no_suggestions')}</span>
              ) : (
                issue.suggestions.map(suggestion => (
                  <button
                    key={suggestion}
                    type="button"
                    title={tx('textwerk.spell_replace_all')}
                    onClick={() => replaceWord(issue.word, suggestion)}
                    className="px-2 py-0.5 rounded text-[11px] bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200"
                  >
                    {suggestion}
                  </button>
                ))
              )}
            </div>
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => ignoreWord(issue.word)}
                className="px-2 py-1 rounded text-[11px] border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {tx('textwerk.spell_ignore')}
              </button>
              <button
                type="button"
                onClick={() => addWordToDictionary(issue.word)}
                className="px-2 py-1 rounded text-[11px] border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                {tx('textwerk.spell_add')}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFindPanel = () => (
    <div className="space-y-2">
      <input
        value={findText}
        onChange={event => setFindText(event.target.value)}
        placeholder={tx('textwerk.find_placeholder')}
        aria-label={tx('textwerk.find')}
        className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs outline-none focus:border-blue-500"
      />
      <input
        value={replaceWith}
        onChange={event => setReplaceWith(event.target.value)}
        placeholder={tx('textwerk.replace_placeholder')}
        aria-label={tx('textwerk.replace')}
        className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs outline-none focus:border-blue-500"
      />
      <p className="text-[11px] text-slate-500">{t('textwerk.find_count', { count: findCount })}</p>
      <button
        type="button"
        onClick={replaceAllMatches}
        disabled={!findText || findCount === 0}
        className="w-full px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
      >
        {tx('textwerk.replace_all')}
      </button>
    </div>
  );

  const renderWordsPanel = () => {
    if (frequencies.length === 0) return <p className="text-xs text-slate-500">{tx('textwerk.words_empty')}</p>;
    return (
      <div className="space-y-2">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {t('textwerk.words_total', { count: wordCount })} · {t('textwerk.words_unique', { count: frequencies.length })}
        </p>
        <ul className="divide-y divide-slate-200 dark:divide-slate-700 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          {frequencies.slice(0, WORD_LIST_LIMIT).map(entry => {
            const unknown = speller ? !speller.correct(entry.word) && !ignored.has(entry.word) : false;
            return (
              <li key={entry.word} className="flex items-center justify-between px-2.5 py-1.5 text-xs">
                <span className={unknown ? 'text-red-600 dark:text-red-400' : ''}>{entry.word}</span>
                <span className="text-slate-500">{entry.count}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const activeTheme = PAGE_THEMES.find(theme => theme.id === pageTheme) ?? PAGE_THEMES[0];
  const pageStyle: React.CSSProperties = {
    backgroundColor: activeTheme.background,
    color: activeTheme.text
  };

  const pageW = PAGE_SIZES[orientation].w;
  const pageH = PAGE_SIZES[orientation].h;
  // Thin rules at each page height show where a new page starts; text flows on across them.
  const pageLines = `repeating-linear-gradient(to bottom, transparent 0 ${pageH - 1}px, #94a3b8 ${pageH - 1}px ${pageH + 1}px)`;

  const panelTitle = sidePanel === 'spelling'
    ? tx('textwerk.panel_spelling')
    : sidePanel === 'words'
      ? tx('textwerk.panel_words')
      : tx('textwerk.panel_find');

  return (
    <div className="flex flex-col h-full min-h-0 bg-slate-200 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <style>{`::highlight(${SPELL_HIGHLIGHT}) { text-decoration: red wavy underline; }
        .textwerk-pagebreak { display: block; box-sizing: border-box; border-top: 1px dashed #94a3b8; }`}</style>

      {/* Title bar with quick access toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-[#2b579a] text-white text-xs">
        <PenLine className="w-4 h-4 shrink-0" />
        <span className="font-semibold">Text Editor</span>
        <input
          value={documentName}
          onChange={event => setDocumentName(event.target.value)}
          aria-label={ex('doc_title')}
          title={ex('doc_title')}
          className="bg-white/10 rounded px-2 py-0.5 outline-none focus:bg-white/20 w-40"
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            title={`${tx('textwerk.save')} (Ctrl+S)`}
            aria-label={tx('textwerk.save')}
            onMouseDown={event => event.preventDefault()}
            onClick={saveDocument}
            className="p-1 rounded hover:bg-white/20"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title={tx('textwerk.undo')}
            aria-label={tx('textwerk.undo')}
            onMouseDown={event => event.preventDefault()}
            onClick={() => runCommand('undo')}
            className="p-1 rounded hover:bg-white/20"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title={tx('textwerk.redo')}
            aria-label={tx('textwerk.redo')}
            onMouseDown={event => event.preventDefault()}
            onClick={() => runCommand('redo')}
            className="p-1 rounded hover:bg-white/20"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ribbon tabs */}
      <div className="flex items-end gap-1 px-2 pt-1 bg-[#f3f3f3] dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700">
        {RIBBON_TABS.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`px-3 py-1.5 text-xs border-b-2 -mb-px ${
              tab === item.id
                ? 'border-[#2b579a] text-[#2b579a] font-semibold dark:text-blue-300'
                : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            {tx(item.key)}
          </button>
        ))}
      </div>

      {/* Ribbon */}
      <div className="flex flex-wrap items-stretch gap-x-1 gap-y-1.5 px-2 py-1.5 bg-[#f9f9f9] dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700">
        {renderRibbon()}
      </div>

      <input ref={fileInputRef} type="file" accept=".txt,.html,.htm" className="hidden" onChange={handleOpenFile} />

      <div className="flex flex-1 min-h-0">
        {/* Backstage (Datei) */}
        {tab === 'file' && (
          <div className="flex-1 min-w-0 overflow-auto bg-white dark:bg-slate-900 px-10 py-8">
            <button
              type="button"
              onClick={() => setTab('home')}
              className="mb-6 inline-flex items-center gap-2 text-sm text-[#2b579a] dark:text-blue-300 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              {ex('back_to_doc')}
            </button>
            <div className="max-w-sm space-y-1">
              {[
                { icon: FilePlus, label: tx('textwerk.new'), run: newDocument },
                { icon: FolderOpen, label: tx('textwerk.open'), run: openFromDesktop },
                { icon: Save, label: tx('textwerk.save'), run: saveDocument },
                { icon: Download, label: tx('textwerk.export_text'), run: exportText },
                { icon: Printer, label: ex('print'), run: () => window.print() }
              ].map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.run}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded text-left text-sm text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <item.icon className="w-5 h-5 text-[#2b579a] dark:text-blue-300" />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-8 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">{ex('backstage_info')}</p>
              <p>{ex('doc_title')}: {documentName}</p>
            </div>
          </div>
        )}

        {/* Page */}
        <div className={`flex-1 min-w-0 overflow-auto bg-slate-300 dark:bg-slate-800 py-6 ${tab === 'file' ? 'hidden' : ''}`} onKeyDown={handleKeyDown}>
          <div className="mx-auto" style={{ zoom: zoom / 100, width: showRuler ? pageW + 20 : pageW }}>
            {showRuler && (
              <div className="mb-1 h-4 border border-slate-400 bg-white dark:bg-slate-700" style={{ width: pageW, backgroundImage: 'repeating-linear-gradient(to right, transparent 0 37.8px, #94a3b8 37.8px 38px)' }} />
            )}
            <div className="flex">
              {showRuler && (
                <div className="mr-1 w-4 shrink-0 border border-slate-400 bg-white dark:bg-slate-700" style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 37.8px, #94a3b8 37.8px 38px)' }} />
              )}
            <div ref={sheetRef} className="shadow-xl" style={{ ...pageStyle, width: pageW, minHeight: pageH, padding: MARGIN_SIZES[margins], backgroundImage: pageLines }}>
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                role="textbox"
                aria-multiline="true"
                aria-label="Text Editor"
                onInput={syncText}
                style={{ fontFamily, fontSize: `${fontSize}pt` }}
                className="min-h-[900px] outline-none leading-relaxed break-words [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-[#2b579a] [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[#2b579a] [&_blockquote]:border-l-4 [&_blockquote]:border-slate-300 [&_blockquote]:pl-4 [&_blockquote]:italic"
              />
            </div>
            </div>
          </div>
        </div>

        {/* Side panel */}
        {sidePanel && (
          <aside className="w-72 shrink-0 flex flex-col min-h-0 border-l border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold">{panelTitle}</span>
              <button
                type="button"
                title={tx('textwerk.close_panel')}
                aria-label={tx('textwerk.close_panel')}
                onClick={() => setSidePanel(null)}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {sidePanel !== 'find' && (
                <div className="mb-2 text-[11px] text-slate-500">
                  {tx('textwerk.language')}: {languageLabel}
                </div>
              )}
              {sidePanel === 'spelling' ? renderSpellingPanel() : sidePanel === 'words' ? renderWordsPanel() : renderFindPanel()}
            </div>
          </aside>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 px-3 py-1 text-[11px] text-slate-600 dark:text-slate-400 bg-[#2b579a]/10 dark:bg-slate-900 border-t border-slate-300 dark:border-slate-700">
        <span>
          {tx('textwerk.status_words')}: {wordCount}
        </span>
        <span>
          {tx('textwerk.status_chars')}: {charCount}
        </span>
        <span>{languageLabel}</span>
        <button
          type="button"
          onClick={() => setSidePanel('spelling')}
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-slate-200 dark:hover:bg-slate-800 ${
            issues.length > 0 && spellingOn ? 'text-red-600 dark:text-red-400' : ''
          }`}
        >
          <SpellCheck className="w-3 h-3" />
          {spellStatus}
        </button>
        {status && <span className="ml-auto text-emerald-700 dark:text-emerald-400">{status}</span>}
        <span className={`${status ? '' : 'ml-auto'} tabular-nums`}>{zoom} %</span>
      </div>
    </div>
  );
};
