import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Users, Check, User, MapPin, Mail, Phone, FileText } from 'lucide-react';
import { Client, BillingItem } from './types';
import { useLanguage, t } from '../../lib/i18n';
import { sounds } from '../../lib/sound';

interface TherapyClientFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  billing?: BillingItem[];
}

export const TherapyClientFilterModal: React.FC<TherapyClientFilterModalProps> = ({
  isOpen,
  onClose,
  clients,
  selectedClientId,
  onSelectClient,
  billing
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Count billing invoices per client
  const invoiceCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (billing) {
      billing.forEach(b => {
        map.set(b.clientId, (map.get(b.clientId) || 0) + 1);
      });
    }
    return map;
  }, [billing]);

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return clients;

    return clients.filter(c => {
      const name = (c.name || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      const phone = (c.phone || c.contact || '').toLowerCase();
      const city = (c.city || '').toLowerCase();
      const address = (c.address || '').toLowerCase();
      const diagnosis = (c.diagnosis || '').toLowerCase();

      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        city.includes(q) ||
        address.includes(q) ||
        diagnosis.includes(q)
      );
    });
  }, [clients, search]);

  if (!isOpen) return null;

  const handleChoose = (id: string) => {
    sounds.playPop();
    onSelectClient(id);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 my-8 animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'de' ? 'Klient auswählen & filtern' : 'Select & Filter Client'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {clients.length} {lang === 'de' ? 'Klienten in Praxis erfasst' : 'clients registered'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'de' ? 'Klient nach Name, Ort, E-Mail, Telefon suchen...' : 'Search by name, city, email, phone...'}
            className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Client List */}
        <div className="max-h-[380px] overflow-y-auto space-y-1.5 pr-1">
          {/* Top Option: Show All Clients */}
          <button
            type="button"
            onClick={() => handleChoose('all')}
            className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
              selectedClientId === 'all'
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                : 'bg-white dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                selectedClientId === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {lang === 'de' ? 'Alle Klienten (Kein Filter)' : 'All Clients (No Filter)'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {billing 
                    ? `${billing.length} ${lang === 'de' ? 'Abrechnungspositionen gesamt' : 'total billing items'}`
                    : `${clients.length} ${lang === 'de' ? 'Klienten in der Praxis' : 'total clients'}`
                  }
                </div>
              </div>
            </div>

            {selectedClientId === 'all' && (
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            )}
          </button>

          <div className="pt-2 pb-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
              {lang === 'de' ? 'Klienten' : 'Clients'} ({filteredClients.length})
            </span>
          </div>

          {filteredClients.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
              {lang === 'de' ? 'Kein Klient mit diesem Namen gefunden.' : 'No clients found matching your search.'}
            </div>
          ) : (
            filteredClients.map(client => {
              const isSelected = selectedClientId === client.id;
              const count = invoiceCountMap.get(client.id) || 0;
              const initials = client.name
                .split(' ')
                .map(n => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'KL';

              return (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleChoose(client.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-2xl border text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                    }`}>
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        {client.name}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate mt-0.5">
                        {client.city && (
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="w-2.5 h-2.5" />
                            {client.city}
                          </span>
                        )}
                        {(client.phone || client.contact) && (
                          <span className="flex items-center gap-0.5 truncate">
                            <Phone className="w-2.5 h-2.5" />
                            {client.phone || client.contact}
                          </span>
                        )}
                        {!client.city && !client.phone && client.email && (
                          <span className="flex items-center gap-0.5 truncate">
                            <Mail className="w-2.5 h-2.5" />
                            {client.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {billing && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        count > 0 
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' 
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-700/60 dark:text-slate-400'
                      }`}>
                        {count} {lang === 'de' ? 'Rechnungen' : 'invoices'}
                      </span>
                    )}

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => handleChoose('all')}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium transition cursor-pointer"
          >
            {lang === 'de' ? 'Filter zurücksetzen' : 'Reset filter'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition cursor-pointer"
          >
            {lang === 'de' ? 'Schließen' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
