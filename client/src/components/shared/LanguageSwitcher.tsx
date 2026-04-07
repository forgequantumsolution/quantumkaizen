import { useState } from 'react';
import { Globe } from 'lucide-react';
import { SUPPORTED_LOCALES } from '@/i18n';
import { useLocaleStore } from '@/stores/localeStore';

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocaleStore();
  const [open, setOpen] = useState(false);
  const current = SUPPORTED_LOCALES.find((l) => l.code === locale) ?? SUPPORTED_LOCALES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors text-sm"
      >
        <Globe size={14} />
        <span className="text-xs font-medium">{current.flag} {current.code.toUpperCase()}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[140px]">
            {SUPPORTED_LOCALES.map((l) => (
              <button
                key={l.code}
                onClick={() => { setLocale(l.code); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                  locale === l.code ? 'text-slate-900 font-medium' : 'text-gray-700'
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.label}</span>
                {locale === l.code && <span className="ml-auto text-blue-600 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
