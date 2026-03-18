/**
 * إدارة الاتصال بقاعدة البيانات Supabase
 */

import { CONFIG } from './config.js';

let supabaseClient = null;

/**
 * تهيئة اتصال Supabase
 */
export function initSupabase() {
  try {
    if (!window.supabase) {
      throw new Error('مكتبة Supabase غير محملة');
    }
    
    supabaseClient = window.supabase.createClient(
      CONFIG.supabase.url,
      CONFIG.supabase.key,
      CONFIG.supabase.options
    );
    
    return supabaseClient;
  } catch (error) {
    console.error('فشل تهيئة Supabase:', error);
    return null;
  }
}

/**
 * الحصول على عميل Supabase
 */
export function getSupabase() {
  if (!supabaseClient) {
    return initSupabase();
  }
  return supabaseClient;
}

/**
 * إنشاء عملية جديدة
 */
export async function createOperation(operationData) {
  try {
    const client = getSupabase();
    if (!client) throw new Error('عميل Supabase غير متوفر');
    
    const { data, error } = await client
      .from('operations')
      .insert([{
        ...operationData,
        created_at: new Date().toISOString()
      }])
      .select();
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * جلب العمليات مع الفلترة
 */
export async function getOperations(filters = {}) {
  try {
    const client = getSupabase();
    if (!client) throw new Error('عميل Supabase غير متوفر');
    
    let query = client
      .from('operations')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (filters.account_id) {
      query = query.eq('account_id', filters.account_id);
    }
    
    if (filters.date_from) {
      query = query.gte('date', filters.date_from);
    }
    
    if (filters.date_to) {
      query = query.lte('date', filters.date_to);
    }
    
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    
    const { data, error } = await query.limit(100);
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * تحديث رصيد الحساب
 */
export async function updateAccountBalance(accountId, balance) {
  try {
    const client = getSupabase();
    const { error } = await client
      .from('accounts')
      .update({ current_balance: balance, updated_at: new Date().toISOString() })
      .eq('id', accountId);
      
    if (error) throw error;
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}