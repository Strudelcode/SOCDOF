import { BillingItem, PracticeData, Trip } from '../components/therapy/types';
import { Invoice, PurchaseOrder, CompanyProfile } from '../types';
import { getLedgerTexts, LEDGER_TEXTS } from './ledgerTemplates';

export interface LedgerTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'income' | 'expense';
  paymentMethod: 'cash' | 'bank'; // cash = Kassa (K), bank = Bank (B)
  clientId?: string;
  clientName?: string;
  description: string;
  amount: number;
  category?: string;
  source: 'therapy_billing' | 'invoice' | 'purchase' | 'manual' | 'trip';
  sourceId?: string | number;
  createdAt: string;
}

export interface MonthlyLedgerData {
  month: number; // 0 to 11
  monthName: string;
  year: number;
  carryOverCash: number;
  carryOverBank: number;
  carryOverTotal: number;
  incomeCash: number;
  incomeBank: number;
  totalIncome: number;
  expenseCash: number;
  expenseBank: number;
  totalExpense: number;
  currentBalanceCash: number;
  currentBalanceBank: number;
  currentBalanceTotal: number;
  transactions: LedgerTransaction[];
}

const MANUAL_ENTRIES_STORAGE_KEY = 'socdof_tax_advisor_ledger_entries_v1';
const INITIAL_CARRYOVER_STORAGE_KEY = 'socdof_tax_advisor_initial_carryover_v1';

export const MONTH_NAMES_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function getMonthNames(lang: string = 'de'): string[] {
  switch (lang) {
    case 'en': return MONTH_NAMES_EN;
    case 'fr': return MONTH_NAMES_FR;
    case 'es': return MONTH_NAMES_ES;
    default: return MONTH_NAMES_DE;
  }
}

export { getLedgerTexts, LEDGER_TEXTS };

