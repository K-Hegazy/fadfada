import React, { useEffect, useState } from 'react';
import {
  Award,
  Ban,
  Check,
  Coins,
  Image,
  Megaphone,
  MessagesSquare,
  Plus,
  Save,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  deleteRoomAsOwner,
  subscribeToCreatorProposals,
  subscribeToRooms,
} from '../services/community';
import {
  adminReviewProposal,
  adminSaveDailyTask,
  adminSaveStoreItem,
  adminUpdateUser,
  postShoutout,
  reviewAppeal,
  reviewReport,
  reviewTopupRequest,
  replySupportTicket,
  subscribeToAppeals,
  subscribeToDailyTasks,
  subscribeToReports,
  subscribeToSupportTickets,
  subscribeToTopups,
  updateSiteSettings,
} from '../services/economy';
import { uploadImageAsset } from '../services/storage';
import { useApp } from '../state/AppContext';
import type {
  AppealItem,
  CreatorProposal,
  DailyTask,
  ReportItem,
  Room,
  SiteSettings,
  StoreItem,
  StoreSection,
  SupportTicket,
  TopupRequest,
  UserRole,
  VipTier,
} from '../types/fadfada';
import { DEFAULT_DAILY_TASKS } from '../utils/progression';
import { Avatar } from './Avatar';
import { FeedbackBanner, PageHeader, SegmentedTabs } from './ui/Primitives';

type AdminTab = 'users' | 'rooms' | 'store' | 'creators' | 'requests' | 'settings';

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'مالك',
  moderator: 'مشرف',
  member: 'عضو',
  guest: 'ضيف مؤقت',
};

