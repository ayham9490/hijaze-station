import {
  ACCOUNT_TYPES,
  ROLES,
  ROLE_OPTIONS,
  getSupabaseConfig,
  isSupabaseConfigured,
  saveSupabaseConfig
} from './config.js';
import {
  renderNavigation,
  showToast,
  buildTable,
  formatCurrency,
  formatDate,
  drawBarChart,
  applyActionPermissions,
  toCurrencyOptions,
  setSelectOptions,
  exportCSV,
  exportExcel,
  printHtml
} from './modules/ui.js';
import {
  bindLoginForm,
  bindLogoutButtons,
  requireAuthenticatedPage,
  loadSession,
  canUseAction,
  ensureActionAllowed,
  listUsersWithRoles,
  updateUserRole,
  hydrateUserSummary
} from './modules/auth.js';
import { testSupabaseConnection, resetSupabaseClient } from './modules/supabase-client.js';
import {
  listSupportedCurrencies,
  getExchangeRates,
  updateExchangeRates,
  normalizeCurrency,
  convertByStoredRate
} from './modules/currency.js';
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount
} from './modules/accounts.js';
import {
  listTransactions,
  createTransaction,
  syncPendingTransactions,
  getPendingTransactions
} from './modules/transactions.js';
import {
  getDashboardData,
  getLedgerReport,
  getAccountsReport,
  getProfitLossReport,
  getTransactionsReport
} from './modules/reports.js';

const page = document.body.dataset.page || 'login';
const isPagesContext = window.location.pathname.replace('\\', '/').includes('/pages/');
const indexPath = isPagesContext ? '../index.html' : './index.html';
const dashboardPath = isPagesContext ? './dashboard.html' : './pages/dashboard.html';

const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const swPath = isPagesContext ? '../service-worker.js' : './service-worker.js';
  const scope = isPagesContext ? '../' : './';

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swPath, { scope }).catch(() => {
      // لا نمنع تحميل التطبيق في حال فشل التسجيل.
    });
  });
};

const bindSupabaseForm = (formId, requirePermission = false) => {
  const form = document.getElementById(formId);
  if (!form) {
    return;
  }

  const initial = getSupabaseConfig();
  form.querySelector('[name="url"]').value = initial.url;
  form.querySelector('[name="key"]').value = initial.anonKey;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (requirePermission && !ensureActionAllowed('settings:update')) {
      return;
    }

    const formData = new FormData(form);
    const url = String(formData.get('url') || '').trim();
    const key = String(formData.get('key') || '').trim();

    if (!url || !key) {
      showToast('يرجى إدخال رابط ومفتاح Supabase.', true);
      return;
    }

    saveSupabaseConfig(url, key);
    resetSupabaseClient();

    const test = await testSupabaseConnection();
    showToast(test.message, !test.ok);
  });
};

const setupCurrencySelect = (select, includeAll = false) => {
  if (!select) {
    return;
  }
  const options = listSupportedCurrencies();
  const allOption = includeAll ? '<option value="ALL">كل العملات</option>' : '';
  const html = options
    .map((item) => `<option value="${item.code}">${item.label}</option>`)
    .join('');
  select.innerHTML = `${allOption}${html}`;
};

