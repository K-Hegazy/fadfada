import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import { supabase, RealtimeChannel } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { OnlineUserItem } from '../types';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Users,
  Search,
  MessageCircle,
  Eye,
  Crown,
  Globe2,
  RefreshCw,
  Pin,
  Sparkles,
  Smile,
  Activity,
  Check
} from 'lucide-react';

interface OnlineUsersPageProps {
  onOpenProfile: (userId: string) => void;
  onStartChat: (user: OnlineUserItem) => void;
  activeChatUserId?: string | null;
  compactGrid?: boolean;
}

const ARAB_COUNTRIES = [
  'الكل', 'السعودية', 'مصر', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان',
  'العراق', 'الأردن', 'لبنان', 'سوريا', 'فلسطين', 'اليمن', 'المغرب',
  'الجزائر', 'تونس', 'ليبيا', 'السودان'
];

export const ACTIVITY_PRESETS = [
  'في انتظار المحادثة 💬',
  'مشغول ⛔',
  'أستمع للموسيقى 🎵',
  'متاح للدردشة ✨',
  'في العمل 💼',
  'أقرأ كتاباً 📖',
  'أستمتع بقهوتي ☕',
  'ألعب ألعاباً 🎮'
];

export const OnlineUsersPage: React.FC<OnlineUsersPageProps> = ({
  onOpenProfile,
  onStartChat,
  activeChatUserId,
  compactGrid = false
}) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<OnlineUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>('الكل');
  const [genderFilter, setGenderFilter] = useState<'all' | 'female' | 'male'>('all');
  const [sortOption, setSortOption] = useState<'default' | 'level' | 'newest'>('default');

  // Activity Status management
  const [myActivityStatus, setMyActivityStatus] = useState<string>(() => {
    return localStorage.getItem('fadfada_activity_status') || user?.activityStatus || 'في انتظار المحادثة 💬';
  });
  const [isEditingStatus, setIsEditingStatus] = useState<boolean>(false);
  const [customStatusInput, setCustomStatusInput] = useState<string>('');
  const [savingStatus, setSavingStatus] = useState<boolean>(false);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);

  const handleUpdateStatus = async (newStatus: string) => {
    const trimmed = newStatus.trim().slice(0, 50);
    if (!trimmed) return;
    setMyActivityStatus(trimmed);
    localStorage.setItem('fadfada_activity_status', trimmed);
    setIsEditingStatus(false);
    setSavingStatus(true);

    try {
      await apiRequest('/users/activity-status', {
        method: 'POST',
        body: JSON.stringify({ activityStatus: trimmed })
      });

      // Update in Supabase Presence immediately
      if (presenceChannelRef.current && user) {
        await presenceChannelRef.current.track({
          id: user.id,
          username: user.username,
          gender: user.gender,
          country: user.country,
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          level: user.level,
          vipLevel: user.vipLevel,
          isPinned: user.isPinned,
          equippedBadge: user.equippedBadge,
          equippedFrame: user.equippedFrame,
          isGuest: user.isGuest,
          isOnline: true,
          activityStatus: trimmed,
          online_at: new Date().toISOString()
        });
      }

      // Update in local state for immediate feedback
      setUsers(prev =>
        prev.map(u => (u.id === user?.id ? { ...u, activityStatus: trimmed } : u))
      );
    } catch (e) {
      console.error('Failed to update activity status:', e);
    } finally {
      setSavingStatus(false);
    }
  };

  // Maintain precise user ordering:
  // 1. Pinned profiles
  // 2. Same country matching current user's country
  // 3. Females before males
  // 4. Level descending
  const sortUsersList = (list: OnlineUserItem[]): OnlineUserItem[] => {
    return [...list].sort((a, b) => {
      // 1. Pinned items always on top
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      // 2. Same country prioritization
      const aSameCountry = user?.country && a.country === user.country;
      const bSameCountry = user?.country && b.country === user.country;
      if (aSameCountry && !bSameCountry) return -1;
      if (!aSameCountry && bSameCountry) return 1;

      // 3. Females before males
      if (a.gender === 'female' && b.gender === 'male') return -1;
      if (a.gender === 'male' && b.gender === 'female') return 1;

      // 4. Level descending
      return (b.level || 0) - (a.level || 0);
    });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedCountry !== 'الكل') params.set('country', selectedCountry);
      if (genderFilter !== 'all') params.set('gender', genderFilter);
      if (sortOption !== 'default') params.set('sort', sortOption);

      const res = await apiRequest<{ users: OnlineUserItem[]; userCountry: string }>(
        `/users/online?${params.toString()}`
      );
      setUsers(sortOption === 'default' ? sortUsersList(res.users) : res.users);
    } catch (err) {
      console.error('Error fetching online users:', err);
    } finally {
      setLoading(false);
    }
  };

  // Real-time Supabase Presence Subscriptions
  useEffect(() => {
    fetchUsers();

    // Subscribe to Supabase Realtime Presence Channel
    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user?.id || `anon_${Date.now()}`
        }
      }
    });

    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState<any>();
        setUsers(prev => {
          let hasChanges = false;
          const updated = prev.map(u => {
            const key = u.id;
            if (presenceState[key] && presenceState[key].length > 0) {
              const pData = presenceState[key][0];
              const newOnline = !u.isOnline ? true : u.isOnline;
              const newStatus = pData?.activityStatus !== undefined ? pData.activityStatus : u.activityStatus;
              if (!u.isOnline || u.activityStatus !== newStatus) {
                hasChanges = true;
                return { ...u, isOnline: true, activityStatus: newStatus };
              }
            }
            return u;
          });
          return hasChanges ? (sortOption === 'default' ? sortUsersList(updated) : updated) : prev;
        });
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (!key) return;
        const data = newPresences?.[0];

        setUsers(prev => {
          const index = prev.findIndex(u => u.id === key);
          if (index !== -1) {
            // User status changed to online
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              isOnline: true,
              ...(data || {}),
              activityStatus: data?.activityStatus !== undefined ? data.activityStatus : updated[index].activityStatus
            };
            return sortOption === 'default' ? sortUsersList(updated) : updated;
          } else if (data && key !== user?.id) {
            // Respect active filters when a user joins dynamically
            if (selectedCountry !== 'الكل' && data.country && data.country !== selectedCountry) {
              return prev;
            }
            if (genderFilter !== 'all' && data.gender && data.gender !== genderFilter) {
              return prev;
            }
            if (search.trim()) {
              const query = search.trim().toLowerCase();
              const nameMatch = (data.username || '').toLowerCase().includes(query);
              const countryMatch = (data.country || '').toLowerCase().includes(query);
              if (!nameMatch && !countryMatch) return prev;
            }

            // New user entered: add to list immediately and maintain country/gender sort
            const newUser: OnlineUserItem = {
              id: key,
              username: data.username || 'مستخدم جديد',
              gender: data.gender || 'male',
              country: data.country || 'السعودية',
              bio: data.bio || '',
              avatarUrl: data.avatarUrl || '',
              level: data.level || 0,
              vipLevel: data.vipLevel || 'none',
              isOnline: true,
              activityStatus: data.activityStatus || '',
              interests: data.interests || [],
              isPinned: !!data.isPinned,
              equippedBadge: data.equippedBadge,
              equippedFrame: data.equippedFrame,
              isGuest: !!data.isGuest
            };
            const combined = [newUser, ...prev.filter(u => u.id !== key)];
            return sortOption === 'default' ? sortUsersList(combined) : combined;
          }
          return prev;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (!key) return;
        // User exited or disconnected: automatically remove from the list without page reload!
        setUsers(prev => prev.filter(u => u.id !== key));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({
            id: user.id,
            username: user.username,
            gender: user.gender,
            country: user.country,
            bio: user.bio,
            avatarUrl: user.avatarUrl,
            level: user.level,
            vipLevel: user.vipLevel,
            isPinned: user.isPinned,
            equippedBadge: user.equippedBadge,
            equippedFrame: user.equippedFrame,
            isGuest: user.isGuest,
            isOnline: true,
            activityStatus: myActivityStatus,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      presenceChannelRef.current = null;
    };
  }, [selectedCountry, genderFilter, sortOption, user?.id, myActivityStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const renderUsersGrid = () => (
    <>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              className="h-56 rounded-3xl bg-neutral-900/60 border border-neutral-800 animate-pulse p-4 space-y-3"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-neutral-900/40 border border-neutral-800 space-y-3">
          <Users className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="font-cairo font-bold text-lg text-white">لا يوجد متصلون حالياً يطابقون بحثك</h3>
          <p className="text-sm text-neutral-400 font-tajawal">
            جرّب تغيير فلاتر الدولة أو الجنس، أو شارك رابط الموقع لدعوة أصدقائك!
          </p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 ${
            compactGrid || activeChatUserId ? 'xl:grid-cols-2' : 'lg:grid-cols-3 xl:grid-cols-4'
          } gap-4`}
        >
          {users.map(item => {
            const isFemale = item.gender === 'female';
            const isFromMyCountry = user?.country && item.country === user.country;
            const isChatActive = activeChatUserId === item.id;

            return (
              <div
                key={item.id}
                className={`group relative rounded-2xl sm:rounded-3xl p-3.5 sm:p-4.5 bg-neutral-900/90 border transition-all duration-300 flex flex-col justify-between hover:shadow-xl hover:shadow-black/40 ${
                  isChatActive
                    ? 'border-emerald-500 bg-neutral-850 ring-2 ring-emerald-500/20'
                    : item.isPinned
                    ? 'border-amber-500/60 bg-gradient-to-b from-amber-950/20 via-neutral-900 to-neutral-900 ring-1 ring-amber-500/20'
                    : 'border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                {/* Pinned Crown Tag */}
                {item.isPinned && (
                  <div className="absolute -top-3 left-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-600 text-black text-[10px] font-black flex items-center gap-1 shadow-md shadow-amber-500/20">
                    <Pin className="w-2.5 h-2.5 fill-black" />
                    <span>مثبّت في الصدارة</span>
                  </div>
                )}

                <div className="space-y-2.5 sm:space-y-3">
                  {/* Top card row: Avatar & Badges */}
                  <div className="flex items-start justify-between">
                    <div
                      onClick={() => onOpenProfile(item.id)}
                      className="relative cursor-pointer group-hover:scale-105 transition-transform"
                    >
                      <div
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-neutral-800 flex items-center justify-center font-bold text-white shadow-inner overflow-hidden border ${
                          item.equippedFrame === 'gold'
                            ? 'border-amber-400 ring-2 ring-amber-400/30'
                            : item.equippedFrame === 'royal'
                            ? 'border-purple-400 ring-2 ring-purple-400/30'
                            : 'border-neutral-700'
                        }`}
                      >
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt={item.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-base sm:text-lg font-cairo">
                            {item.username.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Online indicator badge */}
                      {item.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 border-2 border-neutral-900 rounded-full animate-pulse shadow-sm" />
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5">
                      {/* Gender Badge */}
                      <span
                        className={`text-[10px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full border ${
                          isFemale
                            ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                            : 'bg-sky-950/80 text-sky-300 border-sky-700/60'
                        }`}
                      >
                        {isFemale ? 'أنثى 🌸' : 'ذكر 💎'}
                      </span>

                      {/* VIP Tag if available */}
                      {item.vipLevel && item.vipLevel !== 'none' && (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded-md">
                          <Crown className="w-3 h-3 text-amber-400" />
                          <span>VIP</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Name, Equipped Badge and Level */}
                  <div>
                    <div
                      onClick={() => onOpenProfile(item.id)}
                      className="font-cairo font-bold text-sm sm:text-base text-white hover:text-emerald-400 transition-colors cursor-pointer truncate flex items-center gap-1.5"
                    >
                      <span className="truncate">{item.username}</span>
                      {isUserOwner({ role: item.role, username: item.username }) && (
                        <OwnerBadge size="xs" />
                      )}
                      {item.equippedBadge && (
                        <span className="text-sm sm:text-base" title="شارة خاصة من المتجر">
                          {item.equippedBadge}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-neutral-400 mt-1 font-tajawal">
                      <span className="flex items-center gap-1">
                        📍 {item.country}
                        {isFromMyCountry && (
                          <span className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-1.5 py-0.2 rounded">
                            دولتـك
                          </span>
                        )}
                      </span>
                      <span>·</span>
                      {item.isGuest ? (
                        <span className="text-amber-400/90 font-medium">زائر مؤقت</span>
                      ) : (
                        <span className="text-emerald-400 font-medium">المستوى {item.level}</span>
                      )}
                    </div>

                    {/* Activity Status Badge */}
                    <div className="mt-1.5 sm:mt-2">
                      {item.activityStatus ? (
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-gradient-to-r from-emerald-950/90 via-neutral-900 to-neutral-900 border border-emerald-800/50 text-[10px] sm:text-[11px] text-emerald-300 font-tajawal shadow-sm max-w-full"
                          title={`حالة النشاط: ${item.activityStatus}`}
                        >
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                          <span className="truncate font-semibold">{item.activityStatus}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full bg-neutral-900/80 border border-neutral-800 text-[10px] text-neutral-400 font-tajawal">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>متصل الآن</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bio snippet */}
                  <p className="text-[11px] sm:text-xs text-neutral-400 font-tajawal line-clamp-2 min-h-[1.75rem] sm:min-h-[2rem]">
                    {item.bio || 'عضو في منصة فضفضه الاجتماعية'}
                  </p>

                  {/* Interests tags */}
                  {item.interests && item.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.interests.slice(0, 2).map((it, i) => (
                        <span
                          key={i}
                          className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-md bg-neutral-900 text-neutral-300 border border-neutral-800"
                        >
                          {it}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-3 sm:pt-4 mt-2.5 sm:mt-3 border-t border-neutral-900">
                  <button
                    onClick={() => onStartChat(item)}
                    className={`min-h-[38px] py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 ${
                      isChatActive
                        ? 'bg-emerald-700 text-white shadow-emerald-700/30 ring-1 ring-white/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/10'
                    }`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>محادثة</span>
                  </button>

                  <button
                    onClick={() => onOpenProfile(item.id)}
                    className="min-h-[38px] py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 font-semibold text-xs border border-neutral-800 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Eye className="w-3.5 h-3.5 text-neutral-400" />
                    <span>الملف</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in" dir="rtl">
      {/* Top Banner */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-emerald-950/40 border border-neutral-800 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0" />
              <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white">المتصلون الآن</h1>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            </div>
            <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl leading-relaxed">
              تحديث حي ومتزامن فورياً عبر اشتراكات الحضور. يتم إبراز الحسابات المثبتة في الصدارة، تليها دولتك ({user?.country})، مع تقديم الإناث ثم الذكور.
            </p>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-2 pt-1 sm:pt-0 border-t sm:border-t-0 border-neutral-800/60">
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('navigate-tab', { detail: 'shop' }));
              }}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Pin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>ثبّت حسابك في القمة</span>
            </button>

            <button
              onClick={fetchUsers}
              className="p-2 sm:p-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer active:scale-95"
              title="تحديث القائمة"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Activity Status Management Banner */}
      <div className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-emerald-950/30 border border-neutral-800 shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center font-bold text-white shadow-inner">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-cairo text-xs sm:text-sm">{user?.username?.slice(0, 2).toUpperCase() || '👤'}</span>
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-500 border-2 border-neutral-900 rounded-full animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] sm:text-xs text-neutral-400 font-tajawal">حالتي:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-emerald-950/80 border border-emerald-800/60 text-[11px] sm:text-xs font-bold text-emerald-300 font-tajawal shadow-sm max-w-full">
                  <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="truncate">{myActivityStatus}</span>
                </span>
                {savingStatus && (
                  <span className="text-[10px] text-amber-300 font-tajawal animate-pulse">جاري الحفظ...</span>
                )}
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-400 font-tajawal mt-0.5 line-clamp-1 sm:line-clamp-none">
                تظهر هذه الحالة مباشرة بجانب صورتك في قائمة المتصلين لدى جميع الأعضاء.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditingStatus(prev => !prev)}
              className="w-full sm:w-auto px-3.5 py-1.5 sm:py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold border border-neutral-700/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>{isEditingStatus ? 'إغلاق الخيارات' : 'تغيير حالتي'}</span>
            </button>
          </div>
        </div>

        {/* Status Presets & Custom Input Drawer */}
        {isEditingStatus && (
          <div className="pt-3 border-t border-neutral-800/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-xs text-neutral-400 font-tajawal font-medium">اختر من الحالات الشائعة:</div>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_PRESETS.map((statusText) => (
                <button
                  key={statusText}
                  onClick={() => handleUpdateStatus(statusText)}
                  disabled={savingStatus}
                  className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-tajawal font-medium transition-all cursor-pointer flex items-center gap-1.5 border active:scale-95 ${
                    myActivityStatus === statusText
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20 font-bold'
                      : 'bg-neutral-950/80 hover:bg-neutral-800 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {statusText}
                </button>
              ))}
            </div>

            {/* Custom status input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customStatusInput.trim()) {
                  handleUpdateStatus(customStatusInput.trim());
                  setCustomStatusInput('');
                }
              }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-md pt-1"
            >
              <input
                type="text"
                value={customStatusInput}
                onChange={(e) => setCustomStatusInput(e.target.value)}
                placeholder="أو اكتب حالة مخصصة جديدة..."
                maxLength={45}
                className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 outline-none font-tajawal min-h-[40px]"
              />
              <button
                type="submit"
                disabled={!customStatusInput.trim() || savingStatus}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 min-h-[40px] flex items-center justify-center active:scale-95"
              >
                حفظ الحالة
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-neutral-900/80 border border-neutral-800 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو الدولة..."
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl pr-10 pl-4 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all font-tajawal min-h-[40px]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 min-h-[40px] active:scale-95"
          >
            بحث
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-neutral-800/60 text-xs font-tajawal">
          {/* Gender Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400 text-[11px] sm:text-xs">الجنس:</span>
            <div className="flex bg-neutral-950 p-1 rounded-xl border border-neutral-800">
              <button
                onClick={() => setGenderFilter('all')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-all ${
                  genderFilter === 'all' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                الكل
              </button>
              <button
                onClick={() => setGenderFilter('female')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-all ${
                  genderFilter === 'female' ? 'bg-rose-950/80 text-rose-300 font-bold border border-rose-800/40' : 'text-neutral-400 hover:text-white'
                }`}
              >
                إناث 🌸
              </button>
              <button
                onClick={() => setGenderFilter('male')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-[11px] sm:text-xs transition-all ${
                  genderFilter === 'male' ? 'bg-sky-950/80 text-sky-300 font-bold border border-sky-800/40' : 'text-neutral-400 hover:text-white'
                }`}
              >
                ذكور 💎
              </button>
            </div>
          </div>

          {/* Country selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
            <Globe2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <select
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs text-white outline-none cursor-pointer"
            >
              {ARAB_COUNTRIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Grid of Users */}
      {renderUsersGrid()}
    </div>
  );
};
