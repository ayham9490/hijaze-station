import { listAccounts, calculateEntryDelta } from './accounts.js';
import { listTransactions } from './transactions.js';
import { convertByStoredRate } from './currency.js';

const parseDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const sortByDateAsc = (left, right) => {
  const a = parseDate(left.date)?.getTime() || 0;
  const b = parseDate(right.date)?.getTime() || 0;
  if (a === b) {
    return (left.created_at || '').localeCompare(right.created_at || '');
  }
  return a - b;
};

const buildAccountMap = (accounts) => {
  const map = {};
  accounts.forEach((account) => {
    map[account.id] = account;
  });
  return map;
};

const computeProfitLoss = (transactions, accountMap) => {
  let revenue = 0;
  let expenses = 0;

  transactions.forEach((transaction) => {
    const value = Number(transaction.converted_usd) || 0;
    const debitType = accountMap[transaction.debit_account]?.type || '';
    const creditType = accountMap[transaction.credit_account]?.type || '';

    if (creditType === 'إيرادات') {
      revenue += value;
    }
    if (debitType === 'مصروفات') {
      expenses += value;
    }
  });

  return {
    revenue: Number(revenue.toFixed(2)),
    expenses: Number(expenses.toFixed(2)),
    netProfit: Number((revenue - expenses).toFixed(2))
  };
};

export const getDashboardData = async () => {
  try {
    const [accountsResponse, transactionsResponse] = await Promise.all([
      listAccounts(),
      listTransactions()
    ]);

    if (!accountsResponse.ok) {
      return {
        ok: false,
        message: accountsResponse.message,
        data: null
      };
    }
    if (!transactionsResponse.ok) {
      return {
        ok: false,
        message: transactionsResponse.message,
        data: null
      };
    }

    const accounts = accountsResponse.data;
    const transactions = transactionsResponse.data;
    const accountMap = buildAccountMap(accounts);

    const balancesUsd = accounts.reduce((sum, account) => {
      const converted = convertByStoredRate(account.balance, account.currency);
      return sum + converted;
    }, 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthTransactionsCount = transactions.filter((transaction) => {
      const date = parseDate(transaction.date);
      if (!date) {
        return false;
      }
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;

    const latestTransactions = [...transactions]
      .sort((a, b) => sortByDateAsc(b, a))
      .slice(0, 8);

    const accountSummary = accounts.reduce((accumulator, account) => {
      if (!accumulator[account.type]) {
        accumulator[account.type] = { count: 0, balanceUsd: 0 };
      }
      accumulator[account.type].count += 1;
      accumulator[account.type].balanceUsd += convertByStoredRate(account.balance, account.currency);
      return accumulator;
    }, {});

    const profitLoss = computeProfitLoss(transactions, accountMap);

    return {
      ok: true,
      data: {
        accounts,
        transactions,
        balancesUsd: Number(balancesUsd.toFixed(2)),
        monthTransactionsCount,
        latestTransactions,
        accountSummary,
        profitLoss
      }
    };
  } catch (error) {
    return {
      ok: false,
      message: 'تعذر بناء بيانات لوحة التحكم.',
      data: null
    };
  }
};

export const getLedgerReport = async (accountId = '') => {
  try {
    const [accountsResponse, transactionsResponse] = await Promise.all([
      listAccounts(),
      listTransactions()
    ]);

    if (!accountsResponse.ok) {
      return { ok: false, message: accountsResponse.message, data: [] };
    }
    if (!transactionsResponse.ok) {
      return { ok: false, message: transactionsResponse.message, data: [] };
    }

    const accounts = accountsResponse.data;
    const transactions = transactionsResponse.data;

    const scopedAccounts = accountId
      ? accounts.filter((account) => account.id === accountId)
      : accounts;

    const ledgerBlocks = scopedAccounts.map((account) => {
      const relatedTransactions = transactions
        .filter((transaction) => transaction.debit_account === account.id || transaction.credit_account === account.id)
        .sort(sortByDateAsc);

      const effects = relatedTransactions.map((transaction) => {
        const isDebit = transaction.debit_account === account.id;
        const delta = calculateEntryDelta(account.type, transaction.amount, isDebit);
        return {
          ...transaction,
          side: isDebit ? 'مدين' : 'دائن',
          delta
        };
      });

      const totalDelta = effects.reduce((sum, item) => sum + item.delta, 0);
      const currentBalance = Number(account.balance) || 0;
      const openingBalance = Number((currentBalance - totalDelta).toFixed(2));

      let runningBalance = openingBalance;
      const rows = effects.map((item) => {
        runningBalance = Number((runningBalance + item.delta).toFixed(2));
        return {
          ...item,
          runningBalance
        };
      });

      return {
        account,
        openingBalance,
        currentBalance,
        rows
      };
    });

    return { ok: true, data: ledgerBlocks };
  } catch (error) {
    return {
      ok: false,
      message: 'تعذر بناء تقرير دفتر الأستاذ.',
      data: []
    };
  }
};

export const getAccountsReport = async () => {
  try {
    const accountsResponse = await listAccounts();
    if (!accountsResponse.ok) {
      return { ok: false, message: accountsResponse.message, data: [] };
    }

    const rows = accountsResponse.data.map((account) => {
      const convertedUsd = convertByStoredRate(account.balance, account.currency);
      return {
        ...account,
        converted_usd: Number(convertedUsd.toFixed(2))
      };
    });

    return { ok: true, data: rows };
  } catch (error) {
    return {
      ok: false,
      message: 'تعذر بناء تقرير الحسابات.',
      data: []
    };
  }
};

export const getProfitLossReport = async () => {
  try {
    const [accountsResponse, transactionsResponse] = await Promise.all([
      listAccounts(),
      listTransactions()
    ]);

    if (!accountsResponse.ok) {
      return { ok: false, message: accountsResponse.message, data: null };
    }
    if (!transactionsResponse.ok) {
      return { ok: false, message: transactionsResponse.message, data: null };
    }

    const accountMap = buildAccountMap(accountsResponse.data);
    const summary = computeProfitLoss(transactionsResponse.data, accountMap);

    return {
      ok: true,
      data: {
        ...summary,
        transactionsCount: transactionsResponse.data.length
      }
    };
  } catch (error) {
    return {
      ok: false,
      message: 'تعذر بناء تقرير الأرباح والخسائر.',
      data: null
    };
  }
};

export const getTransactionsReport = async (filters = {}) => {
  try {
    const response = await listTransactions();
    if (!response.ok) {
      return { ok: false, message: response.message, data: [] };
    }

    const dateFrom = filters.dateFrom ? parseDate(filters.dateFrom) : null;
    const dateTo = filters.dateTo ? parseDate(filters.dateTo) : null;
    const currencyFilter = String(filters.currency || '').trim().toUpperCase();

    const scoped = response.data.filter((transaction) => {
      const date = parseDate(transaction.date);
      if (!date) {
        return false;
      }
      if (dateFrom && date < dateFrom) {
        return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (date > end) {
          return false;
        }
      }
      if (currencyFilter && currencyFilter !== 'ALL' && transaction.currency !== currencyFilter) {
        return false;
      }
      return true;
    });

    return { ok: true, data: scoped };
  } catch (error) {
    return {
      ok: false,
      message: 'تعذر بناء تقرير العمليات.',
      data: []
    };
  }
};
