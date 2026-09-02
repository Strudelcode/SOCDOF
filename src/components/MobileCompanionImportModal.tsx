import React, { useState, useRef, useEffect } from 'react';
import { 
  Smartphone, 
  QrCode, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Receipt, 
  MapPin, 
  X, 
  Copy, 
  Check, 
  FileText, 
  Calendar, 
  ShieldCheck, 
  Navigation,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Wifi,
  Radio,
  FileCheck,
  ChevronDown,
  ChevronUp,
  User,
  Building,
  Phone,
  Mail
} from 'lucide-react';
import QRCode from 'qrcode';
import { SupportServiceTicket, SupportTimesheetEntry, SupportExpenseEntry, SupportActivityEntry } from '../types';
import { 
  MobileCompanionSyncPayload, 
  MobileCompanionTicketItem, 
  validateMobilePayload 
} from '../lib/mobileCompanionTypes';
import { sounds } from '../lib/sound';
import { t } from '../lib/i18n';

interface MobileCompanionImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingTickets: SupportServiceTicket[];
  onImportComplete: (newTickets: SupportServiceTicket[], updatedTickets: SupportServiceTicket[]) => void;
  currency?: string;
}

export const MobileCompanionImportModal: React.FC<MobileCompanionImportModalProps> = ({
  isOpen,
  onClose,
  existingTickets,
  onImportComplete,
  currency = '€'
}) => {
  // Session & Network State
  const [sessionId, setSessionId] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [detectedIps, setDetectedIps] = useState<string[]>([]);
  const [networkMode, setNetworkMode] = useState<'web' | 'lan' | 'custom'>('web');
  const [selectedIp, setSelectedIp] = useState<string>('');
  const [customHost, setCustomHost] = useState<string>('');
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(true);
  const [lastPingTime, setLastPingTime] = useState<string>('');
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  // Manual paste / payload drop state
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [rawJsonInput, setRawJsonInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Parsed Payload & Staging State
  const [parsedPayload, setParsedPayload] = useState<MobileCompanionSyncPayload | null>(null);
  const [dateFilterStart, setDateFilterStart] = useState<string>('');
  const [dateFilterEnd, setDateFilterEnd] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);
  const [selectedTicketIndexes, setSelectedTicketIndexes] = useState<Set<number>>(new Set());
  const [copiedSession, setCopiedSession] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState<Set<number>>(new Set());

  // Check Electron vs Web & Fetch available IPs
  useEffect(() => {
    if (!isOpen) return;

    const isElectron = !!(window as any).electronAPI?.isElectron;

    if (isElectron && (window as any).electronAPI?.getNetworkIps) {
      (window as any).electronAPI.getNetworkIps().then((info: any) => {
        if (info && info.ips && info.ips.length > 0) {
          setDetectedIps(info.ips);
          const validIp = info.primaryIp || info.ips[0];
          setSelectedIp(validIp);
          setNetworkMode('lan');
          setSelectedHost(`http://${validIp}:${info.port || 3000}/api/mobile-sync`);
        } else {
          setNetworkMode('web');
          setSelectedHost(`${window.location.origin}/api/mobile-sync`);
        }
      }).catch(() => {
        setNetworkMode('web');
        setSelectedHost(`${window.location.origin}/api/mobile-sync`);
      });
    } else {
      // In Browser / Cloud Preview
      const webUrl = `${window.location.origin}/api/mobile-sync`;
      setSelectedHost(webUrl);
      setNetworkMode('web');

      fetch('/api/mobile-sync/info')
        .then(res => res.json())
        .then(data => {
          if (data && data.ips && data.ips.length > 0) {
            // Exclude APIPA 169.254
            const validIps = data.ips.filter((ip: string) => !ip.startsWith('169.254.'));
            if (validIps.length > 0) {
              setDetectedIps(validIps);
              setSelectedIp(validIps[0]);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Listen to direct IPC events in Electron
  useEffect(() => {
    if (!isOpen) return;
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.onMobileSyncReceived) {
      const unsubscribe = electronAPI.onMobileSyncReceived((payload: any) => {
        handleProcessRawData(payload);
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    }
  }, [isOpen]);

  // Update target URL when network mode or selected IP changes
  useEffect(() => {
    let target = `${window.location.origin}/api/mobile-sync`;
    if (networkMode === 'web') {
      target = `${window.location.origin}/api/mobile-sync`;
    } else if (networkMode === 'lan') {
      const ip = selectedIp || detectedIps[0] || '192.168.1.100';
      target = `http://${ip}:3000/api/mobile-sync`;
    } else if (networkMode === 'custom' && customHost.trim()) {
      target = customHost.trim().startsWith('http') ? customHost.trim() : `http://${customHost.trim()}/api/mobile-sync`;
    }
    setSelectedHost(target);
  }, [networkMode, selectedIp, customHost, detectedIps]);

  // Generate new pairing session and High-Res QR code
  const generateNewSession = async (overrideHost?: string) => {
    setIsGeneratingQR(true);
    const newSession = `SOCDOF-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    setSessionId(newSession);

    const targetUrl = overrideHost || selectedHost || `${window.location.origin}/api/mobile-sync`;

    // Recommended JSON pairing format for mobile camera scanner
    const pairingPayload = JSON.stringify({
      url: targetUrl,
      token: newSession,
      station: "SOCDOF-Desktop-01",
      protocol: "SOCDOF_MOBILE_COMPANION_V1",
      timestamp: new Date().toISOString()
    });

    try {
      const url = await QRCode.toDataURL(pairingPayload, {
        errorCorrectionLevel: 'H',
        width: 512,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR code generation error:', err);
    } finally {
      setIsGeneratingQR(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedHost) {
      generateNewSession(selectedHost);
      setParsedPayload(null);
      setRawJsonInput('');
      setParseError(null);
      setShowManualPaste(false);
    }
  }, [isOpen, selectedHost]);

  // Real-time polling loop while waiting for mobile app HTTP POST
  useEffect(() => {
    if (!isOpen || parsedPayload || !sessionId) return;

    let isMounted = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mobile-sync?token=${encodeURIComponent(sessionId)}&consume=true`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (isMounted) {
          setLastPingTime(new Date().toLocaleTimeString());
          if (data && data.ready && data.payload) {
            handleProcessRawData(data.payload);
          }
        }
      } catch (err) {
        // Benign network polling error
      }
    }, 1400);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, parsedPayload, sessionId]);

  // Process raw text payload (JSON structure from mobile app)
  const handleProcessRawData = (rawTextOrObject: any) => {
    setParseError(null);
    try {
      let parsed: any;
      if (typeof rawTextOrObject === 'string') {
        const trimmed = rawTextOrObject.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          parsed = JSON.parse(trimmed);
        } else {
          try {
            const decoded = atob(trimmed);
            parsed = JSON.parse(decoded);
          } catch {
            parsed = JSON.parse(trimmed);
          }
        }
      } else {
        parsed = rawTextOrObject;
      }

      const validated = validateMobilePayload(parsed);
      if (!validated.isValid || !validated.data) {
        setParseError(validated.error || 'Ungültiges Payload-Format der Mobile-App.');
        sounds.playError?.();
        return;
      }

      setParsedPayload(validated.data);
      const initialIdxs = new Set<number>();
      validated.data.tickets.forEach((_, idx) => initialIdxs.add(idx));
      setSelectedTicketIndexes(initialIdxs);

      if (validated.data.date_range?.from) {
        setDateFilterStart(validated.data.date_range.from);
      }
      if (validated.data.date_range?.to) {
        setDateFilterEnd(validated.data.date_range.to);
      }

      sounds.playSuccess();
    } catch (e: any) {
      console.error('Payload parse error:', e);
      setParseError(`Fehler beim Verarbeiten der mobilen Daten: ${e.message || 'Ungültiges JSON'}`);
      sounds.playError?.();
    }
  };

  // Deduplication & Filter Engine
  const analyzedItems = React.useMemo(() => {
    if (!parsedPayload) return { newTickets: [], duplicateTickets: [], allAnalyzed: [], duplicateCount: 0, newCount: 0 };

    const newTickets: Array<{ item: MobileCompanionTicketItem; isDuplicate: boolean; existingMatch?: SupportServiceTicket }> = [];
    const duplicateTickets: Array<{ item: MobileCompanionTicketItem; existingMatch: SupportServiceTicket }> = [];

    parsedPayload.tickets.forEach((mTicket) => {
      // Date filter check
      if (mTicket.created_at) {
        const itemDate = mTicket.created_at.split('T')[0];
        if (dateFilterStart && itemDate < dateFilterStart) return;
        if (dateFilterEnd && itemDate > dateFilterEnd) return;
      }

      // Check duplicate against existing SOCDOF tickets
      const match = existingTickets.find(ex => {
        if (mTicket.ticket_number && ex.ticketNumber.toLowerCase() === mTicket.ticket_number.toLowerCase()) {
          return true;
        }
        if (mTicket.id && ex.id === mTicket.id) {
          return true;
        }
        if (
          ex.title.toLowerCase() === mTicket.title.toLowerCase() &&
          ex.contact_name?.toLowerCase() === (mTicket.customer_name || '').toLowerCase() &&
          ex.createdAt.split('T')[0] === (mTicket.created_at || '').split('T')[0]
        ) {
          return true;
        }
        return false;
      });

      if (match) {
        duplicateTickets.push({ item: mTicket, existingMatch: match });
        newTickets.push({ item: mTicket, isDuplicate: true, existingMatch: match });
      } else {
        newTickets.push({ item: mTicket, isDuplicate: false });
      }
    });

    return {
      allAnalyzed: newTickets,
      duplicateCount: duplicateTickets.length,
      newCount: newTickets.filter(n => !n.isDuplicate).length
    };
  }, [parsedPayload, existingTickets, dateFilterStart, dateFilterEnd]);

  // Execute Final Import into SOCDOF
  const handleExecuteImport = () => {
    if (!parsedPayload) return;
    sounds.playClick();

    const ticketsToCreate: SupportServiceTicket[] = [];
    const ticketsToUpdate: SupportServiceTicket[] = [];

    analyzedItems.allAnalyzed.forEach(({ item, isDuplicate, existingMatch }, index) => {
      if (!selectedTicketIndexes.has(index)) return;
      if (isDuplicate && skipDuplicates) return;

      if (isDuplicate && existingMatch) {
        // Merge & append timesheets/expenses to existing ticket
        const existingTs = existingMatch.timesheets || [];
        const existingExp = existingMatch.expenses || [];
        const existingActs = existingMatch.activities || [];

        const incomingTs: SupportTimesheetEntry[] = (item.timesheets || []).map(ts => ({
          id: ts.id || `ts_mob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ticket_id: existingMatch.id,
          date: ts.date || new Date().toISOString().split('T')[0],
          staff: ts.staff || item.assigned_staff || 'Mobile Außendienst',
          description: ts.description || 'Außendienst Einsatzzeit',
          hours: Number(ts.hours) || 0,
          hourlyRate: ts.hourly_rate || existingMatch.hourlyRate || 65,
          billable: ts.billable !== false,
          startedAt: ts.started_at,
          endedAt: ts.ended_at,
          travelKm: ts.travel_km,
          locationName: ts.location_name,
          geoLatitude: ts.geo_latitude,
          geoLongitude: ts.geo_longitude
        }));

        const incomingExp: SupportExpenseEntry[] = (item.expenses || []).map(exp => ({
          id: exp.id || `exp_mob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ticket_id: existingMatch.id,
          date: exp.date || new Date().toISOString().split('T')[0],
          title: exp.title || 'Spesen / Auslage',
          amount: Number(exp.amount) || 0,
          category: exp.category || 'material',
          notes: exp.notes,
          billable: exp.billable !== false
        }));

        const incomingActs: SupportActivityEntry[] = (item.voice_notes || []).map(vn => ({
          id: vn.id || `act_vn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          author: vn.author || item.assigned_staff || 'Mobile App',
          type: 'voice_note',
          content: vn.text_transcript ? `🎙️ Sprachnotiz-Transkript: "${vn.text_transcript}"` : '🎙️ Sprachnotiz erfasst',
          createdAt: vn.created_at || new Date().toISOString()
        }));

        const updated: SupportServiceTicket = {
          ...existingMatch,
          timesheets: [...incomingTs, ...existingTs],
          expenses: [...incomingExp, ...existingExp],
          activities: [
            {
              id: `act_sync_${Date.now()}`,
              author: 'Mobile Sync',
              type: 'system',
              content: `📱 Daten von Mobile-App aktualisiert (+${incomingTs.length} Zeiten, +${incomingExp.length} Spesen/Fahrten).`,
              createdAt: new Date().toISOString()
            },
            ...incomingActs,
            ...existingActs
          ],
          location_name: item.location_name || existingMatch.location_name,
          travel_km: (existingMatch.travel_km || 0) + (item.travel_km || 0),
          updatedAt: new Date().toISOString()
        };

        ticketsToUpdate.push(updated);
      } else {
        // Create brand new ticket in SOCDOF
        const newTicketId = item.id || `sup_mob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const ticketNum = item.ticket_number || `MOB-${Math.floor(1000 + Math.random() * 9000)}`;

        const timesheets: SupportTimesheetEntry[] = (item.timesheets || []).map(ts => ({
          id: ts.id || `ts_mob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ticket_id: newTicketId,
          date: ts.date || new Date().toISOString().split('T')[0],
          staff: ts.staff || item.assigned_staff || 'Mobile Außendienst',
          description: ts.description || 'Außendienst Vor-Ort-Einsatz',
          hours: Number(ts.hours) || 0,
          hourlyRate: ts.hourly_rate || 65,
          billable: ts.billable !== false,
          startedAt: ts.started_at,
          endedAt: ts.ended_at,
          travelKm: ts.travel_km,
          locationName: ts.location_name,
          geoLatitude: ts.geo_latitude,
          geoLongitude: ts.geo_longitude
        }));

        const expenses: SupportExpenseEntry[] = (item.expenses || []).map(exp => ({
          id: exp.id || `exp_mob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ticket_id: newTicketId,
          date: exp.date || new Date().toISOString().split('T')[0],
          title: exp.title || 'Spesen',
          amount: Number(exp.amount) || 0,
          category: exp.category || 'material',
          notes: exp.notes,
          billable: exp.billable !== false
        }));

        const activities: SupportActivityEntry[] = [
          {
            id: `act_mob_init_${Date.now()}`,
            author: 'Mobile Companion',
            type: 'system',
            content: `📱 Direkt importiert aus Mobile-App (${parsedPayload.appName || 'TimeTracking'}).`,
            createdAt: new Date().toISOString()
          },
          ...(item.voice_notes || []).map(vn => ({
            id: vn.id || `act_vn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            author: vn.author || item.assigned_staff || 'Mobile App',
            type: 'voice_note' as const,
            content: vn.text_transcript ? `🎙️ Sprachnotiz: "${vn.text_transcript}"` : '🎙️ Sprachnotiz erfasst',
            createdAt: vn.created_at || new Date().toISOString()
          }))
        ];

        const newTicket: SupportServiceTicket = {
          id: newTicketId,
          ticketNumber: ticketNum,
          title: item.title || 'Außendienst Einsatz',
          team: item.team || 'Kundendienst & Außendienst',
          assignedStaff: item.assigned_staff || 'Außendienst',
          priority: item.priority !== undefined ? item.priority : 1,
          tags: ['Mobile-Sync', 'Außendienst', 'TimeTracking'],
          contact_name: item.customer_name || 'Unbekannter Kunde',
          contact_email: item.customer_email || '',
          contact_phone: item.customer_phone || '',
          contact_company: item.customer_company || item.customer_name || '',
          status: item.status || 'in_progress',
          description: item.description || '',
          timesheets,
          expenses,
          activities,
          location_name: item.location_name,
          geo_latitude: item.geo_latitude,
          geo_longitude: item.geo_longitude,
          travel_km: item.travel_km,
          source_device: 'mobile_companion',
          hourlyRate: timesheets[0]?.hourlyRate || 65,
          billable: true,
          createdAt: item.created_at || new Date().toISOString()
        };

        ticketsToCreate.push(newTicket);
      }
    });

    if (parsedPayload.standalone_timesheets && parsedPayload.standalone_timesheets.length > 0) {
      const genericTicketId = `sup_mob_gen_${Date.now()}`;
      const tsEntries: SupportTimesheetEntry[] = parsedPayload.standalone_timesheets.map(ts => ({
        id: ts.id || `ts_${Date.now()}_${Math.random()}`,
        ticket_id: genericTicketId,
        date: ts.date || new Date().toISOString().split('T')[0],
        staff: ts.staff || 'Außendienst',
        description: ts.description || 'Allgemeine Zeiterfassung',
        hours: Number(ts.hours) || 0,
        hourlyRate: ts.hourly_rate || 65,
        billable: ts.billable !== false,
        travelKm: ts.travel_km,
        locationName: ts.location_name
      }));

      const newGenericTicket: SupportServiceTicket = {
        id: genericTicketId,
        ticketNumber: `MOB-GEN-${Math.floor(1000 + Math.random() * 9000)}`,
        title: '📱 Sammel-Zeiterfassung (Mobile App)',
        team: 'Außendienst',
        assignedStaff: 'Außendienst',
        priority: 1,
        tags: ['Mobile-Sync', 'Zeiterfassung'],
        contact_name: 'Allgemein',
        status: 'in_progress',
        description: 'Aus der mobilen App importierte Zeiteinträge ohne spezifisches Ticket.',
        timesheets: tsEntries,
        activities: [
          {
            id: `act_${Date.now()}`,
            author: 'Mobile Sync',
            type: 'system',
            content: `📱 ${tsEntries.length} Zeiteinträge importiert.`,
            createdAt: new Date().toISOString()
          }
        ],
        hourlyRate: 65,
        billable: true,
        source_device: 'mobile_companion',
        createdAt: new Date().toISOString()
      };
      ticketsToCreate.push(newGenericTicket);
    }

    // Save fleet trips to localStorage if present in payload
    if (parsedPayload.trips && Array.isArray(parsedPayload.trips) && parsedPayload.trips.length > 0) {
      try {
        const savedTrips = JSON.parse(localStorage.getItem('odoo_fleet_trips') || '[]');
        const incomingTrips = parsedPayload.trips.map(tr => ({
          id: tr.id || `trp_mob_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          vehiclePlate: tr.vehicle_plate || 'MOB-01',
          driverName: tr.driver || 'Außendienst',
          date: tr.date || new Date().toISOString().split('T')[0],
          purpose: tr.purpose || 'business',
          startLocation: tr.start_location || 'Betriebsstätte',
          endLocation: tr.end_location || 'Kunde',
          startKm: Number(tr.start_km) || 0,
          endKm: Number(tr.end_km) || (Number(tr.start_km) || 0) + (Number(tr.distance_km) || 0),
          distanceKm: Number(tr.distance_km) || Math.max(0, (Number(tr.end_km) || 0) - (Number(tr.start_km) || 0)),
          notes: tr.notes || 'Aus Mobile-App importiert',
          billableToCustomer: tr.billable !== false,
          createdAt: new Date().toISOString()
        }));
        localStorage.setItem('odoo_fleet_trips', JSON.stringify([...incomingTrips, ...savedTrips]));
      } catch (err) {
        console.error('Failed to save mobile fleet trips:', err);
      }
    }

    onImportComplete(ticketsToCreate, ticketsToUpdate);
    sounds.playSuccess();
    onClose();
  };

  const toggleExpand = (idx: number) => {
    const next = new Set(expandedDetails);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedDetails(next);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold">
                  {t('mobile_sync.modal_title', undefined, 'Mobile App Kopplung & QR-Code Empfänger')}
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-mono font-bold tracking-wider uppercase">
                  Desktop Empfänger
                </span>
              </div>
              <p className="text-xs text-white/80">
                {t('mobile_sync.modal_subtitle', undefined, 'Scanne diesen QR-Code mit deiner Mobile-App, um erfasste Zeiten & Tickets direkt zu übertragen')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          
          {/* VIEW 1: High-Res Desktop QR Code Display (Default) */}
          {!parsedPayload && (
            <div className="flex flex-col items-center text-center space-y-5">
              
              {/* Instructions & Network Mode Switcher */}
              <div className="w-full max-w-xl space-y-3">
                <div className="p-3.5 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/40 dark:to-blue-950/40 border border-cyan-200 dark:border-cyan-800/60 rounded-2xl text-xs text-cyan-900 dark:text-cyan-200 flex items-center gap-3">
                  <Smartphone className="w-7 h-7 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <div className="text-left leading-relaxed">
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      Smartphone-Kamera auf den QR-Code richten:
                    </div>
                    <span>
                      In der mobilen App auf <strong>„An Desktop senden / QR scannen“</strong> tippen und die Kamera vor diesen QR-Code halten.
                    </span>
                  </div>
                </div>

                {/* Network Target Mode Selector Tabs */}
                <div className="bg-slate-100 dark:bg-slate-800/70 p-1 rounded-2xl flex items-center gap-1 text-xs border border-slate-200 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setNetworkMode('web');
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
                      networkMode === 'web'
                        ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Cloud / Web-Vorschau</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setNetworkMode('lan');
                    }}
                    className={`flex-1 py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
                      networkMode === 'lan'
                        ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Lokales WLAN (Desktop-App)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sounds.playClick();
                      setNetworkMode('custom');
                    }}
                    className={`py-1.5 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
                      networkMode === 'custom'
                        ? 'bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-slate-700'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    <span>Benutzerdefiniert</span>
                  </button>
                </div>

                {/* Sub-controls for LAN or Custom IP */}
                {networkMode === 'lan' && detectedIps.length > 0 && (
                  <div className="flex items-center justify-center gap-2 text-xs flex-wrap bg-cyan-50/50 dark:bg-cyan-950/20 p-2 rounded-xl border border-cyan-200/50 dark:border-cyan-800/30">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">WLAN-IP deines PCs:</span>
                    <select
                      value={selectedIp}
                      onChange={(e) => {
                        setSelectedIp(e.target.value);
                        sounds.playClick();
                      }}
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 font-mono text-xs text-slate-800 dark:text-slate-200 font-bold focus:ring-2 focus:ring-cyan-500"
                    >
                      {detectedIps.map((ip) => (
                        <option key={ip} value={ip}>{ip} (Port 3000)</option>
                      ))}
                    </select>
                  </div>
                )}

                {networkMode === 'custom' && (
                  <div className="flex items-center justify-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400 font-semibold">Eigene Adresse / IP:</span>
                    <input
                      type="text"
                      value={customHost}
                      onChange={(e) => setCustomHost(e.target.value)}
                      placeholder="http://192.168.1.100:3000/api/mobile-sync"
                      className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 font-mono text-xs w-72 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                )}
              </div>

              {/* High-Resolution QR Card */}
              <div className="relative p-5 bg-white rounded-3xl border-4 border-slate-200 dark:border-slate-800 shadow-xl flex flex-col items-center justify-center">
                {isGeneratingQR || !qrDataUrl ? (
                  <div className="w-64 h-64 flex items-center justify-center">
                    <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin" />
                  </div>
                ) : (
                  <div className="relative group">
                    <img 
                      src={qrDataUrl} 
                      alt="SOCDOF Desktop Pairing QR Code" 
                      className="w-64 h-64 object-contain rounded-xl select-none"
                    />
                    <div className="absolute inset-0 bg-cyan-500/5 rounded-xl pointer-events-none" />
                  </div>
                )}

                {/* Session ID & Target Endpoint Badge */}
                <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-sm">
                  <div className="flex items-center justify-between w-full bg-slate-100 dark:bg-slate-800/90 px-3 py-1.5 rounded-xl text-[11px] font-mono text-slate-700 dark:text-slate-300">
                    <span className="text-slate-400 font-sans">Session:</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-300">{sessionId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(sessionId);
                        setCopiedSession(true);
                        sounds.playClick();
                        setTimeout(() => setCopiedSession(false), 2000);
                      }}
                      className="p-1 hover:text-cyan-600 transition"
                      title="Session-Code kopieren"
                    >
                      {copiedSession ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Network / Endpoint selector */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 w-full justify-center">
                    <Wifi className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                    <span className="truncate max-w-[260px]">Ziel: <strong className="text-slate-700 dark:text-slate-300">{selectedHost}</strong></span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedHost);
                        setCopiedUrl(true);
                        sounds.playClick();
                        setTimeout(() => setCopiedUrl(false), 2000);
                      }}
                      className="p-0.5 hover:text-cyan-600 transition shrink-0"
                      title="Sync URL kopieren"
                    >
                      {copiedUrl ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Status / Listening Badge with Pulse */}
              <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-1.5 rounded-full">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span>Hintergrund-Empfänger aktiv • Wartet auf Übertragung...</span>
              </div>

              {/* Troubleshooting Accordion */}
              <div className="w-full max-w-xl text-left">
                <button
                  type="button"
                  onClick={() => setShowTroubleshoot(!showTroubleshoot)}
                  className="text-xs text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 flex items-center justify-between w-full p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
                >
                  <span className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Warum meldet die Handy-App „Verbindung fehlgeschlagen“?
                  </span>
                  {showTroubleshoot ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showTroubleshoot && (
                  <div className="mt-2 p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl text-xs text-slate-700 dark:text-slate-300 space-y-2 animate-fade-in leading-relaxed">
                    <p>
                      <strong>1. Testen in der Browser-Vorschau (Cloud):</strong><br />
                      Wähle oben den Reiter <strong>„Cloud / Web-Vorschau“</strong>. Dadurch generiert SOCDOF eine gesicherte Web-URL. Dein Smartphone kann diesen QR-Code von überall aus scannen (auch über mobiles LTE/5G).
                    </p>
                    <p>
                      <strong>2. Lokale Desktop-App (.exe auf deinem PC):</strong><br />
                      Wenn SOCDOF als installierte Windows-App läuft, wähle <strong>„Lokales WLAN“</strong>. Achte darauf, dass PC und Smartphone im selben WLAN-Router eingeloggt sind und die Windows-Firewall den Port 3000 nicht blockiert.
                    </p>
                    <p>
                      <strong>3. Offline-Fallback:</strong><br />
                      Klicke unten auf <strong>„Mobile JSON-Daten manuell einfügen“</strong>, um den Inhalt der Datei direkt ohne Netzwerkverbindung einzulesen.
                    </p>
                  </div>
                )}
              </div>

              {/* Secondary Actions / Manual Paste toggle */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 w-full flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    generateNewSession();
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1.5 font-medium transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Neuen QR-Code generieren</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setShowManualPaste(!showManualPaste);
                  }}
                  className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{showManualPaste ? 'JSON-Eingabe ausblenden' : 'Mobile JSON-Daten manuell einfügen'}</span>
                </button>
              </div>

              {/* Optional Inline JSON Drop / Paste area */}
              {showManualPaste && (
                <div className="w-full text-left space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl animate-fade-in">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    JSON-Daten aus der Handy-App einfügen (z. B. Beispieldaten oder geteilte sync_payload.json):
                  </label>
                  <textarea
                    rows={6}
                    value={rawJsonInput}
                    onChange={(e) => setRawJsonInput(e.target.value)}
                    placeholder='{"exportVersion": "1.0", "appName": "SOCDOF TimeTracking Mobile", "sessions": [...], "trips": [...], "customers": [...]}'
                    className="w-full p-2.5 font-mono text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {parseError && (
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-600 dark:text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{parseError}</span>
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleProcessRawData(rawJsonInput)}
                      disabled={!rawJsonInput.trim()}
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>Daten verarbeiten & in Staging laden</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* VIEW 2: STAGING & DEDUPLICATION SCREEN (When Data is received) */}
          {parsedPayload && (
            <div className="space-y-4 animate-fade-in">
              
              {/* Overview Summary Ribbon */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-cyan-50/30 dark:from-slate-800/80 dark:to-cyan-950/20 border border-cyan-200/60 dark:border-slate-700 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-cyan-600 text-white flex items-center justify-center font-bold shadow-md shadow-cyan-600/20">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>{parsedPayload.appName || 'SOCDOF TimeTracking Mobile'}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 font-mono">
                        v{parsedPayload.export_version || '1.0'}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {parsedPayload.summary?.totalSessions || analyzedItems.allAnalyzed.length} Einsätze • {parsedPayload.summary?.totalTrips || parsedPayload.raw_trips?.length || 0} Fahrten ({parsedPayload.summary?.totalKilometers || 0} km) • {parsedPayload.summary?.totalWorkHours || 0} Std.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800">
                    +{analyzedItems.newCount} Neu
                  </span>
                  {analyzedItems.duplicateCount > 0 && (
                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-xs font-bold rounded-xl border border-amber-200 dark:border-amber-800">
                      {analyzedItems.duplicateCount} Vorhanden
                    </span>
                  )}
                </div>
              </div>

              {/* Filters & Deduplication Toolbar */}
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Date Range Picker */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Calendar className="w-4 h-4 text-cyan-600" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {t('mobile_sync.filter_date_range', undefined, 'Zeitraum:')}
                  </span>
                  <input
                    type="date"
                    value={dateFilterStart}
                    onChange={(e) => setDateFilterStart(e.target.value)}
                    className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                  <span>bis</span>
                  <input
                    type="date"
                    value={dateFilterEnd}
                    onChange={(e) => setDateFilterEnd(e.target.value)}
                    className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                  />
                </div>

                {/* Deduplication Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="skip_dups_cb"
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded-md cursor-pointer"
                  />
                  <label htmlFor="skip_dups_cb" className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                    {t('mobile_sync.skip_duplicates_label', undefined, 'Duplikate überspringen')}
                  </label>
                </div>
              </div>

              {/* Staged Items List with 5 Note Fields Accordion */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {analyzedItems.allAnalyzed.map(({ item, isDuplicate, existingMatch }, idx) => {
                  const isSelected = selectedTicketIndexes.has(idx);
                  const isExpanded = expandedDetails.has(idx);
                  const totalHours = (item.timesheets || []).reduce((acc, ts) => acc + (Number(ts.hours) || 0), 0);
                  const totalExp = (item.expenses || []).reduce((acc, exp) => acc + (Number(exp.amount) || 0), 0);

                  return (
                    <div 
                      key={idx} 
                      className={`p-3.5 transition flex flex-col gap-2.5 ${
                        isDuplicate 
                          ? 'bg-amber-50/40 dark:bg-amber-950/15' 
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedTicketIndexes);
                            if (e.target.checked) next.add(idx);
                            else next.delete(idx);
                            setSelectedTicketIndexes(next);
                          }}
                          className="w-4 h-4 mt-1 text-cyan-600 rounded-md cursor-pointer shrink-0"
                        />

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                              {item.title}
                            </span>
                            {item.ticket_number && (
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                                {item.ticket_number}
                              </span>
                            )}
                            {isDuplicate ? (
                              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-md flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {skipDuplicates ? 'Vorhanden (Übersprungen)' : 'Vorhanden (Wird zusammengeführt)'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-md">
                                Neu
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            {item.customer_name && (
                              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                <Building className="w-3 h-3 text-slate-400" />
                                {item.customer_name}
                              </span>
                            )}
                            {item.location_name && (
                              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                <MapPin className="w-3 h-3 text-cyan-500" />
                                {item.location_name}
                              </span>
                            )}
                            {item.travel_km !== undefined && item.travel_km > 0 && (
                              <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-mono">
                                <Navigation className="w-3 h-3" />
                                {item.travel_km} km
                              </span>
                            )}
                            {totalHours > 0 && (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                                <Clock className="w-3 h-3" />
                                {totalHours.toFixed(2)} h ({item.timesheets?.[0]?.hourlyRate || 65} {currency}/h)
                              </span>
                            )}
                            {totalExp > 0 && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold font-mono">
                                <Receipt className="w-3 h-3" />
                                {totalExp.toFixed(2)} {currency} Spesen/Fahrt
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Toggle Description & 5 Notes preview */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(idx)}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition shrink-0"
                          title="Details & 5 Notizfelder einsehen"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Expandable 5-Part Notes & Details */}
                      {isExpanded && (
                        <div className="mt-2 ml-7 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2 animate-fade-in">
                          <div className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <FileCheck className="w-3.5 h-3.5 text-cyan-600" />
                            <span>Übertragene Notizen & Tätigkeitsbericht:</span>
                          </div>
                          <div className="whitespace-pre-line text-slate-600 dark:text-slate-300 font-sans leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                            {item.description}
                          </div>

                          {item.customer_address && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                              <span>📍 Adresse:</span>
                              <strong>{item.customer_address}</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Staging Bottom Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playClick();
                    setParsedPayload(null);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  &larr; {t('mobile_sync.btn_scan_again', undefined, 'Zurück zum QR-Code')}
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-600/20 transition active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('mobile_sync.btn_apply_import', undefined, 'Ausgewählte Daten in SOCDOF einbuchen')}</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
