import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { showToast } from './ui.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

let client;

export const getSupabase = () => {
  if (client) return client;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    showToast('يرجى إدخال مفاتيح Supabase من صفحة الإعدادات أولاً.', true);
    throw new Error('Supabase غير مهيأ');
  }
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true }
  });
  return client;
};
