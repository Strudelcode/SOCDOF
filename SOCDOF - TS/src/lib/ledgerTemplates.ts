/**
 * ============================================================================
 * SOCDOF - Kassenbuch & Einnahmen-Ausgaben Vorlagen & Mehrsprachigkeit
 * ============================================================================
 * 
 * Diese Datei dient als zentrale Konfigurationsstelle für alle Texte, Bezeichnungen,
 * Spaltenüberschriften und Vorlagen des Kassenbuchs (Web-App & Excel-Export).
 * 
 * Hier können Übersetzungen für Deutsch (de), Englisch (en), Französisch (fr) 
 * und Spanisch (es) sowie neue Buchungsvorlagen angepasst oder erweitert werden.
 */

export interface LedgerTexts {
  modalTitle: string;
  sheetTitle: string;
  period: string;
  summaryHeader: string;
  cashCol: string;
  bankCol: string;
  totalCol: string;
  balanceCol: string;
  carryOverYear: string;
  carryOverPrev: string;
  incomeSum: string;
  expenseSum: string;
  balance: string;
  nr: string;
  method: string;
  date: string;
  description: string;
  income: string;
  expense: string;
  action: string;
  legend: string;
  btnJanCarryOver: string;
  btnAddEntry: string;
  btnDownloadExcel: string;
  btnPrint: string;
  btnClose: string;
  filterAll: string;
  filterCash: string;
  filterBank: string;
  searchPlaceholder: string;
  monthSummaryText: (count: number) => string;
  yearSummaryText: (year: number, count: number) => string;
  noEntriesMonth: string;
  deleteConfirm: string;
  modalAddTitle: string;
  fieldDate: string;
  fieldMethod: string;
  fieldDesc: string;
  fieldAmount: string;
  typeExpense: string;
  typeIncome: string;
  btnSave: string;
  btnCancel: string;
  carryOverModalTitle: string;
  carryOverCashLabel: string;
  carryOverBankLabel: string;
  carryOverNote: string;
}

