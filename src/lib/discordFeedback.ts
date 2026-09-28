/**
 * Discord Feedback & Bug Report Service
 * Sends live forum posts with embeds, user pings, and tags to Discord channels.
 * Provides real-time synchronization with Discord forum tags and thread message history.
 */

import { APP_VERSION } from './version';

export interface DiscordReportPayload {
  type: 'bug' | 'idea';
  title: string;
  categoryOrLocation: string;
  description: string;
  discordName?: string;
  discordUserId?: string;
  originalOfflineCreatedAt?: string;
  appVersion?: string;
  appLanguage?: string;
  systemLanguage?: string;
}

export function getAppLanguageLabel(code?: string): string {
  const c = code || (typeof localStorage !== 'undefined' ? (localStorage.getItem('socdof_language_v1') || 'de') : 'de');
  switch (c) {
    case 'en': return 'English (EN)';
    case 'fr': return 'Français (FR)';
    case 'es': return 'Español (ES)';
    case 'de':
    default:
      return 'Deutsch (DE)';
  }
}

export function getSystemLanguageLabel(): string {
  if (typeof navigator !== 'undefined') {
    return navigator.language || (navigator.languages && navigator.languages[0]) || 'de-DE';
  }
  return 'de-DE';
}

export const DISCORD_CONFIG = {
  BOT_TOKEN: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DISCORD_BOT_TOKEN) || 
             (typeof process !== 'undefined' && (process.env as any)?.VITE_DISCORD_BOT_TOKEN) || 
             (typeof process !== 'undefined' && (process.env as any)?.DISCORD_BOT_TOKEN) || 
             '',
  BUG_CHANNEL_ID: '1535709136363462757', // #🐛 | REPORT forum channel
  BUG_TAG_ID: '1535711015902384269',     // ⏳ Neue Einreichung (Prüfung ausstehend)
  IDEA_CHANNEL_ID: '1524133720876126408', // #💡vorschläge forum channel
  IDEA_TAG_ID: '1553317496159731722',     // SOCDOF tag
  BOTGHOST_WEBHOOK: 'https://api.botghost.com/webhook/1498764033518735441/t5dcd2k8x1n8i53932gf',
};

export type DiscordReportStatus = 
  | 'queued'       // ⏳ In Warteschlange (Offline erfasst)
  | 'pending'      // ⏳ Neue Einreichung
  | 'reviewing'    // 🔍 Wird überprüft
  | 'rejected'     // ❌ Abgelehnt
  | 'resolved'     // ✅ Behoben / Erledigt
  | 'in_progress'  // 🔨 Problem-Fix in Bearbeitung
  | 'forwarded';   // ↗️ Bestätigt & Weitergeleitet

export interface DiscordTagDefinition {
  id: string;
  name: string;
  emoji?: string;
  emojiId?: string;
  color: 'slate' | 'sky' | 'rose' | 'emerald' | 'amber' | 'indigo';
  status: DiscordReportStatus;
}

/**
 * Known Bug Report Forum Tag IDs provided by Discord server
 */
export const KNOWN_BUG_TAGS: Record<string, DiscordTagDefinition> = {
  '1535711015902384269': {
    id: '1535711015902384269',
    name: 'Neue Einreichung',
    emoji: '⏳',
    color: 'slate',
    status: 'pending'
  },
  '1535711141517336636': {
    id: '1535711141517336636',
    name: 'Wird überprüft',
    emoji: '🔍',
    color: 'sky',
    status: 'reviewing'
  },
  '1535710238995648512': {
    id: '1535710238995648512',
    name: 'Abgelehnt',
    emoji: '❌',
    color: 'rose',
    status: 'rejected'
  },
  '1535711300058091520': {
    id: '1535711300058091520',
    name: 'Behoben',
    emoji: '✅',
    color: 'emerald',
    status: 'resolved'
  },
  '1535714553453740143': {
    id: '1535714553453740143',
    name: 'Fix in Bearbeitung',
    emoji: '🔨',
    color: 'amber',
    status: 'in_progress'
  },
  '1535714372427583578': {
    id: '1535714372427583578',
    name: 'Bestätigt & weitergeleitet',
    emoji: '↗️',
    color: 'indigo',
    status: 'forwarded'
  }
};

const DISCORD_IDENTITY_STORAGE_KEY = 'socdof_discord_identity_v1';

export interface StoredDiscordIdentity {
  discordName: string;
  discordUserId?: string;
}

export interface DiscordTagInfo {
  id: string;
  name: string;
  emojiName?: string;
  emojiId?: string;
  moderated?: boolean;
}

/**
 * Dynamically queries available forum tags for a channel directly from Discord REST API
 */
export async function fetchDiscordChannelTags(channelId: string): Promise<DiscordTagInfo[]> {
  // 1. Try Backend Proxy
  try {
    const res = await fetch(`/api/discord/channel-tags?channelId=${channelId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.tags)) {
        return data.tags;
      }
    }
  } catch {}

  // 2. Direct Discord API Fallback
  if (DISCORD_CONFIG.BOT_TOKEN) {
    try {
      const resp = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
        headers: {
          Authorization: `Bot ${DISCORD_CONFIG.BOT_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.available_tags)) {
          return data.available_tags.map((t: any) => ({
            id: t.id,
            name: t.name,
            emojiName: t.emoji_name || undefined,
            emojiId: t.emoji_id || undefined,
            moderated: !!t.moderated
          }));
        }
      }
    } catch {}
  }

  // 3. Fallback to known constants if channel matches
  if (channelId === DISCORD_CONFIG.BUG_CHANNEL_ID) {
    return Object.values(KNOWN_BUG_TAGS).map(t => ({
      id: t.id,
      name: t.name,
      emojiName: t.emoji
    }));
  }
  if (channelId === DISCORD_CONFIG.IDEA_CHANNEL_ID) {
    return [{
      id: DISCORD_CONFIG.IDEA_TAG_ID,
      name: 'SOCDOF',
      emojiName: '🌐'
    }];
  }

  return [];
}

