import de from "../locales/de.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import fr from "../locales/fr.json";

export type Language = "de" | "en" | "fr" | "es";
export type TranslationKey = keyof typeof de;

const packs: Record<Language, Record<TranslationKey, string>> = { de, en, fr, es };

export function detectLanguage(): Language {
  const requested = (navigator.language || "en").slice(0, 2).toLowerCase();
  return requested in packs ? (requested as Language) : "en";
}

export function translate(language: Language, key: TranslationKey): string {
  return packs[language][key] ?? packs.en[key];
}

export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

export function applyTranslations(language: Language): void {
  document.documentElement.lang = language;
  document.title = `${translate(language, "screenTitle")} · SOCDOF`;

  for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
    const key = element.dataset.i18n as TranslationKey;
    element.textContent = translate(language, key);
  }
}
