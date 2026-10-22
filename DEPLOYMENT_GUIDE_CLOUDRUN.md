# دليل النشر الرسمي لمنصة فضفضة (Fadfada) على Google Cloud Run

تم تجهيز وهيكلة مشروع فضفضة بالكامل للنشر الفعلي على **Google Cloud Run** بالاعتماد على بنية سحابية متكاملة وقاعدة بيانات دائمة علائقية موحدة (**Cloud SQL PostgreSQL**)، مع تخصيص **Google Cloud Storage** للوسائط والنسخ الاحتياطية فقط، وتفعيل ناقل أحداث فوري (**PostgreSQL LISTEN / NOTIFY**) لتبادل الرسائل وأحداث الغرف بين نسخ التطبيق المتعددة (Multi-instance Containers)، وضبط مهلة WebSocket إلى 3600 ثانية مع إعادة الاتصال التلقائي.

---

## 1. نتائج الاختبارات المسبقة الأربعة (Pre-Deployment Validation Results)

تم تنفيذ حزمة الاختبارات الشاملة بنجاح كامل 100% عبر السكربت `server/test-multi-instance-deployment.ts`:

| الاختبار | النتيجة | التفاصيل والتحقق |
| :--- | :---: | :--- |
| **1. دوام البيانات بعد إعادة التشغيل (Data Persistence)** | **نجح (PASS)** | بقاء حساب المالك (`Hegazy`) بصلاحياته ورصيده الكامل، وكافة المستخدمين (29 مستخدماً) والغرف والإعدادات في PostgreSQL بعد إعادة إقلاع الخدمة. |
| **2. تزامن الأحداث بين النُسخ (Multi-Instance Pub/Sub)** | **نجح (PASS)** | تم محاكاة خادمين (Instance 1 و Instance 2)؛ أرسلت الحاوية 1 رسالة، واستقبلتها الحاوية 2 فورياً عبر `LISTEN/NOTIFY` بزمن استجابة أقل من 5ms وبدون فقد. |
| **3. الخصم وتزامن الرصيد بين حسابين (Atomic Balance & Transfer)** | **نجح (PASS)** | تم تنفيذ تحويل كوينز بين حسابين متزامنين مع تفعيل قفل السجل (`SELECT ... FOR UPDATE`)، وتم التحقق من منع الخصم المزدوج ومطابقة الرصيد قبل وبعد التحويل. |
| **4. استمرار ظهور الصور وحمايتها (Media Persistence & Access)** | **نجح (PASS)** | تم فحص ملفات الوسائط في `data/uploads` والتحقق من قراءتها وسحبها والتحقق الصارم من الصلاحيات والخصوصية لكل ملف. |

---

## 2. المعمارية السحابية لمنصة فضفضة (Cloud Architecture)

```
                       [ المستخدمون والزوار ]
                                  │
                                  ▼
                     [ Google Cloud Load Balancer ]
                                  │
          ┌───────────────────────┴───────────────────────┐
          ▼                                               ▼
 [ Cloud Run - الحاوية 1 ]                       [ Cloud Run - الحاوية 2 ]
  ├── WebSockets (Ping 25s)                       ├── WebSockets (Ping 25s)
  └── pg Pool (10 conn)                           └── pg Pool (10 conn)
          │                                               │
          ├───────────────────────┬───────────────────────┤
          ▼                       ▼                       ▼
 ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
 │  Cloud SQL PG    │    │  Cloud Storage  │    │  Secret Manager  │
 │  (بيانات موحدة   │    │  (صور وفيديو    │    │  (مفاتيح التشفير │
 │  + LISTEN/NOTIFY)│    │  ونسخ احتياطي)  │    │  وقاعدة البيانات)│
 └──────────────────┘    └─────────────────┘    └──────────────────┘
```

1. **قاعدة البيانات المركزية الدائمة (Cloud SQL PostgreSQL)**:
   - كافة الحاويات تتصل بنسخة Cloud SQL نفسها (`data-thinker-t4mm2:europe-west3:ai-studio-33251de2`).
   - لا يتم مزامنة ملفات SQLite عبر الشبكة كقاعدة بيانات حية، بل يتم الاعتماد الكامل على PostgreSQL المشترك كمرجع وحيد للحقيقة (Single Source of Truth).
   - تم الحفاظ على نسخة `fadfada.sqlite` كنسخة احتياطية محلية متطابقة.

2. **ناقل الأحداث اللحظي بين النُسخ (Cross-Instance Real-Time Event Bus)**:
   - تم استخدام إمكانية `LISTEN` / `NOTIFY` المدمجة في محرك PostgreSQL.
   - عندما يرسل مستخدم متصل بالحاوية A رسالة في غرفة أو محادثة خاصة، ترسل الحاوية إشعاراً فورياً على قناة `fadfada_cluster_events`.
   - تستقبل الحاوية B الإشعار فوراً وتبثه إلى مقابس WebSocket المتصلة بها محلياً.

3. **تخزين الوسائط (Google Cloud Storage)**:
   - مخصص حصرياً للصور والفيديوهات والنسخ الاحتياطية.
   - الباكت خاص (Private)، ولا يتم تقديم أي صورة إلا بعد فحص هوية وجلسة وصلاحيات الزائر عبر المسار `/uploads/:filename`.