/**
 * Dynamically resolves the best tag ID and name for a new forum submission
 */
export async function resolveSubmissionTag(channelId: string, type: 'bug' | 'idea'): Promise<{ tagId: string; tagName: string }> {
  try {
    const tags = await fetchDiscordChannelTags(channelId);
    if (tags && tags.length > 0) {
      if (type === 'bug') {
        // Look for matching tag: 'Neue Einreichung', 'Einreichung', 'Pending', 'Neu', 'Offen', 'Report', 'Prüfung'
        const candidate = tags.find(t => {
          const lower = t.name.toLowerCase();
          return lower.includes('neue einreichung') ||
                 lower.includes('einreichung') ||
                 lower.includes('pending') ||
                 lower.includes('neu') ||
                 lower.includes('offen') ||
                 lower.includes('open') ||
                 lower.includes('prüfung');
        });
        if (candidate) {
          const prefix = candidate.emojiName ? `${candidate.emojiName} ` : '⏳ ';
          return { tagId: candidate.id, tagName: `${prefix}${candidate.name}` };
        }
      } else {
        // Idea forum channel: look for 'socdof', 'vorschlag', 'idee', 'feedback'
        const candidate = tags.find(t => {
          const lower = t.name.toLowerCase();
          return lower.includes('socdof') ||
                 lower.includes('vorschlag') ||
                 lower.includes('idee') ||
                 lower.includes('feedback');
        });
        if (candidate) {
          const prefix = candidate.emojiName ? `${candidate.emojiName} ` : '🌐 ';
          return { tagId: candidate.id, tagName: `${prefix}${candidate.name}` };
        }
      }

      // If no specific keyword matches, use the first tag defined in this forum channel
      const first = tags[0];
      const prefix = first.emojiName ? `${first.emojiName} ` : '';
      return { tagId: first.id, tagName: `${prefix}${first.name}` };
    }
  } catch (err) {
    console.warn('Failed to resolve dynamic Discord tag, using fallback:', err);
  }

  // Static Fallbacks
  if (type === 'bug') {
    return { tagId: DISCORD_CONFIG.BUG_TAG_ID, tagName: '⏳ Neue Einreichung' };
  }
  return { tagId: DISCORD_CONFIG.IDEA_TAG_ID, tagName: '🌐 SOCDOF' };
}

export function getStoredDiscordIdentity(): StoredDiscordIdentity {
  try {
    const raw = localStorage.getItem(DISCORD_IDENTITY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const lower = typeof parsed?.discordName === 'string' ? parsed.discordName.trim().toLowerCase() : '';
      const name = (typeof parsed?.discordName === 'string' && lower !== 'strudelgame' && lower !== 'strudel' && lower !== 'strudel team')
        ? parsed.discordName.trim()
        : '';
      return {
        discordName: name,
        discordUserId: parsed?.discordUserId || ''
      };
    }
  } catch {}
  return { discordName: '', discordUserId: '' };
}

