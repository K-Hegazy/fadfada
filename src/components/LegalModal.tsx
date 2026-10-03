import React, { useState } from 'react';
import { X, Shield, FileText, Lock, Users, AlertTriangle } from 'lucide-react';

export type LegalTab = 'terms' | 'privacy' | 'community' | 'age18';

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
              <h2 className="text-sm sm:text-base font-bold text-white font-cairo truncate">الوثائق والسياسات الرسمية</h2>
              <p className="text-[10px] sm:text-xs text-neutral-400 truncate">التشريعات، حماية البيانات، وإرشادات مجتمع الأمان</p>
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
            { id: 'terms', label: 'شروط الاستخدام', icon: FileText },
            { id: 'privacy', label: 'سياسة الخصوصية', icon: Lock },
            { id: 'community', label: 'إرشادات المجتمع', icon: Users },
            { id: 'age18', label: 'سياسة سن الرشد (+18)', icon: AlertTriangle }
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-neutral-300 space-y-4 text-xs leading-relaxed">
          {activeTab === 'terms' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white font-cairo flex items-center gap-2 text-emerald-400">
                <FileText className="w-4 h-4" />
                1. شروط واتفاقية استخدام فضفضه
              </h3>
              <p>
                مرحباً بك في منصة <strong>فضفضه (Fadfada)</strong>، المنصة العربية الراقية للحوار الهادف والتواصل المجتمعي الآمن. استخدامك للمنصة أو إنشائك لحساب يعني موافقتك التامة وغير المشروطة على هذه الشروط.
              </p>
              <div className="space-y-2.5">
                <h4 className="font-bold text-white text-xs font-cairo">أ. الأهلية والاستخدام المشروع:</h4>
                <p>
                  يقتصر التسجيل في منصة فضفضه على الأفراد الذين أتموا سن الثامنة عشرة (18 عاماً) فما فوق. المنصة مخصصة للتواصل الأخوي، الاجتماعي، وتفريغ المشاعر والتعبير عن الذات ضمن أطر الاحترام المتبادل.
                </p>
                <h4 className="font-bold text-white text-xs font-cairo">ب. مسؤولية الحساب:</h4>
                <p>
                  أنت مسؤول مسؤولية كاملة عن الحفاظ على سرية بيانات حسابك وكلمة المرور، وعن كافة الأنشطة والمشاركات الصادرة من حسابك.
                </p>
                <h4 className="font-bold text-white text-xs font-cairo">ج. حقوق الملكية الفكرية والعلامة التجارية:</h4>
                <p>
                  جميع العلامات التجارية، التصاميم، الأوسمة، والشفرات البرمجية ملك حصري لإدارة منصة فضفضه والمالك (Owner Hegazy). يُحظر استنساخها أو إعادة استغلالها دون إذن خطي مسبق.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white font-cairo flex items-center gap-2 text-emerald-400">
                <Lock className="w-4 h-4" />
                2. سياسة الخصوصية وحماية البيانات
              </h3>
              <p>
                نولي في فضفضه خصوصيتك وأمان بياناتك أعلى درجات الأهمية والمسؤولية التقنية.
              </p>
              <div className="space-y-2.5">
                <h4 className="font-bold text-white text-xs font-cairo">أ. التشفير والحماية:</h4>
                <p>
                  يتم تشفير كلمات المرور باستخدام خوارزميات التجزئة المشفرة المتقدمة (Scrypt + Salt عشوائي). لا يتم تخزين كلمات المرور كنص صريح بأي شكل من الأشكال.
                </p>
                <h4 className="font-bold text-white text-xs font-cairo">ب. الرسائل ذاتية التدمير والعرض لمرة واحدة (View Once):</h4>
                <p>
                  تخضع وسائط العرض لمرة واحدة لتدمير برمجي فوري على الخادم عقب فتحها من قِبل المستلم، وتصبح غير قابلة للاسترجاع حتى عبر الرابط المباشر.
                </p>
                <h4 className="font-bold text-white text-xs font-cairo">ج. أدوات التحكم بالخصوصية:</h4>
                <p>
                  نوفر لك في قسم الإعدادات تحكماً دقيقاً يفرض حماية من جانب الخادم (Server-Side) لتحديد: من يمكنه مراسلتك، من يرى قصصك، ومن يطّلع على حالة اتصالك.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'community' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white font-cairo flex items-center gap-2 text-emerald-400">
                <Users className="w-4 h-4" />
                3. ميثاق الشرف وإرشادات المجتمع
              </h3>
              <p>
                صُممت فضفضه لتكون ملاذاً آمناً لكل من يبحث عن الاستماع، الود، والنقاش الهادئ. نطبق سياسة صارمة ضد التجاوزات:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-neutral-300">
                <li><strong className="text-white">الاحترام غير المشروط:</strong> يُمنع تماماً أي سباب، شتائم، تنمر، أو تشهير بأي عضو.</li>
                <li><strong className="text-white">منع التحرش والمضايقات:</strong> احترام رغبة الطرف الآخر عند إنهاء المحادثة أو استخدام أدوات الكتم والحظر.</li>
                <li><strong className="text-white">حظر الروابط المشبوهة والاحتيال:</strong> يُمنع منعاً باتاً نشر روابط اختراق، إعلانات مزعجة (Spam)، أو ترويج خدمات احتيالية.</li>
                <li><strong className="text-white">المحتوى اللائق:</strong> يمنع نشر أي صور، وسائط، أو نصوص مخلة بالآداب العامة أو خادشة للحياء.</li>
              </ul>
            </div>
          )}

          {activeTab === 'age18' && (
            <div className="space-y-4">
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
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/60 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500 font-tajawal">
            منصة فضفضه © {new Date().getFullYear()} - جميع الحقوق محفوظة
          </span>
          <button
            onClick={onClose}
            className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
          >
            إغلاق وقبول السياسات
          </button>
        </div>
      </div>
    </div>
  );
};
