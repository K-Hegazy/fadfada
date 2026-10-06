import React, { useState } from 'react';
import { X, Shield, FileText, Lock, Users, AlertTriangle, Flag, CheckCircle } from 'lucide-react';

export type LegalTab = 'terms' | 'privacy' | 'acceptable_use' | 'content_policy' | 'reporting' | 'age18';

interface LegalModalProps {
  initialTab?: LegalTab;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ initialTab = 'terms', onClose }) => {
  const [activeTab, setActiveTab] = useState<LegalTab>(initialTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e121a] border border-neutral-800 rounded-2xl sm:rounded-3xl w-full max-w-3xl max-h-[92dvh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-tajawal">
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-950/80 border border-emerald-600/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white font-cairo truncate">الوثائق والسياسات الرسمية لمنصة فضفضه</h2>
              <p className="text-[10px] sm:text-xs text-neutral-400 truncate">الشروط، الخصوصية، الاستخدام المقبول، وسياسات الأمان والإشراف</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-neutral-800/80 bg-neutral-950/40 px-2 sm:px-3 pt-2 overflow-x-auto no-scrollbar gap-1.5 sm:gap-2 shrink-0">
          {[
            { id: 'terms', label: 'الشروط والأحكام', icon: FileText },
            { id: 'privacy', label: 'سياسة الخصوصية', icon: Lock },
            { id: 'acceptable_use', label: 'الاستخدام المقبول', icon: Users },
            { id: 'content_policy', label: 'سياسة المحتوى', icon: CheckCircle },
            { id: 'reporting', label: 'الإبلاغ والحظر', icon: Flag },
            { id: 'age18', label: 'سن الرشد (+18)', icon: AlertTriangle }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as LegalTab)}
                className={`py-2 sm:py-3 px-3 sm:px-4 rounded-t-xl sm:rounded-t-2xl font-bold text-[11px] sm:text-xs flex items-center gap-1.5 sm:gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400 bg-neutral-900/90'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-neutral-300 space-y-4 text-xs leading-relaxed" dir="rtl">
          {/* 1. TERMS & CONDITIONS */}
          {activeTab === 'terms' && (
            <div className="space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-white font-cairo flex items-center gap-2 text-emerald-400">
                <FileText className="w-4 h-4" />
                1. اتفاقية وشروط استخدام منصة فضفضه (الإصدار 1.0)
              </h3>
              <p>
                مرحباً بك في منصة <strong>فضفضه (Fadfada)</strong>، المنصة العربية للحوار والتواصل المجتمعي الآمن. دخولك للموقع، أو إنشاؤك لحساب، أو استخدامك للخدمة كـ «زائر» أو «عضو»، يمثل موافقة صريحة وملزمة قانونياً على الالتزام بهذه الشروط والسياسات.
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">أ. المسؤولية الفردية للمستخدم:</h4>
                  <p className="text-neutral-300">
                    يتحمل كل مستخدم أو ضيف المسؤولية القانونية والأخلاقية الكاملة والشخصية عن كل رسالة، صورة، تعليق، أو سلوك يصدر من حسابه أو جلسته. الآراء والمحتويات المنشورة تعبر عن أصحابها فقط، ولا تعبر عن رأي منصة فضفضه أو مالكها أو إدارتها بأي شكل.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">ب. أهلية التسجيل وسن الرشد (+18):</h4>
                  <p className="text-neutral-300">
                    المنصة مخصصة حصراً للأفراد الذين أتموا سن الثامنة عشرة (18 عاماً) فما فوق. يحظر تماماً تسجيل القاصرين، ويحق للإدارة تعليق أو حذف أي حساب يخالف شرط السن القانوني فوراً.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">ج. صلاحيات الإدارة والإشراف:</h4>
                  <p className="text-neutral-300">
                    تمتلك إدارة فضفضه ومشرفوها الحق الكامل في إزالة أو حجب أي محتوى مخالف، وتعليق الحسابات أو فرض حظر مؤقت أو دائم دون إشعار مسبق متى ثبت ارتكاب انتهاك للشروط أو إضرار بسلامة الأعضاء.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">د. المعاملات والعملات الافتراضية (Coins):</h4>
                  <p className="text-neutral-300">
                    الكوينز والمكافآت داخل المنصة هي عملات افتراضية مخصصة للميزات الترفيهية والتفاعلية داخل فضفضه فقط، ولا تمثل نقداً مصرفياً أو أداة دفع مالية خارجية.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 2. PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-white font-cairo flex items-center gap-2 text-emerald-400">
                <Lock className="w-4 h-4" />
                2. سياسة الخصوصية وحماية سرية البيانات
              </h3>
              <p>
                تلتزم فضفضه بأعلى معايير الأمان لحماية بيانات المستخدمين وخصوصيتهم الشخصية:
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">أ. تشفير كلمات المرور وتأمين الحسابات:</h4>
                  <p className="text-neutral-300">
                    يتم تخزين كلمات المرور حصرياً عبر تشفير متقدم متبوع بـ Salt عشوائي فريد لكل مستخدم، بما يمنع أي اطلاع عليها حتى من قِبل الفريق التقني.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">ب. الصور ذاتية التدمير والعرض لمرة واحدة:</h4>
                  <p className="text-neutral-300">
                    تخضع وسائط «العرض لمرة واحدة» (View Once) للتدمير الآلي الفوري على الخادم عقب فتحها مباشرة، دون ترك نسخ احتياطية.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">ج. عدم بيع أو تسريب البيانات:</h4>
                  <p className="text-neutral-300">
                    لا تقوم فضفضه ببيع أو تأجير أي بيانات شخصية أو سجلات اتصال لأي طرف ثالث، وتقتصر معالجة البيانات على تشغيل وتحسين خدمات التواصل والأمان.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 3. ACCEPTABLE USE POLICY */}
          {activeTab === 'acceptable_use' && (
            <div className="space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-white font-cairo flex items-center gap-2 text-emerald-400">
                <Users className="w-4 h-4" />
                3. سياسة الاستخدام المقبول (Acceptable Use Policy)
              </h3>
              <p>
                للحفاظ على المنصة كمساحة حوارية راقية وآمنة للجميع، يلتزم كل مستخدم بعدم إساءة استخدام المنصة.
              </p>
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-200 space-y-2">
                <h4 className="font-bold text-xs text-rose-300 font-cairo">الأفعال والأنشطة المحظورة حظراً قاطعاً:</h4>
                <ul className="list-disc list-inside space-y-1 text-neutral-300 text-[11px]">
                  <li>ارتكاب أو التحريض على أي نشاط مخالف للقانون المعمول به.</li>
                  <li>التهديد، الابتزاز، القذف، التشهير، أو التحرش اللفظي أو الجنسي.</li>
                  <li>انتحال صفة أشخاص آخرين أو مؤسسات أو ادعاء صفة إشرافية غير صحيحة.</li>
                  <li>محاولات الاحتيال المالي، الاستغلال، أو طلب معلومات بنكية أو كلمات مرور.</li>
                  <li>نشر البرمجيات الخبيثة، فيروسات، روابط التصيد (Phishing)، أو الإعلانات المزعجة (Spam).</li>
                  <li>استغلال الثغرات البرمجية أو التلاعب بالأرصدة والعدادات والعملات الافتراضية.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 4. CONTENT POLICY */}
          {activeTab === 'content_policy' && (
            <div className="space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-white font-cairo flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-4 h-4" />
                4. سياسة المحتوى والحرية المسؤولة
              </h3>
              <p>
                تؤمن فضفضه بأهمية الحوار وتبادل وجهات النظر، مع الالتزام بالقواعد الآتية:
              </p>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">أ. النقاشات الدينية والفكرية والسياسية:</h4>
                  <p className="text-neutral-300">
                    لا يُمنع المحتوى الديني أو الفكري أو السياسي لمجرد كونه سياسياً أو دينياً، ويحق للأعضاء تبادل الرأي بأسلوب مهذب ومحترم. غير أنه <strong>يُمنع منعاً باتاً</strong> أي محتوى يحرض على العنف أو الإرهاب، أو يبث الكراهية والتعصب الطائفي، أو يمس المقدسات بازدراء، أو يحرض على ارتكاب الجرائم.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">ب. الآداب العامة والوسائط الإباحية:</h4>
                  <p className="text-neutral-300">
                    يُمنع قطعياً نشر أو تداول أي وسائط أو صور إباحية أو خادشة للحياء في العام أو الخاص أو القصص. يتم حظر هذه المواد آلياً وإغلاق حساب مرسلها فوراً.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800">
                  <h4 className="font-bold text-white text-xs font-cairo mb-1 text-emerald-300">ج. حقوق المشرفين في المراجعة:</h4>
                  <p className="text-neutral-300">
                    يملك المشرفون سلطة مراجعة البلاغات وإزالة أي محتوى يخل بسلامة المجتمع دون مسؤولية تعويض عن إزالة المحتوى المخالف.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5. REPORTING & SAFETY */}
          {activeTab === 'reporting' && (
            <div className="space-y-4 animate-in fade-in">
              <h3 className="text-sm font-bold text-white font-cairo flex items-center gap-2 text-emerald-400">
                <Flag className="w-4 h-4" />
                5. نظام الإبلاغ عن الانتهاكات وأدوات الحظر
              </h3>
              <p>
                وفرت فضفضه منظومة متكاملة لحماية تجربتك تضمن لك السيطرة الكاملة على من تتفاعل معه:
              </p>
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-2.5">
                  <Flag className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-cairo text-xs">زر الإبلاغ الفوري (Report):</strong>
                    <span className="text-neutral-300 text-[11px]">متاح في جميع المحادثات والغرف والقصص وقسم التواصل العشوائي لرفع بلاغ مباشر يصل لفريق الإشراف.</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-cairo text-xs">الحظر الشخصي (Block):</strong>
                    <span className="text-neutral-300 text-[11px]">بمجرد حظرك لأي مستخدم، يُمنع من مراسلتك أو رؤية حالتك أو مطابقته معك مجدداً في التواصل العشوائي.</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-white block font-cairo text-xs">المعالجة السريعة:</strong>
                    <span className="text-neutral-300 text-[11px]">يتم اتخاذ إجراءات تصاعدية تشمل: التحذير، تقييد المراسلة، التعليق المؤقت، أو الحظر النهائي للجهاز والحساب.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 6. AGE 18+ POLICY */}
          {activeTab === 'age18' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-600/40 text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-white font-cairo">سياسة سن الرشد الإلزامية (+18)</h4>
                  <p className="text-xs text-amber-200/90 mt-1">
                    منصة فضفضه موجهة حصراً للبالغين الراشدين من عمر 18 عاماً وما فوق، لضمان بيئة ناضجة ومسؤولة أخلاقياً وقانونياً.
                  </p>
                </div>
              </div>

              <div className="space-y-2 text-neutral-300">
                <p>
                  - يتم التحقق من تاريخ الميلاد أثناء التسجيل لحساب جديد، ويتم فرض إقرار صريح لزوار المنصة بالبلوغ القانوني قبل بدء التصفح.
                </p>
                <p>
                  - تحتفظ إدارة المنصة بحق حظر أو تعليق أي حساب فوراً في حال ثبوت عدم استيفائه لشرط السن القانوني المحدد بـ 18 عاماً.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-tajawal">
            منصة فضفضه © {new Date().getFullYear()} - جميع الحقوق محفوظة
          </span>
          <button
            onClick={onClose}
            className="py-2 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            إغلاق وقبول السياسات
          </button>
        </div>
      </div>
    </div>
  );
};