const renderDashboard = async () => {
  const response = await getDashboardData();
  if (!response.ok) {
    showToast(response.message, true);
    return;
  }

  const data = response.data;
  const pendingCount = getPendingTransactions().length;

  const totalNode = document.getElementById('dashboard-total-balances');
  const countNode = document.getElementById('dashboard-account-count');
  const monthTxNode = document.getElementById('dashboard-month-transactions');
  const pendingNode = document.getElementById('dashboard-pending-sync');

  if (totalNode) {
    totalNode.textContent = formatCurrency(data.balancesUsd, 'USD');
  }
  if (countNode) {
    countNode.textContent = String(data.accounts.length);
  }
  if (monthTxNode) {
    monthTxNode.textContent = String(data.monthTransactionsCount);
  }
  if (pendingNode) {
    pendingNode.textContent = String(pendingCount);
  }

  const latestRows = data.latestTransactions.map((transaction) => [
    formatDate(transaction.date),
    transaction.description,
    transaction.debit_account_name,
    transaction.credit_account_name,
    formatCurrency(transaction.amount, transaction.currency),
    formatCurrency(transaction.converted_usd, 'USD')
  ]);

  const latestNode = document.getElementById('dashboard-latest-table');
  if (latestNode) {
    latestNode.innerHTML = buildTable(
      ['التاريخ', 'الوصف', 'الحساب المدين', 'الحساب الدائن', 'المبلغ', 'القيمة بالدولار'],
      latestRows,
      'لا توجد عمليات بعد.'
    );
  }

  const summaryRows = Object.entries(data.accountSummary).map(([type, summary]) => {
    return [
      type,
      summary.count,
      formatCurrency(summary.balanceUsd, 'USD')
    ];
  });

  const summaryNode = document.getElementById('dashboard-account-summary');
  if (summaryNode) {
    summaryNode.innerHTML = buildTable(
      ['نوع الحساب', 'عدد الحسابات', 'الرصيد الإجمالي بالدولار'],
      summaryRows,
      'لا يوجد تلخيص متاح.'
    );
  }

  drawBarChart(
    document.getElementById('dashboard-chart'),
    ['الإيرادات', 'المصروفات', 'الصافي'],
    [data.profitLoss.revenue, data.profitLoss.expenses, data.profitLoss.netProfit]
  );
};

const renderAccountsPage = async () => {
  const form = document.getElementById('account-form');
  const tableNode = document.getElementById('accounts-table');
  const typeSelect = form?.querySelector('[name="type"]');
  const currencySelect = form?.querySelector('[name="currency"]');
  const editingInput = form?.querySelector('[name="editing_id"]');
  const submitButton = form?.querySelector('button[type="submit"]');
  const cancelButton = document.getElementById('cancel-account-edit');

  if (!form || !tableNode || !typeSelect || !currencySelect || !editingInput || !submitButton || !cancelButton) {
    return;
  }

  typeSelect.innerHTML = ACCOUNT_TYPES.map((type) => `<option value="${type}">${type}</option>`).join('');
  currencySelect.innerHTML = toCurrencyOptions('USD');

  const resetForm = () => {
    form.reset();
    currencySelect.value = 'USD';
    typeSelect.value = ACCOUNT_TYPES[0];
    editingInput.value = '';
    submitButton.textContent = 'حفظ الحساب';
    cancelButton.hidden = true;
  };

  const loadTable = async () => {
    const response = await listAccounts();
    if (!response.ok) {
      showToast(response.message, true);
      tableNode.innerHTML = buildTable([], [], 'تعذر تحميل الحسابات.');
      return;
    }

    const rows = response.data.map((account) => {
      return [
        account.name,
        account.type,
        account.currency,
        formatCurrency(account.balance, account.currency),
        formatCurrency(convertByStoredRate(account.balance, account.currency), 'USD'),
        {
          html: `
            <div class="row-actions">
              <button type="button" class="secondary small" data-action="accounts:update" data-account-edit="${account.id}">تعديل</button>
              <button type="button" class="danger small" data-action="accounts:delete" data-account-delete="${account.id}">حذف</button>
            </div>
          `
        }
      ];
    });

    tableNode.innerHTML = buildTable(
      ['اسم الحساب', 'النوع', 'العملة', 'الرصيد', 'تقديري بالدولار', 'الإجراءات'],
      rows,
      'لا توجد حسابات مضافة حاليًا.'
    );

    applyActionPermissions(canUseAction);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const editingId = String(editingInput.value || '').trim();

    const action = editingId ? 'accounts:update' : 'accounts:create';
    if (!ensureActionAllowed(action)) {
      return;
    }

    const data = new FormData(form);
    const payload = {
      name: data.get('name'),
      type: data.get('type'),
      currency: data.get('currency'),
      balance: data.get('balance')
    };

    const result = editingId
      ? await updateAccount(editingId, payload)
      : await createAccount(payload);

    showToast(result.message, !result.ok);
    if (!result.ok) {
      return;
    }

    resetForm();
    await loadTable();
  });

  tableNode.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const editId = target.getAttribute('data-account-edit');
    if (editId) {
      if (!ensureActionAllowed('accounts:update')) {
        return;
      }
      const response = await listAccounts();
      if (!response.ok) {
        showToast(response.message, true);
        return;
      }
      const account = response.data.find((item) => item.id === editId);
      if (!account) {
        showToast('تعذر تحميل بيانات الحساب المطلوب.', true);
        return;
      }
      form.querySelector('[name="name"]').value = account.name;
      form.querySelector('[name="type"]').value = account.type;
      form.querySelector('[name="currency"]').value = account.currency;
      form.querySelector('[name="balance"]').value = account.balance;
      editingInput.value = account.id;
      submitButton.textContent = 'تحديث الحساب';
      cancelButton.hidden = false;
      return;
    }

    const deleteId = target.getAttribute('data-account-delete');
    if (deleteId) {
      if (!ensureActionAllowed('accounts:delete')) {
        return;
      }
      if (!window.confirm('هل أنت متأكد من حذف هذا الحساب؟')) {
        return;
      }
      const result = await deleteAccount(deleteId);
      showToast(result.message, !result.ok);
      if (result.ok) {
        await loadTable();
      }
    }
  });

  cancelButton.addEventListener('click', () => {
    resetForm();
  });

  resetForm();
  await loadTable();
};

