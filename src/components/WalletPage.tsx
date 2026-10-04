import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Coins, Crown, Sparkles, History, ArrowDownLeft, ArrowUpRight, Check, ShieldCheck } from 'lucide-react';

export const WalletPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [walletData, setWalletData] = useState<any>(null);
  const [vipPlans, setVipPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const fetchWallet = async () => {
    try {
      setLoading(true);
      const [resWallet, resVip] = await Promise.all([
        apiRequest('/wallet'),
        apiRequest('/vip/plans').catch(() => ({ plans: [] }))
      ]);
      setWalletData(resWallet);
      if (resVip && resVip.plans && resVip.plans.length > 0) {
        setVipPlans(resVip.plans);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleBuyVip = async (tier: string) => {
    if (!confirm(`هل أنت متأكد من ترقية اشتراكك إلى ${tier.toUpperCase()}؟`)) return;
    setPurchasing(tier);
    try {
      const res = await apiRequest('/vip/purchase', {
        method: 'POST',
        body: JSON.stringify({ tier })
      });
      alert(res.message);
      await refreshUser();
      await fetchWallet();
    } catch (err: any) {
      alert(err.message || 'فشل شراء باقة VIP');
    } finally {
      setPurchasing(null);
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
    <div className="space-y-6 sm:space-y-8 animate-in fade-in">
      {/* Wallet Balance Hero */}
      <div className="p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-amber-950/60 via-neutral-900 to-[#0e1017] border border-amber-800/40 relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2">
            <div className="text-xs text-amber-300 font-semibold flex items-center gap-1.5 font-tajawal">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>محفظة كوينز فضفضه الرسمية</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-3xl sm:text-5xl font-cairo font-black text-white">
                {walletData?.balance || 0}
              </div>
              <span className="text-xs sm:text-sm font-bold text-amber-400 font-cairo bg-amber-950/80 px-2.5 sm:px-3 py-1 rounded-xl border border-amber-800/60">
                كوينز
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-tajawal">
              تكتسب الكوينز من المهام اليومية، الشعلة، تدوير عجلة الحظ، وتستخدم لشراء VIP وإرسال الهدايا.
            </p>
          </div>

          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-neutral-900/60 border border-neutral-800 text-xs space-y-1.5 sm:space-y-2 max-w-xs">
            <div className="flex items-center gap-2 font-bold text-white">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>عضويتك الحالية: {user?.vipLevel !== 'none' ? `VIP ${user?.vipLevel.toUpperCase()}` : 'عضوية قياسية'}</span>
            </div>
            {walletData?.vipExpiresAt && (
              <p className="text-neutral-400 text-[11px]">
                صالح حتى: {new Date(walletData.vipExpiresAt).toLocaleDateString('ar-EG')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* VIP Tiers Showcase */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-cairo font-bold text-white flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-400" />
            باقات وعضويات VIP المميزة
          </h2>
          <p className="text-xs text-neutral-400 font-tajawal">
            احصل على إبراز ملفك الشخصي، شارة ملكية خاصة، وظهور متميز في دليل المتواجدين حالياً.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activePlans.map((tier) => {
            const planId = tier.id || tier.key;
            const isCurrent = user?.vipLevel === planId;
            const price = tier.priceCoins ?? tier.cost ?? 0;
            const days = tier.days || 30;
            const perks = Array.isArray(tier.perks) ? tier.perks : ['مميزات حصرية VIP'];
            return (
              <div
                key={planId}
                className={`p-6 rounded-3xl border bg-gradient-to-b ${tier.color || 'from-neutral-800 to-neutral-900'} ${tier.border || 'border-neutral-700'} flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden`}
              >
                <div>
                  <div className="text-3xl mb-2">{tier.icon || tier.badge || '👑'}</div>
                  <h3 className="font-cairo font-black text-lg text-white">{tier.name}</h3>
                  <div className="text-sm font-bold text-amber-300 font-cairo mt-1">
                    {price} كوينز / {days} يوماً
                  </div>
                  <ul className="text-xs text-neutral-200/90 font-tajawal space-y-1.5 mt-4">
                    {perks.slice(0, 4).map((p: string, idx: number) => (
                      <li key={idx} className="flex items-center gap-1.5">✓ {p}</li>
                    ))}
                  </ul>
                </div>

                <button
                  disabled={isCurrent || purchasing === planId}
                  onClick={() => handleBuyVip(planId)}
                  className={`w-full py-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md ${
                    isCurrent
                      ? 'bg-neutral-900 text-emerald-400 border border-emerald-700'
                      : 'bg-white text-neutral-900 hover:bg-neutral-100'
                  }`}
                >
                  {isCurrent ? 'مفعل لديك حالياً ✓' : purchasing === planId ? 'جاري التفعيل...' : 'ترقية الآن'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction History */}
      <div className="space-y-4">
        <h2 className="text-lg font-cairo font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-neutral-400" />
          سجل العمليات والحركات المالية
        </h2>

        <div className="rounded-3xl bg-[#0e1017] border border-neutral-800 divide-y divide-neutral-900 overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-xs text-neutral-500 font-tajawal">جاري تحميل السجل...</div>
          ) : !walletData?.transactions || walletData.transactions.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-500 font-tajawal">لا توجد حركات سابقة بعد.</div>
          ) : (
            walletData.transactions.map((tx: any) => {
              const isPositive = tx.amount > 0;
              return (
                <div key={tx.id} className="p-4 flex items-center justify-between">
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
    </div>
  );
};
