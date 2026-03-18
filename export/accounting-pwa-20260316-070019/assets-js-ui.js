/**
 * إدارة واجهة المستخدم والتفاعلات
 */

import { CONFIG } from './config.js';

/**
 * إظهار رسالة تنبيه
 */
export function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-yellow-500',
    info: 'blue-500'
  };
  
  toast.className = `toast ${colors[type] || colors.info} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2`;
  toast.innerHTML = `
    <span>${message}</span>
    <button onclick="this.parentElement.remove()" class="mr-2 hover:text-gray-200">×</button>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    if (toast.parentElement) {
      toast.remove();
    }
  }, 5000);
}

/**
 * تغيير الحقول حسب نوع العملية
 */
export function toggleOperationFields(type) {
  const fuelFields = document.getElementById('fuel-fields');
  const directionField = document.getElementById('direction-field');
  const accountField = document.getElementById('account-field');
  const exchangeField = document.getElementById('exchange-rate-field');
  
  // إعادة تعيين الحقول
  if (fuelFields) fuelFields.classList.add('hidden');
  if (directionField) directionField.classList.add('hidden');
  if (accountField) accountField.classList.remove('hidden');
  
  switch(type) {
    case 'sell':
    case 'buy':
      if (fuelFields) fuelFields.classList.remove('hidden');
      break;
      
    case 'payment':
      if (directionField) directionField.classList.remove('hidden');
      break;
      
    case 'expense':
      if (accountField) accountField.classList.add('hidden');
      break;
  }
}

/**
 * حساب البراميل تلقائياً
 */
export function calculateBarrels() {
  const weight = parseFloat(document.getElementById('op-weight')?.value) || 0;
  const density = parseFloat(document.getElementById('op-density')?.value) || 0.835;
  
  if (weight > 0 && density > 0) {
    const barrels = (weight / density / 220).toFixed(2);
    const display = document.getElementById('calculated-barrels');
    if (display) {
      display.textContent = barrels;
    }
    return barrels;
  }
  return 0;
}

/**
 * تحديث الواجهة عند تغيير العملة
 */
export function handleCurrencyChange(currency) {
  const exchangeField = document.getElementById('exchange-rate-field');
  const exchangeInput = document.getElementById('op-exchange-rate');
  
  if (currency === 'USD') {
    exchangeField?.classList.add('hidden');
    if (exchangeInput) exchangeInput.value = 1;
  } else {
    exchangeField?.classList.remove('hidden');
    const rate = CONFIG.currencies[currency]?.rate || 1;
    if (exchangeInput) exchangeInput.value = rate;
  }
}

/**
 * بناء جدول العمليات
 */
export function renderOperationsList(operations, containerId = 'operations-list') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  if (!operations || operations.length === 0) {
    container.innerHTML = '<div class="text-center text-gray-500 py-8">لا توجد عمليات مسجلة</div>';
    return;
  }
  
  container.innerHTML = operations.map(op => {
    const typeConfig = CONFIG.operationTypes[op.type] || {};
    return `
      <div class="flex items-center justify-between p-4 bg-white border-r-4 operation-type-${op.type} rounded-lg shadow-sm hover:shadow-md transition">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-${typeConfig.color}-100 text-${typeConfig.color}-600 flex items-center justify-center font-bold text-lg">
            ${typeConfig.icon}
          </div>
          <div>
            <p class="font-bold text-gray-800">${typeConfig.label} - ${op.account_name || 'غير محدد'}</p>
            <p class="text-sm text-gray-500">${new Date(op.date).toLocaleDateString('ar-SY')} | ${op.notes || ''}</p>
          </div>
        </div>
        <div class="text-left">
          <p class="font-bold text-lg ${op.type === 'sell' || (op.type === 'payment' && op.direction === 'incoming') ? 'text-green-600' : 'text-red-600'}">
            ${op.type === 'sell' || (op.type === 'payment' && op.direction === 'incoming') ? '+' : '-'}${op.amount} ${CONFIG.currencies[op.currency]?.symbol || op.currency}
          </p>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * التنقل بين الصفحات
 */
export function navigateTo(pageId) {
  // إخفاء كل الصفحات
  document.querySelectorAll('.page-content').forEach(page => {
    page.classList.add('hidden');
  });
  
  // إظهار الصفحة المطلوبة
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.remove('hidden');
  }
  
  // تحديث القائمة النشطة
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active', 'bg-blue-50', 'text-blue-600');
    if (item.dataset.page === pageId) {
      item.classList.add('active', 'bg-blue-50', 'text-blue-600');
    }
  });
  
  // إغلاق القائمة في الجوال
  if (window.innerWidth < 1024) {
    document.getElementById('sidebar')?.classList.add('translate-x-full');
  }
}

/**
 * عرض حالة التحميل
 */
export function setLoading(isLoading) {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.toggle('hidden', !isLoading);
  }
}