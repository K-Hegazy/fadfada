import React, { useEffect } from 'react';
import { CheckCircle2, FileText, ShieldCheck, X } from 'lucide-react';

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

const TERMS_SECTIONS: Array<{ title: string; points: string[] }> = [
  {
    title: '1. الاستخدام العام للمنصة والأهلية القانونية',
    points: [
      'التسجيل واستخدام منصة فضفضة متاح فقط لمن بلغ 18 سنة فأكثر، ويُعد إقرار العمر عند الدخول مسؤولية شخصية كاملة على المستخدم.',
      'يلتزم المستخدم بالاحترام المتبادل وحسن السلوك في الغرف العامة والرسائل الخاصة وكافة أقسام المنصة.',
      'يُمنع انتحال شخصية أي مستخدم آخر أو موظفي الإدارة أو المالك، كما يُمنع إنشاء حسابات بغرض التخريب أو الإزعاج المتكرر.',
    ],
  },
  {
    title: '2. المحتوى الديني',
    points: [
      'يُمنع منعًا باتًا الإساءة إلى الأديان أو الرموز والمقدسات الدينية أو إثارة النعرات الطائفية والتكفير.',
      'الالتزام بالحوار الراقي وعدم فرض الآراء الدينية أو تحويل الغرف إلى ساحات جدل حاد أو تطرف.',
    ],
  },
  {
    title: '3. المحتوى السياسي',
    points: [
      'يُحظر نشر الدعاية الحزبية التحريضية أو الخطاب السياسي الداعي للعنف أو الكراهية أو إثارة الفتن.',
      'المنصة مجتمع تواصل اجتماعي ودي، وتحتفظ الإدارة بحق إيقاف أي نقاش سياسي يتحول إلى إساءة أو تجاوز.',
    ],
  },
  {
    title: '4. المحتوى الجنسي والتحرش',
    points: [
      'يُمنع بشكل قاطع نشر أو إرسال أي محتوى إباحي أو صور أو فيديوهات خادشة للحياء أو إيحاءات جنسية.',
      'يُحظر التحرش اللفظي أو البصري أو ملاحقة الأعضاء غير الراغبين في التواصل بأي وسيلة.',
    ],
  },
  {
    title: '5. المحتوى المخالف والسلامة العامة',
    points: [
      'يُمنع السب والقذف والتنمر والابتزاز والتهديد ونشر البيانات الشخصية للآخرين (Doxxing) دون موافقتهم.',
      'يُحظر الترويج للمواد الممنوعة أو الاحتيال المالي أو طلب تحويلات مالية خارج القنوات الرسمية داخل المنصة.',
    ],
  },
  {
    title: '6. الرسائل الخاصة والخصوصية',
    points: [
      'تسري قواعد الاحترام ومنع الإزعاج والابتزاز على الرسائل الخاصة كما تسري على الغرف العامة تمامًا.',
      'تتيح المنصة أدوات خصوصية وتبليغ فورية؛ وفي حال تلقي بلاغ موثق عن إساءة أو انتهاك في الخاص تتدخل الإدارة وفقًا للوائح المنصة.',
    ],
  },
  {
    title: '7. الصور والفيديوهات والملفات والروابط',
    points: [
      'يتحمل المرسل المسؤولية الكاملة عن جميع الصور والفيديوهات والملفات الصوتية والروابط التي يرفعها أو يشاركها.',
      'يُمنع مشاركة روابط تصيد أو برمجيات خبيثة أو ملفات منتهكة لحقوق الملكية الفكرية أو القوانين المعمول بها.',
    ],
  },
  {
    title: '8. مسؤولية الإدارة والمالك وحدود المسؤولية',
    points: [
      'تمتلك الإدارة والمالك صلاحية حذف المحتوى المخالف، تقييد الحسابات، أو حظرها نهائيًا دون إشعار مسبق عند ثبوت المخالفة.',
      'جميع الآراء والمحتويات المنشورة تعبّر عن أصحابها فقط ولا تتحمل إدارة المنصة أو مالكها أي مسؤولية عن تصرفات المستخدمين أو تعاملاتهم الشخصية.',
      'تُعد هذه الوثيقة قواعد استخدام وتنظيم داخلية للمنصة، وتخضع للتحديث المستمر وفق متطلبات الأمان والتشغيل.',
    ],
  },
];

export const TermsModal: React.FC<TermsModalProps> = ({ open, onClose, onAccept }) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="الشروط والأحكام وسياسة الاستخدام"
    >
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden fadfada-modal-in">
        {/* Header */}
        <header className="px-4 sm:px-5 py-3.5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 shrink-0 bg-[#F2F4F7]/60 dark:bg-[#0B1114]/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 truncate">
                الشروط والأحكام وسياسة الاستخدام — فضفضة
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                قواعد المجتمع والضوابط الملزمة لجميع الأعضاء والضيوف (18+)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-[#18242B] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto fadfada-scroll p-4 sm:p-5 space-y-3.5 text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-200">
          <div className="p-3 rounded-xl bg-[#E6F4F0]/70 dark:bg-[#14332C]/60 border border-[#0B7A62]/20 flex items-start gap-2.5 text-xs text-[#0B7A62] dark:text-[#34D399]">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              بدخولك أو تسجيلك في منصة فضفضة كعضو أو كضيف، فإنك تقر بأن عمرك 18 سنة أو أكثر وتلتزم التزامًا كاملًا بكافة البنود التالية.
            </p>
          </div>

          {TERMS_SECTIONS.map((sec) => (
            <section
              key={sec.title}
              className="p-3.5 rounded-xl bg-[#F2F4F7]/70 dark:bg-[#0B1114]/70 border border-slate-200/70 dark:border-white/10 space-y-1.5"
            >
              <h3 className="font-display text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50">
                {sec.title}
              </h3>
              <ul className="list-disc pr-4 space-y-1 text-slate-600 dark:text-slate-300 text-xs">
                {sec.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer CTA */}
        <footer className="px-4 sm:px-5 py-3 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-end gap-2 shrink-0 bg-white dark:bg-[#121B20]">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-4 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-semibold cursor-pointer"
          >
            إغلاق
          </button>
          {onAccept && (
            <button
              type="button"
              onClick={() => {
                onAccept();
                onClose();
              }}
              className="min-h-[38px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>أوافق على الشروط والأحكام</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};
