// i18n skeleton — extend with react-i18next when ready
// Currently: identity mapping with fallback to key

type TranslationKey = string;

const translations: Record<string, Record<string, string>> = {
  en: {},
  ja: {
    'nav.dashboard': 'ダッシュボード',
    'nav.nonConformances': '不適合',
    'nav.capa': 'CAPA管理',
    'nav.audits': '監査管理',
    'nav.risks': 'リスク管理',
    'nav.documents': '文書管理',
    'nav.suppliers': 'サプライヤー',
    'nav.training': 'トレーニング',
    'nav.calibration': '校正管理',
    'nav.inspection': '検査記録',
  },
  de: {
    'nav.dashboard': 'Dashboard',
    'nav.nonConformances': 'Nichtkonformitäten',
    'nav.capa': 'CAPA-Verwaltung',
    'nav.audits': 'Auditmanagement',
    'nav.risks': 'Risikomanagement',
    'nav.documents': 'Dokumentenverwaltung',
    'nav.suppliers': 'Lieferanten',
    'nav.training': 'Training',
    'nav.calibration': 'Kalibrierung',
    'nav.inspection': 'Inspektion',
  },
  ko: {
    'nav.dashboard': '대시보드',
    'nav.nonConformances': '부적합 관리',
    'nav.capa': 'CAPA 관리',
    'nav.audits': '감사 관리',
    'nav.risks': '위험 관리',
    'nav.documents': '문서 관리',
    'nav.suppliers': '공급업체',
    'nav.training': '교육 훈련',
    'nav.calibration': '교정 관리',
    'nav.inspection': '검사 기록',
  },
};

let currentLocale = 'en';

export function setLocale(locale: string) {
  currentLocale = locale;
}

export function getLocale() {
  return currentLocale;
}

export function t(key: TranslationKey, fallback?: string): string {
  return translations[currentLocale]?.[key] ?? translations['en']?.[key] ?? fallback ?? key;
}

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
];
