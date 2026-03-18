const navLinks = [
  { href: './pages/dashboard.html', label: 'لوحة التحكم' },
  { href: './pages/accounts.html', label: 'الحسابات' },
  { href: './pages/transactions.html', label: 'العمليات المالية' },
  { href: './pages/ledger.html', label: 'دفتر الأستاذ' },
  { href: './pages/reports.html', label: 'التقارير' },
  { href: './pages/settings.html', label: 'الإعدادات' }
];

export const initUI = () => {
  const nav = document.querySelector('nav[data-nav]');
  if (nav) {
    nav.innerHTML = `
      <div class="nav-title">التنقل</div>
      ${navLinks.map(link => `<a href="${link.href}">${link.label}</a>`).join('')}
    `;
    const current = window.location.pathname.split('/').pop();
    const anchors = nav.querySelectorAll('a');
    anchors.forEach(anchor => {
      if (anchor.getAttribute('href').includes(current)) {
        anchor.classList.add('active');
      }
    });
  }
};

export const showToast = (message, isError = false) => {
  const container = document.querySelector('[data-toast]');
  if (!container) return;
  container.textContent = message;
  container.classList.toggle('error', isError);
  container.classList.add('animate');
  setTimeout(() => container.classList.remove('animate'), 400);
};

export const formatMoney = (amount, currency = 'USD') => {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('ar', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(safe);
};

export const buildTable = (headers, rows) => {
  const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const tbody = rows
    .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');
  return `<table class="table">${thead}${tbody}</table>`;
};

export const downloadCSV = (filename, headers, rows) => {
  const csv = [headers, ...rows].map(row => row.map(item => `"${String(item).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const downloadExcel = (filename, tableHtml) => {
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><meta charset="utf-8"><body>${tableHtml}</body></html>`;
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const drawBarChart = (canvas, labels, values) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth * devicePixelRatio;
  const height = canvas.height = canvas.offsetHeight * devicePixelRatio;
  ctx.clearRect(0, 0, width, height);
  const max = Math.max(...values, 1);
  const barWidth = width / (values.length * 2);
  values.forEach((value, i) => {
    const x = barWidth + i * barWidth * 2;
    const barHeight = (value / max) * (height * 0.7);
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(x, height - barHeight - 30, barWidth, barHeight);
    ctx.fillStyle = '#1b1a17';
    ctx.font = `${12 * devicePixelRatio}px Amiri`;
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barWidth / 2, height - 10);
  });
};
