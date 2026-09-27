import React from 'react';
import { Sparkles, Hash, Tag, Bot, User, Globe, Laptop, Terminal } from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';
import { APP_VERSION } from '../lib/version';

interface DiscordEmbedPreviewProps {
  type: 'bug' | 'idea';
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

  const cleanName = discordName.trim().replace(/^@/, '') || 'Anonym';
  const isAnonymous = !discordName.trim() || cleanName.toLowerCase() === 'anonym';
  const cleanId = discordUserId.trim();
  const hasValidUserId = !!cleanId && /^\d{17,20}$/.test(cleanId);

  const userMention = hasValidUserId
    ? `<@${cleanId}> (@${cleanName})`
    : (isAnonymous ? '@Anonym' : `@${cleanName}`);

  const channelName = isBug ? '#🐛 | REPORT' : '#💡vorschläge';
  const tagName = isBug ? '⏳ Neue Einreichung' : '🌐 SOCDOF';
  const embedColor = isBug ? '#f15922' : '#3b82f6';
  const embedBorderClass = isBug ? 'border-l-[#f15922]' : 'border-l-[#3b82f6]';

  const displayTitle = title.trim() || (lang === 'de' ? 'Titel des Beitrags...' : lang === 'fr' ? 'Titre de la publication...' : lang === 'es' ? 'Título de la publicación...' : 'Post title summary...');
  const displayLocation = categoryOrLocation.trim() || (lang === 'de' ? 'Noch kein Ort gewählt' : lang === 'fr' ? 'Aucun emplacement sélectionné' : lang === 'es' ? 'Ninguna ubicación seleccionada' : 'No location selected');
  const displayDescription = description.trim() || (lang === 'de' ? 'Genaue Fehlerbeschreibung wird hier im Discord-Embed formatiert dargestellt...' : lang === 'fr' ? 'La description détaillée apparaîtra ici dans l\'embed Discord...' : lang === 'es' ? 'La descripción detallada aparecerá aquí en el embed de Discord...' : 'Detailed description will be formatted here inside the Discord embed...');

  const effectiveAppVersion = appVersion || `SOCDOF v${APP_VERSION}`;
  const effectiveAppLanguage = appLanguage || (lang === 'de' ? 'Deutsch (DE)' : lang === 'fr' ? 'Français (FR)' : lang === 'es' ? 'Español (ES)' : 'English (EN)');
  const effectiveSystemLanguage = systemLanguage || (typeof navigator !== 'undefined' ? (navigator.language || (navigator.languages && navigator.languages[0]) || 'de-DE') : 'de-DE');

