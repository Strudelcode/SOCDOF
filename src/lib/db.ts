import Dexie, { type Table } from 'dexie';
import { 
  Contact, 
  Product, 
  StockMove, 
  Invoice, 
  PurchaseOrder,
  POSOrder,
  ChatterMessage,
  CompanyProfile, 
  StockLocation 
} from '../types';

export class LocalOdooDB extends Dexie {
  contacts!: Table<Contact, number>;
  products!: Table<Product, number>;
  stock_moves!: Table<StockMove, number>;
  invoices!: Table<Invoice, number>;
  purchase_orders!: Table<PurchaseOrder, number>;
  pos_orders!: Table<POSOrder, number>;
  chatter_messages!: Table<ChatterMessage, number>;
  settings!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('LocalOdooERP_DB');

    this.version(2).stores({
      contacts: '++id, name, email, phone, company, type, createdAt',
      products: '++id, name, sku, barcode, sale_price, cost_price, qty_available, category, min_qty',
      stock_moves: '++id, product_id, qty, source_location, dest_location, date, reference',
      invoices: '++id, contact_id, number, date, due_date, status, type, total, sent_at, paid_at',
      purchase_orders: '++id, vendor_id, number, order_date, status, total',
      pos_orders: '++id, receipt_number, date, total, payment_method',
      chatter_messages: '++id, [res_model+res_id], created_at',
      settings: 'key'
    });
  }
}

export const db = new LocalOdooDB();

export const defaultCompanyProfile: CompanyProfile = {
  name: 'Ihr Firmenname',
  legal_form: '',
  street: '',
  zip_city: '',
  country: '',
  email: '',
  phone: '',
  tax_id: '',
  iban: '',
  bic: '',
  bank_name: '',
  currency: '€',
  default_tax_rate: 19,
  invoice_template: 'din5008',
  language: 'de',
  accent_color: 'indigo',
  theme_mode: 'light',
  glass_overlay: true,
  letterhead_show_bg: false,
  letterhead_show_fold_marks: true,
  letterhead_default_subject: 'Rechnung für Lieferungen und Leistungen',
  letterhead_managing_director: '',
  letterhead_commercial_register: '',
  letterhead_footer_line1: '',
  letterhead_footer_line2: '',
  letterhead_footer_line3: '',
  letterhead_footer_line4: '',
  backup_owner: '',
  backup_folder_path: '',
  max_storage_warning_kb: 5000, // 5 MB threshold warning
  auto_backup_enabled: true,
  backup_interval_minutes: 120, // 2 hours default
  backup_max_keep_count: 10,
  backup_notify_on_success: true
};

