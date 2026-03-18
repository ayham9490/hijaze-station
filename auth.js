import { ROLE_OPTIONS } from '../config.js';
import { getSupabaseClient, mapSupabaseError } from './supabase-client.js';
import { getIndexPath, setUserSummary, showToast } from './ui.js';

const ACTION_POLICY = {
  'accounts:create': ['admin', 'accountant'],
  'accounts:update': ['admin', 'accountant'],
  'accounts:delete': ['admin'],
  'transactions:create': ['admin', 'accountant'],
  'transactions:sync': ['admin', 'accountant'],
  'users:role:update': ['admin'],
  'reports:export': ['admin', 'accountant', 'viewer'],
  'settings:update': ['admin']
};

let currentUser = null;
let currentRole = 'viewer';

const normalizeRole = (role) => {
  const value = String(role || '').trim();
  return ROLE_OPTIONS.includes(value) ? value : 'viewer';
};

const extractRoleLabel = (roleKey) => {
  if (roleKey === 'admin') {
    return 'مدير';
  }
  if (roleKey === 'accountant') {
    return 'محاسب';
  }
  return 'مشاهد';
};

export const getRoleLabel = () => extractRoleLabel(currentRole);

export const getCurrentRole = () => currentRole;

export const getCurrentUser = () => currentUser;

export const canUseAction = (action) => {
  const allowedRoles = ACTION_POLICY[action];
  if (!allowedRoles) {
    return true;
  }
  return allowedRoles.includes(currentRole);
};

export const ensureActionAllowed = (action) => {
  const allowed = canUseAction(action);
  if (!allowed) {
    showToast('صلاحياتك الحالية لا تسمح بتنفيذ هذا الإجراء.', true);
  }
  return allowed;
};

const ensureUserRecord = async (user) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('USERS')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      let assignedRole = 'viewer';
      const { count, error: countError } = await supabase
        .from('USERS')
        .select('id', { head: true, count: 'exact' });

      if (!countError && Number(count) === 0) {
        assignedRole = 'admin';
      }

      const payload = {
        id: user.id,
        email: user.email,
        role: assignedRole
      };
      const { error: insertError } = await supabase.from('USERS').insert([payload]);
      if (insertError) {
        throw insertError;
      }
      currentRole = assignedRole;
      return;
    }

    currentRole = normalizeRole(data.role);
  } catch (error) {
    throw new Error(mapSupabaseError(error, 'تعذر تجهيز سجل المستخدم في قاعدة البيانات.'));
  }
};

export const loadSession = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    currentUser = data.session?.user || null;
    if (!currentUser) {
      currentRole = 'viewer';
      setUserSummary('', currentRole);
      return { ok: true, user: null, role: currentRole };
    }

    await ensureUserRecord(currentUser);
    setUserSummary(currentUser.email, currentRole);
    return { ok: true, user: currentUser, role: currentRole };
  } catch (error) {
    currentUser = null;
    currentRole = 'viewer';
    setUserSummary('', currentRole);
    return {
      ok: false,
      user: null,
      role: currentRole,
      message: mapSupabaseError(error, 'تعذر قراءة جلسة المستخدم الحالية.')
    };
  }
};

export const requireAuthenticatedPage = async () => {
  const session = await loadSession();
  if (!session.ok || !session.user) {
    window.location.href = getIndexPath();
    return false;
  }
  return true;
};

export const bindLoginForm = () => {
  const form = document.getElementById('login-form');
  if (!form) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '').trim();
    const submitter = event.submitter;
    const action = submitter?.getAttribute('data-auth-action') || 'login';

    if (!email || !password) {
      showToast('يرجى إدخال البريد الإلكتروني وكلمة المرور.', true);
      return;
    }
    if (password.length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', true);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      if (action === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          throw error;
        }
        if (data.session) {
          showToast('تم إنشاء الحساب وتسجيل الدخول مباشرة.');
          window.location.href = './pages/dashboard.html';
          return;
        }
        showToast('تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.');
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        throw error;
      }
      showToast('تم تسجيل الدخول بنجاح.');
      window.location.href = './pages/dashboard.html';
    } catch (error) {
      const fallback = action === 'signup'
        ? 'فشل إنشاء الحساب. تحقق من إعدادات Supabase.'
        : 'فشل تسجيل الدخول. تحقق من البيانات.';
      showToast(mapSupabaseError(error, fallback), true);
    }
  });
};

export const bindLogoutButtons = () => {
  const logoutButtons = document.querySelectorAll('[data-logout]');
  if (logoutButtons.length === 0) {
    return;
  }

  logoutButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      } catch (error) {
        showToast(mapSupabaseError(error, 'تعذر تسجيل الخروج الآن.'), true);
      } finally {
        window.location.href = getIndexPath();
      }
    });
  });
};

export const listUsersWithRoles = async () => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('USERS')
      .select('id, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const normalized = (data || []).map((item) => ({
      ...item,
      role: normalizeRole(item.role),
      role_label: extractRoleLabel(item.role)
    }));

    return { ok: true, data: normalized };
  } catch (error) {
    return { ok: false, data: [], message: mapSupabaseError(error, 'تعذر تحميل قائمة المستخدمين.') };
  }
};

export const updateUserRole = async (userId, role) => {
  try {
    const normalizedRole = normalizeRole(role);
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
      return { ok: false, message: 'معرف المستخدم غير صالح.' };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('USERS')
      .update({ role: normalizedRole })
      .eq('id', safeUserId);

    if (error) {
      throw error;
    }

    if (currentUser && currentUser.id === safeUserId) {
      currentRole = normalizedRole;
      setUserSummary(currentUser.email, currentRole);
    }

    return { ok: true, message: 'تم تحديث الدور بنجاح.' };
  } catch (error) {
    return { ok: false, message: mapSupabaseError(error, 'تعذر تحديث دور المستخدم.') };
  }
};

export const hydrateUserSummary = () => {
  if (!currentUser) {
    setUserSummary('', currentRole);
    return;
  }
  setUserSummary(currentUser.email, currentRole);
};
