import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  X,
  MessageCircle,
  UserPlus,
  UserCheck,
  Gift,
  ShieldAlert,
  Ban,
  Bell,
  BellOff,
  Flame,
  Award,
  Crown,
  Calendar,
  Sparkles,
  Check,
  MoreVertical,
  Globe,
  User,
  Clock,
  Shield,
  Layers,
  Heart
} from 'lucide-react';
import { OwnerBadge, isUserOwner } from './OwnerBadge';

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
  onStartChat: (userId: string, profile?: any) => void;
  onOpenGifts: (recipientId: string) => void;
  embedded?: boolean;
}

const COUNTRY_FLAGS: Record<string, string> = {
  'مصر': '🇪🇬',
  'السعودية': '🇸🇦',
  'الإمارات': '🇦🇪',
  'الكويت': '🇰🇼',
  'قطر': '🇶🇦',
  'البحرين': '🇧🇭',
  'عمان': '🇴🇲',
  'العراق': '🇮🇶',
  'الأردن': '🇯🇴',
  'لبنان': '🇱🇧',
  'سوريا': '🇸🇾',
  'فلسطين': '🇵🇸',
  'اليمن': '🇾🇪',
  'المغرب': '🇲🇦',
  'الجزائر': '🇩🇿',
  'تونس': '🇹🇳',
  'ليبيا': '🇱🇾',
  'السودان': '🇸🇩'
};