export function saveStoredDiscordIdentity(identity: StoredDiscordIdentity): void {
  try {
    localStorage.setItem(DISCORD_IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {}
}

const SUBMITTED_REPORTS_STORAGE_KEY = 'socdof_discord_submitted_reports_v1';

export interface SubmittedDiscordReport {
  id: string;
  type: 'bug' | 'idea';
  title: string;
  categoryOrLocation: string;
  description: string;
  discordName: string;
  discordUserId?: string;
  threadId: string;
  threadUrl: string;
  channelId: string;
  channelName: string;
  tagId: string;
  tagName: string;
  appliedTags?: DiscordTagInfo[];
  status: DiscordReportStatus;
  statusLabel?: string;
  isArchived?: boolean;
  isLocked?: boolean;
  isDeleted?: boolean;
  messageCount?: number;
  lastSyncedAt?: string;
  createdAt: string;
  queuedAt?: string;
  originalOfflineCreatedAt?: string;
}

export function getSubmittedDiscordReports(): SubmittedDiscordReport[] {
  try {
    const raw = localStorage.getItem(SUBMITTED_REPORTS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [];
}

export function saveSubmittedDiscordReport(report: SubmittedDiscordReport): void {
  try {
    const existing = getSubmittedDiscordReports();
    const updated = [report, ...existing.filter(r => r.id !== report.id && r.threadId !== report.threadId)];
    localStorage.setItem(SUBMITTED_REPORTS_STORAGE_KEY, JSON.stringify(updated.slice(0, 50)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socdof:discord-reports-changed', { detail: { reports: updated } }));
    }
  } catch {}
}

export function deleteSubmittedDiscordReport(id: string): void {
  try {
    const existing = getSubmittedDiscordReports();
    const updated = existing.filter(r => r.id !== id);
    localStorage.setItem(SUBMITTED_REPORTS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socdof:discord-reports-changed', { detail: { reports: updated } }));
    }
  } catch {}
}

/**
 * Computes status strictly from applied Discord tags
 */
export function computeReportStatusFromTags(
  appliedTags: DiscordTagInfo[] = [], 
  isArchived = false, 
  isLocked = false
): DiscordReportStatus {
  // 1. Exact Tag ID match
  const tagIds = appliedTags.map(t => t.id);

  if (tagIds.includes('1535710238995648512')) {
    return 'rejected';
  }
  if (tagIds.includes('1535711300058091520')) {
    return 'resolved';
  }
  if (tagIds.includes('1535714553453740143')) {
    return 'in_progress';
  }
  if (tagIds.includes('1535714372427583578')) {
    return 'forwarded';
  }
  if (tagIds.includes('1535711141517336636')) {
    return 'reviewing';
  }
  if (tagIds.includes('1535711015902384269')) {
    return 'pending';
  }

  // 2. Fuzzy name matching (in case server tags are renamed or customized)
  const tagNamesCombined = appliedTags.map(t => t.name.toLowerCase()).join(' ');

  if (tagNamesCombined.includes('abgelehnt') || tagNamesCombined.includes('rejected') || tagNamesCombined.includes('verworfen')) {
    return 'rejected';
  }
  if (
    tagNamesCombined.includes('behoben') || 
    tagNamesCombined.includes('fixed') || 
    tagNamesCombined.includes('erledigt') || 
    tagNamesCombined.includes('gelöst') || 
    tagNamesCombined.includes('umgesetzt') ||
    isArchived || 
    isLocked
  ) {
    return 'resolved';
  }
  if (
    tagNamesCombined.includes('problem-fix') ||
    tagNamesCombined.includes('fix in bearbeitung') ||
    tagNamesCombined.includes('bearbeitung') || 
    tagNamesCombined.includes('in progress') || 
    tagNamesCombined.includes('in arbeit')
  ) {
    return 'in_progress';
  }
  if (
    tagNamesCombined.includes('weitergeleitet') || 
    tagNamesCombined.includes('bestätigt') || 
    tagNamesCombined.includes('forwarded') ||
    tagNamesCombined.includes('zuständig')
  ) {
    return 'forwarded';
  }
  if (
    tagNamesCombined.includes('überprüf') || 
    tagNamesCombined.includes('review') || 
    tagNamesCombined.includes('untersuch') || 
    tagNamesCombined.includes('investigating')
  ) {
    return 'reviewing';
  }

  return 'pending';
}

/**
 * Synchronizes submitted reports with Discord API in real-time.
 * Fetches applied forum tags, message count, archived/locked state and computes status.
 */
export async function syncDiscordReports(
  currentReports?: SubmittedDiscordReport[]
): Promise<{ updatedReports: SubmittedDiscordReport[]; changedCount: number; error?: string }> {
  const reports = currentReports || getSubmittedDiscordReports();
  if (!reports || reports.length === 0) {
    return { updatedReports: [], changedCount: 0 };
  }

  // Trigger background offline queue processing whenever sync is initiated
  if (typeof navigator === 'undefined' || navigator.onLine) {
    processDiscordOfflineQueue().catch(() => {});
  }

  // Only query remote Discord for reports that have real snowflake thread IDs (not local queued ones)
  const threadIds = reports
    .filter(r => r.status !== 'queued' && !r.threadId.startsWith('offline_queued_'))
    .map(r => r.threadId)
    .filter(Boolean);

  if (threadIds.length === 0) {
    return { updatedReports: reports, changedCount: 0 };
  }

  let changedCount = 0;
  let syncedThreadMap: Record<string, any> = {};

  // 0. Try Electron IPC Bridge if running in Desktop App
  const electronApi = (typeof window !== 'undefined' ? (window as any).electronAPI : null);
  if (electronApi?.discordRequest) {
    try {
      for (const threadId of threadIds.slice(0, 20)) {
        const res = await electronApi.discordRequest({
          endpoint: `/channels/${threadId}`,
          method: 'GET',
          botToken: DISCORD_CONFIG.BOT_TOKEN
        });
        if (res.ok && res.status === 200 && res.data) {
          const directData = res.data;
          const appliedTagIds: string[] = directData.applied_tags || [];
          const isArchived = !!directData.thread_metadata?.archived;
          const isLocked = !!directData.thread_metadata?.locked;

          const appliedTagObjects: DiscordTagInfo[] = appliedTagIds.map(id => {
            const known = KNOWN_BUG_TAGS[id];
            return {
              id,
              name: known ? known.name : id,
              emojiName: known?.emoji
            };
          });

          const computedStatus = computeReportStatusFromTags(appliedTagObjects, isArchived, isLocked);

          syncedThreadMap[threadId] = {
            id: threadId,
            name: directData.name,
            appliedTags: appliedTagObjects,
            status: computedStatus,
            isArchived,
            isLocked,
            messageCount: directData.total_message_sent ?? directData.message_count ?? 1,
            lastSyncedAt: new Date().toISOString()
          };
        } else if (res.status === 404 || res.status === 410 || res.status === 403) {
          syncedThreadMap[threadId] = {
            notFound: true,
            isDeleted: true,
            lastSyncedAt: new Date().toISOString()
          };
        }
      }
    } catch (e) {
      console.warn('Electron IPC discord sync failed:', e);
    }
  }

  // 1. Try Backend Proxy Sync if syncedThreadMap is empty
  if (Object.keys(syncedThreadMap).length === 0) {
    try {
      const resp = await fetch('/api/discord/sync-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadIds,
          botToken: DISCORD_CONFIG.BOT_TOKEN
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.threads) {
          syncedThreadMap = data.threads;
        }
      }
    } catch (proxyErr) {
      console.warn('Backend proxy /api/discord/sync-threads failed, falling back to direct API if available...', proxyErr);
    }
  }

  // 2. Direct Discord API Fallback if proxy returned nothing
  if (Object.keys(syncedThreadMap).length === 0) {
    for (const threadId of threadIds.slice(0, 20)) {
      try {
        const directResp = await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
          headers: {
            Authorization: `Bot ${DISCORD_CONFIG.BOT_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });
        if (directResp.ok) {
          const directData = await directResp.json();
          const appliedTagIds: string[] = directData.applied_tags || [];
          const isArchived = !!directData.thread_metadata?.archived;
          const isLocked = !!directData.thread_metadata?.locked;

          const appliedTagObjects: DiscordTagInfo[] = appliedTagIds.map(id => {
            const known = KNOWN_BUG_TAGS[id];
            return {
              id,
              name: known ? known.name : id,
              emojiName: known?.emoji
            };
          });

          const computedStatus = computeReportStatusFromTags(appliedTagObjects, isArchived, isLocked);

          syncedThreadMap[threadId] = {
            id: threadId,
            name: directData.name,
            appliedTags: appliedTagObjects,
            status: computedStatus,
            isArchived,
            isLocked,
            messageCount: directData.total_message_sent ?? directData.message_count ?? 1,
            lastSyncedAt: new Date().toISOString()
          };
        } else if (directResp.status === 404 || directResp.status === 410 || directResp.status === 403) {
          syncedThreadMap[threadId] = {
            notFound: true,
            isDeleted: true,
            lastSyncedAt: new Date().toISOString()
          };
        }
      } catch {}
    }
  }

  // Merge synchronized data with stored reports
  const updatedReports = reports.map(rep => {
    const syncInfo = syncedThreadMap[rep.threadId];
    if (syncInfo && (syncInfo.notFound || syncInfo.isDeleted)) {
      if (!rep.isDeleted) {
        changedCount++;
      }
      return {
        ...rep,
        isDeleted: true,
        lastSyncedAt: syncInfo.lastSyncedAt || new Date().toISOString()
      };
    }
    if (!syncInfo) {
      return rep;
    }

    const newStatus: DiscordReportStatus = syncInfo.status || computeReportStatusFromTags(syncInfo.appliedTags, syncInfo.isArchived, syncInfo.isLocked);
    const hasNewStatus = newStatus !== rep.status;
    const hasNewTags = Array.isArray(syncInfo.appliedTags) && (
      !rep.appliedTags ||
      JSON.stringify(syncInfo.appliedTags) !== JSON.stringify(rep.appliedTags)
    );
    const hasNewMsgCount = syncInfo.messageCount !== undefined && syncInfo.messageCount !== rep.messageCount;

    if (hasNewStatus || hasNewTags || hasNewMsgCount || syncInfo.isArchived !== rep.isArchived) {
      changedCount++;
    }

    return {
      ...rep,
      status: newStatus,
      appliedTags: syncInfo.appliedTags || rep.appliedTags || [{ id: rep.tagId, name: rep.tagName }],
      isArchived: syncInfo.isArchived ?? rep.isArchived,
      isLocked: syncInfo.isLocked ?? rep.isLocked,
      messageCount: syncInfo.messageCount ?? rep.messageCount ?? 1,
      lastSyncedAt: syncInfo.lastSyncedAt || new Date().toISOString()
    };
  });

  try {
    localStorage.setItem(SUBMITTED_REPORTS_STORAGE_KEY, JSON.stringify(updatedReports));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('socdof:discord-reports-synced', { 
        detail: { reports: updatedReports, changedCount, timestamp: Date.now() } 
      }));
    }
  } catch {}

  return {
    updatedReports,
    changedCount
  };
}

export interface DiscordThreadMessage {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    globalName?: string;
    avatar?: string;
    avatarUrl?: string;
    bot?: boolean;
  };
  timestamp: string;
  embeds?: Array<{
    title?: string;
    description?: string;
    color?: number;
    author?: { name?: string; icon_url?: string };
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text?: string; icon_url?: string };
  }>;
  attachments?: Array<{
    id: string;
    filename: string;
    url: string;
    proxy_url?: string;
    size?: number;
    content_type?: string;
    height?: number;
    width?: number;
  }>;
}

/**
 * Fetches messages and discussion history from a Discord Forum thread.
 */
export async function fetchDiscordThreadMessages(
  threadId: string
): Promise<{ success: boolean; messages: DiscordThreadMessage[]; error?: string }> {
  if (!threadId) {
    return { success: false, messages: [], error: 'Thread ID is required' };
  }

  // 0. Try Electron IPC if available
  const electronApi = (typeof window !== 'undefined' ? (window as any).electronAPI : null);
  if (electronApi?.discordRequest) {
    try {
      const res = await electronApi.discordRequest({
        endpoint: `/channels/${threadId}/messages?limit=50`,
        method: 'GET',
        botToken: DISCORD_CONFIG.BOT_TOKEN
      });
      if (res.ok && Array.isArray(res.data)) {
        const rawMessages = res.data;
        const sorted = [...rawMessages].reverse().map((msg: any) => {
          const avatarUrl = msg.author?.avatar
            ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=80`
            : `https://cdn.discordapp.com/embed/avatars/${(parseInt(msg.author?.id || '0', 10) || 0) % 5}.png`;

          return {
            id: msg.id,
            content: msg.content || '',
            author: {
              id: msg.author?.id || '',
              username: msg.author?.username || 'Discord User',
              globalName: msg.author?.global_name,
              avatar: msg.author?.avatar,
              avatarUrl,
              bot: !!msg.author?.bot
            },
            timestamp: msg.timestamp,
            embeds: msg.embeds,
            attachments: msg.attachments
          };
        });
        return { success: true, messages: sorted };
      }
    } catch {}
  }

  // 1. Try Backend Proxy route first
  try {
    const resp = await fetch('/api/discord/thread-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId,
        botToken: DISCORD_CONFIG.BOT_TOKEN
      })
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data.success && Array.isArray(data.messages)) {
        return { success: true, messages: data.messages };
      }
    }
  } catch (proxyErr) {
    console.warn('Backend proxy /api/discord/thread-messages failed, trying direct API...', proxyErr);
  }

  // 2. Direct Discord API Fallback
  try {
    const directResp = await fetch(`https://discord.com/api/v10/channels/${threadId}/messages?limit=50`, {
      headers: {
        Authorization: `Bot ${DISCORD_CONFIG.BOT_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (directResp.ok) {
      const rawMessages = await directResp.json();
      if (Array.isArray(rawMessages)) {
        // Chronological order: oldest to newest
        const sorted = [...rawMessages].reverse().map((msg: any) => {
          const avatarUrl = msg.author?.avatar
            ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=80`
            : `https://cdn.discordapp.com/embed/avatars/${(parseInt(msg.author?.id || '0', 10) || 0) % 5}.png`;

          return {
            id: msg.id,
            content: msg.content || '',
            author: {
              id: msg.author?.id || '',
              username: msg.author?.username || 'Discord User',
              globalName: msg.author?.global_name,
              avatar: msg.author?.avatar,
              avatarUrl,
              bot: !!msg.author?.bot
            },
            timestamp: msg.timestamp,
            embeds: msg.embeds,
            attachments: msg.attachments
          };
        });

        return { success: true, messages: sorted };
      }
    } else {
      const errText = await directResp.text();
      return { success: false, messages: [], error: `Discord HTTP ${directResp.status}: ${errText}` };
    }
  } catch (err: any) {
    return { success: false, messages: [], error: err?.message || String(err) };
  }

  return { success: false, messages: [], error: 'Unable to fetch thread messages' };
}

