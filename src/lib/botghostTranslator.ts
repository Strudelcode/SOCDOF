/**
 * Multi-Language BotGhost Webhook Translation & Payload Builder
 * 
 * Automatically translates and refines user reports into German (de) and English (en)
 * while preserving the original input. Uses single-batch translation requests to prevent
 * HTTP 429 rate limits, with multi-stage fallbacks to MyMemory and original text.
 */

export interface ReportTranslationFields {
  title: string;
  description: string;
  location: string;
  subarea: string;
}

export interface BuildBotghostPayloadOptions {
  title: string;
  description?: string;
  type: 'bug' | 'idea' | string;
  location?: string;
  subarea?: string;
  userMention: string;
  cleanName: string;
  imageUrl?: string;
  systemLanguageStr: string;
  appLanguageStr: string;
  appVersion: string;
  messageContent?: string;
}

export interface BotghostVariableItem {
  name: string;
  variable: string;
  value: string;
}

export interface BotghostPreparedPayload {
  payload: Record<string, any>;
  variables: BotghostVariableItem[];
}

const SEP = '\n~~~STRUDEL_SEP~~~\n';

/**
 * Translates multiple fields bundled in ONE single request to avoid HTTP 429 rate limits.
 */
export async function translateFieldsBatch(
  fields: ReportTranslationFields,
  targetLang: 'de' | 'en',
  sourceLangHint: string = 'auto'
): Promise<ReportTranslationFields> {
  const items = [
    fields.title || '-',
    fields.description || '-',
    fields.location || '-',
    fields.subarea || '-'
  ];
  const joined = items.join(SEP);

  // Helper with 4.5s timeout per fetch
  const fetchWithTimeout = async (url: string, options: RequestInit = {}): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  };

  // 1. Attempt: Google Translate (dict-chrome-ex & gtx) in a single batched call
  for (const clientName of ['dict-chrome-ex', 'gtx']) {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=${clientName}&sl=${encodeURIComponent(sourceLangHint)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(joined)}`;
      const res = await fetchWithTimeout(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const fullText = data[0].map((part: any) => (Array.isArray(part) ? part[0] : '')).join('');
          const parts = fullText.split(/\s*~~~STRUDEL_SEP~~~\s*/i);
          if (parts.length === items.length) {
            return {
              title: (parts[0] || fields.title).trim(),
              description: (parts[1] || fields.description).trim(),
              location: (parts[2] || fields.location).trim(),
              subarea: (parts[3] || fields.subarea).trim()
            };
          }
        }
      }
    } catch (_) {
      // Continue to next client or fallback
    }
  }

  // 2. Attempt: MyMemory API Fallback
  const fallbackSrc = sourceLangHint !== 'auto' ? sourceLangHint : (targetLang === 'en' ? 'de' : 'en');
  if (fallbackSrc !== targetLang) {
    try {
      const translateSingleMyMemory = async (text: string): Promise<string> => {
        if (!text || text === '-' || text.trim() === '') return text;
        const chunks = String(text).match(/[\s\S]{1,450}(?=\s|$)|[\s\S]{1,450}/g) || [String(text)];
        const out: string[] = [];
        for (const chunk of chunks) {
          const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk.trim())}&langpair=${fallbackSrc}|${targetLang}`;
          const mmRes = await fetchWithTimeout(mmUrl);
          if (mmRes.ok) {
            const mmData = await mmRes.json();
            const tText = mmData?.responseData?.translatedText;
            out.push(tText && !tText.includes('MYMEMORY WARNING') ? tText.trim() : chunk);
          } else {
            out.push(chunk);
          }
        }
        return out.join(' ').trim();
      };

      const [tTitle, tDesc] = await Promise.all([
        translateSingleMyMemory(fields.title),
        translateSingleMyMemory(fields.description)
      ]);

      return {
        title: tTitle || fields.title,
        description: tDesc || fields.description,
        location: fields.location,
        subarea: fields.subarea
      };
    } catch (_) {
      // Fall through to original
    }
  }

  // 3. Fallback: Return original fields so webhook dispatch never fails
  return { ...fields };
}

