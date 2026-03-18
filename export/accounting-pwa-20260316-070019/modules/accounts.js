import { getSupabase } from './supabase-client.js';
import { showToast } from './ui.js';

export const fetchAccounts = async () => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('ACCOUNTS').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    showToast('تعذر تحميل الحسابات.', true);
    return [];
  }
};

export const createAccount = async (account) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('ACCOUNTS').insert(account).select().single();
    if (error) throw error;
    showToast('تم إنشاء الحساب بنجاح.');
    return data;
  } catch (err) {
    showToast('فشل إنشاء الحساب.', true);
    return null;
  }
};

export const updateAccountBalance = async (accountId, newBalance) => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('ACCOUNTS').update({ balance: newBalance }).eq('id', accountId);
    if (error) throw error;
    return true;
  } catch (err) {
    showToast('تعذر تحديث الرصيد.', true);
    return false;
  }
};

export const fetchAccount = async (accountId) => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('ACCOUNTS').select('*').eq('id', accountId).single();
    if (error) throw error;
    return data;
  } catch (err) {
    showToast('تعذر جلب الحساب المطلوب.', true);
    return null;
  }
};
