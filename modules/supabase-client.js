import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { getSupabaseConfig } from '../config.js';

let client = null;
let activeSignature = '';

const buildSignature = (url, anonKey) => `${url}|${anonKey}`;

const normalizeSupabaseError = (error, fallbackMessage) => {
  if (!error) {
    return fallbackMessage;
  }
  return error.message || error.details || fallbackMessage;
};

export const getSupabaseClient = () => {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error('يرجى إدخال رابط ومفتاح Supabase من صفحة الإعدادات أولاً.');
  }

  const signature = buildSignature(url, anonKey);
  if (!client || signature !== activeSignature) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    activeSignature = signature;
  }

  return client;
};

export const resetSupabaseClient = () => {
  client = null;
  activeSignature = '';
};

export const testSupabaseConnection = async () => {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('USERS').select('id', { head: true, count: 'exact' });
    if (error) {
      throw error;
    }
    return { ok: true, message: 'تم الاتصال بقاعدة البيانات بنجاح.' };
  } catch (error) {
    return {
      ok: false,
      message: normalizeSupabaseError(error, 'تعذر الاتصال بقاعدة البيانات. تحقق من الرابط والمفتاح.')
    };
  }
};

export const mapSupabaseError = (error, fallbackMessage) => {
  return normalizeSupabaseError(error, fallbackMessage);
};
