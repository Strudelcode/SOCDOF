import React, { useState } from 'react';
import { Calculator, Copy, Check, Delete, Maximize2 } from 'lucide-react';
import { DesktopWidget } from '../types';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';

interface DesktopCalculatorWidgetProps {
  widget: DesktopWidget;
  zIndexValue: number;
  dragClass: string;
  cursorClass: string;
  bgClass: string;
  fontClass: string;
  blurClass: string;
  textColClass: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onOpenCalculator: () => void;
  renderHoverMicroActions: () => React.ReactNode;
  currentLang: 'de' | 'en' | 'fr' | 'es';
}

export const DesktopCalculatorWidget: React.FC<DesktopCalculatorWidgetProps> = ({
  widget,
  zIndexValue,
  dragClass,
  cursorClass,
  bgClass,
  fontClass,
  blurClass,
  textColClass,
  onMouseDown,
  onContextMenu,
  onOpenCalculator,
  renderHoverMicroActions,
  currentLang
}) => {
  const [display, setDisplay] = useState<string>('0');
  const [equation, setEquation] = useState<string>('');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const handleDigit = (digit: string) => {
    sounds.playClick();
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const handleDot = () => {
    sounds.playClick();
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleClear = () => {
    sounds.playClick();
    setDisplay('0');
    setEquation('');
    setPrevValue(null);
    setPendingOp(null);
    setWaitingForOperand(false);
  };

  const handleBackspace = () => {
    sounds.playClick();
    if (waitingForOperand) return;
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleToggleSign = () => {
    sounds.playClick();
    const val = parseFloat(display);
    if (!isNaN(val) && val !== 0) {
      setDisplay(String(val * -1));
    }
  };

  const handlePercent = () => {
    sounds.playClick();
    const val = parseFloat(display);
    if (!isNaN(val)) {
      setDisplay(String(val / 100));
    }
  };

  const handleOp = (op: string) => {
    sounds.playClick();
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(inputValue);
      setEquation(`${display} ${op}`);
    } else if (pendingOp && !waitingForOperand) {
      const result = calculate(prevValue, inputValue, pendingOp);
      setPrevValue(result);
      setDisplay(String(result));
      setEquation(`${result} ${op}`);
    } else {
      setEquation(`${display} ${op}`);
    }

    setWaitingForOperand(true);
    setPendingOp(op);
  };

  const handleEquals = () => {
    sounds.playClick();
    if (!pendingOp || prevValue === null) return;

    const inputValue = parseFloat(display);
    const result = calculate(prevValue, inputValue, pendingOp);
    // Round to avoid IEEE 754 precision issues
    const formatted = parseFloat(result.toPrecision(12)).toString();

    setEquation(`${prevValue} ${pendingOp} ${inputValue} =`);
    setDisplay(formatted);
    setPrevValue(null);
    setPendingOp(null);
    setWaitingForOperand(true);
  };

  const handleCopyResult = (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playClick();
    try {
      navigator.clipboard.writeText(display);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <div
      key={widget.id}
      style={{
        left: `${widget.x}px`,
        top: `${widget.y}px`,
        width: `${widget.width}px`,
        zIndex: zIndexValue
      }}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      className={`absolute pointer-events-auto rounded-3xl p-3 flex flex-col gap-2.5 animate-fade-in group select-none shadow-2xl ${dragClass} ${cursorClass} ${bgClass} ${fontClass} ${blurClass}`}
    >
      {renderHoverMicroActions()}

      {/* Header with Title and Open Full Calculator shortcut */}
      <div 
        className="flex items-center justify-between gap-1.5 px-0.5"
        onDoubleClick={(e) => {
          e.stopPropagation();
          onOpenCalculator();
        }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-xs shrink-0">
            <Calculator className="w-3.5 h-3.5" />
          </div>
          <span className={`text-[11px] font-black uppercase tracking-wider truncate ${textColClass || 'text-slate-700 dark:text-slate-300'}`}>
            {widget.title || t('widgets.calculator_title', currentLang, 'Taschenrechner')}
          </span>
        </div>

        <button
          type="button"
          data-no-drag
          onClick={(e) => {
            e.stopPropagation();
            sounds.playClick();
            onOpenCalculator();
          }}
          className="p-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700/70 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition cursor-pointer shrink-0"
          title={t('widgets.open_full_calculator', currentLang, 'Vollständigen Taschenrechner öffnen')}
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Screen / Display */}
      <div 
        data-no-drag
        className="bg-slate-100/90 dark:bg-slate-950/70 rounded-2xl p-2.5 border border-slate-200/70 dark:border-slate-800/80 flex flex-col justify-end text-right min-h-[56px] relative group/screen"
      >
        {/* Formula history */}
        <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate h-3.5 leading-none">
          {equation || '\u00A0'}
        </div>

        {/* Current Value + Copy Button */}
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <button
            type="button"
            onClick={handleCopyResult}
            className={`p-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
              copied 
                ? 'bg-emerald-500 text-white' 
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
            title={copied ? t('calc.copied', currentLang, 'Kopiert!') : t('calc.copy_result', currentLang, 'Ergebnis kopieren')}
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied && <span>{t('calc.copied', currentLang, 'Kopiert!')}</span>}
          </button>

          <span className="text-xl sm:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white truncate">
            {display}
          </span>
        </div>
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-4 gap-1.5" data-no-drag>
        {/* Row 1 */}
        <button
          type="button"
          onClick={handleClear}
          className="h-9 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:scale-95 text-rose-600 dark:text-rose-400 font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          C
        </button>
        <button
          type="button"
          onClick={handleToggleSign}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 font-semibold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          ±
        </button>
        <button
          type="button"
          onClick={handlePercent}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-200 font-semibold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          %
        </button>
        <button
          type="button"
          onClick={() => handleOp('÷')}
          className="h-9 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 text-emerald-600 dark:text-emerald-400 font-black text-sm transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          ÷
        </button>

        {/* Row 2 */}
        <button
          type="button"
          onClick={() => handleDigit('7')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handleDigit('8')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handleDigit('9')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handleOp('×')}
          className="h-9 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 text-emerald-600 dark:text-emerald-400 font-black text-sm transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          ×
        </button>

        {/* Row 3 */}
        <button
          type="button"
          onClick={() => handleDigit('4')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleDigit('5')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handleDigit('6')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => handleOp('-')}
          className="h-9 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 text-emerald-600 dark:text-emerald-400 font-black text-sm transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          -
        </button>

        {/* Row 4 */}
        <button
          type="button"
          onClick={() => handleDigit('1')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handleDigit('2')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handleDigit('3')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => handleOp('+')}
          className="h-9 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 text-emerald-600 dark:text-emerald-400 font-black text-sm transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          +
        </button>

        {/* Row 5 */}
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDot}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-900 dark:text-white font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
        >
          .
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/70 dark:hover:bg-slate-700 active:scale-95 text-slate-500 dark:text-slate-400 font-bold text-xs transition flex items-center justify-center cursor-pointer shadow-2xs"
          title={t('calc.backspace', currentLang, 'Backspace')}
        >
          <Delete className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-sm transition flex items-center justify-center cursor-pointer shadow-md"
        >
          =
        </button>
      </div>
    </div>
  );
};
