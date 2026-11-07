import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Calculator,
  FlaskConical,
  ChevronDown,
  Settings,
  History,
  Trash2,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Sparkles,
  Info,
  X,
  Divide,
  Percent,
  Plus,
  Minus,
  Equal,
  Delete,
  CornerDownLeft,
  Pin,
  Columns,
  LayoutGrid
} from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';
import { sounds } from '../lib/sound';

export type CalculatorMode = 'simple' | 'scientific';
export type AngleUnit = 'deg' | 'rad';

interface CalculationHistoryItem {
  id: string;
  expression: string;
  result: string;
  timestamp: number;
}

export interface CalculatorModuleProps {
  isAlwaysOnTop?: boolean;
  onToggleAlwaysOnTop?: () => void;
  isSystemMuted?: boolean;
  isWideWindow?: boolean;
  onToggleWideWindow?: () => void;
}

export const CalculatorModule: React.FC<CalculatorModuleProps> = ({
  isAlwaysOnTop = false,
  onToggleAlwaysOnTop,
  isSystemMuted,
  isWideWindow,
  onToggleWideWindow,
}) => {
  const currentLang = useLanguage();

  // Settings State (persisted locally)
  const [mode, setMode] = useState<CalculatorMode>(() => {
    try {
      const saved = localStorage.getItem('socdof_calc_mode');
      return (saved === 'scientific' || saved === 'simple') ? saved : 'simple';
    } catch {
      return 'simple';
    }
  });

  const [angleUnit, setAngleUnit] = useState<AngleUnit>(() => {
    try {
      const saved = localStorage.getItem('socdof_calc_angle');
      return (saved === 'deg' || saved === 'rad') ? saved : 'deg';
    } catch {
      return 'deg';
    }
  });

  const [precision, setPrecision] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('socdof_calc_precision');
      return saved !== null ? parseInt(saved, 10) : -1; // -1 = automatic
    } catch {
      return -1;
    }
  });

  // Sound feedback setting (User requirement: "ob der Sound standardmäßig abgepsielt werden soll hängt von den setting in den Einstellungen ab")
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('socdof_calc_sound');
      if (saved !== null) {
        return saved === 'true';
      }
      return isSystemMuted !== undefined ? !isSystemMuted : !sounds.isMuted();
    } catch {
      return !sounds.isMuted();
    }
  });

  // UI Panels
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);
  const [isSecondFunction, setIsSecondFunction] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    if (isModeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModeMenuOpen]);

  // Calculation Engine State
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [formulaExpression, setFormulaExpression] = useState<string>('');
  const [waitingForOperand, setWaitingForOperand] = useState<boolean>(false);
  const [memoryValue, setMemoryValue] = useState<number>(0);
  const [lastEvaluated, setLastEvaluated] = useState<boolean>(false);

  // Calculation History
  const [history, setHistory] = useState<CalculationHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('socdof_calc_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save preferences
  useEffect(() => {
    try {
      localStorage.setItem('socdof_calc_mode', mode);
    } catch { /* ignore */ }
  }, [mode]);

  useEffect(() => {
    try {
      localStorage.setItem('socdof_calc_angle', angleUnit);
    } catch { /* ignore */ }
  }, [angleUnit]);

  useEffect(() => {
    try {
      localStorage.setItem('socdof_calc_precision', precision.toString());
    } catch { /* ignore */ }
  }, [precision]);

  useEffect(() => {
    try {
      localStorage.setItem('socdof_calc_sound', soundEnabled ? 'true' : 'false');
    } catch { /* ignore */ }
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('socdof_calc_history', JSON.stringify(history.slice(0, 50)));
    } catch { /* ignore */ }
  }, [history]);

  // Audio feedback helper (Respects both local toggle and global system audio setting)
  const playBeep = useCallback(() => {
    if (soundEnabled && !sounds.isMuted()) {
      sounds.playClick();
    }
  }, [soundEnabled]);

  // Format numbers cleanly
  const formatResult = useCallback((val: number): string => {
    if (isNaN(val)) return t('calc.error_invalid', currentLang, 'Ungültige Eingabe');
    if (!isFinite(val)) return t('calc.error_div_zero', currentLang, 'Division durch 0');

    if (precision >= 0) {
      return Number(val.toFixed(precision)).toString();
    }

    // High precision float trimming
    const str = val.toString();
    if (str.includes('e')) return val.toPrecision(10);
    const rounded = Math.round(val * 1e12) / 1e12;
    return rounded.toString();
  }, [precision, currentLang]);

  // Digit input
  const inputDigit = useCallback((digit: string) => {
    playBeep();
    if (waitingForOperand || lastEvaluated) {
      setDisplayValue(digit);
      setWaitingForOperand(false);
      if (lastEvaluated) {
        setFormulaExpression('');
        setLastEvaluated(false);
      }
    } else {
      setDisplayValue(prev => (prev === '0' ? digit : prev + digit));
    }
  }, [waitingForOperand, lastEvaluated, playBeep]);

  // Decimal separator
  const inputDecimal = useCallback(() => {
    playBeep();
    if (waitingForOperand || lastEvaluated) {
      setDisplayValue('0.');
      setWaitingForOperand(false);
      if (lastEvaluated) {
        setFormulaExpression('');
        setLastEvaluated(false);
      }
    } else if (!displayValue.includes('.')) {
      setDisplayValue(prev => prev + '.');
    }
  }, [waitingForOperand, lastEvaluated, displayValue, playBeep]);

  // Clear operations
  const clearAll = useCallback(() => {
    playBeep();
    setDisplayValue('0');
    setFormulaExpression('');
    setWaitingForOperand(false);
    setLastEvaluated(false);
  }, [playBeep]);

  const backspace = useCallback(() => {
    playBeep();
    if (lastEvaluated) {
      clearAll();
      return;
    }
    setDisplayValue(prev => {
      if (prev.length <= 1 || prev === '0' || prev.startsWith('Fehler') || prev === 'Error') {
        return '0';
      }
      return prev.slice(0, -1);
    });
  }, [lastEvaluated, clearAll, playBeep]);

  // Invert sign (+/-)
  const toggleSign = useCallback(() => {
    playBeep();
    const num = parseFloat(displayValue);
    if (!isNaN(num) && num !== 0) {
      setDisplayValue(formatResult(-num));
    }
  }, [displayValue, formatResult, playBeep]);

  // Percent
  const applyPercent = useCallback(() => {
    playBeep();
    const num = parseFloat(displayValue);
    if (!isNaN(num)) {
      const res = num / 100;
      setDisplayValue(formatResult(res));
    }
  }, [displayValue, formatResult, playBeep]);

  // Parse and safe-evaluate mathematical expressions
  const evaluateMathExpression = useCallback((rawExpr: string): number => {
    let sanitized = rawExpr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/π/g, `${Math.PI}`)
      .replace(/\be\b/g, `${Math.E}`);

    // Replace power operator
    sanitized = sanitized.replace(/\^/g, '**');

    // Tokenized calculation with basic operator precedence & parens
    try {
      // Safe function evaluation without external globals
      const mathScope: Record<string, any> = {
        sin: (x: number) => Math.sin(angleUnit === 'deg' ? (x * Math.PI) / 180 : x),
        cos: (x: number) => Math.cos(angleUnit === 'deg' ? (x * Math.PI) / 180 : x),
        tan: (x: number) => Math.tan(angleUnit === 'deg' ? (x * Math.PI) / 180 : x),
        asin: (x: number) => {
          const res = Math.asin(x);
          return angleUnit === 'deg' ? (res * 180) / Math.PI : res;
        },
        acos: (x: number) => {
          const res = Math.acos(x);
          return angleUnit === 'deg' ? (res * 180) / Math.PI : res;
        },
        atan: (x: number) => {
          const res = Math.atan(x);
          return angleUnit === 'deg' ? (res * 180) / Math.PI : res;
        },
        sqrt: Math.sqrt,
        cbrt: Math.cbrt,
        log: (x: number) => Math.log10(x),
        ln: (x: number) => Math.log(x),
        abs: Math.abs,
        pow: Math.pow,
        fact: (n: number) => {
          if (n < 0 || Math.floor(n) !== n) return NaN;
          if (n > 170) return Infinity;
          let r = 1;
          for (let i = 2; i <= n; i++) r *= i;
          return r;
        }
      };

      // Substitute scientific function keywords
      const exprWithFuncs = sanitized
        .replace(/sin\(/g, 'math.sin(')
        .replace(/cos\(/g, 'math.cos(')
        .replace(/tan\(/g, 'math.tan(')
        .replace(/asin\(/g, 'math.asin(')
        .replace(/acos\(/g, 'math.acos(')
        .replace(/atan\(/g, 'math.atan(')
        .replace(/log\(/g, 'math.log(')
        .replace(/ln\(/g, 'math.ln(')
        .replace(/sqrt\(/g, 'math.sqrt(')
        .replace(/cbrt\(/g, 'math.cbrt(')
        .replace(/abs\(/g, 'math.abs(');

      // Only allow safe math tokens
      if (/[^0-9+\-*/(). ,matha-z_]/i.test(exprWithFuncs)) {
        return NaN;
      }

      const evaluator = new Function('math', `"use strict"; return (${exprWithFuncs});`);
      return evaluator(mathScope);
    } catch {
      return NaN;
    }
  }, [angleUnit]);

  // Standard binary operators (+, -, ×, ÷, ^)
  const performOperation = useCallback((nextOperator: string) => {
    playBeep();
    if (lastEvaluated) {
      setFormulaExpression(`${displayValue} ${nextOperator} `);
      setWaitingForOperand(true);
      setLastEvaluated(false);
      return;
    }

    if (waitingForOperand) {
      // Replace trailing operator
      setFormulaExpression(prev => prev.replace(/[+\-×÷^]\s*$/, `${nextOperator} `));
      return;
    }

    const currentExpr = formulaExpression + displayValue;
    const partialResult = evaluateMathExpression(currentExpr);

    if (!isNaN(partialResult) && isFinite(partialResult)) {
      setDisplayValue(formatResult(partialResult));
    }

    setFormulaExpression(`${currentExpr} ${nextOperator} `);
    setWaitingForOperand(true);
  }, [lastEvaluated, waitingForOperand, formulaExpression, displayValue, evaluateMathExpression, formatResult, playBeep]);

  // Equals (=)
  const computeFinalResult = useCallback(() => {
    playBeep();
    if (!formulaExpression && !lastEvaluated) return;

    const fullExpr = formulaExpression + (waitingForOperand ? '' : displayValue);
    if (!fullExpr.trim()) return;

    const numericResult = evaluateMathExpression(fullExpr);
    const formatted = formatResult(numericResult);

    // Save to calculation history
    if (!isNaN(numericResult)) {
      const newItem: CalculationHistoryItem = {
        id: `calc_${Date.now()}`,
        expression: fullExpr,
        result: formatted,
        timestamp: Date.now()
      };
      setHistory(prev => [newItem, ...prev].slice(0, 50));
    }

    setFormulaExpression(`${fullExpr} =`);
    setDisplayValue(formatted);
    setWaitingForOperand(true);
    setLastEvaluated(true);
  }, [formulaExpression, lastEvaluated, waitingForOperand, displayValue, evaluateMathExpression, formatResult, playBeep]);

  // Scientific Immediate Operations (sin, cos, tan, log, sqrt, etc.)
  const applyScientificUnary = useCallback((fn: string) => {
    playBeep();
    const currentNum = parseFloat(displayValue);
    if (isNaN(currentNum)) return;

    let res = 0;
    let label = '';

    switch (fn) {
      case 'sin':
        res = Math.sin(angleUnit === 'deg' ? (currentNum * Math.PI) / 180 : currentNum);
        label = `sin(${currentNum})`;
        break;
      case 'cos':
        res = Math.cos(angleUnit === 'deg' ? (currentNum * Math.PI) / 180 : currentNum);
        label = `cos(${currentNum})`;
        break;
      case 'tan':
        res = Math.tan(angleUnit === 'deg' ? (currentNum * Math.PI) / 180 : currentNum);
        label = `tan(${currentNum})`;
        break;
      case 'asin':
        if (currentNum < -1 || currentNum > 1) {
          setDisplayValue(t('calc.error_invalid', currentLang, 'Ungültige Eingabe'));
          return;
        }
        res = Math.asin(currentNum);
        if (angleUnit === 'deg') res = (res * 180) / Math.PI;
        label = `asin(${currentNum})`;
        break;
      case 'acos':
        if (currentNum < -1 || currentNum > 1) {
          setDisplayValue(t('calc.error_invalid', currentLang, 'Ungültige Eingabe'));
          return;
        }
        res = Math.acos(currentNum);
        if (angleUnit === 'deg') res = (res * 180) / Math.PI;
        label = `acos(${currentNum})`;
        break;
      case 'atan':
        res = Math.atan(currentNum);
        if (angleUnit === 'deg') res = (res * 180) / Math.PI;
        label = `atan(${currentNum})`;
        break;
      case 'sqrt':
        if (currentNum < 0) {
          setDisplayValue(t('calc.error_invalid', currentLang, 'Ungültige Eingabe'));
          return;
        }
        res = Math.sqrt(currentNum);
        label = `√(${currentNum})`;
        break;
      case 'cbrt':
        res = Math.cbrt(currentNum);
        label = `³√(${currentNum})`;
        break;
      case 'sqr':
        res = Math.pow(currentNum, 2);
        label = `(${currentNum})²`;
        break;
      case 'cube':
        res = Math.pow(currentNum, 3);
        label = `(${currentNum})³`;
        break;
      case 'reciprocal':
        if (currentNum === 0) {
          setDisplayValue(t('calc.error_div_zero', currentLang, 'Division durch 0'));
          return;
        }
        res = 1 / currentNum;
        label = `1/(${currentNum})`;
        break;
      case 'log':
        if (currentNum <= 0) {
          setDisplayValue(t('calc.error_invalid', currentLang, 'Ungültige Eingabe'));
          return;
        }
        res = Math.log10(currentNum);
        label = `log(${currentNum})`;
        break;
      case 'ln':
        if (currentNum <= 0) {
          setDisplayValue(t('calc.error_invalid', currentLang, 'Ungültige Eingabe'));
          return;
        }
        res = Math.log(currentNum);
        label = `ln(${currentNum})`;
        break;
      case 'exp10':
        res = Math.pow(10, currentNum);
        label = `10^(${currentNum})`;
        break;
      case 'expe':
        res = Math.exp(currentNum);
        label = `e^(${currentNum})`;
        break;
      case 'fact':
        if (currentNum < 0 || Math.floor(currentNum) !== currentNum || currentNum > 170) {
          setDisplayValue(t('calc.error_invalid', currentLang, 'Ungültige Eingabe'));
          return;
        }
        let f = 1;
        for (let i = 2; i <= currentNum; i++) f *= i;
        res = f;
        label = `${currentNum}!`;
        break;
      case 'abs':
        res = Math.abs(currentNum);
        label = `|${currentNum}|`;
        break;
      default:
        return;
    }

    const formatted = formatResult(res);
    setFormulaExpression(label);
    setDisplayValue(formatted);
    setWaitingForOperand(true);
    setLastEvaluated(true);

    const newItem: CalculationHistoryItem = {
      id: `calc_${Date.now()}`,
      expression: label,
      result: formatted,
      timestamp: Date.now()
    };
    setHistory(prev => [newItem, ...prev].slice(0, 50));
  }, [displayValue, angleUnit, formatResult, currentLang, playBeep]);

  // Insert constants
  const insertConstant = useCallback((constantName: 'pi' | 'e') => {
    playBeep();
    const val = constantName === 'pi' ? Math.PI : Math.E;
    setDisplayValue(val.toString());
    setWaitingForOperand(false);
    if (lastEvaluated) {
      setFormulaExpression('');
      setLastEvaluated(false);
    }
  }, [lastEvaluated, playBeep]);

  // Insert parenthesis
  const insertParenthesis = useCallback((paren: '(' | ')') => {
    playBeep();
    setFormulaExpression(prev => prev + paren + ' ');
    setWaitingForOperand(paren === '(');
  }, [playBeep]);

  // Memory operations
  const memoryClear = useCallback(() => {
    playBeep();
    setMemoryValue(0);
  }, [playBeep]);

  const memoryRecall = useCallback(() => {
    playBeep();
    setDisplayValue(formatResult(memoryValue));
    setWaitingForOperand(false);
  }, [memoryValue, formatResult, playBeep]);

  const memoryAdd = useCallback(() => {
    playBeep();
    const num = parseFloat(displayValue);
    if (!isNaN(num)) setMemoryValue(prev => prev + num);
  }, [displayValue, playBeep]);

  const memorySubtract = useCallback(() => {
    playBeep();
    const num = parseFloat(displayValue);
    if (!isNaN(num)) setMemoryValue(prev => prev - num);
  }, [displayValue, playBeep]);

  const memoryStore = useCallback(() => {
    playBeep();
    const num = parseFloat(displayValue);
    if (!isNaN(num)) setMemoryValue(num);
  }, [displayValue, playBeep]);

  // Copy result to clipboard
  const copyResult = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopiedToast(true);
      sounds.playSuccess();
      setTimeout(() => setCopiedToast(false), 2000);
    } catch {
      // ignore
    }
  }, [displayValue]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const { key } = e;
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        inputDigit(key);
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        inputDecimal();
      } else if (key === '+') {
        e.preventDefault();
        performOperation('+');
      } else if (key === '-') {
        e.preventDefault();
        performOperation('-');
      } else if (key === '*' || key === 'x') {
        e.preventDefault();
        performOperation('×');
      } else if (key === '/') {
        e.preventDefault();
        performOperation('÷');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        computeFinalResult();
      } else if (key === 'Backspace') {
        e.preventDefault();
        backspace();
      } else if (key === 'Escape') {
        e.preventDefault();
        clearAll();
      } else if (key === '(' || key === ')') {
        e.preventDefault();
        insertParenthesis(key as '(' | ')');
      } else if (key === '^') {
        e.preventDefault();
        performOperation('^');
      } else if (key === '%') {
        e.preventDefault();
        applyPercent();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputDigit, inputDecimal, performOperation, computeFinalResult, backspace, clearAll, insertParenthesis, applyPercent]);

  // Measure container dimensions for responsive fluid scaling (avoids viewport media query limitations)
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerDims, setContainerDims] = useState<{ width: number; height: number }>({ width: 420, height: 520 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerDims({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Check if calculator is dragged wide enough for ergonomic side-by-side scientific layout
  const isWideLayout = mode === 'scientific' && (containerDims.width >= 480 || !!isWideWindow);

  // Compute dynamic font size for large numbers in display
  const displayFontSize = useMemo(() => {
    const len = displayValue.length;
    if (containerDims.width < 360) {
      if (len <= 7) return 'text-xl';
      if (len <= 11) return 'text-lg';
      return 'text-base';
    }
    if (containerDims.width >= 750 || containerDims.height >= 650) {
      if (len <= 7) return 'text-5xl md:text-6xl';
      if (len <= 11) return 'text-4xl md:text-5xl';
      if (len <= 16) return 'text-3xl md:text-4xl';
      return 'text-2xl md:text-3xl';
    }
    if (len <= 7) return 'text-3xl md:text-4xl';
    if (len <= 11) return 'text-2xl md:text-3xl';
    if (len <= 16) return 'text-xl md:text-2xl';
    return 'text-lg md:text-xl';
  }, [displayValue, containerDims.width, containerDims.height]);

  // Dynamically scalable text sizes for scientific functions (2nd, sin, cos, tan, ln, log, etc.)
  const sciBtnTextSize = useMemo(() => {
    let colWidth: number;
    let rowHeight: number;

    if (isWideLayout) {
      colWidth = (containerDims.width * 0.55) / 5;
      rowHeight = Math.max(28, (containerDims.height - 140) / 3);
    } else {
      colWidth = containerDims.width / 5;
      rowHeight = Math.max(28, ((containerDims.height - 140) * 0.38) / 3);
    }

    const cellSize = Math.min(colWidth, rowHeight);

    if (cellSize >= 75) return 'text-2xl font-bold';
    if (cellSize >= 60) return 'text-xl font-bold';
    if (cellSize >= 48) return 'text-lg font-bold';
    if (cellSize >= 38) return 'text-base font-semibold';
    if (cellSize >= 30) return 'text-sm font-semibold';
    return 'text-xs font-semibold';
  }, [containerDims.width, containerDims.height, isWideLayout]);

  // Dynamically scalable text sizes for standard digits and basic arithmetic operators
  const numBtnTextSize = useMemo(() => {
    let colWidth: number;
    let rowHeight: number;

    if (mode === 'scientific') {
      if (isWideLayout) {
        colWidth = (containerDims.width * 0.45) / 4;
        rowHeight = Math.max(28, (containerDims.height - 140) / 5);
      } else {
        colWidth = containerDims.width / 4;
        rowHeight = Math.max(28, ((containerDims.height - 140) * 0.62) / 5);
      }
    } else {
      // Simple mode - 4 columns, 5 rows full height
      colWidth = containerDims.width / 4;
      rowHeight = Math.max(30, (containerDims.height - 140) / 5);
    }

    const cellSize = Math.min(colWidth, rowHeight);

    if (cellSize >= 85) return 'text-4xl font-black';
    if (cellSize >= 68) return 'text-3xl font-bold';
    if (cellSize >= 52) return 'text-2xl font-bold';
    if (cellSize >= 40) return 'text-xl font-bold';
    if (cellSize >= 32) return 'text-lg font-semibold';
    return 'text-base font-semibold';
  }, [containerDims.width, containerDims.height, mode, isWideLayout]);

  // Dynamically scalable icon sizing
  const actionIconSize = useMemo(() => {
    const minDim = Math.min(containerDims.width, containerDims.height);
    if (minDim >= 700) return 'w-7 h-7';
    if (minDim >= 520) return 'w-6 h-6';
    if (minDim >= 400) return 'w-5 h-5';
    return 'w-4 h-4';
  }, [containerDims.width, containerDims.height]);

  const renderScientificKeypad = (isWide: boolean) => (
    <div className={`grid grid-cols-5 [grid-template-rows:repeat(3,minmax(0,1fr))] gap-1 xs:gap-1.5 sm:gap-2 ${isWide ? 'flex-[5] min-h-0 h-full' : 'min-h-0 w-full overflow-hidden'}`}>
      <button
        onClick={() => {
          playBeep();
          setIsSecondFunction(prev => !prev);
        }}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl border transition-all flex items-center justify-center select-none active:scale-[0.96] font-semibold shadow-sm cursor-pointer ${
          isSecondFunction 
            ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-amber-500/20 shadow-md' 
            : 'bg-slate-900/90 hover:bg-slate-800 text-amber-300/90 border-slate-800/80 hover:border-slate-700/80'
        }`}
      >
        2nd
      </button>
      <button
        onClick={() => applyScientificUnary(isSecondFunction ? 'asin' : 'sin')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        {isSecondFunction ? 'sin⁻¹' : 'sin'}
      </button>
      <button
        onClick={() => applyScientificUnary(isSecondFunction ? 'acos' : 'cos')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        {isSecondFunction ? 'cos⁻¹' : 'cos'}
      </button>
      <button
        onClick={() => applyScientificUnary(isSecondFunction ? 'atan' : 'tan')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        {isSecondFunction ? 'tan⁻¹' : 'tan'}
      </button>
      <button
        onClick={() => applyScientificUnary(isSecondFunction ? 'expe' : 'ln')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        {isSecondFunction ? 'eˣ' : 'ln'}
      </button>

      <button
        onClick={() => applyScientificUnary(isSecondFunction ? 'exp10' : 'log')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        {isSecondFunction ? '10ˣ' : 'log'}
      </button>
      <button
        onClick={() => applyScientificUnary(isSecondFunction ? 'cbrt' : 'sqrt')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        {isSecondFunction ? '³√x' : '√x'}
      </button>
      <button
        onClick={() => applyScientificUnary(isSecondFunction ? 'cube' : 'sqr')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        {isSecondFunction ? 'x³' : 'x²'}
      </button>
      <button
        onClick={() => performOperation('^')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        xʸ
      </button>
      <button
        onClick={() => applyScientificUnary('reciprocal')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        1/x
      </button>

      <button
        onClick={() => insertParenthesis('(')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        (
      </button>
      <button
        onClick={() => insertParenthesis(')')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        )
      </button>
      <button
        onClick={() => insertConstant('pi')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        π
      </button>
      <button
        onClick={() => insertConstant('e')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        e
      </button>
      <button
        onClick={() => applyScientificUnary('fact')}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-750 text-slate-200 hover:text-white border border-slate-800/80 hover:border-slate-700/80 transition-all font-mono font-medium flex items-center justify-center select-none active:scale-[0.96] shadow-sm cursor-pointer`}
      >
        n!
      </button>
    </div>
  );

  const renderArithmeticKeypad = (isWide: boolean, isSimpleMode?: boolean) => (
    <div className={`grid grid-cols-4 [grid-template-rows:repeat(5,minmax(0,1fr))] gap-1 xs:gap-1.5 sm:gap-2 ${isSimpleMode ? 'flex-1 min-h-0 w-full' : isWide ? 'flex-[4] min-h-0 h-full' : 'flex-1 min-h-0 w-full overflow-hidden'}`}>
      <button
        onClick={clearAll}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/90 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-slate-700/50 hover:border-rose-800/50 font-semibold shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        AC
      </button>
      <button
        onClick={backspace}
        className={`w-full h-full min-h-0 ${sciBtnTextSize} rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
        title={t('calc.backspace', currentLang, 'Rücktaste (Backspace)')}
      >
        <Delete className={actionIconSize} />
      </button>
      <button
        onClick={applyPercent}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        %
      </button>
      <button
        onClick={() => performOperation('÷')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 font-bold border border-slate-700/60 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        ÷
      </button>

      <button
        onClick={() => inputDigit('7')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        7
      </button>
      <button
        onClick={() => inputDigit('8')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        8
      </button>
      <button
        onClick={() => inputDigit('9')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        9
      </button>
      <button
        onClick={() => performOperation('×')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 font-bold border border-slate-700/60 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        ×
      </button>

      <button
        onClick={() => inputDigit('4')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        4
      </button>
      <button
        onClick={() => inputDigit('5')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        5
      </button>
      <button
        onClick={() => inputDigit('6')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        6
      </button>
      <button
        onClick={() => performOperation('-')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 font-bold border border-slate-700/60 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        −
      </button>

      <button
        onClick={() => inputDigit('1')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        1
      </button>
      <button
        onClick={() => inputDigit('2')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        2
      </button>
      <button
        onClick={() => inputDigit('3')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        3
      </button>
      <button
        onClick={() => performOperation('+')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 font-bold border border-slate-700/60 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        +
      </button>

      <button
        onClick={toggleSign}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-slate-300 hover:text-white border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        ±
      </button>
      <button
        onClick={() => inputDigit('0')}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        0
      </button>
      <button
        onClick={inputDecimal}
        className={`w-full h-full min-h-0 ${numBtnTextSize} rounded-xl bg-slate-800/80 hover:bg-slate-700 active:bg-slate-650 text-white font-semibold border border-slate-700/50 shadow-sm transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        .
      </button>
      <button
        onClick={computeFinalResult}
        className={`w-full h-full min-h-0 ${numBtnTextSize} font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-md shadow-emerald-950/50 border border-emerald-500/40 transition-all flex items-center justify-center active:scale-[0.96] select-none cursor-pointer`}
      >
        =
      </button>
    </div>
  );

  return (
    <div ref={containerRef} className="flex flex-col h-full w-full bg-slate-950 text-slate-100 select-none overflow-hidden relative font-sans">
      {/* Top Header / App Toolbar (Unified, sleek, no duplicate window titles) */}
      <div className="flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md z-20 flex-shrink-0">
        {/* Mode Dropdown Selector */}
        <div className="relative" ref={modeMenuRef}>
          <button
            onClick={() => {
              playBeep();
              setIsModeMenuOpen(prev => !prev);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700/60 transition-colors cursor-pointer"
          >
            {mode === 'scientific' ? (
              <FlaskConical className="w-4 h-4 text-cyan-400" />
            ) : (
              <Calculator className="w-4 h-4 text-emerald-400" />
            )}
            <span className="font-semibold text-xs sm:text-sm">
              {mode === 'scientific' 
                ? t('calc.mode_scientific', currentLang, 'Wissenschaftlich') 
                : t('calc.mode_simple', currentLang, 'Standard')}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Mode Dropdown Popover */}
          {isModeMenuOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-56 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-40 p-1.5 animate-in fade-in slide-in-from-top-2">
              <button
                onClick={() => {
                  setMode('simple');
                  setIsModeMenuOpen(false);
                  playBeep();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors cursor-pointer ${
                  mode === 'simple'
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Calculator className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold">{t('calc.mode_simple', currentLang, 'Standard')}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t('calc.mode_simple_desc', currentLang, 'Grundrechenarten & Alltag')}</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setMode('scientific');
                  setIsModeMenuOpen(false);
                  playBeep();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-medium transition-colors mt-1 cursor-pointer ${
                  mode === 'scientific'
                    ? 'bg-cyan-600/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FlaskConical className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <div>
                  <div className="font-semibold">{t('calc.mode_scientific', currentLang, 'Wissenschaftlich')}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{t('calc.mode_scientific_desc', currentLang, 'Trigonometrie, Potenzen, Wurzeln')}</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Scientific Quick Angle Pill */}
          {mode === 'scientific' && (
            <button
              onClick={() => {
                playBeep();
                setAngleUnit(prev => (prev === 'deg' ? 'rad' : 'deg'));
              }}
              className="px-2 py-1 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700/80 transition-colors cursor-pointer"
              title={t('calc.angle_toggle_tooltip', currentLang, 'Gradmaß / Bogenmaß umschalten')}
            >
              {angleUnit.toUpperCase()}
            </button>
          )}

          {/* Scientific Wide / Side-by-Side Toggle Button */}
          {mode === 'scientific' && onToggleWideWindow && (
            <button
              onClick={() => {
                playBeep();
                onToggleWideWindow();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={isWideLayout ? 'Kompakt-Ansicht (360px)' : 'Breite Ansicht (Nebeneinander - 620px)'}
            >
              {isWideLayout ? <LayoutGrid className="w-4 h-4 text-cyan-400" /> : <Columns className="w-4 h-4" />}
            </button>
          )}

          {/* History Button */}
          <button
            onClick={() => {
              playBeep();
              setIsHistoryOpen(prev => !prev);
              if (isSettingsOpen) setIsSettingsOpen(false);
            }}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ${isHistoryOpen ? 'bg-slate-800 text-emerald-400' : ''}`}
            title={t('calc.history_title', currentLang, 'Rechenverlauf')}
          >
            <History className="w-4 h-4" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(prev => !prev);
              if (!soundEnabled) sounds.playClick();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={soundEnabled && !sounds.isMuted() ? t('calc.mute_sound', currentLang, 'Ton stummschalten') : t('calc.unmute_sound', currentLang, 'Ton aktivieren')}
          >
            {soundEnabled && !sounds.isMuted() ? (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {/* Settings Button */}
          <button
            id="calc-settings-button"
            onClick={() => {
              playBeep();
              setIsSettingsOpen(prev => !prev);
              if (isHistoryOpen) setIsHistoryOpen(false);
            }}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ${isSettingsOpen ? 'bg-slate-800 text-emerald-400 rotate-45' : ''}`}
            title={t('calc.settings_title', currentLang, 'Einstellungen & Modus')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Calculator Workspace - dynamically stretches and shrinks with window resizing */}
      <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 justify-between w-full h-full gap-1.5 sm:gap-2">
        {/* Display Glass Card */}
        <div className="w-full bg-slate-900/90 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 border border-slate-800/80 shadow-inner flex flex-col justify-end flex-shrink-0 relative group">
          {/* Memory indicator & Copy button */}
          <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5 min-h-[20px]">
            <div className="flex items-center gap-1.5">
              {memoryValue !== 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                  M = {formatResult(memoryValue)}
                </span>
              )}
            </div>

            {/* Copy Button */}
            <button
              onClick={copyResult}
              className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded hover:bg-slate-800/80 transition-colors opacity-80 group-hover:opacity-100 cursor-pointer"
              title={t('calc.copy_result', currentLang, 'Ergebnis in Zwischenablage kopieren')}
            >
              {copiedToast ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">{t('calc.copied', currentLang, 'Kopiert!')}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span className="hidden xs:inline">{t('calc.copy_result', currentLang, 'Kopieren')}</span>
                </>
              )}
            </button>
          </div>

          {/* Formula Line */}
          <div className="h-5 text-right text-xs sm:text-sm text-slate-400 font-mono overflow-x-auto whitespace-nowrap scrollbar-none tracking-wide">
            {formulaExpression || '\u00A0'}
          </div>

          {/* Result / Input Line with dynamic fluid sizing */}
          <div className={`text-right font-mono font-bold text-white tracking-tight overflow-x-auto whitespace-nowrap scrollbar-none transition-all py-0.5 ${displayFontSize}`}>
            {displayValue}
          </div>
        </div>

        {/* Memory Bar - sleek minimal text buttons like Windows 11 */}
        <div className="flex items-center justify-between px-1 py-0.5 flex-shrink-0">
          <button
            onClick={memoryClear}
            disabled={memoryValue === 0}
            className="px-2.5 py-1 text-xs font-semibold rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400 transition-colors select-none cursor-pointer disabled:cursor-not-allowed"
          >
            MC
          </button>
          <button
            onClick={memoryRecall}
            disabled={memoryValue === 0}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors select-none cursor-pointer disabled:cursor-not-allowed ${
              memoryValue !== 0 
                ? 'text-amber-400 font-bold hover:bg-amber-500/10' 
                : 'text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-400'
            }`}
          >
            MR
          </button>
          <button
            onClick={memoryAdd}
            className="px-2.5 py-1 text-xs font-semibold rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors select-none cursor-pointer"
          >
            M+
          </button>
          <button
            onClick={memorySubtract}
            className="px-2.5 py-1 text-xs font-semibold rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors select-none cursor-pointer"
          >
            M-
          </button>
          <button
            onClick={memoryStore}
            className="px-2.5 py-1 text-xs font-semibold rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors select-none cursor-pointer"
          >
            MS
          </button>
        </div>

        {/* Keypad Layout */}
        {mode === 'scientific' ? (
          isWideLayout ? (
            /* Wide Screen Scientific Mode (Side-by-Side: Scientific on Left, Arithmetic on Right) */
            <div className="flex-1 min-h-0 flex flex-row gap-2 w-full">
              <div className="flex-[5] min-h-0 h-full bg-slate-900/40 p-1.5 rounded-2xl border border-slate-800/60 shadow-inner flex flex-col">
                {renderScientificKeypad(true)}
              </div>
              <div className="flex-[4] min-h-0 h-full flex flex-col">
                {renderArithmeticKeypad(true, false)}
              </div>
            </div>
          ) : (
            /* Compact Scientific Mode (Function Tray on Top, Numeric Keypad on Bottom) */
            <div className="flex-1 min-h-0 flex flex-col gap-1.5 w-full">
              <div className="flex-[3] min-h-0 w-full bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/70 shadow-inner flex flex-col">
                {renderScientificKeypad(false)}
              </div>
              <div className="flex-[5] min-h-0 w-full flex flex-col">
                {renderArithmeticKeypad(false, false)}
              </div>
            </div>
          )
        ) : (
          /* Simple Standard Keypad (Full Height) */
          <div className="flex-1 min-h-0 flex flex-col gap-1 xs:gap-1.5 sm:gap-2 w-full">
            {renderArithmeticKeypad(false, true)}
          </div>
        )}
      </div>

      {/* Settings Modal / Overlay */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md z-30 flex flex-col p-5 overflow-y-auto animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-base text-white">
                {t('calc.settings_title', currentLang, 'Rechner-Einstellungen')}
              </h3>
            </div>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-6 flex-1">
            {/* 1. Modus-Wahl (Einfach vs. Wissenschaftlich) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                {t('calc.settings_mode_label', currentLang, 'Rechnermodus')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Simple Mode Card */}
                <button
                  onClick={() => {
                    setMode('simple');
                    sounds.playClick();
                  }}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${mode === 'simple' ? 'bg-emerald-950/30 border-emerald-500 text-white shadow-md' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-sm text-white">
                      {t('calc.mode_simple', currentLang, 'Einfach / Standard')}
                    </span>
                    {mode === 'simple' && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t('calc.mode_simple_desc', currentLang, 'Grundrechenarten (+, −, ×, ÷), Prozentrechnung und Vorzeichen. Ideal für den schnellen Alltag.')}
                  </p>
                </button>

                {/* Scientific Mode Card */}
                <button
                  onClick={() => {
                    setMode('scientific');
                    sounds.playClick();
                  }}
                  className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${mode === 'scientific' ? 'bg-emerald-950/30 border-emerald-500 text-white shadow-md' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-sm text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      {t('calc.mode_scientific', currentLang, 'Wissenschaftlich (Schule)')}
                    </span>
                    {mode === 'scientific' && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {t('calc.mode_scientific_desc', currentLang, 'Trigonometrie (sin/cos/tan), Logarithmen, Potenzen, Wurzeln, Fakultäten und Klammern für Schule & Studium.')}
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Winkeleinheit (DEG vs. RAD) */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                {t('calc.angle_unit', currentLang, 'Winkeleinheit (Trigonometrie)')}
              </label>
              <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                <button
                  onClick={() => {
                    setAngleUnit('deg');
                    sounds.playClick();
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${angleUnit === 'deg' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  {t('calc.deg', currentLang, 'Gradmaß (DEG - 360°)')}
                </button>
                <button
                  onClick={() => {
                    setAngleUnit('rad');
                    sounds.playClick();
                  }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${angleUnit === 'rad' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                >
                  {t('calc.rad', currentLang, 'Bogenmaß (RAD - 2π)')}
                </button>
              </div>
            </div>

            {/* 3. Nachkommastellen / Präzision */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                {t('calc.decimal_places', currentLang, 'Rundung & Nachkommastellen')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { val: -1, label: t('calc.auto_decimals', currentLang, 'Auto') },
                  { val: 2, label: t('calc.places_2', currentLang, '2 Stellen') },
                  { val: 4, label: t('calc.places_4', currentLang, '4 Stellen') },
                  { val: 6, label: t('calc.places_6', currentLang, '6 Stellen') }
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => {
                      setPrecision(opt.val);
                      sounds.playClick();
                    }}
                    className={`py-2 text-xs font-bold rounded-xl border transition-colors ${precision === opt.val ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Immer im Vordergrund (Overlay - Windows Style) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="pr-2">
                <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                  <Pin className={`w-4 h-4 ${isAlwaysOnTop ? 'rotate-45 text-emerald-400' : 'text-slate-400'}`} />
                  {t('calc.always_on_top', currentLang, 'Immer im Vordergrund (Overlay)')}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {t('calc.always_on_top_desc', currentLang, 'Hält den Rechner über allen anderen Fenstern geöffnet, genau wie in Windows.')}
                </div>
              </div>
              {onToggleAlwaysOnTop && (
                <button
                  onClick={() => {
                    playBeep();
                    onToggleAlwaysOnTop();
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${isAlwaysOnTop ? 'bg-emerald-600' : 'bg-slate-700'}`}
                  title={isAlwaysOnTop ? t('calc.unpin_overlay', currentLang, 'Overlay lösen') : t('calc.pin_overlay', currentLang, 'Overlay anheften')}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isAlwaysOnTop ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              )}
            </div>

            {/* 5. Tastentöne Toggle (Respects system sound setting) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="pr-2">
                <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                  {soundEnabled && !sounds.isMuted() ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                  {t('calc.sound_feedback', currentLang, 'Tastentöne & Klicks')}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {t('calc.sound_system_hint', currentLang, 'Folgt standardmäßig den Audio-Einstellungen (Einstellungen -> Töne & Feedback)')}
                </div>
                <div className="text-[11px] mt-1">
                  {sounds.isMuted() ? (
                    <span className="text-amber-400 font-medium">⚠️ {t('calc.sound_muted_system', currentLang, 'Haupteinstellung: Töne im System stummgeschaltet')}</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">✓ {t('calc.sound_active_system', currentLang, 'Haupteinstellung: Töne im System aktiv')}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setSoundEnabled(prev => !prev);
                  if (!soundEnabled) sounds.playClick();
                }}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 flex-shrink-0 ${soundEnabled ? 'bg-emerald-600' : 'bg-slate-700'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* 6. Tastatur-Tipps */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
              <div className="font-bold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-emerald-400" />
                {t('calc.keyboard_guide_title', currentLang, 'Tastatur-Unterstützung (Schule & Arbeitsplatz)')}
              </div>
              <p>{t('calc.keyboard_guide_desc', currentLang, 'Zahlenblock 0-9, Rechenzeichen + - * /, Ergebnis mit Enter oder =, Löschen mit Esc und Korrektur mit Backspace.')}</p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => {
                sounds.playClick();
                setIsSettingsOpen(false);
              }}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-md transition-colors"
            >
              {t('calc.done', currentLang, 'Fertig')}
            </button>
          </div>
        </div>
      )}

      {/* History Drawer / Overlay */}
      {isHistoryOpen && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-30 flex flex-col p-5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-base text-white">
                {t('calc.history_title', currentLang, 'Rechenverlauf')}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {history.length > 0 && (
                <button
                  onClick={() => {
                    sounds.playDelete();
                    setHistory([]);
                  }}
                  className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-950/40 border border-rose-800/40"
                  title={t('calc.history_clear', currentLang, 'Verlauf leeren')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('calc.history_clear', currentLang, 'Leeren')}</span>
                </button>
              )}
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs py-8">
                <History className="w-8 h-8 mb-2 opacity-40" />
                <p>{t('calc.history_empty', currentLang, 'Noch keine Rechnungen vorhanden.')}</p>
                <p className="text-[11px] text-slate-600 mt-1">{t('calc.history_desc', currentLang, 'Ausgeführte Rechnungen werden hier für Hausaufgaben & Nachvollziehbarkeit archiviert.')}</p>
              </div>
            ) : (
              history.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    sounds.playClick();
                    setDisplayValue(item.result);
                    setFormulaExpression(item.expression + ' =');
                    setWaitingForOperand(true);
                    setLastEvaluated(true);
                    setIsHistoryOpen(false);
                  }}
                  className="w-full text-right p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 transition-all flex flex-col items-end group"
                >
                  <span className="text-xs text-slate-400 font-mono group-hover:text-slate-300">
                    {item.expression}
                  </span>
                  <span className="text-lg font-mono font-bold text-emerald-400 group-hover:text-emerald-300">
                    = {item.result}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
