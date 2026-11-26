import { invoke } from "@tauri-apps/api/core";

import { applyTranslations, format, setExternalPack, translate, type Language } from "./i18n";

interface ExternalTemplate {
  filename: string;
  path: string;
  format: string;
  size: number;
  updatedAt: string;
}

interface ExternalLanguage {
  code: string;
  name: string;
  filename: string;
  path: string;
  translations: Record<string, string>;
  flagImage: string | null;
}

interface ExternalFlag {
  name: string;
  image: string;
}

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`missing element ${id}`);
  }
  return element as T;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const message = byId<HTMLParagraphElement>("external-assets-message");
const templateList = byId<HTMLDivElement>("external-templates-list");
const languageList = byId<HTMLDivElement>("external-languages-list");
const flagList = byId<HTMLDivElement>("external-flags-list");
const refresh = byId<HTMLButtonElement>("external-assets-refresh");
const templatesOpen = byId<HTMLButtonElement>("external-templates-open");
const languagesOpen = byId<HTMLButtonElement>("external-languages-open");
const flagsOpen = byId<HTMLButtonElement>("external-flags-open");

let currentLanguage: Language = "en";

function empty(container: HTMLDivElement): void {
  container.appendChild(element("p", "empty", translate(currentLanguage, "externalAssetsEmpty")));
}

async function openFolder(kind: "templates" | "languages" | "flags"): Promise<void> {
  try {
    const reply = await invoke<{ success: boolean; path: string }>("open_external_folder", {
      kind,
    });
    message.textContent = reply.path;
  } catch (error) {
    message.textContent = format(translate(currentLanguage, "externalAssetsError"), {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function readTemplate(filename: string): Promise<void> {
  try {
    const content = await invoke<{ success: boolean; size: number; error: string | null }>(
      "read_external_template",
      { filename },
    );
    if (!content.success) {
      throw new Error(content.error ?? "read failed");
    }
    message.textContent = `${filename}: ${new Intl.NumberFormat(currentLanguage).format(content.size)} B`;
  } catch (error) {
    message.textContent = format(translate(currentLanguage, "externalAssetsError"), {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function loadExternalAssets(language: Language): Promise<void> {
  currentLanguage = language;
  try {
    const [templates, languages, flags] = await Promise.all([
      invoke<ExternalTemplate[]>("list_external_templates"),
      invoke<ExternalLanguage[]>("list_external_languages"),
      invoke<ExternalFlag[]>("list_available_flags"),
    ]);
    templateList.replaceChildren();
    languageList.replaceChildren();
    flagList.replaceChildren();
    for (const template of templates) {
      const row = element("div", "entity-card");
      row.appendChild(element("strong", "", template.filename));
      row.appendChild(
        element(
          "span",
          "tag",
          `${template.format} · ${new Intl.NumberFormat(language).format(template.size)} B`,
        ),
      );
      const read = element("button", "secondary", translate(language, "externalAssetsImport"));
      read.type = "button";
      read.addEventListener("click", () => void readTemplate(template.filename));
      row.appendChild(read);
      templateList.appendChild(row);
    }
    if (templates.length === 0) empty(templateList);
    for (const item of languages) {
      const row = element("div", "entity-card");
      if (item.flagImage) {
        const flag = element("img", "external-flag");
        flag.src = item.flagImage;
        flag.alt = item.code;
        row.appendChild(flag);
      }
      row.appendChild(element("strong", "", `${item.code} · ${item.name}`));
      row.appendChild(element("span", "tag", `${Object.keys(item.translations).length} keys`));
      languageList.appendChild(row);
    }
    if (languages.length === 0) empty(languageList);
    for (const flag of flags) {
      const row = element("div", "entity-card");
      const image = element("img", "external-flag");
      image.src = flag.image;
      image.alt = flag.name;
      row.appendChild(image);
      row.appendChild(element("span", "tag", flag.name));
      flagList.appendChild(row);
    }
    if (flags.length === 0) empty(flagList);
    for (const item of languages) {
      const code = item.code.toLowerCase();
      if (code === "de" || code === "en" || code === "fr" || code === "es") {
        setExternalPack(code, item.translations);
      }
    }
    applyTranslations(language);
    message.textContent = format(translate(language, "externalAssetsLoaded"), {
      count: new Intl.NumberFormat(language).format(templates.length + languages.length + flags.length),
    });
  } catch (error) {
    message.textContent = format(translate(language, "externalAssetsError"), {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function initExternalAssets(language: Language): void {
  currentLanguage = language;
  refresh.addEventListener("click", () => void loadExternalAssets(currentLanguage));
  templatesOpen.addEventListener("click", () => void openFolder("templates"));
  languagesOpen.addEventListener("click", () => void openFolder("languages"));
  flagsOpen.addEventListener("click", () => void openFolder("flags"));
  void loadExternalAssets(language);
}
