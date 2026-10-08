import { BillingItem, Client } from './types';
import { db } from '../../lib/db';
import { Invoice } from '../../types';

const AUTO_SYNC_STORAGE_KEY = 'socdof_therapy_invoices_auto_sync';

/**
 * Check whether auto-synchronization between Therapy Practice and Invoices app is enabled.
 * Defaults to true for seamless real-time syncing.
 */
export function isAutoSyncEnabled(): boolean {
  try {
    const val = localStorage.getItem(AUTO_SYNC_STORAGE_KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

/**
 * Persist auto-synchronization setting.
 */
export function setAutoSyncEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_SYNC_STORAGE_KEY, enabled ? 'true' : 'false');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socdof:therapy-sync-setting-changed', { detail: { enabled } }));
    }
  } catch (e) {
    console.error('Failed to save therapy auto-sync setting', e);
  }
}

/**
 * Resolves or creates a matching CRM contact in db.contacts so that invoices have full customer details.
 */
export async function resolveOrCreateContact(client?: Client): Promise<{
  contactId: number;
  contactName: string;
  contactEmail: string;
  contactAddress: string;
}> {
  if (!client) {
    return {
      contactId: 0,
      contactName: 'Praxis-Klient',
      contactEmail: '',
      contactAddress: ''
    };
  }

  const formattedAddress = [
    client.address,
    [client.zip, client.city].filter(Boolean).join(' ')
  ].filter(Boolean).join(', ');

  try {
    // 1. Try to find by contactId if already linked
    if (client.contactId) {
      const numId = Number(client.contactId);
      if (!isNaN(numId)) {
        const existingById = await db.contacts.get(numId);
        if (existingById) {
          return {
            contactId: Number(existingById.id || numId),
            contactName: existingById.name,
            contactEmail: existingById.email || client.email || '',
            contactAddress: formattedAddress || existingById.street || ''
          };
        }
      }
    }

    // 2. Try to find by exact email
    if (client.email) {
      const existingByEmail = await db.contacts.where('email').equalsIgnoreCase(client.email.trim()).first();
      if (existingByEmail) {
        return {
          contactId: existingByEmail.id || 0,
          contactName: existingByEmail.name,
          contactEmail: existingByEmail.email || '',
          contactAddress: formattedAddress || existingByEmail.street || ''
        };
      }
    }

    // 3. Try to find by client name
    const existingByName = await db.contacts.where('name').equalsIgnoreCase(client.name.trim()).first();
    if (existingByName) {
      return {
        contactId: existingByName.id || 0,
        contactName: existingByName.name,
        contactEmail: existingByName.email || client.email || '',
        contactAddress: formattedAddress || existingByName.street || ''
      };
    }

    // 4. Create new customer contact in CRM
    const newId = await db.contacts.add({
      name: client.name || 'Praxis-Klient',
      email: client.email || '',
      phone: client.phone || client.contact || '',
      company: client.company || '',
      street: client.address || '',
      zip: client.zip || '',
      city: client.city || '',
      type: 'customer',
      createdAt: new Date().toISOString()
    });

    return {
      contactId: Number(newId),
      contactName: client.name || 'Praxis-Klient',
      contactEmail: client.email || '',
      contactAddress: formattedAddress
    };
  } catch (err) {
    console.error('Error resolving CRM contact for practice invoice sync:', err);
    return {
      contactId: 0,
      contactName: client.name || 'Praxis-Klient',
      contactEmail: client.email || '',
      contactAddress: formattedAddress
    };
  }
}

/**
 * Synchronize a single BillingItem to the official db.invoices table.
 * Supports bidirectional payment status updates.
 */
