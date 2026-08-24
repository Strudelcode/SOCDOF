import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  CheckCircle2, 
  Send, 
  Server, 
  FileText, 
  ShieldCheck, 
  X,
  Sparkles,
  Terminal
} from 'lucide-react';
import { Invoice } from '../types';
import { sounds } from '../lib/sound';

interface FakeSmtpModalProps {
  invoice: Invoice;
  onSuccess: () => void;
  onClose: () => void;
}

export const FakeSmtpModal: React.FC<FakeSmtpModalProps> = ({
  invoice,
  onSuccess,
  onClose
}) => {
  const [step, setStep] = useState<number>(0);
  const [progress, setProgress] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  const recipientEmail = invoice.contact_email || 'kunde@example.com';

  useEffect(() => {
    // Step-by-step fake SMTP handshake
    const timeline = [
      {
        delay: 200,
        action: () => {
          setStep(1);
          setProgress(25);
          setLogs(prev => [...prev, `[SMTP] Verbinde mit mail.local-odoo.internal:587...`]);
        }
      },
      {
        delay: 700,
        action: () => {
          setStep(2);
          setProgress(50);
          setLogs(prev => [
            ...prev,
            `220 smtp.local-odoo.internal ESMTP Service ready`,
            `EHLO client.local.network`,
            `250-SIZE 35882577`,
            `250 OK`
          ]);
        }
      },
      {
        delay: 1300,
        action: () => {
          setStep(3);
          setProgress(75);
          setLogs(prev => [
            ...prev,
            `MAIL FROM:<rechnungen@nexus-tech.example>`,
            `RCPT TO:<${recipientEmail}>`,
            `250 2.1.5 Recipient OK`,
            `DATA -> Render PDF (${invoice.number}.pdf, DIN-A4)...`
          ]);
        }
      },
      {
        delay: 2000,
        action: () => {
          setStep(4);
          setProgress(100);
          setIsCompleted(true);
          setLogs(prev => [
            ...prev,
            `250 2.0.0 Message accepted for delivery. Queue ID: ${Math.random().toString(36).substring(7).toUpperCase()}`,
            `[Fake-SMTP] E-Mail erfolgreich zugestellt (0,00 € Kosten).`
          ]);
          sounds.playSend();
        }
      }
    ];

    const timeouts = timeline.map(t => setTimeout(t.action, t.delay));

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [recipientEmail, invoice.number]);

  const handleFinish = () => {
    sounds.playSuccess();
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Per E-Mail senden (Fake-SMTP)
              </h3>
              <p className="text-[11px] text-slate-400">Lokale, kostenlose Simulation</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Status badge */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-white">
                Rechnung {invoice.number}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Empfänger: <span className="font-mono text-indigo-600 dark:text-indigo-400">{recipientEmail}</span>
              </div>
            </div>

            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
              0 Cent Kosten
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-slate-300">
                {isCompleted ? 'E-Mail erfolgreich versendet!' : `Sende E-Mail an ${recipientEmail}...`}
              </span>
              <span className="font-mono text-indigo-600 dark:text-indigo-400">{progress}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Terminal SMTP Log simulation */}
          <div className="bg-slate-950 text-emerald-400 rounded-xl p-3.5 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto border border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] border-b border-slate-800 pb-1 mb-1">
              <Terminal className="w-3 h-3" />
              <span>SMTP Connection Stream</span>
            </div>
            {logs.map((log, idx) => (
              <div key={idx} className="leading-tight break-all">
                {log}
              </div>
            ))}
          </div>

          {/* Success Box when done */}
          {isCompleted && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl flex items-center gap-3 animate-fade-in">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div className="text-xs text-emerald-900 dark:text-emerald-200">
                <div className="font-bold">Zustellung simuliert und im System vermerkt.</div>
                <div className="text-[11px] text-emerald-700/90 dark:text-emerald-300/80">
                  Status wurde auf &quot;Versendet&quot; aktualisiert.
                </div>
              </div>
            </div>
          )}

          {/* Action button */}
          <div className="flex justify-end pt-2">
            {isCompleted ? (
              <button
                onClick={handleFinish}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/30 transition"
              >
                Fertig & Schließen
              </button>
            ) : (
              <button
                disabled
                className="w-full py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed"
              >
                Wird übertragen...
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
