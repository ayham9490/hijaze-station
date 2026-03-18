import { initUI } from './modules/ui.js';
import { initAuth, getSessionUser } from './modules/auth.js';

const boot = async () => {
  initUI();
  await initAuth();
  await getSessionUser();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {
        // تجاهل فشل التسجيل لتجنب إرباك المستخدم
      });
    });
  }
};

boot();
