import { useSyncExternalStore } from 'react';
import { en } from './en';
import { ru } from './ru';

export type Language = 'en' | 'ru';

interface TranslationOptions {
  defaultValue?: string;
}

const listeners = new Set<() => void>();

function readLanguage(): Language {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('language') === 'en'
      ? 'en'
      : 'ru';
  } catch {
    return 'ru';
  }
}

let currentLanguage = readLanguage();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getLanguage() {
  return currentLanguage;
}

function changeLanguage(language: Language) {
  if (currentLanguage === language) return;
  currentLanguage = language;
  listeners.forEach((listener) => listener());
}

export const i18n = {
  changeLanguage,
  get language() {
    return currentLanguage;
  },
};

export function useTranslation() {
  const language = useSyncExternalStore(subscribe, getLanguage, getLanguage);

  const t = (key: string, options?: TranslationOptions): string => {
    let value: unknown = (language === 'en' ? en : ru).translation;
    for (const part of key.split('.')) {
      if (!isRecord(value) || !(part in value)) {
        return options?.defaultValue ?? key;
      }
      value = value[part];
    }
    return typeof value === 'string' ? value : options?.defaultValue ?? key;
  };

  return { t, i18n };
}

export default i18n;
