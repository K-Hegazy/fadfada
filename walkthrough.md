# Fadfada (فضفضة) — Appwrite Cloud Architecture & Verification

تم نقل مشروع **فضفضة (Fadfada)** بالكامل من Firebase إلى **Appwrite Cloud** مع الإبقاء على كامل واجهة المستخدم العربية RTL وجميع المزايا التفاعلية، وإعادة تفعيل التخزين الفعلي للوسائط عبر Appwrite Storage.

## 1. البنية المعمارية على Appwrite Cloud

1. **التهيئة والجداول (`src/appwrite/*`, `appwrite.json`, `scripts/setup-appwrite.ts`)**:
   - إعداد عميل `appwrite` (`Account`, `TablesDB`, `Storage`, `Functions`, `Realtime`, `Presences`) في `src/appwrite/config.ts`.
   - تعريف 31 جدولًا وفهارسها وصلاحيات الصفوف (`rowSecurity: true`) في `appwrite.json` وسكربت التهيئة الآلي `npm run appwrite:setup` عبر `node-appwrite` (متضمنًا جدول `user_private` المعزول لبيانات البريد الإلكتروني الخاصة بصلاحية قراءة حصرية للمالك فقط).
   - اشتقاق معرّفات الصفوف المركّبة (`c_...`, `r_...`, `m_...`, `d_...`, `v_...`) بدالة `deterministicRowId` للبقاء ضمن حد Appwrite البالغ 36 حرفًا دون تصادم.

2. **المصادقة والأمان (`src/services/auth.ts`, `src/components/AuthScreen.tsx`, `src/components/ProfilePanel.tsx`)**:
   - تسجيل الدخول بالبريد الإلكتروني وكلمة المرور، وإنشاء الحسابات، ودخول Google OAuth (`OAuthProvider.Google`)، والدخول السريع كضيف (`createAnonymousSession`).
   - ترقية حساب الضيف إلى عضو دائم (`upgradeGuestToMember`) مع الاحتفاظ بنفس الـ UID والعملات والمحادثات.
   - معالجة روابط توثيق البريد (`?verify=1&userId=...&secret=...`) واستعادة كلمة المرور (`?recovery=1&userId=...&secret=...`) داخل التطبيق.

3. **اللحظية والتواجد (`src/appwrite/realtime.ts`, `src/services/presence.ts`)**:
   - اشتراكات Appwrite Realtime (`realtime.subscribe` لقنوات الجداول والملفات وجلسات الحساب) لتحديث المحادثات الخاصة، الغرف، القصص، الحائط، الإشعارات، المطابقة العشوائية، وإشارات WebRTC لحظيًا.
   - نظام التواجد عبر `realtime.upsertPresence` ونبضة heartbeat مقننة (`60s` مع حد أدنى `45s` بين كتابات `lastSeen`) وتنظيف عند الإغلاق.

4. **تخزين الوسائط (`src/services/storage.ts`)**:
   - رفع الصور الشخصية، الأغلفة، قصص الصور والفيديو، صور منشورات الحائط، صور الدردشة، الرسائل الصوتية، وأيقونات المتجر/الشارات/الهدايا مباشرة إلى Appwrite Storage bucket `fadfada_media`.

5. **الدوال السحابية للاقتصاد والإدارة (`appwrite-functions/fadfada-economy`, `appwrite-functions/fadfada-admin`)**:
   - تنفيذ جميع العمليات الحساسة على الخادم فقط بمفتاح ديناميكي: ترقية حساب المالك الموثّق (`emailVerification === true`)، الشراء من المتجر، الهدايا، التحويلات، المكافآت اليومية وعجلة الحظ، الميكروفون، المطابقة العشوائية، الصداقات والزواج، المراجعات المالية، البلاغات، الالتماسات، وضبط صلاحيات المشرف والمالك.

## 2. نتائج الفحص والاختبار

- **`npm test` (`tsx --test scripts/appwrite-verify.test.ts`)**: اجتياز كافة اختبارات التدقيق الساكن (خلو `src/` من Firebase وSupabase و`.toMillis()` و`window.alert/confirm/open` وبيانات المالك السرية)، اختبارات `sanitizeHttpUrl` وملفات الاستضافة (`_redirects`, `_headers`, `favicon.svg`, `vercel.json`)، واختبارات محاكاة `fadfada-economy` و`fadfada-admin`.
- **`compile_applet` + `lint_applet`**: التحقق من سلامة TypeScript وESLint وبناء الإنتاج Vite.

# Security Summary

- **الأسرار والمفاتيح**: ملف `.env` وواجهة Vite لا يحتويان سوى على الإعدادات العامة (`VITE_APPWRITE_ENDPOINT` و`VITE_APPWRITE_PROJECT_ID`)؛ مفتاح `APPWRITE_API_KEY` محصور على الخادم فقط داخل Appwrite Cloud Functions وأدوات CLI ولا يظهر في حزمة `dist/`.
- **بيانات المستخدمين والمالك**: لا توجد كلمات مرور أو بريد المالك أو رموز جلسة في كود الواجهة أو في `localStorage`/`sessionStorage`؛ بيانات البريد معزولة في جدول `user_private` بصلاحية قراءة خاصة بصاحب الحساب فقط، وترقية المالك تتطلب `emailVerification === true` من الخادم.
- **الصلاحيات والاقتصاد والدردشة**: المشتريات، التحويلات، الهدايا، الميكروفون، الحظر، تعديل إعدادات الموقع، الرسائل الخاصة، ووسائط العرض لمرة واحدة (`consumeViewOnceMessage` / `consumeRoomViewOnce`) تُنفَّذ وتُتحقَّق حصريًا على الخادم مع صلاحيات صفوف Appwrite.
- **روابط الإعلانات والوسائط**: دالة `sanitizeHttpUrl` تحجب الروابط غير الآمنة (`javascript:`, `vbscript:`, `data:`) في `AdSlot` و`MediaViewerModal` مع ترويسات أمان الإنتاج (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) في `public/_headers` و`vercel.json`.

## PoC Verification

- **تزوير الأسعار أو تجاوز صلاحيات الضيف/المشرف**: محاكاة الدوال في `scripts/appwrite-verify.test.ts` تثبت رفض الأسعار المرسلة من العميل (استخدام سعر الجدول الفعلي على الخادم)، ورفض وصول الضيف للمتجر والمكافآت والتحويلات (`HTTP 403`)، ومنع المشرف من تعديل الأدوار أو العملات أو حساب المالك (`HTTP 403`).
- **استهلاك وسائط المشاهدة لمرة واحدة**: اختبار `consumeViewOnceMessage` و`consumeRoomViewOnce` يثبت مسح رابط الوسائط فور الفتح الأول وإرجاع `HTTP 410` عند أي محاولة إعادة فتح.
- **حقن الروابط غير الآمنة**: اختبار `sanitizeHttpUrl` يثبت رفض `javascript:alert(1)` و`data:text/html,...` و`//evil.example` وقبول روابط `https://`/`http://` ومسارات `/assets/...` الصالحة فقط.
- **جاهزية حزم الاعتماد**: فحص `bun audit` أظهر 0 ثغرات عبر جميع الحزم المثبتة.

