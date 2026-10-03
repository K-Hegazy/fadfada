import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  X,
  MessageCircle,
  UserPlus,
  UserCheck,
  Heart,
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
  Check
} from 'lucide-react';
import { OwnerBadge, isUserOwner } from './OwnerBadge';

interface UserProfileModalProps {
  userId: string;
  onClose: () => void;
  onStartChat: (userId: string) => void;
  onOpenGifts: (recipientId: string) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  userId,
  onClose,
  onStartChat,
  onOpenGifts
}) => {
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [reportOpen, setReportOpen] = useState<boolean>(false);
  const [reportCategory, setReportCategory] = useState('انتحال أو مضايقة');
  const [reportDetails, setReportDetails] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/users/${userId}/profile`);
      setProfile(res.user);
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const handleFriendAction = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      if (profile.relationships.friendRequestStatus === 'received') {
        await apiRequest(`/users/friend-request/${profile.relationships.requestId}/respond`, {
          method: 'POST',
          body: JSON.stringify({ action: 'accept' })
        });
      } else if (profile.relationships.isFriend) {
        if (confirm('هل أنت متأكد من رغبتك في إزالة هذا المستخدم من قائمة أصدقائك؟')) {
          await apiRequest(`/friends/${userId}`, { method: 'DELETE' });
        }
      } else if (!profile.relationships.friendRequestStatus) {
        await apiRequest(`/users/${userId}/friend-request`, { method: 'POST' });
      }
      await fetchProfile();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFollowAction = async () => {
    setActionLoading(true);
    try {
      await apiRequest(`/users/${userId}/follow`, { method: 'POST' });
      await fetchProfile();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockAction = async () => {
    const isCurrentlyBlocked = profile?.isBlocked;
    if (!isCurrentlyBlocked && !confirm('هل أنت متأكد من حظر هذا المستخدم؟ لن يتمكن من مراسلتك أو رؤية حسابك أو قصصك.')) return;
    setActionLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; blocked: boolean }>(`/users/${userId}/block`, { method: 'POST' });
      setProfile((prev: any) => prev ? { ...prev, isBlocked: res.blocked } : null);
      if (res.blocked) {
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMuteAction = async () => {
    setActionLoading(true);
    try {
      const res = await apiRequest<{ success: boolean; muted: boolean; message: string }>(`/users/${userId}/mute`, { method: 'POST' });
      setProfile((prev: any) => prev ? { ...prev, isMuted: res.muted } : null);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
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
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="p-8 rounded-3xl bg-[#0e1017] border border-neutral-800 text-neutral-400 font-tajawal">
          جاري تحميل بيانات الملف الشخصي...
        </div>
      </div>
    );
  }

  const isFemale = profile.gender === 'female';
  const isMe = currentUser?.id === userId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#0d0f17] border border-neutral-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
        {/* Cover & Header */}
        <div className={`h-24 sm:h-28 relative ${isFemale ? 'bg-gradient-to-r from-rose-950 via-pink-900 to-purple-950' : 'bg-gradient-to-r from-cyan-950 via-slate-900 to-sky-950'}`}>
          <button
            onClick={onClose}
            className="absolute top-3 left-3 sm:top-4 sm:left-4 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Profile Details Container */}
        <div className="px-3.5 sm:px-6 pb-4 sm:pb-6 pt-0 relative flex-1 overflow-y-auto space-y-4 sm:space-y-6">
          {/* Avatar & Online status */}
          <div className="flex justify-between items-end -mt-10 sm:-mt-12">
            <div className="relative">
              <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border-4 border-[#0d0f17] flex items-center justify-center text-2xl sm:text-3xl font-bold font-cairo shadow-xl overflow-hidden ${
                isFemale
                  ? 'bg-rose-900/60 text-rose-200 border-rose-900/50'
                  : 'bg-sky-900/60 text-sky-200 border-sky-900/50'
              }`}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile.username.slice(0, 1).toUpperCase()
                )}
              </div>
              {profile.isOnline && (
                <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#0d0f17] shadow-sm" />
              )}
            </div>

            {/* Badges: Owner & VIP */}
            <div className="flex items-center gap-2">
              {isUserOwner({ role: profile.role, username: profile.username }) && (
                <OwnerBadge size="md" />
              )}
              {profile.vip_level && profile.vip_level !== 'none' && !isUserOwner({ role: profile.role, username: profile.username }) && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <span>VIP {profile.vip_level.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Name, Gender, Country */}
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-cairo font-black text-white">{profile.username}</h2>
              {isUserOwner({ role: profile.role, username: profile.username }) && (
                <OwnerBadge size="sm" />
              )}
              <span className={`text-xs px-2.5 py-0.5 rounded-md font-medium border ${
                isFemale
                  ? 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                  : 'bg-sky-950/60 text-sky-300 border-sky-800/50'
              }`}>
                {isFemale ? 'أنثى' : 'ذكر'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-neutral-400 font-tajawal">
              <span>📍 {profile.country}</span>
              <span>·</span>
              <span className="flex items-center gap-1 text-amber-400">
                <Flame className="w-3.5 h-3.5" />
                شعلة {profile.streak} يوم
              </span>
              <span>·</span>
              <span className="text-emerald-400">المستوى {profile.level}</span>
            </div>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-neutral-300 bg-neutral-900/60 p-3.5 rounded-2xl border border-neutral-800/80 leading-relaxed font-tajawal">
              "{profile.bio}"
            </p>
          )}

          {/* Public Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 text-center">
              <div className="text-xl font-bold font-cairo text-white">{profile.stats.friendsCount}</div>
              <div className="text-xs text-neutral-400 font-tajawal">الأصدقاء</div>
            </div>
            <div className="p-3 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 text-center">
              <div className="text-xl font-bold font-cairo text-white">{profile.stats.followersCount}</div>
              <div className="text-xs text-neutral-400 font-tajawal">المتابعون</div>
            </div>
          </div>

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-neutral-400">الاهتمامات</h4>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((item: string, i: number) => (
                  <span key={i} className="px-3 py-1 rounded-lg bg-neutral-900 text-neutral-300 text-xs border border-neutral-800">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Achievements */}
          {profile.achievements && profile.achievements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-neutral-400">الإنجازات المكتسبة</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {profile.achievements.map((ach: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-neutral-900/50 border border-neutral-800 flex items-center gap-2.5">
                    <span className="text-xl">{ach.icon}</span>
                    <div className="text-right">
                      <div className="text-xs font-bold text-neutral-200">{ach.title}</div>
                      <div className="text-[10px] text-neutral-400 truncate">{ach.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions for other users */}
          {!isMe && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    onClose();
                    onStartChat(userId);
                  }}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-600/20"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>بدء محادثة</span>
                </button>

                <button
                  onClick={() => onOpenGifts(userId)}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-600/20"
                >
                  <Gift className="w-4 h-4" />
                  <span>إرسال هدية</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled={actionLoading}
                  onClick={handleFriendAction}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    profile.relationships.isFriend
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                      : profile.relationships.friendRequestStatus === 'sent'
                      ? 'bg-neutral-900 text-neutral-400 border-neutral-800'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-800'
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {profile.relationships.isFriend
                      ? 'صديق مقرب ✓'
                      : profile.relationships.friendRequestStatus === 'sent'
                      ? 'تم إرسال الطلب'
                      : profile.relationships.friendRequestStatus === 'received'
                      ? 'قبول طلب الصداقة'
                      : 'إرسال طلب صداقة'}
                  </span>
                </button>

                <button
                  disabled={actionLoading}
                  onClick={handleFollowAction}
                  className="py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Heart className={`w-4 h-4 ${profile.relationships.isFollowing ? 'text-rose-400 fill-rose-400' : ''}`} />
                  <span>{profile.relationships.isFollowing ? 'إلغاء المتابعة' : 'متابعة'}</span>
                </button>
              </div>

              {/* Safety Actions: Block & Report */}
              <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
                <button
                  onClick={() => setReportOpen(true)}
                  className="flex items-center gap-1.5 hover:text-amber-400 transition-colors cursor-pointer py-1"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>إبلاغ عن محتوى أو سلوك</span>
                </button>

                <button
                  onClick={handleMuteAction}
                  className={`flex items-center gap-1.5 transition-colors cursor-pointer py-1 ${
                    profile.isMuted ? 'text-amber-400 font-bold' : 'hover:text-amber-400'
                  }`}
                >
                  {profile.isMuted ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                  <span>{profile.isMuted ? 'إلغاء كتم المستخدم' : 'كتم الإشعارات'}</span>
                </button>

                <button
                  onClick={handleBlockAction}
                  className={`flex items-center gap-1.5 transition-colors cursor-pointer py-1 ${
                    profile.isBlocked ? 'text-rose-400 font-bold' : 'hover:text-rose-400'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>{profile.isBlocked ? 'إلغاء حظر المستخدم' : 'حظر المستخدم'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Report Drawer/Modal */}
        {reportOpen && (
          <div className="absolute inset-0 z-20 bg-[#0d0f17] p-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="font-cairo font-bold text-lg text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  تقديم بلاغ رسمي
                </h3>
                <button
                  onClick={() => setReportOpen(false)}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {reportSuccess ? (
                <div className="p-6 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6" />
                  </div>
                  <p className="font-cairo font-bold text-white">تم استلام بلاغك بنجاح</p>
                  <p className="text-xs text-neutral-400">ستتم مراجعة الحالة من قبل فريق الإدارة واتخاذ الإجراء اللازم.</p>
                </div>
              ) : (
                <form onSubmit={submitReport} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      تصنيف المخالفة
                    </label>
                    <select
                      value={reportCategory}
                      onChange={(e) => setReportCategory(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm"
                    >
                      <option value="مضايقة أو تنمر">مضايقة أو تنمر</option>
                      <option value="محتوى غير لائق أو مخالف">محتوى غير لائق أو مخالف</option>
                      <option value="انتحال شخصية">انتحال شخصية</option>
                      <option value="رسائل مزعجة أو سبام">رسائل مزعجة أو سبام</option>
                      <option value="أخرى">أخرى</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                      تفاصيل البلاغ
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={reportDetails}
                      onChange={(e) => setReportDetails(e.target.value)}
                      placeholder="يرجى ذكر ما حدث بدقة ليتسنى للإدارة مراجعته..."
                      className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'جاري الإرسال...' : 'إرسال البلاغ للإدارة'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
