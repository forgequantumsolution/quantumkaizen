import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setLocale } from '@/i18n';

interface LocaleState {
  locale: string;
  setLocale: (locale: string) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => {
        setLocale(locale);
        set({ locale });
      },
    }),
    { name: 'qk-locale' }
  )
);
