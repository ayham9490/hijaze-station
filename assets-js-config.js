/**
 * ملف الإعدادات والثوابت
 */

export const CONFIG = {
  // إعدادات Supabase (يجب استبدالها بقيمك الخاصة)
  supabase: {
    url: 'https://dbzcuqtobuxtvirrcerz.supabase.co',
    key: 'sb_publishable_4YS1GjIl1k9dlzwbgAnMGQ_gm_mdtbU',
    options: {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    }
  },
  
  // العملات المتاحة
  currencies: {
    USD: { symbol: '$', name: 'دولار أمريكي', rate: 1 },
    TRY: { symbol: '₺', name: 'ليرة تركية', rate: 44 },
    SYP: { symbol: 'ل.س', name: 'ليرة سورية', rate: 119 }
  },
  
  // أنواع العمليات
  operationTypes: {
    sell: { label: 'بيع', color: 'green', icon: '↓' },
    buy: { label: 'شراء', color: 'red', icon: '↑' },
    payment: { label: 'دفعة', color: 'yellow', icon: '↔' },
    expense: { label: 'مصروف', color: 'gray', icon: '•' }
  },
  
  // إعدادات التخزين المحلي
  storage: {
    prefix: 'accounting_',
    version: '1.0'
  }
};

// دالة مساعدة للحصول على الإعدادات المخزنة
export function getStoredSettings() {
  try {
    const settings = localStorage.getItem(CONFIG.storage.prefix + 'settings');
    return settings ? JSON.parse(settings) : {};
  } catch (error) {
    return {};
  }
}

// دالة لحفظ الإعدادات
export function saveSettings(settings) {
  try {
    localStorage.setItem(CONFIG.storage.prefix + 'settings', JSON.stringify(settings));
    return true;
  } catch (error) {
    return false;
  }
}