  const effectiveBotName = botName || 'StrudelTeam - Bot';
  const nowTime = new Date().toLocaleTimeString(lang === 'de' ? 'de-DE' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="rounded-2xl bg-[#1e1f22] text-[#dbdee1] font-sans border border-[#2b2d31] shadow-xl overflow-hidden animate-fade-in select-text">
      {/* Discord Header Bar */}
      <div className="px-4 py-2.5 bg-[#2b2d31] border-b border-[#1e1f22] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1 text-[#949ba4] text-xs font-semibold">
            <Hash className="w-3.5 h-3.5 text-[#80848e]" />
            <span className="text-[#f2f3f5] font-bold truncate">{channelName.replace('#', '')}</span>
          </div>
          <span className="text-[#4e5058] text-xs">•</span>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#383a40] text-[#dbdee1] border border-[#4e5058]/50">
            <Tag className="w-3 h-3 text-[#f15922]" />
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
      <div className="p-4 sm:p-5 bg-[#313338] space-y-4">
        {/* Forum Post Title (Thread Name) */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
              isBug 
                ? 'bg-[#f15922]/20 text-[#f15922] border border-[#f15922]/40' 
                : 'bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40'
            }`}>
              {tagName}
            </span>
            <h3 className={`text-base sm:text-lg font-black tracking-tight ${title.trim() ? 'text-[#f2f3f5]' : 'text-[#80848e] italic'}`}>
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

          <div className="flex-1 min-w-0 space-y-2">
            {/* Real Dynamic Bot Name & Timestamp & Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#f2f3f5] hover:underline cursor-pointer">
                {effectiveBotName}
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase bg-[#5865F2] text-white tracking-wider">
                APP
              </span>
              <span className="text-xs text-[#949ba4]">
                {t('feedback.preview_today', lang, 'Heute um')} {nowTime}
              </span>
            </div>

            {/* Notification Mention (if valid ID) */}
            {hasValidUserId && (
              <div className="inline-block px-1.5 py-0.5 rounded bg-[#5865F2]/20 text-[#c9cdfb] text-xs font-semibold hover:bg-[#5865F2]/30 transition cursor-pointer">
                &lt;@{cleanId}&gt;
              </div>
            )}

            {/* Authentic Discord Embed Card */}
            <div 
              className={`rounded-r-lg rounded-l-xs bg-[#2b2d31] p-3.5 sm:p-4 border-l-4 ${embedBorderClass} shadow-md space-y-3 max-w-2xl`}
              style={{ borderLeftColor: embedColor }}
            >
              {/* Embed Author Header */}
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full ${isAnonymous ? 'bg-slate-600 text-slate-200' : 'bg-[#5865F2] text-white'} flex items-center justify-center font-bold text-[10px]`}>
                  {isAnonymous ? 'A' : (cleanName[0]?.toUpperCase() || 'U')}
                </div>
                <span className="text-xs font-bold text-[#f2f3f5]">
                  {cleanName}
                </span>
                {isAnonymous && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-700/80 text-slate-300 font-medium">
                    {t('feedback.anonymous', lang, 'Anonym')}
                  </span>
                )}
              </div>

              {/* Embed Title & Header Description */}
              <div>
                <h4 className="text-sm sm:text-base font-extrabold text-[#f2f3f5] tracking-wide">
                  {isBug ? '❗ NEW REPORT ❗' : '💡 NEUER VORSCHLAG / FEEDBACK 💡'}
                </h4>
                <p className="text-xs text-[#dbdee1] mt-0.5 font-medium">
                  {isBug ? 'New Bug Reported!' : 'Ein Nutzer hat eine Idee oder Feedback eingereicht!'}
                </p>
              </div>

              {/* Embed Fields */}
              <div className="space-y-2.5 pt-1">
                {/* Field 1: Reported By */}
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                    {isBug ? 'Reported By:' : 'Eingereicht von:'}
                  </div>
                  <div className="text-xs font-semibold text-[#f2f3f5] flex items-center gap-1">
                    {hasValidUserId ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#5865F2]/15 text-[#c9cdfb] font-mono text-[11px]">
                        {userMention}
                      </span>
                    ) : (
                      <span>{userMention}</span>
                    )}
                  </div>
                </div>

                {/* Field 2: Bug Location */}
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                    {isBug ? 'Bug Location:' : 'Bereich / Kategorie:'}
                  </div>
                  <div className={`text-xs font-semibold ${categoryOrLocation.trim() ? 'text-[#f2f3f5]' : 'text-[#80848e] italic'}`}>
                    {displayLocation}
                  </div>
                </div>

                {/* Field 3: Bug Information */}
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-[#b5bac1] uppercase tracking-wider">
                    {isBug ? 'Bug Information:' : 'Idee & Vorschlag:'}
                  </div>
                  <div className={`text-xs p-2.5 rounded-lg bg-[#1e1f22]/70 border border-[#383a40] font-mono whitespace-pre-wrap ${
                    description.trim() ? 'text-[#dbdee1]' : 'text-[#80848e] italic'
                  }`}>
                    {displayDescription}
                  </div>
                </div>

                {/* Inline Metadata Grid: Version, App Language, System Language */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-[#383a40]/60">
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider flex items-center gap-1">
                      <Terminal className="w-3 h-3 text-sky-400" />
                      <span>App-Version:</span>
                    </div>
                    <div className="text-xs font-mono font-semibold text-sky-300">
                      {effectiveAppVersion}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider flex items-center gap-1">
                      <Globe className="w-3 h-3 text-emerald-400" />
                      <span>App-Sprache:</span>
                    </div>
                    <div className="text-xs font-semibold text-emerald-300">
                      {effectiveAppLanguage}
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-[#b5bac1] uppercase tracking-wider flex items-center gap-1">
                      <Laptop className="w-3 h-3 text-amber-400" />
                      <span>System-Sprache:</span>
                    </div>
                    <div className="text-xs font-mono font-semibold text-amber-300">
                      {effectiveSystemLanguage}
                    </div>
                  </div>
                </div>
              </div>

              {/* Embed Footer */}
              <div className="pt-2 border-t border-[#35373c] text-[10px] text-[#949ba4] font-medium flex items-center justify-between">
                <span>{isBug ? 'Developers will review Your Report!' : 'SOCDOF Community Feedback'}</span>
                <span className="text-[#80848e]">{effectiveAppVersion}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