export async function sendDiscordReport(
  payload: DiscordReportPayload
): Promise<{ success: boolean; queued?: boolean; threadId?: string; threadUrl?: string; error?: string; message?: string }> {
  const isBug = payload.type === 'bug';
  const channelId = isBug ? DISCORD_CONFIG.BUG_CHANNEL_ID : DISCORD_CONFIG.IDEA_CHANNEL_ID;
  const channelName = isBug ? '#🐛 | REPORT' : '#💡vorschläge';

  // Dynamically resolve the actual forum tag from Discord channel available_tags
  const dynamicTag = await resolveSubmissionTag(channelId, payload.type);
  const tagId = dynamicTag.tagId;
  const tagName = dynamicTag.tagName;

  const now = new Date();
  const cleanName = payload.discordName?.trim().replace(/^@/, '') || 'Anonym';
  const isAnonymous = !payload.discordName?.trim() || cleanName.toLowerCase() === 'anonym';
  const cleanId = payload.discordUserId?.trim();

  // Discord snowflake user IDs must be exactly 17 to 20 digits
  const hasValidUserId = !!cleanId && /^\d{17,20}$/.test(cleanId);

  // If user provided a numeric snowflake ID, mention them with <@ID>
  const userMention = hasValidUserId
    ? `<@${cleanId}> (@${cleanName})`
    : (isAnonymous ? '@Anonym' : `@${cleanName}`);

  // Content for notification ping (pings user only if valid 17-20 digit ID is present)
  const messageContent = hasValidUserId ? `<@${cleanId}>` : undefined;

  const appVersion = payload.appVersion || `SOCDOF v${APP_VERSION}`;
  const appLanguageStr = payload.appLanguage || getAppLanguageLabel();
  const systemLanguageStr = payload.systemLanguage || getSystemLanguageLabel();

  // Format original creation timestamp if queued offline
  const originalCreatedDate = payload.originalOfflineCreatedAt 
    ? new Date(payload.originalOfflineCreatedAt) 
    : now;

  const formattedOriginalTime = originalCreatedDate.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const extraOfflineField = payload.originalOfflineCreatedAt ? [{
    name: '🕒 Ursprünglich offline erfasst am:',
    value: `${formattedOriginalTime} (Lokale Client-Zeit)`,
    inline: false
  }] : [];

  // Discord Embed structure
  const embed = isBug
    ? {
        author: {
          name: cleanName,
        },
        title: '❗ NEW REPORT ❗',
        description: 'New Bug Reported!',
        color: 15816994, // Orange #f15922
        fields: [
          {
            name: 'Reported By:',
            value: userMention,
            inline: false,
          },
          ...extraOfflineField,
          {
            name: 'Bug Location:',
            value: payload.categoryOrLocation || 'Allgemein',
            inline: false,
          },
          {
            name: 'Bug Information:',
            value: payload.description || 'Keine Angabe',
            inline: false,
          },
          {
            name: 'App-Version:',
            value: appVersion,
            inline: true,
          },
          {
            name: 'App-Sprache:',
            value: appLanguageStr,
            inline: true,
          },
          {
            name: 'System-Sprache:',
            value: systemLanguageStr,
            inline: true,
          },
        ],
        footer: {
          text: payload.originalOfflineCreatedAt 
            ? `SOCDOF Offline Sync • Erfasst: ${formattedOriginalTime}`
            : 'Developers will review Your Report!',
        },
      }
    : {
        author: {
          name: cleanName,
        },
        title: '💡 NEUER VORSCHLAG / FEEDBACK 💡',
        description: 'Ein Nutzer hat eine Idee oder Feedback eingereicht!',
        color: 3901948, // Blue/Purple #3b82f6
        fields: [
          {
            name: 'Eingereicht von:',
            value: userMention,
            inline: false,
          },
          ...extraOfflineField,
          {
            name: 'Bereich / Kategorie:',
            value: payload.categoryOrLocation || 'Allgemein',
            inline: false,
          },
          {
            name: 'Idee & Vorschlag:',
            value: payload.description || 'Keine Angabe',
            inline: false,
          },
          {
            name: 'App-Version:',
            value: appVersion,
            inline: true,
          },
          {
            name: 'App-Sprache:',
            value: appLanguageStr,
            inline: true,
          },
          {
            name: 'System-Sprache:',
            value: systemLanguageStr,
            inline: true,
          },
        ],
        footer: {
          text: payload.originalOfflineCreatedAt 
            ? `SOCDOF Offline Sync • Erfasst: ${formattedOriginalTime}`
            : 'SOCDOF Community Feedback',
        },
      };

  const bodyData = {
    name: payload.title.trim().slice(0, 100),
    applied_tags: [tagId],
    message: {
      content: messageContent,
      embeds: [embed],
    },
  };

  const recordSuccess = (threadId: string) => {
    const threadUrl = `https://discord.com/channels/1517532430095876266/${threadId}`;
    saveSubmittedDiscordReport({
      id: `report_${Date.now()}_${threadId}`,
      type: payload.type,
      title: payload.title.trim(),
      categoryOrLocation: payload.categoryOrLocation,
      description: payload.description,
      discordName: cleanName,
      discordUserId: cleanId,
      threadId,
      threadUrl,
      channelId,
      channelName,
      tagId,
      tagName,
      status: 'pending',
      createdAt: (payload.originalOfflineCreatedAt || now.toISOString()),
      originalOfflineCreatedAt: payload.originalOfflineCreatedAt,
      lastSyncedAt: now.toISOString()
    });

    // Auto-activate the Bug-Reports app whenever a user submits a report
    try {
      localStorage.removeItem('socdof_feedback_uninstalled');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('socdof:report-submitted', { detail: { moduleId: 'feedback' } }));
      }
    } catch {}

    return {
      success: true,
      threadId,
      threadUrl
    };
  };

  // Helper to record offline queued report
  const recordQueued = (reason = 'offline') => {
    const queueId = `offline_queued_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const originalTime = payload.originalOfflineCreatedAt || now.toISOString();
    const queuedReport: SubmittedDiscordReport = {
      id: queueId,
      type: payload.type,
      title: payload.title.trim(),
      categoryOrLocation: payload.categoryOrLocation,
      description: payload.description,
      discordName: cleanName,
      discordUserId: cleanId,
      threadId: queueId,
      threadUrl: '',
      channelId,
      channelName,
      tagId,
      tagName,
      status: 'queued',
      statusLabel: 'In Warteschlange (Offline)',
      originalOfflineCreatedAt: originalTime,
      queuedAt: now.toISOString(),
      createdAt: originalTime
    };

    saveSubmittedDiscordReport(queuedReport);

    // Auto-activate the Bug-Reports app
    try {
      localStorage.removeItem('socdof_feedback_uninstalled');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('socdof:report-submitted', { detail: { moduleId: 'feedback' } }));
      }
    } catch {}

    return {
      success: true,
      queued: true,
      threadId: queueId,
      message: 'Bericht wurde lokal in der Offline-Warteschlange gespeichert und wird bei Online-Verbindung automatisch an Discord gesendet.'
    };
  };

  // If the browser/device is currently offline, queue immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return recordQueued('navigator_offline');
  }

  // 1. Try Electron Main Process Webhook Bridge if running in Desktop App
  const electronApi = (typeof window !== 'undefined' ? (window as any).electronAPI : null);
  if (electronApi?.discordWebhook && DISCORD_CONFIG.BOTGHOST_WEBHOOK) {
    try {
      const elecRes = await electronApi.discordWebhook({
        url: DISCORD_CONFIG.BOTGHOST_WEBHOOK,
        payload: {
          username: cleanName,
          content: messageContent,
          embeds: [embed],
          title: payload.title,
          category: payload.categoryOrLocation,
          type: payload.type
        }
      });
      if (elecRes && elecRes.ok) {
        const webhookThreadId = `electron_webhook_${Date.now()}`;
        return recordSuccess(webhookThreadId);
      }
    } catch (elecErr) {
      console.warn('Electron discordWebhook IPC failed:', elecErr);
    }
  }

  // 2. Try BotGhost Webhook first (direct HTTP POST from browser/client)
  if (DISCORD_CONFIG.BOTGHOST_WEBHOOK) {
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutTimer = controller ? setTimeout(() => controller.abort(), 12000) : null;

      const webhookResp = await fetch(DISCORD_CONFIG.BOTGHOST_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: cleanName,
          content: messageContent,
          embeds: [embed],
          title: payload.title,
          category: payload.categoryOrLocation,
          type: payload.type
        }),
        signal: controller ? controller.signal : undefined
      });

      if (timeoutTimer) clearTimeout(timeoutTimer);

      if (webhookResp.ok || webhookResp.status === 200 || webhookResp.status === 204) {
        const webhookThreadId = `webhook_${Date.now()}`;
        return recordSuccess(webhookThreadId);
      }
    } catch (webhookErr) {
      console.warn('BotGhost webhook request failed, trying proxy/fallback...', webhookErr);
    }
  }

  // 2. Try via backend proxy route first (to bypass browser CORS)
  try {
    const proxyResp = await fetch('/api/discord/thread', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelId,
        threadData: bodyData,
      }),
    });

    if (proxyResp.ok) {
      const result = await proxyResp.json();
      if (result.success && result.threadId) {
        return recordSuccess(result.threadId);
      }
    }
  } catch (proxyErr) {
    console.warn('Backend proxy /api/discord/thread failed, trying direct Discord API fallback...', proxyErr);
  }

  // 2. Direct Discord API Fallback (for Electron / native environments)
  if (DISCORD_CONFIG.BOT_TOKEN) {
    try {
      const directResp = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${DISCORD_CONFIG.BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });

      if (directResp.ok) {
        const data = await directResp.json();
        return recordSuccess(data.id);
      } else {
        const errText = await directResp.text();
        console.warn('Direct Discord API returned error, queuing report locally:', directResp.status, errText);
        return recordQueued('api_error');
      }
    } catch (directErr: any) {
      console.warn('Direct Discord API call failed, queuing report locally:', directErr);
      return recordQueued('network_error');
    }
  }

  // If neither route succeeded (e.g. offline bot or network timeout), store in offline queue
  return recordQueued('fallback_queued');
}

/**
 * Automatically processes and flushes all queued offline reports to Discord.
 */
let isFlushingQueue = false;

export async function processDiscordOfflineQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  if (isFlushingQueue) return { processed: 0, succeeded: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const reports = getSubmittedDiscordReports();
  const queued = reports.filter(r => r.status === 'queued' || r.threadId.startsWith('offline_queued_'));
  if (queued.length === 0) return { processed: 0, succeeded: 0, failed: 0 };

  isFlushingQueue = true;
  let succeeded = 0;
  let failed = 0;

  try {
    for (const report of queued) {
      try {
        const res = await sendDiscordReportDirect({
          type: report.type,
          title: report.title,
          categoryOrLocation: report.categoryOrLocation,
          description: report.description,
          discordName: report.discordName,
          discordUserId: report.discordUserId,
          originalOfflineCreatedAt: report.originalOfflineCreatedAt || report.createdAt,
        });

        if (res.success && res.threadId) {
          succeeded++;
          const threadUrl = res.threadUrl || `https://discord.com/channels/1517532430095876266/${res.threadId}`;
          
          // Replace queued entry with live Discord thread record
          const currentAll = getSubmittedDiscordReports();
          const updatedAll = currentAll.map(r => {
            if (r.id === report.id || r.threadId === report.threadId) {
              return {
                ...r,
                id: `report_${Date.now()}_${res.threadId}`,
                threadId: res.threadId!,
                threadUrl,
                status: 'pending' as DiscordReportStatus,
                statusLabel: undefined,
                lastSyncedAt: new Date().toISOString()
              };
            }
            return r;
          });

          localStorage.setItem(SUBMITTED_REPORTS_STORAGE_KEY, JSON.stringify(updatedAll));

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('socdof:discord-reports-changed', { detail: { reports: updatedAll } }));
            window.dispatchEvent(new CustomEvent('socdof:discord-queue-flushed', { 
              detail: { reportTitle: report.title, threadUrl, count: 1 } 
            }));
          }
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  } finally {
    isFlushingQueue = false;
  }

  return { processed: queued.length, succeeded, failed };
}

