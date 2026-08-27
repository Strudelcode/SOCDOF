export type ContactType = 'customer' | 'vendor' | 'both';

export interface Contact {
  id?: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  type: ContactType;
  street?: string;
  zip?: string;
  city?: string;
  country?: string;
  taxId?: string;
  fiscal_code?: string;
  sdi_recipient_code?: string;
  pec?: string;
  is_public_admin?: boolean;
  notes?: string;
  avatar_color?: string;
  createdAt: string;
}

export interface Product {
  id?: number;
  name: string;
  sku: string;
  sale_price: number;
  cost_price: number;
  qty_available: number;
  category?: string;
  unit?: string;
  min_qty?: number;
  barcode?: string;
  image_emoji?: string;
  image_url?: string;
  web_link?: string;
  source_domain?: string;
  description?: string;
  createdAt?: string;
}

export type StockLocation = 
  | 'Virtual/Vendors'
  | 'Physical/Warehouse'
  | 'Virtual/Customers'
  | 'Virtual/Inventory-Loss'
  | 'Virtual/Scrap';

export interface StockMove {
  id?: number;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  qty: number;
  source_location: StockLocation;
  dest_location: StockLocation;
  reference: string;
  date: string;
  notes?: string;
}

export interface InvoiceItem {
  id: string;
  product_id: number;
  product_name: string;
  sku: string;
  qty: number;
  unit_price: number;
  tax_rate: number; // e.g. 19 for 19%
  discount: number; // e.g. 0 or 10 for 10%
  subtotal: number;
}

export type InvoiceStatus = 'draft' | 'posted' | 'paid' | 'cancelled';
export type InvoiceType = 'out_invoice' | 'in_invoice'; // out = customer invoice, in = vendor bill

export type SdIStatus = 
  | 'not_sent'        // Non inviata / Nicht versendet
  | 'sent'            // Inviata a SdI / An SdI übermittelt
  | 'delivered'       // Consegnata (RC) / Zugestellt
  | 'rejected'        // Scartata (NS) / Abgelehnt
  | 'failed_delivery' // Mancata Consegna (MC) / Steuerfach (nicht zugestellt)
  | 'accepted'        // Accettata da PA (NE) / Von Behörde akzeptiert
  | 'refused';        // Rifiutata da PA (NE) / Von Behörde abgelehnt

export type SdIReceiptType = 'RC' | 'NS' | 'MC' | 'NE' | 'DT' | 'AT';

export interface Invoice {
  id?: number;
  contact_id: number;
  contact_name?: string;
  contact_email?: string;
  contact_company?: string;
  contact_address?: string;
  number: string;
  subject?: string;
  date: string;
  due_date: string;
  status: InvoiceStatus;
  type: InvoiceType;
  items: InvoiceItem[];
  subtotal: number;
  tax_total: number;
  total: number;
  notes?: string;
  payment_terms?: string;
  sent_at?: string;
  paid_at?: string;
  payment_method?: 'card' | 'cash' | 'transfer';
  payment_reference?: string;
  tse_signature?: string;
  stock_moved?: boolean;

  // Italian E-Invoicing (FatturaPA & SdI)
  document_type?: string; // e.g. TD01 (Fattura), TD02 (Acconto), TD04 (Nota di Credito), TD24 (Fattura Differita)
  sdi_status?: SdIStatus;
  sdi_format?: 'FPR12' | 'FPA12' | string;
  sdi_identifier?: string; // IdentificativoSdI (e.g. 982347101)
  sdi_date?: string; // Timestamp of delivery / rejection / outcome
  sdi_recipient_code?: string; // 7 chars (e.g. 0000000, SUBM70N) or 6 chars for PA
  sdi_pec?: string; // PEC destination
  sdi_error_code?: string; // Error code from NS (e.g. 00404, 00200)
  sdi_error_message?: string; // Error description from NS
  sdi_receipt_type?: SdIReceiptType;
  sdi_filename?: string; // e.g. IT01234567890_00001.xml
  sdi_bollo_virtuale?: boolean; // Imposta di bollo (2,00 €)
  bollo_virtuale?: boolean; // Imposta di bollo (2,00 €)
  bollo_amount?: number;
  pa_cup?: string; // Codice Unitario Progetto (PA)
  sdi_cup?: string;
  pa_cig?: string; // Codice Identificativo Gara (PA)
  sdi_cig?: string;
  regime_fiscale?: string; // RF01, RF19 Forfettario, etc.
  sdi_last_update?: string;
  sdi_receipts?: Array<{
    type: string;
    date: string;
    messageId?: string;
    description?: string;
    rawXml?: string;
  }>;
}

export type PurchaseOrderStatus = 'draft' | 'rfq_sent' | 'ordered' | 'received' | 'billed';