export function getManualLedgerEntries(): LedgerTransaction[] {
  try {
    const raw = localStorage.getItem(MANUAL_ENTRIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveManualLedgerEntries(entries: LedgerTransaction[]): void {
  try {
    localStorage.setItem(MANUAL_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    console.error('Failed to save manual ledger entries', err);
  }
}

export function getInitialCarryOver(year: number): { cash: number; bank: number } {
  try {
    const raw = localStorage.getItem(`${INITIAL_CARRYOVER_STORAGE_KEY}_${year}`);
    if (raw) {
      return JSON.parse(raw);
    }
    const legacy = localStorage.getItem(INITIAL_CARRYOVER_STORAGE_KEY);
    if (legacy) {
      return JSON.parse(legacy);
    }
  } catch {}
  return { cash: 0, bank: 0 };
}

export function saveInitialCarryOver(year: number, carryOver: { cash: number; bank: number }): void {
  try {
    localStorage.setItem(`${INITIAL_CARRYOVER_STORAGE_KEY}_${year}`, JSON.stringify(carryOver));
  } catch (err) {
    console.error('Failed to save initial carryover', err);
  }
}

/**
 * Gathers and normalizes all financial transactions across Praxis billings, invoices, purchases, trips, and manual ledger entries.
 */
export function buildUnifiedTransactionsList(
  practiceData?: PracticeData,
  invoices?: Invoice[],
  purchases?: PurchaseOrder[]
): LedgerTransaction[] {
  const list: LedgerTransaction[] = [];
  const manualEntries = getManualLedgerEntries();
  list.push(...manualEntries);

  // 1. Practice & Therapy Billings (Einnahmen)
  if (practiceData && practiceData.billing) {
    practiceData.billing.forEach(item => {
      const client = practiceData.clients?.find(c => c.id === item.clientId);
      const clientName = client?.name || 'Klient';
      const amount = Number(item.amount) || 0;
      if (amount <= 0) return;
      const dateStr = item.date || new Date().toISOString().slice(0, 10);
      const invNr = item.invoiceNumber || `PRAXIS-${item.id.slice(-6)}`;
      const cleanDesc = item.service 
        ? `${item.service}_${clientName.replace(/\s+/g, '_')}_${invNr}`
        : `Beratung_${clientName.replace(/\s+/g, '_')}_${invNr}`;
      list.push({
        id: `therapy_${item.id}`,
        date: dateStr,
        type: 'income',
        paymentMethod: 'bank',
        clientId: item.clientId,
        clientName: clientName,
        description: cleanDesc,
        amount: amount,
        category: 'Praxis-Honorar',
        source: 'therapy_billing',
        sourceId: item.id,
        createdAt: item.date || new Date().toISOString()
      });
    });
  }

  // 2. Practice Trips / Mileage reimbursement (Ausgaben)
  if (practiceData && practiceData.trips) {
    practiceData.trips.forEach(trip => {
      const distance = Math.max(0, (trip.endKm || 0) - (trip.startKm || 0));
      const tripRate = trip.rate || 0.38;
      const amount = distance * tripRate;
      if (amount <= 0) return;
      const dateStr = trip.date || new Date().toISOString().slice(0, 10);
      list.push({
        id: `trip_${trip.id}`,
        date: dateStr,
        type: 'expense',
        paymentMethod: 'bank',
        description: `Kilometergeld_${trip.departure || 'Start'}_nach_${trip.destination || 'Ziel'} (${distance} km)`,
        amount: Math.round(amount * 100) / 100,
        category: 'Fahrtkosten',
        source: 'trip',
        sourceId: trip.id,
        createdAt: trip.date || new Date().toISOString()
      });
    });
  }

  // 3. General Invoices
  if (invoices && Array.isArray(invoices)) {
    invoices.forEach(inv => {
      if (inv.type === 'out_invoice' && (inv.status === 'posted' || inv.status === 'paid')) {
        if (inv.number && list.some(l => l.description.includes(inv.number))) return;
        const dateStr = inv.date || new Date().toISOString().slice(0, 10);
        const amount = Number(inv.total) || Number(inv.subtotal) || 0;
        if (amount <= 0) return;
        const method = inv.payment_method === 'cash' ? 'cash' : 'bank';
        list.push({
          id: `inv_${inv.id || inv.number}`,
          date: dateStr,
          type: 'income',
          paymentMethod: method,
          clientName: inv.contact_name,
          description: `Rechnung_${inv.contact_name ? inv.contact_name.replace(/\s+/g, '_') : 'Kunde'}_${inv.number}`,
          amount: amount,
          category: 'Verkauf / Leistung',
          source: 'invoice',
          sourceId: inv.id,
          createdAt: inv.date || new Date().toISOString()
        });
      }
    });
  }

  // 4. Purchases (Ausgaben)
  if (purchases && Array.isArray(purchases)) {
    purchases.forEach(po => {
      if (po.status !== 'draft') {
        const dateStr = po.order_date || new Date().toISOString().slice(0, 10);
        const amount = Number(po.total) || Number(po.subtotal) || 0;
        if (amount <= 0) return;
        list.push({
          id: `po_${po.id || po.number}`,
          date: dateStr,
          type: 'expense',
          paymentMethod: 'bank',
          description: `Einkauf_${po.vendor_name ? po.vendor_name.replace(/\s+/g, '_') : 'Lieferant'}_${po.number}`,
          amount: amount,
          category: 'Wareneinkauf / Material',
          source: 'purchase',
          sourceId: po.id,
          createdAt: po.order_date || new Date().toISOString()
        });
      }
    });
  }

  return list.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculates monthly summaries for all 12 months with sequential carry-over from month to month.
 */
export function calculateYearlyLedger(
  year: number,
  allTransactions: LedgerTransaction[],
  lang: string = 'de'
): MonthlyLedgerData[] {
  const initial = getInitialCarryOver(year);
  let runningCash = initial.cash || 0;
  let runningBank = initial.bank || 0;
  const monthNames = getMonthNames(lang);
  const result: MonthlyLedgerData[] = [];

  for (let month = 0; month < 12; month++) {
    const monthTransactions = allTransactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).sort((a, b) => a.date.localeCompare(b.date));

    const carryOverCash = runningCash;
    const carryOverBank = runningBank;
    const carryOverTotal = carryOverCash + carryOverBank;

    let incomeCash = 0;
    let incomeBank = 0;
    let expenseCash = 0;
    let expenseBank = 0;

    monthTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (t.type === 'income') {
        if (t.paymentMethod === 'cash') incomeCash += amt;
        else incomeBank += amt;
      } else {
        if (t.paymentMethod === 'cash') expenseCash += amt;
        else expenseBank += amt;
      }
    });

    const totalIncome = incomeCash + incomeBank;
    const totalExpense = expenseCash + expenseBank;
    const currentBalanceCash = carryOverCash + incomeCash - expenseCash;
    const currentBalanceBank = carryOverBank + incomeBank - expenseBank;
    const currentBalanceTotal = currentBalanceCash + currentBalanceBank;

    runningCash = currentBalanceCash;
    runningBank = currentBalanceBank;

    result.push({
      month,
      monthName: monthNames[month],
      year,
      carryOverCash,
      carryOverBank,
      carryOverTotal,
      incomeCash,
      incomeBank,
      totalIncome,
      expenseCash,
      expenseBank,
      totalExpense,
      currentBalanceCash,
      currentBalanceBank,
      currentBalanceTotal,
      transactions: monthTransactions
    });
  }

  return result;
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const yearShort = parts[0].slice(-2);
      return `${parts[2]}.${parts[1]}.${yearShort}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Generates a localized multi-sheet Microsoft Excel XML document with formulas for automatic recalculation!
 */
export function generateTaxAdvisorExcelXml(
  year: number,
  ownerName: string,
  monthlyData: MonthlyLedgerData[],
  currency = '€',
  lang: string = 'de'
): string {
  const cleanOwner = ownerName || '';
  const t = getLedgerTexts(lang);
  const titleText = cleanOwner ? `${t.sheetTitle} - ${cleanOwner}` : t.sheetTitle;

  const worksheetsXml = monthlyData.map((m, monthIdx) => {
    const rowsXml: string[] = [];

    // Row 1: Main Title
    rowsXml.push(`
      <Row ss:Height="28">
        <Cell ss:MergeAcross="6" ss:StyleID="MainTitle">
          <Data ss:Type="String">${titleText}</Data>
        </Cell>
      </Row>
    `);

    // Row 2: Legend / Info Row
    rowsXml.push(`
      <Row ss:Height="20">
        <Cell ss:MergeAcross="6" ss:StyleID="LegendCell">
          <Data ss:Type="String">${t.legend}</Data>
        </Cell>
      </Row>
    `);

    // Row 3: Period
    rowsXml.push(`
      <Row ss:Height="20">
        <Cell ss:StyleID="LabelBold"><Data ss:Type="String">${t.period}:</Data></Cell>
        <Cell ss:MergeAcross="5" ss:StyleID="PeriodValue"><Data ss:Type="String">${m.monthName} ${year}</Data></Cell>
      </Row>
    `);

    // Row 4: Summary Table Column Header
    rowsXml.push(`
      <Row ss:Height="22">
        <Cell ss:MergeAcross="3" ss:StyleID="ColHeaderLeft"><Data ss:Type="String">${t.summaryHeader}</Data></Cell>
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.cashCol}</Data></Cell>
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.bankCol}</Data></Cell>
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.totalCol}</Data></Cell>
      </Row>
    `);

    // Row 5: Carry-over (Übertrag Vormonat)
    const carryOverLabel = m.month === 0 ? t.carryOverYear : t.carryOverPrev;
    if (monthIdx === 0) {
      // January: static initial carry-over values
      rowsXml.push(`
        <Row ss:Height="22">
          <Cell ss:MergeAcross="3" ss:StyleID="SummaryNavyHeader"><Data ss:Type="String">${carryOverLabel}</Data></Cell>
          <Cell ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.carryOverCash.toFixed(2)}</Data></Cell>
          <Cell ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.carryOverBank.toFixed(2)}</Data></Cell>
          <Cell ss:Formula="=RC[-2]+RC[-1]" ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.carryOverTotal.toFixed(2)}</Data></Cell>
        </Row>
      `);
    } else {
      // February to December: Excel formula referencing previous month's sheet row 8 (Aktueller Kassastand)
      const prevSheet = monthlyData[monthIdx - 1].monthName;
      rowsXml.push(`
        <Row ss:Height="22">
          <Cell ss:MergeAcross="3" ss:StyleID="SummaryNavyHeader"><Data ss:Type="String">${carryOverLabel}</Data></Cell>
          <Cell ss:Formula="=&apos;${prevSheet}&apos;!R8C5" ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.carryOverCash.toFixed(2)}</Data></Cell>
          <Cell ss:Formula="=&apos;${prevSheet}&apos;!R8C6" ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.carryOverBank.toFixed(2)}</Data></Cell>
          <Cell ss:Formula="=RC[-2]+RC[-1]" ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.carryOverTotal.toFixed(2)}</Data></Cell>
        </Row>
      `);
    }

    // Row 6: Income Sum (Summe Einnahmen) - Formula SUMIF for K* and B*, plus Gesamt (empty payment method is NOT counted until marked)
    rowsXml.push(`
      <Row ss:Height="20">
        <Cell ss:MergeAcross="3" ss:StyleID="SummaryLightLabel"><Data ss:Type="String">${t.incomeSum}</Data></Cell>
        <Cell ss:Formula="=SUMIF(R11C2:R150C2,&quot;K*&quot;,R11C5:R150C5)" ss:StyleID="SummaryLightAmount"><Data ss:Type="Number">${m.incomeCash.toFixed(2)}</Data></Cell>
        <Cell ss:Formula="=SUMIF(R11C2:R150C2,&quot;B*&quot;,R11C5:R150C5)" ss:StyleID="SummaryLightAmount"><Data ss:Type="Number">${m.incomeBank.toFixed(2)}</Data></Cell>
        <Cell ss:Formula="=RC[-2]+RC[-1]" ss:StyleID="SummaryLightAmount"><Data ss:Type="Number">${m.totalIncome.toFixed(2)}</Data></Cell>
      </Row>
    `);

    // Row 7: Expense Sum (Summe Ausgaben) - Formula SUMIF for K* and B*, plus Gesamt (empty payment method is NOT counted until marked)
    rowsXml.push(`
      <Row ss:Height="20">
        <Cell ss:MergeAcross="3" ss:StyleID="SummaryLightLabel"><Data ss:Type="String">${t.expenseSum}</Data></Cell>
        <Cell ss:Formula="=SUMIF(R11C2:R150C2,&quot;K*&quot;,R11C6:R150C6)" ss:StyleID="SummaryLightAmount"><Data ss:Type="Number">${m.expenseCash.toFixed(2)}</Data></Cell>
        <Cell ss:Formula="=SUMIF(R11C2:R150C2,&quot;B*&quot;,R11C6:R150C6)" ss:StyleID="SummaryLightAmount"><Data ss:Type="Number">${m.expenseBank.toFixed(2)}</Data></Cell>
        <Cell ss:Formula="=RC[-2]+RC[-1]" ss:StyleID="SummaryLightAmount"><Data ss:Type="Number">${m.totalExpense.toFixed(2)}</Data></Cell>
      </Row>
    `);

    // Row 8: Current Balance (Aktueller Kassastand) - Formula Row 5 + Row 6 - Row 7
    rowsXml.push(`
      <Row ss:Height="22">
        <Cell ss:MergeAcross="3" ss:StyleID="SummaryNavyHeader"><Data ss:Type="String">${t.balance}</Data></Cell>
        <Cell ss:Formula="=R[-3]C+R[-2]C-R[-1]C" ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.currentBalanceCash.toFixed(2)}</Data></Cell>
        <Cell ss:Formula="=R[-3]C+R[-2]C-R[-1]C" ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.currentBalanceBank.toFixed(2)}</Data></Cell>
        <Cell ss:Formula="=RC[-2]+RC[-1]" ss:StyleID="SummaryNavyAmount"><Data ss:Type="Number">${m.currentBalanceTotal.toFixed(2)}</Data></Cell>
      </Row>
    `);

    rowsXml.push(`<Row ss:Height="12" />`);

    // Row 10: Main Transactions Table Column Headers (Cols A to G)
    rowsXml.push(`
      <Row ss:Height="22">
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.nr}</Data></Cell>
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.method}</Data></Cell>
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.date}</Data></Cell>
        <Cell ss:StyleID="ColHeaderLeft"><Data ss:Type="String">${t.description}</Data></Cell>
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.income}</Data></Cell>
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.expense}</Data></Cell>
        <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${t.balanceCol}</Data></Cell>
      </Row>
    `);

    // Rows 11..150: Transaction Rows with Alternating Zebra Striping (White & Light Gray)
    const totalDisplayRows = Math.max(50, m.transactions.length + 15);
    for (let i = 1; i <= totalDisplayRows; i++) {
      const isZebra = i % 2 === 0;
      const centerStyle = isZebra ? 'GridCenterZebra' : 'GridCenter';
      const leftStyle = isZebra ? 'GridLeftZebra' : 'GridLeft';
      const currStyle = isZebra ? 'GridCurrencyZebra' : 'GridCurrency';
      const saldoFormula = `ss:Formula="=IF(AND(RC2&lt;&gt;&quot;&quot;,OR(RC5&lt;&gt;&quot;&quot;,RC6&lt;&gt;&quot;&quot;)), R5C7+SUMIF(R11C2:RC2,&quot;?*&quot;,R11C5:RC5)-SUMIF(R11C2:RC2,&quot;?*&quot;,R11C6:RC6), &quot;&quot;)"`;

      if (i <= m.transactions.length) {
        const tx = m.transactions[i - 1];
        const methodTag = tx.paymentMethod === 'cash' ? 'K' : 'B';
        const formattedDate = formatShortDate(tx.date);
        const incomeVal = tx.type === 'income' ? tx.amount.toFixed(2) : '';
        const expenseVal = tx.type === 'expense' ? tx.amount.toFixed(2) : '';
        rowsXml.push(`
          <Row ss:Height="19">
            <Cell ss:StyleID="${centerStyle}"><Data ss:Type="Number">${i}</Data></Cell>
            <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${methodTag}</Data></Cell>
            <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String">${formattedDate}</Data></Cell>
            <Cell ss:StyleID="${leftStyle}"><Data ss:Type="String">${escapeXml(tx.description)}</Data></Cell>
            <Cell ss:StyleID="${currStyle}">${incomeVal ? `<Data ss:Type="Number">${incomeVal}</Data>` : '<Data ss:Type="String"></Data>'}</Cell>
            <Cell ss:StyleID="${currStyle}">${expenseVal ? `<Data ss:Type="Number">${expenseVal}</Data>` : '<Data ss:Type="String"></Data>'}</Cell>
            <Cell ${saldoFormula} ss:StyleID="${currStyle}"><Data ss:Type="String"></Data></Cell>
          </Row>
        `);
      } else {
        rowsXml.push(`
          <Row ss:Height="19">
            <Cell ss:StyleID="${centerStyle}"><Data ss:Type="Number">${i}</Data></Cell>
            <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String"></Data></Cell>
            <Cell ss:StyleID="${centerStyle}"><Data ss:Type="String"></Data></Cell>
            <Cell ss:StyleID="${leftStyle}"><Data ss:Type="String"></Data></Cell>
            <Cell ss:StyleID="${currStyle}"><Data ss:Type="String"></Data></Cell>
            <Cell ss:StyleID="${currStyle}"><Data ss:Type="String"></Data></Cell>
            <Cell ${saldoFormula} ss:StyleID="${currStyle}"><Data ss:Type="String"></Data></Cell>
          </Row>
        `);
      }
    }

    return `
    <Worksheet ss:Name="${m.monthName}">
      <Table ss:DefaultRowHeight="18" ss:DefaultColumnWidth="65">
        <Column ss:Index="1" ss:Width="42" />
        <Column ss:Index="2" ss:Width="85" />
        <Column ss:Index="3" ss:Width="80" />
        <Column ss:Index="4" ss:Width="250" />
        <Column ss:Index="5" ss:Width="105" />
        <Column ss:Index="6" ss:Width="105" />
        <Column ss:Index="7" ss:Width="110" />
        ${rowsXml.join('\n')}
      </Table>
      <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
        <PageSetup>
          <Layout x:Orientation="Portrait"/>
          <Header x:Margin="0.3"/>
          <Footer x:Margin="0.3"/>
          <PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/>
        </PageSetup>
        <DoNotDisplayGridlines/>
        <Selected/>
        <ProtectObjects>False</ProtectObjects>
        <ProtectScenarios>False</ProtectScenarios>
      </WorksheetOptions>
    </Worksheet>
    `;
  }).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>${titleText}</Title>
  <Author>SOCDOF</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:CharSet="0" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="MainTitle">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="18" ss:Color="#1B365D" ss:Bold="1"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
  </Style>
  <Style ss:ID="LegendCell">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="9" ss:Color="#64748B" ss:Italic="1"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
  </Style>
  <Style ss:ID="LabelBold">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="10" ss:Color="#1E293B" ss:Bold="1"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
  </Style>
  <Style ss:ID="PeriodValue">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="10" ss:Color="#1E293B"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
  </Style>
  <Style ss:ID="SummaryNavyHeader">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1B365D" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryNavyAmount">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1B365D" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryLightLabel">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="10" ss:Color="#1E293B" ss:Bold="1"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="SummaryLightAmount">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="ColHeader">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1B365D" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="ColHeaderLeft">
   <Font ss:FontName="Arial" x:CharSet="0" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#1B365D" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#0F172A"/>
   </Borders>
  </Style>
  <Style ss:ID="GridCenter">
   <Font ss:FontName="Calibri" x:CharSet="0" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="GridCenterZebra">
   <Font ss:FontName="Calibri" x:CharSet="0" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="GridLeft">
   <Font ss:FontName="Calibri" x:CharSet="0" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="GridLeftZebra">
   <Font ss:FontName="Calibri" x:CharSet="0" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Left"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="GridCurrency">
   <Font ss:FontName="Calibri" x:CharSet="0" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
  <Style ss:ID="GridCurrencyZebra">
   <Font ss:FontName="Calibri" x:CharSet="0" ss:Size="10" ss:Color="#1E293B"/>
   <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:Horizontal="Right"/>
   <NumberFormat ss:Format="#,##0.00"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
   </Borders>
  </Style>
 </Styles>
 ${worksheetsXml}
</Workbook>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function downloadTaxAdvisorExcel(
  year: number,
  ownerName: string,
  monthlyData: MonthlyLedgerData[],
  lang: string = 'de'
): void {
  const xmlContent = generateTaxAdvisorExcelXml(year, ownerName, monthlyData, '€', lang);
  const cleanOwner = (ownerName || 'Praxis').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Ein_und_Ausgaben_${cleanOwner}_${year}.xls`;
  const blob = new Blob([xmlContent], {
    type: 'application/vnd.ms-excel;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMonthlyCsv(
  monthData: MonthlyLedgerData,
  ownerName: string
): void {
  const cleanOwner = (ownerName || 'Praxis').replace(/[^a-zA-Z0-9_-]/g, '_');
  const lines: string[] = [
    `"EIN- UND AUSGABEN - ${ownerName || 'Praxis'}"`,
    `"Zeitraum: ${monthData.monthName} ${monthData.year}"`,
    '',
    `"Uebertrag Vormonat Kassa";"${monthData.carryOverCash.toFixed(2)}";"Uebertrag Vormonat Bank";"${monthData.carryOverBank.toFixed(2)}"`,
    `"Summe Einnahmen Kassa";"${monthData.incomeCash.toFixed(2)}";"Summe Einnahmen Bank";"${monthData.incomeBank.toFixed(2)}"`,
    `"Summe Ausgaben Kassa";"${monthData.expenseCash.toFixed(2)}";"Summe Ausgaben Bank";"${monthData.expenseBank.toFixed(2)}"`,
    `"Endstand Kassa";"${monthData.currentBalanceCash.toFixed(2)}";"Endstand Bank";"${monthData.currentBalanceBank.toFixed(2)}"`,
    '',
    `"Nr.";"Kassa/Bank";"Datum";"Beschreibung";"Einnahmen";"Ausgaben"`
  ];

  monthData.transactions.forEach((tx, idx) => {
    const nr = idx + 1;
    const method = tx.paymentMethod === 'cash' ? 'K' : 'B';
    const date = formatShortDate(tx.date);
    const desc = (tx.description || '').replace(/"/g, '""');
    const income = tx.type === 'income' ? tx.amount.toFixed(2) : '';
    const expense = tx.type === 'expense' ? tx.amount.toFixed(2) : '';
    lines.push(`"${nr}";"${method}";"${date}";"${desc}";"${income}";"${expense}"`);
  });

  const csvString = '\ufeff' + lines.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Kassenbuch_${cleanOwner}_${monthData.year}_${monthData.month + 1}_${monthData.monthName}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
