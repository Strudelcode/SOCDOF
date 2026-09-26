import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  ExternalLink, 
  RefreshCw, 
  MessageSquare, 
  Clock, 
  Tag, 
  AlertCircle, 
  User, 
  CheckCircle2, 
  XCircle, 
  Flame, 
  Layers, 
  Send,
  Sparkles,
  Paperclip,
  Check,
  ChevronRight
} from 'lucide-react';
import { 
  SubmittedDiscordReport, 
  DiscordThreadMessage, 
  fetchDiscordThreadMessages,
  KNOWN_BUG_TAGS
} from '../lib/discordFeedback';
import { useLanguage, t } from '../lib/i18n';
import { sounds } from '../lib/sound';

interface DiscordThreadInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SubmittedDiscordReport | null;
  onRefreshReport?: () => void;
}

/**
 * Utility to parse Discord text with Markdown, User mentions, and Custom Emojis
 */
function renderDiscordContent(content: string) {
  if (!content) return null;

  // Regex to split on custom emojis <:name:id> or <a:name:id>, mentions <@id>, URLs, code blocks, bold, etc.
  const lines = content.split('\n');

  return (
    <div className="space-y-1.5 text-xs text-slate-800 dark:text-slate-200 break-words leading-relaxed font-sans">
      {lines.map((line, lineIdx) => {
        // Handle quote blocks
        const isQuote = line.startsWith('> ');
        const cleanLine = isQuote ? line.slice(2) : line;

        // Parse emojis & mentions inside the line
        const parts = parseDiscordInline(cleanLine);

        if (isQuote) {
          return (
            <div key={lineIdx} className="pl-3 border-l-2 border-indigo-400/80 dark:border-indigo-500/80 text-slate-600 dark:text-slate-400 italic my-1 py-0.5">
              {parts}
            </div>
          );
        }

        return (
          <div key={lineIdx} className="min-h-[1.2em]">
            {parts}
          </div>
        );
      })}
    </div>
  );
}

