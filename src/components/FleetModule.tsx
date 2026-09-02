import React, { useState, useMemo } from 'react';
import {
  Car,
  Plus,
  Search,
  Filter,
  Calendar,
  Fuel,
  Gauge,
  User,
  MapPin,
  FileText,
  Download,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  X
} from 'lucide-react';
import { FleetVehicle, FleetTripEntry, FleetFuelEntry, CompanyProfile, Contact } from '../types';
import { sounds } from '../lib/sound';
import { useLanguage, t } from '../lib/i18n';

interface FleetModuleProps {
  companyProfile: CompanyProfile;
  contacts?: Contact[];
  onOpenTripInvoice?: (trip: FleetTripEntry) => void;
}

export const FleetModule: React.FC<FleetModuleProps> = ({
  companyProfile,
  contacts = [],
  onOpenTripInvoice
}) => {
  const currentLang = useLanguage();
  const currency = companyProfile.currency || 'EUR';

  // Active Tab: 'logbook' | 'vehicles' | 'fuel' | 'analytics'
  const [activeTab, setActiveTab] = useState<'logbook' | 'vehicles' | 'fuel' | 'analytics'>('logbook');

  // Persistent storage for Vehicles
  const [vehicles, setVehicles] = useState<FleetVehicle[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_fleet_vehicles');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Persistent storage for Trip Logbook
  const [trips, setTrips] = useState<FleetTripEntry[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_fleet_trips');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Persistent storage for Fuel & Energy records
  const [fuelEntries, setFuelEntries] = useState<FleetFuelEntry[]>(() => {
    try {
      const saved = localStorage.getItem('odoo_fleet_fuel');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Save helpers
  const saveVehicles = (next: FleetVehicle[]) => {
    setVehicles(next);
    try { localStorage.setItem('odoo_fleet_vehicles', JSON.stringify(next)); } catch {}
  };

  const saveTrips = (next: FleetTripEntry[]) => {
    setTrips(next);
    try { localStorage.setItem('odoo_fleet_trips', JSON.stringify(next)); } catch {}
  };

  const saveFuel = (next: FleetFuelEntry[]) => {
    setFuelEntries(next);
    try { localStorage.setItem('odoo_fleet_fuel', JSON.stringify(next)); } catch {}
  };

  // Modals state
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<FleetVehicle | null>(null);

  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<FleetTripEntry | null>(null);

  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [editingFuel, setEditingFuel] = useState<FleetFuelEntry | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState<string>('all');
  const [purposeFilter, setPurposeFilter] = useState<'all' | 'business' | 'private' | 'commute'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: string; to: string }>({
    from: '',
    to: ''
  });

  // Form states for Vehicle Modal
  const [vPlate, setVPlate] = useState('');
  const [vMake, setVMake] = useState('');
  const [vModel, setVModel] = useState('');
  const [vType, setVType] = useState<FleetVehicle['type']>('car');
  const [vFuelType, setVFuelType] = useState<FleetVehicle['fuelType']>('diesel');
  const [vVin, setVVin] = useState('');
  const [vOdometer, setVOdometer] = useState<number>(0);
  const [vDriver, setVDriver] = useState('');
  const [vYear, setVYear] = useState<number>(new Date().getFullYear());
  const [vInspection, setVInspection] = useState('');
  const [vNotes, setVNotes] = useState('');
  const [vStatus, setVStatus] = useState<FleetVehicle['status']>('active');

  // Form states for Trip Modal
  const [tVehicleId, setTVehicleId] = useState('');
  const [tDriver, setTDriver] = useState('');
  const [tDate, setTDate] = useState(new Date().toISOString().split('T')[0]);
  const [tStartTime, setTStartTime] = useState('08:30');
  const [tEndTime, setTEndTime] = useState('09:45');
  const [tStartLoc, setTStartLoc] = useState('');
  const [tEndLoc, setTEndLoc] = useState('');
  const [tPurpose, setTPurpose] = useState<FleetTripEntry['purposeType']>('business');
  const [tReason, setTReason] = useState('');
  const [tCustomer, setTCustomer] = useState('');
  const [tStartKm, setTStartKm] = useState<number>(0);
  const [tEndKm, setTEndKm] = useState<number>(0);
  const [tTripNotes, setTTripNotes] = useState('');

  // Form states for Fuel Modal
  const [fVehicleId, setFVehicleId] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fOdometer, setFOdometer] = useState<number>(0);
  const [fUnits, setFUnits] = useState<number>(0);
  const [fTotalCost, setFTotalCost] = useState<number>(0);
  const [fStation, setFStation] = useState('');
  const [fNotes, setFNotes] = useState('');

  // Open Vehicle Modal
  const handleOpenVehicleModal = (veh?: FleetVehicle) => {
    sounds.playClick();
    if (veh) {
      setEditingVehicle(veh);
      setVPlate(veh.licensePlate);
      setVMake(veh.make);
      setVModel(veh.model);
      setVType(veh.type);
      setVFuelType(veh.fuelType);
      setVVin(veh.vin || '');
      setVOdometer(veh.currentOdometer);
      setVDriver(veh.assignedDriver || '');
      setVYear(veh.year || new Date().getFullYear());
      setVInspection(veh.nextInspectionDue || '');
      setVNotes(veh.notes || '');
      setVStatus(veh.status);
    } else {
      setEditingVehicle(null);
      setVPlate('');
      setVMake('');
      setVModel('');
      setVType('car');
      setVFuelType('diesel');
      setVVin('');
      setVOdometer(0);
      setVDriver('');
      setVYear(new Date().getFullYear());
      setVInspection('');
      setVNotes('');
      setVStatus('active');
    }
    setIsVehicleModalOpen(true);
  };

  const handleSaveVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vPlate.trim() || !vMake.trim()) {
      sounds.playError?.();
      return;
    }

    sounds.playSuccess();
    if (editingVehicle) {
      const updated = vehicles.map(v => v.id === editingVehicle.id ? {
        ...v,
        licensePlate: vPlate.trim().toUpperCase(),
        make: vMake.trim(),
        model: vModel.trim(),
        type: vType,
        fuelType: vFuelType,
        vin: vVin.trim(),
        currentOdometer: Number(vOdometer) || 0,
        assignedDriver: vDriver.trim(),
        year: Number(vYear) || undefined,
        nextInspectionDue: vInspection || undefined,
        notes: vNotes.trim(),
        status: vStatus
      } : v);
      saveVehicles(updated);
    } else {
      const newVeh: FleetVehicle = {
        id: `veh_${Date.now()}`,
        licensePlate: vPlate.trim().toUpperCase(),
        make: vMake.trim(),
        model: vModel.trim(),
        type: vType,
        fuelType: vFuelType,
        vin: vVin.trim(),
        currentOdometer: Number(vOdometer) || 0,
        assignedDriver: vDriver.trim(),
        year: Number(vYear) || undefined,
        nextInspectionDue: vInspection || undefined,
        notes: vNotes.trim(),
        status: vStatus,
        createdAt: new Date().toISOString()
      };
      saveVehicles([...vehicles, newVeh]);
    }
    setIsVehicleModalOpen(false);
  };

  const handleDeleteVehicle = (id: string) => {
    sounds.playClick();
    saveVehicles(vehicles.filter(v => v.id !== id));
  };

  // Open Trip Modal
  const handleOpenTripModal = (trip?: FleetTripEntry) => {
    sounds.playClick();
    if (trip) {
      setEditingTrip(trip);
      setTVehicleId(trip.vehicleId);
      setTDriver(trip.driver);
      setTDate(trip.date);
      setTStartTime(trip.startTime || '08:30');
      setTEndTime(trip.endTime || '09:45');
      setTStartLoc(trip.startLocation);
      setTEndLoc(trip.endLocation);
      setTPurpose(trip.purposeType);
      setTReason(trip.reason);
      setTCustomer(trip.customerName || '');
      setTStartKm(trip.startKm);
      setTEndKm(trip.endKm);
      setTTripNotes(trip.notes || '');
    } else {
      setEditingTrip(null);
      const defaultVeh = vehicles[0];
      setTVehicleId(defaultVeh?.id || '');
      setTDriver(defaultVeh?.assignedDriver || '');
      setTDate(new Date().toISOString().split('T')[0]);
      setTStartTime('08:30');
      setTEndTime('09:45');
      setTStartLoc(companyProfile.city || 'Betriebsstätte');
      setTEndLoc('');
      setTPurpose('business');
      setTReason('');
      setTCustomer('');
      setTStartKm(defaultVeh?.currentOdometer || 0);
      setTEndKm((defaultVeh?.currentOdometer || 0) + 25);
      setTTripNotes('');
    }
    setIsTripModalOpen(true);
  };

  const handleSaveTrip = (e: React.FormEvent) => {
    e.preventDefault();
    const selVeh = vehicles.find(v => v.id === tVehicleId);
    const vehiclePlate = selVeh?.licensePlate || 'M-SO 2026';
    const distanceKm = Math.max(0, (Number(tEndKm) || 0) - (Number(tStartKm) || 0));

    if (distanceKm <= 0) {
      sounds.playError?.();
      return;
    }

    sounds.playSuccess();

    if (editingTrip) {
      const updated = trips.map(tr => tr.id === editingTrip.id ? {
        ...tr,
        vehicleId: tVehicleId,
        vehiclePlate,
        driver: tDriver.trim() || 'Fahrer',
        date: tDate,
        startTime: tStartTime,
        endTime: tEndTime,
        startLocation: tStartLoc.trim(),
        endLocation: tEndLoc.trim(),
        purposeType: tPurpose,
        reason: tReason.trim(),
        customerName: tCustomer.trim(),
        startKm: Number(tStartKm) || 0,
        endKm: Number(tEndKm) || 0,
        distanceKm,
        calculatedCost: distanceKm * 0.30,
        notes: tTripNotes.trim()
      } : tr);
      saveTrips(updated);
    } else {
      const newTrip: FleetTripEntry = {
        id: `trip_${Date.now()}`,
        vehicleId: tVehicleId,
        vehiclePlate,
        driver: tDriver.trim() || 'Fahrer',
        date: tDate,
        startTime: tStartTime,
        endTime: tEndTime,
        startLocation: tStartLoc.trim(),
        endLocation: tEndLoc.trim(),
        purposeType: tPurpose,
        reason: tReason.trim(),
        customerName: tCustomer.trim(),
        startKm: Number(tStartKm) || 0,
        endKm: Number(tEndKm) || 0,
        distanceKm,
        calculatedCost: distanceKm * 0.30,
        notes: tTripNotes.trim(),
        createdAt: new Date().toISOString()
      };
      saveTrips([newTrip, ...trips]);

      // Update vehicle odometer if higher
      if (selVeh && Number(tEndKm) > selVeh.currentOdometer) {
        saveVehicles(vehicles.map(v => v.id === selVeh.id ? { ...v, currentOdometer: Number(tEndKm) } : v));
      }
    }

    setIsTripModalOpen(false);
  };

  const handleDeleteTrip = (id: string) => {
    sounds.playClick();
    saveTrips(trips.filter(t => t.id !== id));
  };

  // Open Fuel Modal
  const handleOpenFuelModal = (fuel?: FleetFuelEntry) => {
    sounds.playClick();
    if (fuel) {
      setEditingFuel(fuel);
      setFVehicleId(fuel.vehicleId);
      setFDate(fuel.date);
      setFOdometer(fuel.odometer);
      setFUnits(fuel.litersOrKwh);
      setFTotalCost(fuel.totalCost);
      setFStation(fuel.fuelStation || '');
      setFNotes(fuel.notes || '');
    } else {
      setEditingFuel(null);
      const defaultVeh = vehicles[0];
      setFVehicleId(defaultVeh?.id || '');
      setFDate(new Date().toISOString().split('T')[0]);
      setFOdometer(defaultVeh?.currentOdometer || 0);
      setFUnits(45);
      setFTotalCost(80);
      setFStation('');
      setFNotes('');
    }
    setIsFuelModalOpen(true);
  };

  const handleSaveFuel = (e: React.FormEvent) => {
    e.preventDefault();
    const selVeh = vehicles.find(v => v.id === fVehicleId);
    const vehiclePlate = selVeh?.licensePlate || 'M-SO 2026';
    const totalCost = Number(fTotalCost) || 0;
    const units = Number(fUnits) || 1;
    const pricePerUnit = units > 0 ? totalCost / units : 0;

    sounds.playSuccess();
    if (editingFuel) {
      const updated = fuelEntries.map(f => f.id === editingFuel.id ? {
        ...f,
        vehicleId: fVehicleId,
        vehiclePlate,
        date: fDate,
        odometer: Number(fOdometer) || 0,
        litersOrKwh: units,
        totalCost,
        pricePerUnit: Number(pricePerUnit.toFixed(3)),
        fuelStation: fStation.trim(),
        notes: fNotes.trim()
      } : f);
      saveFuel(updated);
    } else {
      const newFuel: FleetFuelEntry = {
        id: `fuel_${Date.now()}`,
        vehicleId: fVehicleId,
        vehiclePlate,
        date: fDate,
        odometer: Number(fOdometer) || 0,
        litersOrKwh: units,
        totalCost,
        pricePerUnit: Number(pricePerUnit.toFixed(3)),
        fuelStation: fStation.trim(),
        notes: fNotes.trim(),
        createdAt: new Date().toISOString()
      };
      saveFuel([newFuel, ...fuelEntries]);
    }
    setIsFuelModalOpen(false);
  };

  const handleDeleteFuel = (id: string) => {
    sounds.playClick();
    saveFuel(fuelEntries.filter(f => f.id !== id));
  };

  // Filtered trips
  const filteredTrips = useMemo(() => {
    return trips.filter(tr => {
      if (selectedVehicleFilter !== 'all' && tr.vehicleId !== selectedVehicleFilter) return false;
      if (purposeFilter !== 'all' && tr.purposeType !== purposeFilter) return false;
      if (dateRangeFilter.from && tr.date < dateRangeFilter.from) return false;
      if (dateRangeFilter.to && tr.date > dateRangeFilter.to) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match = tr.vehiclePlate.toLowerCase().includes(q) ||
                      tr.driver.toLowerCase().includes(q) ||
                      tr.startLocation.toLowerCase().includes(q) ||
                      tr.endLocation.toLowerCase().includes(q) ||
                      tr.reason.toLowerCase().includes(q) ||
                      (tr.customerName && tr.customerName.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [trips, selectedVehicleFilter, purposeFilter, dateRangeFilter, searchQuery]);

  // Analytics Metrics
  const metrics = useMemo(() => {
    const totalKm = filteredTrips.reduce((acc, t) => acc + (t.distanceKm || 0), 0);
    const businessKm = filteredTrips.filter(t => t.purposeType === 'business').reduce((acc, t) => acc + (t.distanceKm || 0), 0);
    const privateKm = filteredTrips.filter(t => t.purposeType === 'private').reduce((acc, t) => acc + (t.distanceKm || 0), 0);
    const commuteKm = filteredTrips.filter(t => t.purposeType === 'commute').reduce((acc, t) => acc + (t.distanceKm || 0), 0);
    const totalFuelCost = fuelEntries.reduce((acc, f) => acc + (f.totalCost || 0), 0);
    const totalTaxAllowance = businessKm * 0.30; // 0.30 EUR / km Pauschale

    const businessPct = totalKm > 0 ? Math.round((businessKm / totalKm) * 100) : 0;
    const privatePct = totalKm > 0 ? Math.round((privateKm / totalKm) * 100) : 0;
    const commutePct = totalKm > 0 ? Math.round((commuteKm / totalKm) * 100) : 0;

    return {
      totalKm,
      businessKm,
      privateKm,
      commuteKm,
      businessPct,
      privatePct,
      commutePct,
      totalFuelCost,
      totalTaxAllowance,
      activeVehiclesCount: vehicles.filter(v => v.status === 'active').length
    };
  }, [filteredTrips, fuelEntries, vehicles]);

  // Export CSV (Finanzamt GoBD Logbook format)
  const handleExportCSV = () => {
    sounds.playClick();
    const headers = ['Datum', 'Uhrzeit', 'Fahrzeug', 'Fahrer', 'Startort', 'Zielort', 'Anlass / Grund', 'Kunde', 'Art', 'Start-km', 'End-km', 'Gefahrene km', 'Pauschale (0.30€)'];
    const rows = filteredTrips.map(t => [
      t.date,
      `${t.startTime || ''} - ${t.endTime || ''}`,
      `"${t.vehiclePlate}"`,
      `"${t.driver}"`,
      `"${t.startLocation}"`,
      `"${t.endLocation}"`,
      `"${t.reason}"`,
      `"${t.customerName || ''}"`,
      t.purposeType === 'business' ? 'Dienstfahrt' : t.purposeType === 'private' ? 'Privatfahrt' : 'Arbeitsweg',
      t.startKm,
      t.endKm,
      t.distanceKm,
      (t.distanceKm * 0.30).toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Fahrtenbuch_${companyProfile.companyName || 'SOCDOF'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    sounds.playSuccess();
  };

  return (
    <div id="fleet-module-root" className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden">
      
      {/* Top Header */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('module.fleet', currentLang, 'Fuhrpark & Digitales Fahrtenbuch')}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300 dark:border-emerald-800">
                GoBD / Finanzamt
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('desc.fleet', currentLang, 'Fahrzeugverwaltung, GoBD-konformes Fahrtenbuch, Tankbelege & km-Auswertung')}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {activeTab === 'vehicles' ? (
            <button
              id="btn-add-vehicle"
              onClick={() => handleOpenVehicleModal()}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Fahrzeug hinzufügen</span>
            </button>
          ) : activeTab === 'fuel' ? (
            <button
              id="btn-add-fuel"
              onClick={() => handleOpenFuelModal()}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Tankbeleg erfassen</span>
            </button>
          ) : (
            <>
              <button
                id="btn-export-logbook-csv"
                onClick={handleExportCSV}
                className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition"
                title="Finanzamt-CSV Exportieren"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">CSV Export</span>
              </button>
              <button
                id="btn-add-trip"
                onClick={() => handleOpenTripModal()}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Fahrt eintragen</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-100/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Gauge className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Gesamtstrecke</div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">{metrics.totalKm.toLocaleString()} km</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Dienstfahrten</div>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {metrics.businessKm.toLocaleString()} km <span className="text-xs font-normal text-slate-500">({metrics.businessPct}%)</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Fuel className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Tankkosten</div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">{metrics.totalFuelCost.toFixed(2)} {currency}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Fuhrpark</div>
            <div className="text-base font-bold text-slate-900 dark:text-white truncate">{vehicles.length} Fahrzeuge</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="px-4 pt-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
        <button
          onClick={() => { sounds.playClick(); setActiveTab('logbook'); }}
          className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition ${
            activeTab === 'logbook'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Fahrtenbuch ({filteredTrips.length})</span>
        </button>

        <button
          onClick={() => { sounds.playClick(); setActiveTab('vehicles'); }}
          className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition ${
            activeTab === 'vehicles'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>Fahrzeuge ({vehicles.length})</span>
        </button>

        <button
          onClick={() => { sounds.playClick(); setActiveTab('fuel'); }}
          className={`pb-2.5 px-3 font-bold text-xs border-b-2 flex items-center gap-1.5 transition ${
            activeTab === 'fuel'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Fuel className="w-4 h-4" />
          <span>Tank- & Ladebelege ({fuelEntries.length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        
        {/* TAB 1: FAHRTENBUCH (LOGBOOK) */}
        {activeTab === 'logbook' && (
          <div className="space-y-4">
            
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Fahrten durchsuchen (Fahrer, Ort, Zweck, Kennzeichen)..."
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap text-xs">
                <select
                  value={selectedVehicleFilter}
                  onChange={(e) => { setSelectedVehicleFilter(e.target.value); sounds.playClick(); }}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold"
                >
                  <option value="all">Alle Fahrzeuge</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.licensePlate} ({v.make} {v.model})</option>
                  ))}
                </select>

                <select
                  value={purposeFilter}
                  onChange={(e) => { setPurposeFilter(e.target.value as any); sounds.playClick(); }}
                  className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold"
                >
                  <option value="all">Alle Fahrten-Typen</option>
                  <option value="business">Dienstfahrten (Business)</option>
                  <option value="private">Privatfahrten</option>
                  <option value="commute">Arbeitsweg (Wohnung-Betrieb)</option>
                </select>
              </div>
            </div>

            {/* Trips List / Table */}
            {filteredTrips.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                  <Car className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Keine Fahrten erfasst</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                    Tragen Sie Ihre erste geschäftliche oder private Fahrt ein, um das digitale GoBD-konforme Fahrtenbuch zu führen.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenTripModal()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  + Erste Fahrt eintragen
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-4">Datum & Zeit</th>
                        <th className="py-3 px-4">Fahrzeug & Fahrer</th>
                        <th className="py-3 px-4">Route (Start ➔ Ziel)</th>
                        <th className="py-3 px-4">Anlass / Kunde</th>
                        <th className="py-3 px-4">Art</th>
                        <th className="py-3 px-4 text-right">Start / End km</th>
                        <th className="py-3 px-4 text-right">Strecke</th>
                        <th className="py-3 px-4 text-right">Aktionen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                      {filteredTrips.map((trip) => (
                        <tr key={trip.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-mono whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white">{trip.date}</div>
                            {trip.startTime && <div className="text-[11px] text-slate-400">{trip.startTime} - {trip.endTime}</div>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <Car className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{trip.vehiclePlate}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">{trip.driver}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                              <span>{trip.startLocation}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{trip.endLocation}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">{trip.reason || 'Dienstliche Fahrt'}</div>
                            {trip.customerName && (
                              <div className="text-[11px] text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{trip.customerName}</span>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              trip.purposeType === 'business'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                                : trip.purposeType === 'private'
                                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                                : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                            }`}>
                              {trip.purposeType === 'business' ? 'Dienstfahrt' : trip.purposeType === 'private' ? 'Privat' : 'Arbeitsweg'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-[11px]">
                            <div>{trip.startKm.toLocaleString()} ➔ {trip.endKm.toLocaleString()}</div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="font-bold text-slate-900 dark:text-white text-sm">+{trip.distanceKm} km</div>
                            <div className="text-[10px] text-slate-400">{(trip.distanceKm * 0.30).toFixed(2)} {currency}</div>
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenTripModal(trip)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                                title="Bearbeiten"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteTrip(trip.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition"
                                title="Löschen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FAHRZEUGE (VEHICLES) */}
        {activeTab === 'vehicles' && (
          <div className="space-y-4">
            {vehicles.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                  <Car className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Keine Fahrzeuge im Fuhrpark</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                    Legen Sie Firmenwagen, Transporter, E-Autos oder Poolfahrzeuge mit Kennzeichen und aktuellem Kilometerstand an.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenVehicleModal()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  + Erstes Fahrzeug anlegen
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vehicles.map((veh) => (
                  <div
                    key={veh.id}
                    className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-emerald-500/50 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-1 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-mono font-bold text-sm tracking-wider border border-slate-700">
                          {veh.licensePlate}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          veh.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                            : veh.status === 'maintenance'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {veh.status === 'active' ? 'Aktiv' : veh.status === 'maintenance' ? 'Werkstatt' : 'Abgemeldet'}
                        </span>
                      </div>

                      <div className="mt-3">
                        <h4 className="font-bold text-base text-slate-900 dark:text-white">
                          {veh.make} {veh.model}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{veh.year ? `Bj. ${veh.year}` : 'PKW'}</span>
                          <span>•</span>
                          <span className="capitalize">{veh.fuelType}</span>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Kilometerstand:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">{veh.currentOdometer.toLocaleString()} km</span>
                        </div>
                        {veh.assignedDriver && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Stammfahrer:</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{veh.assignedDriver}</span>
                          </div>
                        )}
                        {veh.nextInspectionDue && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">TÜV / HU fällig:</span>
                            <span className="font-mono text-amber-600 dark:text-amber-400 font-semibold">{veh.nextInspectionDue}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedVehicleFilter(veh.id);
                          setActiveTab('logbook');
                        }}
                        className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
                      >
                        <span>Fahrten anzeigen</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenVehicleModal(veh)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(veh.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TANK- & LADEBELEGE (FUEL RECORDS) */}
        {activeTab === 'fuel' && (
          <div className="space-y-4">
            {fuelEntries.length === 0 ? (
              <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-800">
                  <Fuel className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Keine Tank- oder Ladebelege</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mt-1">
                    Erfassen Sie Tankstellenrechnungen, Ladevorgänge und Kraftstoffkosten für Ihre Buchhaltung und Verbrauchsstatistiken.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenFuelModal()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition"
                >
                  + Ersten Tankbeleg erfassen
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Datum</th>
                      <th className="py-3 px-4">Fahrzeug</th>
                      <th className="py-3 px-4">Tankstelle / Ladesäule</th>
                      <th className="py-3 px-4 text-right">km-Stand</th>
                      <th className="py-3 px-4 text-right">Menge (l / kWh)</th>
                      <th className="py-3 px-4 text-right">Preis / Einheit</th>
                      <th className="py-3 px-4 text-right">Gesamtbetrag</th>
                      <th className="py-3 px-4 text-right">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                    {fuelEntries.map((fuel) => (
                      <tr key={fuel.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">{fuel.date}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">{fuel.vehiclePlate}</td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{fuel.fuelStation || 'Tankstelle'}</td>
                        <td className="py-3 px-4 text-right font-mono">{fuel.odometer.toLocaleString()} km</td>
                        <td className="py-3 px-4 text-right font-semibold">{fuel.litersOrKwh.toFixed(2)}</td>
                        <td className="py-3 px-4 text-right text-slate-500">{fuel.pricePerUnit ? `${fuel.pricePerUnit.toFixed(3)} €` : '-'}</td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white text-sm">{fuel.totalCost.toFixed(2)} {currency}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenFuelModal(fuel)}
                              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFuel(fuel.id)}
                              className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: Fahrzeug anlegen / bearbeiten */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Car className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {editingVehicle ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug anlegen'}
                </h3>
              </div>
              <button
                onClick={() => setIsVehicleModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kennzeichen *</label>
                  <input
                    type="text"
                    required
                    value={vPlate}
                    onChange={(e) => setVPlate(e.target.value)}
                    placeholder="M-SO 2026"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Hersteller (Marke) *</label>
                  <input
                    type="text"
                    required
                    value={vMake}
                    onChange={(e) => setVMake(e.target.value)}
                    placeholder="Volkswagen / BMW / Tesla"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Modell</label>
                  <input
                    type="text"
                    value={vModel}
                    onChange={(e) => setVModel(e.target.value)}
                    placeholder="Passat / ID.4 / T6.1"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kraftstoff / Antrieb</label>
                  <select
                    value={vFuelType}
                    onChange={(e) => setVFuelType(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="diesel">Diesel</option>
                    <option value="petrol">Benzin</option>
                    <option value="electric">Elektro (BEV)</option>
                    <option value="hybrid">Hybrid / Plug-in</option>
                    <option value="hydrogen">Wasserstoff</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Aktueller km-Stand</label>
                  <input
                    type="number"
                    value={vOdometer}
                    onChange={(e) => setVOdometer(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Stammfahrer</label>
                  <input
                    type="text"
                    value={vDriver}
                    onChange={(e) => setVDriver(e.target.value)}
                    placeholder="Name des Mitarbeiters"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">TÜV / HU Fälligkeit</label>
                  <input
                    type="date"
                    value={vInspection}
                    onChange={(e) => setVInspection(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={vStatus}
                    onChange={(e) => setVStatus(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="active">Aktiv / Im Einsatz</option>
                    <option value="maintenance">In Wartung / Werkstatt</option>
                    <option value="retired">Stillgelegt / Verkauft</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md transition"
                >
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Fahrt eintragen / bearbeiten */}
      {isTripModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {editingTrip ? 'Fahrt bearbeiten' : 'Neue Fahrt ins Fahrtenbuch eintragen'}
                </h3>
              </div>
              <button
                onClick={() => setIsTripModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTrip} className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Fahrzeug *</label>
                  <select
                    required
                    value={tVehicleId}
                    onChange={(e) => {
                      setTVehicleId(e.target.value);
                      const v = vehicles.find(veh => veh.id === e.target.value);
                      if (v) {
                        setTStartKm(v.currentOdometer);
                        setTEndKm(v.currentOdometer + 20);
                        if (v.assignedDriver) setTDriver(v.assignedDriver);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.licensePlate} - {v.make} {v.model}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Fahrer *</label>
                  <input
                    type="text"
                    required
                    value={tDriver}
                    onChange={(e) => setTDriver(e.target.value)}
                    placeholder="Name des Fahrers"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Datum *</label>
                  <input
                    type="date"
                    required
                    value={tDate}
                    onChange={(e) => setTDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Abfahrt</label>
                  <input
                    type="time"
                    value={tStartTime}
                    onChange={(e) => setTStartTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ankunft</label>
                  <input
                    type="time"
                    value={tEndTime}
                    onChange={(e) => setTEndTime(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Startort *</label>
                  <input
                    type="text"
                    required
                    value={tStartLoc}
                    onChange={(e) => setTStartLoc(e.target.value)}
                    placeholder="München, Firmenzentrale"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Zielort *</label>
                  <input
                    type="text"
                    required
                    value={tEndLoc}
                    onChange={(e) => setTEndLoc(e.target.value)}
                    placeholder="Augsburg, Kunde Vor-Ort"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Art der Fahrt *</label>
                  <select
                    value={tPurpose}
                    onChange={(e) => setTPurpose(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-semibold"
                  >
                    <option value="business">Dienstfahrt (Geschäftlich)</option>
                    <option value="private">Privatfahrt</option>
                    <option value="commute">Arbeitsweg (Wohnung ➔ Arbeit)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kunde / Projekt (optional)</label>
                  <input
                    type="text"
                    value={tCustomer}
                    onChange={(e) => setTCustomer(e.target.value)}
                    placeholder="Musterfirma GmbH"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Anlass / Zweck der Fahrt *</label>
                <input
                  type="text"
                  required
                  value={tReason}
                  onChange={(e) => setTReason(e.target.value)}
                  placeholder="Kundenberatung, IT-Wartung, Warenlieferung"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Start-km *</label>
                  <input
                    type="number"
                    required
                    value={tStartKm}
                    onChange={(e) => setTStartKm(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">End-km *</label>
                  <input
                    type="number"
                    required
                    value={tEndKm}
                    onChange={(e) => setTEndKm(Number(e.target.value))}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-500 mb-1">Distanz</label>
                  <div className="h-9.5 flex items-center font-bold text-emerald-600 text-sm font-mono">
                    +{Math.max(0, (Number(tEndKm) || 0) - (Number(tStartKm) || 0))} km
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTripModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md transition"
                >
                  Fahrt speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Tankbeleg erfassen */}
      {isFuelModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 bg-emerald-600 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Fuel className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {editingFuel ? 'Tankbeleg bearbeiten' : 'Tank- / Ladebeleg erfassen'}
                </h3>
              </div>
              <button
                onClick={() => setIsFuelModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFuel} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Fahrzeug *</label>
                  <select
                    required
                    value={fVehicleId}
                    onChange={(e) => setFVehicleId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-bold"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.licensePlate} ({v.make})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Datum *</label>
                  <input
                    type="date"
                    required
                    value={fDate}
                    onChange={(e) => setFDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kilometerstand</label>
                  <input
                    type="number"
                    value={fOdometer}
                    onChange={(e) => setFOdometer(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tankstelle / Betreiber</label>
                  <input
                    type="text"
                    value={fStation}
                    onChange={(e) => setFStation(e.target.value)}
                    placeholder="Aral / Shell / EnBW"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Menge (Liter oder kWh)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={fUnits}
                    onChange={(e) => setFUnits(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gesamtbetrag (inkl. USt) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={fTotalCost}
                    onChange={(e) => setFTotalCost(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFuelModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-md transition"
                >
                  Beleg speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