/**
 * Direct worker helper to perform real Discord post without re-queuing
 */
async function sendDiscordReportDirect(
  payload: DiscordReportPayload
): Promise<{ success: boolean; threadId?: string; threadUrl?: string; error?: string }> {
  const isBug = payload.type === 'bug';
  const channelId = isBug ? DISCORD_CONFIG.BUG_CHANNEL_ID : DISCORD_CONFIG.IDEA_CHANNEL_ID;
  const dynamicTag = await resolveSubmissionTag(channelId, payload.type);
  const tagId = dynamicTag.tagId;

  const now = new Date();
  const cleanName = payload.discordName?.trim().replace(/^@/, '') || 'Anonym';
  const isAnonymous = !payload.discordName?.trim() || cleanName.toLowerCase() === 'anonym';
  const cleanId = payload.discordUserId?.trim();
  const hasValidUserId = !!cleanId && /^\d{17,20}$/.test(cleanId);
  const userMention = hasValidUserId ? `<@${cleanId}> (@${cleanName})` : (isAnonymous ? '@Anonym' : `@${cleanName}`);
  const messageContent = hasValidUserId ? `<@${cleanId}>` : undefined;

  const appVersion = payload.appVersion || `SOCDOF v${APP_VERSION}`;
  const appLanguageStr = payload.appLanguage || getAppLanguageLabel();
  const systemLanguageStr = payload.systemLanguage || getSystemLanguageLabel();

  const originalCreatedDate = payload.originalOfflineCreatedAt 
    ? new Date(payload.originalOfflineCreatedAt) 
    : now;

  const formattedOriginalTime = originalCreatedDate.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const extraOfflineField = payload.originalOfflineCreatedAt ? [{
    name: '🕒 Ursprünglich offline erfasst am:',
    value: `${formattedOriginalTime} (Lokale Client-Zeit)`,
    inline: false
  }] : [];

  const embed = isBug
    ? {
        author: { name: cleanName },
        title: '❗ NEW REPORT ❗',
        description: 'New Bug Reported!',
        color: 15816994,
        fields: [
          { name: 'Reported By:', value: userMention, inline: false },
          ...extraOfflineField,
          { name: 'Bug Location:', value: payload.categoryOrLocation || 'Allgemein', inline: false },
          { name: 'Bug Information:', value: payload.description || 'Keine Angabe', inline: false },
          { name: 'App-Version:', value: appVersion, inline: true },
          { name: 'App-Sprache:', value: appLanguageStr, inline: true },
          { name: 'System-Sprache:', value: systemLanguageStr, inline: true },
        ],
        footer: { text: payload.originalOfflineCreatedAt ? `SOCDOF Offline Sync • Erfasst: ${formattedOriginalTime}` : 'Developers will review Your Report!' },
      }
    : {
        author: { name: cleanName },
        title: '💡 NEUER VORSCHLAG / FEEDBACK 💡',
        description: 'Ein Nutzer hat eine Idee oder Feedback eingereicht!',
        color: 3901948,
        fields: [
          { name: 'Eingereicht von:', value: userMention, inline: false },
          ...extraOfflineField,
          { name: 'Bereich / Kategorie:', value: payload.categoryOrLocation || 'Allgemein', inline: false },
          { name: 'Idee & Vorschlag:', value: payload.description || 'Keine Angabe', inline: false },
          { name: 'App-Version:', value: appVersion, inline: true },
          { name: 'App-Sprache:', value: appLanguageStr, inline: true },
          { name: 'System-Sprache:', value: systemLanguageStr, inline: true },
        ],
        footer: { text: payload.originalOfflineCreatedAt ? `SOCDOF Offline Sync • Erfasst: ${formattedOriginalTime}` : 'SOCDOF Community Feedback' },
      };

  const bodyData = {
    name: payload.title.trim().slice(0, 100),
    applied_tags: [tagId],
    message: { content: messageContent, embeds: [embed] },
  };

  try {
    const proxyResp = await fetch('/api/discord/thread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, threadData: bodyData }),
    });
    if (proxyResp.ok) {
      const result = await proxyResp.json();
      if (result.success && result.threadId) {
        return {
          success: true,
          threadId: result.threadId,
          threadUrl: `https://discord.com/channels/1517532430095876266/${result.threadId}`
        };
      }
    }
  } catch {}

  if (DISCORD_CONFIG.BOT_TOKEN) {
    try {
      const directResp = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${DISCORD_CONFIG.BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyData),
      });
      if (directResp.ok) {
        const data = await directResp.json();
        return {
          success: true,
          threadId: data.id,
          threadUrl: `https://discord.com/channels/1517532430095876266/${data.id}`
        };
      }
    } catch {}
  }

  return { success: false, error: 'Could not send report to Discord' };
}

