import { ACCOUNT_TYPES } from '../config.js';
import { getSupabaseClient, mapSupabaseError } from './supabase-client.js';
import { isSupportedCurrency, normalizeCurrency } from './currency.js';

const NORMAL_DEBIT_TYPES = ['أصول', 'مصروفات'];

const sanitizeText = (value) => String(value || '').trim();

const sanitizeBalance = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Number(number.toFixed(2));
};

const validateAccountPayload = (payload) => {
  const name = sanitizeText(payload.name);
  const type = sanitizeText(payload.type);
  const currency = normalizeCurrency(payload.currency);
  const balance = sanitizeBalance(payload.balance ?? 0);

  if (name.length < 2 || name.length > 100) {
    return { ok: false, message: 'اسم الحساب يجب أن يكون بين 2 و100 حرف.' };
  }
  if (!ACCOUNT_TYPES.includes(type)) {
    return { ok: false, message: 'نوع الحساب غير صالح.' };
  }
  if (!isSupportedCurrency(currency)) {
    return { ok: false, message: 'العملة المحددة غير مدعومة.' };
  }
  if (balance === null) {
    return { ok: false, message: 'الرصيد الافتتاحي غير صالح.' };
  }

  return {
    ok: true,
    data: {
      name,
      type,
      currency,
      balance
    }
  };
};

export const isDebitNormalAccount = (accountType) => NORMAL_DEBIT_TYPES.includes(String(accountType || '').trim());

export const calculateEntryDelta = (accountType, amount, isDebitSide) => {
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount)) {
    return 0;
  }
  const debitNormal = isDebitNormalAccount(accountType);
  if (isDebitSide) {
    return debitNormal ? safeAmount : -safeAmount;
  }
  return debitNormal ? -safeAmount : safeAmount;
};

export const computeBalanceAfterEntry = (account, amount, isDebitSide) => {
  const current = Number(account.balance) || 0;
  const delta = calculateEntryDelta(account.type, amount, isDebitSide);
  return Number((current + delta).toFixed(2));
};

export const listAccounts = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ACCOUNTS')
      .select('id, name, type, currency, balance, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const accounts = (data || []).map((item) => ({
      ...item,
      balance: Number(item.balance) || 0
    }));

    return { ok: true, data: accounts };
  } catch (error) {
    return { ok: false, data: [], message: mapSupabaseError(error, 'تعذر تحميل الحسابات.') };
  }
};

export const getAccountById = async (accountId) => {
  try {
    const id = sanitizeText(accountId);
    if (!id) {
      return { ok: false, data: null, message: 'معرف الحساب غير صالح.' };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ACCOUNTS')
      .select('id, name, type, currency, balance, created_at')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    return {
      ok: true,
      data: {
        ...data,
        balance: Number(data.balance) || 0
      }
    };
  } catch (error) {
    return { ok: false, data: null, message: mapSupabaseError(error, 'تعذر تحميل الحساب المطلوب.') };
  }
};

export const createAccount = async (payload) => {
  const validation = validateAccountPayload(payload);
  if (!validation.ok) {
    return validation;
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ACCOUNTS')
      .insert([validation.data])
      .select('id, name, type, currency, balance, created_at')
      .single();

    if (error) {
      throw error;
    }

    return {
      ok: true,
      message: 'تم إنشاء الحساب بنجاح.',
      data: {
        ...data,
        balance: Number(data.balance) || 0
      }
    };
  } catch (error) {
    return { ok: false, message: mapSupabaseError(error, 'فشل إنشاء الحساب.') };
  }
};

export const updateAccount = async (accountId, payload) => {
  const validation = validateAccountPayload(payload);
  if (!validation.ok) {
    return validation;
  }

  try {
    const id = sanitizeText(accountId);
    if (!id) {
      return { ok: false, message: 'معرف الحساب غير صالح.' };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ACCOUNTS')
      .update(validation.data)
      .eq('id', id)
      .select('id, name, type, currency, balance, created_at')
      .single();

    if (error) {
      throw error;
    }

    return {
      ok: true,
      message: 'تم تحديث الحساب بنجاح.',
      data: {
        ...data,
        balance: Number(data.balance) || 0
      }
    };
  } catch (error) {
    return { ok: false, message: mapSupabaseError(error, 'تعذر تحديث الحساب.') };
  }
};

const hasLinkedTransactions = async (accountId) => {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('TRANSACTIONS')
    .select('id', { count: 'exact', head: true })
    .or(`debit_account.eq.${accountId},credit_account.eq.${accountId}`);

  if (error) {
    throw error;
  }

  return Number(count) > 0;
};

export const deleteAccount = async (accountId) => {
  try {
    const id = sanitizeText(accountId);
    if (!id) {
      return { ok: false, message: 'معرف الحساب غير صالح.' };
    }

    const used = await hasLinkedTransactions(id);
    if (used) {
      return { ok: false, message: 'لا يمكن حذف حساب مرتبط بعمليات مالية.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('ACCOUNTS').delete().eq('id', id);
    if (error) {
      throw error;
    }

    return { ok: true, message: 'تم حذف الحساب بنجاح.' };
  } catch (error) {
    return { ok: false, message: mapSupabaseError(error, 'تعذر حذف الحساب.') };
  }
};

export const listAccountOptions = async () => {
  const response = await listAccounts();
  if (!response.ok) {
    return response;
  }

  const options = response.data.map((account) => ({
    value: account.id,
    label: `${account.name} (${account.currency})`
  }));

  return { ok: true, data: options };
};
