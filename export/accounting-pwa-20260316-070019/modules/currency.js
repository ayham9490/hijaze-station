export const currencies = [
  { code: 'USD', name: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو' },
  { code: 'TRY', name: 'ليرة تركية' },
  { code: 'SYP', name: 'ليرة سورية' }
];

export const getCurrencyName = (code) => {
  const found = currencies.find(c => c.code === code);
  return found ? found.name : code;
};

export const calculateUSD = (amount, rate) => {
  const safeAmount = Number(amount) || 0;
  const safeRate = Number(rate) || 0;
  return safeAmount * safeRate;
};
