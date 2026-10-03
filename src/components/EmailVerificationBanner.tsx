import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { Mail, CheckCircle2, AlertTriangle, Send, RefreshCw, X, ShieldCheck } from 'lucide-react';

export const EmailVerificationBanner: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check URL query for token or verification status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const status = params.get('status');

    if (token) {
      handleAutoVerifyToken(token);
    } else if (status === 'success') {
      setMessage({ type: 'success', text: 'تم تأكيد بريدك الإلكتروني بنجاح! تم تفعيل الحساب بالكامل 🌟' });
      setModalOpen(true);
      refreshUser();
      // Clean query from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleAutoVerifyToken = async (token: string) => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; message: string; user?: any }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      if (res.success) {
        setMessage({ type: 'success', text: res.message || 'تم تأكيد بريدك الإلكتروني بنجاح!' });
        setModalOpen(true);
        await refreshUser();
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'تعذر التحقق من الرابط' });
      setModalOpen(true);
    } finally {
      setLoading(false);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    try {
      setLoading(true);
      setMessage(null);
      const res = await apiRequest<{ success: boolean; message: string; user?: any }>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ code: code.trim() })
      });

      if (res.success) {
        setMessage({ type: 'success', text: res.message });
        await refreshUser();
        setTimeout(() => {
          setModalOpen(false);
        }, 2000);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'رمز التحقق غير صالح أو انتهت صلاحيته' });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;

    try {
      setResending(true);
      setMessage(null);
      const res = await apiRequest<{ success: boolean; message: string }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user?.email })
      });

      setMessage({ type: 'success', text: res.message || 'تم إرسال رسالة تحقق جديدة إلى بريدك!' });
      setResendCooldown(60); // 60 seconds cooldown
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'تعذر إعادة إرسال رسالة التحقق' });
    } finally {
      setResending(false);
    }
  };

  // If user is guest or already email verified, don't show the warning banner
  if (!user || user.isGuest || user.emailVerified) {
    // If modal was triggered by link query, still render the modal
    if (!modalOpen) return null;
  }

  return (
    <>
      {/* Top Warning Banner if not verified */}
      {user && !user.isGuest && !user.emailVerified && (
        <div className="bg-gradient-to-r from-amber-950/90 via-neutral-900 to-amber-950/80 border-b border-amber-600/40 px-4 py-2.5 text-xs font-tajawal text-amber-200 flex flex-wrap items-center justify-between gap-2 shadow-lg z-40 sticky top-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-500/20 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <span>
              <strong>تأكيد البريد الإلكتروني مطلوب:</strong> حسابك قيد التفعيل الجزئي. يرجى تأكيد ملكيتك للبريد ({user.email || 'المسجل'}) لتفعيل المراسلة وكامل الميزات.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setMessage(null);
                setModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              تأكيد الحساب الآن
            </button>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              title="إعادة إرسال رسالة التحقق"
            >
              {resendCooldown > 0 ? `انتظر (${resendCooldown} ث)` : 'إعادة إرسال ✉️'}
            </button>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute left-3 top-3 sm:left-4 sm:top-4 p-1.5 sm:p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-2 pt-2">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-950/80 border border-emerald-600/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-950/40">
                <Mail className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <h3 className="font-cairo font-black text-lg sm:text-xl text-white">تأكيد البريد الإلكتروني</h3>
              <p className="text-xs text-neutral-400 font-tajawal max-w-sm mx-auto leading-relaxed">
                تم إرسال رابط تأكيد ورمز تحقق مكون من 6 أرقام إلى بريدك الإلكتروني:
                <br />
                <strong className="text-emerald-400 font-mono text-xs sm:text-sm block mt-1 break-all">{user?.email || 'بريدك المسجل'}</strong>
              </p>
            </div>

            {message && (
              <div
                className={`p-2.5 sm:p-3 rounded-xl text-xs font-tajawal flex items-center gap-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-950/80 border border-emerald-600/50 text-emerald-200'
                    : 'bg-rose-950/80 border border-rose-600/50 text-rose-200'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {/* 6-digit Code Form */}
            <form onSubmit={handleVerifyCode} className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                  أدخل رمز التحقق (6 أرقام):
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="482910"
                  className="w-full text-center tracking-[4px] sm:tracking-[8px] font-mono text-xl sm:text-2xl font-bold px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-2.5 sm:py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{loading ? 'جاري التحقق...' : 'تأكيد الرمز وتفعيل الحساب'}</span>
              </button>
            </form>

            <div className="pt-2 border-t border-neutral-800 text-center space-y-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || resending}
                className="text-xs text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer font-tajawal flex items-center justify-center gap-1.5 mx-auto"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {resending
                    ? 'جاري الإرسال...'
                    : resendCooldown > 0
                    ? `يمكنك إعادة الإرسال بعد ${resendCooldown} ثانية`
                    : 'لم يصلك الرمز؟ اضغط لإعادة الإرسال'}
                </span>
              </button>

              <p className="text-[11px] text-neutral-500 font-tajawal">
                💡 تفقد أيضاً صندوق الرسائل غير المرغوب فيها (Junk / Spam).
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
