# نظام المحاسبة الاحترافي (PWA)

هذا المشروع يقدم نظام محاسبة كامل بواجهة عربية ودعم للعمل دون اتصال، قابل للنشر على GitHub Pages ويعتمد على Supabase كخدمة مجانية.

## المزايا
- إدارة الحسابات والعمليات المالية
- محاسبة القيد المزدوج
- دفتر الأستاذ والتقارير
- تعدد العملات (USD, EUR, TRY, SYP)
- صلاحيات مستخدمين
- تصدير CSV وExcel
- تطبيق ويب تقدمي قابل للتثبيت

## دليل النشر خطوة بخطوة
1. إنشاء مشروع جديد في Supabase.
2. إنشاء الجداول التالية في قاعدة البيانات:
   - جدول ACCOUNTS بالأعمدة: id (uuid), name, type, currency, balance, created_at.
   - جدول TRANSACTIONS بالأعمدة: id, date, debit_account, credit_account, description, amount, currency, exchange_rate, converted_usd, created_at.
   - جدول USERS بالأعمدة: id, email, role, created_at.
3. نسخ SUPABASE_URL و SUPABASE_ANON_KEY.
4. تشغيل التطبيق، الدخول إلى صفحة الإعدادات، ثم لصق المفاتيح وحفظها.
5. رفع المشروع إلى GitHub.
6. تفعيل GitHub Pages من إعدادات المستودع.
7. فتح الموقع والتحقق من عمل الـ PWA باستخدام PWABuilder.
8. عبر PWABuilder يمكنك إنشاء:
   - حزمة Windows MSIX
   - تطبيق Android (APK أو AAB)

## ملاحظات
- تأكد من تفعيل سياسات الأمان و RLS في Supabase وفق احتياجك.
- التطبيق يستخدم التخزين المحلي لحفظ المفاتيح والعمليات غير المتصلة.
