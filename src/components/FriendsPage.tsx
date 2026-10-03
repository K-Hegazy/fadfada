import React, { useState, useEffect, useMemo } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FriendUser, FriendRequestItem } from '../types';
import {
  UserPlus,
  Users,
  UserCheck,
  Send,
  Search,
  MessageCircle,
  Eye,
  Gift,
  UserMinus,
  Check,
  X,
  Sparkles,
  Crown,
  RefreshCw,
  Globe2,
  Clock,
  Heart,
  AlertCircle,
  Filter
} from 'lucide-react';

interface FriendsPageProps {
  onOpenProfile: (userId: string) => void;
  onStartChat: (userId: string) => void;
  onOpenGifts: (userId: string) => void;
  onNavigate?: (tab: string) => void;
}

export const FriendsPage: React.FC<FriendsPageProps> = ({
  onOpenProfile,
  onStartChat,
  onOpenGifts,
  onNavigate
}) => {
  const { user, refreshUser } = useAuth();

  // Active tab: 'friends' | 'received' | 'sent' | 'find'
  const [activeTab, setActiveTab] = useState<'friends' | 'received' | 'sent' | 'find'>('friends');

  // Friends state
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestItem[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Search & Filter in friends list
  const [friendSearch, setFriendSearch] = useState<string>('');
  const [friendFilter, setFriendFilter] = useState<'all' | 'online' | 'female' | 'male'>('all');

  // Removing friend confirmation modal
  const [friendToRemove, setFriendToRemove] = useState<FriendUser | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Find & Add Friends state
  const [discoveryQuery, setDiscoveryQuery] = useState<string>('');
  const [discoveryResults, setDiscoveryResults] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState<boolean>(false);
  const [requestSentMap, setRequestSentMap] = useState<Record<string, boolean>>({});

  // Show toast notification helper
  const showToast = (message: string) => {
    setSuccessToast(message);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Fetch all friend data
  const loadData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);

      const [friendsRes, requestsRes] = await Promise.all([
        apiRequest<{ friends: FriendUser[] }>('/friends'),
        apiRequest<{ received: FriendRequestItem[]; sent: FriendRequestItem[] }>('/friends/requests')
      ]);

      setFriends(friendsRes.friends || []);
      setReceivedRequests(requestsRes.received || []);
      setSentRequests(requestsRes.sent || []);
    } catch (err: any) {
      console.error('Error loading friends data:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء تحميل بيانات الأصدقاء');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Respond to incoming request
  const handleRespondRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      setActionInProgress(requestId);
      await apiRequest(`/users/friend-request/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });

      if (action === 'accept') {
        showToast('تم قبول طلب الصداقة بنجاح! تم إضافة +25 نقطة خبرة ✨');
      } else {
        showToast('تم رفض طلب الصداقة');
      }

      // Refresh list & current user stats (for XP and pending request counter)
      await loadData();
      if (refreshUser) refreshUser();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ أثناء الرد على طلب الصداقة');
    } finally {
      setActionInProgress(null);
    }
  };

  // Cancel sent request
  const handleCancelRequest = async (requestId: string) => {
    try {
      setActionInProgress(requestId);
      await apiRequest(`/friends/requests/${requestId}/cancel`, {
        method: 'POST'
      });
      showToast('تم إلغاء طلب الصداقة');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ أثناء إلغاء طلب الصداقة');
    } finally {
      setActionInProgress(null);
    }
  };

  // Confirm remove friend
  const handleConfirmRemoveFriend = async () => {
    if (!friendToRemove) return;
    try {
      setActionInProgress(friendToRemove.id);
      await apiRequest(`/friends/${friendToRemove.id}`, {
        method: 'DELETE'
      });
      showToast(`تم إزالة ${friendToRemove.username} من قائمة أصدقائك`);
      setFriendToRemove(null);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'خطأ أثناء إزالة الصديق');
    } finally {
      setActionInProgress(null);
    }
  };

  // Quick search users for discovery
  const handleSearchDiscovery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!discoveryQuery.trim()) return;

    try {
      setDiscoveryLoading(true);
      const res = await apiRequest<{ users: any[] }>(`/users/online?search=${encodeURIComponent(discoveryQuery.trim())}`);
      setDiscoveryResults(res.users || []);
    } catch (err: any) {
      console.error('Error discovering users:', err);
    } finally {
      setDiscoveryLoading(false);
    }
  };

  // Send friend request to discovered user
  const handleSendFriendRequest = async (targetUserId: string, targetUsername: string) => {
    try {
      setActionInProgress(targetUserId);
      await apiRequest(`/users/${targetUserId}/friend-request`, {
        method: 'POST'
      });
      setRequestSentMap((prev) => ({ ...prev, [targetUserId]: true }));
      showToast(`تم إرسال طلب صداقة إلى ${targetUsername} 🤝`);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر إرسال طلب الصداقة');
    } finally {
      setActionInProgress(null);
    }
  };

  // Filter friends list
  const filteredFriends = useMemo(() => {
    return friends.filter((f) => {
      const matchesSearch =
        f.username.toLowerCase().includes(friendSearch.toLowerCase()) ||
        f.country.toLowerCase().includes(friendSearch.toLowerCase()) ||
        (f.bio && f.bio.toLowerCase().includes(friendSearch.toLowerCase()));

      if (!matchesSearch) return false;

      if (friendFilter === 'online') return f.isOnline;
      if (friendFilter === 'female') return f.gender === 'female';
      if (friendFilter === 'male') return f.gender === 'male';

      return true;
    });
  }, [friends, friendSearch, friendFilter]);

  const onlineFriendsCount = useMemo(() => {
    return friends.filter((f) => f.isOnline).length;
  }, [friends]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-950/95 border border-emerald-500/60 text-emerald-200 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold font-tajawal">{successToast}</span>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="p-1 rounded-lg hover:bg-rose-900/40 text-rose-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="rounded-3xl bg-gradient-to-r from-neutral-900/90 via-[#0d121c]/90 to-neutral-900/90 border border-neutral-800 p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black font-cairo text-white tracking-tight">
                الأصدقاء وطلبات الصداقة
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 font-tajawal">
                إدارة شبكة أصدقائك في فضفضه، متابعة المتصلين منهم، والترحيب بطلبات الصداقة الجديدة.
              </p>
            </div>
          </div>
        </div>

        {/* Header Stats */}
        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <div className="px-4 py-2.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center gap-2.5">
            <Users className="w-4 h-4 text-emerald-400" />
            <div className="text-right">
              <div className="text-[10px] text-neutral-500 font-tajawal">إجمالي الأصدقاء</div>
              <div className="text-sm font-bold text-white font-cairo">{friends.length}</div>
            </div>
          </div>

          <div className="px-4 py-2.5 rounded-2xl bg-neutral-950/70 border border-neutral-800 flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-950 animate-pulse" />
            <div className="text-right">
              <div className="text-[10px] text-neutral-500 font-tajawal">متصلون الآن</div>
              <div className="text-sm font-bold text-emerald-400 font-cairo">{onlineFriendsCount}</div>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-3 rounded-2xl bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white transition-all cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-neutral-800/80 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'friends'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>قائمة الأصدقاء</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === 'friends' ? 'bg-emerald-800 text-emerald-100' : 'bg-neutral-800 text-neutral-400'
          }`}>
            {friends.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('received')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'received'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>الطلبات الواردة</span>
          {receivedRequests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] animate-pulse">
              {receivedRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('sent')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'sent'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>الطلبات المرسلة</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            activeTab === 'sent' ? 'bg-emerald-800 text-emerald-100' : 'bg-neutral-800 text-neutral-400'
          }`}>
            {sentRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('find')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all cursor-pointer shrink-0 ${
            activeTab === 'find'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>إضافة أصدقاء جدد</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: FRIENDS LIST */}
      {/* ========================================================================= */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {/* Friends Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                placeholder="ابحث في أصدقائك بالاسم أو الدولة..."
                className="w-full bg-neutral-900/80 border border-neutral-800 rounded-2xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {friendSearch && (
                <button
                  onClick={() => setFriendSearch('')}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Filter Chips */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFriendFilter('all')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  friendFilter === 'all'
                    ? 'bg-neutral-800 text-white'
                    : 'bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                الكل ({friends.length})
              </button>

              <button
                onClick={() => setFriendFilter('online')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                  friendFilter === 'online'
                    ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300'
                    : 'bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>المتصلون الآن ({onlineFriendsCount})</span>
              </button>

              <button
                onClick={() => setFriendFilter('female')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  friendFilter === 'female'
                    ? 'bg-rose-950/80 border border-rose-700/60 text-rose-300'
                    : 'bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                إناث
              </button>

              <button
                onClick={() => setFriendFilter('male')}
                className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  friendFilter === 'male'
                    ? 'bg-sky-950/80 border border-sky-700/60 text-sky-300'
                    : 'bg-neutral-950/60 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                ذكور
              </button>
            </div>
          </div>

          {/* Friends Grid */}
          {loading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
              <p className="text-xs text-neutral-400 font-tajawal">جاري تحميل قائمة أصدقائك...</p>
            </div>
          ) : filteredFriends.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-800 bg-[#090b10] p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-neutral-900/90 text-neutral-500 flex items-center justify-center mx-auto">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-bold text-white font-cairo">
                  {friends.length === 0
                    ? 'لم تقم بإضافة أي أصدقاء بعد'
                    : 'لا توجد نتائج مطابقة لبحثك'}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-md mx-auto">
                  {friends.length === 0
                    ? 'ابحث عن أصدقاء جدد من قائمة المتصلين الآن أو أرسل طلبات صداقة لبدء محادثات مميزة.'
                    : 'جرّب كتابة اسم آخر أو تصفير معايير التصفية.'}
                </p>
              </div>

              {friends.length === 0 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('find')}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    البحث عن أصدقاء
                  </button>
                  {onNavigate && (
                    <button
                      onClick={() => onNavigate('online')}
                      className="px-5 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      تصفح المتصلين الآن
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFriends.map((friend) => {
                const isFemale = friend.gender === 'female';
                const genderCardBorder = isFemale
                  ? 'border-rose-900/40 hover:border-rose-700/60 bg-gradient-to-b from-rose-950/10 via-[#0a0c14] to-[#07090e]'
                  : 'border-sky-900/40 hover:border-sky-700/60 bg-gradient-to-b from-sky-950/10 via-[#0a0c14] to-[#07090e]';

                const avatarStyle = isFemale
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : 'bg-sky-950/80 text-sky-300 border-sky-800';

                return (
                  <div
                    key={friend.id}
                    className={`rounded-3xl border ${genderCardBorder} p-5 flex flex-col justify-between gap-4 transition-all duration-300 hover:shadow-xl relative group`}
                  >
                    {/* Top Row: Avatar, Identity, VIP */}
                    <div className="flex items-start gap-3.5">
                      {/* Avatar with live online badge */}
                      <div className="relative shrink-0">
                        {friend.avatarUrl ? (
                          <img
                            src={friend.avatarUrl}
                            alt={friend.username}
                            className="w-14 h-14 rounded-2xl object-cover border border-neutral-700"
                          />
                        ) : (
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-cairo font-black text-lg border ${avatarStyle}`}>
                            {friend.username.slice(0, 1).toUpperCase()}
                          </div>
                        )}

                        {/* Online Indicator */}
                        <div
                          className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full ring-2 ring-[#07090e] ${
                            friend.isOnline
                              ? 'bg-emerald-500 animate-pulse'
                              : 'bg-neutral-600'
                          }`}
                          title={friend.isOnline ? 'متصل الآن' : 'غير متصل'}
                        />
                      </div>

                      {/* User Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            onClick={() => onOpenProfile(friend.id)}
                            className="font-cairo font-bold text-sm text-white hover:text-emerald-400 cursor-pointer truncate"
                          >
                            {friend.username}
                          </span>

                          {/* VIP Badge */}
                          {friend.vipLevel && friend.vipLevel !== 'none' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-950/80 border border-amber-600/50 text-amber-300 text-[10px] font-bold flex items-center gap-0.5">
                              <Crown className="w-2.5 h-2.5" />
                              <span>{friend.vipLevel.toUpperCase()}</span>
                            </span>
                          )}
                        </div>

                        {/* Country & Level */}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-tajawal">
                          <span>📍 {friend.country}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">مستوى {friend.level}</span>
                        </div>

                        {/* Bio snippet */}
                        {friend.bio && (
                          <p className="text-[11px] text-neutral-400 font-tajawal mt-1 line-clamp-1">
                            {friend.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
                      {/* Start Chat Button */}
                      <button
                        onClick={() => onStartChat(friend.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/10"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>مراسلة</span>
                      </button>

                      {/* View Profile */}
                      <button
                        onClick={() => onOpenProfile(friend.id)}
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-bold transition-all cursor-pointer"
                        title="عرض الملف الشخصي"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Send Gift */}
                      <button
                        onClick={() => onOpenGifts(friend.id)}
                        className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer"
                        title="إرسال هدية"
                      >
                        <Gift className="w-3.5 h-3.5" />
                      </button>

                      {/* Remove Friend */}
                      <button
                        onClick={() => setFriendToRemove(friend)}
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-rose-950/60 text-neutral-500 hover:text-rose-400 border border-neutral-800 text-xs font-bold transition-all cursor-pointer"
                        title="إزالة الصداقة"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RECEIVED FRIEND REQUESTS */}
      {/* ========================================================================= */}
      {activeTab === 'received' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white font-cairo flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>طلبات الصداقة بانتظار موافقتك ({receivedRequests.length})</span>
            </h2>
            <span className="text-xs text-neutral-400 font-tajawal">
              قبول الطلب يمنحك +25 نقطة خبرة لكلا الطرفين
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            </div>
          ) : receivedRequests.length === 0 ? (
            <div className="rounded-3xl border border-neutral-800/80 bg-[#090b10] p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-neutral-500 flex items-center justify-center mx-auto">
                <UserCheck className="w-7 h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white font-cairo">
                لا توجد طلبات صداقة واردة جديدة
              </h3>
              <p className="text-xs text-neutral-400 font-tajawal max-w-sm mx-auto">
                عندما يرسل لك أعضاء فضفضه طلبات صداقة، ستظهر هنا لتتمكن من مراجعتها والموافقة عليها.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {receivedRequests.map((req) => {
                const isFemale = req.gender === 'female';
                const avatarStyle = isFemale
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : 'bg-sky-950/80 text-sky-300 border-sky-800';

                return (
                  <div
                    key={req.id}
                    className="rounded-3xl border border-neutral-800 bg-[#090b10] p-5 flex flex-col justify-between gap-4 relative overflow-hidden"
                  >
                    <div className="flex items-start gap-3.5">
                      {req.avatarUrl ? (
                        <img
                          src={req.avatarUrl}
                          alt={req.username}
                          className="w-14 h-14 rounded-2xl object-cover border border-neutral-700 shrink-0"
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-cairo font-bold text-lg border shrink-0 ${avatarStyle}`}>
                          {req.username.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            onClick={() => onOpenProfile(req.userId)}
                            className="font-cairo font-bold text-sm text-white hover:text-emerald-400 cursor-pointer"
                          >
                            {req.username}
                          </span>
                          {req.vipLevel && req.vipLevel !== 'none' && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-950 border border-amber-600/50 text-amber-300 text-[10px] font-bold">
                              {req.vipLevel.toUpperCase()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-tajawal">
                          <span>📍 {req.country}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">مستوى {req.level}</span>
                        </div>

                        {req.bio && (
                          <p className="text-[11px] text-neutral-400 font-tajawal mt-1 line-clamp-1">
                            {req.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Accept / Reject actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
                      <button
                        onClick={() => handleRespondRequest(req.id, 'accept')}
                        disabled={actionInProgress === req.id}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>قبول الصداقة (+25 XP)</span>
                      </button>

                      <button
                        onClick={() => handleRespondRequest(req.id, 'reject')}
                        disabled={actionInProgress === req.id}
                        className="py-2 px-3 rounded-xl bg-neutral-900 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-300 border border-neutral-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>رفض</span>
                      </button>

                      <button
                        onClick={() => onOpenProfile(req.userId)}
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-bold transition-all cursor-pointer"
                        title="معاينة الملف الشخصي"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SENT FRIEND REQUESTS */}
      {/* ========================================================================= */}
      {activeTab === 'sent' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white font-cairo flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <span>الطلبات التي أرسلتها وبانتظار رد الطرف الآخر ({sentRequests.length})</span>
            </h2>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            </div>
          ) : sentRequests.length === 0 ? (
            <div className="rounded-3xl border border-neutral-800/80 bg-[#090b10] p-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 text-neutral-500 flex items-center justify-center mx-auto">
                <Send className="w-7 h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white font-cairo">
                لا توجد طلبات صداقة مرسلة حالياً
              </h3>
              <p className="text-xs text-neutral-400 font-tajawal max-w-sm mx-auto">
                يمكنك تصفح المتصلين الآن أو استخدام خيار البحث لإرسال طلبات صداقة جديدة.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sentRequests.map((req) => {
                const isFemale = req.gender === 'female';
                const avatarStyle = isFemale
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : 'bg-sky-950/80 text-sky-300 border-sky-800';

                return (
                  <div
                    key={req.id}
                    className="rounded-3xl border border-neutral-800 bg-[#090b10] p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      {req.avatarUrl ? (
                        <img
                          src={req.avatarUrl}
                          alt={req.username}
                          className="w-14 h-14 rounded-2xl object-cover border border-neutral-700 shrink-0"
                        />
                      ) : (
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-cairo font-bold text-lg border shrink-0 ${avatarStyle}`}>
                          {req.username.slice(0, 1).toUpperCase()}
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            onClick={() => onOpenProfile(req.userId)}
                            className="font-cairo font-bold text-sm text-white hover:text-emerald-400 cursor-pointer"
                          >
                            {req.username}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/40 text-amber-300 text-[10px] font-bold">
                            قيد الانتظار
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-tajawal">
                          <span>📍 {req.country}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-bold">مستوى {req.level}</span>
                        </div>

                        {req.bio && (
                          <p className="text-[11px] text-neutral-400 font-tajawal mt-1 line-clamp-1">
                            {req.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
                      <button
                        onClick={() => handleCancelRequest(req.id)}
                        disabled={actionInProgress === req.id}
                        className="flex-1 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-rose-950/40 text-neutral-300 hover:text-rose-300 border border-neutral-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>إلغاء الطلب</span>
                      </button>

                      <button
                        onClick={() => onOpenProfile(req.userId)}
                        className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-bold transition-all cursor-pointer"
                        title="معاينة الملف الشخصي"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: FIND & ADD FRIENDS */}
      {/* ========================================================================= */}
      {activeTab === 'find' && (
        <div className="space-y-6">
          {/* Search Box */}
          <div className="rounded-3xl border border-neutral-800 bg-[#090b10] p-6 space-y-4">
            <h2 className="text-sm sm:text-base font-bold text-white font-cairo flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-400" />
              <span>البحث السريع عن أعضاء لإضافتهم</span>
            </h2>

            <form onSubmit={handleSearchDiscovery} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={discoveryQuery}
                  onChange={(e) => setDiscoveryQuery(e.target.value)}
                  placeholder="ابحث باسم المستخدم أو الاهتمام (مثال: قراءة، برمجة، سفر)..."
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl pr-10 pl-4 py-3 text-xs sm:text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={discoveryLoading || !discoveryQuery.trim()}
                className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
              >
                {discoveryLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span>بحث</span>
              </button>
            </form>
          </div>

          {/* Search Results */}
          {discoveryLoading ? (
            <div className="py-16 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto" />
            </div>
          ) : discoveryResults.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-neutral-400 font-tajawal">
                نتائج البحث ({discoveryResults.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {discoveryResults.map((u) => {
                  if (u.id === user?.id) return null; // Don't show self

                  const isFriend = friends.some((f) => f.id === u.id);
                  const isPendingSent = sentRequests.some((r) => r.userId === u.id) || requestSentMap[u.id];
                  const isPendingReceived = receivedRequests.some((r) => r.userId === u.id);
                  const isFemale = u.gender === 'female';
                  const avatarStyle = isFemale
                    ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                    : 'bg-sky-950/80 text-sky-300 border-sky-800';

                  return (
                    <div
                      key={u.id}
                      className="rounded-3xl border border-neutral-800 bg-[#090b10] p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-cairo font-bold text-base border shrink-0 ${avatarStyle}`}>
                          {u.username.slice(0, 1).toUpperCase()}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-cairo font-bold text-sm text-white truncate">
                            {u.username}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-400 font-tajawal">
                            <span>📍 {u.country}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold">مستوى {u.level || 1}</span>
                          </div>
                          {u.bio && (
                            <p className="text-[11px] text-neutral-400 font-tajawal mt-1 line-clamp-1">
                              {u.bio}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-neutral-800/60">
                        {isFriend ? (
                          <div className="flex-1 py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800 text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>صديق بالفعل</span>
                          </div>
                        ) : isPendingSent ? (
                          <div className="flex-1 py-2 px-3 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>تم إرسال الطلب</span>
                          </div>
                        ) : isPendingReceived ? (
                          <button
                            onClick={() => setActiveTab('received')}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>طلب وارد (مراجعة)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSendFriendRequest(u.id, u.username)}
                            disabled={actionInProgress === u.id}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-50"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>إرسال طلب صداقة</span>
                          </button>
                        )}

                        <button
                          onClick={() => onOpenProfile(u.id)}
                          className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 text-xs font-bold transition-all cursor-pointer"
                          title="معاينة الملف الشخصي"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-neutral-800 bg-[#090b10] p-12 text-center space-y-3">
              <Globe2 className="w-12 h-12 text-neutral-600 mx-auto" />
              <h3 className="text-sm sm:text-base font-bold text-white font-cairo">
                ابحث عن أشخاص يشاركونك نفس الاهتمامات
              </h3>
              <p className="text-xs text-neutral-400 font-tajawal max-w-md mx-auto">
                اكتب أي اسم أو كلمة مفتاحية للاهتمامات في شريط البحث بالأعلى للعثور على أعضاء فضفضه وتوسيع دائرة صداقاتك.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal: Remove Friend */}
      {friendToRemove && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0b0e14] border border-neutral-800 p-6 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-700/60 text-rose-400 flex items-center justify-center mx-auto">
              <UserMinus className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base sm:text-lg font-bold text-white font-cairo">
                إزالة الصداقة مع {friendToRemove.username}؟
              </h3>
              <p className="text-xs text-neutral-400 font-tajawal">
                هل أنت متأكد من رغبتك في إزالة هذا الصديق من قائمتك؟ يمكنك إعادة إرسال طلب صداقة له لاحقاً في أي وقت.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleConfirmRemoveFriend}
                disabled={actionInProgress === friendToRemove.id}
                className="flex-1 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-lg shadow-rose-600/20 cursor-pointer disabled:opacity-50"
              >
                {actionInProgress === friendToRemove.id ? 'جاري الإزالة...' : 'نعم، إزالة الصداقة'}
              </button>

              <button
                onClick={() => setFriendToRemove(null)}
                className="flex-1 py-2.5 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold transition-all border border-neutral-800 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
