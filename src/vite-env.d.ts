/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

declare module 'nspell' {
  export interface Speller {
    correct(word: string): boolean;
    suggest(word: string): string[];
    add(word: string): Speller;
    remove(word: string): Speller;
  }
  export default function nspell(aff: string, dic?: string): Speller;
}