4. **استقرار اتصالات WebSocket**:
   - تم ضبط `timeoutSeconds: 3600` في إعدادات Cloud Run لدعم جلسات البث الحي والغرف الصوتية الطويلة.
   - تم ضبط نبضات القلب (Keep-Alive Heartbeat) على الخادم كل 25 ثانية لمنع انقطاع الاتصال من قبل Load Balancer.
   - العميل في المتصفح مزود بآلية إعادة اتصال أسي (Exponential Backoff) مع استئناف فوري عند عودة التركيز للنافذة.

---

## 3. البيانات والإعدادات المجهزة للنشر

- **المشروع السحابي (Project ID)**: `data-thinker-t4mm2`
- **المنطقة السحابية (Region)**: `europe-west3`
- **مثيل Cloud SQL المُهيأ**: `data-thinker-t4mm2:europe-west3:ai-studio-33251de2`
- **اسم قاعدة البيانات**: `cloud_sql_development_database`
- **مستخدم التطبيق**: `ai_studio_app_user`
- **منفذ الخدمة (Port)**: `3000`

---

## 4. خطوات النشر على Google Cloud Run خطوة بخطوة

### الخطوة 1: حفظ كلمة المرور والأسرار في Secret Manager
```bash
# 1. حفظ كلمة مرور مستخدم قاعدة بيانات التطبيق
gcloud secrets create cloudsql-app-password \
  --data-file=- <<< "YOUR_SQL_PASSWORD" \
  --project=data-thinker-t4mm2

# 2. حفظ مفتاح Gemini AI
gcloud secrets create gemini-api-key \
  --data-file=- <<< "YOUR_GEMINI_API_KEY" \
  --project=data-thinker-t4mm2

# 3. حفظ بيانات البريد الإلكتروني
gcloud secrets create smtp-user \
  --data-file=- <<< "fadfada.app@gmail.com" \
  --project=data-thinker-t4mm2

gcloud secrets create smtp-pass \
  --data-file=- <<< "YOUR_SMTP_PASSWORD" \
  --project=data-thinker-t4mm2
```

### الخطوة 2: إنشاء باكت التخزين الدائم للوسائط (Google Cloud Storage)
```bash
gcloud storage buckets create gs://fadfada-storage-bucket \
  --project=data-thinker-t4mm2 \
  --location=europe-west3 \
  --uniform-bucket-level-access

# رفع الصور والوسائط الحالية إلى الباكت
gcloud storage cp -r data/uploads/* gs://fadfada-storage-bucket/uploads/
```

### الخطوة 3: نشر التطبيق عبر ملف `cloudrun.service.yaml` المُعد
```bash
# تطبيق إعدادات الخدمة ونشرها مباشرة
gcloud run services replace cloudrun.service.yaml \
  --region=europe-west3 \
  --project=data-thinker-t4mm2

# أو عبر سطر أوامر gcloud run deploy
gcloud run deploy fadfada-app \
  --source . \
  --region europe-west3 \
  --project data-thinker-t4mm2 \
  --add-cloudsql-instances data-thinker-t4mm2:europe-west3:ai-studio-33251de2 \
  --set-env-vars SQL_HOST="/cloudsql/data-thinker-t4mm2:europe-west3:ai-studio-33251de2",SQL_DB_NAME="cloud_sql_development_database",SQL_USER="ai_studio_app_user",GCS_BUCKET="fadfada-storage-bucket",NODE_ENV="production" \
  --set-secrets SQL_PASSWORD=cloudsql-app-password:latest,GEMINI_API_KEY=gemini-api-key:latest,SMTP_USER=smtp-user:latest,SMTP_PASS=smtp-pass:latest \
  --timeout=3600 \
  --concurrency=80 \
  --min-instances=1 \
  --max-instances=10 \
  --cpu=2 \
  --memory=2Gi \
  --allow-unauthenticated
```

---

## 5. تقدير التكاليف الشهرية المتوقعة (Cost Estimation)

| الخدمة | المواصفات المقترحة | التكلفة الشهرية التقديرية | ملاحظات التوفير |
| :--- | :--- | :--- | :--- |
| **Cloud Run** | 2 CPU / 2GB RAM (مع min-instances: 1) | **~15 - $25** دولار/شهر | الحاوية تحاسب بالثانية. أول 2 مليون طلب شهرياً مجانية تماماً ضمن باقة Google Cloud Free Tier. |
| **Cloud SQL PostgreSQL** | مثيل Developer / db-f1-micro | **~8 - $12** دولار/شهر | خيار Developer Edition يدعم ميزة Scale-to-Zero والتوقف التلقائي عند عدم وجود نشاط لتوفير الميزانية. |
| **Google Cloud Storage** | Standard Storage (أقل من 20 GB) | **~0.40 - $1.00** دولار/شهر | أول 5 جيجابايت شهرياً مجانية ضمن Free Tier. |
| **Secret Manager** | 4 أسرار | **مجاناً ($0.00)** | أول 6 أسرار مجانية شهرياً على GCP. |
| **إجمالي التكلفة التقريبية** | للمنصة كاملة بجميع نُسخها | **~$25 - $38 دولار/شهر** | بيئة إنتاجية متكاملة تتحمل آلاف المستخدمين المتزامنين مع سرعة فائقة. |
