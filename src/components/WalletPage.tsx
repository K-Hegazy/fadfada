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
  ExternalLink,
  CreditCard,
  Clock,
  Copy,
  CheckCheck,
  XCircle,
  X
} from 'lucide-react';
import { CoinPackage } from '../types';

export const WalletPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const isOwner = user?.role === 'owner';
  const [walletData, setWalletData] = useState<any>(null);
  const [coinPackages, setCoinPackages] = useState<CoinPackage[]>([]);
  const [vipPlans, setVipPlans] = useState<any[]>([]);
  const [activeSection, setActiveSection] = useState<'recharge' | 'vip' | 'orders' | 'history'>('recharge');
  const [loading, setLoading] = useState<boolean>(true);
  const [rechargingId, setRechargingId] = useState<string | null>(null);
  const [purchasingVip, setPurchasingVip] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [paymentInfoModalOpen, setPaymentInfoModalOpen] = useState<boolean>(false);
  const [selectedPkgForInfo, setSelectedPkgForInfo] = useState<CoinPackage | null>(null);

  // Manual Recharge Orders & Methods states
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState<boolean>(false);
  const [paymentMethodsData, setPaymentMethodsData] = useState<any>(null);
  const [manualRechargeModalOpen, setManualRechargeModalOpen] = useState<boolean>(false);
  const [selectedPackageForOrder, setSelectedPackageForOrder] = useState<CoinPackage | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [senderPhoneOrHandle, setSenderPhoneOrHandle] = useState<string>('');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [receiptNote, setReceiptNote] = useState<string>('');
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [copiedHandle, setCopiedHandle] = useState<boolean>(false);

  const showNotice = (text: string, type: 'success' | 'error' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const fetchMyOrders = async () => {
    try {
      setLoadingMyOrders(true);
      const res = await apiRequest('/payments/my-orders');
      setMyOrders(res.orders || []);
    } catch (e) {
      console.error('Fetch my orders error:', e);
    } finally {
      setLoadingMyOrders(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await apiRequest('/payments/methods');
      setPaymentMethodsData(res);
      if (res.methods && res.methods.length > 0 && !selectedMethodId) {
        setSelectedMethodId(res.methods[0].id);
      }
    } catch (e) {
      console.error('Fetch payment methods error:', e);
    }
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
    fetchPaymentMethods();
    fetchMyOrders();
  }, []);

  useEffect(() => {
    if (activeSection === 'orders') {
      fetchMyOrders();
    }
  }, [activeSection]);

  const handleOpenManualRechargeModal = (pkg: CoinPackage) => {
    setSelectedPackageForOrder(pkg);
    setSenderName(user?.displayName || user?.username || '');
    setSenderPhoneOrHandle('');
    setTransactionReference('');
    setReceiptNote('');
    fetchPaymentMethods();
    setManualRechargeModalOpen(true);
  };

  const handleSubmitRechargeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageForOrder) return;
    if (!senderName.trim() || !senderPhoneOrHandle.trim()) {
      showNotice('يرجى ملء اسم صاحب الحساب ورقم المحفظة أو عنوان InstaPay', 'error');
      return;
    }

    try {
      setSubmittingOrder(true);
      const res = await apiRequest<{ success: boolean; message: string; orderId: string }>('/payments/create-order', {
        method: 'POST',
        body: JSON.stringify({
          packageId: selectedPackageForOrder.id,
          transferMethod: selectedMethodId,
          senderName: senderName.trim(),
          senderPhoneOrHandle: senderPhoneOrHandle.trim(),
          transactionReference: transactionReference.trim(),
          receiptNote: receiptNote.trim()
        })
      });

      showNotice(res.message || 'تم إرسال طلب الشحن بنجاح وهو الآن قيد المراجعة اليدوية! 🪙', 'success');
      setManualRechargeModalOpen(false);
      setActiveSection('orders');
      await fetchMyOrders();
    } catch (err: any) {
      showNotice(err.message || 'حدث خطأ أثناء إرسال طلب الشحن', 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleSimulateRecharge = async (pkg: CoinPackage) => {
    if (!isOwner) {
      setSelectedPkgForInfo(pkg);
      setPaymentInfoModalOpen(true);
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
      {/* Navigation Segmented Switcher */}
      <div className="flex items-center gap-2 p-1 bg-neutral-900/90 border border-neutral-800 rounded-2xl max-w-2xl overflow-x-auto">
        <button
          onClick={() => setActiveSection('recharge')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
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
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSection === 'vip'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Crown className="w-4 h-4 text-purple-400" />
          <span>عضويات VIP الملكية</span>
        </button>

        <button
          onClick={() => setActiveSection('orders')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeSection === 'orders'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4 text-amber-400" />
          <span>طلبات الشحن</span>
          {myOrders.filter(o => o.status === 'pending').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveSection('history')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
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
          {isOwner ? (
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-amber-950/40 border border-amber-600/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-cairo font-bold text-sm text-white">
                    <span>لوحة اختبار الشحن التجريبي (خاص بالمالك Hegazy)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-sans font-bold">
                      Sandbox للمالك فقط
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/80 font-tajawal leading-relaxed">
                    هذه الميزة مفعلة لحساب المالك فقط في بيئة التطوير لفحص حركة الكوينز وتحديثات المحفظة لحظياً. الشحن التجريبي معطل تماماً للأعضاء في الإنتاج لحماية اقتصاد المنصة.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-amber-300 font-tajawal shrink-0 bg-black/40 px-3.5 py-2 rounded-xl border border-amber-800/60">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>حماية كاملة ومعاملات موثقة</span>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-neutral-900/90 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-cairo font-bold text-sm text-white">
                    <span>الشحن عبر التحويل اليدوي المباشر (InstaPay ومحافظ المحمول)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-amber-300 border border-neutral-700 font-sans font-bold">
                      تحويل بالجنيه المصري EGP
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 font-tajawal leading-relaxed">
                    اختر الباقة المناسبة، وقم بالتحويل عبر تطبيق إنستاباي أو محفظتك الشخصية (فودافون كاش ومحافظ المحمول)، ثم سجّل بيانات التحويل لمطابقتها واعتماد الكوينز في محفظتك يدوياً فور التحقق البنكي.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveSection('orders')}
                className="flex items-center gap-2 text-xs text-amber-300 hover:text-amber-200 font-tajawal shrink-0 bg-amber-950/40 hover:bg-amber-950/60 px-3.5 py-2 rounded-xl border border-amber-800/60 transition-all cursor-pointer"
              >
                <Clock className="w-4 h-4 text-amber-400" />
                <span>متابعة طلبات الشحن السابقة</span>
              </button>
            </div>
          )}

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
                      <span className="text-[11px] text-neutral-400 font-tajawal block">السعر المطلوب</span>
                      <span className="font-cairo font-bold text-sm text-white">
                        {pkg.priceAmount} {pkg.currency === 'SAR' ? 'ريال' : pkg.currency}
                      </span>
                    </div>
                  </div>

                  {isOwner ? (
                    <div className="space-y-1.5 w-full">
                      <button
                        disabled={isProcessing}
                        onClick={() => handleSimulateRecharge(pkg)}
                        className="w-full py-2 px-2.5 rounded-xl font-bold text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>جاري الاختبار...</span>
                          </>
                        ) : (
                          <>
                            <Crown className="w-3 h-3 text-amber-400" />
                            <span>شحن تجريبي (Sandbox)</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenManualRechargeModal(pkg)}
                        className="w-full py-2 px-2.5 rounded-xl font-bold text-[11px] bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="w-3 h-3 text-amber-400" />
                        <span>طلب شحن يدوي</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenManualRechargeModal(pkg)}
                      className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 active:scale-95 ${
                        pkg.popular
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950 font-black'
                          : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>طلب شحن وتحويل يدوي</span>
                    </button>
                  )}
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

      {/* SECTION: MY RECHARGE ORDERS (طلبات الشحن الخاصة بي) */}
      {activeSection === 'orders' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="p-5 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-cairo font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                سجل ومتابعة طلبات الشحن
              </h2>
              <p className="text-xs text-neutral-400 font-tajawal">
                تابع حالة طلباتك المحولة عبر InstaPay أو المحافظ، حيث يقوم المالك بمراجعة التحويل واعتماد الكوينز في حسابك يدوياً.
              </p>
            </div>

            <button
              onClick={fetchMyOrders}
              disabled={loadingMyOrders}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold font-tajawal flex items-center gap-1.5 cursor-pointer disabled:opacity-50 self-start sm:self-auto"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingMyOrders ? 'animate-spin' : ''}`} />
              تحديث الطلبات
            </button>
          </div>

          <div className="rounded-3xl bg-[#0e1017] border border-neutral-800 divide-y divide-neutral-800/80 overflow-hidden shadow-xl">
            {loadingMyOrders ? (
              <div className="p-8 text-center text-xs text-neutral-400 font-tajawal flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                <span>جاري تحميل طلبات الشحن...</span>
              </div>
            ) : myOrders.length === 0 ? (
              <div className="p-12 text-center text-xs text-neutral-400 font-tajawal space-y-2">
                <CreditCard className="w-8 h-8 text-neutral-600 mx-auto" />
                <p>لا توجد طلبات شحن سابقة مسجلة لحسابك.</p>
                <button
                  onClick={() => setActiveSection('recharge')}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs cursor-pointer"
                >
                  شحن كوينز الآن
                </button>
              </div>
            ) : (
              myOrders.map((order) => {
                const isPending = order.status === 'pending';
                const isApproved = order.status === 'approved';
                const isRejected = order.status === 'rejected';
                const totalCoins = (order.coins || 0) + (order.bonusCoins || 0);

                return (
                  <div key={order.id} className="p-4 sm:p-5 hover:bg-neutral-900/30 transition-all space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">🪙</span>
                        <div>
                          <div className="font-cairo font-bold text-sm text-white flex items-center gap-2">
                            <span>{order.packageName}</span>
                            <span className="text-amber-400 text-xs font-tajawal font-bold">
                              (+{totalCoins.toLocaleString('ar-EG')} كوينز)
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-500 font-mono">
                            رقم الطلب: {order.id} · {new Date(order.createdAt).toLocaleString('ar-EG', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="font-cairo font-black text-sm text-amber-400">
                          {order.amount} {order.currency}
                        </span>

                        {isPending && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 font-tajawal">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            قيد المراجعة
                          </span>
                        )}
                        {isApproved && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 font-tajawal">
                            <CheckCheck className="w-3.5 h-3.5" />
                            معتمد وتم الإيداع
                          </span>
                        )}
                        {isRejected && (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1 font-tajawal">
                            <XCircle className="w-3.5 h-3.5" />
                            مرفوض
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-tajawal bg-black/30 p-3 rounded-2xl border border-neutral-800/60">
                      <div>
                        <span className="text-neutral-500 text-[11px] block">وسيلة التحويل:</span>
                        <span className="text-white font-medium">
                          {order.transferMethod === 'instapay'
                            ? '⚡ إنستاباي (InstaPay)'
                            : order.transferMethod === 'vodafone_cash'
                            ? '📱 فودافون كاش'
                            : order.transferMethod === 'orange_cash'
                            ? '📱 أورنج كاش'
                            : order.transferMethod === 'etisalat_cash'
                            ? '📱 اتصالات كاش'
                            : order.transferMethod === 'we_pay'
                            ? '📱 وي باي (WE Pay)'
                            : order.transferMethod}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 text-[11px] block">المحول منه:</span>
                        <span className="text-white font-mono">{order.senderPhoneOrHandle}</span>
                      </div>
                      {order.transactionReference && (
                        <div>
                          <span className="text-neutral-500 text-[11px] block">الرقم المرجعي:</span>
                          <span className="text-white font-mono">{order.transactionReference}</span>
                        </div>
                      )}
                    </div>

                    {order.adminNotes && (
                      <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs font-tajawal flex items-center gap-2">
                        <span className="text-neutral-400">ملاحظة الإدارة:</span>
                        <span className={isRejected ? 'text-rose-300' : 'text-neutral-200'}>{order.adminNotes}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MANUAL RECHARGE MODAL (طلب شحن وتحويل يدوي) */}
      {manualRechargeModalOpen && selectedPackageForOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="bg-[#0e1017] border border-amber-800/80 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-cairo font-bold text-base text-white">طلب شحن عبر التحويل المباشر</h3>
                  <span className="text-[11px] text-amber-400 font-tajawal">بالجنيه المصري (EGP)</span>
                </div>
              </div>
              <button
                onClick={() => setManualRechargeModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Package Card */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedPackageForOrder.icon || '🪙'}</span>
                <div>
                  <div className="font-cairo font-bold text-sm text-white">{selectedPackageForOrder.name}</div>
                  <div className="text-xs text-amber-400 font-tajawal font-bold">
                    +{(selectedPackageForOrder.coins + (selectedPackageForOrder.bonusCoins || 0)).toLocaleString('ar-EG')} كوينز
                  </div>
                </div>
              </div>
              <div className="text-left">
                <span className="text-xs text-neutral-400 font-tajawal block">المبلغ المطلوب:</span>
                <span className="font-cairo font-black text-lg text-white">
                  {selectedPackageForOrder.priceAmount} ج.م
                </span>
              </div>
            </div>

            {/* If no methods enabled */}
            {(!paymentMethodsData?.manualTransfersEnabled || !paymentMethodsData?.methods || paymentMethodsData.methods.length === 0) ? (
              <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 text-center space-y-2 text-xs font-tajawal">
                <Clock className="w-8 h-8 text-amber-400 mx-auto" />
                <h4 className="font-cairo font-bold text-white text-sm">وسائل التحويل المباشر قيد الإعداد</h4>
                <p className="text-neutral-400 leading-relaxed">
                  تقوم إدارة المنصة بإعداد وسائل التحويل وحسابات الاستقبال المعتمدة في الوقت الحالي. يرجى مراجعة إدارة المنصة أو المحاولة لاحقاً.
                </p>
                <button
                  type="button"
                  onClick={() => setManualRechargeModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 text-neutral-300 font-bold mt-2"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitRechargeOrder} className="space-y-4">
                {/* 1. Pick Method */}
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-2 font-tajawal">
                    اختر وسيلة التحويل التي ستستخدمها:
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-tajawal">
                    {paymentMethodsData.methods.map((method: any) => {
                      const isSelected = selectedMethodId === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSelectedMethodId(method.id)}
                          className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2 ${
                            isSelected
                              ? 'bg-amber-950/60 border-amber-500 text-amber-300 font-bold shadow-sm ring-1 ring-amber-500/50'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                          }`}
                        >
                          <span className="text-base">{method.id === 'instapay' ? '⚡' : '📱'}</span>
                          <span className="truncate">{method.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Method Details & Copy handle */}
                {(() => {
                  const currentMethod = (paymentMethodsData.methods || []).find((m: any) => m.id === selectedMethodId) || paymentMethodsData.methods[0];
                  if (!currentMethod) return null;
                  return (
                    <div className="p-4 rounded-2xl bg-black/50 border border-amber-900/50 space-y-2.5 text-xs font-tajawal">
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-400 font-semibold">بيانات التحويل المعتمدة للمالك:</span>
                        <span className="font-bold text-amber-400 font-cairo">{currentMethod.name}</span>
                      </div>

                      {currentMethod.accountName && (
                        <div className="flex items-center justify-between border-t border-neutral-800/80 pt-2">
                          <span className="text-neutral-400">اسم المستلم:</span>
                          <span className="font-bold text-white">{currentMethod.accountName}</span>
                        </div>
                      )}

                      {currentMethod.accountHandle && (
                        <div className="flex items-center justify-between border-t border-neutral-800/80 pt-2">
                          <span className="text-neutral-400">
                            {currentMethod.id === 'instapay' ? 'عنوان الدفع (IPA) / الحساب:' : 'رقم المحفظة المحول إليها:'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-300 text-sm">{currentMethod.accountHandle}</span>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(currentMethod.accountHandle);
                                setCopiedHandle(true);
                                setTimeout(() => setCopiedHandle(false), 2000);
                              }}
                              className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              title="نسخ"
                            >
                              {copiedHandle ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedHandle ? 'تم النسخ' : 'نسخ'}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {currentMethod.instructions && (
                        <p className="text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-2 leading-relaxed">
                          💡 {currentMethod.instructions}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Form Inputs for Sender Verification */}
                <div className="space-y-3 text-xs font-tajawal">
                  <div>
                    <label className="block text-neutral-300 font-bold mb-1">
                      اسم المحول (كما يظهر في تطبيق البنك أو المحفظة) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد محمد علي"
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-bold mb-1">
                      رقم المحفظة أو عنوان InstaPay المحول منه *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: 010xxxxxxxx أو username@instapay"
                      value={senderPhoneOrHandle}
                      onChange={(e) => setSenderPhoneOrHandle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-bold mb-1">
                      رقم العملية / المعاملة المرجعية (اختياري / موصى به)
                    </label>
                    <input
                      type="text"
                      placeholder="رقم المعاملة من الإيصال أو الرسالة النصية للبنك"
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-bold mb-1">
                      ملاحظات إضافية (اختياري)
                    </label>
                    <input
                      type="text"
                      placeholder="أي تفاصيل ترغب في توضيحها للمطابقة"
                      value={receiptNote}
                      onChange={(e) => setReceiptNote(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                    />
                  </div>
                </div>

                {/* Important notice */}
                <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-[11px] text-amber-200/90 font-tajawal leading-relaxed">
                  ⚠️ {paymentMethodsData.warningNotice || 'تنبيه: لا يتم شحن الكوينز تلقائياً بمجرد إرسال الطلب، بل بعد التحقق اليدوي البنكي من وصول التحويل إلى المحفظة الرسمية للمالك.'}
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setManualRechargeModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-cairo font-black text-xs shadow-md cursor-pointer transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <CheckCheck className="w-4 h-4" />
                    <span>{submittingOrder ? 'جاري الإرسال...' : 'إرسال طلب الشحن للمراجعة'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