export const LEDGER_TEXTS: Record<string, LedgerTexts> = {
  de: {
    modalTitle: 'Kassenbuch & Einnahmen-Ausgaben',
    sheetTitle: 'EIN- UND AUSGABEN',
    period: 'Zeitraum',
    summaryHeader: 'Kassen- & Bankverrechnung',
    cashCol: 'Kassa (K)',
    bankCol: 'Bank (B)',
    totalCol: 'Gesamt',
    balanceCol: 'Saldo',
    carryOverYear: 'Übertrag Vormonat (des letzten Jahres)',
    carryOverPrev: 'Übertrag Vormonat',
    incomeSum: 'Summe Einnahmen',
    expenseSum: 'Summe Ausgaben',
    balance: 'Aktueller Stand',
    nr: 'Nr.',
    method: 'Kassa / Bank',
    date: 'Datum',
    description: 'Beschreibung',
    income: 'Einnahmen',
    expense: 'Ausgaben',
    action: 'Aktion',
    legend: 'Legende: K = Kassa (Barzahlung) • B = Bank (Überweisung / Karte)',
    btnJanCarryOver: 'Übertrag Januar',
    btnAddEntry: '+ Ausgabe / Einnahme',
    btnDownloadExcel: 'Excel herunterladen',
    btnPrint: 'Drucken / PDF',
    btnClose: 'Schließen',
    filterAll: 'Alle',
    filterCash: 'Kassa (K)',
    filterBank: 'Bank (B)',
    searchPlaceholder: 'Buchungen durchsuchen...',
    monthSummaryText: (count: number) => `${count} Buchungen im Monat`,
    yearSummaryText: (year: number, count: number) => `Jahresübersicht ${year}: ${count} Gesamtvorgänge synchronisiert.`,
    noEntriesMonth: 'Keine Buchungen in diesem Monat vorhanden',
    deleteConfirm: 'Möchten Sie diese Buchung wirklich löschen?',
    modalAddTitle: 'Manuelle Ausgabe oder Einnahme erfassen',
    fieldDate: 'Datum',
    fieldMethod: 'Zahlungsart',
    fieldDesc: 'Beschreibung / Text',
    fieldAmount: 'Betrag (€)',
    typeExpense: 'Ausgabe',
    typeIncome: 'Einnahme',
    btnSave: 'Buchung speichern',
    btnCancel: 'Abbrechen',
    carryOverModalTitle: 'Anfangsbestand zum 01.01. festlegen',
    carryOverCashLabel: 'Übertrag Kassa (Bargeld) zum 01.01. (€)',
    carryOverBankLabel: 'Übertrag Bank (Girokonto) zum 01.01. (€)',
    carryOverNote: 'Dieser Anfangsbestand wird als Startwert für das Kassenbuch im Januar herangezogen und monatlich fortgeführt.'
  },
  en: {
    modalTitle: 'Cash Ledger & Incomes / Expenses',
    sheetTitle: 'INCOMES AND EXPENSES',
    period: 'Period',
    summaryHeader: 'Cash & Bank Calculation',
    cashCol: 'Cash (K)',
    bankCol: 'Bank (B)',
    totalCol: 'Total',
    balanceCol: 'Balance',
    carryOverYear: 'Carry-over Previous Year',
    carryOverPrev: 'Carry-over Previous Month',
    incomeSum: 'Total Income',
    expenseSum: 'Total Expenses',
    balance: 'Current Balance',
    nr: 'No.',
    method: 'Cash / Bank',
    date: 'Date',
    description: 'Description',
    income: 'Income',
    expense: 'Expenses',
    action: 'Action',
    legend: 'Legend: K = Cash (Cash payment) • B = Bank (Wire transfer / Card)',
    btnJanCarryOver: 'Jan Carry-over',
    btnAddEntry: '+ Entry',
    btnDownloadExcel: 'Download Excel',
    btnPrint: 'Print / PDF',
    btnClose: 'Close',
    filterAll: 'All',
    filterCash: 'Cash (K)',
    filterBank: 'Bank (B)',
    searchPlaceholder: 'Search entries...',
    monthSummaryText: (count: number) => `${count} monthly transactions`,
    yearSummaryText: (year: number, count: number) => `Annual overview ${year}: ${count} total transactions synchronized.`,
    noEntriesMonth: 'No transactions in this month',
    deleteConfirm: 'Do you really want to delete this entry?',
    modalAddTitle: 'Add Manual Expense or Income',
    fieldDate: 'Date',
    fieldMethod: 'Payment Method',
    fieldDesc: 'Description / Purpose',
    fieldAmount: 'Amount (€)',
    typeExpense: 'Expense',
    typeIncome: 'Income',
    btnSave: 'Save Entry',
    btnCancel: 'Cancel',
    carryOverModalTitle: 'Set Initial Balance on Jan 1st',
    carryOverCashLabel: 'Initial Cash Carry-over (€)',
    carryOverBankLabel: 'Initial Bank Carry-over (€)',
    carryOverNote: 'This starting balance will be used as the opening balance in January and carried over monthly.'
  },
  fr: {
    modalTitle: 'Livre de caisse & Entrées / Sorties',
    sheetTitle: 'REVENUS ET DÉPENSES',
    period: 'Période',
    summaryHeader: 'Calcul Caisse & Banque',
    cashCol: 'Caisse (K)',
    bankCol: 'Banque (B)',
    totalCol: 'Total',
    balanceCol: 'Solde',
    carryOverYear: 'Report année précédente',
    carryOverPrev: 'Report mois précédent',
    incomeSum: 'Total revenus',
    expenseSum: 'Total dépenses',
    balance: 'Solde actuel',
    nr: 'N°',
    method: 'Caisse / Banque',
    date: 'Date',
    description: 'Description',
    income: 'Revenus',
    expense: 'Dépenses',
    action: 'Action',
    legend: 'Légende: K = Caisse (Espèces) • B = Banque (Virement / Carte)',
    btnJanCarryOver: 'Report Janvier',
    btnAddEntry: '+ Saisie',
    btnDownloadExcel: 'Télécharger Excel',
    btnPrint: 'Imprimer / PDF',
    btnClose: 'Fermer',
    filterAll: 'Tous',
    filterCash: 'Caisse (K)',
    filterBank: 'Banque (B)',
    searchPlaceholder: 'Rechercher des écritures...',
    monthSummaryText: (count: number) => `${count} écritures ce mois`,
    yearSummaryText: (year: number, count: number) => `Bilan annuel ${year}: ${count} opérations synchronisées.`,
    noEntriesMonth: 'Aucune écriture enregistrée pour ce mois',
    deleteConfirm: 'Voulez-vous vraiment supprimer cette écriture ?',
    modalAddTitle: 'Ajouter une dépense ou un revenu',
    fieldDate: 'Date',
    fieldMethod: 'Mode de règlement',
    fieldDesc: 'Description / Libellé',
    fieldAmount: 'Montant (€)',
    typeExpense: 'Dépense',
    typeIncome: 'Revenu',
    btnSave: 'Enregistrer',
    btnCancel: 'Annuler',
    carryOverModalTitle: 'Définir le solde initial au 01/01',
    carryOverCashLabel: 'Report Caisse (Espèces) (€)',
    carryOverBankLabel: 'Report Banque (Compte) (€)',
    carryOverNote: 'Ce solde initial sera utilisé comme point de départ en janvier et reporté mensuellement.'
  },
  es: {
    modalTitle: 'Libro de caja e Ingresos / Gastos',
    sheetTitle: 'INGRESOS Y GASTOS',
    period: 'Período',
    summaryHeader: 'Cálculo Caja y Banco',
    cashCol: 'Caja (K)',
    bankCol: 'Banco (B)',
    totalCol: 'Total',
    balanceCol: 'Saldo',
    carryOverYear: 'Transporte año anterior',
    carryOverPrev: 'Transporte mes anterior',
    incomeSum: 'Total ingresos',
    expenseSum: 'Total gastos',
    balance: 'Saldo actual',
    nr: 'Nº',
    method: 'Caja / Banco',
    date: 'Fecha',
    description: 'Descripción',
    income: 'Ingresos',
    expense: 'Gastos',
    action: 'Acción',
    legend: 'Leyenda: K = Caja (Efectivo) • B = Banco (Transferencia / Tarjeta)',
    btnJanCarryOver: 'Transporte Enero',
    btnAddEntry: '+ Registro',
    btnDownloadExcel: 'Descargar Excel',
    btnPrint: 'Imprimir / PDF',
    btnClose: 'Cerrar',
    filterAll: 'Todos',
    filterCash: 'Caja (K)',
    filterBank: 'Banco (B)',
    searchPlaceholder: 'Buscar movimientos...',
    monthSummaryText: (count: number) => `${count} movimientos en el mes`,
    yearSummaryText: (year: number, count: number) => `Resumen anual ${year}: ${count} operaciones sincronizadas.`,
    noEntriesMonth: 'No hay movimientos en este mes',
    deleteConfirm: '¿Realmente desea eliminar este registro?',
    modalAddTitle: 'Registrar gasto o ingreso manual',
    fieldDate: 'Fecha',
    fieldMethod: 'Método de pago',
    fieldDesc: 'Descripción / Concepto',
    fieldAmount: 'Importe (€)',
    typeExpense: 'Gasto',
    typeIncome: 'Ingreso',
    btnSave: 'Guardar',
    btnCancel: 'Cancelar',
    carryOverModalTitle: 'Fijar saldo inicial al 01/01',
    carryOverCashLabel: 'Transporte Caja (Efectivo) (€)',
    carryOverBankLabel: 'Transporte Banco (Cuenta) (€)',
    carryOverNote: 'Este saldo inicial se utilizará como valor de partida en enero y se trasladará mensualmente.'
  }
};

