import React, { useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Ban,
  Bold,
  Columns3,
  Download,
  Eraser,
  FilePlus,
  FolderOpen,
  Grid3x3,
  Italic,
  Layers,
  PaintBucket,
  Rows3,
  Sigma,
  Trash2,
  Type,
  Underline,
  type LucideIcon
} from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';

const MIN_COLS = 8;
const MIN_ROWS = 20;
const MAX_COLS = 26;
const MAX_ROWS = 200;
const FONT_FAMILIES = ['Arial', 'Calibri', 'Georgia', 'Courier New', 'Verdana'];
const TEMPLATE_STORAGE_KEY = 'socdof_table_templates_v1';

type Sheet = string[][];
type Align = 'left' | 'center' | 'right';
type CellStyle = { bold?: boolean; italic?: boolean; underline?: boolean; align?: Align; color?: string; fill?: string; font?: string };
type StyleMap = Record<string, CellStyle>;
type RibbonTab = 'file' | 'home' | 'insert' | 'view';

// Word's fixed "Standard colours" row, in Word's order.
const WORD_STANDARD_COLORS: string[] = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];

const RIBBON_TABS: Array<{ id: RibbonTab; key: string }> = [
  { id: 'file', key: 'table.tab_file' },
  { id: 'home', key: 'table.tab_home' },
  { id: 'insert', key: 'table.tab_insert' },
  { id: 'view', key: 'table.tab_view' }
];

const FUNCTIONS: Array<{ fn: string; key: string }> = [
  { fn: 'SUMME', key: 'table.fn_sum' },
  { fn: 'MITTELWERT', key: 'table.fn_avg' },
  { fn: 'MAX', key: 'table.fn_max' },
  { fn: 'MIN', key: 'table.fn_min' },
  { fn: 'ANZAHL', key: 'table.fn_count' }
];

function emptySheet(rows = MIN_ROWS, cols = MIN_COLS): Sheet {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function sheetSize(sheet: Sheet): { rows: number; cols: number } {
  return { rows: sheet.length, cols: sheet[0]?.length ?? MIN_COLS };
}

function colName(index: number): string {
  return String.fromCharCode(65 + index);
}

function cellId(col: number, row: number): string {
  return `${colName(col)}${row + 1}`;
}

// Parses A1 style references. Bounds are checked by the caller against the sheet size.
function parseRef(ref: string): { col: number; row: number } | null {
  const match = /^([A-Z])(\d+)$/.exec(ref.trim().toUpperCase());
  if (!match) return null;
  const col = match[1].charCodeAt(0) - 65;
  const row = Number(match[2]) - 1;
  if (col < 0 || col >= MAX_COLS || row < 0 || row >= MAX_ROWS) return null;
  return { col, row };
}

// Expands A1:B3 style ranges and single references to a list of cell values.
function rangeValues(
  from: string,
  to: string,
  read: (col: number, row: number, stack: Set<string>) => number,
  stack: Set<string>
): number[] {
  const a = parseRef(from);
  const b = parseRef(to);
  if (!a || !b) throw new Error('ref');
  const values: number[] = [];
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) {
      values.push(read(c, r, stack));
    }
  }
  return values;
}

// Evaluates one cell. Formulas start with "=" and may use cell references,
// ranges (A1:A5), + - * / and the functions SUMME, MITTELWERT, MAX, MIN, ANZAHL.
export function evaluateCell(
  raw: string,
  read: (col: number, row: number, stack: Set<string>) => number,
  stack: Set<string> = new Set()
): number | string {
  const text = raw.trim();
  if (text === '') return '';
  if (!text.startsWith('=')) {
    const num = Number(text.replace(',', '.'));
    return Number.isFinite(num) && text !== '' ? num : text;
  }
  try {
    const expr = text.slice(1).toUpperCase();
    const replaced = expr.replace(
      /(SUMME|MITTELWERT|MAX|MIN|ANZAHL)\(([A-Z]\d+):([A-Z]\d+)\)|([A-Z]\d+)/g,
      (match, fn, from, to, ref) => {
        if (fn) {
          const values = rangeValues(from, to, read, stack);
          const sum = values.reduce((s, v) => s + v, 0);
          switch (fn) {
            case 'SUMME': return String(sum);
            case 'MITTELWERT': return String(values.length ? sum / values.length : 0);
            case 'MAX': return String(values.length ? Math.max(...values) : 0);
            case 'MIN': return String(values.length ? Math.min(...values) : 0);
            case 'ANZAHL': return String(values.length);
          }
        }
        const pos = parseRef(ref);
        if (!pos) throw new Error('ref');
        return String(read(pos.col, pos.row, stack));
      }
    );
    if (!/^[0-9+\-*/(). ]+$/.test(replaced)) return '#FEHLER';
    // Only digits and operators reach this point, so the evaluation is safe.
    const result = Function(`"use strict"; return (${replaced});`)();
    return Number.isFinite(result) ? Number(result.toFixed(10)) : '#FEHLER';
  } catch {
    return '#FEHLER';
  }
}