/**
 * Builds the complete multilingual BotGhost payload with:
 * - standard keys ({webhook.key} & {key})
 * - original keys ({webhook.original_key} & {original_key})
 * - german keys ({webhook.german_key} & {german_key})
 * - english keys ({webhook.english_key} & {english_key})
 * - top-level JSON fields for all keys
 * - complete BotGhost variables array
 */
export async function buildMultilingualBotghostPayload(
  options: BuildBotghostPayloadOptions
): Promise<BotghostPreparedPayload> {
  const origTitle = (options.title || '').trim();
  const origDesc = (options.description || '').trim();
  const origLocation = (options.location || 'Allgemein').trim();
  const origSubarea = (options.subarea || options.location || 'Allgemein').trim();
  const isBug = options.type === 'bug';

  // Determine source language hint based on website/browser language
  const isGermanSource = (options.appLanguageStr || options.systemLanguageStr || '').toLowerCase().startsWith('de');
  const sourceLangHint = isGermanSource ? 'de' : 'auto';

  // Perform bundled translation to German and English in parallel
  const inputFields: ReportTranslationFields = {
    title: origTitle,
    description: origDesc,
    location: origLocation,
    subarea: origSubarea
  };

  let deFields: ReportTranslationFields = inputFields;
  let enFields: ReportTranslationFields = inputFields;

  try {
    const [translatedDe, translatedEn] = await Promise.all([
      translateFieldsBatch(inputFields, 'de', sourceLangHint),
      translateFieldsBatch(inputFields, 'en', sourceLangHint)
    ]);
    deFields = translatedDe;
    enFields = translatedEn;
  } catch (err) {
    console.warn('[BotGhost Translator] Translation exception, falling back to original fields:', err);
  }

  // Reported By Anonymity handling:
  // If anonymous, german = "(@Anonym)", english = "(@Anonymous)".
  // Real mentions like <@123...> or @username remain unaltered.
  const isAnonymous = 
    options.cleanName.toLowerCase() === 'anonym' || 
    options.cleanName.toLowerCase() === 'anonymous' ||
    options.userMention === '(@Anonym)' ||
    options.userMention === '(@Anonymous)' ||
    options.userMention.toLowerCase() === 'anonym';

  const deReportedBy = isAnonymous ? '(@Anonym)' : options.userMention;
  const enReportedBy = isAnonymous ? '(@Anonymous)' : options.userMention;

  // Report Type Labels
  const origTypeLabel = isBug ? 'Bug-Report' : 'Idee / Vorschlag';
  const deTypeLabel = isBug ? 'Bug-Report / Fehlermeldung' : 'Idee / Vorschlag';
  const enTypeLabel = isBug ? 'Bug Report / Issue' : 'Idea / Suggestion';

  // Image URL & Fallbacks
  const hasImage = Boolean(options.imageUrl && options.imageUrl.trim() !== '');
  const origImage = hasImage ? options.imageUrl!.trim() : '-';
  const deImage = hasImage ? options.imageUrl!.trim() : 'Kein Bild angegeben';
  const enImage = hasImage ? options.imageUrl!.trim() : 'No image provided';

  // Language Metadata
  const origIsGermanStr = isGermanSource ? 'true' : 'false';
  const origLangStr = isGermanSource ? 'de' : 'en';

  const botghostVariables: BotghostVariableItem[] = [];
  const botghostPayload: Record<string, any> = {};

  /**
   * Registers a field simultaneously as:
   * - {webhook.key} & {key}
   * - {webhook.original_key} & {original_key}
   * - {webhook.german_key} & {german_key}
   * - {webhook.english_key} & {english_key}
   * and populates top-level JSON fields.
   */
  function addMultilingualVar(label: string, baseKey: string, origVal: string, deVal: string, enVal: string) {
    const o = origVal !== undefined && origVal !== null && String(origVal).trim() !== '' ? String(origVal) : '-';
    const d = deVal !== undefined && deVal !== null && String(deVal).trim() !== '' ? String(deVal) : o;
    const e = enVal !== undefined && enVal !== null && String(enVal).trim() !== '' ? String(enVal) : o;

    // Top-Level JSON Keys
    botghostPayload[baseKey] = o;
    botghostPayload[`original_${baseKey}`] = o;
    botghostPayload[`german_${baseKey}`] = d;
    botghostPayload[`english_${baseKey}`] = e;

    // BotGhost variables Array
    botghostVariables.push(
      { name: label, variable: `{webhook.${baseKey}}`, value: o },
      { name: `${label} (short)`, variable: `{${baseKey}}`, value: o },
      { name: `Original ${label}`, variable: `{webhook.original_${baseKey}}`, value: o },
      { name: `Original ${label} (short)`, variable: `{original_${baseKey}}`, value: o },
      { name: `German ${label}`, variable: `{webhook.german_${baseKey}}`, value: d },
      { name: `German ${label} (short)`, variable: `{german_${baseKey}}`, value: d },
      { name: `English ${label}`, variable: `{webhook.english_${baseKey}}`, value: e },
      { name: `English ${label} (short)`, variable: `{english_${baseKey}}`, value: e }
    );
  }

  // 1. Core Content Fields
  addMultilingualVar('Title', 'title', origTitle, deFields.title, enFields.title);
  addMultilingualVar('Description', 'description', origDesc, deFields.description, enFields.description);
  addMultilingualVar('Bug Information', 'bug_information', origDesc, deFields.description, enFields.description);
  addMultilingualVar('Bug Location', 'bug_location', origLocation, deFields.location, enFields.location);
  addMultilingualVar('Location', 'location', origLocation, deFields.location, enFields.location);
  addMultilingualVar('Subarea', 'subarea', origSubarea, deFields.subarea, enFields.subarea);

  // 2. Identity & Reporter Fields
  addMultilingualVar('Reported By', 'reported_by', options.userMention, deReportedBy, enReportedBy);
  addMultilingualVar('User Mention', 'user_mention', options.userMention, deReportedBy, enReportedBy);
  addMultilingualVar('Username', 'username', options.cleanName, isAnonymous ? 'Anonym' : options.cleanName, isAnonymous ? 'Anonymous' : options.cleanName);

  // 3. Category & Classification Fields
  addMultilingualVar('Project', 'project', 'SOCDOF', 'SOCDOF', 'SOCDOF');
  addMultilingualVar('Category', 'category', options.type, isBug ? 'Fehler' : 'Idee', isBug ? 'Bug' : 'Idea');
  addMultilingualVar('Report Category', 'report_category', isBug ? 'bug' : 'idea', isBug ? 'bug' : 'idea', isBug ? 'bug' : 'idea');
  addMultilingualVar('Report Type', 'report_type', isBug ? 'bug' : 'idea', isBug ? 'bug' : 'idea', isBug ? 'bug' : 'idea');
  addMultilingualVar('Report Type Label', 'report_type_label', origTypeLabel, deTypeLabel, enTypeLabel);

  // 4. Media & Attachment
  addMultilingualVar('Image URL', 'image_url', origImage, deImage, enImage);

  // 5. System & Language Metadata
  addMultilingualVar('Browser Language', 'browser_language', options.systemLanguageStr, options.systemLanguageStr, options.systemLanguageStr);
  addMultilingualVar('Website Language', 'website_language', options.appLanguageStr, options.appLanguageStr, options.appLanguageStr);
  addMultilingualVar('App Version', 'app_version', options.appVersion, options.appVersion, options.appVersion);

  // German-language aliases for backward compatibility
  botghostVariables.push(
    { name: 'Browsersprache', variable: '{webhook.browsersprache}', value: options.systemLanguageStr },
    { name: 'Webseitensprache', variable: '{webhook.webseitensprache}', value: options.appLanguageStr }
  );

  // Language flag indicators
  botghostPayload.original_is_german = origIsGermanStr;
  botghostPayload.original_lang = origLangStr;
  botghostVariables.push(
    { name: 'Original Is German', variable: '{webhook.original_is_german}', value: origIsGermanStr },
    { name: 'Original Lang', variable: '{webhook.original_lang}', value: origLangStr }
  );

  // Backward compatibility content field
  const contentValue = options.messageContent || `Neuer ${origTypeLabel} von ${options.cleanName}`;
  botghostPayload.content = contentValue;
  botghostVariables.push(
    { name: 'Content', variable: '{webhook.content}', value: contentValue }
  );

  // Attach full variables array to payload
  botghostPayload.variables = botghostVariables;

  return {
    payload: botghostPayload,
    variables: botghostVariables
  };
}
