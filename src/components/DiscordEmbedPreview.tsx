import React from 'react';
import { Sparkles, Hash, Tag, Bot } from 'lucide-react';
import { useLanguage, t } from '../lib/i18n';

interface DiscordEmbedPreviewProps {
  type: 'bug' | 'idea';
  title: string;
  categoryOrLocation: string;
  description: string;
  discordName: string;
  discordUserId?: string;
  isCompact?: boolean;
}

export const DiscordEmbedPreview: React.FC<DiscordEmbedPreviewProps> = ({
  type,
  title,
  categoryOrLocation,
  description,
  discordName,
  discordUserId,
  isCompact = false,
}) => {
  const lang = useLanguage();
  const isBug = type === 'bug';

  const cleanName = discordName.trim().replace(/^@/, '') || 'Strudelgame';
  const cleanId = discordUserId?.trim();
  const hasValidUserId = !!cleanId && /^\d{17,20}$/.test(cleanId);

  const userMention = hasValidUserId
    ? `<@${cleanId}> (@${cleanName})`
    : `@${cleanName}`;

  const channelName = isBug ? '#🐛 | REPORT' : '#💡vorschläge';
  const tagName = isBug ? '⏳ Prüfung ausstehend' : '🌐 SOCDOF';
  const embedColor = isBug ? '#f15922' : '#3b82f6';
  const embedBorderClass = isBug ? 'border-l-[#f15922]' : 'border-l-[#3b82f6]';

  const displayTitle = title.trim() || (lang === 'de' ? 'Titel des Beitrags...' : lang === 'fr' ? 'Titre de la publication...' : lang === 'es' ? 'Título de la publicación...' : 'Post title summary...');
  const displayLocation = categoryOrLocation.trim() || (lang === 'de' ? 'Noch kein Ort gewählt' : lang === 'fr' ? 'Aucun emplacement sélectionné' : lang === 'es' ? 'Ninguna ubicación seleccionada' : 'No location selected');
  const displayDescription = description.trim() || (lang === 'de' ? 'Genaue Fehlerbeschreibung wird hier im Discord-Embed formatiert dargestellt...' : lang === 'fr' ? 'La description détaillée apparaîtra ici dans l\'embed Discord...' : lang === 'es' ? 'La descripción detallada aparecerá aquí en el embed de Discord...' : 'Detailed description will be formatted here inside the Discord embed...');

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
          {/* Bot Avatar */}
          <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center text-white shrink-0 shadow-md ring-2 ring-[#5865F2]/30">
            <Bot className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Bot Name & Timestamp & Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#f2f3f5] hover:underline cursor-pointer">
                SOCDOF Bot
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
              {/* Embed Author */}
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#5865F2] text-white flex items-center justify-center font-bold text-[10px]">
                  {cleanName[0]?.toUpperCase() || 'S'}
                </div>
                <span className="text-xs font-bold text-[#f2f3f5]">
                  {cleanName}
                </span>
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
              </div>

              {/* Embed Footer */}
              <div className="pt-2 border-t border-[#35373c] text-[10px] text-[#949ba4] font-medium flex items-center justify-between">
                <span>{isBug ? 'Developers will review Your Report!' : 'SOCDOF Community Feedback'}</span>
                <span className="text-[#80848e]">SOCDOF Feedback App</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
