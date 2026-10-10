import React, { useState, useEffect } from 'react';
import { apiRequest, uploadMedia } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldAlert,
  Users,
  AlertTriangle,
  Settings,
  CheckCircle2,
  Ban,
  Crown,
  Shield,
  FileText,
  Save,
  Trash2,
  Search,
  Coins,
  Wallet,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Edit3,
  Sliders,
  Award,
  Zap,
  Tag,
  Check,
  X,
  RefreshCw,
  Calendar,
  Newspaper,
  Target,
  Megaphone,
  Shuffle,
  ExternalLink,
  Eye,
  MousePointerClick,
  CreditCard,
  Clock,
  CheckCheck,
  XCircle,
  Copy,
  AlertCircle
} from 'lucide-react';
import { EventsPage } from './EventsPage';
import { NewsPage } from './NewsPage';
import { MissionsPage } from './MissionsPage';

export const AdminPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'wallet' | 'vip' | 'events' | 'news' | 'missions' | 'reports' | 'settings' | 'story_ads' | 'random_chat' | 'audit' | 'payments'>('overview');
  const [stats, setStats] = useState<any>(null);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Economy & Wallet states
  const [economyStats, setEconomyStats] = useState<any>(null);
  const [userSearchTerm, setUserSearchTerm] = useState<string>('');
  const [walletTargetUser, setWalletTargetUser] = useState<any | null>(null);
  const [coinsAmount, setCoinsAmount] = useState<number>(100);
  const [coinsOperation, setCoinsOperation] = useState<'add' | 'subtract' | 'set'>('add');
  const [coinsReason, setCoinsReason] = useState<string>('مكافأة تقديرية من المالك');
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Coin Packages states
  const [adminCoinPackages, setAdminCoinPackages] = useState<any[]>([]);
  const [editingCoinPackage, setEditingCoinPackage] = useState<any | null>(null);
  const [newPackageModalOpen, setNewPackageModalOpen] = useState<boolean>(false);

  // VIP Plans states
  const [vipPlansList, setVipPlansList] = useState<any[]>([]);
  const [editingVipPlan, setEditingVipPlan] = useState<any | null>(null);
  const [newPlanModalOpen, setNewPlanModalOpen] = useState<boolean>(false);
  const [vipTargetUser, setVipTargetUser] = useState<any | null>(null);
  const [vipGrantLevel, setVipGrantLevel] = useState<string>('gold');
  const [vipGrantDays, setVipGrantDays] = useState<number>(30);

  // Level & XP Modal state
  const [levelTargetUser, setLevelTargetUser] = useState<any | null>(null);
  const [targetLevel, setTargetLevel] = useState<number>(1);
  const [targetXp, setTargetXp] = useState<number>(0);
  const [targetStreak, setTargetStreak] = useState<number>(1);

  // Settings states
  const [guestLimit, setGuestLimit] = useState<number>(500);
  const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

  // Story Ads states
  const [storyAdsList, setStoryAdsList] = useState<any[]>([]);
  const [adModalOpen, setAdModalOpen] = useState<boolean>(false);
  const [editingAd, setEditingAd] = useState<any | null>(null);
  const [adFormTitle, setAdFormTitle] = useState<string>('');
  const [adFormDesc, setAdFormDesc] = useState<string>('');
  const [adFormImage, setAdFormImage] = useState<string>('');
  const [adFormLink, setAdFormLink] = useState<string>('');
  const [adFormPriority, setAdFormPriority] = useState<number>(1);
  const [adFormInterval, setAdFormInterval] = useState<number>(3);
  const [adFormActive, setAdFormActive] = useState<boolean>(true);
  const [savingAd, setSavingAd] = useState<boolean>(false);

  // Random Chat Pricing & Limits states
  const [randomSettings, setRandomSettings] = useState({
    price_chat_per_min: 1,
    price_voice_per_min: 3,
    price_video_per_min: 5,
    free_attempts: 4,
    free_minutes_per_session: 5
  });
  // Audit Logs states
  const [auditLogsList, setAuditLogsList] = useState<any[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState<boolean>(false);
  const [auditFilter, setAuditFilter] = useState<string>('all');

  const fetchAuditLogs = async () => {
    try {
      setAuditLogsLoading(true);
      const res = await apiRequest('/admin/audit-logs');
      setAuditLogsList(res.logs || []);
    } catch (e) {
      console.error('Fetch audit logs error:', e);
    } finally {
      setAuditLogsLoading(false);
    }
  };

  // Manual Payments & Transfers states (InstaPay & Wallets)
  const [paymentOrdersList, setPaymentOrdersList] = useState<any[]>([]);
  const [paymentOrdersLoading, setPaymentOrdersLoading] = useState<boolean>(false);
  const [paymentOrderFilter, setPaymentOrderFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [paymentSubTab, setPaymentSubTab] = useState<'orders' | 'settings'>('orders');
  const [paymentConfig, setPaymentConfig] = useState<any>({
    manual_transfers_enabled: false,
    methods: [],
    general_instructions: '',
    warning_notice: ''
  });
  const [paymentConfigLoading, setPaymentConfigLoading] = useState<boolean>(false);
  const [savingPaymentConfig, setSavingPaymentConfig] = useState<boolean>(false);
  const [orderActionModal, setOrderActionModal] = useState<{ type: 'approve' | 'reject'; order: any } | null>(null);
  const [orderActionNotes, setOrderActionNotes] = useState<string>('');
  const [orderActionLoading, setOrderActionLoading] = useState<boolean>(false);

  const fetchPaymentOrders = async (statusFilter?: string) => {
    try {
      setPaymentOrdersLoading(true);
      const filter = statusFilter !== undefined ? statusFilter : paymentOrderFilter;
      const res = await apiRequest(`/admin/payment-orders${filter !== 'all' ? `?status=${filter}` : ''}`);
      setPaymentOrdersList(res.orders || []);
    } catch (e) {
      console.error('Fetch payment orders error:', e);
    } finally {
      setPaymentOrdersLoading(false);
    }
  };

  const fetchPaymentSettings = async () => {
    try {
      setPaymentConfigLoading(true);
      const res = await apiRequest('/admin/payment-settings');
      if (res.config) {
        setPaymentConfig(res.config);
      }
    } catch (e) {
      console.error('Fetch payment settings error:', e);
    } finally {
      setPaymentConfigLoading(false);
    }
  };

  const handleSavePaymentSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSavingPaymentConfig(true);
      await apiRequest('/admin/payment-settings', {
        method: 'POST',
        body: JSON.stringify(paymentConfig)
      });
      showNotification('تم حفظ إعدادات ووسائل التحويل المباشر بنجاح! 💳');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ إعدادات الدفع');
    } finally {
      setSavingPaymentConfig(false);
    }
  };

  const handleConfirmOrderAction = async () => {
    if (!orderActionModal) return;
    const { type, order } = orderActionModal;
    setOrderActionLoading(true);
    try {
      if (type === 'approve') {
        const res = await apiRequest(`/admin/payment-orders/${order.id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ notes: orderActionNotes.trim() })
        });
        showNotification(res.message || 'تم اعتماد طلب الشحن وإيداع الكوينز بنجاح! 🎉');
      } else {
        const res = await apiRequest(`/admin/payment-orders/${order.id}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason: orderActionNotes.trim() || 'لم يتم العثور على التحويل البنكي المطابق' })
        });
        showNotification(res.message || 'تم رفض طلب الشحن وتنبيه المستخدم.');
      }
      setOrderActionModal(null);
      setOrderActionNotes('');
      await fetchPaymentOrders();
      if (refreshUser) await refreshUser();
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء معالجة الطلب');
    } finally {
      setOrderActionLoading(false);
    }
  };

  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin' || isOwner;

  const showNotification = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3500);
  };

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/admin/overview');
      setStats(res.stats);
      setGuestLimit(res.guestLimit);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/admin/users');
      setUsersList(res.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchEconomyStats = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/admin/economy-stats');
      setEconomyStats(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCoinPackages = async () => {
    try {
      const res = await apiRequest('/admin/coins/packages');
      setAdminCoinPackages(res.packages || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVipPlans = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/admin/vip/plans');
      setVipPlansList(res.plans || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/admin/reports');
      setReportsList(res.reports || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStoryAds = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/admin/story-ads');
      setStoryAdsList(res.ads || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchRandomSettings = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/admin/random-settings');
      if (res.settings) {
        setRandomSettings({
          price_chat_per_min: Number(res.settings.price_chat_per_min) || 1,
          price_voice_per_min: Number(res.settings.price_voice_per_min) || 3,
          price_video_per_min: Number(res.settings.price_video_per_min) || 5,
          free_attempts: Number(res.settings.free_attempts) || 4,
          free_minutes_per_session: Number(res.settings.free_minutes_per_session) || 5
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'wallet') {
      fetchEconomyStats();
      fetchCoinPackages();
      fetchUsers();
    }
    if (activeTab === 'vip') {
      fetchVipPlans();
      fetchUsers();
    }
    if (activeTab === 'reports') fetchReports();
    if (activeTab === 'story_ads') fetchStoryAds();
    if (activeTab === 'random_chat') fetchRandomSettings();
    if (activeTab === 'audit') fetchAuditLogs();
    if (activeTab === 'payments') {
      fetchPaymentOrders();
      fetchPaymentSettings();
    }
  }, [activeTab]);

  const handleSaveRandomSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRandomSettings(true);
    try {
      await apiRequest('/admin/random-settings', {
        method: 'PUT',
        body: JSON.stringify(randomSettings)
      });
      setRandomSettingsSaved(true);
      showNotification('تم حفظ أسعار وإعدادات التواصل العشوائي بنجاح!');
      setTimeout(() => setRandomSettingsSaved(false), 2500);
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSavingRandomSettings(false);
    }
  };

  const handleOpenNewAdModal = () => {
    setEditingAd(null);
    setAdFormTitle('');
    setAdFormDesc('');
    setAdFormImage('');
    setAdFormLink('');
    setAdFormPriority(1);
    setAdFormInterval(3);
    setAdFormActive(true);
    setAdModalOpen(true);
  };

  const handleOpenEditAdModal = (ad: any) => {
    setEditingAd(ad);
    setAdFormTitle(ad.title || '');
    setAdFormDesc(ad.description || '');
    setAdFormImage(ad.image_url || '');
    setAdFormLink(ad.link_url || '');
    setAdFormPriority(ad.priority || 1);
    setAdFormInterval(ad.display_interval || 3);
    setAdFormActive(ad.is_active === 1);
    setAdModalOpen(true);
  };

  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adFormTitle.trim() || !adFormImage.trim()) {
      alert('العنوان وصورة الإعلان مطلوبان');
      return;
    }
    setSavingAd(true);
    try {
      if (editingAd) {
        await apiRequest(`/admin/story-ads/${editingAd.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: adFormTitle.trim(),
            description: adFormDesc.trim(),
            image_url: adFormImage.trim(),
            link_url: adFormLink.trim(),
            priority: Number(adFormPriority) || 1,
            display_interval: Number(adFormInterval) || 3,
            is_active: adFormActive ? 1 : 0
          })
        });
        showNotification('تم تحديث الإعلان بنجاح');
      } else {
        await apiRequest('/admin/story-ads', {
          method: 'POST',
          body: JSON.stringify({
            title: adFormTitle.trim(),
            description: adFormDesc.trim(),
            image_url: adFormImage.trim(),
            link_url: adFormLink.trim(),
            priority: Number(adFormPriority) || 1,
            display_interval: Number(adFormInterval) || 3,
            is_active: adFormActive ? 1 : 0
          })
        });
        showNotification('تمت إضافة الإعلان بنجاح');
      }
      setAdModalOpen(false);
      fetchStoryAds();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الإعلان');
    } finally {
      setSavingAd(false);
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً؟')) return;
    try {
      await apiRequest(`/admin/story-ads/${adId}`, { method: 'DELETE' });
      showNotification('تم حذف الإعلان بنجاح');
      fetchStoryAds();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الإعلان');
    }
  };

  const handleToggleAdActive = async (ad: any) => {
    try {
      const nextState = ad.is_active === 1 ? 0 : 1;
      await apiRequest(`/admin/story-ads/${ad.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_active: nextState })
      });
      fetchStoryAds();
      showNotification(nextState === 1 ? 'تم تفعيل الإعلان' : 'تم تعطيل الإعلان');
    } catch (err: any) {
      alert('فشل تغيير حالة الإعلان');
    }
  };

  const handleBanUser = async (userId: string, currentBanned: boolean) => {
    if (!confirm(currentBanned ? 'إلغاء حظر المستخدم؟' : 'هل أنت متأكد من حظر هذا المستخدم؟')) return;
    try {
      await apiRequest(`/admin/users/${userId}/ban`, {
        method: 'POST',
        body: JSON.stringify({ ban: !currentBanned, reason: 'مخالفة معايير المجتمع' })
      });
      fetchUsers();
      showNotification('تم تحديث حالة الحظر بنجاح');
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة المستخدم');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!isOwner) {
      alert('صلاحية تعيين الرتب الإدارية محصورة حصراً لمالك المنصة (Owner)');
      return;
    }
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: 'POST',
        body: JSON.stringify({ role: newRole })
      });
      showNotification('تم تحديث الرتبة بنجاح');
      fetchUsers();
    } catch (err: any) {
      alert(err.message || 'فشل تحديث الرتبة');
    }
  };

  // Owner Wallet Adjustment
  const handleUpdateCoins = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletTargetUser) return;
    try {
      const res = await apiRequest(`/admin/users/${walletTargetUser.id}/coins`, {
        method: 'POST',
        body: JSON.stringify({
          amount: coinsAmount,
          operation: coinsOperation,
          reason: coinsReason
        })
      });
      showNotification(res.message || 'تم تحديث رصيد الكوينز بنجاح');
      setWalletTargetUser(null);
      fetchUsers();
      fetchEconomyStats();
      if (user?.id === walletTargetUser.id) {
        refreshUser();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تعديل الرصيد');
    }
  };

  // Owner VIP Grant
  const handleGrantVip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vipTargetUser) return;
    try {
      const res = await apiRequest(`/admin/users/${vipTargetUser.id}/vip`, {
        method: 'POST',
        body: JSON.stringify({
          vipLevel: vipGrantLevel,
          days: vipGrantDays
        })
      });
      showNotification(res.message || 'تم تحديث عضوية VIP بنجاح');
      setVipTargetUser(null);
      fetchUsers();
      if (user?.id === vipTargetUser.id) {
        refreshUser();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث عضوية VIP');
    }
  };

  // Owner Level & XP Update
  const handleUpdateGamification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!levelTargetUser) return;
    try {
      const res = await apiRequest(`/admin/users/${levelTargetUser.id}/gamification`, {
        method: 'POST',
        body: JSON.stringify({
          level: targetLevel,
          xp: targetXp,
          streak: targetStreak
        })
      });
      showNotification(res.message || 'تم تحديث المستوى ونقاط الخبرة بنجاح');
      setLevelTargetUser(null);
      fetchUsers();
      if (user?.id === levelTargetUser.id) {
        refreshUser();
      }
    } catch (err: any) {
      alert(err.message || 'فشل تحديث المستوى');
    }
  };

  // Owner Save VIP Plan Changes
  const handleSaveVipPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVipPlan) return;
    try {
      const perksArray = typeof editingVipPlan.perksText === 'string'
        ? editingVipPlan.perksText.split('\n').map((s: string) => s.trim()).filter(Boolean)
        : editingVipPlan.perks;

      await apiRequest(`/admin/vip/plans/${editingVipPlan.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editingVipPlan.name,
          icon: editingVipPlan.icon,
          badge: editingVipPlan.badge,
          priceCoins: editingVipPlan.priceCoins,
          days: editingVipPlan.days,
          color: editingVipPlan.color,
          border: editingVipPlan.border,
          text: editingVipPlan.text,
          popular: editingVipPlan.popular,
          isActive: editingVipPlan.isActive,
          perks: perksArray
        })
      });
      showNotification(`تم حفظ تعديلات باقة ${editingVipPlan.name} بنجاح!`);
      setEditingVipPlan(null);
      fetchVipPlans();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ باقة VIP');
    }
  };

  // Owner Create New VIP Plan
  const handleCreateVipPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const priceCoins = Number(formData.get('priceCoins'));
    const days = Number(formData.get('days') || 30);
    const icon = (formData.get('icon') as string) || '👑';
    const badge = (formData.get('badge') as string) || name;
    const perksText = formData.get('perks') as string;
    const perks = perksText ? perksText.split('\n').map(s => s.trim()).filter(Boolean) : [];

    try {
      await apiRequest('/admin/vip/plans', {
        method: 'POST',
        body: JSON.stringify({
          id,
          name,
          priceCoins,
          days,
          icon,
          badge,
          color: 'from-amber-700 to-amber-900',
          border: 'border-amber-600',
          text: 'text-amber-300',
          perks
        })
      });
      showNotification('تم إنشاء باقة VIP الجديدة بنجاح!');
      setNewPlanModalOpen(false);
      fetchVipPlans();
    } catch (err: any) {
      alert(err.message || 'فشل إنشاء باقة VIP');
    }
  };

  // Owner Delete VIP Plan
  const handleDeleteVipPlan = async (planId: string, planName: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف باقة "${planName}" نهائياً من المتجر وقاعدة البيانات؟`)) return;
    try {
      await apiRequest(`/admin/vip/plans/${planId}`, { method: 'DELETE' });
      showNotification(`تم حذف باقة "${planName}" بنجاح`);
      fetchVipPlans();
    } catch (err: any) {
      alert(err.message || 'فشل حذف باقة VIP');
    }
  };

  // Owner Save Coin Package (Create or Update)
  const handleSaveCoinPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    const pkgData = {
      id: (formData.get('id') as string)?.trim(),
      name: (formData.get('name') as string)?.trim(),
      coins: Number(formData.get('coins')) || 0,
      bonusCoins: Number(formData.get('bonusCoins')) || 0,
      priceAmount: Number(formData.get('priceAmount')) || 0,
      currency: (formData.get('currency') as string)?.trim() || 'SAR',
      icon: (formData.get('icon') as string)?.trim() || '🪙',
      badge: (formData.get('badge') as string)?.trim() || '',
      popular: formData.get('popular') === 'on' || formData.get('popular') === '1',
      isActive: formData.get('isActive') === 'on' || formData.get('isActive') === '1',
      displayOrder: Number(formData.get('displayOrder')) || 0
    };

    try {
      if (editingCoinPackage) {
        await apiRequest(`/admin/coins/packages/${editingCoinPackage.id}`, {
          method: 'PUT',
          body: JSON.stringify(pkgData)
        });
        showNotification('تم تحديث بيانات باقة الكوينز بنجاح');
      } else {
        await apiRequest('/admin/coins/packages', {
          method: 'POST',
          body: JSON.stringify(pkgData)
        });
        showNotification('تمت إضافة باقة الكوينز الجديدة بنجاح');
      }
      setNewPackageModalOpen(false);
      setEditingCoinPackage(null);
      fetchCoinPackages();
      fetchEconomyStats();
    } catch (err: any) {
      showNotification(err.message || 'فشل حفظ باقة الكوينز');
    }
  };

  // Owner Delete Coin Package
  const handleDeleteCoinPackage = async (pkgId: string, pkgName: string) => {
    try {
      await apiRequest(`/admin/coins/packages/${pkgId}`, { method: 'DELETE' });
      showNotification(`تم حذف باقة "${pkgName}" بنجاح`);
      fetchCoinPackages();
      fetchEconomyStats();
    } catch (err: any) {
      showNotification(err.message || 'فشل حذف الباقة');
    }
  };

  const handleResolveReport = async (reportId: string, actionTaken: string) => {
    try {
      await apiRequest(`/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ status: 'action_taken', actionTaken })
      });
      fetchReports();
      showNotification('تم معالجة البلاغ بنجاح');
    } catch (err: any) {
      alert(err.message || 'فشل معالجة البلاغ');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ guestMessageLimit: guestLimit })
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (err) {
      alert('فشل حفظ الإعدادات');
    }
  };

  const filteredUsers = usersList.filter(u =>
    (u.username || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (u.id || '').toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in pb-12">
      {/* Toast Alert Banner */}
      {actionSuccessMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-950 border border-emerald-500 text-emerald-200 text-sm font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Admin Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-amber-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            <h1 className="text-2xl sm:text-3xl font-cairo font-black text-white">لوحة تحكم إدارة المنصة</h1>
            <span className={`text-xs px-2.5 py-0.5 rounded-md font-bold border ${
              isOwner
                ? 'bg-amber-950 text-amber-300 border-amber-800'
                : 'bg-rose-950 text-rose-300 border-rose-800'
            }`}>
              {isOwner ? '👑 المالك (OWNER)' : user?.role.toUpperCase()}
            </span>
          </div>
          <p className="text-sm text-neutral-400 font-tajawal max-w-xl">
            {isOwner
              ? 'صلاحيات المالك الكاملة: التحكم في المحفظة، أسعار وباقات VIP، تعديل المستويات، وإدارة النظام.'
              : 'متابعة النشاط، مراجعة البلاغات، وإدارة المستخدمين.'}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center flex-wrap gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-2xl shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'overview' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            نظرة عامة
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            المستخدمون
          </button>
          {isOwner && (
            <>
              <button
                onClick={() => setActiveTab('wallet')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'wallet' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                المحفظة والكوينز
              </button>
              <button
                onClick={() => setActiveTab('vip')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'vip' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                باقات VIP
              </button>
              <button
                onClick={() => setActiveTab('events')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'events' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                الفعاليات
              </button>
              <button
                onClick={() => setActiveTab('news')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'news' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <Newspaper className="w-3.5 h-3.5 text-amber-400" />
                الأخبار والمنشورات
              </button>
              <button
                onClick={() => setActiveTab('missions')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'missions' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <Target className="w-3.5 h-3.5 text-amber-400" />
                المهام اليومية
              </button>
              <button
                onClick={() => setActiveTab('story_ads')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'story_ads' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                إعلانات القصص
              </button>
              <button
                onClick={() => setActiveTab('random_chat')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'random_chat' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                أسعار التواصل العشوائي
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'audit' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                سجل تدقيق الإدارة
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'payments' ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm' : 'text-neutral-400 hover:text-amber-300'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                <span>التحويلات والدفع</span>
                {paymentOrdersList.filter(o => o.status === 'pending').length > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-neutral-950 font-black">
                    {paymentOrdersList.filter(o => o.status === 'pending').length}
                  </span>
                )}
              </button>
            </>
          )}
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'reports' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            البلاغات ({stats?.pendingReports || 0})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'settings' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              إعدادات النظام
            </button>
          )}
        </div>
      </div>

      {/* 1. OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-5 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-2">
              <span className="text-xs text-neutral-400 font-tajawal">الأعضاء المسجلون</span>
              <div className="text-2xl font-black font-cairo text-white">{stats?.totalUsers || 0}</div>
            </div>

            <div className="p-5 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-2">
              <span className="text-xs text-neutral-400 font-tajawal">جلسات الزوار</span>
              <div className="text-2xl font-black font-cairo text-teal-400">{stats?.totalGuests || 0}</div>
            </div>

            <div className="p-5 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-2">
              <span className="text-xs text-neutral-400 font-tajawal">المتواجدون لحظياً</span>
              <div className="text-2xl font-black font-cairo text-emerald-400">{stats?.onlineCount || 0}</div>
            </div>

            <div className="p-5 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-2">
              <span className="text-xs text-neutral-400 font-tajawal">المجالس النشطة</span>
              <div className="text-2xl font-black font-cairo text-white">{stats?.totalRooms || 0}</div>
            </div>

            <div className="p-5 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-2">
              <span className="text-xs text-neutral-400 font-tajawal">البلاغات المعلقة</span>
              <div className="text-2xl font-black font-cairo text-rose-400">{stats?.pendingReports || 0}</div>
            </div>
          </div>

          {/* Quick Actions Card for Owner */}
          {isOwner && (
            <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-neutral-900 to-[#0e1017] border border-amber-800/40 space-y-4">
              <div className="flex items-center gap-2 text-amber-400 font-cairo font-bold">
                <Crown className="w-5 h-5" />
                <span>لوحة التحكم السريعة للمالك (Owner Quick Actions)</span>
              </div>
              <p className="text-xs text-neutral-300 font-tajawal leading-relaxed">
                بصفتك مالك المنصة، تملك الصلاحية المباشرة لتعديل رصيد المحفظة لأي مستخدم، ترقية وتعديل باقات وأسعار ومميزات VIP، وتعيين المستويات والرتب.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('wallet')}
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/20 cursor-pointer"
                >
                  <Coins className="w-4 h-4" />
                  إدارة المحفظة وتعديل الكوينز
                </button>
                <button
                  onClick={() => setActiveTab('vip')}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-amber-800/80 font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Crown className="w-4 h-4" />
                  تعديل باقات ومميزات VIP
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Users className="w-4 h-4" />
                  قائمة المستخدمين والرتب
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. USERS MANAGEMENT TAB */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="rounded-3xl bg-[#0e1017] border border-neutral-800 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-cairo font-bold text-sm text-white">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>قائمة المستخدمين والتحكم الكامل في الحسابات</span>
                <span className="text-xs text-neutral-400">({filteredUsers.length} من {usersList.length})</span>
              </div>

              {/* Search filter */}
              <div className="relative max-w-xs w-full">
                <Search className="w-4 h-4 text-neutral-500 absolute right-3 top-2.5" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو المعرف..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pr-9 pl-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-500 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-neutral-900/60 text-neutral-400 border-b border-neutral-800">
                  <tr>
                    <th className="p-3.5">المستخدم</th>
                    <th className="p-3.5">الرتبة</th>
                    <th className="p-3.5">VIP</th>
                    <th className="p-3.5">الكوينز</th>
                    <th className="p-3.5">المستوى</th>
                    <th className="p-3.5">الحالة</th>
                    <th className="p-3.5 text-left">إجراءات المالك والتحكم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="p-3.5 font-bold text-white flex items-center gap-2">
                        <span>{u.username}</span>
                        {u.is_guest === 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">زائر</span>
                        )}
                        {u.role === 'owner' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">المالك</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {isOwner && u.role !== 'owner' ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-white text-xs"
                          >
                            <option value="user">عضو (User)</option>
                            <option value="moderator">مشرف (Moderator)</option>
                            <option value="admin">مدير (Admin)</option>
                          </select>
                        ) : (
                          <span className="font-bold text-amber-400">{u.role}</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          u.vip_level && u.vip_level !== 'none'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : 'text-neutral-500'
                        }`}>
                          {u.vip_level && u.vip_level !== 'none' ? `VIP ${u.vip_level.toUpperCase()}` : 'قياسي'}
                        </span>
                      </td>

                      <td className="p-3.5 text-amber-400 font-bold font-cairo">
                        {u.coins || 0}
                      </td>

                      <td className="p-3.5 text-emerald-400 font-bold">
                        Lv.{u.level || 1}
                      </td>

                      <td className="p-3.5">
                        {u.is_banned === 1 ? (
                          <span className="text-rose-400 font-bold">محظور ⛔</span>
                        ) : (
                          <span className="text-emerald-400">نشط ✓</span>
                        )}
                      </td>

                      <td className="p-3.5 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {isOwner && (
                            <>
                              <button
                                title="تعديل رصيد المحفظة والكوينز"
                                onClick={() => {
                                  setWalletTargetUser(u);
                                  setCoinsAmount(100);
                                  setCoinsOperation('add');
                                }}
                                className="px-2 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900 text-amber-300 border border-amber-800/80 text-xs font-bold cursor-pointer flex items-center gap-1"
                              >
                                <Coins className="w-3.5 h-3.5" />
                                <span>المحفظة</span>
                              </button>

                              <button
                                title="تعديل عضوية VIP"
                                onClick={() => {
                                  setVipTargetUser(u);
                                  setVipGrantLevel(u.vip_level !== 'none' ? u.vip_level : 'gold');
                                  setVipGrantDays(30);
                                }}
                                className="px-2 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900 text-purple-300 border border-purple-800/80 text-xs font-bold cursor-pointer flex items-center gap-1"
                              >
                                <Crown className="w-3.5 h-3.5" />
                                <span>VIP</span>
                              </button>

                              <button
                                title="تعديل المستوى ونقاط الخبرة"
                                onClick={() => {
                                  setLevelTargetUser(u);
                                  setTargetLevel(u.level || 1);
                                  setTargetXp(u.xp || 0);
                                  setTargetStreak(u.streak || 1);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/80 text-xs font-bold cursor-pointer flex items-center gap-1"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>المستوى</span>
                              </button>
                            </>
                          )}

                          {u.role !== 'owner' && (
                            <button
                              onClick={() => handleBanUser(u.id, u.is_banned === 1)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                                u.is_banned === 1
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900'
                              }`}
                            >
                              {u.is_banned === 1 ? 'إلغاء' : 'حظر'}
                            </button>
                          )}
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

      {/* 3. OWNER WALLET & COINS TAB */}
      {activeTab === 'wallet' && isOwner && (
        <div className="space-y-6">
          {/* Economy overview stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-[#0e1017] border border-amber-900/40 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-tajawal mb-2">
                <span>إجمالي الكوينز المتداولة</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black font-cairo text-amber-400">
                {(economyStats?.totalCoins || 0).toLocaleString('ar-EG')}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-tajawal">مجموع أرصدة كافة حسابات الأعضاء الحالية</p>
            </div>

            <div className="p-5 rounded-3xl bg-[#0e1017] border border-purple-900/40">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-tajawal mb-2">
                <span>مشتركو باقات VIP الفعالة</span>
                <Crown className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-3xl font-black font-cairo text-purple-300">
                {economyStats?.vipCounts?.reduce((acc: number, cur: any) => acc + (cur.count || 0), 0) || 0}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-tajawal">
                {economyStats?.vipCounts?.map((v: any) => `${v.vip_level}: ${v.count}`).join(' · ') || 'لا توجد عضويات نشطة بعد'}
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-[#0e1017] border border-cyan-900/40">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-tajawal mb-2">
                <span>إجمالي استهلاك الهدايا والمتجر</span>
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-black font-cairo text-cyan-300">
                {(economyStats?.totalGiftsCount || 0) + (economyStats?.totalShopPurchases?.count || 0)} حركة
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-tajawal">
                {economyStats?.totalGiftsCount || 0} هدايا · {economyStats?.totalShopPurchases?.count || 0} مقتنيات شارات
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-[#0e1017] border border-emerald-900/40">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-tajawal mb-2">
                <span>محاكاة الشحن التجريبي (Sandbox)</span>
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-cairo text-emerald-300">
                +{((economyStats?.totalRecharges?.total) || 0).toLocaleString('ar-EG')} كوينز
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-tajawal">
                {economyStats?.totalRecharges?.count || 0} عمليات شحن تجريبية مسجلة
              </p>
            </div>
          </div>

          {/* Quick Owner Wallet Action Bar */}
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Wallet className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h4 className="font-cairo font-bold text-xs text-white">إدارة المحافظ والشحن اليدوي الفوري</h4>
                <p className="text-[11px] text-neutral-400 font-tajawal">يمكنك كمالك للمنصة إضافة أو خصم كوينز لأي حساب فورياً من جدول المستخدمين أدناه.</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (usersList.length > 0) {
                  setWalletTargetUser(usersList[0]);
                  setCoinsAmount(100);
                  setCoinsOperation('add');
                }
              }}
              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-black text-xs cursor-pointer shadow-md shrink-0 flex items-center justify-center gap-1.5"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>تعديل رصيد مستخدم الآن</span>
            </button>
          </div>

          {/* COIN PACKAGES MANAGEMENT (إدارة باقات شحن الكوينز) */}
          <div className="space-y-4 rounded-3xl bg-[#0e1017] border border-neutral-800 p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
              <div>
                <h3 className="font-cairo font-bold text-base text-white flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span>إدارة باقات شحن الكوينز (Coin Packages)</span>
                </h3>
                <p className="text-xs text-neutral-400 font-tajawal">
                  تحديد أسعار الباقات بالريال السعودي أو العملات المعتمدة، كميات الكوينز، والبونص المجاني. تنعكس التعديلات لحظياً في المحفظة والمتجر.
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingCoinPackage(null);
                  setNewPackageModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة باقة جديدة</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
              {adminCoinPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`p-4 rounded-2xl border bg-neutral-900/80 flex flex-col justify-between space-y-3 relative overflow-hidden ${
                    pkg.isActive ? 'border-neutral-800' : 'border-neutral-800/50 opacity-60'
                  }`}
                >
                  {pkg.badge && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 self-start">
                      {pkg.badge}
                    </span>
                  )}

                  <div className="space-y-1.5">
                    <div className="text-3xl">{pkg.icon || '🪙'}</div>
                    <h4 className="font-cairo font-black text-sm text-white">{pkg.name}</h4>
                    <div className="text-xs text-amber-400 font-cairo font-bold">
                      {pkg.coins.toLocaleString()} كوينز
                      {pkg.bonusCoins > 0 && <span className="text-emerald-400 font-normal"> (+{pkg.bonusCoins} بونص)</span>}
                    </div>
                    <div className="text-xs text-neutral-300 font-cairo">
                      السعر: <strong className="text-white">{pkg.priceAmount}</strong> {pkg.currency}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-neutral-800/80 flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingCoinPackage(pkg);
                        setNewPackageModalOpen(true);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3 text-amber-400" />
                      <span>تعديل</span>
                    </button>
                    <button
                      onClick={() => handleDeleteCoinPackage(pkg.id, pkg.name)}
                      className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-xs cursor-pointer"
                      title="حذف الباقة"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TOP GIFTS ANALYTICS */}
          {economyStats?.topGifts && economyStats.topGifts.length > 0 && (
            <div className="space-y-3 rounded-3xl bg-[#0e1017] border border-neutral-800 p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="font-cairo font-bold text-sm text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  <span>الهدايا الأكثر إرسالاً وتداولاً بين الأعضاء</span>
                </h3>
                <span className="text-xs text-neutral-500 font-tajawal">مؤشر رواج الهدايا في الدردشات</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {economyStats.topGifts.map((gift: any) => (
                  <div key={gift.id} className="p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800 text-center space-y-1">
                    <div className="text-2xl">{gift.icon || '🎁'}</div>
                    <div className="font-cairo font-bold text-xs text-white truncate">{gift.arabic_name || gift.name}</div>
                    <div className="text-[10px] text-amber-400 font-cairo">{gift.price_coins} كوينز</div>
                    <div className="text-[10px] text-emerald-400 font-tajawal bg-emerald-950/40 py-0.5 rounded-md border border-emerald-800/40">
                      أُرسلت {gift.send_count || 0} مرة
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Wallets & Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Wallets */}
            <div className="p-5 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between font-cairo font-bold text-sm text-white">
                <span className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-amber-400" />
                  أعلى المحافظ رصيداً في المنصة
                </span>
                <span className="text-xs text-neutral-500">أثرياء فضفضه</span>
              </div>

              <div className="divide-y divide-neutral-900">
                {economyStats?.topWallets?.map((w: any, idx: number) => (
                  <div key={w.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-neutral-500 w-5">#{idx + 1}</span>
                      <div>
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{w.username}</span>
                          {w.vip_level !== 'none' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                              VIP {w.vip_level}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-500">المستوى: {w.level || 1}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-cairo font-bold text-sm text-amber-400">{w.coins} كوينز</span>
                      <button
                        onClick={() => {
                          setWalletTargetUser(w);
                          setCoinsAmount(100);
                          setCoinsOperation('add');
                        }}
                        className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs cursor-pointer"
                        title="تعديل الرصيد"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="p-5 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between font-cairo font-bold text-sm text-white">
                <span className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-400" />
                  آخر الحركات المالية والعمليات
                </span>
                <span className="text-xs text-neutral-500">سجل المعاملات</span>
              </div>

              <div className="divide-y divide-neutral-900 max-h-[380px] overflow-y-auto">
                {economyStats?.recentTransactions?.map((tx: any) => {
                  const isPositive = tx.amount > 0;
                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                          isPositive ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}>
                          {isPositive ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white font-cairo">
                            {tx.username}: {tx.description}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            {new Date(tx.created_at).toLocaleDateString('ar-EG')} · {new Date(tx.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div className={`font-cairo font-bold text-xs ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? `+${tx.amount}` : tx.amount}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. OWNER VIP PLANS & TIERS TAB */}
      {activeTab === 'vip' && isOwner && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-cairo font-bold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                إدارة باقات وعضويات VIP وأسعارها
              </h2>
              <p className="text-xs text-neutral-400 font-tajawal">
                تعديل أسعار الكوينز، مدة الأيام، والمميزات الخاصة بكل باقة. التعديلات تنعكس لحظياً في كافة أرجاء المنصة.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setNewPlanModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                إضافة باقة VIP جديدة
              </button>
            </div>
          </div>

          {/* VIP Plans Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {vipPlansList.map((plan) => (
              <div
                key={plan.id}
                className={`p-5 rounded-3xl border bg-gradient-to-b ${plan.color || 'from-neutral-900 to-neutral-950'} ${plan.border || 'border-neutral-800'} flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{plan.icon || '👑'}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                      plan.isActive ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-neutral-800 text-neutral-400 border-neutral-700'
                    }`}>
                      {plan.isActive ? 'نشطة في المتجر ✓' : 'معطلة'}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-cairo font-black text-lg text-white">{plan.name}</h3>
                    <div className="text-sm font-bold text-amber-300 font-cairo mt-1">
                      {plan.priceCoins} كوينز / {plan.days} يوماً
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-neutral-800/80">
                    <span className="text-[11px] font-bold text-neutral-400">المميزات ({plan.perks?.length || 0}):</span>
                    <ul className="text-xs text-neutral-300/90 font-tajawal space-y-1">
                      {plan.perks?.map((p: string, idx: number) => (
                        <li key={idx} className="flex items-center gap-1.5 truncate">✓ {p}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-3 border-t border-neutral-800/60 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingVipPlan({
                        ...plan,
                        perksText: plan.perks?.join('\n') || ''
                      });
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                    <span>تعديل</span>
                  </button>

                  <button
                    onClick={() => handleDeleteVipPlan(plan.id, plan.name)}
                    className="py-2.5 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/80 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    title="حذف الباقة نهائياً"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. EVENTS MANAGEMENT TAB (Owner/Admin) */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="font-cairo font-bold text-sm text-white">إدارة الفعاليات الرسمية</h3>
                <p className="text-xs text-neutral-400 font-tajawal">إنشاء وتعديل وحذف فعاليات المنصة المجدولة والسابقة</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-300 bg-amber-900/40 px-2.5 py-1 rounded-lg border border-amber-700/50">
              صلاحية المالك
            </span>
          </div>
          <EventsPage />
        </div>
      )}

      {/* 6. NEWS & POSTS MANAGEMENT TAB (Owner/Admin) */}
      {activeTab === 'news' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Newspaper className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="font-cairo font-bold text-sm text-white">إدارة المنشورات والأخبار</h3>
                <p className="text-xs text-neutral-400 font-tajawal">نشر الأخبار الرسمية، التحديثات، التثبيت، والتحكم بالمنشورات</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-300 bg-amber-900/40 px-2.5 py-1 rounded-lg border border-amber-700/50">
              صلاحية المالك
            </span>
          </div>
          <NewsPage />
        </div>
      )}

      {/* 7. DAILY MISSIONS MANAGEMENT TAB (Owner Only) */}
      {activeTab === 'missions' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Target className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <h3 className="font-cairo font-bold text-sm text-white">إدارة المهام اليومية</h3>
                <p className="text-xs text-neutral-400 font-tajawal">إضافة وتعديل وحذف المهام وتحديد شروطها ومكافآت الـ XP والكوينز</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-amber-300 bg-amber-900/40 px-2.5 py-1 rounded-lg border border-amber-700/50">
              صلاحية المالك حصراً
            </span>
          </div>
          <MissionsPage />
        </div>
      )}

      {/* 8. REPORTS TAB */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reportsList.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800 text-xs text-neutral-400">
              لا توجد بلاغات معلقة حالياً. المنصة في أمان وسلامة.
            </div>
          ) : (
            reportsList.map((rep) => (
              <div key={rep.id} className="p-5 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="px-2.5 py-1 rounded-md bg-amber-950 text-amber-300 border border-amber-800">
                      {rep.category}
                    </span>
                    <span className="text-neutral-400">مُقدم من: {rep.reporter_username || 'عضو'}</span>
                    <span>←</span>
                    <span className="text-rose-400">ضد: {rep.reported_username || 'مجهول'}</span>
                  </div>

                  <span className="text-[10px] text-neutral-500">
                    {new Date(rep.created_at).toLocaleDateString('ar-EG')}
                  </span>
                </div>

                <p className="text-xs text-neutral-300 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800/80 font-tajawal">
                  "{rep.details}"
                </p>

                <div className="flex items-center gap-2 pt-2 border-t border-neutral-900 justify-end">
                  <button
                    onClick={() => handleResolveReport(rep.id, 'تم توجيه إنذار')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs cursor-pointer"
                  >
                    توجيه إنذار
                  </button>
                  <button
                    onClick={() => handleResolveReport(rep.id, 'تم حظر المخالف')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer"
                  >
                    حظر المخالف
                  </button>
                  <button
                    onClick={() => handleResolveReport(rep.id, 'حفظ وبلاغ كيدي')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 text-xs cursor-pointer"
                  >
                    تجاهل وحفظ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 6. SETTINGS TAB */}
      {activeTab === 'settings' && isAdmin && (
        <div className="max-w-xl p-6 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-5">
          <h2 className="font-cairo font-bold text-base text-white flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-400" />
            إعدادات النظام العامة والزوار
          </h2>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                الحد الأقصى لرسائل الزوار (افتراضياً 500 رسالة)
              </label>
              <input
                type="number"
                min={50}
                max={5000}
                value={guestLimit}
                onChange={(e) => setGuestLimit(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm"
              />
              <p className="text-[11px] text-neutral-500 mt-1 font-tajawal">
                ينتهي حساب الزائر عند إرسال هذا العدد من الرسائل ويُطلب منه التسجيل مجاناً (18+).
              </p>
            </div>

            {settingsSaved && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم حفظ إعدادات النظام بنجاح!</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 cursor-pointer"
            >
              حفظ إعدادات المنصة
            </button>
          </form>
        </div>
      )}

      {/* 7. STORY ADS MANAGEMENT TAB */}
      {activeTab === 'story_ads' && isOwner && (
        <div className="space-y-5 animate-in fade-in" dir="rtl">
          <div className="p-5 rounded-3xl bg-[#0e1017] border border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="font-cairo font-bold text-base text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-400" />
                إدارة الإعلانات داخل القصص (Stories Ads)
              </h2>
              <p className="text-xs text-neutral-400 font-tajawal max-w-xl">
                إعلانات هادئة ورشيقة تظهر أثناء تصفح القصص بمعدل تكرار محدد ومكتوب عليها "إعلان ممول"، مع تتبع مرات المشاهدة والنقرات.
              </p>
            </div>
            <button
              onClick={handleOpenNewAdModal}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs font-cairo flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة إعلان جديد</span>
            </button>
          </div>

          {/* Ads List */}
          {loading ? (
            <div className="p-8 text-center text-neutral-400 text-xs">جاري تحميل قائمة الإعلانات...</div>
          ) : storyAdsList.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800 space-y-3 max-w-md mx-auto">
              <Megaphone className="w-10 h-10 text-amber-400 mx-auto opacity-70" />
              <h3 className="font-cairo font-bold text-white text-sm">لا توجد إعلانات منشأة حالياً</h3>
              <p className="text-xs text-neutral-400 font-tajawal">
                يمكنك إنشاء إعلان جديد الآن وإدارته، وتحديد تكرار ظهوره داخل تجربة القصص.
              </p>
              <button
                onClick={handleOpenNewAdModal}
                className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs cursor-pointer"
              >
                + إنشاء أول إعلان
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storyAdsList.map((ad) => {
                const isActive = ad.is_active === 1;
                return (
                  <div
                    key={ad.id}
                    className={`rounded-2xl border p-4 flex flex-col justify-between space-y-3 transition-all ${
                      isActive
                        ? 'bg-[#0f131c] border-neutral-800 hover:border-amber-600/60'
                        : 'bg-neutral-950/60 border-neutral-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 shrink-0">
                        {ad.image_url ? (
                          <img
                            src={ad.image_url}
                            alt={ad.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <Megaphone className="w-6 h-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-cairo font-bold text-xs text-white truncate">{ad.title}</h4>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              isActive
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {isActive ? 'مفعّل' : 'معطّل'}
                          </span>
                        </div>
                        {ad.description && (
                          <p className="text-[11px] text-neutral-400 font-tajawal line-clamp-2">
                            {ad.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl bg-neutral-900/60 border border-neutral-800/80 text-[10px] text-neutral-400 font-tajawal">
                      <div>
                        <span className="block text-neutral-500">التكرار:</span>
                        <strong className="text-white">كل {ad.display_interval || 3} قصص</strong>
                      </div>
                      <div>
                        <span className="block text-neutral-500">المشاهدات:</span>
                        <strong className="text-white flex items-center gap-1">
                          <Eye className="w-2.5 h-2.5 text-neutral-400" />
                          {ad.views_count || 0}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-neutral-500">النقرات:</span>
                        <strong className="text-white flex items-center gap-1">
                          <MousePointerClick className="w-2.5 h-2.5 text-amber-400" />
                          {ad.clicks_count || 0}
                        </strong>
                      </div>
                    </div>

                    {ad.link_url && (
                      <a
                        href={ad.link_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate">{ad.link_url}</span>
                      </a>
                    )}

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleAdActive(ad)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer ${
                          isActive
                            ? 'text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800'
                            : 'text-emerald-300 hover:text-emerald-200 bg-emerald-950/80 border border-emerald-800'
                        }`}
                      >
                        {isActive ? 'تعطيل' : 'تفعيل'}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditAdModal(ad)}
                          className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                          title="تعديل الإعلان"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAd(ad.id)}
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 cursor-pointer"
                          title="حذف الإعلان"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 8. RANDOM CHAT PRICING & LIMITS TAB */}
      {activeTab === 'random_chat' && isOwner && (
        <div className="max-w-2xl p-6 rounded-3xl bg-[#0e1017] border border-amber-800/60 space-y-5 animate-in fade-in" dir="rtl">
          <div className="space-y-1">
            <h2 className="font-cairo font-bold text-base text-white flex items-center gap-2">
              <Shuffle className="w-5 h-5 text-amber-400" />
              إعدادات وأسعار التواصل العشوائي
            </h2>
            <p className="text-xs text-neutral-400 font-tajawal">
              تحديد أسعار الدقائق بالكوينز للدردشة النصية والمكالمات الصوتية والمرئية، وتحديد عدد ومدّة الجلسات المجانية. جميع الحسابات والتوقيتات تتم برمجتها Server-Side لضمان النزاهة.
            </p>
          </div>

          <form onSubmit={handleSaveRandomSettings} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 font-tajawal">
              🌟 كل مستخدم يحصل تلقائياً على <strong>{randomSettings.free_attempts} جلسات مجانية</strong> مدة كل جلسة <strong>{randomSettings.free_minutes_per_session} دقائق</strong>، وبعد انتهائها يتم احتساب الرصيد بالدقائق وفق الأسعار أدناه.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                <label className="block text-xs font-semibold text-white font-cairo">
                  سعر المحادثة النصية:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={randomSettings.price_chat_per_min}
                    onChange={(e) =>
                      setRandomSettings({ ...randomSettings, price_chat_per_min: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs font-bold font-cairo"
                  />
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">كوينز/دقيقة</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                <label className="block text-xs font-semibold text-white font-cairo">
                  سعر المكالمة الصوتية:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={randomSettings.price_voice_per_min}
                    onChange={(e) =>
                      setRandomSettings({ ...randomSettings, price_voice_per_min: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs font-bold font-cairo"
                  />
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">كوينز/دقيقة</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                <label className="block text-xs font-semibold text-white font-cairo">
                  سعر مكالمة الفيديو:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={randomSettings.price_video_per_min}
                    onChange={(e) =>
                      setRandomSettings({ ...randomSettings, price_video_per_min: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs font-bold font-cairo"
                  />
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">كوينز/دقيقة</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                <label className="block text-xs font-semibold text-white font-cairo">
                  عدد الجلسات المجانية الإجمالية:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={randomSettings.free_attempts}
                    onChange={(e) =>
                      setRandomSettings({ ...randomSettings, free_attempts: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs font-bold font-cairo"
                  />
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">جلسات مجانية</span>
                </div>
                <p className="text-[10px] text-neutral-500 font-tajawal">الافتراضي: 4 جلسات لكل مستخدم.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                <label className="block text-xs font-semibold text-white font-cairo">
                  مدة الجلسة المجانية الواحدة:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={randomSettings.free_minutes_per_session}
                    onChange={(e) =>
                      setRandomSettings({ ...randomSettings, free_minutes_per_session: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs font-bold font-cairo"
                  />
                  <span className="text-[11px] text-neutral-400 whitespace-nowrap">دقائق</span>
                </div>
                <p className="text-[10px] text-neutral-500 font-tajawal">الافتراضي: 5 دقائق لكل جلسة.</p>
              </div>
            </div>

            {randomSettingsSaved && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>تم حفظ أسعار وإعدادات التواصل العشوائي بنجاح!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={savingRandomSettings}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-sm font-cairo shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              {savingRandomSettings ? 'جاري الحفظ...' : 'حفظ أسعار وإعدادات التواصل العشوائي'}
            </button>
          </form>
        </div>
      )}

      {/* 9. AUDIT LOGS TAB (Owner Hegazy Only) */}
      {activeTab === 'audit' && isOwner && (
        <div className="space-y-4 animate-in fade-in" dir="rtl">
          <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                سجل تدقيق العمليات الإدارية والمالية (Audit Log)
              </h2>
              <p className="text-xs text-neutral-400 font-tajawal">
                سجل غير قابل للتعديل يوثق جميع التعديلات الحساسة التي تمت على الباقات، الأرصدة، رتب VIP، الفعاليات، وبنود المتجر.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAuditLogs}
                disabled={auditLogsLoading}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold font-tajawal flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${auditLogsLoading ? 'animate-spin' : ''}`} />
                تحديث السجل
              </button>
            </div>
          </div>

          {/* Audit Filter */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold font-tajawal">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'admin_adjust_coins', label: 'تعديل المحافظ' },
              { id: 'owner_sandbox_recharge', label: 'شحن تجريبي' },
              { id: 'vip', label: 'اشتراكات وباقات VIP' },
              { id: 'coin_package', label: 'باقات الكوينز' },
              { id: 'shop', label: 'المتجر' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setAuditFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                  auditFilter === f.id
                    ? 'bg-amber-500 text-neutral-950 font-black shadow-sm'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Logs List */}
          <div className="rounded-3xl bg-neutral-900/60 border border-neutral-800 divide-y divide-neutral-800/80 overflow-hidden">
            {auditLogsLoading ? (
              <div className="p-8 text-center text-neutral-400 text-xs font-tajawal flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                جاري تحميل سجل التدقيق...
              </div>
            ) : auditLogsList.length === 0 ? (
              <div className="p-8 text-center text-neutral-400 text-xs font-tajawal">
                لا توجد سجلات تدقيق مسجلة حتى الآن.
              </div>
            ) : (
              auditLogsList
                .filter(log => {
                  if (auditFilter === 'all') return true;
                  if (auditFilter === 'vip') return log.action.includes('vip');
                  if (auditFilter === 'coin_package') return log.action.includes('package');
                  if (auditFilter === 'shop') return log.action.includes('shop');
                  return log.action === auditFilter;
                })
                .map(log => (
                  <div key={log.id} className="p-4 hover:bg-neutral-800/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-800 text-[11px] font-bold text-amber-300 font-cairo">
                          {log.action}
                        </span>
                        <span className="text-xs font-bold text-white font-cairo">
                          بواسطة: {log.actor_username || 'Hegazy (المالك)'}
                        </span>
                        {log.target_type && (
                          <span className="text-[11px] text-neutral-500">
                            الهدف: {log.target_type}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-300 font-tajawal leading-relaxed">
                        {log.details}
                      </p>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-tajawal whitespace-nowrap sm:text-left dir-ltr">
                      {new Date(log.created_at).toLocaleString('ar-EG', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* 10. MANUAL PAYMENTS & TRANSFERS TAB (Owner Hegazy Only) */}
      {activeTab === 'payments' && isOwner && (
        <div className="space-y-5 animate-in fade-in" dir="rtl">
          {/* Header */}
          <div className="p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl font-cairo font-black text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-400" />
                إدارة طلبات الشحن والتحويلات اليدوية (InstaPay ومحافظ المحمول)
              </h2>
              <p className="text-xs text-neutral-400 font-tajawal">
                نظام شحن يدوي مباشر بالجنيه المصري: مراجعة إشعارات التحويل والمطابقة البنكية قبل اعتماد الكوينز، مع حماية المعاملات ضد التكرار.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  fetchPaymentOrders();
                  fetchPaymentSettings();
                }}
                disabled={paymentOrdersLoading || paymentConfigLoading}
                className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold font-tajawal flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${paymentOrdersLoading || paymentConfigLoading ? 'animate-spin' : ''}`} />
                تحديث البيانات
              </button>
            </div>
          </div>

          {/* Sub-Tabs: Orders vs Settings */}
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-black/40 border border-neutral-800 self-start w-fit">
            <button
              onClick={() => setPaymentSubTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-cairo transition-all cursor-pointer flex items-center gap-2 ${
                paymentSubTab === 'orders'
                  ? 'bg-amber-500 text-neutral-950 font-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>طلبات الشحن الواردة</span>
              {paymentOrdersList.filter(o => o.status === 'pending').length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-neutral-950 text-amber-400">
                  {paymentOrdersList.filter(o => o.status === 'pending').length}
                </span>
              )}
            </button>

            <button
              onClick={() => setPaymentSubTab('settings')}
              className={`px-4 py-2 rounded-xl text-xs font-bold font-cairo transition-all cursor-pointer flex items-center gap-2 ${
                paymentSubTab === 'settings'
                  ? 'bg-amber-500 text-neutral-950 font-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>إعدادات وسائل الاستقبال والحسابات</span>
            </button>
          </div>

          {/* SUB-VIEW 1: ORDERS LIST */}
          {paymentSubTab === 'orders' && (
            <div className="space-y-4">
              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold font-tajawal">
                {[
                  { id: 'all', label: 'كافة الطلبات' },
                  { id: 'pending', label: `قيد الانتظار (${paymentOrdersList.filter(o => o.status === 'pending').length})` },
                  { id: 'approved', label: 'المعتمدة' },
                  { id: 'rejected', label: 'المرفوضة' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      setPaymentOrderFilter(f.id as any);
                      fetchPaymentOrders(f.id);
                    }}
                    className={`px-3.5 py-1.5 rounded-xl cursor-pointer transition-all whitespace-nowrap ${
                      paymentOrderFilter === f.id
                        ? 'bg-amber-500 text-neutral-950 font-black shadow-sm'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Orders Grid / Cards */}
              {paymentOrdersLoading ? (
                <div className="p-12 text-center text-neutral-400 text-xs font-tajawal flex items-center justify-center gap-2 rounded-3xl bg-neutral-900/40 border border-neutral-800">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  جاري تحميل طلبات الشحن...
                </div>
              ) : paymentOrdersList.length === 0 ? (
                <div className="p-12 text-center text-neutral-400 text-xs font-tajawal rounded-3xl bg-neutral-900/40 border border-neutral-800 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p>لا توجد طلبات شحن مطابقة في هذا التصنيف حالياً.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3.5">
                  {paymentOrdersList.map(order => {
                    const isPending = order.status === 'pending';
                    const isApproved = order.status === 'approved';
                    const isRejected = order.status === 'rejected';

                    const totalCoins = (order.packageCoins || 0) + (order.packageBonusCoins || 0);

                    return (
                      <div
                        key={order.id}
                        className={`p-5 rounded-3xl border transition-all space-y-4 ${
                          isPending
                            ? 'bg-neutral-900/95 border-amber-500/50 shadow-lg shadow-amber-950/20'
                            : isApproved
                            ? 'bg-neutral-900/60 border-neutral-800'
                            : 'bg-neutral-900/40 border-neutral-800/60 opacity-80'
                        }`}
                      >
                        {/* Header line */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
                              {order.avatar ? (
                                <img src={order.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-5 h-5 text-neutral-400" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-cairo font-bold text-sm text-white">{order.displayName}</span>
                                <span className="text-[11px] text-neutral-400 font-tajawal">(@{order.username})</span>
                              </div>
                              <span className="text-[10px] text-neutral-500 font-mono">رقم الطلب: {order.id}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {isPending && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 font-tajawal">
                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                بانتظار المراجعة والاعتماد
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 font-tajawal">
                                <CheckCheck className="w-3.5 h-3.5" />
                                معتمد ومودع بالمحفظة
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 font-tajawal">
                                <XCircle className="w-3.5 h-3.5" />
                                مرفوض
                              </span>
                            )}
                            <span className="text-[11px] text-neutral-500 font-tajawal">
                              {new Date(order.createdAt).toLocaleString('ar-EG', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-tajawal">
                          <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800/80 space-y-1">
                            <span className="text-neutral-400 text-[11px] block">الباقة المطلوبة</span>
                            <span className="font-cairo font-bold text-white text-sm block">{order.packageName}</span>
                            <span className="text-amber-400 font-bold text-[11px]">
                              +{totalCoins.toLocaleString('ar-EG')} كوينز
                            </span>
                          </div>

                          <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800/80 space-y-1">
                            <span className="text-neutral-400 text-[11px] block">المبلغ بالجنيه</span>
                            <span className="font-cairo font-black text-amber-400 text-base block">
                              {order.amount} {order.currency}
                            </span>
                            <span className="text-neutral-500 text-[10px]">المطابقة بالبنك</span>
                          </div>

                          <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800/80 space-y-1">
                            <span className="text-neutral-400 text-[11px] block">وسيلة التحويل</span>
                            <span className="font-cairo font-bold text-white block">
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
                            <span className="text-neutral-500 text-[10px]">تحويل مباشر</span>
                          </div>

                          <div className="p-3 rounded-2xl bg-black/40 border border-neutral-800/80 space-y-1">
                            <span className="text-neutral-400 text-[11px] block">اسم ورقم المحول</span>
                            <span className="font-bold text-white block truncate" title={order.senderName}>
                              {order.senderName || 'غير مسجل'}
                            </span>
                            <span className="text-amber-300 font-mono text-[11px] block truncate" title={order.senderPhoneOrHandle}>
                              {order.senderPhoneOrHandle}
                            </span>
                          </div>
                        </div>

                        {/* Extra notes / Reference */}
                        {(order.transactionReference || order.receiptNote) && (
                          <div className="p-3 rounded-2xl bg-neutral-950/60 border border-neutral-800/60 text-xs font-tajawal space-y-1">
                            {order.transactionReference && (
                              <div className="flex items-center gap-2">
                                <span className="text-neutral-400">رقم المعاملة / المرجع:</span>
                                <span className="font-mono text-white font-bold">{order.transactionReference}</span>
                              </div>
                            )}
                            {order.receiptNote && (
                              <div className="flex items-start gap-2">
                                <span className="text-neutral-400 shrink-0">ملاحظات المستخدم:</span>
                                <span className="text-neutral-300">{order.receiptNote}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Admin audit note if reviewed */}
                        {order.adminNotes && !isPending && (
                          <div className="p-2.5 rounded-xl bg-neutral-800/50 text-[11px] font-tajawal text-neutral-300 flex items-center gap-1.5">
                            <span className="text-neutral-400">ملاحظة التدقيق:</span>
                            <span>{order.adminNotes}</span>
                          </div>
                        )}

                        {/* Action buttons (Pending only) */}
                        {isPending && (
                          <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2.5 border-t border-neutral-800/60">
                            <button
                              onClick={() => {
                                setOrderActionNotes('تم مطابقة التحويل مع الحساب البنكي والاعتماد.');
                                setOrderActionModal({ type: 'approve', order });
                              }}
                              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-cairo font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
                            >
                              <CheckCheck className="w-4 h-4" />
                              <span>تأكيد واستلام التحويل (إيداع {totalCoins.toLocaleString('ar-EG')} كوينز)</span>
                            </button>

                            <button
                              onClick={() => {
                                setOrderActionNotes('');
                                setOrderActionModal({ type: 'reject', order });
                              }}
                              className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-cairo font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>رفض الطلب</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUB-VIEW 2: SETTINGS & RECEPTION ACCOUNTS */}
          {paymentSubTab === 'settings' && (
            <form onSubmit={handleSavePaymentSettings} className="space-y-5 rounded-3xl bg-neutral-900/80 border border-neutral-800 p-6 shadow-xl">
              {/* Notice */}
              <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-800/40 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs font-tajawal">
                  <h4 className="font-cairo font-bold text-amber-300 text-sm">تنبيه حماية بيانات الاستقبال والامتثال</h4>
                  <p className="text-amber-200/80 leading-relaxed">
                    لا تقم بإنشاء بيانات أو أرقام وهمية. أدخل أرقام وعناوين الحسابات المعتمدة التابعة للمالك حصراً بعد التحقق من مطابقتها لنشاط المنصة. سيتم عرض هذه البيانات للأعضاء عند رغبتهم في الشحن للتحويل إليها.
                  </p>
                </div>
              </div>

              {/* Master toggle */}
              <div className="p-4 rounded-2xl bg-black/40 border border-neutral-800 flex items-center justify-between">
                <div>
                  <h4 className="font-cairo font-bold text-sm text-white">تفعيل خدمة التحويل المباشر في المنصة</h4>
                  <p className="text-xs text-neutral-400 font-tajawal">
                    عند التعطيل، لن يتمكن أي مستخدم من إنشاء طلبات تحويل حتى يتم تفعيلها.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!paymentConfig.manual_transfers_enabled}
                    onChange={(e) =>
                      setPaymentConfig({ ...paymentConfig, manual_transfers_enabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Transfer Methods List */}
              <div className="space-y-4">
                <h3 className="font-cairo font-bold text-sm text-white">وسائل التحويل المعتمدة وبيانات الاستقبال:</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(paymentConfig.methods || []).map((method: any, idx: number) => (
                    <div
                      key={method.id || idx}
                      className={`p-4 rounded-2xl border space-y-3 transition-all ${
                        method.enabled ? 'bg-neutral-950/80 border-amber-600/40' : 'bg-neutral-950/40 border-neutral-800 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{method.id === 'instapay' ? '⚡' : '📱'}</span>
                          <span className="font-cairo font-bold text-xs text-white">{method.name}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!method.enabled}
                            onChange={(e) => {
                              const updated = [...paymentConfig.methods];
                              updated[idx].enabled = e.target.checked;
                              setPaymentConfig({ ...paymentConfig, methods: updated });
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>

                      <div className="space-y-2.5 text-xs font-tajawal">
                        <div>
                          <label className="block text-neutral-400 mb-1 text-[11px]">اسم صاحب الحساب / المحفظة</label>
                          <input
                            type="text"
                            placeholder="مثال: الاسم الرسمي للمالك"
                            value={method.account_name || ''}
                            onChange={(e) => {
                              const updated = [...paymentConfig.methods];
                              updated[idx].account_name = e.target.value;
                              setPaymentConfig({ ...paymentConfig, methods: updated });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-neutral-400 mb-1 text-[11px]">
                            {method.id === 'instapay' ? 'عنوان الدفع (IPA) أو رقم الحساب' : 'رقم هاتف المحفظة المحول إليها'}
                          </label>
                          <input
                            type="text"
                            placeholder={method.id === 'instapay' ? 'مثال: username@instapay' : 'مثال: 010xxxxxxxx'}
                            value={method.account_handle || method.account_number || ''}
                            onChange={(e) => {
                              const updated = [...paymentConfig.methods];
                              updated[idx].account_handle = e.target.value;
                              updated[idx].account_number = e.target.value;
                              setPaymentConfig({ ...paymentConfig, methods: updated });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-neutral-400 mb-1 text-[11px]">تعليمات التحويل للعميل</label>
                          <textarea
                            rows={2}
                            value={method.instructions || ''}
                            onChange={(e) => {
                              const updated = [...paymentConfig.methods];
                              updated[idx].instructions = e.target.value;
                              setPaymentConfig({ ...paymentConfig, methods: updated });
                            }}
                            className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* General instructions */}
              <div className="space-y-2 text-xs font-tajawal">
                <label className="block text-neutral-300 font-bold font-cairo text-xs">تعليمات الشحن العامة للعملاء</label>
                <textarea
                  rows={2}
                  value={paymentConfig.general_instructions || ''}
                  onChange={(e) => setPaymentConfig({ ...paymentConfig, general_instructions: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                />
              </div>

              {/* Warning Notice */}
              <div className="space-y-2 text-xs font-tajawal">
                <label className="block text-neutral-300 font-bold font-cairo text-xs">تنبيه عدم الشحن التلقائي (التحقق اليدوي)</label>
                <textarea
                  rows={2}
                  value={paymentConfig.warning_notice || ''}
                  onChange={(e) => setPaymentConfig({ ...paymentConfig, warning_notice: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                />
              </div>

              {/* Submit */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPaymentConfig}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black font-cairo text-xs shadow-md cursor-pointer transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingPaymentConfig ? 'جاري الحفظ...' : 'حفظ إعدادات وسائل التحويل والاستقبال'}</span>
                </button>
              </div>
            </form>
          )}

          {/* APPROVE / REJECT MODAL */}
          {orderActionModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
              <div className="w-full max-w-md rounded-3xl bg-[#0e1017] border border-amber-800/80 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <div className="flex items-center gap-2 font-cairo font-bold text-sm text-white">
                    {orderActionModal.type === 'approve' ? (
                      <>
                        <CheckCheck className="w-5 h-5 text-emerald-400" />
                        <span>تأكيد اعتماد طلب الشحن وإيداع الكوينز</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-rose-400" />
                        <span>رفض طلب الشحن</span>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setOrderActionModal(null)}
                    className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3 text-xs font-tajawal">
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-neutral-800 space-y-1.5">
                    <div className="flex justify-between text-neutral-400">
                      <span>المستخدم:</span>
                      <span className="font-bold text-white">{orderActionModal.order.displayName} (@{orderActionModal.order.username})</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>المبلغ المطلوب:</span>
                      <span className="font-bold text-amber-400">{orderActionModal.order.amount} {orderActionModal.order.currency}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>الكوينز المستحقة للإيداع:</span>
                      <span className="font-bold text-emerald-400">
                        +{(orderActionModal.order.packageCoins + orderActionModal.order.packageBonusCoins).toLocaleString('ar-EG')} كوينز
                      </span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>المحول منه:</span>
                      <span className="font-mono text-white">{orderActionModal.order.senderPhoneOrHandle}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-neutral-300 font-semibold mb-1">
                      {orderActionModal.type === 'approve' ? 'ملاحظة التدقيق (اختياري)' : 'سبب الرفض (سيتم إرساله للمستخدم) *'}
                    </label>
                    <input
                      type="text"
                      required={orderActionModal.type === 'reject'}
                      placeholder={orderActionModal.type === 'approve' ? 'تمت المطابقة البنكية' : 'مثال: لم يتم العثور على التحويل...'}
                      value={orderActionNotes}
                      onChange={(e) => setOrderActionNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setOrderActionModal(null)}
                      className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs cursor-pointer"
                    >
                      إلغاء
                    </button>

                    <button
                      type="button"
                      disabled={orderActionLoading || (orderActionModal.type === 'reject' && !orderActionNotes.trim())}
                      onClick={handleConfirmOrderAction}
                      className={`px-5 py-2 rounded-xl text-xs font-black font-cairo shadow-md cursor-pointer transition-all disabled:opacity-50 ${
                        orderActionModal.type === 'approve'
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-rose-600 hover:bg-rose-500 text-white'
                      }`}
                    >
                      {orderActionLoading
                        ? 'جاري التنفيذ...'
                        : orderActionModal.type === 'approve'
                        ? 'تأكيد الإيداع الآن'
                        : 'تأكيد الرفض'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AD CREATE / EDIT MODAL */}
      {adModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" dir="rtl">
          <div className="w-full max-w-lg rounded-3xl bg-[#0e1017] border border-amber-800/80 p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-cairo font-bold text-base text-white">
                <Megaphone className="w-5 h-5 text-amber-400" />
                <span>{editingAd ? 'تعديل الإعلان' : 'إضافة إعلان جديد للقصص'}</span>
              </div>
              <button
                onClick={() => setAdModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAd} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">عنوان الإعلان *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: خصم 20% على شارات التميز..."
                  value={adFormTitle}
                  onChange={(e) => setAdFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">الوصف (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="وصف مختصر وجذاب للإعلان..."
                  value={adFormDesc}
                  onChange={(e) => setAdFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">صورة الإعلان *</label>
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="رابط مباشر للصورة (https://...)"
                    value={adFormImage}
                    onChange={(e) => setAdFormImage(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500">أو ارفع ملف صورة:</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async () => {
                          try {
                            const uploaded = await uploadMedia(reader.result as string, file.name);
                            setAdFormImage(uploaded);
                          } catch {
                            alert('فشل رفع الصورة');
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="text-xs text-neutral-400 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-neutral-300 file:text-xs cursor-pointer"
                    />
                  </div>
                  {adFormImage && (
                    <div className="w-full h-28 rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900">
                      <img src={adFormImage} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">رابط الإعلان (اختياري)</label>
                <input
                  type="url"
                  placeholder="https://example.com/offer"
                  value={adFormLink}
                  onChange={(e) => setAdFormLink(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">
                    معدل الظهور (كل كم قصة؟)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={adFormInterval}
                    onChange={(e) => setAdFormInterval(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-bold"
                  />
                  <span className="text-[10px] text-neutral-500">الافتراضي: كل 3 قصص</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">
                    الأولوية (1-10)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={adFormPriority}
                    onChange={(e) => setAdFormPriority(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-bold"
                  />
                  <span className="text-[10px] text-neutral-500">الرقم الأكبر يظهر أولاً</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-900 border border-neutral-800">
                <input
                  type="checkbox"
                  id="adActiveCheck"
                  checked={adFormActive}
                  onChange={(e) => setAdFormActive(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="adActiveCheck" className="text-xs text-neutral-200 font-tajawal cursor-pointer select-none">
                  تفعيل الإعلان فوراً للظهور في القصص
                </label>
              </div>

              <button
                type="submit"
                disabled={savingAd}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs font-cairo shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                {savingAd ? 'جاري الحفظ...' : editingAd ? 'حفظ التعديلات' : 'إنشاء الإعلان'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: OWNER WALLET COINS ADJUSTMENT */}
      {walletTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0e1017] border border-amber-800/80 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-cairo font-bold text-base text-white">
                <Coins className="w-5 h-5 text-amber-400" />
                <span>تعديل محفظة: {walletTargetUser.username}</span>
              </div>
              <button
                onClick={() => setWalletTargetUser(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
              <span className="text-xs text-neutral-400">الرصيد الحالي للحساب:</span>
              <span className="text-base font-black font-cairo text-amber-400">{walletTargetUser.coins || 0} كوينز</span>
            </div>

            <form onSubmit={handleUpdateCoins} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">نوع العملية</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCoinsOperation('add')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      coinsOperation === 'add'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    + إضافة كوينز
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinsOperation('subtract')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      coinsOperation === 'subtract'
                        ? 'bg-rose-600 text-white'
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    - خصم كوينز
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinsOperation('set')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      coinsOperation === 'set'
                        ? 'bg-amber-600 text-neutral-950 font-black'
                        : 'bg-neutral-900 text-neutral-400 border border-neutral-800'
                    }`}
                  >
                    = تعيين رصيد
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                  {coinsOperation === 'set' ? 'الرصيد الجديد المطلوب:' : 'قيمة الكوينز:'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={coinsAmount}
                  onChange={(e) => setCoinsAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white font-cairo font-bold text-sm focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">سبب المعاملة / الملاحظة (تظهر للمستخدم وفي السجل)</label>
                <input
                  type="text"
                  value={coinsReason}
                  onChange={(e) => setCoinsReason(e.target.value)}
                  placeholder="مثال: مكافأة تميز، تعويض، شحن رسمي..."
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setWalletTargetUser(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-600/20 cursor-pointer"
                >
                  تأكيد وحفظ المعاملة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: OWNER EDIT VIP PLAN */}
      {editingVipPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-[#0e1017] border border-amber-800/80 p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-cairo font-bold text-base text-white">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>تعديل باقة VIP: {editingVipPlan.name}</span>
              </div>
              <button
                onClick={() => setEditingVipPlan(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVipPlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">اسم الباقة</label>
                  <input
                    type="text"
                    value={editingVipPlan.name || ''}
                    onChange={(e) => setEditingVipPlan({ ...editingVipPlan, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">الأيقونة (Emoji)</label>
                  <input
                    type="text"
                    value={editingVipPlan.icon || ''}
                    onChange={(e) => setEditingVipPlan({ ...editingVipPlan, icon: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">سعر الباقة (كوينز)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingVipPlan.priceCoins ?? 0}
                    onChange={(e) => setEditingVipPlan({ ...editingVipPlan, priceCoins: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold font-cairo"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">مدة الصلاحية (أيام)</label>
                  <input
                    type="number"
                    min={1}
                    value={editingVipPlan.days ?? 30}
                    onChange={(e) => setEditingVipPlan({ ...editingVipPlan, days: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">اسم الشارة الظاهرة</label>
                <input
                  type="text"
                  value={editingVipPlan.badge || ''}
                  onChange={(e) => setEditingVipPlan({ ...editingVipPlan, badge: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">
                  مميزات الباقة (اكتب كل ميزة في سطر منفصل)
                </label>
                <textarea
                  rows={4}
                  value={editingVipPlan.perksText || ''}
                  onChange={(e) => setEditingVipPlan({ ...editingVipPlan, perksText: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white leading-relaxed"
                  placeholder="شارة VIP برونزية مميزة&#10;أولوية ظهور في المتواجدين&#10;مضاعفة نقاط الخبرة"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingVipPlan.isActive ?? true}
                    onChange={(e) => setEditingVipPlan({ ...editingVipPlan, isActive: e.target.checked })}
                    className="rounded accent-emerald-500"
                  />
                  <span>مفعلة ومتاحة للشراء في المتجر</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingVipPlan.popular ?? false}
                    onChange={(e) => setEditingVipPlan({ ...editingVipPlan, popular: e.target.checked })}
                    className="rounded accent-amber-500"
                  />
                  <span>تمييز كباقة مميزة شائعة (Popular)</span>
                </label>
              </div>

              <div className="flex gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingVipPlan(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-600/20 cursor-pointer"
                >
                  حفظ تعديلات الباقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: OWNER DIRECT VIP GRANT TO USER */}
      {vipTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0e1017] border border-purple-800/80 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-cairo font-bold text-base text-white">
                <Crown className="w-5 h-5 text-purple-400" />
                <span>منح VIP للمستخدم: {vipTargetUser.username}</span>
              </div>
              <button
                onClick={() => setVipTargetUser(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGrantVip} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">فئة VIP المراد منحها</label>
                <select
                  value={vipGrantLevel}
                  onChange={(e) => setVipGrantLevel(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                >
                  <option value="none">إلغاء عضوية VIP (None)</option>
                  <option value="bronze">🥉 VIP البرونزي</option>
                  <option value="silver">🥈 VIP الفضي</option>
                  <option value="gold">🥇 VIP الذهبي الملكي</option>
                  <option value="royal">💎 VIP الملكي الألماسي</option>
                </select>
              </div>

              {vipGrantLevel !== 'none' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">المدة بالأيام</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={vipGrantDays}
                    onChange={(e) => setVipGrantDays(parseInt(e.target.value, 10) || 30)}
                    className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold"
                  />
                  <p className="text-[11px] text-neutral-500 mt-1 font-tajawal">
                    سيتم تفعيل مميزات الباقة فوراً لحساب العضو وإرسال إشعار رسمي له بدون خصم أي كوينز منه.
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVipTargetUser(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 cursor-pointer"
                >
                  تأكيد منح الرتبة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: OWNER LEVEL & XP ADJUSTMENT */}
      {levelTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0e1017] border border-emerald-800/80 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-cairo font-bold text-base text-white">
                <Award className="w-5 h-5 text-emerald-400" />
                <span>تعديل مستوى وخبرة: {levelTargetUser.username}</span>
              </div>
              <button
                onClick={() => setLevelTargetUser(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateGamification} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">المستوى (Level)</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold font-cairo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">نقاط الخبرة (XP)</label>
                <input
                  type="number"
                  min={0}
                  value={targetXp}
                  onChange={(e) => setTargetXp(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold font-cairo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">الشعلة اليومية (Streak Days)</label>
                <input
                  type="number"
                  min={0}
                  value={targetStreak}
                  onChange={(e) => setTargetStreak(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold font-cairo"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLevelTargetUser(null)}
                  className="w-1/3 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  تأكيد التعديل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: OWNER CREATE NEW VIP PLAN */}
      {newPlanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0e1017] border border-amber-800/80 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-cairo font-bold text-base text-white">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>إنشاء باقة VIP جديدة</span>
              </div>
              <button
                onClick={() => setNewPlanModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateVipPlan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">معرف الباقة البرمجي (ID بالإنجليزية)</label>
                <input
                  name="id"
                  type="text"
                  placeholder="مثال: diamond_vip"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">اسم الباقة الظاهر</label>
                <input
                  name="name"
                  type="text"
                  placeholder="مثال: VIP الماسي الخارق"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">سعر الكوينز</label>
                  <input
                    name="priceCoins"
                    type="number"
                    min={0}
                    defaultValue={1500}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">مدة الصلاحية (أيام)</label>
                  <input
                    name="days"
                    type="number"
                    min={1}
                    defaultValue={30}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">الأيقونة (Emoji)</label>
                  <input
                    name="icon"
                    type="text"
                    defaultValue="💎"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">اسم الشارة</label>
                  <input
                    name="badge"
                    type="text"
                    defaultValue="ماسي"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">المميزات (ميزة في كل سطر)</label>
                <textarea
                  name="perks"
                  rows={3}
                  placeholder="شارة خاصة نادرة&#10;أولوية في الظهور&#10;دخول الغرف المقفلة"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewPlanModalOpen(false)}
                  className="w-1/3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs shadow-md cursor-pointer"
                >
                  إنشاء الباقة وتفعيلها
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: OWNER CREATE / EDIT COIN PACKAGE */}
      {(newPackageModalOpen || editingCoinPackage) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0e1017] border border-amber-800/80 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2 font-cairo font-bold text-base text-white">
                <Coins className="w-5 h-5 text-amber-400" />
                <span>{editingCoinPackage ? 'تعديل باقة شحن الكوينز' : 'إضافة باقة شحن كوينز جديدة'}</span>
              </div>
              <button
                onClick={() => {
                  setNewPackageModalOpen(false);
                  setEditingCoinPackage(null);
                }}
                className="p-1 rounded-lg text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoinPackage} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">معرف الباقة البرمجي (ID)</label>
                <input
                  name="id"
                  type="text"
                  defaultValue={editingCoinPackage?.id || `pkg_${Date.now()}`}
                  disabled={!!editingCoinPackage}
                  placeholder="مثال: pkg_starter"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">اسم الباقة الظاهر</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={editingCoinPackage?.name || ''}
                  placeholder="مثال: باقة النخبة (Elite Plus)"
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">عدد الكوينز الأساسي</label>
                  <input
                    name="coins"
                    type="number"
                    min={1}
                    defaultValue={editingCoinPackage?.coins || 500}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">بونص مجاني إضافي</label>
                  <input
                    name="bonusCoins"
                    type="number"
                    min={0}
                    defaultValue={editingCoinPackage?.bonusCoins || 0}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">السعر التقديري</label>
                  <input
                    name="priceAmount"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={editingCoinPackage?.priceAmount || 25}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">العملة</label>
                  <input
                    name="currency"
                    type="text"
                    defaultValue={editingCoinPackage?.currency || 'SAR'}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">الأيقونة (Emoji)</label>
                  <input
                    name="icon"
                    type="text"
                    defaultValue={editingCoinPackage?.icon || '🪙'}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">شارة ترويجية (Badge)</label>
                  <input
                    name="badge"
                    type="text"
                    defaultValue={editingCoinPackage?.badge || ''}
                    placeholder="مثال: الأكثر طلباً 🔥"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">ترتيب العرض</label>
                  <input
                    name="displayOrder"
                    type="number"
                    defaultValue={editingCoinPackage?.displayOrder || 1}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white"
                  />
                </div>
                <div className="flex items-center gap-4 pt-5">
                  <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer">
                    <input
                      name="popular"
                      type="checkbox"
                      defaultChecked={editingCoinPackage?.popular}
                      className="rounded bg-neutral-900 text-amber-500"
                    />
                    <span>مميزة</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer">
                    <input
                      name="isActive"
                      type="checkbox"
                      defaultChecked={editingCoinPackage ? editingCoinPackage.isActive : true}
                      className="rounded bg-neutral-900 text-amber-500"
                    />
                    <span>نشطة</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setNewPackageModalOpen(false);
                    setEditingCoinPackage(null);
                  }}
                  className="w-1/3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-black text-xs shadow-md cursor-pointer"
                >
                  {editingCoinPackage ? 'حفظ التعديلات' : 'إضافة الباقة وتفعيلها'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
