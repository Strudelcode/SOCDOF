import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calculator as CalcIcon,
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
  Pin
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
}

export const CalculatorModule: React.FC<CalculatorModuleProps> = ({
  isAlwaysOnTop = false,
  onToggleAlwaysOnTop,
  isSystemMuted,
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
  const [copiedToast, setCopiedToast] = useState(false);
  const [isSecondFunction, setIsSecondFunction] = useState(false);

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

  // Compute dynamic font size for large numbers
  const displayFontSize = useMemo(() => {
    const len = displayValue.length;
    if (len <= 7) return 'text-2xl sm:text-4xl md:text-5xl';
    if (len <= 11) return 'text-xl sm:text-3xl md:text-4xl';
    if (len <= 16) return 'text-lg sm:text-2xl md:text-3xl';
    return 'text-base sm:text-xl md:text-2xl';
  }, [displayValue]);

  return (
    <div className="flex flex-col h-full w-full bg-slate-950 text-slate-100 select-none overflow-hidden relative font-sans">
      {/* Top Header / App Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-md z-10 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shadow-sm flex-shrink-0">
            <CalcIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="font-semibold text-xs sm:text-sm tracking-tight text-white truncate">
              {t('module.calculator', currentLang, 'Taschenrechner')}
            </span>
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60 truncate">
              {mode === 'scientific' 
                ? t('calc.mode_scientific', currentLang, 'Wissenschaftlich') 
                : t('calc.mode_simple', currentLang, 'Einfach')}
            </span>
          </div>
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
              className="px-1.5 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/80 transition-colors"
              title="Gradmaß / Bogenmaß umschalten"
            >
              {angleUnit.toUpperCase()}
            </button>
          )}

          {/* Always on Top / Overlay Button (Windows Style) */}
          {onToggleAlwaysOnTop && (
            <button
              onClick={() => {
                playBeep();
                onToggleAlwaysOnTop();
              }}
              className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                isAlwaysOnTop 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 ring-1 ring-emerald-500/30' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title={isAlwaysOnTop ? 'Immer im Vordergrund lösen' : 'Immer im Vordergrund halten (Overlay)'}
            >
              <Pin className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform ${isAlwaysOnTop ? 'rotate-45 text-emerald-400' : ''}`} />
              <span className="text-[10px] font-bold hidden xs:inline">
                {isAlwaysOnTop ? 'Overlay' : 'Overlay'}
              </span>
            </button>
          )}

          {/* History Button */}
          <button
            onClick={() => {
              playBeep();
              setIsHistoryOpen(prev => !prev);
              if (isSettingsOpen) setIsSettingsOpen(false);
            }}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${isHistoryOpen ? 'bg-slate-800 text-emerald-400' : ''}`}
            title={t('calc.history_title', currentLang, 'Rechenverlauf')}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(prev => !prev);
              if (!soundEnabled) sounds.playClick();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={soundEnabled ? 'Ton stummschalten' : 'Ton aktivieren'}
          >
            {soundEnabled && !sounds.isMuted() ? (
              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
            )}
          </button>

          {/* Settings Button (Required by prompt: "wo es ein Settings zeichen gibt") */}
          <button
            id="calc-settings-button"
            onClick={() => {
              playBeep();
              setIsSettingsOpen(prev => !prev);
              if (isHistoryOpen) setIsHistoryOpen(false);
            }}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ${isSettingsOpen ? 'bg-slate-800 text-emerald-400 rotate-45' : ''}`}
            title={t('calc.settings_title', currentLang, 'Einstellungen & Modus')}
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* Main Calculator Workspace - dynamically stretches and shrinks with window resizing */}
      <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 justify-between w-full h-full gap-1 sm:gap-1.5">
        {/* Display Glass Card */}
        <div className="w-full bg-slate-900/90 rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-4 sm:py-2.5 border border-slate-800 shadow-inner flex flex-col justify-end flex-shrink-0 relative group">
          {/* Memory & Angle indicator tags */}
          <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
            <div className="flex items-center gap-1.5">
              {memoryValue !== 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono text-[9px] sm:text-[10px] font-bold border border-amber-500/30">
                  M = {formatResult(memoryValue)}
                </span>
              )}
              {mode === 'scientific' && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] sm:text-[10px] font-bold">
                  {angleUnit.toUpperCase()}
                </span>
              )}
            </div>

            {/* Copy Button */}
            <button
              onClick={copyResult}
              className="flex items-center gap-1 text-[10px] sm:text-[11px] text-slate-400 hover:text-white px-1.5 sm:px-2 py-0.5 rounded hover:bg-slate-800/80 transition-colors opacity-80 group-hover:opacity-100"
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
          <div className="h-4 sm:h-5 text-right text-xs sm:text-sm text-slate-400 font-mono overflow-x-auto whitespace-nowrap scrollbar-none tracking-wide">
            {formulaExpression || '\u00A0'}
          </div>

          {/* Result / Input Line with dynamic fluid sizing */}
          <div className={`text-right font-mono font-bold text-white tracking-tight overflow-x-auto whitespace-nowrap scrollbar-none transition-all py-0.5 ${displayFontSize}`}>
            {displayValue}
          </div>
        </div>

        {/* Memory Bar */}
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5 flex-shrink-0">
          <button
            onClick={memoryClear}
            disabled={memoryValue === 0}
            className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-slate-300 border border-slate-800/60 transition-colors flex items-center justify-center"
          >
            MC
          </button>
          <button
            onClick={memoryRecall}
            disabled={memoryValue === 0}
            className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 text-slate-300 border border-slate-800/60 transition-colors flex items-center justify-center"
          >
            MR
          </button>
          <button
            onClick={memoryAdd}
            className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800/60 transition-colors flex items-center justify-center"
          >
            M+
          </button>
          <button
            onClick={memorySubtract}
            className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800/60 transition-colors flex items-center justify-center"
          >
            M-
          </button>
          <button
            onClick={memoryStore}
            className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800/60 transition-colors flex items-center justify-center"
          >
            MS
          </button>
        </div>

        {/* Keypad Layout */}
        {mode === 'scientific' ? (
          /* SCIENTIFIC MODE KEYPAD */
          <div className="flex-1 min-h-0 flex flex-col gap-1 sm:gap-1.5 w-full">
            {/* Scientific Function Grid (5 cols) */}
            <div className="grid grid-cols-5 gap-1 sm:gap-1.5 flex-shrink-0">
              <button
                onClick={() => setIsSecondFunction(prev => !prev)}
                className={`h-6 sm:h-7 text-[10px] sm:text-xs font-bold rounded-lg border transition-all flex items-center justify-center ${isSecondFunction ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-sm' : 'bg-slate-800/80 hover:bg-slate-700 text-amber-300 border-slate-700/70'}`}
              >
                2nd
              </button>
              <button
                onClick={() => applyScientificUnary(isSecondFunction ? 'asin' : 'sin')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                {isSecondFunction ? 'sin⁻¹' : 'sin'}
              </button>
              <button
                onClick={() => applyScientificUnary(isSecondFunction ? 'acos' : 'cos')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                {isSecondFunction ? 'cos⁻¹' : 'cos'}
              </button>
              <button
                onClick={() => applyScientificUnary(isSecondFunction ? 'atan' : 'tan')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                {isSecondFunction ? 'tan⁻¹' : 'tan'}
              </button>
              <button
                onClick={() => applyScientificUnary(isSecondFunction ? 'expe' : 'ln')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                {isSecondFunction ? 'eˣ' : 'ln'}
              </button>

              <button
                onClick={() => applyScientificUnary(isSecondFunction ? 'exp10' : 'log')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                {isSecondFunction ? '10ˣ' : 'log'}
              </button>
              <button
                onClick={() => applyScientificUnary(isSecondFunction ? 'cbrt' : 'sqrt')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                {isSecondFunction ? '³√x' : '√x'}
              </button>
              <button
                onClick={() => applyScientificUnary(isSecondFunction ? 'cube' : 'sqr')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                {isSecondFunction ? 'x³' : 'x²'}
              </button>
              <button
                onClick={() => performOperation('^')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                xʸ
              </button>
              <button
                onClick={() => applyScientificUnary('reciprocal')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                1/x
              </button>

              <button
                onClick={() => insertParenthesis('(')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-violet-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                (
              </button>
              <button
                onClick={() => insertParenthesis(')')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-violet-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                )
              </button>
              <button
                onClick={() => insertConstant('pi')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-violet-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                π
              </button>
              <button
                onClick={() => insertConstant('e')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-violet-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                e
              </button>
              <button
                onClick={() => applyScientificUnary('fact')}
                className="h-6 sm:h-7 text-[10px] sm:text-xs font-semibold rounded-lg bg-slate-800/80 hover:bg-slate-700 text-violet-300 border border-slate-700/70 transition-colors font-mono flex items-center justify-center"
              >
                n!
              </button>
            </div>

            {/* Arithmetic & Number Grid (4 cols, 5 rows) - expands proportionally */}
            <div className="grid grid-cols-4 grid-rows-5 gap-1 xs:gap-1.5 sm:gap-2 flex-1 min-h-0 w-full">
              <button
                onClick={clearAll}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                AC
              </button>
              <button
                onClick={backspace}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={applyPercent}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                %
              </button>
              <button
                onClick={() => performOperation('÷')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-base sm:text-lg font-bold rounded-lg sm:rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                ÷
              </button>

              <button
                onClick={() => inputDigit('7')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                7
              </button>
              <button
                onClick={() => inputDigit('8')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                8
              </button>
              <button
                onClick={() => inputDigit('9')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                9
              </button>
              <button
                onClick={() => performOperation('×')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-base sm:text-lg font-bold rounded-lg sm:rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                ×
              </button>

              <button
                onClick={() => inputDigit('4')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                4
              </button>
              <button
                onClick={() => inputDigit('5')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                5
              </button>
              <button
                onClick={() => inputDigit('6')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                6
              </button>
              <button
                onClick={() => performOperation('-')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-base sm:text-lg font-bold rounded-lg sm:rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                −
              </button>

              <button
                onClick={() => inputDigit('1')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                1
              </button>
              <button
                onClick={() => inputDigit('2')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                2
              </button>
              <button
                onClick={() => inputDigit('3')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                3
              </button>
              <button
                onClick={() => performOperation('+')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-base sm:text-lg font-bold rounded-lg sm:rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                +
              </button>

              <button
                onClick={toggleSign}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                ±
              </button>
              <button
                onClick={() => inputDigit('0')}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                0
              </button>
              <button
                onClick={inputDecimal}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-sm sm:text-base md:text-lg font-bold rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
              >
                .
              </button>
              <button
                onClick={computeFinalResult}
                className="w-full h-full min-h-[26px] sm:min-h-[30px] text-base sm:text-lg md:text-xl font-black rounded-lg sm:rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition-all flex items-center justify-center active:scale-[0.96]"
              >
                =
              </button>
            </div>
          </div>
        ) : (
          /* SIMPLE STANDARD KEYPAD (4 cols, 5 rows) - stretches and shrinks smoothly */
          <div className="grid grid-cols-4 grid-rows-5 gap-1 xs:gap-1.5 sm:gap-2 flex-1 min-h-0 w-full">
            <button
              onClick={clearAll}
              className="w-full h-full min-h-[30px] text-sm sm:text-base md:text-lg font-bold rounded-xl sm:rounded-2xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              AC
            </button>
            <button
              onClick={backspace}
              className="w-full h-full min-h-[30px] text-sm sm:text-base font-semibold rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors flex items-center justify-center active:scale-[0.96]"
              title="Rücktaste (Backspace)"
            >
              <Delete className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <button
              onClick={applyPercent}
              className="w-full h-full min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              %
            </button>
            <button
              onClick={() => performOperation('÷')}
              className="w-full h-full min-h-[30px] text-lg sm:text-xl md:text-2xl font-bold rounded-xl sm:rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              ÷
            </button>

            <button
              onClick={() => inputDigit('7')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              7
            </button>
            <button
              onClick={() => inputDigit('8')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              8
            </button>
            <button
              onClick={() => inputDigit('9')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              9
            </button>
            <button
              onClick={() => performOperation('×')}
              className="w-full h-full min-h-[30px] text-lg sm:text-xl md:text-2xl font-bold rounded-xl sm:rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              ×
            </button>

            <button
              onClick={() => inputDigit('4')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              4
            </button>
            <button
              onClick={() => inputDigit('5')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              5
            </button>
            <button
              onClick={() => inputDigit('6')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              6
            </button>
            <button
              onClick={() => performOperation('-')}
              className="w-full h-full min-h-[30px] text-lg sm:text-xl md:text-2xl font-bold rounded-xl sm:rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              −
            </button>

            <button
              onClick={() => inputDigit('1')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              1
            </button>
            <button
              onClick={() => inputDigit('2')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              2
            </button>
            <button
              onClick={() => inputDigit('3')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              3
            </button>
            <button
              onClick={() => performOperation('+')}
              className="w-full h-full min-h-[30px] text-lg sm:text-xl md:text-2xl font-bold rounded-xl sm:rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              +
            </button>

            <button
              onClick={toggleSign}
              className="w-full h-full min-h-[30px] text-sm sm:text-base md:text-lg font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              ±
            </button>
            <button
              onClick={() => inputDigit('0')}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-semibold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              0
            </button>
            <button
              onClick={inputDecimal}
              className="w-full h-full min-h-[30px] text-base sm:text-xl md:text-2xl font-bold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 transition-colors flex items-center justify-center active:scale-[0.96]"
            >
              .
            </button>
            <button
              onClick={computeFinalResult}
              className="w-full h-full min-h-[30px] text-xl sm:text-2xl md:text-3xl font-black rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition-all flex items-center justify-center active:scale-[0.96]"
            >
              =
            </button>
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
                    Grundrechenarten (+, −, ×, ÷), Prozentrechnung und Vorzeichen. Ideal für den schnellen Alltag.
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
                    Trigonometrie (sin/cos/tan), Logarithmen, Potenzen, Wurzeln, Fakultäten und Klammern für Schule & Studium.
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
                  { val: 2, label: '2 Stellen' },
                  { val: 4, label: '4 Stellen' },
                  { val: 6, label: '6 Stellen' }
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
                  title={isAlwaysOnTop ? 'Overlay lösen' : 'Overlay anheften'}
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
                    <span className="text-amber-400 font-medium">⚠️ Haupteinstellung: Töne im System stummgeschaltet</span>
                  ) : (
                    <span className="text-emerald-400 font-medium">✓ Haupteinstellung: Töne im System aktiv</span>
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
                Tastatur-Unterstützung (Schule & Arbeitsplatz)
              </div>
              <p>Zahlenblock <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">0-9</kbd>, Rechenzeichen <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">+ - * /</kbd>, Ergebnis mit <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">Enter</kbd> oder <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">=</kbd>, Löschen mit <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">Esc</kbd> und Korrektur mit <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono">Backspace</kbd>.</p>
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
              Fertig
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
                <p className="text-[11px] text-slate-600 mt-1">Ausgeführte Rechnungen werden hier für Hausaufgaben & Nachvollziehbarkeit archiviert.</p>
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
