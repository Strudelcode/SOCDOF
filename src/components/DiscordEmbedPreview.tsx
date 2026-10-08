import React from 'react';
import { Sparkles, Hash, Tag, Bot, Globe, Laptop, Terminal, Bell } from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';
import { APP_VERSION } from '../lib/version';

interface DiscordEmbedPreviewProps {
  type: 'bug' | 'idea' | 'feedback';
  title: string;
  categoryOrLocation: string;
  description: string;
  discordName?: string;
  discordUserId?: string;
  isCompact?: boolean;
  botName?: string;
  botAvatarUrl?: string;
  appVersion?: string;
  appLanguage?: string;
  systemLanguage?: string;
}

export const DiscordEmbedPreview: React.FC<DiscordEmbedPreviewProps> = ({
  type,
  title,
  categoryOrLocation,
  description,
  discordName = '',
  discordUserId = '',
  isCompact = false,
  botName,
  botAvatarUrl,
  appVersion,
  appLanguage,
  systemLanguage,
}) => {
  const lang = useLanguage();
  const isBug = type === 'bug';
  const isFeedback = type === 'feedback';

  const cleanName = discordName.trim().replace(/^@/, '') || 'Anonym';
  const isAnonymous = !discordName.trim() || cleanName.toLowerCase() === 'anonym';
  const cleanId = discordUserId.trim();
  const hasValidUserId = !!cleanId && /^\d{17,20}$/.test(cleanId);

  const userMention = hasValidUserId
    ? `@${cleanName} (@${cleanName})`
    : (isAnonymous ? '@Anonym' : `@${cleanName}`);

  const channelName = isBug ? '#🐛 | REPORT' : '#💡ɪᴅᴇᴀ-ꜱᴜɢɢᴇꜱᴛɪᴏɴꜱ';
  const tagName = isBug ? '⏳ Neue Einreichung' : isFeedback ? '💬 Feedback' : '🌐 SOCDOF';
  const embedColor = isBug ? '#ed4245' : isFeedback ? '#38bdf8' : '#5865F2';

  const displayTitle = title.trim() || (lang === 'de' ? 'Titel des Beitrags...' : lang === 'fr' ? 'Titre de la publication...' : lang === 'es' ? 'Título de la publicación...' : 'Post title summary...');
  const displayLocation = categoryOrLocation.trim() || (lang === 'de' ? 'Noch kein Ort gewählt' : lang === 'fr' ? 'Aucun emplacement sélectionné' : lang === 'es' ? 'Ninguna ubicación seleccionada' : 'No location selected');
  const displayDescription = description.trim() || (lang === 'de' ? 'Genaue Fehlerbeschreibung wird hier im Discord-Embed formatiert dargestellt...' : lang === 'fr' ? 'La description détaillée apparaîtra ici dans l\'embed Discord...' : lang === 'es' ? 'La descripción detallada aparecerá aquí en el embed de Discord...' : 'Detailed description will be formatted here inside the Discord embed...');

  const effectiveAppVersion = appVersion || `SOCDOF v${APP_VERSION}`;
  const effectiveAppLanguage = appLanguage || (lang === 'de' ? 'Deutsch (DE)' : lang === 'fr' ? 'Français (FR)' : lang === 'es' ? 'Español (ES)' : 'English (EN)');
  const browserLangCode = typeof navigator !== 'undefined' ? (navigator.language?.slice(0, 2) || 'de') : 'de';

  const effectiveBotName = botName || 'StrudelTeam - Bot';
  const nowTime = new Date().toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-3xl sm:rounded-[28px] bg-[#1e1f22] text-[#dbdee1] font-sans border border-[#2b2d31] shadow-2xl overflow-hidden animate-fade-in select-text">
      {/* Discord Header Bar */}
      <div className="px-4 py-2.5 bg-[#2b2d31] border-b border-[#1e1f22] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 text-[#949ba4] text-xs font-semibold">
            <Hash className="w-3.5 h-3.5 text-[#80848e]" />
            <span className="text-[#f2f3f5] font-bold truncate">{channelName.replace('#', '')}</span>
          </div>
          <span className="text-[#4e5058] text-xs">•</span>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#383a40] text-[#dbdee1] border border-[#4e5058]/50">
            <Tag className="w-3 h-3 text-[#ed4245]" />
            <span>{tagName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            {t('feedback.live_preview', lang, 'Live Discord Vorschau')}
          </span>
        </div>
      </div>

      {/* Discord Forum Thread Canvas */}
      <div className="p-4 sm:p-5 bg-[#313338] space-y-3.5">
        {/* Thread Name Header */}
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
              isBug 
                ? 'bg-[#ed4245]/20 text-[#ed4245] border border-[#ed4245]/40' 
                : 'bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40'
            }`}>
              {tagName}
            </span>
            <h3 className={`text-base sm:text-lg font-bold tracking-tight ${title.trim() ? 'text-[#f2f3f5]' : 'text-[#80848e] italic'}`}>
              {displayTitle}
            </h3>
          </div>
        </div>

        {/* Bot Message in Thread */}
        <div className="flex items-start gap-3">
          {/* Real Dynamic Bot Avatar */}
          {botAvatarUrl ? (
            <img 
              src={botAvatarUrl} 
              alt={effectiveBotName}
              className="w-10 h-10 rounded-full object-cover shadow-md ring-2 ring-[#5865F2]/30 shrink-0" 
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white shrink-0 shadow-md ring-2 ring-[#5865F2]/30">
              <Bot className="w-6 h-6" />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-1.5">
            {/* Real Dynamic Bot Name & Timestamp & Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#f2f3f5]">
                {effectiveBotName}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-[#5865F2] text-white tracking-wider">
                APP
              </span>
              <span className="text-xs text-[#949ba4]">
                {nowTime}
              </span>
            </div>

            {/* Notification Ping Line */}
            <div className="flex items-center gap-1.5 text-xs text-[#dbdee1] pb-1">
              <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="px-1.5 py-0.5 rounded bg-[#5865F2]/25 text-[#c9cdfb] font-semibold text-xs inline-block">
                {userMention}
              </span>
              {hasValidUserId && cleanName && (
                <span className="text-[#949ba4] text-xs">(@{cleanName})</span>
              )}
            </div>

            {/* Authentic Discord Embed Card - Matches Real Discord Embed */}
            <div 
              className="rounded-r-lg rounded-l-xs bg-[#2b2d31] p-3.5 sm:p-4 border-l-4 shadow-md space-y-3 max-w-2xl"
              style={{ borderLeftColor: embedColor }}
            >
              {/* Embed Title */}
              <div>
                <h4 className="text-sm sm:text-base font-extrabold text-[#f2f3f5] tracking-wide flex items-center gap-1.5">
                  <span className="text-[#ed4245]">❗</span>
                  <span>{isBug ? 'NEW REPORT' : 'NEW FEEDBACK'}</span>
                  <span className="text-[#ed4245]">❗</span>
                </h4>
                <p className="text-xs text-[#dbdee1] mt-0.5 font-normal">
                  {isBug ? 'New Bug Reported!' : 'New Idea or Feedback Submitted!'}
                </p>
              </div>

              {/* Embed Body Fields */}
              <div className="space-y-3 text-xs">
                {/* Field: Reported By */}
                <div>
                  <div className="font-bold text-[#f2f3f5] mb-0.5">
                    {isBug ? 'Reported By:' : 'Eingereicht von:'}
                  </div>
                  <div className="inline-block px-1.5 py-0.5 rounded bg-[#5865F2]/25 text-[#c9cdfb] font-semibold">
                    {userMention}
                  </div>
                </div>

                {/* Field: Bug Location */}
                <div>
                  <div className="font-bold text-[#f2f3f5] mb-0.5">
                    {isBug ? 'Bug Location:' : 'Bereich / Ort:'}
                  </div>
                  <div className={`text-[#dbdee1] ${categoryOrLocation.trim() ? '' : 'text-[#80848e] italic'}`}>
                    {displayLocation}
                  </div>
                </div>

                {/* Field: Bug Information */}
                <div>
                  <div className="font-bold text-[#f2f3f5] mb-0.5">
                    {isBug ? 'Bug Information:' : 'Beschreibung:'}
                  </div>
                  <div className={`text-[#dbdee1] whitespace-pre-wrap ${description.trim() ? '' : 'text-[#80848e] italic'}`}>
                    {displayDescription}
                  </div>
                </div>

                {/* Field: Browsersprache */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-base leading-none">🌐</span>
                  <div>
                    <span className="font-bold text-[#f2f3f5]">Browsersprache:</span>
                    <span className="text-[#dbdee1] ml-1.5">{browserLangCode}</span>
                  </div>
                </div>

                {/* Field: Webseitensprache */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-base leading-none">🌐</span>
                  <div>
                    <span className="font-bold text-[#f2f3f5]">Webseitensprache:</span>
                    <span className="text-[#dbdee1] ml-1.5">{effectiveAppLanguage}</span>
                  </div>
                </div>
              </div>

              {/* Embed Footer in Italics */}
              <div className="pt-2 border-t border-[#35373c] text-[11px] text-[#949ba4] italic">
                Developers will review Your Report! • SOCDOF • {effectiveAppVersion}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