const getCountryFlag = (country?: string): string => {
  if (!country) return '🌍';
  return COUNTRY_FLAGS[country] || '📍';
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return 'عضو حديث';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'long'
    }).format(d);
  } catch {
    return 'عضو حديث';
  }
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userId,
  onClose,
  onStartChat,
  onOpenGifts,
  embedded = false
}) => {
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState<boolean>(false);

  // Reporting state
  const [reportOpen, setReportOpen] = useState<boolean>(false);
  const [reportCategory, setReportCategory] = useState<string>('مضايقة أو تنمر');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [reportSuccess, setReportSuccess] = useState<boolean>(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/users/${userId}/profile`);
      setProfile(res.user || res.profile);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    setMoreMenuOpen(false);
    setReportOpen(false);
  }, [userId]);

  const handleFriendAction = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      if (profile.relationships?.friendRequestStatus === 'received') {
        await apiRequest(`/users/friend-request/${profile.relationships.requestId}/respond`, {
          method: 'POST',
          body: JSON.stringify({ action: 'accept' })
        });
      } else if (profile.relationships?.isFriend) {
        if (confirm('هل أنت متأكد من رغبتك في إزالة هذا المستخدم من قائمة أصدقائك؟')) {
          await apiRequest(`/friends/${userId}`, { method: 'DELETE' });
        }
      } else if (!profile.relationships?.friendRequestStatus) {
        await apiRequest(`/users/${userId}/friend-request`, { method: 'POST' });
      }
      await fetchProfile();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockAction = async () => {
    const isCurrentlyBlocked = profile?.relationships?.isBlocked;
    if (!isCurrentlyBlocked && !confirm('هل أنت متأكد من حظر هذا المستخدم؟ لن يتمكن من مراسلتك أو رؤية حسابك.')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; blocked: boolean }>(`/users/${userId}/block`, {
        method: 'POST'
      });
      setProfile((prev: any) =>
        prev ? { ...prev, relationships: { ...prev.relationships, isBlocked: res.blocked } } : null
      );
      if (res.blocked) {
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
      setMoreMenuOpen(false);
    }
  };

  const handleMuteAction = async () => {
    setActionLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; muted: boolean; message: string }>(`/users/${userId}/mute`, {
        method: 'POST'
      });
      setProfile((prev: any) =>
        prev ? { ...prev, relationships: { ...prev.relationships, isMuted: res.muted } } : null
      );
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
      setMoreMenuOpen(false);
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDetails.trim()) return;
    setActionLoading(true);
    try {
      await apiRequest('/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedUserId: userId,
          targetType: 'user',
          targetId: userId,
          category: reportCategory,
          details: reportDetails
        })
      });
      setReportSuccess(true);
      setTimeout(() => {
        setReportOpen(false);
        setReportSuccess(false);
        setReportDetails('');
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartChatTrigger = () => {
    if (embedded) {
      onStartChat(userId, profile);
    } else {
      onClose();
      onStartChat(userId, profile);
    }
  };

  // Loading state
  if (loading || !profile) {
    const loadingJsx = (
      <div className="h-full min-h-0 flex-1 flex flex-col items-center justify-center p-8 bg-[#080b11] rounded-2xl sm:rounded-3xl border border-neutral-800 shadow-xl space-y-3 select-none">
        <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-neutral-400 font-tajawal">جاري تحميل بيانات الملف الشخصي...</span>
      </div>
    );

    if (embedded) return loadingJsx;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-lg">{loadingJsx}</div>
      </div>
    );
  }

  const isOwner = isUserOwner({ role: profile.role, username: profile.username, isOwner: profile.isOwner });
  const isFemale = profile.gender === 'female';
  const isMe = currentUser?.id === userId;
  const isFriend = profile.relationships?.isFriend;
  const friendStatus = profile.relationships?.friendRequestStatus;
  const countryFlag = getCountryFlag(profile.country);

  // Cover styling based on gender / owner
  const coverGradientClass = isOwner
    ? 'from-amber-950 via-[#1a140d] to-[#0d0f17]'
    : isFemale
    ? 'from-rose-950 via-pink-950/60 to-[#0d0f17]'
    : 'from-emerald-950 via-teal-950/60 to-[#0d0f17]';

  // Frame styling
  const frameBorderClass =
    profile.equippedFrame === 'gold'
      ? 'border-2 border-amber-400 ring-4 ring-amber-400/40 shadow-xl shadow-amber-500/20'
      : profile.equippedFrame === 'royal'
      ? 'border-2 border-purple-400 ring-4 ring-purple-400/40 shadow-xl shadow-purple-500/20'
      : isOwner
      ? 'border-2 border-amber-400 ring-2 ring-amber-400/50 shadow-xl shadow-amber-500/30'
      : isFemale
      ? 'border-2 border-rose-500/80 shadow-lg shadow-rose-950/50'
      : 'border-2 border-emerald-500/80 shadow-lg shadow-emerald-950/50';

  const profileContentJsx = (
    <div
      className={`relative w-full ${
        embedded
          ? 'h-full min-h-0 flex-1 flex flex-col bg-[#080b11] border border-neutral-800/90 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden'
          : 'max-w-xl bg-[#080b11] border border-neutral-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[90vh] flex flex-col'
      }`}
      dir="rtl"
    >
      {/* 1. Header Actions (Floating on cover) */}
      <div className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between pointer-events-none">
        {/* Right Corner: Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/85 text-neutral-300 hover:text-white border border-white/10 backdrop-blur-md flex items-center gap-1.5 text-xs font-tajawal cursor-pointer transition-all active:scale-95 shadow-lg"
          title="إغلاق الملف الشخصي"
        >
          <X className="w-3.5 h-3.5" />
          <span>إغلاق الملف</span>
        </button>

        {/* Left Corner: More Menu for Other Users */}
        {!isMe && (
          <div className="relative pointer-events-auto">
            <button
              type="button"
              onClick={() => setMoreMenuOpen(prev => !prev)}
              className="p-2 rounded-xl bg-black/60 hover:bg-black/85 text-neutral-300 hover:text-white border border-white/10 backdrop-blur-md flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-lg"
              title="خيارات إضافية"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {moreMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMoreMenuOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-48 bg-[#0e121b] border border-neutral-800 rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in space-y-1">
                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onOpenGifts(userId);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-right text-xs font-bold text-amber-300 hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Gift className="w-3.5 h-3.5 text-amber-400" />
                    <span>إرسال هدية للمستخدم</span>
                  </button>

                  <button
                    onClick={handleMuteAction}
                    disabled={actionLoading}
                    className="w-full px-3 py-2 rounded-xl text-right text-xs font-bold text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    {profile.relationships?.isMuted ? (
                      <>
                        <Bell className="w-3.5 h-3.5 text-emerald-400" />
                        <span>إلغاء كتم الإشعارات</span>
                      </>
                    ) : (
                      <>
                        <BellOff className="w-3.5 h-3.5 text-neutral-400" />
                        <span>كتم إشعارات المستخدم</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setMoreMenuOpen(false);
                      setReportOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl text-right text-xs font-bold text-amber-400 hover:bg-amber-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>إبلاغ عن الحساب للإدارة</span>
                  </button>

                  <div className="h-px bg-neutral-800 my-1" />

                  <button
                    onClick={handleBlockAction}
                    disabled={actionLoading}
                    className="w-full px-3 py-2 rounded-xl text-right text-xs font-bold text-rose-400 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Ban className="w-3.5 h-3.5 text-rose-400" />
                    <span>{profile.relationships?.isBlocked ? 'إلغاء الحظر' : 'حظر هذا المستخدم'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 2. Top Cover Area (Banner) */}
      <div className={`h-32 sm:h-36 shrink-0 relative bg-gradient-to-b ${coverGradientClass} overflow-hidden border-b border-neutral-850/80`}>
        {/* Subtle Decorative Pattern */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute -bottom-1 left-0 right-0 h-10 bg-gradient-to-t from-[#080b11] to-transparent pointer-events-none" />
      </div>

      {/* 3. Independent Scrollable Profile Body - ONLY THIS CONTAINER SCROLLS */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6 pt-0 space-y-5 custom-scrollbar">
        {/* Hero Identity: Large Avatar + Core Badges + Name */}
        <div className="relative -mt-14 sm:-mt-16 flex flex-col items-center text-center space-y-3">
          {/* Avatar Container */}
          <div className="relative group">
            <div
              className={`w-26 h-26 sm:w-28 sm:h-28 rounded-3xl bg-[#0d111a] border-4 border-[#080b11] flex items-center justify-center font-cairo font-bold text-3xl shadow-2xl overflow-hidden ${frameBorderClass}`}
            >
              {profile.avatar_url || profile.avatarUrl ? (
                <img
                  src={profile.avatar_url || profile.avatarUrl}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white drop-shadow-md">
                  {profile.username?.slice(0, 2).toUpperCase() || '👤'}
                </span>
              )}
            </div>

            {/* Clear Online Status Beacon */}
            <div
              className={`absolute bottom-0 -left-1 px-2 py-0.5 rounded-full border-2 border-[#080b11] flex items-center gap-1 shadow-md text-[10px] font-bold font-tajawal ${
                profile.isOnline
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600/80 shadow-emerald-500/20'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-700'
              }`}
              title={profile.isOnline ? 'متصل الآن' : 'غير متصل'}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  profile.isOnline ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400' : 'bg-neutral-500'
                }`}
              />
              <span>{profile.isOnline ? 'متصل الآن' : 'غير متصل'}</span>
            </div>

            {/* Overlaid Country Flag */}
            <span
              className="absolute -top-1 -right-1 text-sm bg-[#080b11] rounded-full border border-neutral-700 px-1 py-0.5 shadow-md"
              title={profile.country}
            >
              {countryFlag}
            </span>
          </div>

          {/* Name & Primary Badges */}
          <div className="space-y-1 w-full max-w-md">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-cairo font-black text-white tracking-wide">
                {profile.username}
              </h2>

              {isOwner && <OwnerBadge size="sm" />}

              {profile.vip_level && profile.vip_level !== 'none' && !isOwner && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/60 text-amber-300 text-[10px] font-bold shadow-sm">
                  <Crown className="w-3 h-3 text-amber-400" />
                  <span>VIP {profile.vip_level.toUpperCase()}</span>
                </span>
              )}

              {profile.equippedBadge && (
                <span className="text-base shrink-0 drop-shadow-sm" title="الشارة المجهزة">
                  {profile.equippedBadge}
                </span>
              )}
            </div>

            {/* Clean Unboxed Metadata */}
            <div className="flex items-center justify-center gap-2 text-xs text-neutral-400 font-tajawal flex-wrap">
              <span className="text-neutral-300 font-medium">📍 {profile.country}</span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              {profile.is_guest || profile.isGuest ? (
                <span className="text-amber-400 font-medium">زائر</span>
              ) : (
                <span className="text-emerald-400 font-medium">مستوى {profile.level || 1}</span>
              )}
              {profile.streak > 0 && (
                <>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span className="text-amber-400 font-medium flex items-center gap-0.5">
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>{profile.streak} يوم</span>
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 4. Action Buttons Bar (محادثة - متابعة/صداقة - هدية) */}
          {!isMe && (
            <div className="w-full pt-1">
              <div className="flex items-center justify-center gap-2.5 flex-wrap">
                {/* Primary Action Button: [ محادثة ] */}
                <button
                  type="button"
                  onClick={handleStartChatTrigger}
                  className="flex-1 min-w-[130px] max-w-[190px] py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-cairo font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95 transition-all"
                  title={`بدء محادثة فورية مع ${profile.username}`}
                >
                  <MessageCircle className="w-4 h-4 text-emerald-100" />
                  <span>محادثة فورية</span>
                </button>

                {/* Secondary Action Button: [ متابعة / صداقة ] */}
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleFriendAction}
                  className={`py-2.5 px-3.5 rounded-2xl border text-xs font-cairo font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-sm ${
                    isFriend
                      ? 'bg-neutral-900 border-neutral-750 text-emerald-300 hover:border-rose-850 hover:text-rose-300'
                      : friendStatus === 'sent'
                      ? 'bg-neutral-900 border-neutral-750 text-neutral-400'
                      : friendStatus === 'received'
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200'
                      : 'bg-[#111622] hover:bg-[#161c2a] border-neutral-750 text-neutral-200 hover:text-white'
                  }`}
                  title={
                    isFriend
                      ? 'أصدقاء (اضغط للإزالة)'
                      : friendStatus === 'sent'
                      ? 'تم إرسال طلب الصداقة'
                      : friendStatus === 'received'
                      ? 'قبول طلب الصداقة'
                      : 'إرسال طلب صداقة'
                  }
                >
                  {isFriend ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>أصدقاء</span>
                    </>
                  ) : friendStatus === 'sent' ? (
                    <>
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>طلب مرسل</span>
                    </>
                  ) : friendStatus === 'received' ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>قبول الصداقة</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5 text-teal-400" />
                      <span>إضافة صديق</span>
                    </>
                  )}
                </button>

                {/* Gift Button */}
                <button
                  type="button"
                  onClick={() => onOpenGifts(userId)}
                  className="p-2.5 rounded-2xl bg-[#111622] hover:bg-neutral-800 text-amber-300 hover:text-amber-200 border border-neutral-750 transition-all cursor-pointer active:scale-95 shadow-sm"
                  title="إرسال هدية مميزة"
                >
                  <Gift className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 5. Organized Sections */}

        {/* Section 1: نبذة عن المستخدم (Bio) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 font-tajawal">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>النبذة التعريفية</span>
          </div>
          <div className="bg-[#0e121b]/80 border border-neutral-800/80 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-neutral-200 leading-relaxed font-tajawal shadow-sm">
            {profile.bio && profile.bio.trim() ? (
              <p className="whitespace-pre-wrap leading-relaxed font-tajawal">"{profile.bio}"</p>
            ) : (
              <span className="text-neutral-500 italic">لا توجد نبذة شخصية مضافة حتى الآن.</span>
            )}
          </div>
        </div>

        {/* Section 2: أهم الإحصائيات (Key Stats) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 font-tajawal">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>أهم الإحصائيات</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="p-3 rounded-2xl bg-[#0e121b]/80 border border-neutral-800/80 text-center space-y-0.5">
              <div className="text-lg sm:text-xl font-bold font-cairo text-white tabular-nums">
                {profile.stats?.friendsCount ?? 0}
              </div>
              <div className="text-[11px] text-neutral-400 font-tajawal">الأصدقاء</div>
            </div>

            <div className="p-3 rounded-2xl bg-[#0e121b]/80 border border-neutral-800/80 text-center space-y-0.5">
              <div className="text-lg sm:text-xl font-bold font-cairo text-white tabular-nums">
                {profile.stats?.followersCount ?? 0}
              </div>
              <div className="text-[11px] text-neutral-400 font-tajawal">المتابعون</div>
            </div>

            <div className="p-3 rounded-2xl bg-[#0e121b]/80 border border-neutral-800/80 text-center space-y-0.5">
              <div className="text-lg sm:text-xl font-bold font-cairo text-white tabular-nums">
                {profile.stats?.giftsReceivedCount ?? 0}
              </div>
              <div className="text-[11px] text-neutral-400 font-tajawal">الهدايا</div>
            </div>
          </div>
        </div>

        {/* Section 3: المعلومات الأساسية (Personal Info & Account Details) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 font-tajawal">
            <Globe className="w-3.5 h-3.5 text-teal-400" />
            <span>بيانات الحساب</span>
          </div>
          <div className="bg-[#0e121b]/80 border border-neutral-800/80 rounded-2xl p-3.5 divide-y divide-neutral-850/80 space-y-2.5 text-xs font-tajawal shadow-sm">
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-neutral-400">الدولة والمنطقة</span>
              <span className="text-white font-medium flex items-center gap-1.5">
                <span>{countryFlag}</span>
                <span>{profile.country}</span>
              </span>
            </div>

            <div className="flex items-center justify-between pt-2.5">
              <span className="text-neutral-400">الجنس</span>
              <span className="text-neutral-200 font-medium">
                {isFemale ? 'أنثى 🌸' : 'ذكر 👤'}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2.5">
              <span className="text-neutral-400">المستوى ورتبة النشاط</span>
              <span className="text-emerald-400 font-bold">
                {profile.is_guest || profile.isGuest ? 'زائر' : `المستوى ${profile.level || 1}`}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2.5">
              <span className="text-neutral-400">تاريخ الانضمام</span>
              <span className="text-neutral-300">
                {formatDate(profile.created_at || profile.createdAt)}
              </span>
            </div>

            <div className="flex items-center justify-between pt-2.5">
              <span className="text-neutral-400">حالة التواجد</span>
              <span className={`font-bold ${profile.isOnline ? 'text-emerald-400' : 'text-neutral-400'}`}>
                {profile.isOnline ? 'متواجد حالياً' : 'غير متصل'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: الاهتمامات (Interests) */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 font-tajawal">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>الاهتمامات والهوايات</span>
          </div>
          {profile.interests && profile.interests.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {profile.interests.map((item: string, i: number) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-xl bg-neutral-900/90 text-neutral-300 text-xs border border-neutral-800 font-tajawal hover:border-emerald-500/40 transition-colors"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-[#0e121b]/50 border border-neutral-850 rounded-xl text-neutral-500 text-xs font-tajawal">
              لم يقم المستخدم بتحديد اهتمامات بعد.
            </div>
          )}
        </div>

        {/* Section 5: الشارات والإنجازات (Badges & Achievements) */}
        {profile.achievements && profile.achievements.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-400 font-tajawal">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>الإنجازات المكتسبة ({profile.achievements.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {profile.achievements.map((ach: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-2xl bg-[#0e121b]/80 border border-neutral-800 flex items-center gap-2.5 shadow-sm"
                >
                  <span className="text-xl shrink-0">{ach.icon || '🏆'}</span>
                  <div className="text-right min-w-0">
                    <div className="text-xs font-bold text-neutral-200 truncate">{ach.title}</div>
                    <div className="text-[10px] text-neutral-400 truncate">{ach.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report Drawer/Modal */}
      {reportOpen && (
        <div className="absolute inset-0 z-40 bg-[#080b11]/95 backdrop-blur-md p-5 sm:p-6 flex flex-col justify-between animate-in fade-in">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 className="font-cairo font-bold text-base text-white">تقديم بلاغ رسمي لإدارة فضفضه</h3>
              </div>
              <button
                onClick={() => setReportOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reportSuccess ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <p className="font-cairo font-bold text-white text-base">تم استلام بلاغك بنجاح</p>
                <p className="text-xs text-neutral-400 font-tajawal">
                  يقوم فريق الدعم والمشرفين بمراجعة البلاغ واتخاذ الإجراء اللازم فوراً للحفاظ على أمان المنصة.
                </p>
              </div>
            ) : (
              <form onSubmit={submitReport} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                    تصنيف البلاغ
                  </label>
                  <select
                    value={reportCategory}
                    onChange={e => setReportCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-tajawal outline-none focus:border-emerald-500"
                  >
                    <option value="مضايقة أو تنمر">مضايقة أو تنمر</option>
                    <option value="محتوى غير لائق أو مخالف">محتوى غير لائق أو مخالف</option>
                    <option value="انتحال شخصية">انتحال شخصية</option>
                    <option value="رسائل مزعجة أو سبام">رسائل مزعجة أو سبام</option>
                    <option value="أخرى">مخالفة أخرى</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                    تفاصيل وتوضيح البلاغ
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={reportDetails}
                    onChange={e => setReportDetails(e.target.value)}
                    placeholder="يرجى توضيح ما حدث بدقة ليتسنى للإدارة مراجعته بسرعة..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-tajawal resize-none outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-cairo font-bold text-xs shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50 transition-all active:scale-95"
                  >
                    {actionLoading ? 'جاري الإرسال...' : 'إرسال البلاغ للإدارة'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-tajawal cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return profileContentJsx;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in select-none">
      {profileContentJsx}
    </div>
  );
};
