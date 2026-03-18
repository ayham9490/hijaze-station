import { STORAGE_KEYS } from '../config.js';
import { getSupabaseClient, mapSupabaseError } from './supabase-client.js';
import { getAccountById, computeBalanceAfterEntry, listAccounts } from './accounts.js';
import { normalizeAmount, normalizeCurrency, normalizeRate, convertToUSD } from './currency.js';

const sanitizeText = (value) => String(value || '').trim();

const normalizeDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
};

const validateTransactionPayload = (payload) => {
  const date = normalizeDate(payload.date);
  const description = sanitizeText(payload.description);
  const debitAccountId = sanitizeText(payload.debit_account);
  const creditAccountId = sanitizeText(payload.credit_account);
  const amount = normalizeAmount(payload.amount);
  const currency = normalizeCurrency(payload.currency);
  const rate = normalizeRate(currency, payload.exchange_rate);

  if (!date) {
    return { ok: false, message: 'تاريخ العملية غير صالح.' };
  }
  if (description.length < 3 || description.length > 500) {
    return { ok: false, message: 'الوصف يجب أن يكون بين 3 و500 حرف.' };
  }
  if (!debitAccountId || !creditAccountId || debitAccountId === creditAccountId) {
    return { ok: false, message: 'يرجى اختيار حساب مدين وحساب دائن مختلفين.' };
  }
  if (amount === null) {
    return { ok: false, message: 'المبلغ يجب أن يكون أكبر من صفر.' };
  }
  if (rate === null) {
    return { ok: false, message: 'سعر الصرف غير صالح.' };
  }

  const converted = convertToUSD(amount, currency, rate);
  if (converted === null) {
    return { ok: false, message: 'تعذر تحويل المبلغ إلى الدولار.' };
  }

  return {
    ok: true,
    data: {
      date,
      description,
      debit_account: debitAccountId,
      credit_account: creditAccountId,
      amount,
      currency,
      exchange_rate: rate,
      converted_usd: converted
    }
  };
};

const isNetworkError = (error) => {
  if (!navigator.onLine) {
    return true;
  }
  const message = String(error?.message || '').toLowerCase();
  return message.includes('failed to fetch') || message.includes('network') || message.includes('fetch');
};

const readPendingTransactions = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.pendingTransactions);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed;
  } catch (error) {
    return [];
  }
};

const writePendingTransactions = (items) => {
  localStorage.setItem(STORAGE_KEYS.pendingTransactions, JSON.stringify(items));
};

const queuePendingTransaction = (payload) => {
  const pending = readPendingTransactions();
  pending.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    queued_at: new Date().toISOString()
  });
  writePendingTransactions(pending);
};

const rollbackTransaction = async (txId, debitAccount, debitOldBalance) => {
  try {
    const supabase = getSupabaseClient();
    await supabase.from('ACCOUNTS').update({ balance: debitOldBalance }).eq('id', debitAccount.id);
    await supabase.from('TRANSACTIONS').delete().eq('id', txId);
  } catch (error) {
    // أفضل محاولة للرجوع دون إيقاف التنفيذ.
  }
};

export const getPendingTransactions = () => {
  return readPendingTransactions();
};

export const listTransactions = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('TRANSACTIONS')
      .select('id, date, debit_account, credit_account, description, amount, currency, exchange_rate, converted_usd, created_at')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const accountsResponse = await listAccounts();
    const accountMap = {};
    if (accountsResponse.ok) {
      accountsResponse.data.forEach((account) => {
        accountMap[account.id] = account;
      });
    }

    const transactions = (data || []).map((item) => ({
      ...item,
      amount: Number(item.amount) || 0,
      exchange_rate: Number(item.exchange_rate) || 0,
      converted_usd: Number(item.converted_usd) || 0,
      debit_account_name: accountMap[item.debit_account]?.name || 'حساب غير معروف',
      credit_account_name: accountMap[item.credit_account]?.name || 'حساب غير معروف'
    }));

    return { ok: true, data: transactions };
  } catch (error) {
    return { ok: false, data: [], message: mapSupabaseError(error, 'تعذر تحميل العمليات المالية.') };
  }
};

export const createTransaction = async (payload, options = {}) => {
  const { allowQueue = true } = options;
  const validation = validateTransactionPayload(payload);
  if (!validation.ok) {
    return validation;
  }

  try {
    const transactionData = validation.data;

    const [debitResponse, creditResponse] = await Promise.all([
      getAccountById(transactionData.debit_account),
      getAccountById(transactionData.credit_account)
    ]);

    if (!debitResponse.ok || !debitResponse.data) {
      return { ok: false, message: debitResponse.message || 'تعذر تحميل الحساب المدين.' };
    }
    if (!creditResponse.ok || !creditResponse.data) {
      return { ok: false, message: creditResponse.message || 'تعذر تحميل الحساب الدائن.' };
    }

    const debitAccount = debitResponse.data;
    const creditAccount = creditResponse.data;

    const debitNewBalance = computeBalanceAfterEntry(debitAccount, transactionData.amount, true);
    const creditNewBalance = computeBalanceAfterEntry(creditAccount, transactionData.amount, false);

    const supabase = getSupabaseClient();
    const { data: inserted, error: insertError } = await supabase
      .from('TRANSACTIONS')
      .insert([transactionData])
      .select('id, date, debit_account, credit_account, description, amount, currency, exchange_rate, converted_usd, created_at')
      .single();

    if (insertError) {
      throw insertError;
    }

    const { error: debitUpdateError } = await supabase
      .from('ACCOUNTS')
      .update({ balance: debitNewBalance })
      .eq('id', debitAccount.id);

    if (debitUpdateError) {
      await supabase.from('TRANSACTIONS').delete().eq('id', inserted.id);
      throw debitUpdateError;
    }

    const { error: creditUpdateError } = await supabase
      .from('ACCOUNTS')
      .update({ balance: creditNewBalance })
      .eq('id', creditAccount.id);

    if (creditUpdateError) {
      await rollbackTransaction(inserted.id, debitAccount, Number(debitAccount.balance) || 0);
      throw creditUpdateError;
    }

    return { ok: true, message: 'تم حفظ القيد المحاسبي بنجاح.', data: inserted };
  } catch (error) {
    if (allowQueue && isNetworkError(error)) {
      queuePendingTransaction(validation.data);
      return {
        ok: true,
        queued: true,
        message: 'تم حفظ العملية محليًا وسيتم إرسالها تلقائيًا عند عودة الاتصال.'
      };
    }

    return { ok: false, message: mapSupabaseError(error, 'تعذر حفظ العملية المالية.') };
  }
};

export const syncPendingTransactions = async () => {
  const pending = readPendingTransactions();
  if (pending.length === 0) {
    return { ok: true, synced: 0, failed: 0 };
  }

  const remaining = [];
  let synced = 0;

  for (const item of pending) {
    const result = await createTransaction(item.payload, { allowQueue: false });
    if (result.ok) {
      synced += 1;
      continue;
    }
    remaining.push(item);
  }

  writePendingTransactions(remaining);

  return {
    ok: true,
    synced,
    failed: remaining.length
  };
};