const renderTransactionsPage = async () => {
  const form = document.getElementById('transaction-form');
  const tableNode = document.getElementById('transactions-table');
  const syncButton = document.getElementById('sync-transactions-btn');
  const pendingNode = document.getElementById('pending-transactions-count');

  if (!form || !tableNode || !syncButton || !pendingNode) {
    return;
  }

  const debitSelect = form.querySelector('[name="debit_account"]');
  const creditSelect = form.querySelector('[name="credit_account"]');
  const currencySelect = form.querySelector('[name="currency"]');
  const rateInput = form.querySelector('[name="exchange_rate"]');
  const dateInput = form.querySelector('[name="date"]');

  if (!debitSelect || !creditSelect || !currencySelect || !rateInput || !dateInput) {
    return;
  }

  setupCurrencySelect(currencySelect);

  const refreshPendingCount = () => {
    pendingNode.textContent = String(getPendingTransactions().length);
  };

  const toggleRateInput = () => {
    const code = normalizeCurrency(currencySelect.value);
    if (code === 'USD') {
      rateInput.value = '1';
      rateInput.setAttribute('readonly', 'readonly');
    } else {
      rateInput.removeAttribute('readonly');
      if (!Number(rateInput.value)) {
        rateInput.value = '';
      }
    }
  };

  const loadAccountOptions = async () => {
    const response = await listAccounts();
    if (!response.ok) {
      showToast(response.message, true);
      return;
    }

    const optionsHtml = response.data
      .map((account) => `<option value="${account.id}">${account.name} (${account.currency})</option>`)
      .join('');

    debitSelect.innerHTML = optionsHtml;
    creditSelect.innerHTML = optionsHtml;
  };

  const loadTransactionsTable = async () => {
    const response = await listTransactions();
    if (!response.ok) {
      showToast(response.message, true);
      tableNode.innerHTML = buildTable([], [], 'تعذر تحميل العمليات.');
      return;
    }

    const rows = response.data.map((transaction) => [
      formatDate(transaction.date),
      transaction.description,
      transaction.debit_account_name,
      transaction.credit_account_name,
      formatCurrency(transaction.amount, transaction.currency),
      transaction.exchange_rate,
      formatCurrency(transaction.converted_usd, 'USD')
    ]);

    tableNode.innerHTML = buildTable(
      ['التاريخ', 'الوصف', 'المدين', 'الدائن', 'المبلغ', 'سعر الصرف', 'بالدولار'],
      rows,
      'لا توجد عمليات مسجلة.'
    );
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!ensureActionAllowed('transactions:create')) {
      return;
    }

    const data = new FormData(form);
    const payload = {
      date: data.get('date'),
      description: data.get('description'),
      debit_account: data.get('debit_account'),
      credit_account: data.get('credit_account'),
      amount: data.get('amount'),
      currency: data.get('currency'),
      exchange_rate: data.get('exchange_rate')
    };

    const result = await createTransaction(payload);
    showToast(result.message, !result.ok);
    if (!result.ok) {
      refreshPendingCount();
      return;
    }

    form.querySelector('[name="description"]').value = '';
    form.querySelector('[name="amount"]').value = '';
    if (currencySelect.value !== 'USD') {
      form.querySelector('[name="exchange_rate"]').value = '';
    }

    await loadTransactionsTable();
    refreshPendingCount();
  });

  syncButton.addEventListener('click', async () => {
    if (!ensureActionAllowed('transactions:sync')) {
      return;
    }

    const result = await syncPendingTransactions();
    if (!result.ok) {
      showToast('تعذر مزامنة العمليات غير المتصلة.', true);
      return;
    }

    showToast(`تمت مزامنة ${result.synced} عملية، وتعذر مزامنة ${result.failed} عملية.`);
    refreshPendingCount();
    await loadTransactionsTable();
  });

  currencySelect.addEventListener('change', toggleRateInput);

  window.addEventListener('online', async () => {
    if (!canUseAction('transactions:sync')) {
      return;
    }
    const pendingCount = getPendingTransactions().length;
    if (pendingCount === 0) {
      return;
    }
    const result = await syncPendingTransactions();
    if (result.synced > 0) {
      showToast(`تمت مزامنة ${result.synced} عملية تلقائيًا بعد عودة الاتصال.`);
      refreshPendingCount();
      await loadTransactionsTable();
    }
  });

  dateInput.value = new Date().toISOString().slice(0, 10);
  toggleRateInput();
  await loadAccountOptions();
  await loadTransactionsTable();
  refreshPendingCount();
};

