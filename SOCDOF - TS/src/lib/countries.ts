/**
 * Country list and autocomplete search helper for address and contact forms.
 * Provides multi-lingual matching (DE, EN, FR, ES, IT), flag emojis, and ISO codes.
 */

export interface CountryItem {
  code: string; // ISO 3166-1 alpha-2
  name: string; // Primary name (German default)
  names: {
    de: string;
    en: string;
    fr: string;
    es: string;
    it?: string;
  };
  flag: string; // Flag emoji
}

export const COUNTRIES_LIST: CountryItem[] = [
  // DACH & Core European Neighbors (Highest priority)
  {
    code: 'DE',
    name: 'Deutschland',
    names: { de: 'Deutschland', en: 'Germany', fr: 'Allemagne', es: 'Alemania', it: 'Germania' },
    flag: '🇩🇪'
  },
  {
    code: 'AT',
    name: 'Österreich',
    names: { de: 'Österreich', en: 'Austria', fr: 'Autriche', es: 'Austria', it: 'Austria' },
    flag: '🇦🇹'
  },
  {
    code: 'CH',
    name: 'Schweiz',
    names: { de: 'Schweiz', en: 'Switzerland', fr: 'Suisse', es: 'Suiza', it: 'Svizzera' },
    flag: '🇨🇭'
  },
  {
    code: 'IT',
    name: 'Italien',
    names: { de: 'Italien', en: 'Italy', fr: 'Italie', es: 'Italia', it: 'Italia' },
    flag: '🇮🇹'
  },
  {
    code: 'LI',
    name: 'Liechtenstein',
    names: { de: 'Liechtenstein', en: 'Liechtenstein', fr: 'Liechtenstein', es: 'Liechtenstein', it: 'Liechtenstein' },
    flag: '🇱🇮'
  },
  {
    code: 'LU',
    name: 'Luxemburg',
    names: { de: 'Luxemburg', en: 'Luxembourg', fr: 'Luxembourg', es: 'Luxemburgo', it: 'Lussemburgo' },
    flag: '🇱🇺'
  },
  {
    code: 'FR',
    name: 'Frankreich',
    names: { de: 'Frankreich', en: 'France', fr: 'France', es: 'Francia', it: 'Francia' },
    flag: '🇫🇷'
  },
  {
    code: 'NL',
    name: 'Niederlande',
    names: { de: 'Niederlande', en: 'Netherlands', fr: 'Pays-Bas', es: 'Países Bajos', it: 'Paesi Bassi' },
    flag: '🇳🇱'
  },
  {
    code: 'BE',
    name: 'Belgien',
    names: { de: 'Belgien', en: 'Belgium', fr: 'Belgique', es: 'Bélgica', it: 'Belgio' },
    flag: '🇧🇪'
  },
  {
    code: 'ES',
    name: 'Spanien',
    names: { de: 'Spanien', en: 'Spain', fr: 'Espagne', es: 'España', it: 'Spagna' },
    flag: '🇪🇸'
  },
  {
    code: 'GB',
    name: 'Vereinigtes Königreich',
    names: { de: 'Vereinigtes Königreich', en: 'United Kingdom', fr: 'Royaume-Uni', es: 'Reino Unido', it: 'Regno Unito' },
    flag: '🇬🇧'
  },
  {
    code: 'US',
    name: 'Vereinigte Staaten',
    names: { de: 'Vereinigte Staaten', en: 'United States', fr: 'États-Unis', es: 'Estados Unidos', it: 'Stati Uniti' },
    flag: '🇺🇸'
  },
  {
    code: 'PL',
    name: 'Polen',
    names: { de: 'Polen', en: 'Poland', fr: 'Pologne', es: 'Polonia', it: 'Polonia' },
    flag: '🇵🇱'
  },
  {
    code: 'CZ',
    name: 'Tschechien',
    names: { de: 'Tschechien', en: 'Czech Republic', fr: 'République tchèque', es: 'República Checa', it: 'Repubblica Ceca' },
    flag: '🇨🇿'
  },
  {
    code: 'DK',
    name: 'Dänemark',
    names: { de: 'Dänemark', en: 'Denmark', fr: 'Danemark', es: 'Dinamarca', it: 'Danimarca' },
    flag: '🇩🇰'
  },
  {
    code: 'SE',
    name: 'Schweden',
    names: { de: 'Schweden', en: 'Sweden', fr: 'Suède', es: 'Suecia', it: 'Svezia' },
    flag: '🇸🇪'
  },
  {
    code: 'NO',
    name: 'Norwegen',
    names: { de: 'Norwegen', en: 'Norway', fr: 'Norvège', es: 'Noruega', it: 'Norvegia' },
    flag: '🇳🇴'
  },
  {
    code: 'FI',
    name: 'Finnland',
    names: { de: 'Finnland', en: 'Finland', fr: 'Finlande', es: 'Finlandia', it: 'Finlandia' },
    flag: '🇫🇮'
  },
  {
    code: 'PT',
    name: 'Portugal',
    names: { de: 'Portugal', en: 'Portugal', fr: 'Portugal', es: 'Portugal', it: 'Portogallo' },
    flag: '🇵🇹'
  },
  {
    code: 'GR',
    name: 'Griechenland',
    names: { de: 'Griechenland', en: 'Greece', fr: 'Grèce', es: 'Grecia', it: 'Grecia' },
    flag: '🇬🇷'
  },
  {
    code: 'IE',
    name: 'Irland',
    names: { de: 'Irland', en: 'Ireland', fr: 'Irlande', es: 'Irlanda', it: 'Irlanda' },
    flag: '🇮🇪'
  },
  {
    code: 'HU',
    name: 'Ungarn',
    names: { de: 'Ungarn', en: 'Hungary', fr: 'Hongrie', es: 'Hungría', it: 'Ungheria' },
    flag: '🇭🇺'
  },
  {
    code: 'RO',
    name: 'Rumänien',
    names: { de: 'Rumänien', en: 'Romania', fr: 'Roumanie', es: 'Rumania', it: 'Romania' },
    flag: '🇷🇴'
  },
  {
    code: 'SK',
    name: 'Slowakei',
    names: { de: 'Slowakei', en: 'Slovakia', fr: 'Slovaquie', es: 'Eslovaquia', it: 'Slovacchia' },
    flag: '🇸🇰'
  },
  {
    code: 'SI',
    name: 'Slowenien',
    names: { de: 'Slowenien', en: 'Slovenia', fr: 'Slovénie', es: 'Eslovenia', it: 'Slovenia' },
    flag: '🇸🇮'
  },
  {
    code: 'HR',
    name: 'Kroatien',
    names: { de: 'Kroatien', en: 'Croatia', fr: 'Croatie', es: 'Croacia', it: 'Croazia' },
    flag: '🇭🇷'
  },
  {
    code: 'BG',
    name: 'Bulgarien',
    names: { de: 'Bulgarien', en: 'Bulgaria', fr: 'Bulgarie', es: 'Bulgaria', it: 'Bulgaria' },
    flag: '🇧🇬'
  },
  {
    code: 'CY',
    name: 'Zypern',
    names: { de: 'Zypern', en: 'Cyprus', fr: 'Chypre', es: 'Chipre', it: 'Cipro' },
    flag: '🇨🇾'
  },
  {
    code: 'MT',
    name: 'Malta',
    names: { de: 'Malta', en: 'Malta', fr: 'Malte', es: 'Malta', it: 'Malta' },
    flag: '🇲🇹'
  },
  {
    code: 'EE',
    name: 'Estland',
    names: { de: 'Estland', en: 'Estonia', fr: 'Estonie', es: 'Estonia', it: 'Estonia' },
    flag: '🇪🇪'
  },
  {
    code: 'LV',
    name: 'Lettland',
    names: { de: 'Lettland', en: 'Latvia', fr: 'Lettonie', es: 'Letonia', it: 'Lettonia' },
    flag: '🇱🇻'
  },
  {
    code: 'LT',
    name: 'Litauen',
    names: { de: 'Litauen', en: 'Lithuania', fr: 'Lituanie', es: 'Lituania', it: 'Lituania' },
    flag: '🇱🇹'
  },
  {
    code: 'IS',
    name: 'Island',
    names: { de: 'Island', en: 'Iceland', fr: 'Islande', es: 'Islandia', it: 'Islanda' },
    flag: '🇮🇸'
  },
  {
    code: 'TR',
    name: 'Türkei',
    names: { de: 'Türkei', en: 'Turkey', fr: 'Turquie', es: 'Turquía', it: 'Turchia' },
    flag: '🇹🇷'
  },
  {
    code: 'CA',
    name: 'Kanada',
    names: { de: 'Kanada', en: 'Canada', fr: 'Canada', es: 'Canadá', it: 'Canada' },
    flag: '🇨🇦'
  },
  {
    code: 'AU',
    name: 'Australien',
    names: { de: 'Australien', en: 'Australia', fr: 'Australie', es: 'Australia', it: 'Australia' },
    flag: '🇦🇺'
  },
  {
    code: 'NZ',
    name: 'Neuseeland',
    names: { de: 'Neuseeland', en: 'New Zealand', fr: 'Nouvelle-Zélande', es: 'Nueva Zelanda', it: 'Nuova Zelanda' },
    flag: '🇳🇿'
  },
  {
    code: 'JP',
    name: 'Japan',
    names: { de: 'Japan', en: 'Japan', fr: 'Japon', es: 'Japón', it: 'Giappone' },
    flag: '🇯🇵'
  },
  {
    code: 'CN',
    name: 'China',
    names: { de: 'China', en: 'China', fr: 'Chine', es: 'China', it: 'Cina' },
    flag: '🇨🇳'
  },
  {
    code: 'BR',
    name: 'Brasilien',
    names: { de: 'Brasilien', en: 'Brazil', fr: 'Brésil', es: 'Brasil', it: 'Brasile' },
    flag: '🇧🇷'
  },
  {
    code: 'MX',
    name: 'Mexiko',
    names: { de: 'Mexiko', en: 'Mexico', fr: 'Mexique', es: 'México', it: 'Messico' },
    flag: '🇲🇽'
  },
  {
    code: 'ZA',
    name: 'Südafrika',
    names: { de: 'Südafrika', en: 'South Africa', fr: 'Afrique du Sud', es: 'Sudáfrica', it: 'Sudafrica' },
    flag: '🇿🇦'
  },
  {
    code: 'AE',
    name: 'Vereinigte Arabische Emirate',
    names: { de: 'Vereinigte Arabische Emirate', en: 'United Arab Emirates', fr: 'Émirats arabes unis', es: 'Emiratos Árabes Unidos', it: 'Emirati Arabi Uniti' },
    flag: '🇦🇪'
  },
  {
    code: 'SM',
    name: 'San Marino',
    names: { de: 'San Marino', en: 'San Marino', fr: 'Saint-Marin', es: 'San Marino', it: 'San Marino' },
    flag: '🇸🇲'
  },
  {
    code: 'MC',
    name: 'Monaco',
    names: { de: 'Monaco', en: 'Monaco', fr: 'Monaco', es: 'Mónaco', it: 'Monaco' },
    flag: '🇲🇨'
  },
  {
    code: 'AD',
    name: 'Andorra',
    names: { de: 'Andorra', en: 'Andorra', fr: 'Andorre', es: 'Andorra', it: 'Andorra' },
    flag: '🇦🇩'
  },
  {
    code: 'VA',
    name: 'Vatikanstadt',
    names: { de: 'Vatikanstadt', en: 'Vatican City', fr: 'Vatican', es: 'Ciudad del Vaticano', it: 'Città del Vaticano' },
    flag: '🇻🇦'
  }
];

