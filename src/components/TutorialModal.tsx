import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Monitor, 
  Receipt, 
  Users, 
  CreditCard, 
  Calculator, 
  Package, 
  ShieldCheck, 
  BookOpen,
  ArrowRight,
  Utensils,
  ExternalLink,
  Minimize2,
  Maximize2,
  MousePointerClick,
  Target,
  ListOrdered,
  Lightbulb,
  Check
} from 'lucide-react';
import { sounds } from '../lib/sound';
import { ActiveModule } from '../types';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenModule?: (moduleId: ActiveModule) => void;
  onOpenStartMenu?: () => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({
  isOpen,
  onClose,
  onOpenModule,
  onOpenStartMenu
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  // Default to bottom-right companion widget mode as requested by user
  const [isMinimizedWidget, setIsMinimizedWidget] = useState<boolean>(true);

  if (!isOpen) return null;

  const steps: {
    title: string;
    tag: string;
    moduleId?: ActiveModule;
    actionButtonText?: string;
    icon: any;
    color: string;
    description: string;
    actionInstructions: string[];
    whatHappens: string;
    proTip: string;
  }[] = [
    {
      title: 'Multitasking auf dem Windows-Desktop',
      tag: '1. Grundlagen & Fenster',
      icon: Monitor,
      color: 'bg-indigo-600',
      description: 'Die SOCDOF ERP Suite läuft wie echte Windows 11 Programme in frei verschiebbaren Fenstern. Sie können mehrere Apps gleichzeitig öffnen.',
      actionInstructions: [
        'Klicken Sie unten links auf das Windows-Startmenü oder doppelklicken Sie auf ein Desktop-Icon.',
        'Verschieben Sie Fenster an der oberen Titelleiste oder ziehen Sie an den Fensterecken, um die Größe anzupassen.',
        'Klicken Sie auf den Maximieren-Button (Quadrat oben rechts), um die App über den gesamten Bildschirm zu vergrößern.',
        'Ordnen Sie Desktop- und Taskleisten-Icons per Drag & Drop nach Ihren Wünschen an.'
      ],
      whatHappens: 'Sie arbeiten parallel: Schreiben Sie z.B. links eine Rechnung, während Sie rechts die BWA oder das Lager im Blick behalten.',
      proTip: 'Ein Klick auf ein aktives Icon in der Taskleiste minimiert oder fokussiert das entsprechende Fenster blitzschnell.'
    },
    {
      title: 'Rechnungen schreiben & DIN 5008 Briefkopf',
      tag: '2. Fakturierung',
      moduleId: 'invoices',
      actionButtonText: 'Rechnungen-App jetzt öffnen',
      icon: Receipt,
      color: 'bg-purple-600',
      description: 'Erstellen Sie rechtskonforme Ausgangsrechnungen nach deutschem Standard mit individuellem Briefpapier.',
      actionInstructions: [
        'Klicken Sie in der Rechnungs-App oben rechts auf "+ Neue Rechnung erstellen".',
        'Wählen Sie einen Kunden aus oder tippen Sie einen neuen Namen ein.',
        'Fügen Sie Rechnungspositionen hinzu (Menge, Preis, 19% oder 7% USt).',
        'Klicken Sie auf "Vorschau & Drucken", um den DIN 5008 Briefkopf mit Falt- und Lochmarken als PDF zu exportieren.'
      ],
      whatHappens: 'Umsatzsteuer und Zahlungsziele (z.B. 14 Tage netto) werden sekundengenau berechnet und automatisch an die BWA übermittelt.',
      proTip: 'In den Einstellungen können Sie Ihr eigenes Firmenlogo oder ein vollflächiges Hintergrund-Wasserzeichen als Briefpapier hinterlegen.'
    },
    {
      title: 'Restaurant, Speisekarte & Küchen-Monitor (KDS)',
      tag: '3. Gastro & Kasse',
      moduleId: 'restaurant',
      actionButtonText: 'Restaurant & Speisekarte öffnen',
      icon: Utensils,
      color: 'bg-amber-600',
      description: 'Verwalten Sie Ihre digitale Speisekarte, nehmen Sie Tischbestellungen auf und steuern Sie die Zubereitung in der Küche.',
      actionInstructions: [
        'Wählen Sie einen freien Tisch aus (z.B. Tisch 1 bis 12, Bar oder Terrasse).',
        'Tippen Sie Speisen & Getränke (Pizza, Pasta, Burger, Drinks) an, um sie auf den Tisch zu buchen.',
        'Klicken Sie auf "Bestellung an Küche senden" – die Küche sieht den Bon sofort auf dem KDS Küchen-Display.',
        'Rechnen Sie den Tisch bar, per Karte oder mit GoBD-Bewirtungsbeleg ab.'
      ],
      whatHappens: 'Bestellungen werden in Echtzeit zwischen Servicekräften, Küche und Kasse synchronisiert.',
      proTip: 'Über den Reiter "Speisekarte" können Sie Preise, Allergene und Speisekategorien jederzeit anpassen.'
    },
    {
      title: 'POS Ladenkasse & Barcode-Scanner',
      tag: '4. Point of Sale',
      moduleId: 'pos',
      actionButtonText: 'POS Kasse öffnen',
      icon: CreditCard,
      color: 'bg-violet-600',
      description: 'Kassieren Sie blitzschnell im Ladengeschäft, Bistro oder an der Theke mit Barcode-Unterstützung.',
      actionInstructions: [
        'Scannen Sie einen Barcode mit dem Handscanner oder tippen Sie Produkte auf dem Touchscreen an.',
        'Wählen Sie die Zahlungsart (Bargeld mit Wechselgeldrechner, EC-Karte oder NFC).',
        'Geben Sie den erhaltenen Geldbetrag ein – das System zeigt das exakte Rückgeld an.',
        'Drucken Sie mit einem Klick den Thermobon (80mm / 58mm) oder führen Sie den Z-Bon Tagesabschluss durch.'
      ],
      whatHappens: 'Jeder Verkauf bucht die Artikel automatisch aus dem Lagerbestand und schreibt den Umsatz in die Kassenberichte.',
      proTip: 'Nutzen Sie die Tastaturkürzel (Enter zum Kassieren, Esc zum Abbrechen), um noch schneller zu arbeiten.'
    },
    {
      title: 'Kontakte & 1-Klick-Adressbuch-Import',
      tag: '5. Kunden & CRM',
      moduleId: 'contacts',
      actionButtonText: 'Kontakte-App öffnen',
      icon: Users,
      color: 'bg-teal-600',
      description: 'Pflegen Sie alle Kunden, Lieferanten und Partner zentral ohne mühsame manuelle Doppeleingaben.',
      actionInstructions: [
        'Klicken Sie auf "+ Neuer Kontakt", um Kundendaten mit USt-IdNr., IBAN und Zahlungsziel anzulegen.',
        'Oder nutzen Sie "Adressbuch importieren", um Outlook, vCard (.vcf) oder Excel/CSV-Listen einzulesen.',
        'Über "Stapel-Erstellung" können Sie mehrere Firmenadressen in einem einzigen Schritt anlegen.',
        'Klicken Sie bei einem Kontakt auf "Rechnung schreiben", um sofort eine vorausgefüllte Rechnung zu öffnen.'
      ],
      whatHappens: 'Alle Rechnungen und Umsätze werden dauerhaft mit dem jeweiligen Kundenprofil verknüpft.',
      proTip: 'Mit dem Suchfeld können Sie Kunden nach Namen, Stadt, PLZ oder E-Mail in Echtzeit filtern.'
    },
    {
      title: 'Abrechnungen, BWA & USt-Voranmeldung',
      tag: '6. Buchhaltung',
      moduleId: 'accounting',
      actionButtonText: 'Finanzen & BWA öffnen',
      icon: Calculator,
      color: 'bg-emerald-600',
      description: 'Verfolgen Sie Ihre Erlöse, Betriebsausgaben, Margen und fällige Steuerbeträge in Echtzeit.',
      actionInstructions: [
        'Öffnen Sie das Modul "Abrechnung", um die monatliche BWA und EÜR-Übersicht einzusehen.',
        'Prüfen Sie im Reiter "USt-Voranmeldung" die nach Steuersätzen (19%, 7%, 0%) aufgeschlüsselte Zahllast.',
        'Überprüfen Sie offene Posten und erstellen Sie bei Zahlungsverzug mit 1 Klick Zahlungserinnerungen.',
        'Exportieren Sie BWA-Berichte und Summen- und Saldenlisten für Ihren Steuerberater.'
      ],
      whatHappens: 'Alle Einnahmen aus Rechnungen und POS-Kassen fließen ohne manuelle Buchungen automatisch ein.',
      proTip: 'Prüfen Sie regelmäßig den Mahnwesen-Filter, um überfällige Kundenforderungen frühzeitig zu erkennen.'
    },
    {
      title: 'SOCDOF App Store & Modulverwaltung',
      tag: '7. Personalisierung',
      moduleId: 'appstore',
      actionButtonText: 'App Store öffnen',
      icon: Package,
      color: 'bg-blue-600',
      description: 'Passen Sie die Arbeitsumgebung exakt an Ihre Branche und Ihre täglichen Aufgaben an.',
      actionInstructions: [
        'Öffnen Sie den App Store über das Desktop-Icon oder das Startmenü.',
        'Aktivieren oder deaktivieren Sie Module mit nur einem Klick (z.B. Restaurant, Einkauf oder Lager).',
        'Klicken Sie bei einer App auf "Auf Desktop anheften", um Schnellzugriffe zu erstellen.',
        'Wichtige Basis-Apps (Einstellungen & Handbuch) bleiben immer geschützt und dauerhaft verfügbar.'
      ],
      whatHappens: 'Ihre Auswahl wird direkt in der lokalen Windows-Konfiguration gespeichert.',
      proTip: 'Sie können inaktive Module jederzeit reaktivieren, ohne dass bereits gespeicherte Daten verloren gehen.'
    },
    {
      title: '100% Lokale Windows-Sicherheit & Backups',
      tag: '8. Datenschutz & Backup',
      moduleId: 'settings',
      actionButtonText: 'Einstellungen öffnen',
      icon: ShieldCheck,
      color: 'bg-slate-800',
      description: 'Maximale Datensicherheit nach DSGVO & GoBD: 100% Offline auf Ihrem PC ohne Cloud-Zwang.',
      actionInstructions: [
        'Öffnen Sie die "Einstellungen" über das Desktop-Icon oder das Startmenü.',
        'Klicken Sie im Reiter "Firmendaten" auf "Briefkopf", um Logo und Bankverbindung einzurichten.',
        'Klicken Sie unter "Datensicherung" auf "ERP-Datenbank exportieren (.json)", um ein lokales Backup zu speichern.',
        'Laden Sie unter "Windows Desktop" die Datei "SOCDOF_ERP_Windows_Starten.bat" für einen nativen 1-Klick-Start herunter.'
      ],
      whatHappens: 'Alle Belege, Artikel und Stammdaten liegen verschlüsselt auf Ihrer lokalen Windows-Festplatte (C:).',
      proTip: 'Erstellen Sie wöchentlich eine kompakte Sicherungsdatei auf einem externen USB-Stick oder Netzlaufwerk.'
    }
  ];

  const current = steps[currentStep];
  const Icon = current.icon;
  const isLast = currentStep === steps.length - 1;

  const handleNext = () => {
    sounds.playClick();
    if (isLast) {
      sounds.playSuccess();
      onClose();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    sounds.playClick();
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleLaunchCurrentModule = () => {
    if (current.moduleId && onOpenModule) {
      sounds.playSuccess();
      onOpenModule(current.moduleId);
      // Minimize tutorial into floating companion widget so the user can interact with the app
      setIsMinimizedWidget(true);
    }
  };

  // Minimized Companion Widget View
  if (isMinimizedWidget) {
    return (
      <div className="fixed bottom-14 right-6 z-50 animate-bounce-subtle select-none">
        <div className="bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-3xl shadow-2xl p-4 w-96 max-w-[90vw] text-slate-900 dark:text-slate-100 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl ${current.color} text-white flex items-center justify-center shadow-xs flex-shrink-0`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">
                  Schritt {currentStep + 1} von {steps.length}
                </span>
                <h4 className="text-xs font-bold truncate max-w-[180px] mt-0.5">{current.title}</h4>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimizedWidget(false)}
                title="Tutorial vergrößern"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={onClose}
                title="Tutorial schließen"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <ListOrdered className="w-3 h-3" />
                <span>Ihre nächste Aktion:</span>
              </span>
              {currentStep === 0 && onOpenStartMenu && (
                <button
                  onClick={() => { sounds.playClick(); onOpenStartMenu(); }}
                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-bold shadow-xs transition"
                >
                  Startmenü öffnen
                </button>
              )}
              {current.moduleId && onOpenModule && (
                <button
                  onClick={handleLaunchCurrentModule}
                  className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-[10px] font-bold shadow-xs transition"
                >
                  App öffnen
                </button>
              )}
            </div>
            <ol className="space-y-1 text-[11px] text-slate-700 dark:text-slate-200 font-medium">
              {current.actionInstructions.slice(0, 2).map((inst, idx) => (
                <li key={idx} className="flex items-start gap-1.5 leading-tight">
                  <span className="w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[9px] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <span>{inst}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`p-1.5 text-xs rounded-lg ${currentStep === 0 ? 'opacity-30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-[10px] font-bold text-slate-400">
              {currentStep + 1} von {steps.length}
            </span>

            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs"
            >
              <span>{isLast ? 'Fertig' : 'Weiter'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full Spotlight Guided Tour View
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in select-none">
      {/* Background Spotlight indicator ring */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[650px] h-[650px] rounded-full bg-indigo-500/10 filter blur-3xl animate-pulse" />
      </div>

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border-2 border-indigo-500/50 dark:border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 flex flex-col max-h-[90vh]">
        {/* Top Progress bar */}
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 w-full flex">
          {steps.map((_, idx) => (
            <div
              key={idx}
              className={`h-full flex-1 transition-all duration-300 ${idx <= currentStep ? 'bg-indigo-600' : 'bg-transparent'}`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="p-6 pb-3 flex items-start justify-between border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl ${current.color} text-white flex items-center justify-center shadow-lg flex-shrink-0`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                  {current.tag}
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  Schritt {currentStep + 1} von {steps.length}
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mt-1">
                {current.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimizedWidget(true)}
              title="Als Begleiter minimieren und App ausprobieren"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => { sounds.playClick(); onClose(); }}
              title="Tutorial schließen"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-6 pt-4 space-y-4 overflow-y-auto flex-1">
          {/* Overview */}
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {current.description}
          </p>

          {/* Action Checklist Box: EXACT ACTIONS TO TAKE */}
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-950 dark:text-indigo-200 uppercase tracking-wide">
              <ListOrdered className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>Was Sie jetzt konkret tun müssen (Schritt-für-Schritt Anleitung):</span>
            </div>

            <div className="space-y-2 pt-1">
              {current.actionInstructions.map((instruction, index) => (
                <div key={index} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60 shadow-2xs text-xs">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white font-extrabold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-xs">
                    {index + 1}
                  </div>
                  <span className="text-slate-800 dark:text-slate-200 leading-snug font-medium">
                    {instruction}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* What happens in background & Pro Tip Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Hintergrund-Wirkung:</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {current.whatHappens}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 space-y-1">
              <div className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                <span>Praxis-Tipp:</span>
              </div>
              <p className="text-[11px] text-amber-800/90 dark:text-amber-300/80 leading-relaxed">
                {current.proTip}
              </p>
            </div>
          </div>

          {/* Interactive Direct Launch CTA Button */}
          {current.moduleId && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleLaunchCurrentModule}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 group"
              >
                <span>{current.actionButtonText || 'App jetzt direkt öffnen & testen'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold transition ${currentStep === 0 ? 'opacity-30 cursor-not-allowed text-slate-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Zurück</span>
          </button>

          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => { sounds.playClick(); setCurrentStep(i); }}
                className={`h-2 rounded-full transition-all ${i === currentStep ? 'w-6 bg-indigo-600' : 'w-2 bg-slate-300 dark:bg-slate-700'}`}
              />
            ))}
          </div>

          <button
            onClick={handleNext}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition"
          >
            <span>{isLast ? 'Tutorial abschließen' : 'Nächster Schritt'}</span>
            {isLast ? <CheckCircle2 className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