const renderLedgerPage = async () => {
  const filterSelect = document.getElementById('ledger-account-filter');
  const applyButton = document.getElementById('ledger-apply-filter');
  const container = document.getElementById('ledger-results');

  if (!filterSelect || !applyButton || !container) {
    return;
  }

  const loadFilterOptions = async () => {
    const response = await listAccounts();
    if (!response.ok) {
      showToast(response.message, true);
      return;
    }

    const options = [
      { value: '', label: 'كل الحسابات' },
      ...response.data.map((account) => ({
        value: account.id,
        label: `${account.name} (${account.currency})`
      }))
    ];
    setSelectOptions(filterSelect, options);
  };

  const renderLedger = async () => {
    const accountId = String(filterSelect.value || '').trim();
    const response = await getLedgerReport(accountId);
    if (!response.ok) {
      showToast(response.message, true);
      container.innerHTML = '<div class="empty-state">تعذر تحميل دفتر الأستاذ.</div>';
      return;
    }

    if (response.data.length === 0) {
      container.innerHTML = '<div class="empty-state">لا توجد بيانات لعرضها.</div>';
      return;
    }

    const html = response.data
      .map((block) => {
        const rows = block.rows.map((row) => [
          formatDate(row.date),
          row.description,
          row.side,
          formatCurrency(row.amount, row.currency),
          formatCurrency(row.delta, block.account.currency),
          formatCurrency(row.runningBalance, block.account.currency)
        ]);

        return `
          <article class="card ledger-card">
            <h3>${block.account.name} <span class="badge">${block.account.currency}</span></h3>
            <p class="subline">الرصيد الافتتاحي: ${formatCurrency(block.openingBalance, block.account.currency)} | الرصيد الحالي: ${formatCurrency(block.currentBalance, block.account.currency)}</p>
            ${buildTable(
              ['التاريخ', 'الوصف', 'الجانب', 'قيمة القيد', 'تأثير القيد', 'الرصيد الجاري'],
              rows,
              'لا توجد حركات لهذا الحساب.'
            )}
          </article>
        `;
      })
      .join('');

    container.innerHTML = html;
  };

  applyButton.addEventListener('click', async () => {
    await renderLedger();
  });

  await loadFilterOptions();
  await renderLedger();
};

