# نظام إدارة المحاسبة الاحترافي (PWA)

تطبيق محاسبة عربي كامل يعمل مباشرة داخل المتصفح بدون أي أدوات بناء. يعتمد على **Vanilla JavaScript + Supabase** مع دعم **PWA** والتشغيل دون اتصال، ومتوافق مع **GitHub Pages** و**PWABuilder**.

## المزايا الرئيسية
- إدارة الحسابات (إضافة، تعديل، حذف آمن).
- العمليات المالية بنظام القيد المزدوج.
- تحديث الأرصدة تلقائيًا بعد كل قيد.
- دعم العملات: `USD`, `EUR`, `TRY`, `SYP`.
- حفظ `exchange_rate` و`converted_usd` لكل عملية.
- صلاحيات مستخدمين (مدير، محاسب، مشاهد).
- لوحة تحكم تحليلية (إجمالي الأرصدة، آخر العمليات، ملخص الحسابات، مخطط الإيرادات والمصروفات).
- تقارير: دفتر الأستاذ، تقرير الحسابات، الأرباح والخسائر، تقرير العمليات.
- تصدير CSV وExcel + طباعة.
- تطبيق ويب تقدمي قابل للتثبيت مع دعم العمل دون اتصال.

## التقنيات
- الواجهة: `HTML5`, `CSS3`, `Vanilla JS (ES6 Modules)`
- قاعدة البيانات والمصادقة: `Supabase`
- الاستضافة: `GitHub Pages`
- PWA: `manifest.json` + `service-worker.js`

## هيكل المشروع
```text
project/
  index.html
  app.js
  config.js
  style.css

  manifest.json
  service-worker.js
  offline.html
  database-schema.sql

  icons/
    icon-192.png
    icon-512.png
    icon-1024.png

  modules/
    supabase-client.js
    accounts.js
    transactions.js
    reports.js
    auth.js
    ui.js
    currency.js

  pages/
    dashboard.html
    accounts.html
    transactions.html
    ledger.html
    reports.html
    settings.html

  assets/
    logo.png
```

## إعداد قاعدة البيانات (SQL)
استخدم ملف [`database-schema.sql`](./database-schema.sql) كما هو داخل Supabase SQL Editor.  
الملف ينشئ الجداول المطلوبة:
- `ACCOUNTS`
- `TRANSACTIONS`
- `USERS`

ويضيف:
- القيود اللازمة للمحاسبة.
- الفهارس.
- سياسات RLS مبنية على الدور.

## تشغيل محلي سريع
1. افتح `index.html` مباشرة أو عبر أي استضافة ثابتة.
2. من واجهة الدخول أدخل `SUPABASE_URL` و`SUPABASE_ANON_KEY`.
3. سجّل الدخول بحساب موجود في Supabase Auth.

## ملاحظات الأمان
- لا تستخدم مفتاح الخدمة (`service_role`) داخل الواجهة إطلاقًا.
- استخدم فقط `anon key`.
- تحقق من سياسات RLS قبل الإطلاق.

## التوافق مع GitHub Pages
- المشروع بدون خادم وبدون Routing ديناميكي.
- جميع المسارات نسبية.
- جاهز للعمل على GitHub Pages مباشرة.

## دليل النشر النهائي
1. **إنشاء مشروع Supabase** جديد.
2. **إنشاء الجداول** عبر تنفيذ `database-schema.sql`.
3. **إدخال مفاتيح Supabase** (`SUPABASE_URL` + `SUPABASE_ANON_KEY`) من صفحة الدخول/الإعدادات.
4. **رفع المشروع إلى GitHub** (جميع الملفات كما هي).
5. **تفعيل GitHub Pages** من إعدادات المستودع.
6. **التحقق من PWA** (Manifest + Service Worker + Installability).
7. **استخدام PWABuilder** لتوليد:
   - Windows MSIX
   - Android APK / AAB

## اختبار سريع قبل الإطلاق
- إنشاء حسابات متعددة بعملات مختلفة.
- إدخال قيود محاسبية والتأكد من تحديث الأرصدة.
- تجربة وضع عدم الاتصال ثم مزامنة العمليات.
- تصدير التقارير بصيغ CSV وExcel.
- اختبار التثبيت كتطبيق PWA من المتصفح.
