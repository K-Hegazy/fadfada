import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Coins,
  Crown,
  Sparkles,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Zap,
  Gift,
  HelpCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  ExternalLink
} from 'lucide-react';
import { CoinPackage } from '../types';

export const WalletPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [walletData, setWalletData] = useState<any>(null);
  const [coinPackages, setCoinPackages] = useState<CoinPackage[]>([]);
  const [vipPlans, setVipPlans] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<'recharge' | 'vip' | 'history'>('recharge');
  const [loading, setLoading] = useState<boolean>(true);
  const [rechargingId, setRechargingId] = useState<string | null>(null);
  const [purchasingVip, setPurchasingVip] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const [resWallet, resVip, resPackages] = await Promise.all([
        apiRequest('/wallet').catch(() => null),
        apiRequest('/vip/plans').catch(() => ({ plans: [] })),
        apiRequest('/coins/packages').catch(() => ({ packages: [] }))
      ]);

      if (resWallet) setWalletData(resWallet);
      if (resVip && resVip.plans && resVip.plans.length > 0) {
        setVipPlans(resVip.plans);
      }
      if (resPackages && resPackages.packages && resPackages.packages.length > 0) {
        setCoinPackages(resPackages.packages);
      }
    } catch (err) {
      console.error('Failed to load wallet data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleSimulateRecharge = async (pkg: CoinPackage) => {
    if (user?.isGuest) {
      showNotice('شحن الكوينز متاح فقط للحسابات المسجلة. يرجى تسجيل حسابك أولاً!', 'error');
      return;
    }

    setRechargingId(pkg.id);
    try {
      const res = await apiRequest<{ success: boolean; message: string; coins: number; coinsAdded: number }>('/coins/purchase', {
        method: 'POST',
        body: JSON.stringify({ packageId: pkg.id })
      });

      showNotice(res.message || `تم شحن ${pkg.coins + (pkg.bonusCoins || 0)} كوينز بنجاح في الوضع التجريبي! ✨`, 'success');
      if (refreshUser) await refreshUser();
      await fetchWallet();
    } catch (err: any) {
      showNotice(err.message || 'فشلت عملية المحاكاة، يرجى المحاولة لاحقاً', 'error');
    } finally {
      setRechargingId(null);
    }
  };

  const handleBuyVip = async (tier: string, planName: string, priceCoins: number) => {
    if (user?.isGuest) {
      showNotice('عضويات VIP مخصصة للحسابات المسجلة فقط.', 'error');
      return;
    }

    if ((user?.coins || 0) < priceCoins) {
      showNotice(`رصيد الكوينز غير كافٍ. تحتاج إلى ${priceCoins.toLocaleString('ar-EG')} كوينز (رصيدك الحالي: ${(user?.coins || 0).toLocaleString('ar-EG')})`, 'error');
      return;
    }

    setPurchasingVip(tier);
    try {
      const res = await apiRequest('/vip/purchase', {
        method: 'POST',
        body: JSON.stringify({ tier })
      });
      showNotice(res.message || `مبروك! تم تفعيل اشتراك ${planName} بنجاح! 👑`, 'success');
      if (refreshUser) await refreshUser();
      await fetchWallet();
    } catch (err: any) {
      showNotice(err.message || 'فشل شراء باقة VIP', 'error');
    } finally {
      setPurchasingVip(null);
    }
  };

  const defaultVipTiers = [
    { id: 'bronze', name: 'VIP البرونزي', priceCoins: 200, days: 30, color: 'from-amber-800 to-amber-950', border: 'border-amber-700', icon: '🥉', perks: ['شارة VIP برونزية مميزة في الملف والدردشة', 'أولوية ظهور في قائمة المتواجدين حالياً', 'مضاعفة نقاط الخبرة (1.2x)'] },
    { id: 'silver', name: 'VIP الفضي', priceCoins: 500, days: 30, color: 'from-slate-700 to-slate-900', border: 'border-slate-500', icon: '🥈', perks: ['شارة فضية براقة بجانب اسمك', 'ظهور عالي الأولوية في المتواجدين والمجالس', 'مضاعفة نقاط الخبرة (1.5x)', 'فقاعة رسائل فضية خاصة'] },
    { id: 'gold', name: 'VIP الذهبي', priceCoins: 1000, days: 30, color: 'from-yellow-600 to-amber-900', border: 'border-yellow-500', icon: '🥇', perks: ['تاج ذهبي متوهج بجانب اسمك', 'صدارة قائمة المتواجدين حالياً', 'مضاعفة نقاط الخبرة (2x)', 'إنشاء مجالس وغرف دون قيود'] },
    { id: 'royal', name: 'VIP الملكي', priceCoins: 2500, days: 30, color: 'from-purple-900 to-indigo-950', border: 'border-purple-500', icon: '👑', perks: ['شارة الألماس الملكي ذات البريق المتحرك', 'تثبيت استثنائي في مقدمة المتواجدين', 'مضاعفة نقاط الخبرة (3x)', 'دخول كافة الغرف المغلقة'] }
  ];

  const activePlans = vipPlans.length > 0 ? vipPlans : defaultVipTiers;

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in pb-12">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-xl transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/80 shadow-emerald-950/50'
              : 'bg-rose-950/90 text-rose-200 border border-rose-500/80 shadow-rose-950/50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="font-tajawal">{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs opacity-75 hover:opacity-100 cursor-pointer px-2 py-1 rounded-lg bg-black/20"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Wallet Balance Hero */}
      <div className="p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-amber-950/80 via-neutral-900 to-[#0e1017] border border-amber-800/50 relative overflow-hidden shadow-2xl">
        <div className="absolute -top-16 -left-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold font-tajawal">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>محفظة كوينز واقتصاد فضفضه</span>
            </div>

            <div className="flex items-baseline gap-3">
              <div className="text-4xl sm:text-6xl font-cairo font-black text-white tracking-tight">
                {(walletData?.balance ?? user?.coins ?? 0).toLocaleString('ar-EG')}
              </div>
              <span className="text-xs sm:text-sm font-bold text-amber-400 font-cairo bg-amber-950/80 px-3 py-1 rounded-xl border border-amber-800/70 shadow-sm">
                كوينز
              </span>
            </div>

            <p className="text-xs sm:text-sm text-neutral-300 font-tajawal max-w-xl leading-relaxed">
              عملة فضفضه الرسمية: تتيح لك ترقية باقات VIP الملكية، اقتناء الشارات النادرة وإطارات الملف الشخصي، وإرسال الهدايا الراقية في الدردشات والمجالس.
            </p>
          </div>

          {/* Current VIP Status Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/80 border border-neutral-800 text-xs space-y-2.5 max-w-sm backdrop-blur-sm shadow-lg shrink-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-neutral-400 font-medium">حالة العضوية:</span>
              <div className="flex items-center gap-1.5 font-bold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-xl border border-amber-800/60">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>{user?.vipLevel && user?.vipLevel !== 'none' ? `VIP ${user.vipLevel.toUpperCase()}` : 'عضوية قياسية'}</span>
              </div>
            </div>

            {walletData?.vipExpiresAt ? (
              <p className="text-neutral-400 text-[11px] font-tajawal border-t border-neutral-800/80 pt-2">
                صالح حتى: {new Date(walletData.vipExpiresAt).toLocaleDateString('ar-EG')}
              </p>
            ) : (
              <p className="text-neutral-500 text-[11px] font-tajawal border-t border-neutral-800/80 pt-2">
                قم بالترقية للتميز بشارات التاج والظهور في صدارة المتواجدين.
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setActiveSection('recharge')}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs transition-colors cursor-pointer text-center"
              >
                شحن كوينز
              </button>
              <button
                onClick={() => setActiveSection('vip')}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors cursor-pointer text-center"
              >
                ترقية VIP
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Segmented Switcher */}
      <div className="flex items-center gap-2 p-1 bg-neutral-900/90 border border-neutral-800 rounded-2xl max-w-xl">
        <button
          onClick={() => setActiveSection('recharge')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSection === 'recharge'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          <span>باقات شحن الكوينز</span>
        </button>

        <button
          onClick={() => setActiveSection('vip')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSection === 'vip'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Crown className="w-4 h-4 text-purple-400" />
          <span>عضويات VIP الملكية</span>
        </button>

        <button
          onClick={() => setActiveSection('history')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSection === 'history'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4 text-neutral-400" />
          <span>سجل العمليات</span>
        </button>
      </div>

      {/* SECTION 1: COIN PACKAGES (باقات شحن الكوينز) */}
      {activeSection === 'recharge' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Readiness / Sandbox Banner */}
          <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-neutral-900/90 border border-amber-600/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Zap className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-cairo font-bold text-sm text-white">
                  <span>وضع التجهيز والمحاكاة التجريبية (Sandbox Mode)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-sans font-bold">
                    جاهز للتكامل
                  </span>
                </div>
                <p className="text-xs text-neutral-300 font-tajawal leading-relaxed">
                  نظام شحن الكوينز مهيأ بالكامل ومدروس اقتصادياً. لن يتم خصم أي أموال حقيقية في هذه المرحلة. انقر على أي باقة لاختبار إضافة الكوينز لحسابك وتحديث الرصيد وسجل المعاملات فورياً!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-neutral-400 font-tajawal shrink-0 bg-black/30 px-3 py-2 rounded-xl border border-neutral-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>نظام محمي ومتوافق مع قواعد الاقتصاد</span>
            </div>
          </div>

          {/* Coin Packages Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {coinPackages.map((pkg) => {
              const isProcessing = rechargingId === pkg.id;
              const totalCoins = pkg.coins + (pkg.bonusCoins || 0);

              return (
                <div
                  key={pkg.id}
                  className={`p-5 rounded-3xl border flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden transition-all hover:scale-[1.02] ${
                    pkg.popular
                      ? 'bg-gradient-to-b from-amber-950/80 via-neutral-900 to-[#0e1017] border-amber-500/80 shadow-amber-950/40 ring-1 ring-amber-500/40'
                      : 'bg-gradient-to-b from-neutral-900 via-neutral-900/90 to-[#0e1017] border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* Badge */}
                  {pkg.badge && (
                    <div className="absolute top-3 left-3">
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-neutral-950 shadow-md">
                        {pkg.badge}
                      </span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="text-4xl">{pkg.icon || '🪙'}</div>

                    <div>
                      <h3 className="font-cairo font-black text-base text-white">{pkg.name}</h3>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="font-cairo font-black text-2xl text-amber-400">
                          {totalCoins.toLocaleString('ar-EG')}
                        </span>
                        <span className="text-xs text-neutral-400 font-tajawal">كوينز</span>
                      </div>

                      {pkg.bonusCoins > 0 && (
                        <div className="text-[11px] font-bold text-emerald-400 mt-1 flex items-center gap-1 font-tajawal">
                          <span>+ {pkg.bonusCoins.toLocaleString('ar-EG')} كوينز بونص مجاني!</span>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-black/40 border border-neutral-800 text-center space-y-0.5">
                      <span className="text-[11px] text-neutral-400 font-tajawal block">السعر التقديري</span>
                      <span className="font-cairo font-bold text-sm text-white">
                        {pkg.priceAmount} {pkg.currency === 'SAR' ? 'ريال' : pkg.currency}
                      </span>
                    </div>
                  </div>

                  <button
                    disabled={isProcessing}
                    onClick={() => handleSimulateRecharge(pkg)}
                    className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-95 ${
                      pkg.popular
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950'
                        : 'bg-white hover:bg-neutral-100 text-neutral-950'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري الشحن التجريبي...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>شحن تجريبي فوراً</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 2: VIP PLANS (باقات وعضويات VIP) */}
      {activeSection === 'vip' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="space-y-1">
            <h2 className="text-xl font-cairo font-bold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-400" />
              باقات وعضويات VIP الملكية
            </h2>
            <p className="text-xs text-neutral-400 font-tajawal">
              احصل على إبراز ملفك الشخصي، شارة ملكية خاصة، وظهور متميز في دليل المتواجدين حالياً، ومضاعفة نقاط الخبرة.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {activePlans.map((tier) => {
              const planId = tier.id || tier.key;
              const isCurrent = user?.vipLevel === planId;
              const price = tier.priceCoins ?? tier.cost ?? 0;
              const days = tier.days || 30;
              const perks = Array.isArray(tier.perks) ? tier.perks : ['مميزات حصرية VIP'];
              const isBuying = purchasingVip === planId;

              return (
                <div
                  key={planId}
                  className={`p-6 rounded-3xl border bg-gradient-to-b ${tier.color || 'from-neutral-800 to-neutral-900'} ${tier.border || 'border-neutral-700'} flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden`}
                >
                  <div>
                    <div className="text-3xl mb-2">{tier.icon || tier.badge || '👑'}</div>
                    <h3 className="font-cairo font-black text-lg text-white">{tier.name}</h3>
                    <div className="text-sm font-bold text-amber-300 font-cairo mt-1">
                      {price.toLocaleString('ar-EG')} كوينز / {days} يوماً
                    </div>
                    <ul className="text-xs text-neutral-200/90 font-tajawal space-y-1.5 mt-4">
                      {perks.slice(0, 4).map((p: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-1.5">✓ {p}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    disabled={isCurrent || isBuying}
                    onClick={() => handleBuyVip(planId, tier.name, price)}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md ${
                      isCurrent
                        ? 'bg-neutral-900 text-emerald-400 border border-emerald-700'
                        : 'bg-white text-neutral-900 hover:bg-neutral-100 active:scale-95'
                    }`}
                  >
                    {isCurrent ? 'مفعل لديك حالياً ✓' : isBuying ? 'جاري التفعيل...' : 'ترقية بالكوينز الآن'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3: TRANSACTION HISTORY (سجل العمليات) */}
      {activeSection === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-cairo font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-neutral-400" />
              سجل العمليات والحركات المالية
            </h2>
            <span className="text-xs text-neutral-400 font-tajawal">
              آخر {walletData?.transactions?.length || 0} حركة
            </span>
          </div>

          <div className="rounded-3xl bg-[#0e1017] border border-neutral-800 divide-y divide-neutral-900 overflow-hidden shadow-xl">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-500 font-tajawal flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>جاري تحميل السجل المالي...</span>
              </div>
            ) : !walletData?.transactions || walletData.transactions.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-500 font-tajawal space-y-2">
                <div className="text-3xl">📜</div>
                <p>لا توجد حركات مالية مسجلة بعد.</p>
                <p className="text-[11px] text-neutral-600">ستظهر هنا عمليات شحن الكوينز، إرسال الهدايا، وشراء المقتنيات.</p>
              </div>
            ) : (
              walletData.transactions.map((tx: any) => {
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-neutral-900/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isPositive ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                      }`}>
                        {isPositive ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white font-cairo">{tx.description}</div>
                        <div className="text-[10px] text-neutral-500 font-tajawal">
                          {new Date(tx.created_at).toLocaleDateString('ar-EG')} · {new Date(tx.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className={`font-cairo font-bold text-sm ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? `+${tx.amount}` : tx.amount} كوينز
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