/**
 * Returns the localized text dictionary for the requested language.
 */
export function getLedgerTexts(lang: string = 'de'): LedgerTexts {
  return LEDGER_TEXTS[lang] || LEDGER_TEXTS.de;
}

/**
 * Common quick-fill transaction templates for fast bookkeeping.
 */
export interface LedgerQuickTemplate {
  id: string;
  label: Record<string, string>;
  type: 'income' | 'expense';
  paymentMethod: 'cash' | 'bank';
  defaultDescription: Record<string, string>;
  category: string;
}

export const LEDGER_QUICK_TEMPLATES: LedgerQuickTemplate[] = [
  {
    id: 'rent',
    label: {
      de: '🏢 Miete / Praxisraum',
      en: '🏢 Office / Practice Rent',
      fr: '🏢 Loyer cabinet',
      es: '🏢 Alquiler consulta'
    },
    type: 'expense',
    paymentMethod: 'bank',
    defaultDescription: {
      de: 'Praxismiete_Monat',
      en: 'Practice_Rent_Month',
      fr: 'Loyer_Cabinet_Mois',
      es: 'Alquiler_Consulta_Mes'
    },
    category: 'Raumkosten'
  },
  {
    id: 'supplies',
    label: {
      de: '📦 Büromaterial / Praxisbedarf',
      en: '📦 Office / Practice Supplies',
      fr: '📦 Fournitures de bureau',
      es: '📦 Material de oficina'
    },
    type: 'expense',
    paymentMethod: 'cash',
    defaultDescription: {
      de: 'Einkauf_Büromaterial_Beleg',
      en: 'Office_Supplies_Receipt',
      fr: 'Achat_Fournitures_Reçu',
      es: 'Compra_Material_Oficina'
    },
    category: 'Material & Bedarf'
  },
  {
    id: 'travel',
    label: {
      de: '🚗 Fahrtkosten / Kilometergeld',
      en: '🚗 Travel / Mileage Costs',
      fr: '🚗 Frais kilométriques',
      es: '🚗 Gastos kilometraje'
    },
    type: 'expense',
    paymentMethod: 'bank',
    defaultDescription: {
      de: 'Kilometergeld_Hausbesuche',
      en: 'Mileage_Home_Visits',
      fr: 'Indemnités_Déplacements',
      es: 'Kilometraje_Visitas'
    },
    category: 'Fahrtkosten'
  },
  {
    id: 'software',
    label: {
      de: '💻 Software / IT-Lizenzen',
      en: '💻 Software & Cloud Services',
      fr: '💻 Logiciels & Informatique',
      es: '💻 Software y licencias'
    },
    type: 'expense',
    paymentMethod: 'bank',
    defaultDescription: {
      de: 'Software_Abonnement_Monat',
      en: 'Software_Subscription_Month',
      fr: 'Abonnement_Logiciel_Mois',
      es: 'Suscripción_Software_Mes'
    },
    category: 'IT & Software'
  },
  {
    id: 'fee_cash',
    label: {
      de: '💶 Bar-Honorar / Therapiesitzung',
      en: '💶 Cash Fee / Therapy Session',
      fr: '💶 Honoraires espèces / Séance',
      es: '💶 Honorarios en efectivo'
    },
    type: 'income',
    paymentMethod: 'cash',
    defaultDescription: {
      de: 'Barhonorar_Therapiesitzung',
      en: 'Cash_Fee_Session',
      fr: 'Honoraires_Espèces_Séance',
      es: 'Honorarios_Efectivo_Sesión'
    },
    category: 'Praxis-Honorar'
  },
  {
    id: 'fee_bank',
    label: {
      de: '💳 Bank-Honorar / Überweisung',
      en: '💳 Wire Transfer Fee / Client',
      fr: '💳 Virement bancaire / Séance',
      es: '💳 Transferencia bancaria'
    },
    type: 'income',
    paymentMethod: 'bank',
    defaultDescription: {
      de: 'Honorar_Überweisung_Klient',
      en: 'Wire_Fee_Client',
      fr: 'Virement_Honoraires_Client',
      es: 'Transferencia_Honorarios_Cliente'
    },
    category: 'Praxis-Honorar'
  }
];

const LOCAL_STORAGE_CUSTOM_TEMPLATES_KEY = 'socdof_custom_ledger_templates';

/**
 * Retrieves the combined list of built-in templates and user-customized templates.
 */
export function getEffectiveQuickTemplates(): LedgerQuickTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CUSTOM_TEMPLATES_KEY);
    if (!raw) return LEDGER_QUICK_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fall back to built-ins
  }
  return LEDGER_QUICK_TEMPLATES;
}

/**
 * Saves customized templates to local storage.
 */
export function saveCustomLedgerTemplates(templates: LedgerQuickTemplate[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
  } catch (err) {
    console.error('Failed to save custom ledger templates:', err);
  }
}

/**
 * Resets templates back to the default configuration from this file.
 */
export function resetLedgerTemplatesToDefault(): void {
  try {
    localStorage.removeItem(LOCAL_STORAGE_CUSTOM_TEMPLATES_KEY);
  } catch (err) {
    console.error('Failed to reset ledger templates:', err);
  }
}

