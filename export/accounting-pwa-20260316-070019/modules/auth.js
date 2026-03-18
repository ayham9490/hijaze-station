import { getSupabase } from './supabase-client.js';
import { showToast } from './ui.js';

let currentUser = null;
let currentRole = 'مشاهد';

export const initAuth = async () => {
  const loginForm = document.querySelector('[data-login]');
  const logoutBtn = document.querySelector('[data-logout]');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = loginForm.querySelector('input[name="email"]').value.trim();
      const password = loginForm.querySelector('input[name="password"]').value.trim();
      if (!email || !password) {
        showToast('يرجى إدخال البريد وكلمة المرور.', true);
        return;
      }
      try {
        const supabase = getSupabase();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('تم تسجيل الدخول بنجاح.');
        window.location.href = './pages/dashboard.html';
      } catch (err) {
        showToast('فشل تسجيل الدخول. تحقق من البيانات.', true);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        const supabase = getSupabase();
        await supabase.auth.signOut();
        showToast('تم تسجيل الخروج.');
        window.location.href = '../index.html';
      } catch (err) {
        showToast('تعذر تسجيل الخروج الآن.', true);
      }
    });
  }
};

export const getSessionUser = async () => {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    currentUser = data.user;
    if (!currentUser) return null;
    await loadRole();
    const label = document.querySelector('[data-user]');
    if (label) {
      label.textContent = `${currentUser.email} (${currentRole})`;
    }
    return currentUser;
  } catch (err) {
    return null;
  }
};

const loadRole = async () => {
  if (!currentUser) return;
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('USERS').select('role').eq('id', currentUser.id).single();
    if (error) throw error;
    currentRole = data?.role || 'مشاهد';
  } catch (err) {
    currentRole = 'مشاهد';
  }
};

export const getCurrentRole = () => currentRole;

export const requireRole = (roles) => {
  const allowed = roles.includes(currentRole);
  if (!allowed) {
    const blocked = document.querySelectorAll('[data-protected]');
    blocked.forEach(el => {
      el.setAttribute('disabled', 'disabled');
      el.classList.add('ghost');
    });
    showToast('صلاحياتك لا تسمح بهذا الإجراء.', true);
  }
  return allowed;
};
