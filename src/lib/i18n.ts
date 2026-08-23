/**
 * Lightweight i18n: two locales, one typed dictionary, no runtime dependency.
 *
 * This module is deliberately free of React and of next/headers so it can be
 * imported from Server Components, Client Components and plain helpers alike.
 * The reading direction lives here too — it is a property of the language, and
 * deriving it in one place stops `dir` and `lang` from ever disagreeing.
 */

export const LANGUAGES = ['en', 'he'] as const;
export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

/** Cookie name shared by the server layout and the client toggle. */
export const LANGUAGE_COOKIE = 'smd_lang';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function directionOf(language: Language): 'ltr' | 'rtl' {
  return language === 'he' ? 'rtl' : 'ltr';
}

/** BCP 47 tag for Intl — date formatting must follow the chosen language. */
export function localeOf(language: Language): string {
  return language === 'he' ? 'he-IL' : 'en-GB';
}

export interface Dictionary {
  languageName: string;
  /** Label on the toggle for switching *to* the other language. */
  switchTo: string;

  header: {
    title: string;
    signOut: string;
  };

  sidebar: {
    heading: string;
    stops: (count: number) => string;
    vehicles: (count: number) => string;
    shown: string;
    hidden: string;
    optimising: string;
    routeUnavailable: string;
    overflowStops: (count: number, limit: number) => string;
    invalidStops: (count: number) => string;
    noTasks: (date: string) => string;
    missingToken: string;
  };

  datePicker: {
    previousDay: string;
    nextDay: string;
    previousMonth: string;
    nextMonth: string;
    chooseDate: string;
    jumpToToday: string;
    loading: string;
    today: string;
    yesterday: string;
    tomorrow: string;
  };

  tooltip: {
    unassignedInstaller: string;
    stop: (n: number) => string;
    optimising: string;
    unrouted: string;
    carPlate: string;
    /** service_tasks has no vehicle-type column yet; shown until one exists. */
    vehicleType: string;
    vehicleTypePlaceholder: string;
    contact: string;
    phone: string;
    address: string;
    timeWindow: string;
    note: string;
  };

  toasts: {
    routeFailed: (vehicleId: string) => string;
  };

  addressSearch: {
    placeholder: string;
  };

  recommendations: {
    heading: string;
    loading: string;
    empty: string;
    clearSearch: string;
  };

  /** Distance and duration suffixes, passed into the formatters in lib/routes.ts. */
  units: {
    km: string;
    m: string;
    min: string;
    hour: string;
  };
}

const EN: Dictionary = {
  languageName: 'English',
  switchTo: 'עברית',

  header: {
    title: 'Daily Service Routes',
    signOut: 'Sign out',
  },

  sidebar: {
    heading: 'Routes',
    stops: (count) => `${count} stop${count === 1 ? '' : 's'}`,
    vehicles: (count) => `${count} vehicle${count === 1 ? '' : 's'}`,
    shown: 'Shown',
    hidden: 'Hidden',
    optimising: 'Optimising route…',
    routeUnavailable: 'Route unavailable — showing stops only.',
    overflowStops: (count, limit) =>
      `${count} stop${count === 1 ? '' : 's'} past the Optimization API’s ${limit}-coordinate limit — shown as markers, not routed.`,
    invalidStops: (count) =>
      `${count} stop${count === 1 ? '' : 's'} have no usable coordinates.`,
    noTasks: (date) =>
      `No tasks scheduled for ${date}. Use the arrows or the calendar in the header to check another day.`,
    missingToken:
      'Missing NEXT_PUBLIC_MAPBOX_TOKEN. Add it to .env.local and restart the dev server — Next.js only reads env files at startup.',
  },

  datePicker: {
    previousDay: 'Previous day',
    nextDay: 'Next day',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    chooseDate: 'Choose a date',
    jumpToToday: 'Jump to today',
    loading: 'Loading…',
    today: 'Today',
    yesterday: 'Yesterday',
    tomorrow: 'Tomorrow',
  },

  tooltip: {
    unassignedInstaller: 'Unassigned',
    stop: (n) => `Stop ${n}`,
    optimising: 'Optimising…',
    unrouted: 'Unrouted',
    carPlate: 'Car Plate',
    vehicleType: 'Vehicle Type',
    vehicleTypePlaceholder: 'Van',
    contact: 'Contact',
    phone: 'Phone',
    address: 'Address',
    timeWindow: 'Time Window',
    note: 'Note',
  },

  toasts: {
    routeFailed: (vehicleId) => `Could not optimise ${vehicleId} — showing its stops only.`,
  },

  addressSearch: {
    placeholder: 'Search address...',
  },

  recommendations: {
    heading: 'Vehicle Recommendations',
    loading: 'Loading recommendations…',
    empty: 'No vehicles found within 20 km in the next 4 days.',
    clearSearch: 'Clear Search',
  },

  units: { km: 'km', m: 'm', min: 'min', hour: 'h' },
};

