export const SUPABASE_URL = 'https://dbzcuqtobuxtvirrcerz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiemN1cXRvYnV4dHZpcnJjZXJ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NDMxODQsImV4cCI6MjA4OTExOTE4NH0.DdVDNAuwT4jeMre1GGvDAG42mEz75lI4ZWYV6S7JrtI';

export const STORAGE_KEYS = {
  supabaseUrl: 'supabase_url',
  supabaseAnonKey: 'supabase_anon_key',
  pendingTransactions: 'pending_transactions',
  exchangeRates: 'exchange_rates'
};

export const ACCOUNT_TYPES = [
  'أصول',
  'خصوم',
  'حقوق ملكية',
  'إيرادات',
  'مصروفات'
];

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'TRY', 'SYP'];

export const CURRENCY_LABELS = {
  USD: 'دولار أمريكي',
  EUR: 'يورو',
  TRY: 'ليرة تركية',
  SYP: 'ليرة سورية'
};

export const DEFAULT_EXCHANGE_RATES = {
  USD: 1,
  EUR: 1.1,
  TRY: 0.031,
  SYP: 0.000076
};

export const ROLES = {
  admin: 'مدير',
  accountant: 'محاسب',
  viewer: 'مشاهد'
};

export const ROLE_OPTIONS = Object.keys(ROLES);

export const getSupabaseConfig = () => {
  const url = (localStorage.getItem(STORAGE_KEYS.supabaseUrl) || SUPABASE_URL || '').trim();
  const anonKey = (localStorage.getItem(STORAGE_KEYS.supabaseAnonKey) || SUPABASE_ANON_KEY || '').trim();
  return { url, anonKey };
};

export const saveSupabaseConfig = (url, anonKey) => {
  localStorage.setItem(STORAGE_KEYS.supabaseUrl, (url || '').trim());
  localStorage.setItem(STORAGE_KEYS.supabaseAnonKey, (anonKey || '').trim());
};

export const isSupabaseConfigured = () => {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
};

export const getStoredExchangeRates = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.exchangeRates);
    if (!raw) {
      return { ...DEFAULT_EXCHANGE_RATES };
    }
    const parsed = JSON.parse(raw);
    const normalized = { ...DEFAULT_EXCHANGE_RATES };
    SUPPORTED_CURRENCIES.forEach((currency) => {
      const value = Number(parsed[currency]);
      if (currency === 'USD') {
        normalized.USD = 1;
        return;
      }
      normalized[currency] = Number.isFinite(value) && value > 0 ? value : DEFAULT_EXCHANGE_RATES[currency];
    });
    return normalized;
  } catch (error) {
    return { ...DEFAULT_EXCHANGE_RATES };
  }
};

export const saveExchangeRates = (rates) => {
  const normalized = { ...DEFAULT_EXCHANGE_RATES };
  SUPPORTED_CURRENCIES.forEach((currency) => {
    const value = Number(rates[currency]);
    if (currency === 'USD') {
      normalized.USD = 1;
      return;
    }
    normalized[currency] = Number.isFinite(value) && value > 0 ? value : DEFAULT_EXCHANGE_RATES[currency];
  });
  localStorage.setItem(STORAGE_KEYS.exchangeRates, JSON.stringify(normalized));
  return normalized;
};