// Initial Database Setup (Starts clean without dummy data by default)
export async function seedInitialDataIfNeeded(forceDemo: boolean = false) {
  const companyProfileRecord = await db.settings.get('company_profile');
  if (!companyProfileRecord) {
    await db.settings.put({ key: 'company_profile', value: defaultCompanyProfile });
  } else {
    const existing = companyProfileRecord.value as CompanyProfile;
    // Auto-clean any legacy dummy data
    if (
      existing?.name === 'Nexus Technologies GmbH' ||
      existing?.name === "Strudel's Test GmbH" ||
      existing?.street === 'Innovationsring 42' ||
      existing?.street === 'Strudelstreet 99' ||
      existing?.tax_id === 'DE 304 882 109' ||
      existing?.tax_id === 'AB 123 456 789'
    ) {
      const cleaned: CompanyProfile = {
        ...existing,
        name: existing.name.includes('Test') || existing.name.includes('Nexus') ? '' : existing.name,
        legal_form: '',
        street: '',
        zip_city: '',
        country: '',
        email: '',
        phone: '',
        tax_id: '',
        iban: '',
        bic: '',
        bank_name: '',
        letterhead_managing_director: '',
        letterhead_commercial_register: '',
        letterhead_footer_line1: '',
        letterhead_footer_line2: '',
        letterhead_footer_line3: '',
        letterhead_footer_line4: '',
        backup_owner: '',
        backup_folder_path: ''
      };
      await db.settings.put({ key: 'company_profile', value: cleaned });
    }
  }

  // Only seed demo data if explicitly requested
  if (!forceDemo) {
    return;
  }

  // Clear before seeding demo data
  await db.contacts.clear();
  await db.products.clear();
  await db.stock_moves.clear();
  await db.invoices.clear();
  await db.purchase_orders.clear();
  await db.pos_orders.clear();
  await db.chatter_messages.clear();

  // 1. Initial Contacts
  const initialContacts: Contact[] = [
    {
      name: 'Dr. Florian Weber',
      company: 'AlpenTech Solutions AG',
      email: 'f.weber@alpentech.ch',
      phone: '+41 44 987 6543',
      type: 'customer',
      street: 'Bahnhofstrasse 10',
      zip: '8001',
      city: 'Zürich',
      country: 'Schweiz',
      taxId: 'CHE-109.876.543',
      avatar_color: 'bg-indigo-600',
      notes: 'Schlüsselkunde Schweiz. Bevorzugt Rechnungen mit 30 Tagen Zahlungsziel.',
      createdAt: '2026-08-01T09:00:00.000Z'
    },
    {
      name: 'Sabine Lindner',
      company: 'Studio Lindner & Partner',
      email: 's.lindner@studiolindner.de',
      phone: '+49 30 55443322',
      type: 'customer',
      street: 'Torstraße 140',
      zip: '10119',
      city: 'Berlin',
      country: 'Deutschland',
      taxId: 'DE 289 114 902',
      avatar_color: 'bg-violet-600',
      notes: 'Designagentur für UI/UX & Messebau.',
      createdAt: '2026-08-05T11:30:00.000Z'
    },
    {
      name: 'Marcus Bauer',
      company: 'Global Hardware Supply B.V.',
      email: 'orders@globalhardware.nl',
      phone: '+31 20 4455667',
      type: 'vendor',
      street: 'Keizersgracht 321',
      zip: '1016 EK',
      city: 'Amsterdam',
      country: 'Niederlande',
      taxId: 'NL 847291038B01',
      avatar_color: 'bg-emerald-600',
      notes: 'Hauptlieferant für IoT-Sensoren & Server-Komponenten.',
      createdAt: '2026-07-20T08:15:00.000Z'
    },
    {
      name: 'Elena Rossi',
      company: 'Milano Electronics S.r.l.',
      email: 'elena@milanoelec.it',
      phone: '+39 02 8765 4321',
      type: 'vendor',
      street: 'Via Montenapoleone 8',
      zip: '20121',
      city: 'Milano',
      country: 'Italien',
      taxId: 'IT 01928374650',
      avatar_color: 'bg-teal-600',
      notes: 'Lieferant für hochwertige Aluminiumgehäuse und Displays.',
      createdAt: '2026-07-25T14:00:00.000Z'
    },
    {
      name: 'Thomas Maier',
      company: 'Maier Logistik & IT',
      email: 't.maier@maier-logistik.at',
      phone: '+43 1 711 0022',
      type: 'both',
      street: 'Industriestraße 5',
      zip: '1030',
      city: 'Wien',
      country: 'Österreich',
      taxId: 'ATU 63524189',
      avatar_color: 'bg-amber-600',
      notes: 'Partner sowohl für Transport als auch Kunde für ERP-Lizenzen.',
      createdAt: '2026-08-08T10:00:00.000Z'
    }
  ];

  await db.contacts.bulkAdd(initialContacts);

  // 2. Initial Products
  const initialProducts: Product[] = [
    {
      name: "Strudel IoT Gateway Pro",
      sku: 'PRD-IOT-001',
      barcode: '426012345001',
      sale_price: 499.00,
      cost_price: 240.00,
      qty_available: 18,
      min_qty: 5,
      category: 'Hardware',
      image_emoji: '📡',
      unit: 'Stück',
      description: 'Industrielles Edge-Computing Gateway mit 5G & Zigbee Anbindung.',
      createdAt: '2026-07-15T10:00:00.000Z'
    },
    {
      name: 'OptiSense Umwelt-Sensor Node',
      sku: 'PRD-SNS-042',
      barcode: '426012345002',
      sale_price: 149.00,
      cost_price: 65.00,
      qty_available: 4, // Low stock warning trigger (< 5)
      min_qty: 10,
      category: 'Sensoren',
      image_emoji: '🌡️',
      unit: 'Stück',
      description: 'Präziser Sensor für Temperatur, CO2, Luftfeuchtigkeit und VOC.',
      createdAt: '2026-07-16T12:00:00.000Z'
    },
    {
      name: 'Aluminium Server-Rack Enclosure 1U',
      sku: 'PRD-ENC-100',
      barcode: '426012345003',
      sale_price: 289.00,
      cost_price: 135.00,
      qty_available: 2, // Low stock warning trigger (< 5)
      min_qty: 6,
      category: 'Zubehör',
      image_emoji: '🎛️',
      unit: 'Stück',
      description: 'Eloxiertes 19-Zoll Gehäuse mit integrierter Lüftersteuerung.',
      createdAt: '2026-07-18T14:30:00.000Z'
    },
    {
      name: 'CloudSync Enterprise Jahreslizenz',
      sku: 'LIC-CLS-01',
      barcode: '426012345004',
      sale_price: 1200.00,
      cost_price: 150.00,
      qty_available: 999, // Digital service / unlimited
      min_qty: 0,
      category: 'Software & Lizenzen',
      image_emoji: '⚡',
      unit: 'Lizenz',
      description: 'Zentrale Gerätesteuerung und Firmware-OTA Management.',
      createdAt: '2026-07-19T09:00:00.000Z'
    },
    {
      name: 'Wartung & Vor-Ort Integrationstag',
      sku: 'SRV-INT-DAY',
      barcode: '426012345005',
      sale_price: 1450.00,
      cost_price: 600.00,
      qty_available: 45,
      min_qty: 5,
      category: 'Dienstleistung',
      image_emoji: '🛠️',
      unit: 'Tag(e)',
      description: 'Senior Systemingenieur für Installation, Verkabelung und Inbetriebnahme.',
      createdAt: '2026-07-20T10:00:00.000Z'
    }
  ];

  await db.products.bulkAdd(initialProducts);

  // 3. Initial Double-Entry Stock Moves
  const initialMoves: StockMove[] = [
    {
      product_id: 1,
      product_name: "Strudel IoT Gateway Pro",
      product_sku: 'PRD-IOT-001',
      qty: 25,
      source_location: 'Virtual/Vendors',
      dest_location: 'Physical/Warehouse',
      reference: 'WH/IN/2026/001 - Initiale Lieferung',
      date: '2026-08-01T08:30:00.000Z',
      notes: 'Wareneingang Lieferschein GL-99238'
    },
    {
      product_id: 2,
      product_name: 'OptiSense Umwelt-Sensor Node',
      product_sku: 'PRD-SNS-042',
      qty: 15,
      source_location: 'Virtual/Vendors',
      dest_location: 'Physical/Warehouse',
      reference: 'WH/IN/2026/002 - Sensor Charge A',
      date: '2026-08-02T10:15:00.000Z',
      notes: 'Eingang von Global Hardware B.V.'
    },
    {
      product_id: 2,
      product_name: 'OptiSense Umwelt-Sensor Node',
      product_sku: 'PRD-SNS-042',
      qty: 11,
      source_location: 'Physical/Warehouse',
      dest_location: 'Virtual/Customers',
      reference: 'WH/OUT/2026/001 - Auslieferung AlpenTech',
      date: '2026-08-10T14:20:00.000Z',
      notes: 'Kundenauftrag SO-2026-001'
    },
    {
      product_id: 3,
      product_name: 'Aluminium Server-Rack Enclosure 1U',
      product_sku: 'PRD-ENC-100',
      qty: 10,
      source_location: 'Virtual/Vendors',
      dest_location: 'Physical/Warehouse',
      reference: 'WH/IN/2026/003 - Gehäuse Charge B',
      date: '2026-08-05T09:00:00.000Z',
      notes: 'Eingang von Milano Electronics'
    },
    {
      product_id: 3,
      product_name: 'Aluminium Server-Rack Enclosure 1U',
      product_sku: 'PRD-ENC-100',
      qty: 8,
      source_location: 'Physical/Warehouse',
      dest_location: 'Virtual/Customers',
      reference: 'WH/OUT/2026/002 - Auslieferung Lindner',
      date: '2026-08-12T16:45:00.000Z',
      notes: 'Kundenauftrag SO-2026-002'
    },
    {
      product_id: 1,
      product_name: "Strudel IoT Gateway Pro",
      product_sku: 'PRD-IOT-001',
      qty: 7,
      source_location: 'Physical/Warehouse',
      dest_location: 'Virtual/Customers',
      reference: 'WH/OUT/2026/003 - Auslieferung AlpenTech',
      date: '2026-08-14T11:00:00.000Z',
      notes: 'Kundenauftrag SO-2026-003'
    }
  ];

  await db.stock_moves.bulkAdd(initialMoves);

  // 4. Initial Invoices
  const initialInvoices: Invoice[] = [
    {
      contact_id: 1,
      contact_name: 'Dr. Florian Weber',
      contact_email: 'f.weber@alpentech.ch',
      contact_company: 'AlpenTech Solutions AG',
      contact_address: 'Bahnhofstrasse 10, 8001 Zürich, Schweiz',
      number: 'INV/2026/0001',
      date: '2026-08-10',
      due_date: '2026-09-09',
      status: 'paid',
      type: 'out_invoice',
      items: [
        {
          id: 'item_1',
          product_id: 1,
          product_name: "Strudel IoT Gateway Pro",
          sku: 'PRD-IOT-001',
          qty: 5,
          unit_price: 499.00,
          tax_rate: 19,
          discount: 0,
          subtotal: 2495.00
        },
        {
          id: 'item_2',
          product_id: 4,
          product_name: 'CloudSync Enterprise Jahreslizenz',
          sku: 'LIC-CLS-01',
          qty: 1,
          unit_price: 1200.00,
          tax_rate: 19,
          discount: 0,
          subtotal: 1200.00
        }
      ],
      subtotal: 3695.00,
      tax_total: 702.05,
      total: 4397.05,
      notes: 'Vielen Dank für Ihren Auftrag. Zahlungseingang am 15.08.2026 bestätigt.',
      payment_terms: '30 Tage netto',
      sent_at: '2026-08-10T15:00:00.000Z',
      paid_at: '2026-08-15T10:24:00.000Z',
      stock_moved: true
    },
    {
      contact_id: 2,
      contact_name: 'Sabine Lindner',
      contact_email: 's.lindner@studiolindner.de',
      contact_company: 'Studio Lindner & Partner',
      contact_address: 'Torstraße 140, 10119 Berlin, Deutschland',
      number: 'INV/2026/0002',
      date: '2026-08-14',
      due_date: '2026-08-28',
      status: 'posted',
      type: 'out_invoice',
      items: [
        {
          id: 'item_3',
          product_id: 3,
          product_name: 'Aluminium Server-Rack Enclosure 1U',
          sku: 'PRD-ENC-100',
          qty: 8,
          unit_price: 289.00,
          tax_rate: 19,
          discount: 5,
          subtotal: 2196.40
        },
        {
          id: 'item_4',
          product_id: 5,
          product_name: 'Wartung & Vor-Ort Integrationstag',
          sku: 'SRV-INT-DAY',
          qty: 1,
          unit_price: 1450.00,
          tax_rate: 19,
          discount: 0,
          subtotal: 1450.00
        }
      ],
      subtotal: 3646.40,
      tax_total: 692.82,
      total: 4339.22,
      notes: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
      payment_terms: '14 Tage netto',
      sent_at: '2026-08-14T16:00:00.000Z',
      stock_moved: true
    },
    {
      contact_id: 5,
      contact_name: 'Thomas Maier',
      contact_email: 't.maier@maier-logistik.at',
      contact_company: 'Maier Logistik & IT',
      contact_address: 'Industriestraße 5, 1030 Wien, Österreich',
      number: 'INV/2026/0003',
      date: '2026-08-18',
      due_date: '2026-09-01',
      status: 'draft',
      type: 'out_invoice',
      items: [
        {
          id: 'item_5',
          product_id: 1,
          product_name: "Strudel IoT Gateway Pro",
          sku: 'PRD-IOT-001',
          qty: 2,
          unit_price: 499.00,
          tax_rate: 19,
          discount: 0,
          subtotal: 998.00
        },
        {
          id: 'item_6',
          product_id: 2,
          product_name: 'OptiSense Umwelt-Sensor Node',
          sku: 'PRD-SNS-042',
          qty: 4,
          unit_price: 149.00,
          tax_rate: 19,
          discount: 0,
          subtotal: 596.00
        }
      ],
      subtotal: 1594.00,
      tax_total: 302.86,
      total: 1896.86,
      notes: 'Entwurf für anstehende Rollout-Phase.',
      payment_terms: '14 Tage netto',
      stock_moved: false
    }
  ];

  await db.invoices.bulkAdd(initialInvoices);

  // 5. Initial Purchase Orders (Einkauf)
  const initialPOs: PurchaseOrder[] = [
    {
      vendor_id: 3,
      vendor_name: 'Marcus Bauer',
      vendor_company: 'Global Hardware Supply B.V.',
      number: 'PO/2026/0001',
      order_date: '2026-08-16',
      expected_delivery: '2026-08-25',
      status: 'ordered',
      items: [
        {
          id: 'poi_1',
          product_id: 2,
          product_name: 'OptiSense Umwelt-Sensor Node',
          sku: 'PRD-SNS-042',
          qty: 20,
          unit_cost: 65.00,
          tax_rate: 19,
          subtotal: 1300.00
        }
      ],
      subtotal: 1300.00,
      tax_total: 247.00,
      total: 1547.00,
      notes: 'Standard Nachbestellung zur Aufstockung des Mindestbestands.'
    }
  ];

  await db.purchase_orders.bulkAdd(initialPOs);

  // 6. Initial Chatter Audit Logs
  const initialChatter: ChatterMessage[] = [
    {
      res_model: 'invoice',
      res_id: 1,
      author: 'System',
      content: 'Rechnung INV/2026/0001 gebucht und Status auf "Bezahlt" gesetzt.',
      type: 'system',
      created_at: '2026-08-15T10:24:00.000Z'
    },
    {
      res_model: 'invoice',
      res_id: 2,
      author: 'System',
      content: 'Warenabgang automatisch an Lager gebucht.',
      type: 'system',
      created_at: '2026-08-14T16:00:00.000Z'
    }
  ];

  await db.chatter_messages.bulkAdd(initialChatter);

  // 7. Default Settings
  await db.settings.put({ key: 'company_profile', value: defaultCompanyProfile });
}