const HE: Dictionary = {
  languageName: 'עברית',
  switchTo: 'English',

  header: {
    title: 'מסלולי שירות יומיים',
    signOut: 'התנתקות',
  },

  sidebar: {
    heading: 'מסלולים',
    // Hebrew has no "1 stops" problem, but it does inflect the singular.
    stops: (count) => (count === 1 ? 'עצירה אחת' : `${count} עצירות`),
    vehicles: (count) => (count === 1 ? 'רכב אחד' : `${count} רכבים`),
    shown: 'מוצג',
    hidden: 'מוסתר',
    optimising: 'מחשב מסלול…',
    routeUnavailable: 'המסלול אינו זמין — מוצגות עצירות בלבד.',
    overflowStops: (count, limit) =>
      `${count === 1 ? 'עצירה אחת' : `${count} עצירות`} מעבר למגבלת ${limit} הנקודות של Mapbox — מוצגות כסימונים בלבד, ללא מסלול.`,
    invalidStops: (count) =>
      `${count === 1 ? 'לעצירה אחת' : `ל־${count} עצירות`} אין קואורדינטות תקינות.`,
    noTasks: (date) =>
      `אין משימות מתוזמנות לתאריך ${date}. אפשר לדפדף בעזרת החיצים או לוח השנה בכותרת.`,
    missingToken:
      'חסר NEXT_PUBLIC_MAPBOX_TOKEN. יש להוסיף אותו לקובץ \u200E.env.local ולהפעיל מחדש את שרת הפיתוח — \u200FNext.js קורא קובצי סביבה רק בעת העלייה.',
  },

  datePicker: {
    previousDay: 'היום הקודם',
    nextDay: 'היום הבא',
    previousMonth: 'החודש הקודם',
    nextMonth: 'החודש הבא',
    chooseDate: 'בחירת תאריך',
    jumpToToday: 'מעבר להיום',
    loading: 'טוען…',
    today: 'היום',
    yesterday: 'אתמול',
    tomorrow: 'מחר',
  },

  tooltip: {
    unassignedInstaller: 'לא משויך',
    stop: (n) => `עצירה ${n}`,
    optimising: 'מחשב…',
    unrouted: 'ללא מסלול',
    carPlate: 'מספר רכב',
    vehicleType: 'סוג רכב',
    vehicleTypePlaceholder: 'מסחרית',
    contact: 'איש קשר',
    phone: 'טלפון',
    address: 'כתובת',
    timeWindow: 'חלון זמן',
    note: 'הערה',
  },

  toasts: {
    routeFailed: (vehicleId) => `לא ניתן לחשב מסלול עבור ${vehicleId} — מוצגות עצירות בלבד.`,
  },

  addressSearch: {
    placeholder: 'חיפוש כתובת...',
  },

  recommendations: {
    heading: 'המלצות רכבים',
    loading: 'טוען המלצות…',
    empty: 'לא נמצאו רכבים ברדיוס 20 ק״מ ב-4 הימים הקרובים',
    clearSearch: 'נקה חיפוש',
  },

  units: { km: 'ק״מ', m: 'מ׳', min: 'דק׳', hour: 'שע׳' },
};

const DICTIONARIES: Record<Language, Dictionary> = { en: EN, he: HE };

export function getDictionary(language: Language): Dictionary {
  return DICTIONARIES[language];
}
