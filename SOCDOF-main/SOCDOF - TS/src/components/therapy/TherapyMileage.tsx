import React, { useState, useMemo } from 'react';
import { 
  Car, 
  Search, 
  Plus, 
  MapPin, 
  Trash2, 
  Edit2, 
  TrendingUp, 
  Sparkles,
  Calendar,
  Navigation
} from 'lucide-react';
import { Trip, Client } from './types';
import { useLanguage } from '../../lib/i18n';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface TherapyMileageProps {
  trips: Trip[];
  clients: Client[];
  currency: string;
  onSaveTrip: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onSelectClient: (clientId: string) => void;
  onShowToast: (msg: string) => void;
}

export const TherapyMileage: React.FC<TherapyMileageProps> = ({
  trips,
  clients,
  currency,
  onSaveTrip,
  onDeleteTrip,
  onSelectClient,
  onShowToast
}) => {
  const lang = useLanguage();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);

  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      const client = clients.find(c => c.id === t.clientId);
      const clientName = client ? client.name.toLowerCase() : '';
      const q = search.toLowerCase().trim();

      return !q ||
        (t.purpose && t.purpose.toLowerCase().includes(q)) ||
        (t.departure && t.departure.toLowerCase().includes(q)) ||
        (t.destination && t.destination.toLowerCase().includes(q)) ||
        clientName.includes(q);
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [trips, clients, search]);

  const totalKm = useMemo(() => {
    return trips.reduce((sum, t) => sum + Math.max(0, (Number(t.endKm) || 0) - (Number(t.startKm) || 0)), 0);
  }, [trips]);

  const totalReimbursement = useMemo(() => {
    return trips.reduce((sum, t) => {
      const km = Math.max(0, (Number(t.endKm) || 0) - (Number(t.startKm) || 0));
      return sum + km * (Number(t.rate) || 0.30);
    }, 0);
  }, [trips]);

  const getClient = (clientId?: string) => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId);
  };

  return (
    <div className="space-y-5">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              {lang === 'de' ? 'Gesamte Fahrstrecke' : 'Total Distance'}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {totalKm.toFixed(1)} km
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {trips.length} {lang === 'de' ? 'Fahrten im Fahrtenbuch' : 'trips recorded'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Navigation className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
              {lang === 'de' ? 'Kilometerpauschale / Erstattung' : 'Mileage Reimbursement'}
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalReimbursement.toFixed(2)} {currency}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {lang === 'de' ? 'Pauschalsatz gem. EStG' : 'Calculated at standard rate'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'de' ? 'Fahrten suchen nach Abfahrt, Ziel, Zweck...' : 'Search trips...'}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={() => {
            const lastTrip = trips[trips.length - 1];
            const nextStartKm = lastTrip ? lastTrip.endKm : 0;
            setEditingTrip({
              id: `trip_${Date.now()}`,
              clientId: '',
              date: new Date().toISOString().slice(0, 10),
              departure: 'Praxis',
              destination: '',
              purpose: 'Hausbesuch / Kliententermin',
              startKm: nextStartKm,
              endKm: nextStartKm + 15,
              rate: 0.30
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'de' ? '+ Neue Fahrt erfassen' : '+ Record Trip'}</span>
        </button>
      </div>

      {/* Mileage Table */}
      {filteredTrips.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center">
            <Car className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {lang === 'de' ? 'Noch keine Fahrten eingetragen' : 'No trips logged'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {lang === 'de' 
              ? 'Erfassen Sie Dienstfahrten, Hausbesuche und berechnen Sie die Kilometerpauschale.' 
              : 'Log patient visits, clinical travel and calculate mileage allowances.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">{lang === 'de' ? 'Datum' : 'Date'}</th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Strecke (Von → Nach)' : 'Route'}</th>
                  <th className="py-3 px-4">{lang === 'de' ? 'Zweck / Klient' : 'Purpose / Client'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'de' ? 'Km-Stand (Start / Ende)' : 'Km (Start / End)'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'de' ? 'Distanz' : 'Distance'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'de' ? 'Erstattung' : 'Reimbursement'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'de' ? 'Aktionen' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTrips.map(trip => {
                  const client = getClient(trip.clientId);
                  const distance = Math.max(0, (Number(trip.endKm) || 0) - (Number(trip.startKm) || 0));
                  const reimbursement = distance * (Number(trip.rate) || 0.30);

                  return (
                    <tr key={trip.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        {trip.date}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {trip.departure} <span className="text-slate-400">→</span> {trip.destination}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-700 dark:text-slate-300">{trip.purpose}</div>
                        {client && (
                          <div 
                            onClick={() => onSelectClient(client.id)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                          >
                            Klient: {client.name}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right text-slate-500 whitespace-nowrap">
                        {trip.startKm} → {trip.endKm}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {distance.toFixed(1)} km
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {reimbursement.toFixed(2)} {currency}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingTrip(trip);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title={lang === 'de' ? 'Bearbeiten' : 'Edit'}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(lang === 'de' ? 'Fahrt löschen?' : 'Delete trip?')) {
                                onDeleteTrip(trip.id);
                              }
                            }}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                            title={lang === 'de' ? 'Löschen' : 'Delete'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New / Edit Trip Modal */}
      {isModalOpen && editingTrip && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-blue-600" />
              <span>{lang === 'de' ? 'Fahrt erfassen / bearbeiten' : 'Record / Edit Trip'}</span>
            </h3>

            <form onSubmit={e => {
              e.preventDefault();
              onSaveTrip(editingTrip);
              setIsModalOpen(false);
              setEditingTrip(null);
              onShowToast(lang === 'de' ? 'Fahrt gespeichert' : 'Trip saved');
            }} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Datum' : 'Date'} *
                  </label>
                  <input
                    type="date"
                    value={editingTrip.date}
                    onChange={e => setEditingTrip({ ...editingTrip, date: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Klient (Optional)' : 'Client (Optional)'}
                  </label>
                  <select
                    value={editingTrip.clientId || ''}
                    onChange={e => setEditingTrip({ ...editingTrip, clientId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  >
                    <option value="">{lang === 'de' ? 'Kein Klient (Allgemein)' : 'None (General)'}</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Abfahrtsort' : 'Departure'} *
                  </label>
                  <input
                    type="text"
                    value={editingTrip.departure}
                    onChange={e => setEditingTrip({ ...editingTrip, departure: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Zielort' : 'Destination'} *
                  </label>
                  <input
                    type="text"
                    value={editingTrip.destination}
                    onChange={e => setEditingTrip({ ...editingTrip, destination: e.target.value })}
                    required
                    placeholder="z.B. Klientenadresse / Institut"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {lang === 'de' ? 'Fahrtzweck / Anlass' : 'Purpose of Trip'}
                </label>
                <input
                  type="text"
                  value={editingTrip.purpose}
                  onChange={e => setEditingTrip({ ...editingTrip, purpose: e.target.value })}
                  placeholder="z.B. Hausbesuch Klärungsgespräch"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Start-Km' : 'Start Km'}
                  </label>
                  <input
                    type="number"
                    value={editingTrip.startKm}
                    onChange={e => setEditingTrip({ ...editingTrip, startKm: Number(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'End-Km' : 'End Km'}
                  </label>
                  <input
                    type="number"
                    value={editingTrip.endKm}
                    onChange={e => setEditingTrip({ ...editingTrip, endKm: Number(e.target.value) || 0 })}
                    className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {lang === 'de' ? 'Distanz' : 'Distance'}
                  </label>
                  <div className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200">
                    {Math.max(0, editingTrip.endKm - editingTrip.startKm)} km
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {lang === 'de' ? 'Erstattungsbetrag:' : 'Reimbursement:'}{' '}
                  {(Math.max(0, editingTrip.endKm - editingTrip.startKm) * editingTrip.rate).toFixed(2)} {currency}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingTrip(null);
                    }}
                    className="px-3.5 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                  >
                    {lang === 'de' ? 'Abbrechen' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-sm"
                  >
                    {lang === 'de' ? 'Fahrt speichern' : 'Save Trip'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
