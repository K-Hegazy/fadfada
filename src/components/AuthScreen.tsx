import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  LogIn,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { appwriteConfigError, isAppwriteConfigured } from '../appwrite/config';
import {
  completePasswordReset,
  isAnonymousAuthDisabledError,
  translateAuthError,
} from '../services/auth';
import { useApp } from '../state/AppContext';
import type { GenderType } from '../types/fadfada';
import welcomeArt from '../assets/images/fadfada_welcome_art_1795297623031.jpg';
import { TermsModal } from './TermsModal';
import { FeedbackBanner } from './ui/Primitives';

type AuthMode = 'login' | 'signup' | 'reset' | 'recovery_confirm';

export const AuthScreen: React.FC = () => {
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    loginAsGuest,
    sendResetEmail,
    theme,
    toggleTheme,
  } = useApp();

  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signupAcceptedTerms, setSignupAcceptedTerms] = useState(false);

  // Guest onboarding modal state (18+ & Terms)
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestAge, setGuestAge] = useState('');
  const [guestGender, setGuestGender] = useState<GenderType>('unspecified');
  const [guestIsAdult, setGuestIsAdult] = useState(false);
  const [guestAcceptedTerms, setGuestAcceptedTerms] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);

  // Terms modal context
  const [termsModalFor, setTermsModalFor] = useState<'signup' | 'guest' | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [guestDisabled, setGuestDisabled] = useState(false);
  const [artFallback, setArtFallback] = useState(false);
  const [recoveryParams, setRecoveryParams] = useState<{ userId: string; secret: string } | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_error') === 'google') {
      setErrorMessage('تعذر إتمام تسجيل الدخول بحساب Google. تأكد من تفعيل مزود Google OAuth في Appwrite Console.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (params.get('recovery') === '1') {
      const userId = params.get('userId');
      const secret = params.get('secret');
      if (userId && secret) {
        setRecoveryParams({ userId, secret });
        setMode('recovery_confirm');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (mode === 'recovery_confirm' && recoveryParams) {
      if (password.length < 8) {
        setErrorMessage('كلمة المرور الجديدة يجب أن لا تقل عن 8 أحرف.');
        return;
      }
      setSubmitting(true);
      try {
        await completePasswordReset(recoveryParams.userId, recoveryParams.secret, password);
        setPassword('');
        setRecoveryParams(null);
        setMode('login');
        setSuccessMessage('تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.');
      } catch (error) {
        setErrorMessage(translateAuthError(error));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim()) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني.');
      return;
    }
    if (mode === 'reset') {
      setSubmitting(true);
      try {
        await sendResetEmail(email);
        setSuccessMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
      } catch (error) {
        setErrorMessage(translateAuthError(error));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!password) {
      setErrorMessage('يرجى إدخال كلمة المرور.');
      return;
    }
    if (mode === 'signup') {
      if (password.length < 8) {
        setErrorMessage('كلمة المرور يجب أن لا تقل عن 8 أحرف.');
        return;
      }
      if (!displayName.trim()) {
        setErrorMessage('يرجى إدخال الاسم الظاهر لإنشاء الحساب.');
        return;
      }
      if (!signupAcceptedTerms) {
        setErrorMessage('يجب الموافقة على الشروط والأحكام وسياسة الاستخدام قبل إنشاء الحساب.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, displayName, signupAcceptedTerms);
      }
    } catch (error) {
      setErrorMessage(translateAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (error) {
      setErrorMessage(translateAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuestError(null);
    setErrorMessage(null);

    const trimmedName = guestName.trim();
    if (trimmedName.length < 2) {
      setGuestError('يرجى إدخال اسم ظاهر لا يقل عن حرفين.');
      return;
    }

    const parsedAge = Number(guestAge);
    if (!Number.isFinite(parsedAge) || parsedAge < 18 || parsedAge > 120) {
      setGuestError('عذرًا، منصة فضفضة متاحة فقط لمن هم في عمر 18 سنة أو أكثر.');
      return;
    }

    if (guestGender !== 'male' && guestGender !== 'female') {
      setGuestError('يرجى تحديد الجنس للمتابعة.');
      return;
    }

    if (!guestIsAdult) {
      setGuestError('يجب الإقرار بأن عمرك 18 سنة أو أكثر للمتابعة.');
      return;
    }

    if (!guestAcceptedTerms) {
      setGuestError('يجب الموافقة على الشروط والأحكام وسياسة الاستخدام قبل الدخول.');
      return;
    }

    setSubmitting(true);
    try {
      await loginAsGuest({
        displayName: trimmedName,
        age: Math.floor(parsedAge),
        gender: guestGender,
        acceptedTerms: guestAcceptedTerms,
      });
      setShowGuestModal(false);
    } catch (error) {
      if (isAnonymousAuthDisabledError(error)) {
        setGuestDisabled(true);
      }
      setGuestError(translateAuthError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectOwnerLogin = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setMode('login');
    setEmail('');
    setPassword('');
    window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 0);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F2F4F7] dark:bg-[#0B1114] text-[#0F172A] dark:text-[#F1F5F9]">
      {/* Compact Portal Header */}
      <header className="w-full bg-white dark:bg-[#121B20] border-b border-slate-200/80 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#0B7A62] text-white flex items-center justify-center font-display font-bold text-sm">
              ف
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-base font-bold text-[#0B7A62] dark:text-[#34D399]">
                فضفضة
              </span>
              <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400">
                شات فضفضة ودردشة عربية فورية
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37] transition-colors cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-3 sm:px-6 py-5 sm:py-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 items-stretch bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-xl overflow-hidden shadow-xs fadfada-enter">
          {/* Direct Login / Signup / Guest Entry Column */}
          <div className="lg:col-span-7 p-5 sm:p-7 flex flex-col justify-center">
            <div className="mb-4">
              <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50">
                فضفضة — شات فضفضة ودردشة عربية فورية
              </h1>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                منصة دردشة عربية تجمع غرف الشات النشطة، المراسلة الخاصة بالصوت والفيديو، والحائط التفاعلي — ادخل بحسابك أو كضيف في ثوانٍ.
              </p>
            </div>

            {!isAppwriteConfigured && appwriteConfigError && (
              <div
                role="alert"
                className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 text-xs leading-relaxed"
              >
                {appwriteConfigError}
              </div>
            )}

            {errorMessage && (
              <div className="mb-3">
                <FeedbackBanner type="error" message={errorMessage} />
              </div>
            )}

            {successMessage && (
              <div className="mb-3">
                <FeedbackBanner type="success" message={successMessage} />
              </div>
            )}

            {/* Primary Fast Actions: Google + Guest (opens 18+ form) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogle}
                className="min-h-[42px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-60 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4 shrink-0" />
                <span>المتابعة باستخدام Google</span>
              </button>

              <button
                type="button"
                disabled={submitting || guestDisabled}
                onClick={() => {
                  setGuestError(null);
                  setShowGuestModal(true);
                }}
                className="min-h-[42px] px-4 rounded-lg border border-[#0B7A62]/30 dark:border-[#34D399]/30 bg-[#E6F4F0] hover:bg-[#d7ede7] dark:bg-[#14332C] dark:hover:bg-[#194037] text-[#0B7A62] dark:text-[#34D399] text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <UserCheck className="w-4 h-4 shrink-0" />
                <span>{guestDisabled ? 'دخول الضيف غير متاح' : 'الدخول السريع كضيف'}</span>
              </button>
            </div>

            <div className="my-4 flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
              <span className="flex-1 h-px bg-slate-200/80 dark:bg-white/10" />
              <span>أو الدخول بالبريد الإلكتروني</span>
              <span className="flex-1 h-px bg-slate-200/80 dark:bg-white/10" />
            </div>

            {/* Compact Mode Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 mb-3.5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`min-h-[34px] rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'login'
                    ? 'bg-white dark:bg-[#18242B] text-slate-900 dark:text-slate-50 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                دخول
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`min-h-[34px] rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-[#18242B] text-slate-900 dark:text-slate-50 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                حساب جديد
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={`min-h-[34px] rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'reset'
                    ? 'bg-white dark:bg-[#18242B] text-slate-900 dark:text-slate-50 shadow-2xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                نسيت كلمة السر
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-2.5">
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-display-name"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    الاسم الظاهر
                  </label>
                  <input
                    id="auth-display-name"
                    type="text"
                    maxLength={60}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="مثال: سارة أحمد"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                  />
                </div>
              )}

              {mode !== 'recovery_confirm' && (
                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    البريد الإلكتروني
                  </label>
                  <input
                    ref={emailInputRef}
                    id="auth-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                  />
                </div>
              )}

              {mode !== 'reset' && (
                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1"
                  >
                    {mode === 'recovery_confirm' ? 'كلمة المرور الجديدة (8 أحرف على الأقل)' : 'كلمة المرور'}
                  </label>
                  <div className="relative">
                    <input
                      ref={passwordInputRef}
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      minLength={mode === 'signup' || mode === 'recovery_confirm' ? 8 : undefined}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[40px] pl-10 pr-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute left-1 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div className="pt-1 flex items-start justify-between gap-2 text-xs">
                  <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={signupAcceptedTerms}
                      onChange={(e) => setSignupAcceptedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#0B7A62] cursor-pointer"
                    />
                    <span>أوافق على الشروط والأحكام وسياسة الاستخدام (لأعمار 18+ فقط)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setTermsModalFor('signup')}
                    className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399] hover:underline shrink-0 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>الشروط والأحكام</span>
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[42px] px-4 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
              >
                {mode === 'login' && (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>{submitting ? 'جاري الدخول...' : 'دخول بالحساب'}</span>
                  </>
                )}
                {mode === 'signup' && (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{submitting ? 'جاري الإنشاء...' : 'إنشاء حساب جديد'}</span>
                  </>
                )}
                {mode === 'reset' && (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{submitting ? 'جاري الإرسال...' : 'إرسال رابط الاستعادة'}</span>
                  </>
                )}
                {mode === 'recovery_confirm' && (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>{submitting ? 'جاري التحديث...' : 'حفظ كلمة المرور الجديدة'}</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-white/10 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setTermsModalFor('signup')}
                className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#0B7A62] dark:hover:text-[#34D399] underline cursor-pointer"
              >
                الشروط والأحكام وسياسة الاستخدام
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSelectOwnerLogin}
                className="min-h-[32px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-slate-700 dark:text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
                <span>الدخول بحساب المالك</span>
              </button>
            </div>
          </div>

          {/* Community Portal Showcase Column */}
          <div className="hidden lg:flex lg:col-span-5 relative bg-[#0B1114] border-r border-slate-200/80 dark:border-white/10">
            {!artFallback ? (
              <img
                src={welcomeArt}
                alt="مجتمع فضفضة للتواصل الفوري"
                referrerPolicy="no-referrer"
                onError={() => setArtFallback(true)}
                className="w-full h-full object-cover opacity-85"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center p-10 bg-gradient-to-br from-[#0B7A62] to-[#0B1114]">
                <span className="font-display text-4xl font-bold text-white">فضفضة</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15 p-6 flex flex-col justify-end text-white">
              <p className="font-display text-lg font-bold leading-snug">
                دردشة مباشرة، غرف نشطة، وتفاعل لحظي
              </p>
              <ul className="mt-3 space-y-1.5 text-xs text-white/90">
                <li className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                  <span>دليل المتواجدين الآن والتعارف الفوري</span>
                </li>
                <li className="flex items-center gap-2">
                  <MessageCircle className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                  <span>غرف عامة ورسائل خاصة بالصوت والفيديو والهمس</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                  <span>حائط يومي، صندوق الأسرار، وهدايا ومتجر الأعضاء</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Guest Entry Modal (18+ & Terms Enforcement) */}
      {showGuestModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label="تسجيل الدخول كضيف"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden fadfada-modal-in">
            <header className="px-4 py-3 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#0B7A62] dark:text-[#34D399]" />
                <h2 className="font-display text-sm sm:text-base font-bold">
                  الدخول السريع كضيف (18+)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowGuestModal(false)}
                aria-label="إغلاق"
                className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            <form onSubmit={handleGuestSubmit} className="p-4 sm:p-5 space-y-3 text-xs">
              <p className="p-2.5 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] text-slate-600 dark:text-slate-300 leading-relaxed">
                حساب الضيف مخصص للتجربة والدردشة المباشرة. لا يمتلك الضيف عملات أو ميزات المتجر والهدايا، ويمكنك ترقية الحساب إلى عضو دائم في أي وقت.
              </p>

              {guestError && <FeedbackBanner type="error" message={guestError} />}

              <div>
                <label className="block font-semibold mb-1">الاسم الظاهر</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="اختر اسمًا مناسبًا..."
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold mb-1">العمر (18+ فقط)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={120}
                    value={guestAge}
                    onChange={(e) => setGuestAge(e.target.value)}
                    placeholder="مثال: 22"
                    className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">الجنس</label>
                  <select
                    required
                    value={guestGender}
                    onChange={(e) => setGuestGender(e.target.value as GenderType)}
                    className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                  >
                    <option value="unspecified">اختر الجنس...</option>
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-200 pt-1">
                <input
                  type="checkbox"
                  checked={guestIsAdult}
                  onChange={(e) => setGuestIsAdult(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#0B7A62] cursor-pointer"
                />
                <span>أقر أن عمري 18 سنة أو أكثر</span>
              </label>

              <div className="flex items-start justify-between gap-2">
                <label className="flex items-start gap-2 cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={guestAcceptedTerms}
                    onChange={(e) => setGuestAcceptedTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#0B7A62] cursor-pointer"
                  />
                  <span>أوافق على الشروط والأحكام وسياسة الاستخدام</span>
                </label>
                <button
                  type="button"
                  onClick={() => setTermsModalFor('guest')}
                  className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399] hover:underline shrink-0 cursor-pointer"
                >
                  قراءة الشروط
                </button>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGuestModal(false)}
                  className="min-h-[38px] px-4 rounded-lg border border-slate-200/80 dark:border-white/10 text-xs font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-[38px] px-5 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                >
                  {submitting ? 'جاري الدخول...' : 'دخول الآن كضيف'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Terms & Conditions Modal */}
      <TermsModal
        open={termsModalFor !== null}
        onClose={() => setTermsModalFor(null)}
        onAccept={() => {
          if (termsModalFor === 'guest') setGuestAcceptedTerms(true);
          if (termsModalFor === 'signup') setSignupAcceptedTerms(true);
        }}
      />
    </div>
  );
};
