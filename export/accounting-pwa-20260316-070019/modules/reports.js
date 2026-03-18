import { fetchAccounts } from './accounts.js';
import { fetchTransactions } from './transactions.js';
import { formatMoney } from './ui.js';

export const buildDashboardSummary = async () => {
  const accounts = await fetchAccounts();
  const total = accounts.reduce((sum, acc) => sum + (Number(acc.balance) || 0), 0);
  return { accounts, total };
};

export const buildLedger = async () => {
  const accounts = await fetchAccounts();
  const transactions = await fetchTransactions();
  const ledger = accounts.map(account => {
    const items = transactions.filter(tx => tx.debit_account === account.id || tx.credit_account === account.id);
    return { account, items };
  });
  return ledger;
};

export const buildProfitLoss = async () => {
  const accounts = await fetchAccounts();
  const transactions = await fetchTransactions();
  const revenueAccounts = accounts.filter(a => a.type === 'إيرادات');
  const expenseAccounts = accounts.filter(a => a.type === 'مصروفات');

  const revenueIds = revenueAccounts.map(a => a.id);
  const expenseIds = expenseAccounts.map(a => a.id);

  const revenue = transactions
    .filter(tx => revenueIds.includes(tx.credit_account))
    .reduce((sum, tx) => sum + (Number(tx.converted_usd) || 0), 0);

  const expenses = transactions
    .filter(tx => expenseIds.includes(tx.debit_account))
    .reduce((sum, tx) => sum + (Number(tx.converted_usd) || 0), 0);

  return {
    revenue,
    expenses,
    net: revenue - expenses
  };
};

export const buildAccountsReport = async () => {
  const accounts = await fetchAccounts();
  return accounts.map(acc => [acc.name, acc.type, acc.currency, formatMoney(acc.balance, acc.currency)]);
};
