import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
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
  Target
} from 'lucide-react';
import { EventsPage } from './EventsPage';
import { NewsPage } from './NewsPage';
import { MissionsPage } from './MissionsPage';

export const AdminPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'wallet' | 'vip' | 'events' | 'news' | 'missions' | 'reports' | 'settings'>('overview');
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

  useEffect(() => {
    if (activeTab === 'overview') fetchOverview();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'wallet') {
      fetchEconomyStats();
      fetchUsers();
    }
    if (activeTab === 'vip') {
      fetchVipPlans();
      fetchUsers();
    }
    if (activeTab === 'reports') fetchReports();
  }, [activeTab]);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-3xl bg-[#0e1017] border border-amber-900/40 relative overflow-hidden">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-tajawal mb-2">
                <span>إجمالي الكوينز المتداولة بالمنصة</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-3xl font-black font-cairo text-amber-400">
                {economyStats?.totalCoins || 0}
              </div>
              <p className="text-[11px] text-neutral-500 mt-1 font-tajawal">مجموع أرصدة كافة حسابات الأعضاء في قاعدة البيانات</p>
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

            <div className="p-5 rounded-3xl bg-[#0e1017] border border-emerald-900/40">
              <div className="flex items-center justify-between text-xs text-neutral-400 font-tajawal mb-2">
                <span>إجراء سريع للمالك</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xs text-neutral-300 font-tajawal mb-3">
                اضغط على أي مستخدم بالجدول لتعديل محفظته مباشرة أو إضافة كوينز كهدية.
              </p>
              <button
                onClick={() => {
                  if (usersList.length > 0) {
                    setWalletTargetUser(usersList[0]);
                  }
                }}
                className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-neutral-950 font-bold text-xs cursor-pointer shadow-md"
              >
                فتح نافذة تعديل رصيد مستخدم
              </button>
            </div>
          </div>

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
    </div>
  );
};