export const AdminPanelView: React.FC = () => {
  const { profile, users, storeItems, siteSettings, isStaff, isOwner, isPeerOnline } = useApp();
  const [tab, setTab] = useState<AdminTab>('users');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Users tab state
  const [userSearch, setUserSearch] = useState('');
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('member');
  const [editCoins, setEditCoins] = useState(0);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPermissions, setEditPermissions] = useState('');
  const [editBanReason, setEditBanReason] = useState('');
  const [editVip, setEditVip] = useState<VipTier>('none');
  const [badgeName, setBadgeName] = useState('');
  const [badgeColor, setBadgeColor] = useState('#0D7A5F');
  const [badgeDays, setBadgeDays] = useState(30);

  // Store & Tasks tab state
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>(DEFAULT_DAILY_TASKS);
  const [newItemSection, setNewItemSection] = useState<StoreSection>('badge');
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState(100);
  const [newItemDays, setNewItemDays] = useState(30);
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemColor, setNewItemColor] = useState('#0D7A5F');
  const [newItemImage, setNewItemImage] = useState('');
  const [storePriceDrafts, setStorePriceDrafts] = useState<Record<string, number>>({});
  const [taskRewardDrafts, setTaskRewardDrafts] = useState<Record<string, { coins: number; xp: number }>>({});
  const [newTaskKey, setNewTaskKey] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskCoins, setNewTaskCoins] = useState(30);
  const [newTaskXp, setNewTaskXp] = useState(25);

  // Requests & Moderation collections
  const [rooms, setRooms] = useState<Room[]>([]);
  const [confirmDeleteRoom, setConfirmDeleteRoom] = useState<Room | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<CreatorProposal[]>([]);
  const [topups, setTopups] = useState<TopupRequest[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [proposalDays, setProposalDays] = useState<Record<string, number>>({});

  // Site settings & megaphone draft
  const [settingsDraft, setSettingsDraft] = useState<Omit<SiteSettings, 'updatedAt'>>(siteSettings);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [adminShoutText, setAdminShoutText] = useState('');
  const [adminShoutUrgent, setAdminShoutUrgent] = useState(false);

  useEffect(() => {
    setSettingsDraft(siteSettings);
  }, [siteSettings]);

  useEffect(() => {
    if (!profile || !isStaff) return;
    const u1 = subscribeToDailyTasks(setDailyTasks);
    const u2 = subscribeToCreatorProposals(setProposals);
    const u3 = subscribeToTopups(profile.uid, true, setTopups);
    const u4 = subscribeToSupportTickets(profile.uid, true, setTickets);
    const u5 = subscribeToReports(profile.uid, true, setReports);
    const u6 = subscribeToAppeals(profile.uid, true, setAppeals);
    const u7 = subscribeToRooms(setRooms);
    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, [profile?.uid, isStaff]);

  if (!profile || !isStaff) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-sm text-rose-600">
        هذه اللوحة مخصصة للمالك والمشرفين فقط.
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      u.displayName.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      u.uid.toLowerCase().includes(term)
    );
  });

  const openUserEditor = (u: (typeof users)[number]) => {
    setEditingUid(u.uid);
    setEditRole(u.role);
    setEditCoins(u.coins);
    setEditDisplayName(u.displayName);
    setEditUsername(u.username);
    setEditPermissions((u.permissions ?? []).join(', '));
    setEditBanReason(u.banReason ?? '');
    setEditVip(u.vipTier);
  };

  const handleSaveUser = async (target: (typeof users)[number]) => {
    setError(null);
    setFeedback(null);
    try {
      if (!isOwner) {
        if (target.role === 'owner') {
          setError('لا يملك المشرف صلاحية تعديل حساب المالك.');
          return;
        }
        await adminUpdateUser(target.uid, {
          displayName: editDisplayName.trim() || target.displayName,
        });
        setEditingUid(null);
        setFeedback(`تم تحديث الاسم الظاهر للعضو ${target.displayName}.`);
        return;
      }

      const perms = editPermissions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const cleanUsername = editUsername
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.]/g, '');
      await adminUpdateUser(target.uid, {
        role: editRole,
        coins: Math.max(0, Math.floor(editCoins)),
        displayName: editDisplayName.trim() || target.displayName,
        username: cleanUsername.length >= 3 ? cleanUsername.slice(0, 30) : target.username,
        permissions: perms,
        vipTier: editVip,
      });
      setEditingUid(null);
      setFeedback(`تم تحديث بيانات ${target.displayName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث بيانات العضو.');
    }
  };

  const handleGrantBadge = async (target: (typeof users)[number]) => {
    if (!badgeName.trim()) return;
    setError(null);
    setFeedback(null);
    if (!isOwner && target.role === 'owner') {
      setError('لا يملك المشرف صلاحية تعديل حساب المالك.');
      return;
    }
    const nextBadge = {
      id: `custom_${Date.now()}`,
      name: badgeName.trim(),
      color: badgeColor,
      expiresAt: badgeDays > 0 ? Date.now() + badgeDays * 24 * 60 * 60 * 1000 : null,
    };
    try {
      await adminUpdateUser(target.uid, {
        badges: [...target.badges, nextBadge],
      });
      setBadgeName('');
      setFeedback(`تم منح شارة "${nextBadge.name}" إلى ${target.displayName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر منح الشارة.');
    }
  };

  const handleToggleBan = async (target: (typeof users)[number]) => {
    setError(null);
    setFeedback(null);
    if (!isOwner && target.role === 'owner') {
      setError('لا يملك المشرف صلاحية حظر المالك.');
      return;
    }
    const nextBanned = !target.isBanned;
    try {
      await adminUpdateUser(target.uid, {
        isBanned: nextBanned,
        banReason: nextBanned ? editBanReason.trim() || 'مخالفة قوانين المنصة' : '',
      });
      setFeedback(nextBanned ? `تم حظر ${target.displayName}.` : `تم فك الحظر عن ${target.displayName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث حالة الحظر.');
    }
  };

  const handleUploadStoreAsset = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const folder = newItemSection === 'badge' ? 'badges' : newItemSection === 'gift' ? 'gifts' : 'store';
      const url = await uploadImageAsset(folder, profile.uid, file);
      setNewItemImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    }
  };

  const handleAddStoreItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemCode.trim()) return;
    setError(null);
    setFeedback(null);
    const item: StoreItem = {
      id: `item_${Date.now()}`,
      section: newItemSection,
      name: newItemName.trim(),
      description: newItemDesc.trim(),
      priceCoins: Math.max(1, Math.floor(newItemPrice)),
      durationDays: Math.max(0, Math.floor(newItemDays)),
      code: newItemCode.trim(),
      color: newItemColor,
      imageUrl: newItemImage,
      isActive: true,
    };
    try {
      await adminSaveStoreItem(item);
      setNewItemName('');
      setNewItemDesc('');
      setNewItemCode('');
      setNewItemImage('');
      setFeedback(`تم إضافة "${item.name}" للمتجر.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ عنصر المتجر.');
    }
  };

  const handleAddDailyTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !newTaskTitle.trim() || !newTaskKey.trim()) return;
    const cleanKey = newTaskKey.trim().replace(/[^a-zA-Z0-9_-]/g, '');
    if (!cleanKey) return;
    setError(null);
    setFeedback(null);
    const task: DailyTask = {
      id: `task_${cleanKey}`,
      key: cleanKey,
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || newTaskTitle.trim(),
      rewardCoins: Math.min(250, Math.max(0, Math.floor(newTaskCoins))),
      rewardXp: Math.min(300, Math.max(0, Math.floor(newTaskXp))),
      isActive: true,
    };
    try {
      await adminSaveDailyTask(task);
      setNewTaskKey('');
      setNewTaskTitle('');
      setNewTaskDesc('');
      setFeedback(`تم إضافة المهمة اليومية "${task.title}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ المهمة اليومية.');
    }
  };

  const handleUploadSiteLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isOwner) return;
    setError(null);
    setUploadingLogo(true);
    try {
      const url = await uploadImageAsset('store', profile.uid, file);
      setSettingsDraft((s) => ({ ...s, siteLogoUrl: url }));
      setFeedback('تم رفع شعار الموقع. اضغط "حفظ كافة الإعدادات" لتثبيته في الهيدر.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع شعار الموقع.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    setError(null);
    setFeedback(null);
    try {
      await updateSiteSettings(settingsDraft);
      setFeedback('تم حفظ إعدادات الموقع والإعلانات وبوابات الدفع بنجاح.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.');
    }
  };

  const handleAdminShout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminShoutText.trim()) return;
    setError(null);
    setFeedback(null);
    try {
      await postShoutout(profile, adminShoutText, adminShoutUrgent ? 'urgent' : 'admin', 0);
      setAdminShoutText('');
      setFeedback('تم بث الإعلان في الشريط العلوي بنجاح.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر بث الإعلان.');
    }
  };

  const permanentMembersCount = users.filter((u) => u.role !== 'guest' && !u.isAnonymous).length;
  const activeGuestsCount = users.filter((u) => u.role === 'guest' || u.isAnonymous).length;
  const liveOnlineCount = users.filter((u) => isPeerOnline(u, true)).length;

  const handleConfirmDeleteRoom = async () => {
    if (!confirmDeleteRoom || !isOwner || deletingRoomId) return;
    setError(null);
    setFeedback(null);
    const target = confirmDeleteRoom;
    setDeletingRoomId(target.id);
    try {
      await deleteRoomAsOwner(target.id);
      setConfirmDeleteRoom(null);
      setFeedback(`تم حذف الجروب "${target.name}" وجميع رسائله بنجاح.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حذف الجروب.');
    } finally {
      setDeletingRoomId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-4 sm:p-6 pb-24 md:pb-8">
      <div className="max-w-5xl mx-auto space-y-5">
        <PageHeader
          title="لوحة تحكم الإدارة"
          subtitle="إدارة الأعضاء والصلاحيات، الجروبات، المتجر والمهام، طلبات الشحن، الدعم، المبدعين، وإعدادات المنصة"
          icon={<Shield className="w-5 h-5" />}
        />

        <SegmentedTabs<AdminTab>
          value={tab}
          onChange={(next) => {
            setTab(next);
            setFeedback(null);
            setError(null);
          }}
          items={[
            { id: 'users', label: 'الأعضاء', icon: Users, count: users.length },
            { id: 'rooms', label: 'الجروبات', icon: MessagesSquare, count: rooms.length },
            { id: 'store', label: 'المتجر والمهام', icon: ShoppingBag },
            {
              id: 'creators',
              label: 'المبدعون',
              icon: Sparkles,
              count: proposals.filter((p) => p.status === 'pending').length,
            },
            { id: 'requests', label: 'الشحن والدعم والبلاغات', icon: Coins },
            { id: 'settings', label: 'الإعدادات والإعلانات', icon: Settings },
          ]}
        />

        {feedback && <FeedbackBanner type="success" message={feedback} />}
        {error && <FeedbackBanner type="error" message={error} />}

        {/* TAB 1: Users Management */}
        {tab === 'users' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10">
                <p className="text-stone-500">الأعضاء الدائمون</p>
                <p className="text-base font-mono font-bold mt-0.5">{permanentMembersCount}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10">
                <p className="text-stone-500">الضيوف النشطون</p>
                <p className="text-base font-mono font-bold mt-0.5">{activeGuestsCount}</p>
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10">
                <p className="text-stone-500">المتصلون الآن</p>
                <p className="text-base font-mono font-bold text-[#0D7A5F] dark:text-[#6EE7B7] mt-0.5">
                  {liveOnlineCount}
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="ابحث بالاسم أو اسم المستخدم أو UID..."
                className="w-full min-h-[44px] pr-10 pl-3 rounded-2xl border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17] text-sm"
              />
            </div>

            <div className="space-y-2.5">
              {filteredUsers.map((u) => {
                const isEditing = editingUid === u.uid;
                const roleLabel = ROLE_LABELS[u.role] ?? u.role;
                const onlineNow = isPeerOnline(u, true);
                return (
                  <div
                    key={u.uid}
                    className="p-4 rounded-2xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={u.avatar} name={u.displayName} size="sm" isOnline={onlineNow} showPresence />
                        <div>
                          <p className="text-sm font-bold flex items-center gap-2">
                            <span>{u.displayName}</span>
                            <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                              · {roleLabel}
                            </span>
                            {u.isBanned && (
                              <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                · محظور
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] font-mono text-stone-500 dark:text-stone-400">
                            @{u.username} · {u.role} · {u.coins} عملة · Lv.{u.level}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => (isEditing ? setEditingUid(null) : openUserEditor(u))}
                        className="min-h-[36px] px-3.5 rounded-xl border border-stone-200/80 dark:border-white/10 hover:bg-stone-50 dark:hover:bg-[#18231F] text-xs font-semibold cursor-pointer"
                      >
                        {isEditing ? 'إغلاق' : 'إدارة العضو'}
                      </button>
                    </div>

                    {isEditing && !isOwner && u.role === 'owner' ? (
                      <div className="pt-3 border-t border-stone-100 dark:border-white/5 text-xs text-amber-700 dark:text-amber-300">
                        حساب المالك محمي ولا يمكن تعديله من حساب مشرف.
                      </div>
                    ) : isEditing && (
                      <div className="pt-3 border-t border-stone-100 dark:border-white/5 space-y-3 text-xs">
                        {!isOwner && (
                          <p className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
                            وضع المشرف: يمكنك تعديل الاسم الظاهر والحظر ومنح الشارات فقط. تعديل الأدوار والعملات وVIP متاح للمالك فقط.
                          </p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                          <div>
                            <label className="block text-stone-500 mb-1">الاسم الظاهر</label>
                            <input
                              type="text"
                              value={editDisplayName}
                              onChange={(e) => setEditDisplayName(e.target.value)}
                              className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                            />
                          </div>
                          <div>
                            <label className="block text-stone-500 mb-1">اسم المستخدم</label>
                            <input
                              type="text"
                              dir="ltr"
                              disabled={!isOwner}
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <label className="block text-stone-500 mb-1">الدور</label>
                            <select
                              disabled={!isOwner}
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as UserRole)}
                              className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] disabled:opacity-50"
                            >
                              <option value="guest">guest</option>
                              <option value="member">member</option>
                              <option value="moderator">moderator</option>
                              <option value="owner">owner</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-stone-500 mb-1">العملات</label>
                            <input
                              type="number"
                              disabled={!isOwner}
                              value={editCoins}
                              onChange={(e) => setEditCoins(Number(e.target.value))}
                              className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono disabled:opacity-50"
                            />
                          </div>
                          <div>
                            <label className="block text-stone-500 mb-1">باقة VIP</label>
                            <select
                              disabled={!isOwner}
                              value={editVip}
                              onChange={(e) => setEditVip(e.target.value as VipTier)}
                              className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] disabled:opacity-50"
                            >
                              <option value="none">عادي</option>
                              <option value="silver">فضي</option>
                              <option value="gold">ذهبي</option>
                              <option value="royal">ملكي</option>
                            </select>
                          </div>
                        </div>

                        {isOwner && (
                          <div>
                            <label className="block text-stone-500 mb-1">الصلاحيات الإضافية (مفصولة بفاصلة)</label>
                            <input
                              type="text"
                              value={editPermissions}
                              onChange={(e) => setEditPermissions(e.target.value)}
                              placeholder="moderate_rooms, manage_reports, shoutout_free"
                              className="w-full min-h-[38px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                            />
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleSaveUser(u)}
                            className="min-h-[38px] px-4 rounded-xl bg-[#0D7A5F] hover:bg-[#095E49] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>حفظ التغييرات</span>
                          </button>

                          <input
                            type="text"
                            value={editBanReason}
                            onChange={(e) => setEditBanReason(e.target.value)}
                            placeholder="سبب الحظر..."
                            className="min-h-[38px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                          />
                          <button
                            type="button"
                            onClick={() => void handleToggleBan(u)}
                            className="min-h-[38px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>{u.isBanned ? 'فك الحظر' : 'حظر العضو'}</span>
                          </button>
                        </div>

                        {/* Grant Badge */}
                        <div className="pt-2 border-t border-stone-100 dark:border-white/5 flex flex-wrap items-center gap-2">
                          <Award className="w-4 h-4 text-[#0D7A5F] dark:text-[#6EE7B7]" />
                          <input
                            type="text"
                            value={badgeName}
                            onChange={(e) => setBadgeName(e.target.value)}
                            placeholder="اسم شارة جديدة..."
                            className="min-h-[38px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                          />
                          <input
                            type="color"
                            value={badgeColor}
                            onChange={(e) => setBadgeColor(e.target.value)}
                            className="h-9 w-10 rounded-lg cursor-pointer"
                          />
                          <input
                            type="number"
                            min={0}
                            value={badgeDays}
                            onChange={(e) => setBadgeDays(Number(e.target.value))}
                            className="w-20 min-h-[38px] px-2 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                            title="المدة بالأيام (0 = دائم)"
                          />
                          <button
                            type="button"
                            onClick={() => void handleGrantBadge(u)}
                            className="min-h-[38px] px-3.5 rounded-xl border border-[#0D7A5F] text-[#0D7A5F] dark:text-[#6EE7B7] font-semibold cursor-pointer"
                          >
                            منح شارة
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 1B: Rooms / Groups Management (Owner-only delete) */}
        {tab === 'rooms' && (
          <div className="space-y-3 text-xs">
            {!isOwner && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                عرض الجروبات متاح للمشرفين، بينما حذف الجروب متاح للمالك فقط.
              </div>
            )}
            {rooms.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 text-center text-stone-500">
                لا توجد جروبات حالياً.
              </div>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.id}
                  className="p-4 rounded-2xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm font-bold flex items-center gap-2">
                      <span className="truncate">{room.name}</span>
                      {room.isOfficial && (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          · رسمي
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      {room.category} · بواسطة {room.ownerName || 'غير محدد'} · {room.activeCount} متصل
                    </p>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteRoom(room)}
                      className="min-h-[36px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الجروب</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: Store & Tasks CRUD */}
        {tab === 'store' && (
          <div className="space-y-5">
            {!isOwner ? (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
                إضافة وتعديل أسعار المتجر والمهام اليومية محصورة بالمالك فقط.
              </div>
            ) : (
              <>
                <form
                  onSubmit={handleAddStoreItem}
                  className="p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3 text-xs"
                >
                  <h2 className="font-display text-base font-bold">إضافة عنصر للمتجر</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={newItemSection}
                      onChange={(e) => setNewItemSection(e.target.value as StoreSection)}
                      className="min-h-[40px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                    >
                      <option value="vip">VIP</option>
                      <option value="feature">ميزة</option>
                      <option value="frame">إطار</option>
                      <option value="badge">شارة</option>
                      <option value="gift">هدية</option>
                    </select>
                    <input
                      type="text"
                      required
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      placeholder="اسم العنصر..."
                      className="min-h-[40px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                    />
                    <input
                      type="text"
                      required
                      value={newItemCode}
                      onChange={(e) => setNewItemCode(e.target.value)}
                      placeholder="الكود البرمجي (مثل badge_pro)"
                      className="min-h-[40px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-center">
                    <input
                      type="number"
                      min={1}
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(Number(e.target.value))}
                      placeholder="السعر"
                      className="min-h-[40px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      value={newItemDays}
                      onChange={(e) => setNewItemDays(Number(e.target.value))}
                      placeholder="الأيام"
                      className="min-h-[40px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                    />
                    <input
                      type="color"
                      value={newItemColor}
                      onChange={(e) => setNewItemColor(e.target.value)}
                      className="h-10 w-full rounded-xl cursor-pointer"
                    />
                    <label className="min-h-[40px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 flex items-center justify-center cursor-pointer">
                      <span>{newItemImage ? 'تم رفع الصورة' : 'رفع صورة'}</span>
                      <input type="file" accept="image/*" onChange={handleUploadStoreAsset} className="hidden" />
                    </label>
                  </div>

                  <input
                    type="text"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    placeholder="وصف العنصر..."
                    className="w-full min-h-[40px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-5 rounded-xl bg-[#0D7A5F] hover:bg-[#095E49] text-white font-semibold cursor-pointer"
                  >
                    حفظ في المتجر
                  </button>
                </form>

                <div className="p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3 text-xs">
                  <h2 className="font-display text-base font-bold">عناصر المتجر الحالية</h2>
                  <div className="divide-y divide-stone-100 dark:divide-white/5">
                    {storeItems.map((item) => {
                      const draftPrice = storePriceDrafts[item.id] ?? item.priceCoins;
                      return (
                        <div key={item.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-bold">{item.name}</span>{' '}
                            <span className="text-stone-400">({item.section})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              value={draftPrice}
                              onChange={(e) =>
                                setStorePriceDrafts((d) => ({ ...d, [item.id]: Number(e.target.value) }))
                              }
                              className="w-24 min-h-[34px] px-2 rounded-lg border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                setError(null);
                                try {
                                  await adminSaveStoreItem({
                                    ...item,
                                    priceCoins: Math.max(1, Math.floor(draftPrice)),
                                  });
                                  setFeedback(`تم تحديث سعر "${item.name}".`);
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : 'تعذر تحديث السعر.');
                                }
                              }}
                              className="min-h-[34px] px-3 rounded-lg bg-[#0D7A5F] text-white font-semibold cursor-pointer"
                            >
                              حفظ السعر
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setError(null);
                                try {
                                  await adminSaveStoreItem({ ...item, isActive: !item.isActive });
                                  setFeedback(`تم تحديث حالة "${item.name}".`);
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : 'تعذر تحديث حالة العنصر.');
                                }
                              }}
                              className={`min-h-[34px] px-3 rounded-lg font-semibold cursor-pointer ${
                                item.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-[#18231F] dark:text-stone-400'
                              }`}
                            >
                              {item.isActive ? 'مفعّل' : 'معطّل'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <form
                  onSubmit={handleAddDailyTask}
                  className="p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3 text-xs"
                >
                  <h2 className="font-display text-base font-bold">إضافة مهمة يومية</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <input
                      type="text"
                      required
                      value={newTaskKey}
                      onChange={(e) => setNewTaskKey(e.target.value)}
                      placeholder="المفتاح البرمجي (مثل active_chat)"
                      className="min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                    />
                    <input
                      type="text"
                      required
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="عنوان المهمة..."
                      className="min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={250}
                      value={newTaskCoins}
                      onChange={(e) => setNewTaskCoins(Number(e.target.value))}
                      placeholder="مكافأة العملات"
                      className="min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                    />
                    <input
                      type="number"
                      min={0}
                      max={300}
                      value={newTaskXp}
                      onChange={(e) => setNewTaskXp(Number(e.target.value))}
                      placeholder="مكافأة XP"
                      className="min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    value={newTaskDesc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                    placeholder="وصف مختصر للمهمة..."
                    className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-4 rounded-xl bg-[#0D7A5F] text-white font-semibold cursor-pointer"
                  >
                    إضافة المهمة
                  </button>
                </form>

                <div className="p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3 text-xs">
                  <h2 className="font-display text-base font-bold">المهام اليومية الحالية</h2>
                  {dailyTasks.map((task) => {
                    const draft = taskRewardDrafts[task.id] ?? {
                      coins: task.rewardCoins,
                      xp: task.rewardXp,
                    };
                    return (
                      <div
                        key={task.id}
                        className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-stone-100 dark:border-white/5 last:border-0"
                      >
                        <div>
                          <p className="font-bold">{task.title}</p>
                          <p className="text-stone-400 font-mono">key: {task.key}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={250}
                            value={draft.coins}
                            onChange={(e) =>
                              setTaskRewardDrafts((d) => ({
                                ...d,
                                [task.id]: { ...draft, coins: Number(e.target.value) },
                              }))
                            }
                            className="w-20 min-h-[34px] px-2 rounded-lg border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                            title="العملات"
                          />
                          <input
                            type="number"
                            min={0}
                            max={300}
                            value={draft.xp}
                            onChange={(e) =>
                              setTaskRewardDrafts((d) => ({
                                ...d,
                                [task.id]: { ...draft, xp: Number(e.target.value) },
                              }))
                            }
                            className="w-20 min-h-[34px] px-2 rounded-lg border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                            title="XP"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              setError(null);
                              try {
                                await adminSaveDailyTask({
                                  ...task,
                                  rewardCoins: Math.min(250, Math.max(0, Math.floor(draft.coins))),
                                  rewardXp: Math.min(300, Math.max(0, Math.floor(draft.xp))),
                                });
                                setFeedback(`تم حفظ مكافآت "${task.title}".`);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'تعذر حفظ مكافآت المهمة.');
                              }
                            }}
                            className="min-h-[34px] px-3 rounded-lg bg-[#0D7A5F] text-white font-semibold cursor-pointer"
                          >
                            حفظ
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setError(null);
                              try {
                                await adminSaveDailyTask({ ...task, isActive: !task.isActive });
                                setFeedback(`تم تحديث حالة "${task.title}".`);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'تعذر تحديث حالة المهمة.');
                              }
                            }}
                            className={`min-h-[34px] px-3 rounded-lg font-semibold cursor-pointer ${
                              task.isActive ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-stone-200 text-stone-600 dark:bg-[#18231F] dark:text-stone-400'
                            }`}
                          >
                            {task.isActive ? 'مفعّلة' : 'معطّلة'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: Creators Review */}
        {tab === 'creators' && (
          <div className="space-y-3">
            {proposals.map((p) => (
              <div
                key={p.id}
                className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-2.5 text-xs"
              >
                <div className="flex justify-between">
                  <strong className="text-sm">{p.title}</strong>
                  <span className="font-semibold">{p.status}</span>
                </div>
                <p className="text-stone-500">بقلم: {p.authorName} · {p.category}</p>
                <p className="text-stone-700 dark:text-stone-300 leading-relaxed">{p.description}</p>

                {p.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={replyDrafts[p.id] ?? ''}
                      onChange={(e) => setReplyDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      placeholder="رد الإدارة..."
                      className="flex-1 min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                    />
                    <input
                      type="number"
                      min={1}
                      value={proposalDays[p.id] ?? 30}
                      onChange={(e) => setProposalDays((d) => ({ ...d, [p.id]: Number(e.target.value) }))}
                      className="w-20 min-h-[38px] px-2 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                      title="مدة الشارة بالأيام"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          await adminReviewProposal(p, true, replyDrafts[p.id] ?? 'عمل إبداعي رائع', proposalDays[p.id] ?? 30);
                          setFeedback(`تم اعتماد مقترح "${p.title}" ومنح الشارة.`);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'تعذر مراجعة المقترح.');
                        }
                      }}
                      className="min-h-[38px] px-3.5 rounded-xl bg-[#0D7A5F] text-white font-semibold cursor-pointer"
                    >
                      اعتماد ومنح شارة
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          await adminReviewProposal(p, false, replyDrafts[p.id] ?? 'لم يستوف الشروط حاليًا', 0);
                          setFeedback(`تم رفض مقترح "${p.title}".`);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'تعذر رفض المقترح.');
                        }
                      }}
                      className="min-h-[38px] px-3.5 rounded-xl bg-rose-600 text-white font-semibold cursor-pointer"
                    >
                      رفض
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: Topups, Support, Reports, Appeals */}
        {tab === 'requests' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            {/* Topups */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3">
              <h2 className="font-display text-sm font-bold">طلبات شحن العملات</h2>
              {!isOwner ? (
                <p className="text-stone-500">مراجعة واعتماد طلبات الشحن المالية متاحة للمالك فقط.</p>
              ) : topups.length === 0 ? (
                <p className="text-stone-400">لا توجد طلبات شحن حاليًا.</p>
              ) : (
                topups.map((t) => (
                  <div key={t.id} className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0A0F0E] border border-stone-200/60 dark:border-white/5 space-y-2">
                    <div className="flex justify-between font-bold">
                      <span>{t.userName} · {t.coinsRequested} عملة</span>
                      <span>{t.status}</span>
                    </div>
                    <p className="text-stone-500">{t.method} · مرجع: {t.reference}</p>
                    {t.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            setError(null);
                            try {
                              await reviewTopupRequest(t, true, 'تم الاعتماد', profile.uid);
                              setFeedback(`تم اعتماد شحن ${t.userName}.`);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'تعذر اعتماد طلب الشحن.');
                            }
                          }}
                          className="min-h-[34px] px-3 rounded-lg bg-[#0D7A5F] text-white font-semibold cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 inline" /> اعتماد وإضافة العملات
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setError(null);
                            try {
                              await reviewTopupRequest(t, false, 'بيانات غير مطابقة', profile.uid);
                              setFeedback(`تم رفض طلب شحن ${t.userName}.`);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'تعذر رفض طلب الشحن.');
                            }
                          }}
                          className="min-h-[34px] px-3 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5 inline" /> رفض
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Support Tickets */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3">
              <h2 className="font-display text-sm font-bold">تذاكر الدعم الفني</h2>
              {tickets.map((t) => (
                <div key={t.id} className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0A0F0E] border border-stone-200/60 dark:border-white/5 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>{t.userName}: {t.subject}</span>
                    <span>{t.status}</span>
                  </div>
                  <p>{t.message}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={replyDrafts[t.id] ?? ''}
                      onChange={(e) => setReplyDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                      placeholder="اكتب الرد..."
                      className="flex-1 min-h-[36px] px-2.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17]"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          await replySupportTicket(t, replyDrafts[t.id] ?? 'تمت المعالجة', 'answered');
                          setFeedback('تم إرسال الرد على التذكرة.');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'تعذر الرد على التذكرة.');
                        }
                      }}
                      className="min-h-[36px] px-3.5 rounded-xl bg-[#0D7A5F] text-white font-semibold cursor-pointer"
                    >
                      رد
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Reports */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3">
              <h2 className="font-display text-sm font-bold">البلاغات</h2>
              {reports.map((r) => (
                <div key={r.id} className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0A0F0E] border border-stone-200/60 dark:border-white/5 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>ضد {r.targetName} ({r.reason})</span>
                    <span>{r.status}</span>
                  </div>
                  <p>{r.details}</p>
                  {r.status === 'open' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          try {
                            await reviewReport(r, 'resolved', 'تم اتخاذ الإجراء المناسب');
                            setFeedback('تمت معالجة البلاغ.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'تعذر معالجة البلاغ.');
                          }
                        }}
                        className="min-h-[34px] px-3 rounded-lg bg-[#0D7A5F] text-white font-semibold cursor-pointer"
                      >
                        معالجة
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          try {
                            await reviewReport(r, 'dismissed', 'لا توجد مخالفة');
                            setFeedback('تم إغلاق البلاغ.');
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'تعذر إغلاق البلاغ.');
                          }
                        }}
                        className="min-h-[34px] px-3 rounded-lg border border-stone-300 dark:border-white/10 cursor-pointer"
                      >
                        إغلاق
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Appeals */}
            <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3">
              <h2 className="font-display text-sm font-bold">التماسات فك الحظر</h2>
              {appeals.map((a) => (
                <div key={a.id} className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0A0F0E] border border-stone-200/60 dark:border-white/5 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>{a.userName}</span>
                    <span>{a.status}</span>
                  </div>
                  <p>{a.reason}</p>
                  {a.status === 'pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          try {
                            await reviewAppeal(a, true, 'تم قبول الالتماس وفك الحظر');
                            setFeedback(`تم قبول التماس ${a.userName} وفك الحظر.`);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'تعذر قبول الالتماس.');
                          }
                        }}
                        className="min-h-[34px] px-3 rounded-lg bg-[#0D7A5F] text-white font-semibold cursor-pointer"
                      >
                        قبول وفك الحظر
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null);
                          try {
                            await reviewAppeal(a, false, 'رفض الالتماس');
                            setFeedback(`تم رفض التماس ${a.userName}.`);
                          } catch (err) {
                            setError(err instanceof Error ? err.message : 'تعذر رفض الالتماس.');
                          }
                        }}
                        className="min-h-[34px] px-3 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer"
                      >
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: Site Settings, Ads & Megaphone */}
        {tab === 'settings' && (
          <div className="space-y-5 text-xs">
            <form
              onSubmit={handleAdminShout}
              className="p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-3"
            >
              <h2 className="font-display text-base font-bold flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#0D7A5F] dark:text-[#6EE7B7]" />
                <span>إرسال إعلان إدارة في الميكروفون</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={adminShoutText}
                  onChange={(e) => setAdminShoutText(e.target.value)}
                  placeholder="نص الإعلان الإداري..."
                  className="flex-1 min-h-[42px] px-3.5 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                />
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={adminShoutUrgent}
                    onChange={(e) => setAdminShoutUrgent(e.target.checked)}
                    className="accent-rose-600"
                  />
                  <span>عاجل</span>
                </label>
                <button
                  type="submit"
                  className="min-h-[42px] px-4 rounded-xl bg-[#0D7A5F] hover:bg-[#095E49] text-white font-semibold cursor-pointer"
                >
                  بث الإعلان
                </button>
              </div>
            </form>

            {!isOwner ? (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                تعديل إعدادات المنصة والحدود وبوابات الدفع والإعلانات متاح للمالك فقط.
              </div>
            ) : (
            <form
              onSubmit={handleSaveSettings}
              className="p-5 rounded-3xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 space-y-5"
            >
              <h2 className="font-display text-base font-bold">الحدود والتسعير وإعدادات المنصة</h2>

              {/* Dynamic Site Logo (Header Center) */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#0A0F0E] border border-stone-200/70 dark:border-white/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {settingsDraft.siteLogoUrl ? (
                      <img
                        src={settingsDraft.siteLogoUrl}
                        alt="معاينة شعار الموقع"
                        className="w-10 h-10 rounded-xl object-cover border border-stone-200 dark:border-white/10"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0D7A5F] to-[#14B8A6] text-white flex items-center justify-center font-display font-bold text-base shadow-sm">
                        ف
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-sm flex items-center gap-1.5">
                        <Image className="w-4 h-4 text-[#0D7A5F] dark:text-[#6EE7B7]" />
                        <span>شعار الموقع في الشريط العلوي</span>
                      </p>
                      <p className="text-[11px] text-stone-500">
                        يظهر في منتصف الهيدر بجانب اسم "فضفضة" لجميع الأعضاء والزوار.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="min-h-[36px] px-3 rounded-xl border border-[#0D7A5F] text-[#0D7A5F] dark:text-[#6EE7B7] font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:bg-[#0D7A5F]/10">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingLogo ? 'جارٍ الرفع...' : 'رفع شعار'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadSiteLogo}
                        disabled={uploadingLogo}
                        className="hidden"
                      />
                    </label>
                    {settingsDraft.siteLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setSettingsDraft((s) => ({ ...s, siteLogoUrl: '' }))}
                        className="min-h-[36px] px-3 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>إزالة الشعار</span>
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="url"
                  dir="ltr"
                  value={settingsDraft.siteLogoUrl || ''}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, siteLogoUrl: e.target.value }))
                  }
                  placeholder="https://... رابط مباشر لصورة الشعار (اختياري)"
                  className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17] font-mono text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { key: 'guestDailyMessageLimit', label: 'حد رسائل الضيف اليومي' },
                  { key: 'roomCreationCost', label: 'سعر إنشاء الجروب' },
                  { key: 'randomMatchFreeDaily', label: 'التواصل العشوائي المجاني/يوم' },
                  { key: 'randomMatchCost', label: 'تكلفة التواصل العشوائي المدفوع' },
                  { key: 'randomMatchDurationSec', label: 'مدة التواصل العشوائي (ثانية)' },
                  { key: 'marriageSiteFeePercent', label: 'نسبة الموقع من المهر %' },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-stone-500 mb-1">{f.label}</label>
                    <input
                      type="number"
                      min={0}
                      value={Number(settingsDraft[f.key as keyof typeof settingsDraft] ?? 0)}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          [f.key]: Math.max(0, Number(e.target.value)),
                        }))
                      }
                      className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E] font-mono"
                    />
                  </div>
                ))}
                <div className="col-span-2 sm:col-span-3 p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0A0F0E] border border-stone-200/60 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <label className="block font-bold text-stone-800 dark:text-stone-100">
                      تكلفة بث الميكروفون العام (بالعملات)
                    </label>
                    <p className="text-[11px] text-stone-500">
                      القيمة التي يدفعها العضو لبث رسالة في الشريط العلوي لجميع المتواجدين.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {[50, 100, 250, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSettingsDraft((s) => ({ ...s, shoutoutCost: preset }))}
                        className={`min-h-[34px] px-2.5 rounded-lg text-xs font-mono font-semibold border cursor-pointer transition-colors ${
                          settingsDraft.shoutoutCost === preset
                            ? 'bg-[#0D7A5F] text-white border-[#0D7A5F]'
                            : 'bg-white dark:bg-[#121A17] text-stone-600 dark:text-stone-300 border-stone-200/80 dark:border-white/10'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                    <input
                      type="number"
                      min={0}
                      value={Number(settingsDraft.shoutoutCost ?? 0)}
                      onChange={(e) =>
                        setSettingsDraft((s) => ({
                          ...s,
                          shoutoutCost: Math.max(0, Number(e.target.value)),
                        }))
                      }
                      className="w-24 min-h-[36px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17] font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 space-y-2.5">
                <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsDraft.welcomePopupEnabled}
                    onChange={(e) =>
                      setSettingsDraft((s) => ({ ...s, welcomePopupEnabled: e.target.checked }))
                    }
                  />
                  <span>تفعيل نافذة الترحيب للزوار والأعضاء الجدد</span>
                </label>
                <input
                  type="text"
                  value={settingsDraft.welcomePopupTitle}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, welcomePopupTitle: e.target.value }))
                  }
                  placeholder="عنوان نافذة الترحيب"
                  className="w-full min-h-[38px] px-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                />
                <textarea
                  rows={2}
                  value={settingsDraft.welcomePopupBody}
                  onChange={(e) =>
                    setSettingsDraft((s) => ({ ...s, welcomePopupBody: e.target.value }))
                  }
                  placeholder="نص نافذة الترحيب"
                  className="w-full p-3 rounded-xl border border-stone-200/80 dark:border-white/10 bg-stone-50 dark:bg-[#0A0F0E]"
                />
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">طرق الدفع والشحن (Payment Methods)</h3>
                  <button
                    type="button"
                    onClick={() =>
                      setSettingsDraft((s) => ({
                        ...s,
                        paymentMethods: [
                          ...s.paymentMethods,
                          {
                            id: `pm_${Date.now()}`,
                            name: 'وسيلة دفع جديدة',
                            accountInfo: '',
                            rateCoinsPerUnit: 100,
                            currency: 'EGP',
                            enabled: true,
                          },
                        ],
                      }))
                    }
                    className="min-h-[36px] px-3 rounded-xl border border-[#0D7A5F] text-[#0D7A5F] dark:text-[#6EE7B7] font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة وسيلة دفع</span>
                  </button>
                </div>

                {settingsDraft.paymentMethods.map((pm, idx) => (
                  <div key={pm.id} className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0A0F0E] border border-stone-200/60 dark:border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pm.enabled}
                          onChange={(e) =>
                            setSettingsDraft((s) => ({
                              ...s,
                              paymentMethods: s.paymentMethods.map((m, i) =>
                                i === idx ? { ...m, enabled: e.target.checked } : m
                              ),
                            }))
                          }
                        />
                        <span>مفعّلة</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setSettingsDraft((s) => ({
                            ...s,
                            paymentMethods: s.paymentMethods.filter((_, i) => i !== idx),
                          }))
                        }
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 cursor-pointer"
                        title="حذف وسيلة الدفع"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={pm.name}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
                            ...s,
                            paymentMethods: s.paymentMethods.map((m, i) =>
                              i === idx ? { ...m, name: e.target.value } : m
                            ),
                          }))
                        }
                        placeholder="اسم الوسيلة"
                        className="min-h-[36px] px-2.5 rounded-lg border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17]"
                      />
                      <input
                        type="text"
                        value={pm.accountInfo}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
                            ...s,
                            paymentMethods: s.paymentMethods.map((m, i) =>
                              i === idx ? { ...m, accountInfo: e.target.value } : m
                            ),
                          }))
                        }
                        placeholder="بيانات التحويل / الرقم"
                        className="min-h-[36px] px-2.5 rounded-lg border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17]"
                      />
                      <input
                        type="number"
                        min={1}
                        value={pm.rateCoinsPerUnit}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
                            ...s,
                            paymentMethods: s.paymentMethods.map((m, i) =>
                              i === idx ? { ...m, rateCoinsPerUnit: Number(e.target.value) } : m
                            ),
                          }))
                        }
                        placeholder="عملات / وحدة"
                        className="min-h-[36px] px-2.5 rounded-lg border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17] font-mono"
                      />
                      <input
                        type="text"
                        value={pm.currency}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
                            ...s,
                            paymentMethods: s.paymentMethods.map((m, i) =>
                              i === idx ? { ...m, currency: e.target.value } : m
                            ),
                          }))
                        }
                        placeholder="العملة (EGP / USD)"
                        className="min-h-[36px] px-2.5 rounded-lg border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17] font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-stone-100 dark:border-white/5 space-y-3">
                <h3 className="font-bold text-sm">مواضع الإعلانات (Ads Slots)</h3>
                {(['header_banner', 'sidebar_card', 'feed_inline'] as const).map((slotKey) => {
                  const slot = settingsDraft.ads[slotKey];
                  return (
                    <div key={slotKey} className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#0A0F0E] border border-stone-200/60 dark:border-white/5 space-y-2">
                      <label className="inline-flex items-center gap-2 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          onChange={(e) =>
                            setSettingsDraft((s) => ({
                              ...s,
                              ads: {
                                ...s.ads,
                                [slotKey]: { ...slot, enabled: e.target.checked },
                              },
                            }))
                          }
                        />
                        <span>موضع: {slotKey}</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={slot.title}
                          onChange={(e) =>
                            setSettingsDraft((s) => ({
                              ...s,
                              ads: { ...s.ads, [slotKey]: { ...slot, title: e.target.value } },
                            }))
                          }
                          placeholder="عنوان الإعلان"
                          className="min-h-[36px] px-2.5 rounded-lg border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17]"
                        />
                        <input
                          type="text"
                          value={slot.targetUrl}
                          onChange={(e) =>
                            setSettingsDraft((s) => ({
                              ...s,
                              ads: { ...s.ads, [slotKey]: { ...slot, targetUrl: e.target.value } },
                            }))
                          }
                          placeholder="رابط الإعلان https://..."
                          className="min-h-[36px] px-2.5 rounded-lg border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17]"
                        />
                      </div>
                      <input
                        type="text"
                        value={slot.body}
                        onChange={(e) =>
                          setSettingsDraft((s) => ({
                            ...s,
                            ads: { ...s.ads, [slotKey]: { ...slot, body: e.target.value } },
                          }))
                        }
                        placeholder="وصف مختصر للإعلان"
                        className="w-full min-h-[36px] px-2.5 rounded-lg border border-stone-200/80 dark:border-white/10 bg-white dark:bg-[#121A17]"
                      />
                    </div>
                  );
                })}
              </div>

              <button
                type="submit"
                className="min-h-[44px] px-6 rounded-xl bg-[#0D7A5F] hover:bg-[#095E49] text-white text-sm font-semibold cursor-pointer transition-colors"
              >
                حفظ كافة الإعدادات
              </button>
            </form>
            )}
          </div>
        )}
      </div>

      {confirmDeleteRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#121A17] border border-stone-200/80 dark:border-white/10 p-5 space-y-4 shadow-2xl fadfada-modal-in">
            <h3 className="font-display text-base font-bold text-stone-900 dark:text-stone-50">
              هل أنت متأكد من حذف هذا الجروب؟
            </h3>
            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
              سيتم حذف جروب <strong>{confirmDeleteRoom.name}</strong> وجميع الرسائل المرتبطة به نهائيًا ولا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(deletingRoomId)}
                onClick={() => setConfirmDeleteRoom(null)}
                className="min-h-[38px] px-4 rounded-xl border border-stone-200/80 dark:border-white/10 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={Boolean(deletingRoomId)}
                onClick={() => void handleConfirmDeleteRoom()}
                className="min-h-[38px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {deletingRoomId ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
