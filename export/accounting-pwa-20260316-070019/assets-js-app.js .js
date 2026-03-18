/**
 * المنطق الرئيسي للتطبيق
 */

import { CONFIG, getStoredSettings, saveSettings } from './config.js';
import * as supabase from './supabase-client.js';
import * as ui from './ui.js';

// المتغيرات العالمية
let currentSettings = {};
let accountsCache = [];

/**
 * تهيئة التطبيق
 */
async function initApp() {
  try {
    ui.setLoading(true);
    
    // تحميل الإعدادات
    currentSettings = getStoredSettings();
    
    // تهيئة Supabase
    supabase.initSupabase();
    
    // ربط الأحداث
    bindEvents();
    
    // تحميل البيانات الأولية
    await loadDashboardData();
    await loadAccounts();
    
    // ضبط التاريخ الافتراضي
    document.getElementById('op-date').valueAsDate = new Date();
    
    ui.showToast('تم تحميل النظام بنجاح', 'success');
  } catch (error) {
    ui.showToast('حدث خطأ في تحميل النظام', 'error');
  } finally {
    ui.setLoading(false);
  }
}

/**
 * ربط الأحداث
 */
function bindEvents() {
  // نموذج العملية
  document.getElementById('operation-form')?.addEventListener('submit', handleOperationSubmit);
  
  // تغيير نوع العملية
  document.getElementById('op-type')?.addEventListener('change', (e) => {
    ui.toggleOperationFields(e.target.value);
  });
  
  // تغيير العملة
  document.getElementById('op-currency')?.addEventListener('change', (e) => {
    ui.handleCurrencyChange(e.target.value);
  });
  
  // حساب البراميل تلقائياً
  ['op-weight', 'op-density'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (document.getElementById('op-type').value === 'sell' || 
          document.getElementById('op-type').value === 'buy') {
        ui.calculateBarrels();
      }
    });
  });
  
  // نموذج الحساب
  document.getElementById('account-form')?.addEventListener('submit', handleAccountSubmit);
  
  // قائمة الجوال
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('translate-x-full');
  });
  
  // فلترة العمليات
  document.getElementById('filter-type')?.addEventListener('change', filterOperations);
}

/**
 * معالجة إرسال العملية
 */
async function handleOperationSubmit(e) {
  e.preventDefault();
  
  try {
    ui.setLoading(true);
    
    const formData = new FormData(e.target);
    const operationData = {
      type: formData.get('type'),
      account_id: formData.get('account_id') || null,
      date: formData.get('date'),
      currency: formData.get('currency'),
      amount: parseFloat(formData.get('amount')) || 0,
      exchange_rate: parseFloat(formData.get('exchange_rate')) || 1,
      notes: formData.get('notes'),
      direction: formData.get('direction') || 'outgoing',
      fuel_type: formData.get('fuel_type') || null,
      weight: parseFloat(formData.get('weight')) || null,
      density: parseFloat(formData.get('density')) || null,
      barrel_price: parseFloat(formData.get('barrel_price')) || null,
      barrels: parseFloat(document.getElementById('calculated-barrels')?.textContent) || null
    };
    
    // التحقق من صحة البيانات
    if (!operationData.type) throw new Error('يرجى اختيار نوع العملية');
    if (operationData.amount <= 0) throw new Error('المبلغ يجب أن يكون أكبر من صفر');
    
    // حفظ في Supabase
    const result = await supabase.createOperation(operationData);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // تحديث رصيد الحساب إذا كان هناك حساب مرتبط
    if (operationData.account_id) {
      await updateAccountBalance(operationData.account_id, operationData.type, operationData.amount);
    }
    
    ui.showToast('تم حفظ العملية بنجاح', 'success');
    e.target.reset();
    document.getElementById('calculated-barrels').textContent = '0';
    
    // إعادة تحميل البيانات
    await loadDashboardData();
    
  } catch (error) {
    ui.showToast(error.message, 'error');
  } finally {
    ui.setLoading(false);
  }
}

/**
 * تحديث رصيد الحساب محلياً وفي قاعدة البيانات
 */
