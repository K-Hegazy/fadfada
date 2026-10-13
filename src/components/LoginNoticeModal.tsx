import React from 'react';
import { X, Sparkles, Megaphone, Check } from 'lucide-react';
import { LoginNotice } from '../types';

interface LoginNoticeModalProps {
  notice: LoginNotice;
  onClose: () => void;
  isPreview?: boolean;
}

export const LoginNoticeModal: React.FC<LoginNoticeModalProps> = ({
  notice,
  onClose,
  isPreview = false
}) => {
  if (!notice.enabled && !isPreview) return null;
  if (!notice.title?.trim() && !notice.content?.trim() && !isPreview) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-notice-title"
    >
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#0f1422] to-[#080a10] border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-amber-950/40 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Glow Accent */}
        <div className="absolute top-0 right-1/4 left-1/4 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full opacity-80" />

        {/* Top Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Megaphone className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {isPreview ? 'معاينة رسالة الإدارة' : 'إعلان وتنبيه رسمي'}
                </span>
                {isPreview && (
                  <span className="text-[10px] text-neutral-400 font-mono">وضع المعاينة الحية</span>
                )}
              </div>
              <h2
                id="login-notice-title"
                className="text-lg sm:text-xl font-cairo font-black text-white mt-1 leading-snug"
              >
                {/* Safe plain text render - never executes HTML or script */}
                {notice.title || 'رسالة ترحيبية من إدارة فضفضه'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer border border-neutral-800"
            title="إغلاق التنبيه والمتابعة"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Box (Strict plain text rendering with whitespace support) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#07090e]/90 border border-neutral-800/90 max-h-60 overflow-y-auto custom-scrollbar">
          <p className="font-tajawal text-xs sm:text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap select-text">
            {notice.content || 'أهلاً بك في منصة فضفضه! نتمنى لك تجربة ممتعة وراقية.'}
          </p>
        </div>

        {/* Action Button: Non-blocking close */}
        <div className="pt-1 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-850">
          <div className="text-[11px] text-neutral-400 font-tajawal flex items-center gap-1.5 self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>مجتمع فضفضه للحوار الراقي والآمن</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-cairo font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>حسناً، فهمت ومتابعة الاستخدام</span>
          </button>
        </div>
      </div>
    </div>
  );
};