// Global browser listener to auto-flush offline queue upon reconnecting
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processDiscordOfflineQueue().catch(() => {});
  });
}

export interface DiscordBotInfo {
  online: boolean;
  botName?: string;
  botId?: string;
  botAvatar?: string;
  avatarUrl?: string;
  error?: string;
}

let lastBotStatusCache: { 
  online: boolean; 
  checkedAt: number; 
  botName?: string; 
  botId?: string;
  botAvatar?: string;
  avatarUrl?: string;
} | null = null;

export async function checkDiscordBotStatus(force = false): Promise<DiscordBotInfo> {
  // Use 15s cache if not forced
  if (!force && lastBotStatusCache && Date.now() - lastBotStatusCache.checkedAt < 15000) {
    return {
      online: lastBotStatusCache.online,
      botName: lastBotStatusCache.botName,
      botId: lastBotStatusCache.botId,
      botAvatar: lastBotStatusCache.botAvatar,
      avatarUrl: lastBotStatusCache.avatarUrl,
    };
  }

  // 1. Try Desktop Electron IPC bridge if available
  const electronApi = (typeof window !== 'undefined' ? (window as any).electronAPI : null);
  if (electronApi?.discordRequest && DISCORD_CONFIG.BOT_TOKEN) {
    try {
      const result = await electronApi.discordRequest({
        endpoint: '/users/@me',
        method: 'GET',
        botToken: DISCORD_CONFIG.BOT_TOKEN,
      });
      if (result.success && result.data && result.data.id) {
        const d = result.data;
        const avatarUrl = d.avatar
          ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${(parseInt(d.id || '0', 10) || 0) % 5}.png`;
        lastBotStatusCache = {
          online: true,
          botName: d.username,
          botId: d.id,
          botAvatar: d.avatar,
          avatarUrl,
          checkedAt: Date.now(),
        };
        return { online: true, botName: d.username, botId: d.id, botAvatar: d.avatar, avatarUrl };
      }
    } catch {}
  }

  // 2. Try proxy endpoint /api/discord/bot-status
  try {
    const resp = await fetch('/api/discord/bot-status', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (resp.ok) {
      const data = await resp.json();
      const online = Boolean(data.online);
      const avatarUrl = data.avatarUrl || (data.botAvatar && data.botId
        ? `https://cdn.discordapp.com/avatars/${data.botId}/${data.botAvatar}.png?size=128`
        : undefined);
      lastBotStatusCache = {
        online,
        botName: data.botName,
        botId: data.botId,
        botAvatar: data.botAvatar,
        avatarUrl,
        checkedAt: Date.now(),
      };
      return {
        online,
        botName: data.botName,
        botId: data.botId,
        botAvatar: data.botAvatar,
        avatarUrl,
        error: data.error,
      };
    }
  } catch {}

  // 3. Direct fetch fallback (if client token is set)
  if (DISCORD_CONFIG.BOT_TOKEN) {
    try {
      const directResp = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bot ${DISCORD_CONFIG.BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
      });
      if (directResp.ok) {
        const d = await directResp.json();
        const avatarUrl = d.avatar
          ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=128`
          : `https://cdn.discordapp.com/embed/avatars/${(parseInt(d.id || '0', 10) || 0) % 5}.png`;
        lastBotStatusCache = {
          online: true,
          botName: d.username,
          botId: d.id,
          botAvatar: d.avatar,
          avatarUrl,
          checkedAt: Date.now(),
        };
        return { online: true, botName: d.username, botId: d.id, botAvatar: d.avatar, avatarUrl };
      }
    } catch {}
  }

  lastBotStatusCache = {
    online: false,
    checkedAt: Date.now(),
  };
  return { online: false, error: 'Bot is unreachable or offline' };
}
