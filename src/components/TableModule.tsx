import React, { useMemo, useState } from 'react';
import { Download, FolderOpen, Trash2 } from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';

const COLS = 8;
const ROWS = 20;

type Sheet = string[][];

function emptySheet(): Sheet {
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ''));
}

function colName(index: number): string {
  return String.fromCharCode(65 + index);
}

function cellId(col: number, row: number): string {
  return `${colName(col)}${row + 1}`;
}

function parseRef(ref: string): { col: number; row: number } | null {
  const match = /^([A-Z])(\d+)$/.exec(ref.trim().toUpperCase());
  if (!match) return null;
  const col = match[1].charCodeAt(0) - 65;
  const row = Number(match[2]) - 1;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
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

function parseCsv(text: string): Sheet {
  const sheet = emptySheet();
  text.split(/\r?\n/).slice(0, ROWS).forEach((line, r) => {
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
    cells.slice(0, COLS).forEach((value, c) => { sheet[r][c] = value; });
  });
  return sheet;
}

export default function TableModule() {
  const currentLang = useLanguage();
  const tx = (key: string) => t(key, currentLang);
  const [sheet, setSheet] = useState<Sheet>(emptySheet);
  const [fileName, setFileName] = useState('tabelle.csv');
  const [focused, setFocused] = useState<string | null>(null);

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
    for (let r = 0; r < ROWS; r++) {
      result.push(Array.from({ length: COLS }, (_, c) => {
        const id = cellId(c, r);
        if (!cache.has(id)) read(c, r, new Set());
        return cache.get(id) ?? '';
      }));
    }
    return result;
  }, [sheet]);

  const updateCell = (col: number, row: number, value: string) => {
    setSheet((prev) => prev.map((line, r) => (r === row ? line.map((cell, c) => (c === col ? value : cell)) : line)));
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
      setFileName(file.name);
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-white/10 p-2 text-sm">
        <button type="button" onClick={saveSheet} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
          <Download className="h-4 w-4" /> {tx('table.save')}
        </button>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
          <FolderOpen className="h-4 w-4" /> {tx('table.open')}
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) openSheet(f); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={() => { setSheet(emptySheet()); setFileName('tabelle.csv'); }} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-white/10">
          <Trash2 className="h-4 w-4" /> {tx('table.clear')}
        </button>
        <span className="ml-auto text-xs text-slate-500">{tx('table.hint')}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky top-0 z-10 w-10 border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800" />
              {Array.from({ length: COLS }, (_, c) => (
                <th key={c} className="sticky top-0 z-10 min-w-[110px] border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 px-2 py-1 font-semibold">{colName(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: ROWS }, (_, r) => (
              <tr key={r}>
                <th className="sticky left-0 z-[1] border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 px-2 py-1 font-semibold">{r + 1}</th>
                {Array.from({ length: COLS }, (_, c) => {
                  const shown = values[r][c];
                  const id = cellId(c, r);
                  const isFormula = sheet[r][c].trim().startsWith('=');
                  return (
                    <td key={c} className="border border-slate-200 dark:border-white/10 p-0">
                      <input
                        value={focused === id || !isFormula ? sheet[r][c] : String(shown)}
                        onFocus={() => setFocused(id)}
                        onBlur={() => setFocused(null)}
                        onChange={(e) => updateCell(c, r, e.target.value)}
                        title={isFormula ? `${id}: ${sheet[r][c]}` : id}
                        className={`w-full min-w-[110px] bg-transparent px-2 py-1 outline-none focus:bg-blue-50 dark:focus:bg-blue-500/10 ${typeof shown === 'number' ? 'text-right' : ''}`}
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
    </div>
  );
}