export async function syncBillingItemToDb(
  item: BillingItem, 
  client?: Client
): Promise<{ 
  updatedItem: BillingItem; 
  isNew: boolean; 
  statusUpdated: boolean;
}> {
  const contactInfo = await resolveOrCreateContact(client);
  const amount = Number(item.amount) || 0;
  const taxRate = item.taxRate || 0;
  const taxAmount = (amount * taxRate) / 100;
  const total = amount + taxAmount;
  
  // Guarantee persistent invoice number
  const invoiceNumber = item.invoiceNumber && item.invoiceNumber.trim() !== ''
    ? item.invoiceNumber.trim()
    : `PRAXIS-${Date.now().toString().slice(-6)}`;

  const existingInv = await db.invoices.where('number').equals(invoiceNumber).first();
  let statusUpdated = false;
  let nextStatus: BillingItem['status'] = item.status;

  // Two-way sync: If invoice exists in DB and is marked as 'paid', reflect that in Praxis
  if (existingInv && existingInv.status === 'paid' && item.status !== 'paid') {
    nextStatus = 'paid';
    statusUpdated = true;
  }

  const isPaid = nextStatus === 'paid';
  const invRecord: Omit<Invoice, 'id'> = {
    contact_id: contactInfo.contactId,
    contact_name: contactInfo.contactName,
    contact_email: contactInfo.contactEmail,
    contact_address: contactInfo.contactAddress,
    number: invoiceNumber,
    subject: `Praxisabrechnung: ${item.service || 'Heilbehandlung / Beratung'}`,
    type: 'out_invoice',
    status: isPaid ? 'paid' : 'posted',
    date: item.date || new Date().toISOString().slice(0, 10),
    due_date: item.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    subtotal: amount,
    tax_total: taxAmount,
    total: total,
    paid_at: isPaid ? (item.date || new Date().toISOString().slice(0, 10)) : undefined,
    payment_method: item.paymentMethod === 'bank' ? 'transfer' : item.paymentMethod === 'cash' ? 'cash' : undefined,
    payment_terms: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
    items: [
      {
        id: `item_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        product_id: 0,
        product_name: item.service || 'Praxis- & Therapieleistung',
        sku: 'PRAXIS-01',
        qty: 1,
        unit_price: amount,
        tax_rate: taxRate,
        discount: 0,
        subtotal: amount
      }
    ],
    notes: item.notes ? `${item.notes} • [Synchronisiert mit Praxis & Therapie]` : 'Erstellt aus Praxis-Modul (Heilbehandlung / Psychotherapie)'
  };

  let isNew = false;
  if (existingInv && existingInv.id) {
    await db.invoices.update(existingInv.id, invRecord);
  } else {
    await db.invoices.add(invRecord as Invoice);
    isNew = true;
  }

  const updatedItem: BillingItem = {
    ...item,
    invoiceNumber,
    status: nextStatus === 'draft' ? 'invoiced' : nextStatus,
    syncedToInvoices: true,
    syncedAt: new Date().toISOString()
  };

  return { updatedItem, isNew, statusUpdated };
}

/**
 * Synchronize ALL practice billing entries with db.invoices in one atomic pass.
 * Also checks for payments registered in the Invoices app and syncs them back to Praxis.
 */
export async function syncAllPracticeBilling(
  billing: BillingItem[], 
  clients: Client[]
): Promise<{
  updatedBilling: BillingItem[];
  syncedCount: number;
  newCount: number;
  statusUpdatedCount: number;
}> {
  if (!billing || billing.length === 0) {
    return {
      updatedBilling: [],
      syncedCount: 0,
      newCount: 0,
      statusUpdatedCount: 0
    };
  }

  const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));
  let newCount = 0;
  let statusUpdatedCount = 0;
  let syncedCount = 0;

  const updatedBilling: BillingItem[] = [];

  for (const item of billing) {
    try {
      const client = clientMap.get(item.clientId);
      const res = await syncBillingItemToDb(item, client);
      if (res.isNew) newCount++;
      if (res.statusUpdated) statusUpdatedCount++;
      syncedCount++;
      updatedBilling.push(res.updatedItem);
    } catch (err) {
      console.error('Failed to sync billing item:', item.id, err);
      updatedBilling.push(item);
    }
  }

  // Dispatch standard events so other tabs and Invoices app update in real time
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('socdof:invoices-changed'));
    window.dispatchEvent(new CustomEvent('socdof:contacts-changed'));
    window.dispatchEvent(new CustomEvent('socdof:therapy-synced', { 
      detail: { syncedCount, newCount, statusUpdatedCount } 
    }));
  }

  return {
    updatedBilling,
    syncedCount,
    newCount,
    statusUpdatedCount
  };
}

/**
 * Checks for external status changes in db.invoices (e.g. user marked invoice as paid in Invoices app)
 * and updates corresponding billing items in Praxis.
 */
export async function checkInvoicesStatusUpdates(billing: BillingItem[]): Promise<{
  updatedBilling: BillingItem[];
  hasChanges: boolean;
}> {
  if (!billing || billing.length === 0) {
    return { updatedBilling: billing, hasChanges: false };
  }

  const invoiceNumbers = billing
    .map(b => b.invoiceNumber)
    .filter((num): num is string => Boolean(num && num.trim().length > 0));

  if (invoiceNumbers.length === 0) {
    return { updatedBilling: billing, hasChanges: false };
  }

  try {
    const existingInvoices = await db.invoices
      .where('number')
      .anyOf(invoiceNumbers)
      .toArray();

    const invStatusMap = new Map<string, string>();
    existingInvoices.forEach(inv => {
      invStatusMap.set(inv.number, inv.status);
    });

    let hasChanges = false;
    const updatedBilling = billing.map(item => {
      if (item.invoiceNumber && invStatusMap.has(item.invoiceNumber)) {
        const invStatus = invStatusMap.get(item.invoiceNumber);
        if (invStatus === 'paid' && item.status !== 'paid') {
          hasChanges = true;
          return {
            ...item,
            status: 'paid' as const,
            syncedToInvoices: true,
            syncedAt: new Date().toISOString()
          };
        }
      }
      return item;
    });

    return { updatedBilling, hasChanges };
  } catch (err) {
    console.error('Error checking invoice status updates:', err);
    return { updatedBilling: billing, hasChanges: false };
  }
}