export interface PurchaseOrderItem {
  id: string;
  product_id: number;
  product_name: string;
  sku: string;
  qty: number;
  unit_cost: number;
  tax_rate: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id?: number;
  vendor_id: number;
  vendor_name: string;
  vendor_company?: string;
  number: string;
  order_date: string;
  expected_delivery: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  subtotal: number;
  tax_total: number;
  total: number;
  received_at?: string;
  notes?: string;
}

export interface POSOrderItem {
  product_id: number;
  product_name: string;
  sku: string;
  qty: number;
  price: number;
  tax_rate: number;
  subtotal: number;
}

export interface POSOrder {
  id?: number;
  receipt_number: string;
  date: string;
  items: POSOrderItem[];
  subtotal: number;
  tax_total: number;
  total: number;
  payment_method: 'cash' | 'card' | 'nfc';
  cash_tendered?: number;
  cash_change?: number;
  customer_name?: string;
}

export interface ChatterMessage {
  id?: number;
  res_model: 'contact' | 'invoice' | 'product' | 'purchase' | 'stock';
  res_id: number;
  author: string;
  content: string;
  type: 'comment' | 'system' | 'activity';
  created_at: string;
}

export interface CompanyProfile {
  name: string;
  legal_form: string;
  street: string;
  zip_city: string;
  country: string;
  email: string;
  phone: string;
  tax_id: string;
  iban: string;
  bic: string;
  bank_name: string;
  currency: string;
  logo_url?: string;
  default_tax_rate: number;
  theme_color?: 'odoo-purple' | 'odoo-teal' | 'odoo-blue' | 'odoo-dark' | 'odoo-emerald';
  invoice_template?: 'odoo-modern' | 'din5008' | 'clean' | 'compact';
  default_payment_terms?: string;
  pos_header_text?: string;
  pos_footer_text?: string;
  sound_effects?: boolean;
  
  // Theme & Appearance (Windows inspired)
  theme_mode?: 'light' | 'dark' | 'system';
  glass_overlay?: boolean;
  accent_color?: string;
  taskbar_tint?: 'default' | 'accent' | 'dark' | 'glass';
  font_scale?: number; // 90 to 130 (%)
  desktop_wallpaper_url?: string;
  disable_exe_reminders?: boolean;
  disable_exit_prompt?: boolean;
  launch_maximized?: boolean;
  github_auto_check_updates?: boolean;
  language?: 'de' | 'en' | 'fr' | 'es';
  date_format?: 'DD.MM.YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  time_show_seconds?: boolean;
  timezone?: string;

  // Calendar & External Connections
  google_cal_sync_enabled?: boolean;
  google_cal_feed_url?: string;
  google_cal_target_calendar_id?: string;
  google_cal_sync_interval_mins?: number;
  google_cal_auto_sync_invoices?: boolean;
  google_cal_last_sync_time?: string;
  ical_export_enabled?: boolean;

  // Italian E-Invoicing (FatturaPA & SdI)
  sdi_transmitter_country?: string; // Default 'IT'
  sdi_transmitter_vat?: string;
  sdi_regime_fiscale?: string; // e.g. RF01 (Ordinario), RF19 (Forfettario), RF02 (Minimi)
  sdi_default_recipient_code?: string; // e.g. 0000000
  sdi_pec?: string;
  sdi_tax_id?: string;
  sdi_fiscal_code?: string;

  // Letterhead & Briefpapier Settings
  letterhead_photo_url?: string;
  letterhead_show_bg?: boolean;
  letterhead_show_fold_marks?: boolean;
  letterhead_default_subject?: string;
  letterhead_managing_director?: string;
  letterhead_commercial_register?: string;
  letterhead_footer_line1?: string;
  letterhead_footer_line2?: string;
  letterhead_footer_line3?: string;
  letterhead_footer_line4?: string;

  // Backup & Storage Settings
  backup_owner?: string;
  backup_folder_path?: string;
  max_storage_warning_kb?: number;
  auto_backup_enabled?: boolean;
  backup_interval_minutes?: number; // e.g. 15, 30, 60, 120 (2h), 360 (6h), 720 (12h), 1440 (24h)
  backup_max_keep_count?: number; // default 10
  last_backup_timestamp?: string;
  backup_notify_on_success?: boolean;
}

export type ViewMode = 'kanban' | 'list' | 'pivot' | 'form';

export type ActiveModule = 
  | 'launcher' 
  | 'dashboard' 
  | 'calendar'
  | 'contacts' 
  | 'products' 
  | 'stock' 
  | 'invoices' 
  | 'purchases' 
  | 'pos' 
  | 'settings' 
  | 'accounting' 
  | 'appstore' 
  | 'docs'
  | 'restaurant'
  | 'ios_billing'
  | 'support_services';