const renderReportsPage = async () => {
  const accountsNode = document.getElementById('report-accounts');
  const profitLossNode = document.getElementById('report-profit-loss');
  const transactionsNode = document.getElementById('report-transactions');
  const applyFiltersButton = document.getElementById('report-apply-filters');
  const exportCsvButton = document.getElementById('report-export-csv');
  const exportExcelButton = document.getElementById('report-export-excel');
  const printButton = document.getElementById('report-print');
  const dateFromInput = document.getElementById('report-date-from');
  const dateToInput = document.getElementById('report-date-to');
  const currencyFilter = document.getElementById('report-currency-filter');

  if (
    !accountsNode ||
    !profitLossNode ||
    !transactionsNode ||
    !applyFiltersButton ||
    !exportCsvButton ||
    !exportExcelButton ||
    !printButton ||
    !dateFromInput ||
    !dateToInput ||
    !currencyFilter
  ) {
    return;
  }

  setupCurrencySelect(currencyFilter, true);

  const state = {
    transactionsRows: [],
    transactionsHeaders: ['التاريخ', 'الوصف', 'الحساب المدين', 'الحساب الدائن', 'المبلغ', 'بالدولار'],
    exportHtml: ''
  };

  const loadReports = async () => {
    const accountsResponse = await getAccountsReport();
    if (!accountsResponse.ok) {
      showToast(accountsResponse.message, true);
      return;
    }

    const profitLossResponse = await getProfitLossReport();
    if (!profitLossResponse.ok) {
      showToast(profitLossResponse.message, true);
      return;
    }

    const transactionsResponse = await getTransactionsReport({
      dateFrom: dateFromInput.value,
      dateTo: dateToInput.value,
      currency: currencyFilter.value
    });

    if (!transactionsResponse.ok) {
      showToast(transactionsResponse.message, true);
      return;
    }

    const accountRows = accountsResponse.data.map((account) => [
      account.name,
      account.type,
      account.currency,
      formatCurrency(account.balance, account.currency),
      formatCurrency(account.converted_usd, 'USD')
    ]);

    const accountsHtml = buildTable(
      ['اسم الحساب', 'النوع', 'العملة', 'الرصيد', 'مكافئ بالدولار'],
      accountRows,
      'لا توجد حسابات.'
    );
    accountsNode.innerHTML = accountsHtml;

    const pl = profitLossResponse.data;
    const plRows = [
      ['إجمالي الإيرادات', formatCurrency(pl.revenue, 'USD')],
      ['إجمالي المصروفات', formatCurrency(pl.expenses, 'USD')],
      ['صافي الربح', formatCurrency(pl.netProfit, 'USD')],
      ['عدد العمليات', pl.transactionsCount]
    ];

    const profitLossHtml = buildTable(['البند', 'القيمة'], plRows, 'لا توجد بيانات.');
    profitLossNode.innerHTML = profitLossHtml;

    state.transactionsRows = transactionsResponse.data.map((transaction) => [
      formatDate(transaction.date),
      transaction.description,
      transaction.debit_account_name,
      transaction.credit_account_name,
      formatCurrency(transaction.amount, transaction.currency),
      formatCurrency(transaction.converted_usd, 'USD')
    ]);

    const transactionsHtml = buildTable(state.transactionsHeaders, state.transactionsRows, 'لا توجد عمليات ضمن الفلاتر المحددة.');
    transactionsNode.innerHTML = transactionsHtml;

    state.exportHtml = `
      <h3>تقرير الحسابات</h3>
      ${accountsHtml}
      <h3>تقرير الأرباح والخسائر</h3>
      ${profitLossHtml}
      <h3>تقرير العمليات</h3>
      ${transactionsHtml}
    `;
  };

  applyFiltersButton.addEventListener('click', async () => {
    await loadReports();
  });

  exportCsvButton.addEventListener('click', () => {
    if (!ensureActionAllowed('reports:export')) {
      return;
    }
    exportCSV('transaction-report.csv', state.transactionsHeaders, state.transactionsRows);
  });

  exportExcelButton.addEventListener('click', () => {
    if (!ensureActionAllowed('reports:export')) {
      return;
    }
    exportExcel('financial-reports.xls', state.exportHtml || '<p>لا توجد بيانات.</p>');
  });

  printButton.addEventListener('click', () => {
    if (!ensureActionAllowed('reports:export')) {
      return;
    }
    printHtml('التقارير المالية', state.exportHtml || '<p>لا توجد بيانات.</p>');
  });

  await loadReports();
};

