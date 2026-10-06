import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  MessageSquareHeart,
  ShieldCheck,
  Sparkles,
  Users,
  Compass,
  ArrowLeft,
  X,
  Lock,
  UserCheck,
  Calendar,
  Globe2,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  RefreshCw,
  KeyRound
} from 'lucide-react';
import { LegalModal, LegalTab } from './LegalModal';

const ARAB_COUNTRIES = [
  'مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان',
  'العراق', 'الأردن', 'لبنان', 'سوريا', 'فلسطين', 'اليمن', 'المغرب',
  'الجزائر', 'تونس', 'ليبيا', 'السودان', 'موريتانيا', 'الصومال', 'جيبوتي', 'جزر القمر',
  'تركيا', 'ألمانيا', 'المملكة المتحدة', 'السويد', 'الولايات المتحدة', 'كندا', 'أخرى'
];

interface LandingPageProps {
  onSuccess: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSuccess }) => {
  const { login, register, guestLogin } = useAuth();

  const [modalMode, setModalMode] = useState<'none' | 'login' | 'register' | 'guest' | 'forgot' | 'reset'>('none');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Forgot Password states
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Reset Password states
  const [resetToken, setResetToken] = useState('');
  const [resetUsername, setResetUsername] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [tokenVerifying, setTokenVerifying] = useState(false);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');

  // Form states
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Auto Country Detection states
  const [detectedCountry, setDetectedCountry] = useState<string>('مصر');
  const [detectedCountryCode, setDetectedCountryCode] = useState<string>('EG');
  const [isDetectingCountry, setIsDetectingCountry] = useState<boolean>(true);
  const [showManualCountryReg, setShowManualCountryReg] = useState<boolean>(false);
  const [showManualCountryGuest, setShowManualCountryGuest] = useState<boolean>(false);
  const [isManualCountryReg, setIsManualCountryReg] = useState<boolean>(false);
  const [isManualCountryGuest, setIsManualCountryGuest] = useState<boolean>(false);

  // Register form states
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regDob, setRegDob] = useState('2000-01-01');
  const [regGender, setRegGender] = useState<'female' | 'male'>('female');
  const [regCountry, setRegCountry] = useState('مصر');
  const [regBio, setRegBio] = useState('');
  const [regOwnerKey, setRegOwnerKey] = useState('');

  // Guest form states
  const [guestNickname, setGuestNickname] = useState('');
  const [guestGender, setGuestGender] = useState<'female' | 'male'>('female');
  const [guestCountry, setGuestCountry] = useState('مصر');
  const [guestAge18Confirmed, setGuestAge18Confirmed] = useState<boolean>(false);
  const [regTermsAgreed, setRegTermsAgreed] = useState<boolean>(false);
  const [guestTermsAgreed, setGuestTermsAgreed] = useState<boolean>(false);
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);

  // Automatic Server-Side Country Detection
  useEffect(() => {
    let isMounted = true;
    const fetchDetectedCountry = async () => {
      try {
        setIsDetectingCountry(true);
        const res = await apiRequest<{
          success: boolean;
          country: string;
          countryCode: string;
          detectedAutomatically: boolean;
        }>('/geo/detect');

        if (isMounted && res.country) {
          setDetectedCountry(res.country);
          setDetectedCountryCode(res.countryCode || 'EG');
          setRegCountry(res.country);
          setGuestCountry(res.country);
        }
      } catch (err) {
        console.error('Failed to auto-detect country:', err);
      } finally {
        if (isMounted) setIsDetectingCountry(false);
      }
    };

    fetchDetectedCountry();
    return () => {
      isMounted = false;
    };
  }, []);

  // Check URL query on mount for password reset token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('reset_token');
    const isResetPath = window.location.pathname.includes('reset-password');

    if (token || isResetPath) {
      if (token) {
        setResetToken(token);
        setModalMode('reset');
        verifyResetToken(token);
      }
    }
  }, []);

  const verifyResetToken = async (token: string) => {
    try {
      setTokenVerifying(true);
      setTokenInvalid(false);
      setError('');
      const res = await apiRequest<{ valid: boolean; username: string; email: string; error?: string }>(
        `/auth/verify-reset-token?token=${encodeURIComponent(token)}`
      );
      if (res && res.valid) {
        setResetUsername(res.username);
        setResetEmail(res.email);
      } else {
        setTokenInvalid(true);
        setError(res.error || 'رابط إعادة التعيين غير صالح أو انتهت صلاحيته');
      }
    } catch (err: any) {
      setTokenInvalid(true);
      setError(err.message || 'رابط إعادة التعيين غير صالح أو انتهت صلاحيته');
    } finally {
      setTokenVerifying(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setError('');
    setForgotSuccess('');
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail.trim() })
      });
      setForgotSuccess(res.message || 'إذا كان هذا البريد مسجلاً لدينا، فستصلك رسالة تحتوي على تعليمات ورابط إعادة تعيين كلمة المرور.');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إرسال الرابط');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      setError('يرجى ملء جميع الحقول');
      return;
    }
    if (newPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: resetToken,
          newPassword
        })
      });
      setResetSuccess(res.message || 'تم تغيير كلمة المرور بنجاح!');
      setTimeout(() => {
        setResetSuccess('');
        setLoginUsername(resetUsername || '');
        setLoginPassword('');
        setModalMode('login');
        window.history.replaceState({}, document.title, window.location.pathname.replace(/\/reset-password.*/, ''));
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'تعذر إعادة تعيين كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-neutral-800' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass) || /[a-z]/.test(pass)) score++;
    if (/\d/.test(pass)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pass)) score++;

    if (score <= 2) return { score: 1, label: 'ضعيفة', color: 'bg-rose-500' };
    if (score <= 3) return { score: 2, label: 'متوسطة', color: 'bg-amber-500' };
    return { score: 3, label: 'قوية جداً 🛡️', color: 'bg-emerald-500' };
  };

  // Age calculation helper
  const getCalculatedAge = (dob: string) => {
    if (!dob) return 0;
    const birth = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const currentAge = getCalculatedAge(regDob);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(loginUsername, loginPassword);
      setModalMode('none');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (currentAge < 18) {
      setError('عذراً، يجب أن يكون عمرك 18 عاماً فما فوق للانضمام إلى منصة فضفضه.');
      return;
    }

    if (!regTermsAgreed) {
      setError('يجب الموافقة الإلزامية على الشروط والأحكام وسياسة الخصوصية وسياسة الاستخدام المقبول لمنصة فضفضه.');
      return;
    }

    setLoading(true);
    try {
      await register({
        username: regUsername,
        email: regEmail,
        password: regPassword,
        dateOfBirth: regDob,
        gender: regGender,
        country: regCountry,
        isManualCountry: isManualCountryReg,
        bio: regBio,
        ownerKey: regOwnerKey,
        termsAgreed: true
      });
      setModalMode('none');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'فشل إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestAge18Confirmed) {
      setError('يجب تأكيد أن عمرك 18 عاماً فما فوق للدخول كزائر.');
      return;
    }
    if (!guestTermsAgreed) {
      setError('يجب الموافقة الإلزامية على الشروط والأحكام وسياسة الخصوصية وسياسة الاستخدام المقبول لمنصة فضفضه.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await guestLogin(
        guestNickname || 'زائر فضفضه',
        guestGender,
        guestCountry,
        isManualCountryGuest,
        true
      );
      setModalMode('none');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'فشل الدخول كزائر');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-neutral-100 flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Header */}
      <header className="border-b border-neutral-900/80 backdrop-blur-md sticky top-0 z-30 bg-[#07090e]/80">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <MessageSquareHeart className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-cairo font-black text-2xl tracking-wide text-white flex items-center gap-2">
                فضفضه
                <span className="text-xs font-normal font-tajawal text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/40">
                  Fadfada
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-tajawal">مجتمع المحادثات والتواصل الراقي</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setError('');
                setModalMode('login');
              }}
              className="px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => {
                setError('');
                setModalMode('register');
              }}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
            >
              إنشاء حساب جديد
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex items-center py-16 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 text-xs font-medium">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>المساحة الاجتماعية الأكثر خصوصية وأماناً للمجتمع العربي</span>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-cairo font-black text-white tracking-tight leading-tight">
              فضفض بحرية، <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
                وتواصل مع قلوب تشبهك
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg sm:text-xl text-neutral-400 font-tajawal leading-relaxed">
              منصة اجتماعية عربية صُممت لتمنحك مساحة راقية وآمنة للمحادثات الفورية، التعبير عن المشاعر، وحوارات المجالس الهادفة بأعلى معايير الخصوصية.
            </p>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 sm:gap-4 pt-4 w-full max-w-md sm:max-w-none mx-auto">
            <button
              onClick={() => {
                setError('');
                setModalMode('register');
              }}
              className="w-full sm:w-auto px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-3 cursor-pointer group active:scale-95"
            >
              <span>ابدأ رحلتك الآن</span>
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            </button>

            <button
              onClick={() => {
                setError('');
                setModalMode('guest');
              }}
              className="w-full sm:w-auto px-5 sm:px-7 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-neutral-900/90 hover:bg-neutral-800 text-neutral-200 hover:text-white font-semibold text-sm sm:text-base border border-neutral-800 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
            >
              <Users className="w-5 h-5 text-teal-400" />
              <span>دخول سريع كزائر (500 رسالة)</span>
            </button>

            <button
              onClick={() => {
                setError('');
                setModalMode('login');
              }}
              className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-neutral-900/50 hover:bg-neutral-800/80 text-neutral-300 font-medium text-sm sm:text-base border border-neutral-800/60 transition-all cursor-pointer text-center active:scale-95"
            >
              لدي حساب بالفعل
            </button>
          </div>

          {/* Value Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-right">
            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-cairo font-bold text-lg text-white">خصوصية صارمة 18+</h3>
              <p className="text-sm text-neutral-400 leading-relaxed font-tajawal">
                بيئة نقاشات ناضجة ومحمية تماماً، مع ميزة الصور ذاتية التدمير لضمان سرية محادثاتك.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-teal-950/60 border border-teal-800/40 flex items-center justify-center text-teal-400">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-cairo font-bold text-lg text-white">المتواجدون حسب بلدك</h3>
              <p className="text-sm text-neutral-400 leading-relaxed font-tajawal">
                دليل حي يتيح لك التواصل الفوري مع رواد المنصة من دولتك أولاً، وبألوان راقية تميز الحضور.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-cairo font-bold text-lg text-white">مجالس تفاعلية وألعاب</h3>
              <p className="text-sm text-neutral-400 leading-relaxed font-tajawal">
                غرف حوارية مخصصة، قصص 24 ساعة، مسابقات الأمثال، وعجلة الحظ اليومية لكسب الكوينز.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900/80 py-8 px-6 text-center text-sm text-neutral-500 font-tajawal">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-cairo font-bold text-neutral-300">فضفضه</span>
            <span>·</span>
            <span>Fadfada Platform © {new Date().getFullYear()}</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs text-neutral-400">
            <button
              type="button"
              onClick={() => setLegalTab('terms')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              الشروط والأحكام
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalTab('privacy')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              سياسة الخصوصية
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalTab('acceptable_use')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              الاستخدام المقبول
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalTab('content_policy')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              سياسة المحتوى
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalTab('reporting')}
              className="hover:text-emerald-400 transition-colors cursor-pointer"
            >
              الإبلاغ والحظر
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => setLegalTab('age18')}
              className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span className="px-1 py-0.5 bg-amber-950 text-amber-300 rounded border border-amber-800/60 text-[9px] font-bold">18+</span>
              الفئات العمرية
            </button>
          </div>

          <p className="text-xs text-neutral-500">
            جميع الحقوق محفوظة · منصة مخصصة للفئات العمرية 18+
          </p>
        </div>
      </footer>

      {/* Legal Modal */}
      {legalTab && (
        <LegalModal
          initialTab={legalTab}
          onClose={() => setLegalTab(null)}
        />
      )}

      {/* MODAL SYSTEM */}
      {modalMode !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0e1017] border border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-2xl space-y-4 sm:space-y-6 max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-neutral-800/60 pb-4">
              <div className="flex items-center gap-2">
                <MessageSquareHeart className="w-6 h-6 text-emerald-400" />
                <h2 className="font-cairo font-bold text-xl text-white">
                  {modalMode === 'login' && 'تسجيل الدخول إلى فضفضه'}
                  {modalMode === 'register' && 'إنشاء حساب جديد (18+)'}
                  {modalMode === 'guest' && 'الدخول السريع كزائر'}
                  {modalMode === 'forgot' && 'استعادة كلمة المرور 🔐'}
                  {modalMode === 'reset' && 'إعادة تعيين كلمة المرور الجديدة 🛡️'}
                </h2>
              </div>
              <button
                onClick={() => setModalMode('none')}
                className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message Display */}
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-sm flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* 1. LOGIN FORM */}
            {modalMode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    اسم المستخدم
                  </label>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="مثال: Ahmed_90"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-neutral-300">
                      كلمة المرور
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setForgotSuccess('');
                        setModalMode('forgot');
                      }}
                      className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer font-tajawal"
                    >
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm pl-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'جاري التحقق...' : 'دخول إلى المتواجدين حالياً'}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setModalMode('register');
                    }}
                    className="text-xs text-emerald-400 hover:underline cursor-pointer"
                  >
                    ليس لديك حساب؟ سجّل مجاناً الآن
                  </button>
                </div>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {modalMode === 'forgot' && (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs text-neutral-300 leading-relaxed font-tajawal">
                  أدخل البريد الإلكتروني المسجل في حسابك. سنرسل لك رسالة تتضمن رابطاً آمناً لإعادة تعيين كلمة المرور (صالح لمدة 60 دقيقة).
                </div>

                {forgotSuccess ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-200 text-xs font-tajawal leading-relaxed space-y-2">
                      <div className="font-bold flex items-center gap-1.5 text-sm text-emerald-300">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        تم إرسال الطلب بنجاح
                      </div>
                      <p>{forgotSuccess}</p>
                      <p className="text-[11px] text-neutral-400">
                        💡 تذكير: يرجى التحقق من صندوق الرسائل غير المرغوب فيها (Spam / Junk) أيضاً.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setModalMode('login');
                      }}
                      className="w-full py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      العودة لشاشة تسجيل الدخول
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                        البريد الإلكتروني المرتبط بالحساب
                      </label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="example@gmail.com"
                        className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !forgotEmail.trim()}
                      className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري الإرسال...</span>
                        </>
                      ) : (
                        <span>إرسال رابط الاستعادة ✉️</span>
                      )}
                    </button>

                    <div className="text-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setError('');
                          setModalMode('login');
                        }}
                        className="text-xs text-neutral-400 hover:text-white cursor-pointer font-tajawal"
                      >
                        تذكرت كلمة المرور؟ العودة لتسجيل الدخول
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            {/* RESET PASSWORD FORM */}
            {modalMode === 'reset' && (
              <div className="space-y-4">
                {tokenVerifying ? (
                  <div className="py-8 text-center space-y-3">
                    <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
                    <p className="text-xs text-neutral-400 font-tajawal">جاري التحقق من صلاحية رابط إعادة التعيين...</p>
                  </div>
                ) : tokenInvalid ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-800/60 text-rose-300 text-xs font-tajawal leading-relaxed">
                      ⚠️ رابط إعادة التعيين غير صالح أو انتهت صلاحيته (صلاحية الرابط 60 دقيقة ويستخدم لمرة واحدة فقط).
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        setForgotSuccess('');
                        setModalMode('forgot');
                      }}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
                    >
                      طلب رابط استعادة جديد
                    </button>
                  </div>
                ) : resetSuccess ? (
                  <div className="space-y-4 py-2">
                    <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-600/50 text-emerald-200 text-xs font-tajawal leading-relaxed text-center space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                      <div className="font-bold text-sm text-white">تم تغيير كلمة المرور بنجاح!</div>
                      <p className="text-neutral-300">{resetSuccess}</p>
                      <p className="text-[11px] text-emerald-400">جاري توجيهك لشاشة الدخول...</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setResetSuccess('');
                        setLoginUsername(resetUsername || '');
                        setModalMode('login');
                      }}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      تسجيل الدخول الآن
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResetSubmit} className="space-y-4">
                    <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs font-tajawal">
                      <span className="text-neutral-400">الحساب:</span>
                      <span className="font-bold text-emerald-400 font-cairo">{resetUsername || resetEmail}</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                        كلمة المرور الجديدة
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="6 أحرف أو أرقام على الأقل"
                          className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm pl-11"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute left-3 top-3 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>

                      {/* Password strength meter */}
                      {newPassword && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-tajawal text-neutral-400">
                            <span>قوة كلمة المرور:</span>
                            <span className="font-bold text-white">{getPasswordStrength(newPassword).label}</span>
                          </div>
                          <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden flex gap-1">
                            <div className={`h-full flex-1 rounded-full ${getPasswordStrength(newPassword).score >= 1 ? getPasswordStrength(newPassword).color : 'bg-transparent'}`} />
                            <div className={`h-full flex-1 rounded-full ${getPasswordStrength(newPassword).score >= 2 ? getPasswordStrength(newPassword).color : 'bg-transparent'}`} />
                            <div className={`h-full flex-1 rounded-full ${getPasswordStrength(newPassword).score >= 3 ? getPasswordStrength(newPassword).color : 'bg-transparent'}`} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                        تأكيد كلمة المرور الجديدة
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="أعد كتابة كلمة المرور الجديدة"
                        className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !newPassword || !confirmPassword}
                      className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري التحديث...</span>
                        </>
                      ) : (
                        <span>تأكيد وتغيير كلمة المرور</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* 2. REGISTER FORM (18+ ENFORCED) */}
            {modalMode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    اسم المستخدم الفريد
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="اختر اسماً لا يقل عن 3 أحرف"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                  {regUsername.trim().toLowerCase() === 'hegazy' && (
                    <div className="mt-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-xs text-amber-300">
                      اسم Hegazy محجوز لمالك المنصة. يرجى إدخال رمز التحقق الخاص بالمالك بالأسفل.
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5 flex items-center justify-between">
                    <span>البريد الإلكتروني الحقيقي</span>
                    <span className="text-[10px] text-emerald-400 font-normal">سيتم إرسال رسالة تحقق ✉️</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                {regUsername.trim().toLowerCase() === 'hegazy' && (
                  <div>
                    <label className="block text-xs font-semibold text-amber-400 mb-1.5">
                      رمز أمان المالك (Owner Security Key)
                    </label>
                    <input
                      type="password"
                      value={regOwnerKey}
                      onChange={(e) => setRegOwnerKey(e.target.value)}
                      placeholder="رمز التحقق الخاص بالمالك"
                      className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-amber-700/60 text-white placeholder:text-neutral-600 focus:outline-none text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="اختر كلمة مرور قوية"
                      className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm pl-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-neutral-500 hover:text-neutral-300 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* MANDATORY 18+ DOB */}
                <div className="p-3.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      تاريخ الميلاد (شرط 18+ إلزامي)
                    </label>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${currentAge >= 18 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                      العمر المحسوب: {currentAge} سنة
                    </span>
                  </div>
                  <input
                    type="date"
                    required
                    value={regDob}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setRegDob(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                  {currentAge < 18 && (
                    <p className="text-xs text-rose-400">
                      ⚠️ المنصة مخصصة للبالغين (18 عاماً فأكثر). لا يمكن التسجيل بعمر أقل من 18 عاماً.
                    </p>
                  )}
                </div>

                {/* Gender selection */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    الجنس
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRegGender('female')}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        regGender === 'female'
                          ? 'bg-rose-950/60 border-rose-500 text-rose-300 shadow-md shadow-rose-950/40'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      أنثى
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegGender('male')}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        regGender === 'male'
                          ? 'bg-sky-950/60 border-sky-500 text-sky-300 shadow-md shadow-sky-950/40'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      ذكر
                    </button>
                  </div>
                </div>

                {/* Automatic Country Detection Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-neutral-900 border border-emerald-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-xs text-neutral-300 font-tajawal">الدولة: </span>
                        <span className="text-xs font-bold text-emerald-400 font-cairo">
                          {isDetectingCountry ? 'جاري الكشف عبر الشبكة...' : regCountry}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700/50 font-tajawal">
                      {isManualCountryReg ? 'تحديد يدوي' : 'كشف تلقائي بالشبكة 🌍'}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-400 font-tajawal leading-relaxed">
                    تم تحديد دولتك تلقائياً بناءً على اتصال شبكتك لترتيب أعضاء ({regCountry}) أولاً في قائمة المتواجدين حالياً.
                  </p>

                  {!showManualCountryReg ? (
                    <button
                      type="button"
                      onClick={() => setShowManualCountryReg(true)}
                      className="text-[11px] text-emerald-400/90 hover:text-emerald-300 underline font-tajawal cursor-pointer flex items-center gap-1"
                    >
                      <span>هل التحديد غير دقيق أو تستخدم VPN؟ اضغط لتعديل الدولة يدوياً</span>
                    </button>
                  ) : (
                    <div className="pt-2 border-t border-neutral-800 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-neutral-300 font-tajawal">
                          اختر دولتك الصحيحة يدوياً:
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setRegCountry(detectedCountry);
                            setIsManualCountryReg(false);
                            setShowManualCountryReg(false);
                          }}
                          className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                        >
                          استعادة الكشف التلقائي ({detectedCountry})
                        </button>
                      </div>
                      <select
                        value={regCountry}
                        onChange={(e) => {
                          setRegCountry(e.target.value);
                          setIsManualCountryReg(true);
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-emerald-500 text-xs"
                      >
                        {ARAB_COUNTRIES.map((c) => (
                          <option key={c} value={c} className="bg-neutral-900 text-white">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Short Bio */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    نبذة قصيرة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={regBio}
                    onChange={(e) => setRegBio(e.target.value)}
                    placeholder="عبارة تعبر عنك في ملفك الشخصي"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 text-sm"
                  />
                </div>

                {/* Mandatory Terms & Policies Checkbox */}
                <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="regTermsConsentCheck"
                    required
                    checked={regTermsAgreed}
                    onChange={(e) => setRegTermsAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-emerald-500 cursor-pointer shrink-0"
                  />
                  <label htmlFor="regTermsConsentCheck" className="text-xs text-neutral-300 leading-relaxed font-tajawal cursor-pointer select-none">
                    أوافق على{' '}
                    <button
                      type="button"
                      onClick={() => setLegalTab('terms')}
                      className="text-emerald-400 underline hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      الشروط والأحكام
                    </button>{' '}
                    و{' '}
                    <button
                      type="button"
                      onClick={() => setLegalTab('privacy')}
                      className="text-emerald-400 underline hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      سياسة الخصوصية
                    </button>{' '}
                    و{' '}
                    <button
                      type="button"
                      onClick={() => setLegalTab('acceptable_use')}
                      className="text-emerald-400 underline hover:text-emerald-300 font-semibold cursor-pointer"
                    >
                      سياسة الاستخدام المقبول
                    </button>{' '}
                    لمنصة فضفضه.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || currentAge < 18 || !regTermsAgreed}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'جاري إنشاء الحساب...' : 'إتمام التسجيل والدخول للمتصلين الآن'}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setModalMode('login');
                    }}
                    className="text-xs text-neutral-400 hover:text-neutral-200 cursor-pointer"
                  >
                    لديك حساب بالفعل؟ تسجيل الدخول
                  </button>
                </div>
              </form>
            )}

            {/* 3. GUEST ENTRY FORM */}
            {modalMode === 'guest' && (
              <form onSubmit={handleGuestSubmit} className="space-y-4">
                <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-800/40 text-teal-300 text-xs leading-relaxed">
                  💡 يتيح لك نظام الزائر الدخول الفوري وتجربة كامل المنصة برصيد <strong>500 رسالة</strong>. يمكنك في أي وقت ترقية حسابك مجاناً.
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    اللقب أو الاسم المستعار
                  </label>
                  <input
                    type="text"
                    required
                    value={guestNickname}
                    onChange={(e) => setGuestNickname(e.target.value)}
                    placeholder="مثال: نسيم الليل"
                    className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-600 focus:outline-none focus:border-teal-500 text-sm"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    الجنس
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGuestGender('female')}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        guestGender === 'female'
                          ? 'bg-rose-950/60 border-rose-500 text-rose-300 shadow-md shadow-rose-950/40'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      أنثى
                    </button>
                    <button
                      type="button"
                      onClick={() => setGuestGender('male')}
                      className={`py-2.5 px-3 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                        guestGender === 'male'
                          ? 'bg-sky-950/60 border-sky-500 text-sky-300 shadow-md shadow-sky-950/40'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                      ذكر
                    </button>
                  </div>
                </div>

                {/* Automatic Country Detection Card for Guest */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/40 via-emerald-950/20 to-neutral-900 border border-teal-800/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Globe2 className="w-4 h-4 text-teal-400 shrink-0" />
                      <div>
                        <span className="text-xs text-neutral-300 font-tajawal">الدولة: </span>
                        <span className="text-xs font-bold text-teal-400 font-cairo">
                          {isDetectingCountry ? 'جاري الكشف عبر الشبكة...' : guestCountry}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-700/50 font-tajawal">
                      {isManualCountryGuest ? 'تحديد يدوي' : 'كشف تلقائي بالشبكة 🌍'}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-400 font-tajawal leading-relaxed">
                    تم تحديد دولتك تلقائياً لترتيب المتواجدين من ({guestCountry}) أولاً في قائمة المتواجدين حالياً.
                  </p>

                  {!showManualCountryGuest ? (
                    <button
                      type="button"
                      onClick={() => setShowManualCountryGuest(true)}
                      className="text-[11px] text-teal-400/90 hover:text-teal-300 underline font-tajawal cursor-pointer flex items-center gap-1"
                    >
                      <span>هل التحديد غير دقيق؟ اضغط لتعديل الدولة يدوياً</span>
                    </button>
                  ) : (
                    <div className="pt-2 border-t border-neutral-800 space-y-1.5 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-semibold text-neutral-300 font-tajawal">
                          اختر دولتك الصحيحة يدوياً:
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setGuestCountry(detectedCountry);
                            setIsManualCountryGuest(false);
                            setShowManualCountryGuest(false);
                          }}
                          className="text-[10px] text-teal-400 hover:underline cursor-pointer"
                        >
                          استعادة الكشف التلقائي ({detectedCountry})
                        </button>
                      </div>
                      <select
                        value={guestCountry}
                        onChange={(e) => {
                          setGuestCountry(e.target.value);
                          setIsManualCountryGuest(true);
                        }}
                        className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white focus:outline-none focus:border-teal-500 text-xs"
                      >
                        {ARAB_COUNTRIES.map((c) => (
                          <option key={c} value={c} className="bg-neutral-900 text-white">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 18+ Mandatory Age Confirmation for Guest */}
                <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="guestAge18Check"
                    required
                    checked={guestAge18Confirmed}
                    onChange={(e) => setGuestAge18Confirmed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-teal-500 cursor-pointer shrink-0"
                  />
                  <label htmlFor="guestAge18Check" className="text-xs text-neutral-300 leading-relaxed font-tajawal cursor-pointer select-none">
                    أقر وأتعهد بأن عمري <strong className="text-white">18 عاماً فما فوق</strong>، وأتحمل المسؤولية الشخصية عن كافة أفعالي داخل المنصة.
                  </label>
                </div>

                {/* Mandatory Terms & Policies Checkbox for Guest */}
                <div className="p-3.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="guestTermsConsentCheck"
                    required
                    checked={guestTermsAgreed}
                    onChange={(e) => setGuestTermsAgreed(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded accent-teal-500 cursor-pointer shrink-0"
                  />
                  <label htmlFor="guestTermsConsentCheck" className="text-xs text-neutral-300 leading-relaxed font-tajawal cursor-pointer select-none">
                    أوافق على{' '}
                    <button
                      type="button"
                      onClick={() => setLegalTab('terms')}
                      className="text-teal-400 underline hover:text-teal-300 font-semibold cursor-pointer"
                    >
                      الشروط والأحكام
                    </button>{' '}
                    و{' '}
                    <button
                      type="button"
                      onClick={() => setLegalTab('privacy')}
                      className="text-teal-400 underline hover:text-teal-300 font-semibold cursor-pointer"
                    >
                      سياسة الخصوصية
                    </button>{' '}
                    و{' '}
                    <button
                      type="button"
                      onClick={() => setLegalTab('acceptable_use')}
                      className="text-teal-400 underline hover:text-teal-300 font-semibold cursor-pointer"
                    >
                      سياسة الاستخدام المقبول
                    </button>{' '}
                    لمنصة فضفضه.
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading || !guestAge18Confirmed || !guestTermsAgreed}
                  className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-lg shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? 'جاري تجهيز جلسة الزائر...' : 'دخول فوري إلى المتواجدين حالياً'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
