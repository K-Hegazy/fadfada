import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Crown,
  Gift,
  History,
  Send,
  Shield,
  ShoppingBag,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  purchaseStoreItem,
  sendGiftToUser,
  subscribeToCoinTransactions,
  subscribeToTopups,
  submitTopupRequest,
  transferCoinsToUser,
} from '../services/economy';
import { useApp } from '../state/AppContext';
import type { CoinTransaction, StoreItem, StoreSection, TopupRequest } from '../types/fadfada';
import { formatArabicTime } from '../utils/formatters';
import { CoinWalletChip, EmptyState, FeedbackBanner, PageHeader, SegmentedTabs } from './ui/Primitives';

type StoreTab = StoreSection | 'transfer' | 'topup' | 'history';

export const StoreView: React.FC = () => {
  const { profile, isGuest, users, storeItems, siteSettings, isStaff, setActiveSection } = useApp();
  const [tab, setTab] = useState<StoreTab>('vip');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Gifts & Transfer target
  const [targetUid, setTargetUid] = useState('');
  const [transferAmount, setTransferAmount] = useState(50);

  // Topup form
  const enabledMethods = useMemo(
    () => siteSettings.paymentMethods.filter((m) => m.enabled),
    [siteSettings.paymentMethods]
  );
  const [methodId, setMethodId] = useState(enabledMethods[0]?.id ?? 'instapay');
  const [topupAmount, setTopupAmount] = useState(100);
  const [topupRef, setTopupRef] = useState('');
  const [myTopups, setMyTopups] = useState<TopupRequest[]>([]);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);

  useEffect(() => {
    if (!profile || isGuest) return;
    const u1 = subscribeToTopups(profile.uid, false, setMyTopups);
    const u2 = subscribeToCoinTransactions(profile.uid, setTransactions);
    return () => {
      u1();
      u2();
    };
  }, [profile?.uid, isGuest]);

  if (!profile) return null;

  if (isGuest) {
    return (
      <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
        <div className="max-w-3xl mx-auto space-y-3.5">
          <PageHeader
            title="متجر فضفضة والمحفظة"
            subtitle="المزايا والإطارات والشارات والهدايا متاحة للأعضاء المؤكدين"
            icon={<ShoppingBag className="w-4 h-4" />}
          />
          <div className="p-6 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              متاح بعد إنشاء حساب مؤكد
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              حسابات الضيوف لا تمتلك عملات أو محفظة. قم بترقية حسابك إلى عضو دائم من صفحة الحساب للاستفادة من المتجر والهدايا.
            </p>
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className="min-h-[38px] px-5 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold cursor-pointer"
            >
              ترقية الحساب الآن
            </button>
          </div>
        </div>
      </div>
    );
  }

  const otherUsers = users.filter((u) => u.uid !== profile.uid);
  const selectedPeer = otherUsers.find((u) => u.uid === targetUid) ?? otherUsers[0] ?? null;
  const activeMethod = enabledMethods.find((m) => m.id === methodId) ?? enabledMethods[0];
  const calculatedCoins = Math.max(
    1,
    Math.floor(topupAmount * (activeMethod?.rateCoinsPerUnit ?? 10))
  );

  const sectionItems = storeItems.filter(
    (item) => item.isActive && item.section === tab
  );

  const handleBuy = async (item: StoreItem) => {
    setFeedback(null);
    setBusyId(item.id);
    try {
      await purchaseStoreItem(profile, item);
      setFeedback({ type: 'ok', text: `تم شراء وتفعيل "${item.name}" بنجاح.` });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'تعذر إتمام الشراء.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleGift = async (gift: StoreItem) => {
    if (!selectedPeer) {
      setFeedback({ type: 'err', text: 'اختر عضوًا مستلمًا للهدية أولاً.' });
      return;
    }
    setFeedback(null);
    setBusyId(gift.id);
    try {
      await sendGiftToUser(profile, selectedPeer, gift, true);
      setFeedback({
        type: 'ok',
        text: `تم إرسال "${gift.name}" إلى ${selectedPeer.displayName} بنجاح.`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'تعذر إرسال الهدية.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeer) {
      setFeedback({ type: 'err', text: 'لا يوجد عضو مستلم محدد.' });
      return;
    }
    setFeedback(null);
    setBusyId('transfer');
    try {
      await transferCoinsToUser(profile, selectedPeer, transferAmount);
      setFeedback({
        type: 'ok',
        text: `تم تحويل ${transferAmount} عملة إلى ${selectedPeer.displayName}.`,
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'تعذر التحويل.' });
    } finally {
      setBusyId(null);
    }
  };

  const handleTopupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topupRef.trim()) {
      setFeedback({ type: 'err', text: 'أدخل رقم العملية أو مرجع التحويل.' });
      return;
    }
    setFeedback(null);
    setBusyId('topup');
    try {
      await submitTopupRequest(profile, {
        method: activeMethod?.name ?? methodId,
        amount: topupAmount,
        coinsRequested: calculatedCoins,
        reference: topupRef,
      });
      setTopupRef('');
      setFeedback({
        type: 'ok',
        text: 'تم إرسال طلب الشحن بنجاح وسيتم مراجعته من الإدارة.',
      });
    } catch (err) {
      setFeedback({ type: 'err', text: err instanceof Error ? err.message : 'تعذر إرسال الطلب.' });
    } finally {
      setBusyId(null);
    }
  };

  const tabs: Array<{ id: StoreTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'vip', label: 'VIP', icon: Crown },
    { id: 'feature', label: 'المزايا', icon: Sparkles },
    { id: 'frame', label: 'الإطارات', icon: Shield },
    { id: 'badge', label: 'الشارات', icon: Award },
    { id: 'gift', label: 'الهدايا', icon: Gift },
    { id: 'transfer', label: 'تحويل عملات', icon: Send },
    { id: 'topup', label: 'شحن الرصيد', icon: Wallet },
    { id: 'history', label: 'سجل المعاملات', icon: History },
  ];

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-6xl mx-auto space-y-3.5">
        <PageHeader
          title="متجر فضفضة والمحفظة"
          subtitle="باقات VIP والمزايا والإطارات والشارات والهدايا أو شحن الرصيد"
          icon={<ShoppingBag className="w-4 h-4" />}
          action={<CoinWalletChip coins={profile.coins} size="md" />}
        />

        <SegmentedTabs<StoreTab>
          items={tabs}
          value={tab}
          onChange={(next) => {
            setTab(next);
            setFeedback(null);
          }}
        />

        {feedback && (
          <FeedbackBanner
            type={feedback.type === 'ok' ? 'success' : 'error'}
            message={feedback.text}
          />
        )}

        {tab !== 'transfer' && tab !== 'topup' && tab !== 'history' && (
          <div className="space-y-3">
            {tab === 'gift' && (
              <div className="p-3.5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10">
                <label className="block text-xs font-semibold mb-1.5">
                  اختر العضو المستلم للهدية (يحصل المستلم على 50% من قيمتها عملات)
                </label>
                <select
                  value={selectedPeer?.uid ?? ''}
                  onChange={(e) => setTargetUid(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
                >
                  {otherUsers.length === 0 ? (
                    <option value="">لا يوجد أعضاء آخرون حاليًا</option>
                  ) : (
                    otherUsers.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName} (@{u.username})
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {sectionItems.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="w-5 h-5" />}
                title="لا توجد عناصر متاحة في هذا القسم حاليًا"
                description="جرّب استكشاف بقية أقسام المتجر أو شحن رصيدك."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sectionItems.map((item) => {
                  const canAfford = profile.coins >= item.priceCoins;
                  return (
                    <article
                      key={item.id}
                      className="rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 overflow-hidden flex flex-col justify-between hover:border-[#0B7A62]/45 dark:hover:border-[#34D399]/35 transition-colors"
                    >
                      <div
                        className="h-1 w-full"
                        style={{ backgroundColor: item.color || '#0B7A62' }}
                      />
                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h3
                              className="font-display text-sm font-bold"
                              style={{ color: item.color || undefined }}
                            >
                              {item.name}
                            </h3>
                            <span className="font-mono tabular-nums text-xs font-bold text-[#0B7A62] dark:text-[#34D399] shrink-0">
                              {item.priceCoins} عملة
                            </span>
                          </div>
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-20 object-contain rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] p-2"
                            />
                          )}
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {item.description}
                          </p>
                          {item.durationDays > 0 && (
                            <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                              المدة: {item.durationDays} يوم
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() =>
                              void (tab === 'gift' ? handleGift(item) : handleBuy(item))
                            }
                            className={`w-full min-h-[38px] rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 ${
                              canAfford
                                ? 'bg-[#0B7A62] hover:bg-[#08614D] text-white'
                                : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                          >
                            {busyId === item.id
                              ? 'جاري التنفيذ...'
                              : tab === 'gift'
                              ? 'إرسال الهدية'
                              : 'شراء وتفعيل'}
                          </button>
                          {!canAfford && (
                            <p className="text-[10px] text-center text-amber-600 dark:text-amber-400">
                              رصيدك الحالي أقل من سعر العنصر ({profile.coins}/{item.priceCoins})
                            </p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'transfer' && (
          <form
            onSubmit={handleTransfer}
            className="max-w-lg p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-3.5"
          >
            <h2 className="font-display text-sm sm:text-base font-bold">تحويل عملات لعضو آخر</h2>
            <div>
              <label className="block text-xs font-semibold mb-1">المستلم</label>
              <select
                value={selectedPeer?.uid ?? ''}
                onChange={(e) => setTargetUid(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
              >
                {otherUsers.length === 0 ? (
                  <option value="">لا يوجد أعضاء آخرون حاليًا</option>
                ) : (
                  otherUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.displayName} (@{u.username})
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">المبلغ (الحد الأدنى 10 عملات)</label>
              <input
                type="number"
                min={10}
                max={profile.coins}
                value={transferAmount}
                onChange={(e) => setTransferAmount(Number(e.target.value))}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={busyId === 'transfer' || !selectedPeer}
              className="w-full min-h-[40px] rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
            >
              {busyId === 'transfer' ? 'جاري التحويل...' : 'تحويل العملات الآن'}
            </button>
          </form>
        )}

        {tab === 'topup' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <form
              onSubmit={handleTopupSubmit}
              className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-3"
            >
              <h2 className="font-display text-sm sm:text-base font-bold">طلب شحن عملات</h2>
              <div>
                <label className="block text-xs font-semibold mb-1">وسيلة الدفع</label>
                <select
                  value={activeMethod?.id ?? ''}
                  onChange={(e) => setMethodId(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
                >
                  {enabledMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.rateCoinsPerUnit} عملة / {m.currency}
                    </option>
                  ))}
                </select>
              </div>

              {activeMethod && (
                <div className="p-3 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 text-xs">
                  <p className="text-slate-500 dark:text-slate-400">بيانات التحويل:</p>
                  <p dir="ltr" className="font-mono font-bold text-slate-900 dark:text-white mt-0.5 select-all">
                    {activeMethod.accountInfo}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">
                  المبلغ المدفوع ({activeMethod?.currency ?? 'ج.م'})
                </label>
                <input
                  type="number"
                  min={1}
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(Number(e.target.value))}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm font-mono"
                />
                <p className="mt-1 text-xs text-[#0B7A62] dark:text-[#34D399]">
                  ستحصل على <strong className="font-mono tabular-nums">{calculatedCoins}</strong> عملة بعد المراجعة
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">رقم العملية / مرجع التحويل</label>
                <input
                  type="text"
                  required
                  value={topupRef}
                  onChange={(e) => setTopupRef(e.target.value)}
                  placeholder="مثال: رقم المحفظة أو كود المرجع"
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={busyId === 'topup'}
                className="w-full min-h-[40px] rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
              >
                {busyId === 'topup' ? 'جاري الإرسال...' : 'إرسال طلب الشحن'}
              </button>
              {isStaff && (
                <p className="text-[11px] text-slate-400">
                  يمكنك مراجعة واعتماد طلبات الشحن من تبويب لوحة الإدارة.
                </p>
              )}
            </form>

            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-3">
              <h2 className="font-display text-sm sm:text-base font-bold">سجل طلباتي</h2>
              {myTopups.length === 0 ? (
                <EmptyState
                  icon={<Wallet className="w-5 h-5" />}
                  title="لا توجد طلبات شحن"
                  description="عند إرسال طلب شحن سيظهر هنا مع حالة المراجعة اللحظية."
                />
              ) : (
                <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                  {myTopups.map((t) => (
                    <div
                      key={t.id}
                      className="py-2.5 text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-semibold">
                          {t.coinsRequested} عملة ({t.method})
                        </p>
                        <p className="text-slate-400 font-mono text-[11px] mt-0.5">
                          مرجع: {t.reference} · {formatArabicTime(t.createdAt)}
                        </p>
                        {t.adminNote && <p className="text-slate-500 mt-0.5">ملاحظة: {t.adminNote}</p>}
                      </div>
                      <span
                        className={`text-[11px] font-bold shrink-0 ${
                          t.status === 'approved'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : t.status === 'rejected'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {t.status === 'approved' ? 'مقبول' : t.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
            <h2 className="font-display text-sm sm:text-base font-bold">سجل المعاملات والمشتريات</h2>
            {transactions.length === 0 ? (
              <EmptyState
                icon={<History className="w-5 h-5" />}
                title="سجل المعاملات فارغ"
                description="ستظهر هنا جميع عمليات الشراء، الهدايا، التحويلات، والمكافآت."
              />
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-white/8">
                {transactions.map((tx) => {
                  const isIncoming = tx.recipientId === profile.uid;
                  const delta = isIncoming ? tx.recipientAmount || tx.amount : -tx.amount;
                  return (
                    <div
                      key={tx.id}
                      className="py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {tx.note || tx.type}
                        </p>
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {tx.type} · {formatArabicTime(tx.createdAt)}
                        </p>
                      </div>
                      <span
                        dir="ltr"
                        className={`font-mono font-bold tabular-nums text-sm ${
                          delta >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {delta >= 0 ? `+${delta}` : delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
