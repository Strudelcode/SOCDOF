import nspell, { type Speller } from 'nspell';

// Offline spell checking for the Textwerk editor.
// The German Hunspell dictionary (dictionary-de, GPL-2.0/GPL-3.0) is served as a static
// file from public/dictionaries/de and only fetched the first time it is needed.

export const SPELL_LANGUAGE_CODE = 'de';

const USER_WORDS_KEY = 'socdof.texteditor.userDictionary';

// Unicode letters incl. combining marks; digits and punctuation split words.
export const WORD_PATTERN = /[\p{L}\p{M}]+/gu;

let germanSpellerPromise: Promise<Speller> | null = null;

export function loadGermanSpeller(): Promise<Speller> {
  if (!germanSpellerPromise) {
    const base = `${import.meta.env.BASE_URL}dictionaries/de/index`;
    germanSpellerPromise = Promise.all([
      fetch(`${base}.aff`).then(response => {
        if (!response.ok) throw new Error(`Dictionary affix file failed: ${response.status}`);
        return response.text();
      }),
      fetch(`${base}.dic`).then(response => {
        if (!response.ok) throw new Error(`Dictionary file failed: ${response.status}`);
        return response.text();
      }),
    ])
      .then(([aff, dic]) => {
        const speller = nspell(aff, dic);
        loadUserWords().forEach(word => speller.add(word));
        return speller;
      })
      .catch(error => {
        germanSpellerPromise = null;
        throw error;
      });
  }
  return germanSpellerPromise;
}

export function loadUserWords(): string[] {
  try {
    const raw = localStorage.getItem(USER_WORDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((w): w is string => typeof w === 'string') : [];
  } catch {
    return [];
  }
}

export function addUserWord(speller: Speller, word: string): void {
  speller.add(word);
  const words = loadUserWords();
  if (!words.includes(word)) {
    words.push(word);
    localStorage.setItem(USER_WORDS_KEY, JSON.stringify(words));
  }
}

export function isIgnorableToken(token: string): boolean {
  return token.length < 2;
}

export interface SpellIssue {
  word: string;
  count: number;
  suggestions: string[];
}

// Collects the misspelled tokens of a plain-text string. Used for the issue panel.
export function collectIssues(
  text: string,
  speller: Speller,
  ignored: Set<string>,
  suggestionLimit = 5
): SpellIssue[] {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0];
    if (isIgnorableToken(word) || ignored.has(word)) continue;
    if (speller.correct(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({
      word,
      count,
      suggestions: speller.suggest(word).slice(0, suggestionLimit),
    }));
}

// Returns the misspelled token ranges of a single text node, relative to the node.
export function findMisspelledRanges(
  text: string,
  speller: Speller,
  ignored: Set<string>
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const match of text.matchAll(WORD_PATTERN)) {
    const word = match[0];
    if (isIgnorableToken(word) || ignored.has(word)) continue;
    if (speller.correct(word)) continue;
    const start = match.index ?? 0;
    ranges.push({ start, end: start + word.length });
  }
  return ranges;
}

export function countWords(text: string): number {
  return Array.from(text.matchAll(WORD_PATTERN)).length;
}

// Counts words case-insensitively; the first spelling seen is kept for display and dictionary checks.
export function wordFrequencies(text: string): Array<{ word: string; count: number }> {
  const entries = new Map<string, { word: string; count: number }>();
  for (const match of text.matchAll(WORD_PATTERN)) {
    const key = match[0].toLowerCase();
    const entry = entries.get(key);
    if (entry) entry.count += 1;
    else entries.set(key, { word: match[0], count: 1 });
  }
  return Array.from(entries.values()).sort(
    (a, b) => b.count - a.count || a.word.localeCompare(b.word, 'de')
  );
}