async function updateAccountBalance(accountId, operationType, amount) {
  try {
    const account = accountsCache.find(a => a.id === accountId);
    if (!account) return;
    
    let newBalance = parseFloat(account.current_balance) || 0;
    
    // منطق حساب الرصيد حسب نوع العملية
    switch(operationType) {
      case 'sell':
        newBalance += amount; // لنا
        break;
      case 'buy':
        newBalance -= amount; // علينا
        break;
      case 'payment':
        // يتم التعامل معه حسب الاتجاه في حفظ العملية
        break;
    }
    
    await supabase.updateAccountBalance(accountId, newBalance);
    
  } catch (error) {
    console.error('فشل تحديث الرصيد:', error);
  }
}

/**
 * معالجة إضافة حساب جديد
 */
async function handleAccountSubmit(e) {
  e.preventDefault();
  
  try {
    const formData = new FormData(e.target);
    const accountData = {
      name: formData.get('name'),
      type: formData.get('type'),
      phone: formData.get('phone'),
      current_balance: parseFloat(formData.get('initial_balance')) || 0
    };
    
    const client = supabase.getSupabase();
    const { error } = await client
      .from('accounts')
      .insert([accountData]);
      
    if (error) throw error;
    
    ui.showToast('تم إضافة الحساب بنجاح', 'success');
    e.target.reset();
    await loadAccounts();
    
  } catch (error) {
    ui.showToast(error.message, 'error');
  }
}

/**
 * تحميل الحسابات
 */
async function loadAccounts() {
  try {
    const client = supabase.getSupabase();
    const { data, error } = await client
      .from('accounts')
      .select('*')
      .order('name');
      
    if (error) throw error;
    
    accountsCache = data || [];
    
    // تحديث قائمة الحسابات في النماذج
    const selects = ['op-account', 'report-account'];
    selects.forEach(id => {
      const select = document.getElementById(id);
      if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">اختر الحساب</option>' +
          accountsCache.map(acc => `<option value="${acc.id}">${acc.name} (${acc.type})</option>`).join('');
        select.value = currentValue;
      }
    });
    
    // تحديث جدول الحسابات
    const tbody = document.getElementById('accounts-list');
    if (tbody) {
      tbody.innerHTML = accountsCache.map(acc => `
        <tr class="hover:bg-gray-50">
          <td class="px-4 py-3 font-medium">${acc.name}</td>
          <td class="px-4 py-3">
            <span class="px-2 py-1 rounded-full text-xs ${getAccountTypeColor(acc.type)}">
              ${getAccountTypeLabel(acc.type)}
            </span>
          </td>
          <td class="px-4 py-3 font-bold ${acc.current_balance >= 0 ? 'text-green-600' : 'text-red-600'}">
            ${acc.current_balance.toFixed(2)} $
          </td>
          <td class="px-4 py-3 text-sm text-gray-500">
            ${acc.updated_at ? new Date(acc.updated_at).toLocaleDateString('ar-SY') : '-'}
          </td>
          <td class="px-4 py-3">
            <button onclick="app.viewAccount('${acc.id}')" class="text-blue-600 hover:text-blue-800 text-sm">عرض</button>
          </td>
        </tr>
      `).join('');
    }
    
  } catch (error) {
    ui.showToast('فشل تحميل الحسابات', 'error');
  }
}

/**
 * تحميل بيانات لوحة التحكم
 */
async function loadDashboardData() {
  try {
    // إحصائيات
    const client = supabase.getSupabase();
    
    // عدد العمليات
    const { count: opCount } = await client
      .from('operations')
      .select('*', { count: 'exact', head: true });
      
    document.getElementById('stat-operations').textContent = opCount || 0;
    
    // عدد الزبائن
    const { count: custCount } = await client
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'customer');
      
    document.getElementById('stat-customers').textContent = custCount || 0;
    
    // آخر عمليات
    const { data: recentOps } = await client
      .from('operations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    ui.renderOperationsList(recentOps, 'recent-operations');
    
  } catch (error) {
    console.error('فشل تحميل البيانات:', error);
  }
}

/**
 * توليد كود Google Apps Script
 */