export interface SupportTimesheetEntry {
  id: string;
  ticket_id?: string;
  date: string;
  staff: string;
  description: string;
  hours: number;
  hourlyRate?: number;
  billable?: boolean;
  startedAt?: string;
  endedAt?: string;
}

export interface SupportActivityEntry {
  id: string;
  author: string;
  type: 'message' | 'note' | 'activity' | 'system';
  content: string;
  createdAt: string;
}

export interface SupportServiceTicket {
  id: string;
  ticketNumber: string;
  title: string;
  team: string;
  assignedStaff: string;
  priority: 0 | 1 | 2 | 3;
  tags: string[];
  contact_id?: number;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_company?: string;
  status: 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed' | 'invoiced';
  description: string;
  timesheets: SupportTimesheetEntry[];
  activities: SupportActivityEntry[];
  hourlyRate?: number;
  billable: boolean;
  isTimerRunning?: boolean;
  timerStartedAt?: string;
  invoice_id?: number;
  invoice_number?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DesktopFolder {
  id: string;
  name: string;
  modules: ActiveModule[];
  createdAt: string;
  color?: string;
}

export interface IOSSubcategoryOption {
  id: string;
  groupName: string; // e.g. 'Beilage', 'Dressing', 'Extras', 'Größe'
  name: string;      // e.g. 'Kartoffelsalat', 'Pommes Frites', 'Knoblauch-Dip'
  extraPrice: number;
  isDefault?: boolean;
}

export interface IOSDishItem {
  id: string;
  name: string;
  category: string;
  price: number;
  taxRate: number; // 7 or 19
  description?: string;
  emoji?: string;
  imageUrl?: string;
  isEnabled: boolean; // toggle enable/disable
  subcategories: IOSSubcategoryOption[];
  inventoryQty?: number;
  sku?: string;
  createdAt: string;
}

export interface IOSBillingCartItem {
  id: string;
  dishId: string;
  name: string;
  basePrice: number;
  unitPrice: number;
  qty: number;
  taxRate: number;
  emoji?: string;
  imageUrl?: string;
  selectedOptions: IOSSubcategoryOption[];
  notes?: string;
}

export interface IOSBillingReceipt {
  id: string;
  receiptNumber: string;
  date: string;
  items: IOSBillingCartItem[];
  subtotal: number;
  tax7Total: number;
  tax19Total: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'apple_pay';
  cashTendered?: number;
  cashChange?: number;
  customerNote?: string;
  tseSignature?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  category: 'starters' | 'mains' | 'pizza' | 'burgers' | 'desserts' | 'drinks';
  price: number;
  taxRate: number; // 7% for food or 19% for drinks / dine-in
  ingredients?: string;
  allergens?: string[];
  emoji?: string;
  prepTimeMinutes?: number;
  isAvailable: boolean;
}

export interface TableOrderItem {
  menuItemId: string;
  name: string;
  qty: number;
  price: number;
  taxRate: number;
  notes?: string;
}

export interface TableOrder {
  id: string;
  tableNumber: string; // e.g. "Tisch 1", "Tisch 4", "Bar 2", "Terrasse 1", "To-Go"
  serverName: string;
  status: 'ordered' | 'preparing' | 'ready' | 'served' | 'paid';
  items: TableOrderItem[];
  subtotal: number;
  taxTotal: number;
  total: number;
  createdAt: string;
  paidAt?: string;
  paymentMethod?: 'cash' | 'card' | 'nfc';
}

export interface StoreApp {
  id: ActiveModule;
  title: string;
  category: 'core' | 'finance' | 'sales' | 'inventory' | 'productivity' | 'gastro';
  description: string;
  iconName: string;
  badge?: string;
  author: string;
  version: string;
  isInstalled: boolean;
  isFinancial?: boolean;
  isSystem?: boolean;
  tags?: string[];
  isPinnedDesktop?: boolean;
  isPinnedTaskbar?: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  target?: string;
  description: string;
  icon: string;
  actionHint?: string;
}

export interface AppWindow {
  id: string;
  module: ActiveModule;
  title: string;
  iconName: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GoogleCalendarItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole?: string;
  selected?: boolean;
}

export interface CalendarAppEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endDate?: string; // YYYY-MM-DD
  endTime?: string; // HH:mm
  isAllDay?: boolean;
  category?: 'invoice' | 'customer' | 'meeting' | 'deadline' | 'personal' | 'general' | 'google';
  color?: string;
  source: 'google' | 'invoice' | 'local';
  googleCalendarId?: string;
  googleEventId?: string;
  htmlLink?: string;
  syncedAt?: string;
  invoiceId?: number;
  invoiceNumber?: string;
  createdAt?: string;
  updatedAt?: string;
}