function parseDiscordInline(text: string): React.ReactNode[] {
  // Regex matches <:name:id>, <a:name:id>, <@id>, <#id>, **bold**, *italic*, `code`, URLs
  const regex = /(<a?:[a-zA-Z0-9_]+:\d+>|<@!?\d+>|<#\d+>|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|https?:\/\/[^\s]+)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.substring(lastIndex, match.index));
    }

    const token = match[0];

    // 1. Custom Emoji <:name:id> or animated <a:name:id>
    const customEmojiMatch = token.match(/^<(a)?:([a-zA-Z0-9_]+):(\d+)>$/);
    if (customEmojiMatch) {
      const isAnimated = !!customEmojiMatch[1];
      const emojiName = customEmojiMatch[2];
      const emojiId = customEmojiMatch[3];
      const ext = isAnimated ? 'gif' : 'webp';
      const cdnUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=48&quality=lossless`;

      nodes.push(
        <img
          key={`${match.index}-emoji`}
          src={cdnUrl}
          alt={`:${emojiName}:`}
          title={`:${emojiName}:`}
          className="inline-block w-4 h-4 align-text-bottom mx-0.5 object-contain"
          onError={(e) => {
            // fallback if custom emoji cdn is unavailable
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    // 2. User Mention <@id> or <@!id>
    else if (/^<@!?\d+>$/.test(token)) {
      const userId = token.replace(/\D/g, '');
      nodes.push(
        <span
          key={`${match.index}-mention`}
          className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-[#5865F2]/15 text-[#5865F2] dark:text-indigo-300 font-semibold text-[11px] hover:bg-[#5865F2]/25 cursor-default transition"
        >
          @{userId}
        </span>
      );
    }
    // 3. Channel Mention <#id>
    else if (/^<#\d+>$/.test(token)) {
      const channelId = token.replace(/\D/g, '');
      nodes.push(
        <span
          key={`${match.index}-channel`}
          className="inline-flex items-center px-1.5 py-0.2 rounded-md bg-[#5865F2]/15 text-[#5865F2] dark:text-indigo-300 font-semibold text-[11px]"
        >
          #{channelId}
        </span>
      );
    }
    // 4. Bold **text**
    else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={`${match.index}-bold`} className="font-bold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    }
    // 5. Italic *text*
    else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={`${match.index}-italic`} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    }
    // 6. Inline code `code`
    else if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-pink-600 dark:text-pink-400 font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    // 7. URL
    else if (token.startsWith('http')) {
      nodes.push(
        <a
          key={`${match.index}-link`}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00a8fc] dark:text-[#00a8fc] hover:underline break-all"
        >
          {token}
        </a>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

export const DiscordThreadInspectorModal: React.FC<DiscordThreadInspectorModalProps> = ({
  isOpen,
  onClose,
  report,
  onRefreshReport
}) => {
  const lang = useLanguage();
  const [messages, setMessages] = useState<DiscordThreadMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const loadThreadMessages = useCallback(async () => {
    if (!report?.threadId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDiscordThreadMessages(report.threadId);
      if (res.success) {
        setMessages(res.messages);
        setLastFetched(new Date());
      } else {
        setError(res.error || 'Fehler beim Laden der Discord-Nachrichten');
      }
    } catch (err: any) {
      setError(err?.message || 'Verbindungsfehler zu Discord');
    } finally {
      setLoading(false);
    }
  }, [report?.threadId]);

  useEffect(() => {
    if (isOpen && report?.threadId) {
      loadThreadMessages();
    } else {
      setMessages([]);
      setError(null);
    }
  }, [isOpen, report?.threadId, loadThreadMessages]);

  if (!isOpen || !report) return null;

  // Render Status Badge
  const renderStatusBadge = () => {
    switch (report.status) {
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1.5 shadow-2xs">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            <span>{t('feedback.status_rejected', lang, '❌ Abgelehnt')}</span>
          </span>
        );
      case 'resolved':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{t('feedback.status_resolved', lang, '✅ Behoben / Erledigt')}</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{t('feedback.status_in_progress', lang, '🔨 Problem-Fix in Bearbeitung')}</span>
          </span>
        );
      case 'forwarded':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 flex items-center gap-1.5 shadow-2xs">
            <ChevronRight className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{t('feedback.status_forwarded', lang, '↗️ Bestätigt & Weitergeleitet')}</span>
          </span>
        );
      case 'reviewing':
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800 flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>{t('feedback.status_reviewing', lang, '🔍 In Überprüfung')}</span>
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>{t('feedback.status_pending', lang, '⏳ Neue Einreichung')}</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-[#5865F2]/15 text-[#5865F2] dark:text-indigo-300 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>{report.channelName}</span>
              </span>
              
              {renderStatusBadge()}

              {(report.isArchived || report.isLocked) && (
                <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  🔒 {t('feedback.discord_archived', lang, 'Geschlossen')}
                </span>
              )}
            </div>

            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {report.title}
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
              <span>{t('feedback.step2_label', lang, 'Bereich')}: <strong className="text-slate-700 dark:text-slate-300">{report.categoryOrLocation}</strong></span>
              <span>•</span>
              <span>{new Date(report.createdAt).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US')}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                loadThreadMessages();
                if (onRefreshReport) onRefreshReport();
              }}
              disabled={loading}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              title={t('feedback.sync_now', lang, 'Neu laden')}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <a
              href={report.threadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <span>{t('feedback.open_in_discord', lang, 'Discord')}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <button
              type="button"
              onClick={() => {
                sounds.playClick();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Tags Bar */}
        {report.appliedTags && report.appliedTags.length > 0 && (
          <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-slate-950/60 border-b border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3 text-[#5865F2]" />
              <span>{t('feedback.discord_tags_label', lang, 'Live Discord Forum Tags:')}</span>
            </span>
            {report.appliedTags.map((tag, idx) => {
              const customEmojiUrl = tag.emojiId
                ? `https://cdn.discordapp.com/emojis/${tag.emojiId}.webp?size=32&quality=lossless`
                : null;

              return (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#5865F2]/10 dark:bg-[#5865F2]/20 border border-[#5865F2]/30 text-[#5865F2] dark:text-indigo-300 shadow-2xs"
                >
                  {customEmojiUrl ? (
                    <img src={customEmojiUrl} alt={tag.emojiName || ''} className="w-3.5 h-3.5 object-contain inline-block" />
                  ) : tag.emojiName ? (
                    <span>{tag.emojiName}</span>
                  ) : null}
                  <span>#{tag.name}</span>
                </span>
              );
            })}
          </div>
        )}

        {/* Messages Body */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-100/40 dark:bg-[#313338]">
          {loading && messages.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#5865F2] animate-spin mx-auto" />
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('feedback.loading_messages', lang, 'Lade Nachrichten aus dem Discord-Forum...')}
              </div>
            </div>
          ) : error && messages.length === 0 ? (
            <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <div className="text-xs font-bold text-rose-800 dark:text-rose-300">{error}</div>
              <p className="text-[11px] text-rose-600 dark:text-rose-400 max-w-md mx-auto">
                {t('feedback.messages_error_desc', lang, 'Die Nachrichten konnten nicht direkt abgerufen werden. Sie können den Beitrag jederzeit direkt im Discord-Forum öffnen.')}
              </p>
              <a
                href={report.threadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5865F2] text-white text-xs font-bold shadow-xs hover:bg-[#4752C4] transition"
              >
                <span>{t('feedback.view_ticket', lang, 'Auf Discord ansehen')}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
                {t('feedback.no_messages_yet', lang, 'Noch keine Nachrichten im Forum-Thread vorhanden.')}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const msgDate = new Date(msg.timestamp);
              const formattedTime = msgDate.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <div
                  key={msg.id}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#2b2d31] border border-slate-200/80 dark:border-[#1e1f22] shadow-xs"
                >
                  {/* Author Avatar */}
                  <img
                    src={msg.author.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png'}
                    alt={msg.author.username}
                    className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 object-cover mt-0.5 ring-1 ring-black/5"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://cdn.discordapp.com/embed/avatars/0.png';
                    }}
                  />

                  {/* Message Content & Embeds */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {msg.author.globalName || msg.author.username}
                      </span>

                      {msg.author.bot && (
                        <span className="px-1.5 py-0.2 rounded text-[9.5px] font-extrabold bg-[#5865F2] text-white tracking-wider">
                          BOT
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 dark:text-[#949ba4]">
                        {formattedTime}
                      </span>
                    </div>

                    {/* Text Content */}
                    {msg.content && renderDiscordContent(msg.content)}

                    {/* Discord Embeds */}
                    {msg.embeds && msg.embeds.length > 0 && (
                      <div className="space-y-2 pt-1">
                        {msg.embeds.map((emb, eIdx) => {
                          const borderColor = emb.color
                            ? `#${emb.color.toString(16).padStart(6, '0')}`
                            : '#5865F2';

                          return (
                            <div
                              key={eIdx}
                              className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1e1f22] border-l-4 text-xs space-y-2 shadow-2xs font-sans"
                              style={{ borderLeftColor: borderColor }}
                            >
                              {emb.author?.name && (
                                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                  {emb.author.icon_url && (
                                    <img src={emb.author.icon_url} alt="" className="w-4 h-4 rounded-full" />
                                  )}
                                  <span>{emb.author.name}</span>
                                </div>
                              )}

                              {emb.title && (
                                <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                                  {emb.title}
                                </h5>
                              )}

                              {emb.description && (
                                <p className="text-slate-700 dark:text-slate-300 text-xs">
                                  {renderDiscordContent(emb.description)}
                                </p>
                              )}

                              {emb.fields && emb.fields.length > 0 && (
                                <div className="grid grid-cols-1 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
                                  {emb.fields.map((fld, fIdx) => (
                                    <div key={fIdx} className="space-y-0.5">
                                      <div className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                                        {fld.name}
                                      </div>
                                      <div className="text-xs text-slate-800 dark:text-slate-200">
                                        {renderDiscordContent(fld.value)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {emb.footer?.text && (
                                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                                  {emb.footer.text}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {msg.attachments.map((att) => {
                          const isImage = att.content_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(att.filename);

                          if (isImage) {
                            return (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-90 transition max-w-xs"
                              >
                                <img
                                  src={att.url}
                                  alt={att.filename}
                                  className="max-h-48 object-cover rounded-xl"
                                />
                              </a>
                            );
                          }

                          return (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-xs font-semibold text-slate-800 dark:text-slate-200 transition"
                            >
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>{att.filename}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {lastFetched && (
              <span>{t('feedback.last_synced', { time: lastFetched.toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}</span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              sounds.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            {t('contact.btn_close', lang, 'Schließen')}
          </button>
        </div>

      </div>
    </div>
  );
};
