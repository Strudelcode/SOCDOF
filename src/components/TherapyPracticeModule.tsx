import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Car, Check, Clock3, FileText, Plus, Search, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';

type Client = { id: string; name: string; birthDate: string; contact: string; notes: string; createdAt: string };
type Session = { id: string; clientId: string; date: string; duration: number; template: string; intervention: string; progress: string };
type Appointment = { id: string; clientId: string; date: string; status: 'scheduled' | 'attended' | 'cancelled' | 'missed'; notes: string };
type Trip = { id: string; date: string; departure: string; destination: string; purpose: string; startKm: number; endKm: number; rate: number };
type Billing = { id: string; clientId: string; date: string; service: string; amount: number; status: 'draft' | 'ready' };

const STORAGE_KEY = 'socdof_therapy_practice_v1';

const emptyData = { clients: [] as Client[], sessions: [] as Session[], appointments: [] as Appointment[], trips: [] as Trip[], billing: [] as Billing[] };

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...emptyData, ...JSON.parse(raw) } : emptyData;
  } catch { return emptyData; }
}

export const TherapyPracticeModule: React.FC = () => {
  const currentLang = useLanguage();
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState<'overview' | 'clients' | 'sessions' | 'appointments' | 'mileage' | 'billing'>('overview');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<null | 'client' | 'session' | 'appointment' | 'trip' | 'billing'>(null);
  const [selectedClient, setSelectedClient] = useState('');

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);

  const clients = useMemo(() => data.clients.filter(c => c.name.toLowerCase().includes(query.toLowerCase())), [data.clients, query]);
  const today = new Date().toISOString().slice(0, 10);
  const openAppointments = data.appointments.filter(a => a.date >= today && a.status === 'scheduled').length;
  const mileageTotal = data.trips.reduce((s, t) => s + Math.max(0, t.endKm - t.startKm), 0);
  const billingTotal = data.billing.reduce((s, b) => s + b.amount, 0);

  const add = (kind: NonNullable<typeof modal>, value: any) => {
    const id = crypto.randomUUID();
    setData(prev => ({ ...prev, [kind === 'client' ? 'clients' : kind === 'session' ? 'sessions' : kind === 'appointment' ? 'appointments' : kind === 'trip' ? 'trips' : 'billing']: [
      ...prev[kind === 'client' ? 'clients' : kind === 'session' ? 'sessions' : kind === 'appointment' ? 'appointments' : kind === 'trip' ? 'trips' : 'billing'], { id, ...value }
    ] }));
    setModal(null);
  };

  const remove = (kind: 'clients' | 'sessions' | 'appointments' | 'trips' | 'billing', id: string) => {
    if (!window.confirm(t('therapy.confirmDelete', currentLang))) return;
    setData(prev => ({ ...prev, [kind]: prev[kind].filter((x: any) => x.id !== id) }));
  };

  const clientName = (id: string) => data.clients.find(c => c.id === id)?.name || '—';

  return (
    <div className="h-full min-h-0 overflow-y-auto overscroll-contain bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-3 sm:px-5 py-3 sm:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight">{t('therapy.title', currentLang)}</h1>
            <p className="text-xs text-slate-500 mt-1">{t('therapy.subtitle', currentLang)}</p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold"><ShieldCheck className="w-4 h-4" />{t('therapy.encrypted', currentLang)}</div>
        </div>
        <div className="mt-3 sm:mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {([
            ['overview', FileText, t('therapy.title', currentLang)],
            ['clients', UserRound, t('therapy.patients', currentLang)],
            ['sessions', Clock3, t('therapy.sessions', currentLang)],
            ['appointments', CalendarDays, t('therapy.appointments', currentLang)],
            ['mileage', Car, t('therapy.mileage', currentLang)],
            ['billing', FileText, t('therapy.billing', currentLang)]
          ] as const).map(([id, Icon, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition ${tab === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon className="w-4 h-4" />{label}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-5 space-y-4 sm:space-y-5">
        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                [t('therapy.totalClients', currentLang), data.clients.length, UserRound],
                [t('therapy.totalSessions', currentLang), data.sessions.length, Clock3],
                [t('therapy.openAppointments', currentLang), openAppointments, CalendarDays],
                [t('therapy.pendingBilling', currentLang), `€ ${billingTotal.toFixed(2)}`, FileText]
              ] as const).map(([label, value, Icon]) => <div key={String(label)} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4"><Icon className="w-4 h-4 text-slate-400 mb-3" /><div className="text-2xl font-black">{value}</div><div className="text-xs text-slate-500 mt-1">{label}</div></div>)}
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="font-bold mb-3">{t('therapy.sessionTemplates', currentLang)}</h2>
                <div className="grid grid-cols-2 gap-2">{['intake','standard','crisis','finalReport'].map(k => <button key={k} onClick={() => { setTab('sessions'); setModal('session'); }} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700">{t(`therapy.${k}`, currentLang)}</button>)}</div>
              </section>
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
                <h2 className="font-bold mb-3">{t('therapy.privacy', currentLang)}</h2>
                <p className="text-xs text-slate-500 leading-relaxed">{t('therapy.privacy', currentLang)}</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-emerald-600"><ShieldCheck className="w-4 h-4" />{t('therapy.encrypted', currentLang)}</div>
              </section>
            </div>
          </>
        )}

        {tab === 'clients' && <ListShell title={t('therapy.patients', currentLang)} action={t('therapy.newPatient', currentLang)} onAdd={() => setModal('client')} search value={query} onSearch={setQuery}>
          {clients.length === 0 ? <Empty text={t('therapy.emptyPatients', currentLang)} /> : clients.map(c => <Row key={c.id} icon={<UserRound className="w-4 h-4" />} title={c.name} subtitle={c.contact || c.birthDate || '—'} onDelete={() => remove('clients', c.id)} />)}
        </ListShell>}

        {tab === 'sessions' && <ListShell title={t('therapy.sessions', currentLang)} action={t('therapy.newSession', currentLang)} onAdd={() => setModal('session')}>
          {data.sessions.length === 0 ? <Empty text={t('therapy.emptySessions', currentLang)} /> : data.sessions.map(s => <Row key={s.id} icon={<Clock3 className="w-4 h-4" />} title={clientName(s.clientId)} subtitle={`${s.date} · ${s.duration} min · ${therapyT(s.template)}`} onDelete={() => remove('sessions', s.id)} />)}
        </ListShell>}

        {tab === 'appointments' && <ListShell title={t('therapy.appointments', currentLang)} action={t('therapy.newAppointment', currentLang)} onAdd={() => setModal('appointment')}>
          {data.appointments.length === 0 ? <Empty text={t('therapy.emptyAppointments', currentLang)} /> : data.appointments.map(a => <Row key={a.id} icon={<CalendarDays className="w-4 h-4" />} title={clientName(a.clientId)} subtitle={`${a.date} · ${therapyT(a.status)}`} onDelete={() => remove('appointments', a.id)} />)}
        </ListShell>}

        {tab === 'mileage' && <ListShell title={t('therapy.mileage', currentLang)} action={t('therapy.newTrip', currentLang)} onAdd={() => setModal('trip')}>
          {data.trips.length === 0 ? <Empty text={t('therapy.emptyMileage', currentLang)} /> : data.trips.map(t => <Row key={t.id} icon={<Car className="w-4 h-4" />} title={`${t.departure} → ${t.destination}`} subtitle={`${t.date} · ${Math.max(0, t.endKm - t.startKm)} km · € ${(Math.max(0, t.endKm - t.startKm) * t.rate).toFixed(2)}`} onDelete={() => remove('trips', t.id)} />)}
          <div className="text-xs text-slate-500 pt-2">{mileageTotal.toFixed(1)} km</div>
        </ListShell>}

        {tab === 'billing' && <ListShell title={t('therapy.billing', currentLang)} action={t('therapy.create', currentLang)} onAdd={() => setModal('billing')}>
          {data.billing.length === 0 ? <Empty text={t('therapy.emptyBilling', currentLang)} /> : data.billing.map(b => <Row key={b.id} icon={<FileText className="w-4 h-4" />} title={clientName(b.clientId)} subtitle={`${b.date} · ${b.service} · € ${b.amount.toFixed(2)}`} onDelete={() => remove('billing', b.id)} />)}
        </ListShell>}
      </div>

      {modal && <Modal kind={modal} clients={data.clients} selectedClient={selectedClient} setSelectedClient={setSelectedClient} onClose={() => setModal(null)} onSave={add} />}
    </div>
  );
};

const Empty = ({ text }: { text: string }) => <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 sm:p-10 text-center text-sm text-slate-400">{text}</div>;
const Row = ({ icon, title, subtitle, onDelete }: any) => <div className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"><div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">{icon}</div><div className="min-w-0 flex-1"><div className="font-semibold text-sm truncate">{title}</div><div className="text-xs text-slate-500 truncate">{subtitle}</div></div><button onClick={onDelete} className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"><Trash2 className="w-4 h-4" /></button></div>;
const ListShell = ({ title, action, onAdd, search, value, onSearch, children }: any) => {
  const currentLang = useLanguage();
  return <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-4"><div className="flex flex-wrap gap-2 items-center mb-4"><h2 className="font-bold flex-1">{title}</h2>{search && <div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={value} onChange={e => onSearch(e.target.value)} placeholder={t('therapy.search', currentLang)} className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs outline-none" /></div>}<button onClick={onAdd} className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center gap-2"><Plus className="w-4 h-4" />{action}</button></div><div className="space-y-2">{children}</div></section>;

function Modal({ kind, clients, onClose, onSave }: any) {
  const currentLang = useLanguage();
  const [form, setForm] = useState<any>({ date: new Date().toISOString().slice(0,10), duration: 50, rate: 0, startKm: 0, endKm: 0, status: 'scheduled', template: 'standard' });
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const input = (k: string, placeholder = '') => <input type={k === 'date' ? 'date' : ['duration', 'startKm', 'endKm', 'rate', 'amount'].includes(k) ? 'number' : 'text'} value={form[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none" />;
  const selectClient = <select value={form.clientId ?? ''} onChange={e => set('clientId', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="">—</option>{clients.map((c: Client) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>;
  const fields = kind === 'client' ? <>{input('name', t('therapy.name', currentLang))}{input('birthDate', t('therapy.birthDate', currentLang))}{input('contact', t('therapy.contact', currentLang))}{input('notes', t('therapy.notes', currentLang))}</> :
    kind === 'session' ? <>{selectClient}{input('date')}{input('duration')}{<select value={form.template} onChange={e => set('template', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="intake">{t('therapy.intake', currentLang)}</option><option value="standard">{t('therapy.standard', currentLang)}</option><option value="crisis">{t('therapy.crisis', currentLang)}</option><option value="finalReport">{t('therapy.finalReport', currentLang)}</option></select>}{input('intervention', t('therapy.intervention', currentLang))}{input('progress', t('therapy.progress', currentLang))}</> :
    kind === 'appointment' ? <>{selectClient}{input('date')}{<select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"><option value="scheduled">{t('therapy.scheduled', currentLang)}</option><option value="attended">{t('therapy.attended', currentLang)}</option><option value="cancelled">{t('therapy.cancelled', currentLang)}</option><option value="missed">{t('therapy.missed', currentLang)}</option></select>}{input('notes', t('therapy.notes', currentLang))}</> :
    kind === 'trip' ? <>{input('date')}{input('departure', t('therapy.departure', currentLang))}{input('destination', t('therapy.destination', currentLang))}{input('purpose', t('therapy.purpose', currentLang))}{input('startKm')}{input('endKm')}{input('rate')}</> :
    <>{selectClient}{input('date')}{input('service', t('therapy.service', currentLang))}{input('amount')}</>;
  return <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4" onMouseDown={onClose}><div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-3" onMouseDown={e => e.stopPropagation()}><div className="flex items-center"><h3 className="font-bold flex-1">{kind === 'client' ? t('therapy.newPatient', currentLang) : kind === 'session' ? t('therapy.newSession', currentLang) : kind === 'appointment' ? t('therapy.newAppointment', currentLang) : kind === 'trip' ? t('therapy.newTrip', currentLang) : t('therapy.billing', currentLang)}</h3><button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button></div><div className="space-y-2">{fields}</div><div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 sticky bottom-0 bg-white dark:bg-slate-900 pb-1"><button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold">{t('therapy.cancel', currentLang)}</button><button onClick={() => onSave(kind, form)} className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold"><Check className="w-4 h-4 inline mr-1" />{t('therapy.save', currentLang)}</button></div></div></div>;
}
