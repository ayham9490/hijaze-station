import {
  SUPPORTED_CURRENCIES,
  CURRENCY_LABELS,
  DEFAULT_EXCHANGE_RATES,
  getStoredExchangeRates,
  saveExchangeRates
} from '../config.js';

export const listSupportedCurrencies = () => {
  return SUPPORTED_CURRENCIES.map((code) => ({
    code,
    label: CURRENCY_LABELS[code] || code
  }));
};

export const isSupportedCurrency = (currency) => SUPPORTED_CURRENCIES.includes(String(currency || '').toUpperCase());

export const normalizeCurrency = (currency) => {
  const code = String(currency || '').toUpperCase();
  return isSupportedCurrency(code) ? code : 'USD';
};

export const normalizeAmount = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  return Number(amount.toFixed(2));
};

export const normalizeRate = (currency, rateValue) => {
  const code = normalizeCurrency(currency);
  if (code === 'USD') {
    return 1;
  }
  const rate = Number(rateValue);
  if (!Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return Number(rate.toFixed(6));
};

export const convertToUSD = (amount, currency, rateValue) => {
  const normalizedAmount = normalizeAmount(amount);
  if (normalizedAmount === null) {
    return null;
  }

  const code = normalizeCurrency(currency);
  const rate = normalizeRate(code, rateValue);
  if (rate === null) {
    return null;
  }

  const converted = code === 'USD' ? normalizedAmount : normalizedAmount * rate;
  return Number(converted.toFixed(2));
};

export const getExchangeRates = () => {
  return getStoredExchangeRates();
};

export const updateExchangeRates = (inputRates) => {
  return saveExchangeRates(inputRates);
};

export const convertByStoredRate = (amount, currency) => {
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount)) {
    return 0;
  }

  const code = normalizeCurrency(currency);
  const rates = getStoredExchangeRates();
  const rate = code === 'USD' ? 1 : Number(rates[code] || DEFAULT_EXCHANGE_RATES[code]);
  if (!Number.isFinite(rate) || rate <= 0) {
    return 0;
  }

  return Number((normalizedAmount * rate).toFixed(2));
};

export const getCurrencyLabel = (currency) => {
  const code = normalizeCurrency(currency);
  return CURRENCY_LABELS[code] || code;
};