function generateGSheetCode() {
  return `
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({success: true}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const action = e.parameter.action;
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  
  if (action === 'sync') {
    const data = JSON.parse(e.postData.contents);
    // منطق المزامنة هنا
    return ContentService.createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({error: 'Unknown action'}))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}

/**
 * تصدير PDF
 */
function exportPDF() {
  const element = document.getElementById('report-container');
  if (!element) {
    ui.showToast('لا توجد بيانات للتصدير', 'warning');
    return;
  }
  
  const opt = {
    margin: 1,
    filename: `كشف-حساب-${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'cm', format: 'a4', orientation: 'portrait' }
  };
  
  html2pdf().set(opt).from(element).save();
}

/**
 * دوال مساعدة
 */
function getAccountTypeColor(type) {
  const colors = {
    customer: 'bg-green-100 text-green-800',
    supplier: 'bg-blue-100 text-blue-800',
    employee: 'bg-purple-100 text-purple-800'
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

function getAccountTypeLabel(type) {
  const labels = {
    customer: 'زبون',
    supplier: 'مورد',
    employee: 'موظف'
  };
  return labels[type] || type;
}

// تعريف الواجهات العامة
window.app = {
  navigate: ui.navigateTo,
  calculateBarrels: ui.calculateBarrels,
  exportPDF,
  saveSettings: () => {
    const settings = {
      usd_try: parseFloat(document.getElementById('setting-usd-try')?.value) || 44,
      usd_syp: parseFloat(document.getElementById('setting-usd-syp')?.value) || 119,
      gsheets_url: document.getElementById('gsheets-url')?.value || ''
    };
    saveSettings(settings);
    ui.showToast('تم حفظ الإعدادات', 'success');
  },
  copyGSheetCode: () => {
    const code = generateGSheetCode();
    navigator.clipboard.writeText(code).then(() => {
      ui.showToast('تم نسخ الكود', 'success');
    });
  },
  viewAccount: (id) => {
    // عرض تفاصيل الحساب
    const account = accountsCache.find(a => a.id === id);
    if (account) {
      document.getElementById('report-account').value = id;
      ui.navigateTo('reports');
    }
  },
  generateReport: async () => {
    const accountId = document.getElementById('report-account')?.value;
    const from = document.getElementById('report-from')?.value;
    const to = document.getElementById('report-to')?.value;
    
    if (!accountId) {
      ui.showToast('يرجى اختيار حساب', 'warning');
      return;
    }
    
    const { data } = await supabase.getOperations({
      account_id: accountId,
      date_from: from,
      date_to: to
    });
    
    // بناء جدول الكشف
    const container = document.getElementById('report-content');
    const account = accountsCache.find(a => a.id === accountId);
    
    let html = `
      <div class="text-center mb-8 border-b pb-4">
        <h2 class="text-2xl font-bold mb-2">كشف حساب</h2>
        <p class="text-xl">${account?.name}</p>
        <p class="text-gray-500">${from} إلى ${to}</p>
      </div>
      <table class="w-full border-collapse">
        <thead>
          <tr class="bg-gray-100 border-b-2 border-gray-300">
            <th class="p-3 text-right">التاريخ</th>
            <th class="p-3 text-right">النوع</th>
            <th class="p-3 text-right">الكمية</th>
            <th class="p-3 text-right">المبلغ</th>
            <th class="p-3 text-right">العملة</th>
            <th class="p-3 text-right">الرصيد التراكمي</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    let balance = 0;
    data?.forEach(op => {
      const change = (op.type === 'sell' || (op.type === 'payment' && op.direction === 'incoming')) ? op.amount : -op.amount;
      balance += change;
      
      html += `
        <tr class="border-b hover:bg-gray-50">
          <td class="p-3">${new Date(op.date).toLocaleDateString('ar-SY')}</td>
          <td class="p-3 ${op.type === 'sell' ? 'text-green-600' : 'text-red-600'}">${CONFIG.operationTypes[op.type]?.label}</td>
          <td class="p-3">${op.barrels || '-'}</td>
          <td class="p-3 font-bold">${op.amount}</td>
          <td class="p-3">${op.currency}</td>
          <td class="p-3 font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}">${balance.toFixed(2)}</td>
        </tr>
      `;
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }
};

// تهيئة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', initApp);