/**
 * Searches countries matching the input prefix/term across all localized variations and ISO codes.
 */
export function searchCountries(query: string, lang = 'de'): CountryItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean) return COUNTRIES_LIST.slice(0, 8);

  const matched = COUNTRIES_LIST.filter((item) => {
    // Check ISO code
    if (item.code.toLowerCase() === clean) return true;
    if (item.code.toLowerCase().startsWith(clean)) return true;

    // Check localized name in current language
    const langKey = lang as keyof typeof item.names;
    const currentName = item.names[langKey] || item.name;
    if (currentName.toLowerCase().startsWith(clean)) return true;
    if (currentName.toLowerCase().includes(clean)) return true;

    // Check all other variations
    return Object.values(item.names).some((n) => n.toLowerCase().startsWith(clean) || n.toLowerCase().includes(clean));
  });

  // Sort: prefix matches first, then contains
  return matched.sort((a, b) => {
    const langKey = lang as keyof typeof a.names;
    const nameA = (a.names[langKey] || a.name).toLowerCase();
    const nameB = (b.names[langKey] || b.name).toLowerCase();

    const aStarts = nameA.startsWith(clean) || a.code.toLowerCase() === clean;
    const bStarts = nameB.startsWith(clean) || b.code.toLowerCase() === clean;

    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return nameA.localeCompare(nameB);
  });
}

/**
 * Returns localized name for display based on user language.
 */
export function getLocalizedCountryName(item: CountryItem, lang = 'de'): string {
  const langKey = lang as keyof typeof item.names;
  return item.names[langKey] || item.name;
}
