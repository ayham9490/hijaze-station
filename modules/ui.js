import { CURRENCY_LABELS, ROLES } from '../config.js';

const NAV_ITEMS = [
  { slug: 'dashboard', label: 'لوحة التحكم' },
  { slug: 'accounts', label: 'الحسابات' },
  { slug: 'transactions', label: 'العمليات المالية' },
  { slug: 'ledger', label: 'دفتر الأستاذ' },
  { slug: 'reports', label: 'التقارير' },
  { slug: 'settings', label: 'الإعدادات' }
];

const isInsidePages = () => window.location.pathname.replace('\\', '/').includes('/pages/');

const toPageLink = (slug) => {
  if (isInsidePages()) {
    return `./${slug}.html`;
  }
  return `./pages/${slug}.html`;
};

export const getIndexPath = () => (isInsidePages() ? '../index.html' : './index.html');

export const renderNavigation = () => {
  const nav = document.querySelector('[data-nav]');
  if (!nav) {
    return;
  }

  const currentPage = (document.body.dataset.page || '').trim();
  const linksHtml = NAV_ITEMS.map((item) => {
    const isActive = item.slug === currentPage ? 'active' : '';
    return `<a class="${isActive}" href="${toPageLink(item.slug)}">${item.label}</a>`;
  }).join('');

  nav.innerHTML = `
    <div class="nav-title">القائمة الرئيسية</div>
    ${linksHtml}
  `;
};

export const setUserSummary = (email, roleKey) => {
  const node = document.querySelector('[data-user]');
  if (!node) {
    return;
  }
  const roleLabel = ROLES[roleKey] || ROLES.viewer;
  if (!email) {
    node.textContent = `الدور الحالي: ${roleLabel}`;
    return;
  }
  node.textContent = `${email} - ${roleLabel}`;
};

export const showToast = (message, isError = false) => {
  const toast = document.querySelector('[data-toast]');
  if (!toast) {
    return;
  }
  toast.textContent = String(message || '');
  toast.classList.toggle('error', Boolean(isError));
  toast.classList.add('animate');
  window.setTimeout(() => {
    toast.classList.remove('animate');
  }, 300);
};

export const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const formatCurrency = (amount, currency = 'USD') => {
  const safeNumber = Number(amount);
  const value = Number.isFinite(safeNumber) ? safeNumber : 0;
  try {
    return new Intl.NumberFormat('ar', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch (error) {
    return `${value.toFixed(2)} ${currency}`;
  }
};

export const formatDate = (dateValue) => {
  if (!dateValue) {
    return '-';
  }
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('ar', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
};

const renderCell = (cell) => {
  if (cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'html')) {
    return String(cell.html);
  }
  return escapeHtml(cell);
};

export const buildTable = (headers, rows, emptyMessage = 'لا توجد بيانات متاحة.') => {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (safeRows.length === 0) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  const headerHtml = headers.map((head) => `<th>${escapeHtml(head)}</th>`).join('');
  const bodyHtml = safeRows
    .map((row) => `<tr>${row.map((cell) => `<td>${renderCell(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>${headerHtml}</tr>
        </thead>
        <tbody>
          ${bodyHtml}
        </tbody>
      </table>
    </div>
  `;
};

export const toCurrencyOptions = (selected = 'USD') => {
  return Object.entries(CURRENCY_LABELS)
    .map(([code, label]) => {
      const isSelected = code === selected ? 'selected' : '';
      return `<option value="${code}" ${isSelected}>${label}</option>`;
    })
    .join('');
};

export const exportCSV = (filename, headers, rows) => {
  const csvRows = [headers, ...rows].map((row) => {
    return row
      .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
      .join(',');
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const exportExcel = (filename, html) => {
  const content = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"></head><body>${html}</body></html>`;
  const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

export const printHtml = (title, html) => {
  const popup = window.open('', '_blank', 'width=1100,height=800');
  if (!popup) {
    return;
  }
  popup.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: 'Amiri', serif; margin: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #dcd6cb; padding: 8px; text-align: right; }
          h2 { margin-top: 0; }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(title)}</h2>
        ${html}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
};

export const drawBarChart = (canvas, labels, values) => {
  if (!canvas) {
    return;
  }
  const safeValues = values.map((value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  });

  const context = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(Math.floor(rect.width * dpr), 1);
  const height = Math.max(Math.floor(rect.height * dpr), 1);

  canvas.width = width;
  canvas.height = height;

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#f8f4ed';
  context.fillRect(0, 0, width, height);

  const maxValue = Math.max(...safeValues, 1);
  const barAreaHeight = height - 68 * dpr;
  const step = width / Math.max(labels.length, 1);
  const barWidth = step * 0.46;

  safeValues.forEach((value, index) => {
    const x = step * index + (step - barWidth) / 2;
    const barHeight = (value / maxValue) * barAreaHeight;
    const y = barAreaHeight - barHeight + 20 * dpr;

    context.fillStyle = '#1f6f5f';
    context.fillRect(x, y, barWidth, barHeight);

    context.fillStyle = '#18342d';
    context.font = `${13 * dpr}px Amiri`;
    context.textAlign = 'center';
    context.fillText(labels[index], x + barWidth / 2, height - 24 * dpr);

    context.font = `${12 * dpr}px Amiri`;
    context.fillText(formatCurrency(value, 'USD'), x + barWidth / 2, y - 6 * dpr);
  });
};

export const applyActionPermissions = (canUseAction) => {
  const actionNodes = document.querySelectorAll('[data-action]');
  actionNodes.forEach((node) => {
    const action = node.getAttribute('data-action');
    if (!action) {
      return;
    }
    const allowed = canUseAction(action);
    if (!allowed) {
      node.setAttribute('disabled', 'disabled');
      node.classList.add('ghost');
    } else {
      node.removeAttribute('disabled');
      node.classList.remove('ghost');
    }
  });
};

export const setSelectOptions = (selectElement, options, valueKey = 'value', labelKey = 'label') => {
  if (!selectElement) {
    return;
  }
  const html = options
    .map((item) => `<option value="${escapeHtml(item[valueKey])}">${escapeHtml(item[labelKey])}</option>`)
    .join('');
  selectElement.innerHTML = html;
};
