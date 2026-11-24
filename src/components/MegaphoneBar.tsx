import React, { useState } from 'react';
import { Lock, Megaphone, Send, X } from 'lucide-react';
import { postShoutout } from '../services/economy';
import { useApp } from '../state/AppContext';

export const MegaphoneBar: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { profile, isGuest, shoutouts, siteSettings, isStaff, setActiveSection } = useApp();
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'user' | 'admin' | 'urgent'>('user');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latest = shoutouts[0] ?? null;

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSending(true);
    try {
      await postShoutout(profile, text, isStaff ? kind : 'user', siteSettings.shoutoutCost);
      setText('');
      setComposerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر نشر النداء.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={
        compact
          ? 'rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 px-3 py-2'
          : 'bg-[#F8FAFC] dark:bg-[#0F171B] border-b border-slate-200/80 dark:border-white/10 px-4 py-1.5 shrink-0'
      }
    >
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
              latest?.kind === 'urgent'
                ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
                : 'bg-[#E6F4F0] dark:bg-[#132E28] text-[#0B7A62] dark:text-[#34D399]'
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
          </span>
          {latest ? (
            <p className="text-xs text-slate-700 dark:text-slate-200 truncate">
              <strong className="font-bold text-slate-900 dark:text-white">
                {latest.kind === 'urgent'
                  ? 'عاجل'
                  : latest.kind === 'admin'
                  ? 'الإدارة'
                  : latest.authorName}
                :
              </strong>{' '}
              <span>{latest.text}</span>
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              الميكروفون العام — أرسل نداءً يظهر لكل المتصلين لمدة 6 ساعات
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setComposerOpen((prev) => !prev)}
          className="min-h-[30px] px-2.5 rounded-lg bg-slate-200/70 dark:bg-[#1E2D36] hover:bg-slate-200 dark:hover:bg-[#273843] text-[11px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
        >
          ميكروفون · {isStaff ? 'مجاني' : `${siteSettings.shoutoutCost} عملة`}
        </button>
      </div>

      {composerOpen && isGuest && (
        <div className="max-w-[1440px] mx-auto mt-2 pt-2 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <p className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>استخدام الميكروفون العام متاح للأعضاء المسجلين فقط بعد ترقية الحساب.</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setComposerOpen(false);
              setActiveSection('settings');
            }}
            className="min-h-[30px] px-3 rounded-lg bg-[#0B7A62] text-white font-semibold cursor-pointer"
          >
            ترقية الحساب
          </button>
        </div>
      )}

      {composerOpen && !isGuest && (
        <form
          onSubmit={handlePost}
          className="max-w-[1440px] mx-auto mt-2 pt-2 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap items-center gap-2 fadfada-enter"
        >
          {isStaff && (
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as 'user' | 'admin' | 'urgent')}
              className="min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1114] text-xs"
            >
              <option value="user">نداء عضو</option>
              <option value="admin">إعلان إدارة</option>
              <option value="urgent">إعلان عاجل</option>
            </select>
          )}
          <input
            type="text"
            maxLength={240}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`اكتب رسالتك في الميكروفون العام (${isStaff ? 'مجاني' : `${siteSettings.shoutoutCost} عملة`})...`}
            className="flex-1 min-w-[180px] min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1114] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="min-h-[36px] px-3.5 rounded-lg bg-[#0B7A62] hover:bg-[#08634F] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 -scale-x-100" />
            <span>{sending ? 'جاري النشر...' : 'نشر'}</span>
          </button>
          <button
            type="button"
            onClick={() => setComposerOpen(false)}
            aria-label="إغلاق"
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/60 dark:hover:bg-[#1E2D36] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          {error && <p className="w-full text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        </form>
      )}
    </div>
  );
};
