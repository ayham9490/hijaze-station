import { getSupabase } from './supabase-client.js';
import { fetchAccount, updateAccountBalance } from './accounts.js';
import { calculateUSD } from './currency.js';
import { showToast } from './ui.js';

const normalDebit = ['أصول', 'مصروفات'];

const computeNewBalance = (account, amount, isDebit) => {
  const current = Number(account.balance) || 0;
  const isNormalDebit = normalDebit.includes(account.type);
  if (isDebit) {
    return isNormalDebit ? current + amount : current - amount;
  }
  return isNormalDebit ? current - amount : current + amount;
};

const queueOffline = (payload) => {
  const stored = JSON.parse(localStorage.getItem('pending_transactions') || '[]');
  stored.push(payload);
  localStorage.setItem('pending_transactions', JSON.stringify(stored));
};

export const syncOffline = async () => {
  const pending = JSON.parse(localStorage.getItem('pending_transactions') || '[]');
  if (pending.length === 0) return 0;
  const remaining = [];
  for (const item of pending) {
    const ok = await createTransaction(item, true);
    if (!ok) remaining.push(item);
  }
  localStorage.setItem('pending_transactions', JSON.stringify(remaining));
  return pending.length - remaining.length;
};

export const createTransaction = async (payload, silent = false) => {
  try {
    const { debit_account, credit_account, amount } = payload;
    if (!debit_account || !credit_account || debit_account === credit_account) {
      showToast('يرجى اختيار حسابين مختلفين.', true);
      return false;
    }
    if (Number(amount) <= 0) {
      showToast('المبلغ يجب أن يكون أكبر من صفر.', true);
      return false;
    }

    const supabase = getSupabase();
    const debitAcc = await fetchAccount(debit_account);
    const creditAcc = await fetchAccount(credit_account);
    if (!debitAcc || !creditAcc) return false;

    const converted_usd = calculateUSD(payload.amount, payload.exchange_rate);
    const insertPayload = {
      ...payload,
      converted_usd
    };

    const { error } = await supabase.from('TRANSACTIONS').insert(insertPayload);
    if (error) throw error;

    const debitBalance = computeNewBalance(debitAcc, Number(payload.amount), true);
    const creditBalance = computeNewBalance(creditAcc, Number(payload.amount), false);
    await updateAccountBalance(debitAcc.id, debitBalance);
    await updateAccountBalance(creditAcc.id, creditBalance);

    if (!silent) showToast('تم حفظ العملية بنجاح.');
    return true;
  } catch (err) {
    if (!silent) showToast('تم حفظ العملية محلياً وسيتم مزامنتها عند الاتصال.', true);
    queueOffline(payload);
    return false;
  }
};

export const fetchTransactions = async () => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('TRANSACTIONS')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    showToast('تعذر تحميل العمليات.', true);
    return [];
  }
};
