import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Sparkles,
  Crown,
  Gift,
  Coins,
  ShieldCheck,
  Layers,
  X,
  Upload,
  Clock,
  Tag,
  ArrowUpDown
} from 'lucide-react';

export interface StoreProduct {
  id: string;
  section: 'badges' | 'features' | 'vip_plans' | 'gifts' | 'coin_packages' | 'verification';
  name: string;
  englishName?: string;
  description: string;
  icon: string;
  imageUrl?: string;
  price: number;
  currency: string;
  type?: string;
  duration?: number | null;
  durationUnit?: 'hours' | 'days';
  category?: string;
  displayOrder: number;
  isActive: boolean;
  perks?: string[];
  metadata?: any;
  coins?: number;
  bonusCoins?: number;
  popular?: boolean;
}

export const StoreManagementPanel: React.FC<{ onStoreUpdated?: () => void }> = ({ onStoreUpdated }) => {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [verificationData, setVerificationData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState({
    section: 'badges' as StoreProduct['section'],
    name: '',
    englishName: '',
    description: '',
    icon: '👑',
    imageUrl: '',
    price: 100,
    currency: 'coins',
    duration: '',
    category: 'distinctive',
    displayOrder: 1,
    isActive: true,
    perksText: '',
    type: 'badge',
    coins: 100,
    bonusCoins: 0,
    popular: false
  });

  // Verification Settings Modal
  const [verificationModalOpen, setVerificationModalOpen] = useState<boolean>(false);
  const [verificationForm, setVerificationForm] = useState({
    price: 500,
    durationDays: 30,
    perks: '',
    enabled: true
  });

  const fetchStoreData = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{
        success: boolean;
        items: StoreProduct[];
        verification: any;
        counts: any;
      }>('/admin/store/all');

      if (res && res.success) {
        setProducts(res.items || []);
        setVerificationData(res.verification);
        if (res.verification) {
          setVerificationForm({
            price: res.verification.price || 500,
            durationDays: res.verification.duration || 30,
            perks: res.verification.perks || '',
            enabled: res.verification.isActive !== false
          });
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch admin store data:', err);
      setStatusMessage({ text: err.message || 'فشل جلب بيانات المتجر', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner) {
      fetchStoreData();
    }
  }, [isOwner]);

  const handleOpenAddModal = (defaultSection: StoreProduct['section'] = 'badges') => {
    setEditingProduct(null);
    setFormData({
      section: defaultSection,
      name: '',
      englishName: '',
      description: '',
      icon: defaultSection === 'vip_plans' ? '👑' : defaultSection === 'gifts' ? '🎁' : defaultSection === 'coin_packages' ? '🪙' : '⭐',
      imageUrl: '',
      price: defaultSection === 'coin_packages' ? 50 : 150,
      currency: defaultSection === 'coin_packages' ? 'EGP' : 'coins',
      duration: defaultSection === 'vip_plans' ? '30' : defaultSection === 'badges' ? '' : '48',
      category: 'distinctive',
      displayOrder: products.length + 1,
      isActive: true,
      perksText: defaultSection === 'vip_plans' ? 'شارة ملكية متألقة\nأولوية التواجد والظهور\nرومات خاصة مفتوحة' : '',
      type: defaultSection === 'features' ? 'card_frame' : 'badge',
      coins: 100,
      bonusCoins: 0,
      popular: false
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (prod: StoreProduct) => {
    setEditingProduct(prod);
    setFormData({
      section: prod.section,
      name: prod.name,
      englishName: prod.englishName || '',
      description: prod.description || '',
      icon: prod.icon || '⭐',
      imageUrl: prod.imageUrl || '',
      price: prod.price || 0,
      currency: prod.currency || (prod.section === 'coin_packages' ? 'EGP' : 'coins'),
      duration: prod.duration ? String(prod.duration) : '',
      category: prod.category || 'distinctive',
      displayOrder: prod.displayOrder || 0,
      isActive: prod.isActive,
      perksText: prod.perks ? prod.perks.join('\n') : '',
      type: prod.type || (prod.section === 'badges' ? 'badge' : 'card_frame'),
      coins: prod.coins || 100,
      bonusCoins: prod.bonusCoins || 0,
      popular: !!prod.popular
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setStatusMessage({ text: 'يرجى إدخال اسم المنتج', type: 'error' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const perksArray = formData.perksText
        .split('\n')
        .map(p => p.trim())
        .filter(Boolean);

      const payload = {
        section: formData.section,
        name: formData.name.trim(),
        englishName: formData.englishName.trim(),
        description: formData.description.trim(),
        icon: formData.icon.trim() || '⭐',
        imageUrl: formData.imageUrl.trim(),
        price: Number(formData.price) || 0,
        currency: formData.currency,
        duration: formData.duration ? parseInt(formData.duration, 10) : null,
        category: formData.category,
        displayOrder: parseInt(String(formData.displayOrder), 10) || 0,
        isActive: formData.isActive,
        perks: perksArray,
        type: formData.type,
        coins: Number(formData.coins) || Number(formData.price),
        bonusCoins: Number(formData.bonusCoins) || 0,
        popular: formData.popular
      };

      if (editingProduct) {
        // PUT update
        await apiRequest(`/admin/store/items/${editingProduct.section}/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setStatusMessage({ text: `تم تحديث المنتج «${payload.name}» بنجاح وتطبيقه في المتجر!`, type: 'success' });
      } else {
        // POST create
        await apiRequest('/admin/store/items', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setStatusMessage({ text: `تمت إضافة المنتج «${payload.name}» بنجاح إلى المتجر!`, type: 'success' });
      }

      setModalOpen(false);
      setEditingProduct(null);
      await fetchStoreData();
      if (onStoreUpdated) onStoreUpdated();
    } catch (err: any) {
      console.error('Save product error:', err);
      setStatusMessage({ text: err.message || 'حدث خطأ أثناء حفظ المنتج', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisibility = async (prod: StoreProduct) => {
    try {
      const res = await apiRequest<{ success: boolean; isActive: boolean; message: string }>(
        `/admin/store/items/${prod.section}/${prod.id}/toggle-visibility`,
        { method: 'POST' }
      );

      setStatusMessage({
        text: res.message || (res.isActive ? 'تم إظهار المنتج في المتجر' : 'تم إخفاء المنتج وأرشفته'),
        type: 'success'
      });

      // Update local state instantly
      setProducts(prev =>
        prev.map(p => (p.id === prod.id && p.section === prod.section ? { ...p, isActive: res.isActive } : p))
      );

      if (onStoreUpdated) onStoreUpdated();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'فشل تغيير حالة ظهور المنتج', type: 'error' });
    }
  };

  const handleDeleteProduct = async (prod: StoreProduct) => {
    const confirmMessage = `هل أنت متأكد من حذف / أرشفة «${prod.name}» من متجر فضفضه؟\n\nتأكيد أمان: لن يتم حذف مشتريات الأعضاء السابقة أو سجلات الدفع أو الميزات التي حصلوا عليها، بل سيتم إخفاء المنتج من المتجر للمبيعات الجديدة فقط.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/admin/store/items/${prod.section}/${prod.id}`,
        { method: 'DELETE' }
      );

      setStatusMessage({
        text: res.message || 'تمت أرشفة المنتج وإخفاؤه بنجاح مع الحفاظ على سجلات المشترين السابقة',
        type: 'success'
      });

      // Mark as inactive locally
      setProducts(prev =>
        prev.map(p => (p.id === prod.id && p.section === prod.section ? { ...p, isActive: false } : p))
      );

      if (onStoreUpdated) onStoreUpdated();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'فشل حذف المنتج من المتجر', type: 'error' });
    }
  };

  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/admin/verification-settings', {
        method: 'POST',
        body: JSON.stringify(verificationForm)
      });
      setStatusMessage({ text: 'تم حفظ إعدادات علامة التوثيق وتطبيقها في المتجر بنجاح!', type: 'success' });
      setVerificationModalOpen(false);
      await fetchStoreData();
      if (onStoreUpdated) onStoreUpdated();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'فشل حفظ إعدادات التوثيق', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => {
    if (activeFilter === 'badges' && p.section !== 'badges') return false;
    if (activeFilter === 'features' && p.section !== 'features') return false;
    if (activeFilter === 'vip_plans' && p.section !== 'vip_plans') return false;
    if (activeFilter === 'gifts' && p.section !== 'gifts') return false;
    if (activeFilter === 'coin_packages' && p.section !== 'coin_packages') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = p.name?.toLowerCase().includes(q);
      const matchDesc = p.description?.toLowerCase().includes(q);
      const matchCat = p.category?.toLowerCase().includes(q);
      return matchName || matchDesc || matchCat;
    }
    return true;
  });

  const getSectionBadge = (section: StoreProduct['section'], type?: string) => {
    switch (section) {
      case 'badges':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">شارة تميز</span>;
      case 'features':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">{type === 'card_frame' ? 'إطار بطاقة' : 'ميزة رقمية'}</span>;
      case 'vip_plans':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">عضوية VIP</span>;
      case 'gifts':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">هدية تفاعلية</span>;
      case 'coin_packages':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">باقة كوينز</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-300">عنصر</span>;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in" dir="rtl">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-amber-950/60 via-neutral-900 to-purple-950/40 border border-amber-500/30 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>صلاحيات المالك الحصرية الكاملة</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-cairo flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-amber-400" />
              <span>لوحة التحكم الكاملة في متجر فضفضه</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 font-tajawal max-w-2xl leading-relaxed">
              تحكم شامل في كافة معروضات المتجر: الشارات، إطارات البطاقات، المميزات الرقمية، اشتراكات VIP، علامة التوثيق، الهدايا، وباقات الكوينز.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleOpenAddModal('badges')}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-400 hover:to-yellow-500 text-neutral-950 font-black text-xs font-cairo flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>إضافة منتج جديد</span>
            </button>

            <button
              onClick={() => setVerificationModalOpen(true)}
              className="px-3.5 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold font-cairo flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>إعدادات التوثيق</span>
            </button>

            <button
              onClick={fetchStoreData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Status Alerts */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs font-bold animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900/60 p-3 rounded-2xl border border-neutral-800">
        <div className="flex items-center flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'كافة المنتجات', count: products.length },
            { id: 'badges', label: 'الشارات والعلامات', count: products.filter(p => p.section === 'badges').length },
            { id: 'features', label: 'المميزات والإطارات', count: products.filter(p => p.section === 'features').length },
            { id: 'vip_plans', label: 'عضويات VIP', count: products.filter(p => p.section === 'vip_plans').length },
            { id: 'gifts', label: 'الهدايا التفاعلية', count: products.filter(p => p.section === 'gifts').length },
            { id: 'coin_packages', label: 'باقات الكوينز', count: products.filter(p => p.section === 'coin_packages').length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeFilter === tab.id
                  ? 'bg-amber-500 text-neutral-950 shadow-md font-black'
                  : 'bg-neutral-800/60 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                activeFilter === tab.id ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-700 text-neutral-300'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الوصف..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Products Table View */}
      <div className="bg-neutral-900/60 rounded-3xl border border-neutral-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-neutral-950/90 border-b border-neutral-800 text-neutral-400 font-bold font-tajawal">
              <tr>
                <th className="p-4">المنتج والأيقونة</th>
                <th className="p-4">النوع / القسم</th>
                <th className="p-4">السعر والعملة</th>
                <th className="p-4">الصلاحية والمدة</th>
                <th className="p-4">الترتيب</th>
                <th className="p-4">حالة العرض</th>
                <th className="p-4 text-center">إجراءات المالك</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-tajawal">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-500 font-tajawal">
                    لا توجد منتجات مطابقة في هذا القسم. انقر على «إضافة منتج جديد» للبدء.
                  </td>
                </tr>
              ) : (
                filteredProducts.map(prod => (
                  <tr
                    key={`${prod.section}_${prod.id}`}
                    className={`hover:bg-neutral-800/30 transition-colors ${
                      !prod.isActive ? 'opacity-65 bg-neutral-950/40' : ''
                    }`}
                  >
                    {/* Name & Icon */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700/60 flex items-center justify-center text-xl shadow shrink-0 overflow-hidden">
                          {prod.imageUrl ? (
                            <img src={prod.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{prod.icon || '⭐'}</span>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="font-bold text-white font-cairo flex items-center gap-1.5">
                            <span>{prod.name}</span>
                            {prod.popular && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                                مميز
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 line-clamp-1 max-w-xs">
                            {prod.description}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Section Badge */}
                    <td className="p-4">
                      {getSectionBadge(prod.section, prod.type)}
                    </td>

                    {/* Price & Currency */}
                    <td className="p-4">
                      <span className="font-bold text-amber-400 font-cairo text-sm">
                        {prod.price} {prod.currency === 'coins' ? 'كوينز' : prod.currency}
                      </span>
                      {prod.bonusCoins ? (
                        <div className="text-[10px] text-emerald-400">+{prod.bonusCoins} مجاناً</div>
                      ) : null}
                    </td>

                    {/* Duration */}
                    <td className="p-4 text-neutral-300">
                      {prod.duration ? (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-400" />
                          <span>
                            {prod.duration} {prod.durationUnit === 'hours' ? 'ساعة' : 'يوم'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-emerald-400 font-semibold">دائم مدى الحياة</span>
                      )}
                    </td>

                    {/* Display Order */}
                    <td className="p-4 text-neutral-400 font-mono">
                      #{prod.displayOrder || 0}
                    </td>

                    {/* Active / Hidden Status */}
                    <td className="p-4">
                      {prod.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>معروض في المتجر</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                          <EyeOff className="w-3 h-3 text-neutral-400" />
                          <span>مخفي ومؤرشف</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Toggle visibility */}
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(prod)}
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            prod.isActive
                              ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
                              : 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-800'
                          }`}
                          title={prod.isActive ? 'إخفاء من المتجر' : 'إظهار في المتجر'}
                        >
                          {prod.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(prod)}
                          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors cursor-pointer"
                          title="تعديل بيانات المنتج"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete / Archive */}
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod)}
                          className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/50 transition-colors cursor-pointer"
                          title="أرشفة المنتج (يحافظ على مشتريات الأعضاء)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
          <div className="bg-[#0f1118] border border-neutral-700/80 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl text-right my-8">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-white font-cairo flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-400" />
                <span>{editingProduct ? 'تعديل منتج في المتجر' : 'إضافة منتج جديد لمتجر فضفضه'}</span>
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs font-tajawal">
              {/* Product Section Type */}
              {!editingProduct && (
                <div>
                  <label className="block text-neutral-300 font-bold mb-1.5">نوع وقسم المنتج في المتجر</label>
                  <select
                    value={formData.section}
                    onChange={e => {
                      const sec = e.target.value as StoreProduct['section'];
                      setFormData({
                        ...formData,
                        section: sec,
                        currency: sec === 'coin_packages' ? 'EGP' : 'coins',
                        type: sec === 'features' ? 'card_frame' : 'badge',
                        icon: sec === 'vip_plans' ? '👑' : sec === 'gifts' ? '🎁' : sec === 'coin_packages' ? '🪙' : '⭐'
                      });
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-cairo focus:outline-none focus:border-amber-500"
                  >
                    <option value="badges">شارة تميز بجانب الاسم (Badges)</option>
                    <option value="features">ميزة رقمية / إطار بطاقة الملف (Features & Frames)</option>
                    <option value="vip_plans">باقة اشتراك عضوية VIP (VIP Plans)</option>
                    <option value="gifts">هدية تفاعلية للغرف والمحادثات (Interactive Gifts)</option>
                    <option value="coin_packages">باقة شحن رصيد كوينز (Coin Packages)</option>
                  </select>
                </div>
              )}

              {/* Name & English name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">اسم المنتج الظاهر للمستخدمين *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="مثال: شارة الصقر الذهبي"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">المعرف الإنجليزي (اختياري)</label>
                  <input
                    type="text"
                    value={formData.englishName}
                    onChange={e => setFormData({ ...formData, englishName: e.target.value })}
                    placeholder="مثال: golden_falcon"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-neutral-300 font-bold mb-1">الوصف والمميزات الظاهرة للمستخدم</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف تفصيلي يشرح ميزات المنتج ومظهره وكيفية الاستفادة منه..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Icon & Image URL */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">رمز الأيقونة (إيموجي)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={e => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="👑 أو 🌿 أو 🎁"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white text-center text-lg focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-neutral-300 font-bold mb-1">رابط صورة مخصصة (اختياري)</label>
                  <input
                    type="text"
                    value={formData.imageUrl}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://... أو /uploads/..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Price, Currency & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">السعر *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">العملة</label>
                  <select
                    value={formData.currency}
                    onChange={e => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-cairo focus:outline-none focus:border-amber-500"
                  >
                    <option value="coins">كوينز منصة فضفضه</option>
                    <option value="EGP">جنيه مصري (EGP)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    {formData.section === 'vip_plans' ? 'المدة بالأيام' : 'المدة بالساعات (فارغ = دائم)'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.duration}
                    onChange={e => setFormData({ ...formData, duration: e.target.value })}
                    placeholder={formData.section === 'vip_plans' ? 'مثال: 30' : 'فارغ = دائم'}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Specific for VIP Plans: Perks list */}
              {formData.section === 'vip_plans' && (
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">
                    قائمة الامتيازات الحصرية (ميزة في كل سطر)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.perksText}
                    onChange={e => setFormData({ ...formData, perksText: e.target.value })}
                    placeholder="شارة التاج الملكي الذهبي&#10;دخول غير محدود لجميع الرومات&#10;مضاعفة نقاط الخبرة XP"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 leading-relaxed font-tajawal"
                  />
                </div>
              )}

              {/* Specific for Coin Packages: Coins & Bonus */}
              {formData.section === 'coin_packages' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-300 font-bold mb-1">عدد الكوينز الأساسي</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.coins}
                      onChange={e => setFormData({ ...formData, coins: Number(e.target.value) })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-neutral-300 font-bold mb-1">كوينز إضافية بونص مجاني</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.bonusCoins}
                      onChange={e => setFormData({ ...formData, bonusCoins: Number(e.target.value) })}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Display Order & Active status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-neutral-800/80">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">ترتيب الظهور في القائمة</label>
                  <input
                    type="number"
                    value={formData.displayOrder}
                    onChange={e => setFormData({ ...formData, displayOrder: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                    <span className="font-bold text-neutral-200">تفعيل المنتج وعرضه في المتجر فوراً</span>
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs font-cairo cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs font-cairo flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingProduct ? 'تحديث وتطبيق التعديل' : 'إضافة المنتج للمتجر'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Verification Badge Settings Modal */}
      {verificationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0f1118] border border-sky-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base sm:text-lg font-bold text-white font-cairo flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span>إدارة منتج علامة التوثيق المدفوعة</span>
              </h3>
              <button
                onClick={() => setVerificationModalOpen(false)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVerification} className="space-y-4 text-xs font-tajawal">
              <div>
                <label className="block text-neutral-300 font-bold mb-1">سعر الاشتراك (بالكوينز)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={verificationForm.price}
                  onChange={e => setVerificationForm({ ...verificationForm, price: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">مدة الاشتراك (بالأيام)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={verificationForm.durationDays}
                  onChange={e => setVerificationForm({ ...verificationForm, durationDays: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">المميزات والوصف المكتوب للمستخدمين</label>
                <textarea
                  rows={3}
                  value={verificationForm.perks}
                  onChange={e => setVerificationForm({ ...verificationForm, perks: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white leading-relaxed"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="verif_enabled"
                  checked={verificationForm.enabled}
                  onChange={e => setVerificationForm({ ...verificationForm, enabled: e.target.checked })}
                  className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                />
                <label htmlFor="verif_enabled" className="text-neutral-200 font-bold cursor-pointer select-none">
                  تفعيل منتج علامة التوثيق وإتاحته للشراء في المتجر
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setVerificationModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-black text-xs font-cairo shadow-lg"
                >
                  حفظ إعدادات التوثيق
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