/**
 * Executes a double-entry stock move and adjusts the product's quantity if
 * the physical warehouse is affected.
 */
export async function executeStockMove(move: Omit<StockMove, 'id'>): Promise<number> {
  const product = await db.products.get(move.product_id);
  if (!product) {
    throw new Error(`Produkt mit ID ${move.product_id} existiert nicht.`);
  }

  // Calculate delta for Physical/Warehouse
  let delta = 0;
  if (move.dest_location === 'Physical/Warehouse' && move.source_location !== 'Physical/Warehouse') {
    delta += move.qty;
  } else if (move.source_location === 'Physical/Warehouse' && move.dest_location !== 'Physical/Warehouse') {
    delta -= move.qty;
  }

  const updatedQty = (product.qty_available || 0) + delta;

  return await db.transaction('rw', db.stock_moves, db.products, async () => {
    await db.products.update(move.product_id, {
      qty_available: updatedQty
    });

    const moveId = await db.stock_moves.add({
      ...move,
      product_name: product.name,
      product_sku: product.sku
    });

    return moveId;
  });
}

/**
 * Generate next sequential invoice number
 */
export async function getNextInvoiceNumber(year: number = new Date().getFullYear()): Promise<string> {
  const invoices = await db.invoices.toArray();
  const prefix = `INV/${year}/`;
  let maxSeq = 0;

  for (const inv of invoices) {
    if (inv.number.startsWith(prefix)) {
      const seqStr = inv.number.replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Generate next sequential PO number
 */
export async function getNextPONumber(year: number = new Date().getFullYear()): Promise<string> {
  const pos = await db.purchase_orders.toArray();
  const prefix = `PO/${year}/`;
  let maxSeq = 0;

  for (const po of pos) {
    if (po.number.startsWith(prefix)) {
      const seqStr = po.number.replace(prefix, '');
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Process Goods Receipt from Purchase Order (Wareneingang)
 */
export async function receivePurchaseOrder(poId: number): Promise<void> {
  const po = await db.purchase_orders.get(poId);
  if (!po || po.status === 'received') return;

  for (const item of po.items) {
    await executeStockMove({
      product_id: item.product_id,
      qty: item.qty,
      source_location: 'Virtual/Vendors',
      dest_location: 'Physical/Warehouse',
      reference: `Wareneingang ${po.number}`,
      date: new Date().toISOString(),
      notes: `Eingang von ${po.vendor_name}`
    });
  }

  await db.purchase_orders.update(poId, {
    status: 'received',
    received_at: new Date().toISOString()
  });

  await db.chatter_messages.add({
    res_model: 'purchase',
    res_id: poId,
    author: 'System',
    content: `Wareneingang für Bestellung ${po.number} vollständig ins Hauptlager eingebucht.`,
    type: 'system',
    created_at: new Date().toISOString()
  });
}

/**
 * Process POS Terminal & Gastronomy Sale with automatic paid Invoice generation
 */
export async function createPOSCheckout(
  order: Omit<POSOrder, 'id'>,
  options?: {
    contactId?: number;
    contactName?: string;
    notes?: string;
    isGastro?: boolean;
    tableNumber?: string;
  }
): Promise<{ orderId: number; invoiceId: number }> {
  // 1. Deduct stock for all physical items if tracked
  for (const item of order.items) {
    if (item.product_id && item.product_id !== 9999) {
      try {
        const prod = await db.products.get(item.product_id);
        if (prod && prod.category !== 'Software & Lizenzen' && prod.category !== 'Dienstleistung') {
          await executeStockMove({
            product_id: item.product_id,
            qty: item.qty,
            source_location: 'Physical/Warehouse',
            dest_location: 'Virtual/Customers',
            reference: `Kassenbeleg ${order.receipt_number}`,
            date: new Date().toISOString(),
            notes: options?.isGastro 
              ? `Gastronomie Tischverkauf ${options.tableNumber || ''}` 
              : `Barverkauf / POS Terminal`
          });
        }
      } catch (e) {
        console.warn('POS stock deduction notice:', e);
      }
    }
  }

  // 2. Add to pos_orders table
  const orderId = await db.pos_orders.add(order as POSOrder);

  // 3. Create corresponding official paid Invoice in invoices table
  const invoiceDate = order.date.includes('T') ? order.date.split('T')[0] : order.date;
  const invoiceItems = order.items.map((i, idx) => ({
    id: `item-pos-${idx + 1}-${Date.now()}`,
    product_id: i.product_id || 0,
    product_name: i.product_name,
    sku: i.sku || 'POS',
    qty: i.qty,
    unit_price: i.price,
    tax_rate: i.tax_rate || 19,
    discount: 0,
    subtotal: i.subtotal || (i.price * i.qty)
  }));

  const invoiceNumber = order.receipt_number;
  const subject = options?.isGastro 
    ? `Gastronomie Bewirtung (${options.tableNumber || 'Tisch'}) • Kassenbeleg`
    : `Kassenbeleg ${order.receipt_number} • POS Direktverkauf`;

  const invoiceId = await db.invoices.add({
    contact_id: options?.contactId || 0,
    contact_name: options?.contactName || order.customer_name || 'Laufkundschaft',
    number: invoiceNumber,
    subject: subject,
    date: invoiceDate,
    due_date: invoiceDate,
    status: 'paid',
    type: 'out_invoice',
    items: invoiceItems,
    subtotal: order.subtotal,
    tax_total: order.tax_total,
    total: order.total,
    paid_at: order.date,
    payment_method: order.payment_method === 'cash' ? 'cash' : 'card',
    stock_moved: true,
    notes: options?.notes || `Erstellt über ${options?.isGastro ? 'Gastronomie & Bestell-Kasse' : 'POS Kassensystem'}. Zahlart: ${order.payment_method.toUpperCase()}.`
  });

  // 4. Record Chatter entry
  await db.chatter_messages.add({
    res_model: 'invoice',
    res_id: invoiceId,
    author: 'Kassensystem',
    content: `Kassenbeleg ${invoiceNumber} (${order.total.toFixed(2)} €) erfolgreich verbucht und bezahlt.`,
    type: 'system',
    created_at: new Date().toISOString()
  });

  return { orderId, invoiceId };
}

/**
 * Calculate database storage stats in Bytes, KB, records and warning triggers
 */
export async function getDatabaseStorageStats() {
  const [contacts, products, stock_moves, invoices, purchase_orders, pos_orders, chatter_messages, settings] = await Promise.all([
    db.contacts.toArray(),
    db.products.toArray(),
    db.stock_moves.toArray(),
    db.invoices.toArray(),
    db.purchase_orders.toArray(),
    db.pos_orders.toArray(),
    db.chatter_messages.toArray(),
    db.settings.toArray()
  ]);

  const rawJson = JSON.stringify({ contacts, products, stock_moves, invoices, purchase_orders, pos_orders, chatter_messages, settings });
  const sizeBytes = new Blob([rawJson]).size;
  const sizeKB = Number((sizeBytes / 1024).toFixed(2));
  const sizeMB = Number((sizeBytes / (1024 * 1024)).toFixed(3));
  const totalRecords = contacts.length + products.length + stock_moves.length + invoices.length + purchase_orders.length + pos_orders.length + chatter_messages.length;

  return {
    sizeBytes,
    sizeKB,
    sizeMB,
    totalRecords,
    counts: {
      contacts: contacts.length,
      products: products.length,
      stock_moves: stock_moves.length,
      invoices: invoices.length,
      purchase_orders: purchase_orders.length,
      pos_orders: pos_orders.length,
      chatter_messages: chatter_messages.length
    }
  };
}

/**
 * Helper to export the entire IndexedDB database to lightweight optimized JSON
 */
export async function exportDatabaseToJson(options?: { pretty?: boolean; owner?: string; folder?: string }): Promise<string> {
  const contacts = await db.contacts.toArray();
  const products = await db.products.toArray();
  const stock_moves = await db.stock_moves.toArray();
  const invoices = await db.invoices.toArray();
  const purchase_orders = await db.purchase_orders.toArray();
  const pos_orders = await db.pos_orders.toArray();
  const chatter_messages = await db.chatter_messages.toArray();
  const settings = await db.settings.toArray();

  const exportData = {
    app: 'SOCDOF_Enterprise_Local_ERP',
    version: 2,
    exported_at: new Date().toISOString(),
    backup_owner: options?.owner || 'System Admin',
    backup_target_folder: options?.folder || 'C:\\ERP-Daten\\SOCDOF_Backups',
    data_summary: {
      contacts_count: contacts.length,
      invoices_count: invoices.length,
      products_count: products.length,
      purchases_count: purchase_orders.length
    },
    contacts,
    products,
    stock_moves,
    invoices,
    purchase_orders,
    pos_orders,
    chatter_messages,
    settings
  };

  // If minified/light mode requested or small file, minimize whitespace to keep file tiny
  return options?.pretty === false ? JSON.stringify(exportData) : JSON.stringify(exportData, null, 2);
}

/**
 * Helper to import JSON data into IndexedDB
 */
export async function importDatabaseFromJson(jsonStr: string): Promise<boolean> {
  const parsed = JSON.parse(jsonStr);
  if (!parsed.contacts || !parsed.products || !parsed.invoices) {
    throw new Error('Ungültiges Datenformat für SOCDOF ERP Backup.');
  }

  await db.transaction('rw', [
    db.contacts, 
    db.products, 
    db.stock_moves, 
    db.invoices, 
    db.purchase_orders, 
    db.pos_orders, 
    db.chatter_messages, 
    db.settings
  ], async () => {
    await db.contacts.clear();
    await db.products.clear();
    await db.stock_moves.clear();
    await db.invoices.clear();
    await db.purchase_orders.clear();
    await db.pos_orders.clear();
    await db.chatter_messages.clear();
    await db.settings.clear();

    if (parsed.contacts?.length) await db.contacts.bulkAdd(parsed.contacts);
    if (parsed.products?.length) await db.products.bulkAdd(parsed.products);
    if (parsed.stock_moves?.length) await db.stock_moves.bulkAdd(parsed.stock_moves);
    if (parsed.invoices?.length) await db.invoices.bulkAdd(parsed.invoices);
    if (parsed.purchase_orders?.length) await db.purchase_orders.bulkAdd(parsed.purchase_orders);
    if (parsed.pos_orders?.length) await db.pos_orders.bulkAdd(parsed.pos_orders);
    if (parsed.chatter_messages?.length) await db.chatter_messages.bulkAdd(parsed.chatter_messages);
    if (parsed.settings?.length) await db.settings.bulkAdd(parsed.settings);
  });

  return true;
}

/**
 * Reset all tables and restore clean sample demo dataset
 */
export async function resetDatabaseToDemo(): Promise<void> {
  localStorage.removeItem('odoo_clean_mode');
  await seedInitialDataIfNeeded(true);
}

/**
 * Clear all tables to a clean, empty database for users who want 0 demo examples
 */
export async function clearDatabaseToEmpty(): Promise<void> {
  localStorage.setItem('odoo_clean_mode', 'true');
  await db.contacts.clear();
  await db.products.clear();
  await db.stock_moves.clear();
  await db.invoices.clear();
  await db.purchase_orders.clear();
  await db.pos_orders.clear();
  await db.chatter_messages.clear();
  await db.settings.put({ key: 'company_profile', value: defaultCompanyProfile });
}