function toCsv(sheet: Sheet): string {
  return sheet
    .map((row) => row.map((cell) => (/[";\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(';'))
    .join('\n');
}

// Imports the file at its real size, capped to the maximum grid.
function parseCsv(text: string): Sheet {
  const lines = text.split(/\r?\n/).slice(0, MAX_ROWS);
  const parsed = lines.map((line) => {
    const cells: string[] = [];
    let current = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') quoted = false;
        else current += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ';') { cells.push(current); current = ''; }
      else current += ch;
    }
    cells.push(current);
    return cells.slice(0, MAX_COLS);
  });
  const cols = Math.max(MIN_COLS, ...parsed.map((cells) => cells.length));
  const rows = Math.max(MIN_ROWS, parsed.length);
  const sheet = emptySheet(rows, cols);
  parsed.forEach((cells, r) => {
    cells.forEach((value, c) => { sheet[r][c] = value; });
  });
  return sheet;
}

const ToolButton: React.FC<{ icon: LucideIcon; label: string; onAction: () => void; active?: boolean; disabled?: boolean }> = ({ icon: Icon, label, onAction, active, disabled }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onClick={onAction}
    className="flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-1.5 py-1 rounded text-[11px] transition-colors disabled:opacity-40 text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800"
    style={active ? { backgroundColor: 'var(--accent-light)', color: 'var(--accent)' } : undefined}
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

// One compact row of colour swatches, like Word's font colour row.
const ColorRow: React.FC<{ label: string; onPick: (color: string | undefined) => void; noneLabel: string }> = ({ label, onPick, noneLabel }) => (
  <div className="flex items-center gap-1" role="group" aria-label={label}>
    <button type="button" title={noneLabel} aria-label={noneLabel} onClick={() => onPick(undefined)} className="flex h-4 w-4 items-center justify-center rounded text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800">
      <Ban className="w-3 h-3" />
    </button>
    {WORD_STANDARD_COLORS.map((color) => (
      <button
        key={color}
        type="button"
        title={color}
        aria-label={`${label} ${color}`}
        onClick={() => onPick(color)}
        className="h-3.5 w-3.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:scale-110 transition-transform"
        style={{ backgroundColor: color }}
      />
    ))}
  </div>
);

export default function TableModule() {
  const currentLang = useLanguage();
  const tx = (key: string) => t(key, currentLang);
  const [sheet, setSheet] = useState<Sheet>(emptySheet);
  const [styles, setStyles] = useState<StyleMap>({});
  const [fileName, setFileName] = useState('tabelle.csv');
  const [focused, setFocused] = useState<string | null>(null);
  const [active, setActive] = useState<{ col: number; row: number }>({ col: 0, row: 0 });
  const [tab, setTab] = useState<RibbonTab>('home');
  const [showGridlines, setShowGridlines] = useState(true);
  const [showFormulaBar, setShowFormulaBar] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  const activeId = cellId(active.col, active.row);
  const activeStyle = styles[activeId] ?? {};

  // Two-pass read: formulas that reference other formulas are resolved recursively.
  const values = useMemo(() => {
    const cache = new Map<string, number | string>();
    const read = (col: number, row: number, stack: Set<string>): number => {
      const id = cellId(col, row);
      if (cache.has(id)) return Number(cache.get(id)) || 0;
      if (stack.has(id)) return 0;
      const nextStack = new Set(stack).add(id);
      const value = evaluateCell(sheet[row][col], read, nextStack);
      cache.set(id, value);
      return typeof value === 'number' ? value : 0;
    };
    const result: (number | string)[][] = [];
    for (let r = 0; r < sheet.length; r++) {
      result.push(Array.from({ length: sheet[0].length }, (_, c) => {
        const id = cellId(c, r);
        if (!cache.has(id)) read(c, r, new Set());
        return cache.get(id) ?? '';
      }));
    }
    return result;
  }, [sheet]);

  const filledCount = useMemo(() => sheet.reduce((n, line) => n + line.filter((cell) => cell.trim() !== '').length, 0), [sheet]);

  const updateCell = (col: number, row: number, value: string) => {
    setSheet((prev) => prev.map((line, r) => (r === row ? line.map((cell, c) => (c === col ? value : cell)) : line)));
  };

  const updateStyle = (patch: CellStyle) => {
    setStyles((prev) => ({ ...prev, [activeId]: { ...(prev[activeId] ?? {}), ...patch } }));
  };

  const toggleStyle = (key: 'bold' | 'italic' | 'underline') => {
    updateStyle({ [key]: !activeStyle[key] });
  };

  // Inserts or deletes a row or column at the active cell. Styles move with their cells.
  const shiftStyles = (isRow: boolean, index: number, delta: number) => {
    setStyles((prev) => {
      const next: StyleMap = {};
      for (const [id, style] of Object.entries(prev)) {
        const pos = parseRef(id);
        if (!pos) continue;
        const at = isRow ? pos.row : pos.col;
        if (at < index) next[id] = style;
        else if (delta < 0 && at === index) continue;
        else {
          const moved = { ...pos, ...(isRow ? { row: pos.row + delta } : { col: pos.col + delta }) };
          next[cellId(moved.col, moved.row)] = style;
        }
      }
      return next;
    });
  };

  const insertRow = (above: boolean) => {
    const at = above ? active.row : active.row + 1;
    if (sheet.length >= MAX_ROWS) return;
    shiftStyles(true, at, 1);
    setSheet((prev) => [...prev.slice(0, at), emptySheet(1, prev[0].length)[0], ...prev.slice(at)]);
  };

  const insertColumn = (left: boolean) => {
    const at = left ? active.col : active.col + 1;
    if (sheet[0].length >= MAX_COLS) return;
    shiftStyles(false, at, 1);
    setSheet((prev) => prev.map((line) => [...line.slice(0, at), '', ...line.slice(at)]));
  };

  const deleteRow = () => {
    if (sheet.length <= 1) return;
    shiftStyles(true, active.row, -1);
    setSheet((prev) => prev.filter((_, r) => r !== active.row));
    setActive((a) => ({ col: a.col, row: Math.min(a.row, sheet.length - 2) }));
  };

  const deleteColumn = () => {
    if (sheet[0].length <= 1) return;
    shiftStyles(false, active.col, -1);
    setSheet((prev) => prev.map((line) => line.filter((_, c) => c !== active.col)));
    setActive((a) => ({ col: Math.min(a.col, sheet[0].length - 2), row: a.row }));
  };

  const clearActiveCell = () => {
    updateCell(active.col, active.row, '');
    setStyles((prev) => {
      const next = { ...prev };
      delete next[activeId];
      return next;
    });
  };

  // Writes a function over the contiguous block of filled cells above the active cell.
  const insertFunction = (fn: string) => {
    const { col, row } = active;
    if (row === 0) {
      updateCell(col, row, `=${fn}()`);
      return;
    }
    let top = row - 1;
    while (top > 0 && sheet[top - 1][col].trim() !== '') top--;
    updateCell(col, row, `=${fn}(${colName(col)}${top + 1}:${colName(col)}${row})`);
  };

  const moveActive = (col: number, row: number) => {
    const nc = Math.min(Math.max(col, 0), sheet[0].length - 1);
    const nr = Math.min(Math.max(row, 0), sheet.length - 1);
    setActive({ col: nc, row: nr });
    gridRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${cellId(nc, nr)}"]`)?.focus();
  };

  const onCellKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, col: number, row: number) => {
    if (event.key === 'Enter' || event.key === 'ArrowDown') { event.preventDefault(); moveActive(col, row + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); moveActive(col, row - 1); }
    else if (event.key === 'Tab') { event.preventDefault(); moveActive(col + (event.shiftKey ? -1 : 1), row); }
  };

  const saveSheet = () => {
    const blob = new Blob(['\uFEFF' + toCsv(sheet)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openSheet = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setSheet(parseCsv(String(reader.result ?? '').replace(/^\uFEFF/, '')));
      setStyles({});
      setFileName(file.name);
    };
    reader.readAsText(file, 'utf-8');
  };

  const newSheet = () => {
    setSheet(emptySheet());
    setStyles({});
    setFileName('tabelle.csv');
    setActive({ col: 0, row: 0 });
  };

  const activeRaw = sheet[active.row][active.col];

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Title row with file name, as in Word */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs">
        <span className="font-semibold text-slate-500">{tx('table.file_name')}</span>
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          aria-label={tx('table.file_name')}
          className="w-48 rounded border border-transparent bg-white dark:bg-slate-900 px-2 py-0.5 outline-none focus:border-slate-300 dark:focus:border-slate-600"
        />
      </div>

      {/* Tab row with underline on the active tab */}
      <div role="tablist" className="flex items-end gap-1 border-b border-slate-200 dark:border-white/10 px-2">
        {RIBBON_TABS.map((item) => {
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(item.id)}
              className="px-3 py-1.5 text-xs font-medium border-b-2 transition-colors"
              style={{ borderColor: isActive ? 'var(--accent)' : 'transparent', color: isActive ? 'var(--accent)' : undefined }}
            >
              <span className={isActive ? '' : 'text-slate-600 dark:text-slate-400'}>{tx(item.key)}</span>
            </button>
          );
        })}
      </div>

      {/* Ribbon */}
      <div className="flex flex-wrap items-stretch gap-1 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 px-2 py-1.5">
        {tab === 'file' && (
          <RibbonGroup label={tx('table.group_file')}>
            <ToolButton icon={FilePlus} label={tx('table.new')} onAction={newSheet} />
            <ToolButton icon={Download} label={tx('table.save')} onAction={saveSheet} />
            <label className="flex flex-col items-center justify-center gap-0.5 min-w-[52px] px-1.5 py-1 rounded text-[11px] cursor-pointer text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800">
              <FolderOpen className="w-4 h-4" />
              <span className="whitespace-nowrap">{tx('table.open')}</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) openSheet(f); e.target.value = ''; }} />
            </label>
            <ToolButton icon={Trash2} label={tx('table.clear')} onAction={newSheet} />
          </RibbonGroup>
        )}

        {tab === 'home' && (
          <>
            <RibbonGroup label={tx('table.group_font')}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-0.5">
                  <ToolButton icon={Bold} label={tx('table.bold')} active={!!activeStyle.bold} onAction={() => toggleStyle('bold')} />
                  <ToolButton icon={Italic} label={tx('table.italic')} active={!!activeStyle.italic} onAction={() => toggleStyle('italic')} />
                  <ToolButton icon={Underline} label={tx('table.underline')} active={!!activeStyle.underline} onAction={() => toggleStyle('underline')} />
                </div>
                <div className="flex items-center gap-3 px-1">
                  <Type className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    aria-label={tx('table.font_family')}
                    value={activeStyle.font ?? ''}
                    onChange={(e) => updateStyle({ font: e.target.value || undefined })}
                    className="rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 px-1 py-0.5 text-[11px]"
                  >
                    <option value="">{tx('table.font_default')}</option>
                    {FONT_FAMILIES.map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>{font}</option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <Baseline className="w-3.5 h-3.5 text-slate-500" />
                    <ColorRow label={tx('table.font_color')} noneLabel={tx('table.color_none')} onPick={(color) => updateStyle({ color })} />
                  </div>
                  <div className="flex items-center gap-1">
                    <PaintBucket className="w-3.5 h-3.5 text-slate-500" />
                    <ColorRow label={tx('table.fill_color')} noneLabel={tx('table.color_none')} onPick={(fill) => updateStyle({ fill })} />
                  </div>
                </div>
              </div>
            </RibbonGroup>
            <RibbonGroup label={tx('table.group_align')}>
              <ToolButton icon={AlignLeft} label={tx('table.align_left')} active={activeStyle.align === 'left'} onAction={() => updateStyle({ align: 'left' })} />
              <ToolButton icon={AlignCenter} label={tx('table.align_center')} active={activeStyle.align === 'center'} onAction={() => updateStyle({ align: 'center' })} />
              <ToolButton icon={AlignRight} label={tx('table.align_right')} active={activeStyle.align === 'right'} onAction={() => updateStyle({ align: 'right' })} />
            </RibbonGroup>
            <RibbonGroup label={tx('table.group_cell')}>
              <ToolButton icon={Eraser} label={tx('table.clear_cell')} onAction={clearActiveCell} />
            </RibbonGroup>
            <RibbonGroup label={tx('table.group_rows_cols')}>
              <ToolButton icon={Rows3} label={tx('table.insert_row')} onAction={() => insertRow(true)} />
              <ToolButton icon={Rows3} label={tx('table.delete_row')} onAction={deleteRow} />
              <ToolButton icon={Columns3} label={tx('table.insert_col')} onAction={() => insertColumn(true)} />
              <ToolButton icon={Columns3} label={tx('table.delete_col')} onAction={deleteColumn} />
            </RibbonGroup>
          </>
        )}

        {tab === 'insert' && (
          <RibbonGroup label={tx('table.group_functions')}>
            {FUNCTIONS.map((item) => (
              <ToolButton key={item.fn} icon={Sigma} label={tx(item.key)} onAction={() => insertFunction(item.fn)} />
            ))}
          </RibbonGroup>
        )}

        {tab === 'view' && (
          <RibbonGroup label={tx('table.group_show')}>
            <ToolButton icon={Grid3x3} label={tx('table.gridlines')} active={showGridlines} onAction={() => setShowGridlines((v) => !v)} />
            <ToolButton icon={FolderOpen} label={tx('table.formula_bar')} active={showFormulaBar} onAction={() => setShowFormulaBar((v) => !v)} />
          </RibbonGroup>
        )}
      </div>

      {/* Formula bar with the active cell reference */}
      {showFormulaBar && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-white/10 px-2 py-1 text-xs">
          <span className="min-w-[48px] rounded border border-slate-200 dark:border-white/10 px-2 py-0.5 text-center font-mono">{activeId}</span>
          <span className="text-slate-400 italic">fx</span>
          <input
            value={activeRaw}
            onChange={(e) => updateCell(active.col, active.row, e.target.value)}
            aria-label={tx('table.formula_bar')}
            className="flex-1 rounded border border-transparent bg-slate-50 dark:bg-slate-950 px-2 py-0.5 font-mono outline-none focus:border-slate-300 dark:focus:border-slate-600"
          />
        </div>
      )}

      <div ref={gridRef} className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 w-10 border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800" />
              {Array.from({ length: sheet[0].length }, (_, c) => (
                <th key={c} className="sticky top-0 z-10 min-w-[110px] border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 px-2 py-1 font-semibold text-xs text-slate-600 dark:text-slate-300">{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: sheet.length }, (_, r) => (
              <tr key={r}>
                <th className="sticky left-0 z-[1] border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 px-2 py-1 font-semibold text-xs text-slate-600 dark:text-slate-300">{r + 1}</th>
                {Array.from({ length: sheet[0].length }, (_, c) => {
                  const shown = values[r][c];
                  const id = cellId(c, r);
                  const isFormula = sheet[r][c].trim().startsWith('=');
                  const st = styles[id] ?? {};
                  const isActive = active.col === c && active.row === r;
                  return (
                    <td
                      key={c}
                      className={`p-0 ${showGridlines ? 'border border-slate-200 dark:border-white/10' : 'border border-transparent'} ${isActive ? 'outline outline-2 -outline-offset-2 outline-[var(--accent)]' : ''}`}
                      style={st.fill ? { backgroundColor: st.fill } : undefined}
                    >
                      <input
                        data-cell={id}
                        value={focused === id || !isFormula ? sheet[r][c] : String(shown)}
                        onFocus={() => { setFocused(id); setActive({ col: c, row: r }); }}
                        onBlur={() => setFocused(null)}
                        onKeyDown={(e) => onCellKeyDown(e, c, r)}
                        onChange={(e) => updateCell(c, r, e.target.value)}
                        title={isFormula ? `${id}: ${sheet[r][c]}` : id}
                        className="w-full min-w-[110px] bg-transparent px-2 py-1 outline-none"
                        style={{
                          color: st.color,
                          fontWeight: st.bold ? 700 : undefined,
                          fontStyle: st.italic ? 'italic' : undefined,
                          textDecoration: st.underline ? 'underline' : undefined,
                          fontFamily: st.font,
                          textAlign: st.align ?? (typeof shown === 'number' ? 'right' : 'left')
                        }}
                        aria-label={id}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 px-3 py-1 text-[11px] text-slate-500">
        <span>{tx('table.status_active')}: {activeId}</span>
        <span>{tx('table.status_cells')}: {filledCount}</span>
        <span className="ml-auto">{tx('table.hint')}</span>
      </div>
    </div>
  );
}
