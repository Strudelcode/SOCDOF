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
  language?: 'de' | 'en' | 'fr' | 'es';
  date_format?: 'DD.MM.YYYY' | 'YYYY-MM-DD' | 'MM/DD/YYYY';
  time_show_seconds?: boolean;
  timezone?: string;

  // Calendar & External Connections
  google_cal_sync_enabled?: boolean;
  google_cal_feed_url?: string;
  ical_export_enabled?: boolean;

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
}

export type ViewMode = 'kanban' | 'list' | 'pivot' | 'form';

export type ActiveModule = 
  | 'launcher' 
  | 'dashboard' 
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

export interface SupportServiceTicket {
  id: string;
  title: string;
  contact_id?: number;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  contact_company?: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  assignedStaff: string;
  hourlyRate?: number;
  billable: boolean;
  status: 'open' | 'in_progress' | 'completed' | 'invoiced';
  tags: string[];
  description: string;
  internalNotes?: string;
  invoice_id?: number;
  invoice_number?: string;
  createdAt: string;
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

