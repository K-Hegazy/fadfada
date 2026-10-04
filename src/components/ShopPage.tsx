import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getToken } from '../services/api';
import {
  ShoppingBag,
  Sparkles,
  Crown,
  Pin,
  Flame,
  Coins,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Plus,
  Edit2,
  Eye,
  AlertCircle,
  Package,
  Layers,
  Check,
  RefreshCw
} from 'lucide-react';
import { ShopItem, UserInventoryItem } from '../types';

export const ShopPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const token = getToken();
  const [activeTab, setActiveTab] = useState<'catalog' | 'memberships' | 'inventory' | 'admin'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [items, setItems] = useState<ShopItem[]>([]);
  const [inventory, setInventory] = useState<UserInventoryItem[]>([]);
  const [vipPlans, setVipPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [purchasingVipTier, setPurchasingVipTier] = useState<string | null>(null);
  const [equippingId, setEquippingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Owner state (Shop management is strictly Owner only)
  const isOwner = user?.role === 'owner';
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShopItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '👑',
    priceCoins: 100,
    type: 'badge' as 'badge' | 'pin_profile' | 'card_frame' | 'special_feature',
    category: 'distinctive' as any,
    durationHours: '' as any,
    badgeTag: '',
    badgeColor: 'from-amber-400 to-yellow-600',
    frameStyle: 'gold'
  });

  const fetchShopData = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [resCatalog, resInv, resVip] = await Promise.all([
        fetch('/api/shop/items', { headers }),
        token && !user?.isGuest ? fetch('/api/shop/my-inventory', { headers }) : Promise.resolve(null),
        fetch('/api/vip/plans')
      ]);

      if (resCatalog.ok) {
        const catData = await resCatalog.json();
        setItems(catData.items || []);
      }

      if (resInv && resInv.ok) {
        const invData = await resInv.json();
        setInventory(invData.inventory || []);
      }

      if (resVip && resVip.ok) {
        const vipData = await resVip.json();
        setVipPlans(vipData.plans || []);
      }
    } catch (err) {
      console.error('Failed to load shop items', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();
  }, [token]);

  const handleBuyVip = async (tierId: string, planName: string, priceCoins: number) => {
    if (!token || user?.isGuest) {
      setMessage({ text: 'العضويات متاحة فقط للأعضاء المسجلين. يرجى إنشاء حسابك أو تسجيل الدخول!', type: 'error' });
      return;
    }

    if ((user?.coins || 0) < priceCoins) {
      setMessage({
        text: `رصيد الكوينز غير كافٍ. تحتاج إلى ${priceCoins.toLocaleString()} كوينز (رصيدك الحالي: ${(user?.coins || 0).toLocaleString()})`,
        type: 'error'
      });
      return;
    }

    setPurchasingVipTier(tierId);
    setMessage(null);

    try {
      const res = await fetch('/api/vip/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tier: tierId })
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'فشلت عملية ترقية العضوية', type: 'error' });
      } else {
        setMessage({ text: data.message || `مبروك! تم تفعيل اشتراك ${planName} بنجاح!`, type: 'success' });
        await fetchShopData();
        if (refreshUser) await refreshUser();
      }
    } catch (err) {
      setMessage({ text: 'حدث خطأ في الاتصال بالخادم، يرجى المحاولة لاحقاً', type: 'error' });
    } finally {
      setPurchasingVipTier(null);
    }
  };

  const handleBuy = async (item: ShopItem) => {
    if (!token || user?.isGuest) {
      setMessage({ text: 'المتجر متاح فقط للأعضاء المسجلين. يرجى تسجيل حسابك للاقتناء!', type: 'error' });
      return;
    }

    if ((user?.coins || 0) < item.priceCoins) {
      setMessage({
        text: `رصيد الكوينز غير كافٍ. تحتاج إلى ${item.priceCoins} كوينز (رصيدك الحالي: ${user?.coins || 0})`,
        type: 'error'
      });
      return;
    }

    setPurchasingId(item.id);
    setMessage(null);

    try {
      const res = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemId: item.id })
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error || 'فشلت عملية الشراء', type: 'error' });
      } else {
        setMessage({ text: data.message || `تم شراء "${item.name}" بنجاح!`, type: 'success' });
        await fetchShopData();
        if (refreshUser) refreshUser();
      }
    } catch (err) {
      setMessage({ text: 'تعذر إتمام عملية الشراء، يرجى المحاولة لاحقاً', type: 'error' });
    } finally {
      setPurchasingId(null);
    }
  };

  const handleEquip = async (itemId: string, equip: boolean) => {
    if (!token) return;
    setEquippingId(itemId);
    try {
      const res = await fetch('/api/shop/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ itemId, equip })
      });
      if (res.ok) {
        await fetchShopData();
        if (refreshUser) refreshUser();
      }
    } catch (err) {
      console.error('Failed to toggle equip', err);
    } finally {
      setEquippingId(null);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      const payload: any = {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        priceCoins: Number(formData.priceCoins),
        type: formData.type,
        category: formData.category,
        durationHours: formData.durationHours ? Number(formData.durationHours) : null,
        metadata: {
          badgeTag: formData.badgeTag || formData.name,
          badgeColor: formData.badgeColor,
          frameStyle: formData.frameStyle
        }
      };

      const url = editingItem ? `/api/shop/items/${editingItem.id}` : '/api/shop/items';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setAdminModalOpen(false);
        setEditingItem(null);
        await fetchShopData();
        setMessage({ text: 'تم حفظ عنصر المتجر بنجاح!', type: 'success' });
      } else {
        const d = await res.json();
        setMessage({ text: d.error || 'فشل حفظ العنصر', type: 'error' });
      }
    } catch (err) {
      setMessage({ text: 'حدث خطأ أثناء حفظ العنصر', type: 'error' });
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!token || !confirm('هل أنت متأكد من تعطيل هذا العنصر من المتجر؟')) return;
    try {
      const res = await fetch(`/api/shop/items/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchShopData();
        setMessage({ text: 'تم تعطيل العنصر بنجاح', type: 'success' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredItems = items.filter(item => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'badges') return item.type === 'badge';
    if (selectedCategory === 'features') return item.type !== 'badge';
    return item.category === selectedCategory;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-950/70 via-neutral-900 to-[#0d1117] border border-amber-500/30 p-4 sm:p-6 md:p-8 shadow-2xl">
        <div className="absolute -top-16 -left-16 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>المتجر الحصري لمجتمع فضفضه</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white font-cairo flex items-center gap-2 sm:gap-3">
              متجر الشارات والمميزات الاستثنائية
            </h1>
            <p className="text-neutral-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              تألق بين الأعضاء بشارات ملكية نادرة، أو ثبّت حسابك في صدارة قائمة المتواجدين حالياً، وتزيّن بإطارات نيونية تمنح بطاقتك حضوراً لا يُنسى!
            </p>
          </div>

          {/* User Coins Status */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-neutral-900/90 border border-amber-500/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                <Coins className="w-5 h-5 sm:w-7 sm:h-7" />
              </div>
              <div>
                <span className="text-[11px] sm:text-xs text-neutral-400 block font-medium">رصيدك المتاح</span>
                <div className="text-lg sm:text-xl font-black text-amber-400 font-cairo">
                  {user?.isGuest ? '0 (زائر)' : `${user?.coins || 0} كوينز`}
                </div>
              </div>
            </div>

            {user?.isGuest ? (
              <div className="text-xs text-amber-300/80 px-2.5 py-1 bg-amber-950/40 rounded-lg text-center">
                سجّل حسابك لاقتناء الشارات
              </div>
            ) : (
              <a
                href="#wallet"
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'wallet' }));
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950 text-xs font-black rounded-xl text-center shadow-md transition-all cursor-pointer active:scale-95"
              >
                شحن أو كسب كوينز
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-sm font-semibold flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
              : 'bg-red-950/80 text-red-300 border border-red-700/60'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            إغلاق
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-full pb-1">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 active:scale-95 ${
              activeTab === 'catalog'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>معروضات المتجر</span>
          </button>

          <button
            onClick={() => setActiveTab('memberships')}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 active:scale-95 ${
              activeTab === 'memberships'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>العضويات VIP</span>
          </button>

          {!user?.isGuest && (
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 active:scale-95 ${
                activeTab === 'inventory'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>مقتنياتي ({inventory.length})</span>
            </button>
          )}

          {isOwner && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0 active:scale-95 ${
                activeTab === 'admin'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'bg-neutral-900/60 text-neutral-400 hover:text-white border border-neutral-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>إدارة المتجر</span>
            </button>
          )}
        </div>

        {activeTab === 'catalog' && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'badges', label: 'الشارات الملكية' },
              { id: 'features', label: 'المميزات والتثبيت' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-neutral-800 text-white border border-neutral-700'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CATALOG VIEW */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-16 text-neutral-400">جاري تحميل عناصر المتجر...</div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-16 text-neutral-500 bg-neutral-900/40 rounded-3xl border border-neutral-800">
              لا توجد عناصر متوفرة في هذا القسم حالياً.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map(item => {
                const isOwned = item.isOwned;
                const isEquipped = item.isEquipped;
                const isBuying = purchasingId === item.id;
                const isEquipping = equippingId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`relative rounded-3xl bg-neutral-900/80 border p-6 flex flex-col justify-between transition-all hover:border-amber-500/50 hover:shadow-lg hover:shadow-amber-500/5 group ${
                      isEquipped
                        ? 'border-emerald-500/60 bg-emerald-950/10'
                        : isOwned
                        ? 'border-amber-500/30'
                        : 'border-neutral-800'
                    }`}
                  >
                    {/* Top Badges */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl p-3 bg-neutral-800/80 rounded-2xl border border-neutral-700/60 shadow-inner group-hover:scale-110 transition-transform">
                        {item.icon}
                      </span>

                      <div className="flex flex-col items-end gap-1">
                        {item.durationHours ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-neutral-300 bg-neutral-800/90 px-2 py-0.5 rounded-full border border-neutral-700">
                            <Clock className="w-3 h-3 text-amber-400" />
                            <span>{item.durationHours >= 24 ? `${Math.round(item.durationHours / 24)} يوم` : `${item.durationHours} ساعة`}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
                            <Crown className="w-3 h-3" />
                            <span>شارة دائمة</span>
                          </span>
                        )}

                        {isEquipped && (
                          <span className="text-[10px] font-bold text-emerald-300 bg-emerald-900/50 px-2 py-0.5 rounded border border-emerald-700/50">
                            مُفعّلة حالياً
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-2 mb-6">
                      <h3 className="text-lg font-bold text-white font-cairo flex items-center gap-2">
                        <span>{item.name}</span>
                        {item.type === 'pin_profile' && (
                          <Pin className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                        )}
                        {item.type === 'card_frame' && (
                          <Sparkles className="w-4 h-4 text-purple-400" />
                        )}
                      </h3>
                      <p className="text-neutral-400 text-xs leading-relaxed line-clamp-3">
                        {item.description}
                      </p>
                    </div>

                    {/* Preview box if badge or frame */}
                    {item.type === 'badge' && (
                      <div className="mb-4 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between text-xs">
                        <span className="text-neutral-400 text-[11px]">مظهر الشارة:</span>
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-500/20 to-yellow-600/20 border border-amber-500/40 text-amber-300 font-bold">
                          <span>{item.icon}</span>
                          <span>{item.metadata?.badgeTag || item.name}</span>
                        </div>
                      </div>
                    )}

                    {item.type === 'card_frame' && (
                      <div className="mb-4 p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between text-xs">
                        <span className="text-neutral-400 text-[11px]">تأثير الإطار:</span>
                        <span className="text-purple-300 font-semibold px-2 py-0.5 rounded border border-purple-500/40 bg-purple-950/30">
                          هالة متوهجة ومضيئة
                        </span>
                      </div>
                    )}

                    {/* Price and Actions */}
                    <div className="pt-4 border-t border-neutral-800/80 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5 text-amber-400 font-black font-cairo">
                        <Coins className="w-5 h-5" />
                        <span className="text-lg">{item.priceCoins}</span>
                        <span className="text-xs text-neutral-400 font-normal">كوينز</span>
                      </div>

                      {isOwned ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEquip(item.id, !isEquipped)}
                            disabled={isEquipping}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isEquipped
                                ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                            }`}
                          >
                            {isEquipped ? 'إلغاء التفعيل' : 'تفعيل الآن'}
                          </button>

                          {item.durationHours && (
                            <button
                              onClick={() => handleBuy(item)}
                              disabled={isBuying}
                              className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              title="تمديد فترة الصلاحية"
                            >
                              تمديد
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={isBuying || user?.isGuest}
                          className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            user?.isGuest
                              ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950 shadow-md shadow-amber-500/20 active:scale-95'
                          }`}
                        >
                          {isBuying ? (
                            'جاري الشراء...'
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>اقتناء الآن</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MEMBERSHIPS VIEW */}
      {activeTab === 'memberships' && (
        <div className="space-y-6">
          {/* User's Current Membership Status Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-amber-950/40 border border-amber-500/30 relative overflow-hidden shadow-xl">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Crown className="w-6 h-6 text-amber-400" />
                  <h2 className="text-xl sm:text-2xl font-cairo font-black text-white">
                    العضويات والمميزات الملكية VIP
                  </h2>
                  {user?.vipLevel && user.vipLevel !== 'none' && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold animate-pulse">
                      عضو نشط
                    </span>
                  )}
                </div>

                <div className="text-sm font-tajawal text-neutral-300">
                  {user?.isGuest ? (
                    <span className="text-amber-400 font-semibold">
                      أنت مسجل حالياً كزائر مؤقت. يرجى تسجيل حسابك لتتمكن من تفعيل عضويات VIP وحفظ امتيازاتك بشكل دائم!
                    </span>
                  ) : user?.vipLevel && user.vipLevel !== 'none' ? (
                    <div className="space-y-1">
                      <p>
                        عضويتك الحالية:{' '}
                        <strong className="text-amber-300 font-bold">
                          {user.vipLevel === 'royal'
                            ? 'VIP الملكي الألماسي 💎'
                            : user.vipLevel === 'gold'
                            ? 'VIP الذهبي الناصع 👑'
                            : user.vipLevel === 'silver'
                            ? 'VIP الفضي البراق 🥈'
                            : 'VIP البرونزي 🥉'}
                        </strong>
                      </p>
                      {user.vipExpiresAt && (
                        <p className="text-xs text-neutral-400">
                          تاريخ الانتهاء:{' '}
                          <span className="text-white font-medium">
                            {new Date(user.vipExpiresAt).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                          {' '}(تجديد العضوية سيمدد الصلاحية بـ 30 يوماً إضافية تلقائياً).
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-neutral-400">
                      عضويتك الحالية:{' '}
                      <span className="text-white font-semibold">عضوية عادية</span>.
                      ارتقِ بحسابك الآن وتميز بشارات وتأثيرات ملكية في كافة أقسام المنصة!
                    </p>
                  )}
                </div>
              </div>

              {/* Coins counter in banner */}
              <div className="flex items-center gap-3 bg-neutral-950/80 px-4 py-2.5 rounded-2xl border border-neutral-800 self-start md:self-auto">
                <Coins className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-neutral-400 font-tajawal">رصيدك المتاح</div>
                  <div className="text-base font-black text-white font-cairo">
                    {(user?.coins || 0).toLocaleString()} <span className="text-xs font-normal text-amber-400">كوينز</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Memberships Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {(vipPlans.length > 0
              ? vipPlans
              : [
                  {
                    id: 'bronze',
                    name: 'VIP البرونزي',
                    icon: '🥉',
                    badge: 'برونزي',
                    color: 'from-amber-700 to-amber-900',
                    border: 'border-amber-700/60',
                    text: 'text-amber-300',
                    priceCoins: 200,
                    days: 30,
                    perks: [
                      'شارة VIP برونزية مميزة في الملف الشخصي والدردشة',
                      'أولوية ظهور متقدمة في قائمة المتواجدين حالياً',
                      'مضاعفة مكافآت نقاط الخبرة اليومية (1.2x)',
                      'إمكانية تغيير لون اسم المستخدم في الغرف العامة'
                    ]
                  },
                  {
                    id: 'silver',
                    name: 'VIP الفضي',
                    icon: '🥈',
                    badge: 'فضي',
                    color: 'from-slate-400 to-slate-600',
                    border: 'border-slate-400/60',
                    text: 'text-slate-200',
                    priceCoins: 500,
                    days: 30,
                    popular: true,
                    perks: [
                      'شارة VIP فضية براقة بجانب اسمك في كل الأقسام',
                      'ظهور عالي الأولوية في المتواجدين والمجالس',
                      'مضاعفة مكافآت نقاط الخبرة اليومية (1.5x)',
                      'حضور مميز مع فقاعة رسائل فضية خاصة',
                      'دخول حصري للغرف الحوارية الراقية'
                    ]
                  },
                  {
                    id: 'gold',
                    name: 'VIP الذهبي',
                    icon: '👑',
                    badge: 'ذهبي ناصع',
                    color: 'from-amber-400 to-yellow-600',
                    border: 'border-amber-400/80',
                    text: 'text-amber-300',
                    priceCoins: 1000,
                    days: 30,
                    perks: [
                      'تاج ذهبي ملكي متوهج بجانب اسمك في كل مكان',
                      'صدارة قائمة المتواجدين حالياً مع تمييز ذهبي',
                      'مضاعفة نقاط الخبرة (2x) لتسريع رفع المستوى',
                      'إمكانية إنشاء مجالس وغرف خاصة دون قيود',
                      'لون خط ذهبي متوهج في الرسائل العامة',
                      'درع حماية متقدم من الحظر المؤقت في الغرف'
                    ]
                  },
                  {
                    id: 'royal',
                    name: 'VIP الملكي الاستثنائي',
                    icon: '💎',
                    badge: 'ملكي ألماسي',
                    color: 'from-purple-500 via-indigo-500 to-cyan-500',
                    border: 'border-purple-400/80',
                    text: 'text-purple-300',
                    priceCoins: 2500,
                    days: 30,
                    perks: [
                      'شارة الألماس الملكي الفاخرة ذات البريق المتحرك',
                      'تثبيت استثنائي فائق في مقدمة المتواجدين دائماً',
                      'مضاعفة نقاط الخبرة اليومية 3 أضعاف (3x)',
                      'رسائل بتأثيرات نيونية متحركة في المحادثات والغرف',
                      'دخول كافة الغرف والمجالس المغلقة بدون كلمة مرور',
                      'إشعارات ترحيبية خاصة عند دخولك أي غرفة عامة',
                      'صلاحية إهداء هدايا خاصة حصرية لأعضاء VIP الملكي'
                    ]
                  }
                ]
            ).map((plan: any) => {
              const isCurrentTier = user?.vipLevel === plan.id;
              const isPurchasing = purchasingVipTier === plan.id;
              const canAfford = (user?.coins || 0) >= plan.priceCoins;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-3xl bg-neutral-900/90 border flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:scale-[1.01] ${
                    plan.popular
                      ? 'border-amber-400/70 ring-1 ring-amber-400/30'
                      : isCurrentTier
                      ? 'border-emerald-500/80 ring-2 ring-emerald-500/30 bg-emerald-950/10'
                      : 'border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {/* Popular or Current Tag */}
                  {isCurrentTier ? (
                    <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-emerald-500 text-black text-[11px] font-black shadow-md flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>عضويتك الحالية</span>
                    </div>
                  ) : plan.popular ? (
                    <div className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 text-black text-[11px] font-black shadow-md flex items-center gap-1">
                      <Sparkles className="w-3 h-3 fill-black" />
                      <span>الأكثر شعبية</span>
                    </div>
                  ) : null}

                  <div className="p-6 space-y-5">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="w-14 h-14 rounded-2xl bg-neutral-850 border border-neutral-700/80 flex items-center justify-center text-3xl shadow-inner">
                        {plan.icon}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-850 text-neutral-300 border border-neutral-800">
                          {plan.days} يوماً
                        </span>
                        <span className="text-[10px] font-bold text-amber-400/90">
                          تجديد تلقائي للصلاحية
                        </span>
                      </div>
                    </div>

                    {/* Title & Price */}
                    <div>
                      <h3 className="text-lg font-cairo font-black text-white">
                        {plan.name}
                      </h3>
                      <div className="flex items-baseline gap-1.5 mt-2">
                        <span className="text-2xl font-black text-amber-400 font-cairo">
                          {plan.priceCoins.toLocaleString()}
                        </span>
                        <span className="text-xs text-neutral-400 font-tajawal">كوينز / شهر</span>
                      </div>
                    </div>

                    {/* Perks List */}
                    <div className="space-y-2.5 pt-3 border-t border-neutral-800/80">
                      <div className="text-xs font-bold text-neutral-300 font-tajawal">
                        المميزات الحصرية:
                      </div>
                      <ul className="space-y-2">
                        {plan.perks.map((perk: string, i: number) => (
                          <li key={i} className="text-xs text-neutral-300 font-tajawal flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{perk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Buy / Renew Action */}
                  <div className="p-6 pt-0">
                    <button
                      onClick={() => handleBuyVip(plan.id, plan.name, plan.priceCoins)}
                      disabled={isPurchasing || user?.isGuest}
                      className={`w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                        isCurrentTier
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                          : canAfford
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-black shadow-amber-500/20 font-black'
                          : 'bg-neutral-800 hover:bg-neutral-750 text-neutral-300'
                      }`}
                    >
                      {isPurchasing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          <span>جاري المعالجة الآمنة...</span>
                        </>
                      ) : isCurrentTier ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>تجديد الاشتراك (+{plan.days} يوم)</span>
                        </>
                      ) : !canAfford ? (
                        <>
                          <Coins className="w-3.5 h-3.5 text-amber-400" />
                          <span>الرصيد غير كافٍ ({plan.priceCoins} كوينز)</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>ترقية واشتراك الآن</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Security & Fairness Note */}
          <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 flex items-start gap-3 text-xs text-neutral-400 font-tajawal">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-white">أمان وضمان المعاملات:</strong> كافة عمليات الشراء تتم وتُحسب بدقة على الخادم عبر رصيد الكوينز الحقيقي. العضويات مخصصة للمظهر والامتيازات الاجتماعية المميزة ولا تمنح صلاحيات إدارية (Admin/Moderator).
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY VIEW */}
      {activeTab === 'inventory' && !user?.isGuest && (
        <div className="space-y-6">
          {inventory.length === 0 ? (
            <div className="text-center py-20 bg-neutral-900/40 rounded-3xl border border-neutral-800 space-y-4">
              <Package className="w-12 h-12 text-neutral-600 mx-auto" />
              <h3 className="text-lg font-bold text-neutral-300">خزانتك فارغة حالياً</h3>
              <p className="text-neutral-500 text-xs max-w-sm mx-auto">
                لم تقم باقتناء أي شارات أو مميزات بعد. تصفح المعروضات الآن وتميز بحضور فريد!
              </p>
              <button
                onClick={() => setActiveTab('catalog')}
                className="px-5 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 cursor-pointer"
              >
                تصفح المعروضات
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {inventory.map(inv => {
                const item = inv.item;
                const isEquipped = inv.isEquipped;
                const isEquipping = equippingId === item.id;

                return (
                  <div
                    key={inv.id}
                    className={`rounded-3xl bg-neutral-900/80 border p-6 flex flex-col justify-between ${
                      isEquipped
                        ? 'border-emerald-500/60 bg-emerald-950/15 shadow-md shadow-emerald-950/30'
                        : 'border-neutral-800'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-3xl p-3 bg-neutral-800 rounded-2xl border border-neutral-700/60">
                          {item.icon}
                        </span>
                        <div className="text-left">
                          {isEquipped ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/60">
                              <Check className="w-3.5 h-3.5" />
                              <span>مُفعّل على الحساب</span>
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-500 bg-neutral-800/60 px-2 py-0.5 rounded-full">
                              غير مُفعّل
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-white font-cairo mb-1">{item.name}</h3>
                      <p className="text-neutral-400 text-xs leading-relaxed mb-4">{item.description}</p>

                      {inv.expiresAt ? (
                        <div className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-800/30 rounded-xl p-2.5 flex items-center gap-2 mb-4">
                          <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>ينتهي في: {new Date(inv.expiresAt).toLocaleDateString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-emerald-400/90 bg-emerald-950/20 border border-emerald-800/20 rounded-xl p-2.5 flex items-center gap-2 mb-4">
                          <Crown className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>شارة دائمة بدون انتهاء صلاحية</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleEquip(item.id, !isEquipped)}
                      disabled={isEquipping}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        isEquipped
                          ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                      }`}
                    >
                      {isEquipped ? 'إلغاء التفعيل' : 'تفعيل في بطاقتي وقائمتي'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ADMIN SHOP MANAGER VIEW (Owner Only) */}
      {activeTab === 'admin' && isOwner && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-neutral-900/80 p-5 rounded-2xl border border-neutral-800">
            <div>
              <h2 className="text-lg font-bold text-white font-cairo">لوحة إدارة المتجر</h2>
              <p className="text-xs text-neutral-400">إضافة شارات جديدة، تعديل الأسعار، ومميزات التثبيت والإطارات</p>
            </div>
            <button
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  name: '',
                  description: '',
                  icon: '👑',
                  priceCoins: 150,
                  type: 'badge',
                  category: 'distinctive',
                  durationHours: '',
                  badgeTag: '',
                  badgeColor: 'from-amber-400 to-yellow-600',
                  frameStyle: 'gold'
                });
                setAdminModalOpen(true);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة عنصر جديد للمتجر</span>
            </button>
          </div>

          <div className="bg-neutral-900/60 rounded-3xl border border-neutral-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-bold">
                  <tr>
                    <th className="p-4">الأيقونة والاسم</th>
                    <th className="p-4">النوع</th>
                    <th className="p-4">السعر</th>
                    <th className="p-4">المدة</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {items.map(item => (
                    <tr key={item.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="p-4 flex items-center gap-2.5 font-bold text-white">
                        <span className="text-xl p-1 bg-neutral-800 rounded-lg">{item.icon}</span>
                        <div>
                          <div>{item.name}</div>
                          <div className="text-[11px] text-neutral-400 font-normal line-clamp-1">{item.description}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-medium">
                          {item.type === 'badge' ? 'شارة' : item.type === 'pin_profile' ? 'تثبيت حساب' : 'إطار بطاقة'}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-amber-400">{item.priceCoins} كوينز</td>
                      <td className="p-4 text-neutral-300">
                        {item.durationHours ? `${item.durationHours} ساعة` : 'دائم'}
                      </td>
                      <td className="p-4">
                        <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                          نشط
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingItem(item);
                              setFormData({
                                name: item.name,
                                description: item.description,
                                icon: item.icon,
                                priceCoins: item.priceCoins,
                                type: item.type,
                                category: item.category,
                                durationHours: item.durationHours || '',
                                badgeTag: item.metadata?.badgeTag || '',
                                badgeColor: item.metadata?.badgeColor || 'from-amber-400 to-yellow-600',
                                frameStyle: item.metadata?.frameStyle || 'gold'
                              });
                              setAdminModalOpen(true);
                            }}
                            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg cursor-pointer"
                            title="تعديل"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/40 rounded-lg cursor-pointer"
                            title="تعطيل"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Add/Edit Modal */}
      {adminModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white font-cairo">
              {editingItem ? 'تعديل عنصر المتجر' : 'إضافة عنصر جديد إلى المتجر'}
            </h3>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-neutral-300 font-semibold mb-1">اسم الشارة أو الميزة</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: شارة الصقر الذهبي"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-semibold mb-1">الوصف التفصيلي</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف للشارة أو الميزة وكيفية ظهورها..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">الرمز أو الإيموجي</label>
                  <input
                    type="text"
                    required
                    value={formData.icon}
                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white text-center text-lg"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">السعر (بالكوينز)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.priceCoins}
                    onChange={e => setFormData({ ...formData, priceCoins: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">النوع</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="badge">شارة للعضوية</option>
                    <option value="pin_profile">تثبيت الحساب في القمة</option>
                    <option value="card_frame">إطار لكرت العضو</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-semibold mb-1">المدة بالساعات (فارغ = دائم)</label>
                  <input
                    type="number"
                    value={formData.durationHours}
                    onChange={e => setFormData({ ...formData, durationHours: e.target.value })}
                    placeholder="فارغ ليكون دائم"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setAdminModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold shadow-md cursor-pointer"
                >
                  حفظ العنصر
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