const renderSettingsPage = async () => {
  bindSupabaseForm('settings-supabase-form', true);

  const ratesForm = document.getElementById('exchange-rates-form');
  const usersTableNode = document.getElementById('settings-users-table');
  const roleForm = document.getElementById('user-role-form');
  const roleSelect = roleForm?.querySelector('[name="role"]');
  const userSelect = roleForm?.querySelector('[name="user_id"]');

  if (!ratesForm || !usersTableNode || !roleForm || !roleSelect || !userSelect) {
    return;
  }

  roleSelect.innerHTML = ROLE_OPTIONS.map((role) => {
    const label = ROLES[role] || role;
    return `<option value="${role}">${label}</option>`;
  }).join('');

  const fillExchangeRates = () => {
    const rates = getExchangeRates();
    ratesForm.querySelector('[name="USD"]').value = rates.USD;
    ratesForm.querySelector('[name="EUR"]').value = rates.EUR;
    ratesForm.querySelector('[name="TRY"]').value = rates.TRY;
    ratesForm.querySelector('[name="SYP"]').value = rates.SYP;
  };

  ratesForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!ensureActionAllowed('settings:update')) {
      return;
    }

    const formData = new FormData(ratesForm);
    const rates = {
      USD: formData.get('USD'),
      EUR: formData.get('EUR'),
      TRY: formData.get('TRY'),
      SYP: formData.get('SYP')
    };

    updateExchangeRates(rates);
    showToast('تم حفظ أسعار الصرف الافتراضية بنجاح.');
  });

  const loadUsers = async () => {
    const response = await listUsersWithRoles();
    if (!response.ok) {
      showToast(response.message, true);
      usersTableNode.innerHTML = '<div class="empty-state">تعذر تحميل المستخدمين.</div>';
      return;
    }

    userSelect.innerHTML = response.data
      .map((user) => `<option value="${user.id}">${user.email}</option>`)
      .join('');

    const rows = response.data.map((user) => [
      user.email,
      user.role_label,
      formatDate(user.created_at)
    ]);

    usersTableNode.innerHTML = buildTable(
      ['البريد الإلكتروني', 'الدور', 'تاريخ الإنشاء'],
      rows,
      'لا توجد بيانات مستخدمين.'
    );
  };

  roleForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!ensureActionAllowed('users:role:update')) {
      return;
    }

    const formData = new FormData(roleForm);
    const result = await updateUserRole(formData.get('user_id'), formData.get('role'));
    showToast(result.message, !result.ok);
    if (result.ok) {
      await loadUsers();
      hydrateUserSummary();
    }
  });

  fillExchangeRates();
  await loadUsers();
};

const initLoginPage = async () => {
  bindLoginForm();
  bindSupabaseForm('login-supabase-form');

  if (!isSupabaseConfigured()) {
    showToast('أدخل بيانات Supabase ثم سجّل الدخول للمتابعة.');
    return;
  }

  const session = await loadSession();
  if (session.ok && session.user) {
    window.location.href = dashboardPath;
  }
};

const initProtectedPages = async () => {
  renderNavigation();
  bindLogoutButtons();

  const authenticated = await requireAuthenticatedPage();
  if (!authenticated) {
    return false;
  }

  applyActionPermissions(canUseAction);
  return true;
};

const boot = async () => {
  registerServiceWorker();

  if (page === 'login') {
    await initLoginPage();
    return;
  }

  if (!isSupabaseConfigured()) {
    showToast('يلزم ضبط بيانات Supabase قبل متابعة العمل.', true);
    window.location.href = indexPath;
    return;
  }

  const canContinue = await initProtectedPages();
  if (!canContinue) {
    return;
  }

  if (page === 'dashboard') {
    await renderDashboard();
    return;
  }
  if (page === 'accounts') {
    await renderAccountsPage();
    return;
  }
  if (page === 'transactions') {
    await renderTransactionsPage();
    return;
  }
  if (page === 'ledger') {
    await renderLedgerPage();
    return;
  }
  if (page === 'reports') {
    await renderReportsPage();
    return;
  }
  if (page === 'settings') {
    await renderSettingsPage();
  }
};

boot().catch(() => {
  showToast('حدث خطأ غير متوقع أثناء تشغيل النظام.', true);
});
