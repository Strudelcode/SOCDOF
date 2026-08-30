import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Printer, 
  Download, 
  QrCode, 
  Tag, 
  Check, 
  Copy, 
  Sparkles,
  ExternalLink 
} from 'lucide-react';
import { Product } from '../types';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';

interface ProductLabelModalProps {
  product: Product;
  currency: string;
  onClose: () => void;
}

export const ProductLabelModal: React.FC<ProductLabelModalProps> = ({
  product,
  currency,
  onClose
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [labelSize, setLabelSize] = useState<'standard' | 'shelf' | 'compact'>('standard');
  const [copied, setCopied] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const qrPayload = JSON.stringify({
    name: product.name,
    sku: product.sku,
    price: product.sale_price,
    asin: product.asin,
    currency
  });

  useEffect(() => {
    QRCode.toDataURL(
      qrPayload,
      {
        width: 256,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      },
      (err, url) => {
        if (!err && url) {
          setQrDataUrl(url);
        }
      }
    );
  }, [qrPayload]);

  const handlePrint = () => {
    sounds.playClick();
    window.print();
  };

  const handleCopySku = () => {
    sounds.playPop();
    navigator.clipboard.writeText(product.sku);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatPrice = (val: number) => {
    return `${val.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('products.btn_qr_label', undefined, 'Barcode & QR-Artikeletikett')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {product.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Size Selector */}
          <div className="flex items-center justify-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setLabelSize('standard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                labelSize === 'standard'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Standard (100x60mm)
            </button>
            <button
              onClick={() => setLabelSize('shelf')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                labelSize === 'shelf'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Regal-Schild (Shelf Tag)
            </button>
            <button
              onClick={() => setLabelSize('compact')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                labelSize === 'compact'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Kompakt (Mini)
            </button>
          </div>

          {/* Printable Label Card Preview */}
          <div className="flex justify-center">
            <div
              ref={printRef}
              className={`bg-white text-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-5 shadow-sm transition-all ${
                labelSize === 'standard'
                  ? 'w-[320px] min-h-[190px]'
                  : labelSize === 'shelf'
                  ? 'w-[340px] min-h-[150px]'
                  : 'w-[260px] min-h-[140px]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                    {product.category || 'SOCDOF ERP'}
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-950 leading-snug line-clamp-2 mt-0.5">
                    {product.name}
                  </h4>
                  <div className="mt-2 flex items-center gap-1 text-xs font-mono font-bold text-slate-700">
                    <span>SKU:</span>
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-900">{product.sku}</span>
                  </div>
                  {product.asin && (
                    <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                      ASIN: {product.asin}
                    </div>
                  )}
                </div>

                {/* QR Code */}
                {qrDataUrl && (
                  <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs shrink-0 flex items-center justify-center">
                    <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>

              {/* Price Tag Footer */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex items-baseline justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Verkaufspreis (inkl. MwSt.)</span>
                  <span className="text-xl font-black font-mono-num text-slate-950">
                    {formatPrice(product.sale_price || 0)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-400 block font-mono">SOCDOF-SCAN</span>
                  <span className="text-[10px] font-semibold text-slate-600">{product.unit || 'Stück'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Details & Copy */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-slate-400">SKU / Artikelnummer:</span>
              <button
                onClick={handleCopySku}
                className="flex items-center gap-1 font-mono font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{product.sku}</span>
              </button>
            </div>
            {product.web_link && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Weblink / Lieferant:</span>
                <a
                  href={product.web_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline truncate max-w-[200px]"
                >
                  <ExternalLink className="w-3 h-3 shrink-0" />
                  <span className="truncate">{product.source_domain || 'Link öffnen'}</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50">
          {qrDataUrl ? (
            <a
              href={qrDataUrl}
              download={`QR_Label_${product.sku}.png`}
              onClick={() => sounds.playSuccess()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
            >
              <Download className="w-4 h-4" />
              <span>QR-Code Bild (.png)</span>
            </a>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {t('action.close', undefined, 'Schließen')}
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition"
            >
              <Printer className="w-4 h-4" />
              <span>{t('action.print', undefined, 'Etikett drucken')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
