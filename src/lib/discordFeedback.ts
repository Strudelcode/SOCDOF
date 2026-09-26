/**
 * Discord Feedback & Bug Report Service
 * Sends live forum posts with embeds, user pings, and tags to Discord channels.
 * Provides real-time synchronization with Discord forum tags and thread message history.
 */

export interface DiscordReportPayload {
  type: 'bug' | 'idea';
  title: string;
  categoryOrLocation: string;
  description: string;
  discordName: string;
  discordUserId?: string;
}

export const DISCORD_CONFIG = {
  BOT_TOKEN: 'MTQ5ODc2NDAzMzUxODczNTQ0MQ.Gy2MgH.ByHf3S1es7Zg48_ppLuM_ggNrVqXGMc7VJtczE',
  BUG_CHANNEL_ID: '1535709136363462757', // #🐛 | REPORT forum channel
  BUG_TAG_ID: '1535711015902384269',     // ⏳ Neue Einreichung (Prüfung ausstehend)
  IDEA_CHANNEL_ID: '1524133720876126408', // #💡vorschläge forum channel
  IDEA_TAG_ID: '1553317496159731722',     // SOCDOF tag
  BOTGHOST_WEBHOOK: 'https://api.botghost.com/webhook/1498764033518735441/t5dcd2k8x1n8i53932gf',
};

export type DiscordReportStatus = 
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
}

export function getStoredDiscordIdentity(): StoredDiscordIdentity {
  try {
    const raw = localStorage.getItem(DISCORD_IDENTITY_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return { discordName: 'Strudelgame', discordUserId: '' };
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
  messageCount?: number;
  lastSyncedAt?: string;
  createdAt: string;
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

  const threadIds = reports.map(r => r.threadId).filter(Boolean);
  if (threadIds.length === 0) {
    return { updatedReports: reports, changedCount: 0 };
  }

  let changedCount = 0;
  let syncedThreadMap: Record<string, any> = {};

  // 1. Try Backend Proxy Sync first
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
        }
      } catch {}
    }
  }

  // Merge synchronized data with stored reports
  const updatedReports = reports.map(rep => {
    const syncInfo = syncedThreadMap[rep.threadId];
    if (!syncInfo || syncInfo.notFound) {
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

export async function sendDiscordReport(payload: DiscordReportPayload): Promise<{ success: boolean; threadId?: string; threadUrl?: string; error?: string }> {
  const isBug = payload.type === 'bug';
  const channelId = isBug ? DISCORD_CONFIG.BUG_CHANNEL_ID : DISCORD_CONFIG.IDEA_CHANNEL_ID;
  const tagId = isBug ? DISCORD_CONFIG.BUG_TAG_ID : DISCORD_CONFIG.IDEA_TAG_ID;
  const channelName = isBug ? '#🐛 | REPORT' : '#💡vorschläge';
  const tagName = isBug ? '⏳ Neue Einreichung' : '🌐 SOCDOF';

  const now = new Date();

  const cleanName = payload.discordName.trim().replace(/^@/, '') || 'Anonym';
  const cleanId = payload.discordUserId?.trim();

  // Discord snowflake user IDs must be exactly 17 to 20 digits
  const hasValidUserId = !!cleanId && /^\d{17,20}$/.test(cleanId);

  // If user provided a numeric snowflake ID, mention them with <@ID>
  const userMention = hasValidUserId
    ? `<@${cleanId}> (@${cleanName})`
    : `@${cleanName}`;

  // Content for notification ping (pings user only if valid 17-20 digit ID is present)
  const messageContent = hasValidUserId ? `<@${cleanId}>` : undefined;

  // Discord automatically attaches message creation time to message header.
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
        ],
        footer: {
          text: 'Developers will review Your Report!',
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
        ],
        footer: {
          text: 'SOCDOF Community Feedback',
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
      createdAt: now.toISOString()
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

  // 1. Try via backend proxy route first (to bypass browser CORS)
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
      console.error('Direct Discord API returned error:', directResp.status, errText);
      return {
        success: false,
        error: `Discord HTTP ${directResp.status}: ${errText}`,
      };
    }
  } catch (directErr: any) {
    console.error('Direct Discord API call failed:', directErr);
    return {
      success: false,
      error: directErr?.message || String(directErr),
    };
  }
}
