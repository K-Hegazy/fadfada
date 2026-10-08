import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import { supabase, RealtimeChannel } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { OnlineUserItem } from '../types';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Users,
  Search,
  Crown,
  Pin,
  RefreshCw,
  Sparkles,
  Smile,
  X,
  MessageCircle
} from 'lucide-react';

interface OnlineUsersPageProps {
  onOpenProfile: (userId: string) => void;
  onStartChat: (user: OnlineUserItem) => void;
  activeChatUserId?: string | null;
  selectedUserId?: string | null;
  compactGrid?: boolean;
  fillHeight?: boolean;
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

export const ACTIVITY_PRESETS = [
  'في انتظار المحادثة 💬',
  'متاح للدردشة ✨',
  'مشغول ⛔',
  'أستمع للموسيقى 🎵',
  'أستمتع بقهوتي ☕',
  'في العمل 💼',
  'أقرأ كتاباً 📖',
  'ألعب ألعاباً 🎮'
];

export const OnlineUsersPage: React.FC<OnlineUsersPageProps> = ({
  onOpenProfile,
  onStartChat,
  activeChatUserId,
  selectedUserId,
  compactGrid = false,
  fillHeight = false
}) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<OnlineUserItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Activity Status Modal/Popover
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
          role: user.role,
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

      setUsers(prev =>
        prev.map(u => (u.id === user?.id ? { ...u, activityStatus: trimmed } : u))
      );
    } catch (e) {
      console.error('Failed to update activity status:', e);
    } finally {
      setSavingStatus(false);
    }
  };

  // Sort list: Owner first, then pinned, then same country, females before males, level descending
  const sortUsersList = (list: OnlineUserItem[]): OnlineUserItem[] => {
    return [...list].sort((a, b) => {
      const aIsOwner = isUserOwner(a);
      const bIsOwner = isUserOwner(b);
      if (aIsOwner && !bIsOwner) return -1;
      if (!aIsOwner && bIsOwner) return 1;

      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      const aSameCountry = user?.country && a.country === user.country;
      const bSameCountry = user?.country && b.country === user.country;
      if (aSameCountry && !bSameCountry) return -1;
      if (!aSameCountry && bSameCountry) return 1;

      if (a.gender === 'female' && b.gender === 'male') return -1;
      if (a.gender === 'male' && b.gender === 'female') return 1;

      return (b.level || 0) - (a.level || 0);
    });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ users: OnlineUserItem[]; userCountry: string }>('/users/online');
      setUsers(sortUsersList(res.users || []));
    } catch (err) {
      console.error('Error fetching online users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Realtime Supabase Presence Integration
  useEffect(() => {
    const channel = supabase.channel('online_presence', {
      config: {
        presence: {
          key: user?.id || `guest_${Math.random().toString(36).substring(7)}`
        }
      }
    });

    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activePresenceUsers: OnlineUserItem[] = [];

        Object.keys(state).forEach(key => {
          const presenceArray = state[key] as any[];
          if (presenceArray && presenceArray.length > 0) {
            const p = presenceArray[0];
            if (p && p.id) {
              activePresenceUsers.push({
                id: p.id,
                username: p.username || 'عضو',
                role: p.role,
                gender: p.gender || 'male',
                country: p.country || 'مصر',
                bio: p.bio,
                avatarUrl: p.avatarUrl,
                level: p.level || 1,
                vipLevel: p.vipLevel || 'none',
                isOnline: true,
                activityStatus: p.activityStatus || 'في انتظار المحادثة 💬',
                lastActiveAt: p.online_at || new Date().toISOString(),
                isPinned: Boolean(p.isPinned),
                equippedBadge: p.equippedBadge,
                equippedFrame: p.equippedFrame,
                isGuest: Boolean(p.isGuest)
              });
            }
          }
        });

        if (activePresenceUsers.length > 0) {
          setUsers(prev => {
            const map = new Map<string, OnlineUserItem>();
            activePresenceUsers.forEach(u => map.set(u.id, u));
            prev.forEach(u => {
              if (!map.has(u.id)) {
                map.set(u.id, u);
              }
            });
            return sortUsersList(Array.from(map.values()));
          });
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (newPresences && newPresences.length > 0) {
          const newUser = newPresences[0] as any;
          if (newUser && newUser.id) {
            setUsers(prev => {
              const exists = prev.some(u => u.id === newUser.id);
              const updatedItem: OnlineUserItem = {
                id: newUser.id,
                username: newUser.username || 'عضو',
                role: newUser.role,
                gender: newUser.gender || 'male',
                country: newUser.country || 'مصر',
                bio: newUser.bio,
                avatarUrl: newUser.avatarUrl,
                level: newUser.level || 1,
                vipLevel: newUser.vipLevel || 'none',
                isOnline: true,
                activityStatus: newUser.activityStatus || 'في انتظار المحادثة 💬',
                lastActiveAt: newUser.online_at || new Date().toISOString(),
                isPinned: Boolean(newUser.isPinned),
                equippedBadge: newUser.equippedBadge,
                equippedFrame: newUser.equippedFrame,
                isGuest: Boolean(newUser.isGuest)
              };

              const nextList = exists
                ? prev.map(u => (u.id === newUser.id ? updatedItem : u))
                : [updatedItem, ...prev];

              return sortUsersList(nextList);
            });
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (leftPresences && leftPresences.length > 0) {
          const leftIds = new Set(leftPresences.map((p: any) => p.id));
          setUsers(prev => prev.map(u => (leftIds.has(u.id) ? { ...u, isOnline: false } : u)));
        }
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED' && user) {
          await channel.track({
            id: user.id,
            username: user.username,
            role: user.role,
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
  }, [user?.id, myActivityStatus]);

  // Filtered by Search query only (all filters removed as requested)
  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      u.username.toLowerCase().includes(q) ||
      (u.country && u.country.toLowerCase().includes(q))
    );
  });

  // Dedicated Pinned Users Section: Site Owner is ALWAYS at top, plus any store-pinned accounts
  const pinnedCards = filteredUsers.filter(u => isUserOwner(u) || u.isPinned);
  const regularCards = filteredUsers.filter(u => !isUserOwner(u) && !u.isPinned);

  const onlineCount = users.filter(u => u.isOnline).length || users.length;

  // Render a Single User Card as a clickable Button
  const renderUserCard = (item: OnlineUserItem, isDedicatedPinned: boolean = false) => {
    const isOwner = isUserOwner(item);
    const isFemale = item.gender === 'female';
    const isChatActive = activeChatUserId === item.id;
    const isFromMyCountry = user?.country && item.country === user.country;
    const countryFlag = getCountryFlag(item.country);

    // Apply entire-card gender / owner coloring
    let cardColorClasses = '';
    if (isOwner) {
      cardColorClasses =
        'border-amber-400/90 bg-gradient-to-r from-amber-950/45 via-[#10141f] to-[#0e121b] ring-1 ring-amber-400/50 shadow-md shadow-amber-950/40 hover:border-amber-300 hover:ring-amber-300/70';
    } else if (item.isPinned) {
      cardColorClasses =
        'border-yellow-500/80 bg-gradient-to-r from-amber-950/35 via-[#0e121a] to-[#0e121a] ring-1 ring-yellow-500/40 shadow-sm shadow-amber-950/30 hover:border-yellow-400';
    } else if (isFemale) {
      // Entire Card is Rose/Pink tinted
      cardColorClasses =
        'border-rose-500/60 bg-gradient-to-r from-rose-950/35 via-[#0e121a] to-[#0e121a] shadow-sm shadow-rose-950/30 hover:border-rose-400 hover:from-rose-950/50';
    } else {
      // Entire Card is Sky/Blue tinted
      cardColorClasses =
        'border-sky-500/60 bg-gradient-to-r from-sky-950/35 via-[#0e121a] to-[#0e121a] shadow-sm shadow-sky-950/30 hover:border-sky-400 hover:from-sky-950/50';
    }

    if (isChatActive) {
      cardColorClasses += ' ring-2 ring-emerald-400 !border-emerald-400 !bg-[#131f29]';
    } else if (selectedUserId === item.id) {
      cardColorClasses += ' ring-2 ring-emerald-500/80 !border-emerald-500/80 !bg-[#101b22]';
    }

    return (
      <div
        key={item.id}
        role="button"
        tabIndex={0}
        onClick={() => onOpenProfile(item.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenProfile(item.id);
          }
        }}
        className={`w-full text-right group relative rounded-2xl p-3 border transition-all duration-200 cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 select-none ${cardColorClasses}`}
        title={`اضغط لفتح الملف الشخصي لـ ${item.username}`}
      >
        {/* Pinned Tag */}
        {isDedicatedPinned && (
          <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[9px] font-black flex items-center gap-1 shadow-md shadow-amber-500/30 z-10">
            {isOwner ? <Crown className="w-2.5 h-2.5 fill-black" /> : <Pin className="w-2.5 h-2.5 fill-black" />}
            <span>{isOwner ? 'مالك المنصة ⭐' : 'مثبّت في الصدارة ⭐'}</span>
          </div>
        )}

        {/* Right Section: Avatar & Indicators */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0 group-hover:scale-105 transition-transform">
            <div
              className={`w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-neutral-800 flex items-center justify-center font-bold text-white shadow-md overflow-hidden border ${
                item.equippedFrame === 'gold'
                  ? 'border-2 border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/30'
                  : item.equippedFrame === 'royal'
                  ? 'border-2 border-purple-400 ring-2 ring-purple-400/50 shadow-lg shadow-purple-500/30'
                  : isOwner
                  ? 'border-2 border-amber-400/90'
                  : isFemale
                  ? 'border-2 border-rose-500/60'
                  : 'border-2 border-sky-500/60'
              }`}
            >
              {item.avatarUrl ? (
                <img
                  src={item.avatarUrl}
                  alt={item.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-base font-cairo font-bold">
                  {item.username.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>

            {/* Overlaid Country Flag */}
            <span
              className="absolute -bottom-1 -right-1 text-xs bg-[#0a0d14] rounded-full border border-neutral-700 px-0.5 shadow"
              title={item.country}
            >
              {countryFlag}
            </span>

            {/* Pulsing Green Online Beacon */}
            {item.isOnline && (
              <span
                className="absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#0d111a] rounded-full animate-pulse shadow-sm shadow-emerald-500"
                title="متصل الآن"
              />
            )}
          </div>

          {/* Middle Section: User Info */}
          <div className="min-w-0 flex-1 space-y-1">
            {/* Row 1: Name, Badges, Owner Shield, VIP */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-cairo font-bold text-sm sm:text-base text-white group-hover:text-emerald-300 transition-colors truncate max-w-[140px] sm:max-w-[200px]">
                {item.username}
              </span>

              {isOwner && <OwnerBadge size="xs" />}

              {item.vipLevel && item.vipLevel !== 'none' && (
                <span className="text-[9px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800/60 px-1.5 py-0.2 rounded shadow-sm">
                  VIP 👑
                </span>
              )}

              {item.equippedBadge && (
                <span className="text-xs shrink-0" title="شارة خاصة">
                  {item.equippedBadge}
                </span>
              )}
            </div>

            {/* Row 2: Country + Level */}
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-300 font-tajawal truncate">
              <span className="truncate">{item.country}</span>
              {isFromMyCountry && (
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800/50">
                  ابن بلدك
                </span>
              )}
              <span>·</span>
              {item.isGuest ? (
                <span className="text-amber-400 font-medium">زائر</span>
              ) : (
                <span className="text-emerald-400 font-medium">مستوى {item.level}</span>
              )}
            </div>

            {/* Row 3: Activity Status */}
            <div className="pt-0.5">
              <div
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 text-[10px] text-emerald-300 font-tajawal truncate max-w-full"
                title={item.activityStatus || 'متواجد حالياً'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate">{item.activityStatus || 'متواجد حالياً'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Left Section: Indicative Touch Action Hint & Quick Chat */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStartChat(item);
            }}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition-all cursor-pointer active:scale-95 flex items-center gap-1 text-[11px] font-bold font-tajawal shadow-sm"
            title={`محادثة فورية مع ${item.username}`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">محادثة</span>
          </button>
          <div
            className="w-8 h-8 rounded-xl bg-neutral-900/80 group-hover:bg-neutral-800 text-neutral-400 group-hover:text-emerald-300 flex items-center justify-center transition-all border border-neutral-800"
            title="عرض الملف الشخصي"
          >
            <span className="text-xs font-bold">👤</span>
          </div>
        </div>
      </div>
    );
  };

  if (fillHeight) {
    return (
      <div className="h-full min-h-0 flex flex-col overflow-hidden bg-[#090c13] rounded-2xl sm:rounded-3xl border border-neutral-800 shadow-xl select-none" dir="rtl">
        {/* 1. Fixed Stationary Top Section (Header + Search) - NEVER SCROLLS */}
        <div className="shrink-0 p-3 sm:p-4 bg-[#0a0d14]/95 border-b border-neutral-800/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-sm sm:text-base font-cairo font-black text-white truncate">
                    المتواجدون حالياً
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-600/60 text-[10px] font-black text-emerald-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {onlineCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setIsEditingStatus(true)}
                className="px-2 py-1 rounded-xl bg-[#111622] hover:bg-[#161c2a] text-neutral-300 border border-neutral-750 text-[10px] font-tajawal flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="تعديل حالتي المباشرة"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate max-w-[80px] font-medium text-emerald-200">
                  {myActivityStatus}
                </span>
                <span>✏️</span>
              </button>

              <button
                onClick={fetchUsers}
                className="p-1.5 rounded-xl bg-[#111622] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-750 transition-colors cursor-pointer active:scale-95"
                title="تحديث القائمة"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compact Clean Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث باسم المستخدم أو الدولة..."
              className="w-full bg-[#080b12] border border-neutral-800 focus:border-emerald-500 rounded-xl pr-8 pl-8 py-2 text-xs text-white placeholder-neutral-500 outline-none transition-all font-tajawal min-h-[36px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs cursor-pointer p-0.5"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 2. Independent Scrollable List of Online Users - ONLY THIS CONTAINER SCROLLS */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2.5 sm:p-3 space-y-4 custom-scrollbar">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4, 5, 6, 7].map(i => (
                <div
                  key={i}
                  className="h-18 rounded-2xl bg-[#0b0f18] border border-neutral-850 animate-pulse p-3 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-neutral-800 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-neutral-800 rounded w-1/3" />
                    <div className="h-3 bg-neutral-800/60 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-[#0a0e16] border border-neutral-850 space-y-2">
              <Users className="w-9 h-9 text-neutral-600 mx-auto" />
              <h3 className="font-cairo font-bold text-sm text-white">لا يوجد أعضاء يطابقون بحثك</h3>
              <p className="text-[11px] text-neutral-400 font-tajawal">
                تأكد من كتابة اسم المستخدم أو الدولة بشكل صحيح.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Pinned Cards */}
              {pinnedCards.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <h2 className="font-cairo font-bold text-xs text-amber-300">
                      الكروت المثبتة في الصدارة ⭐
                    </h2>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/50 font-bold">
                      {pinnedCards.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {pinnedCards.map(item => renderUserCard(item, true))}
                  </div>
                </div>
              )}

              {/* Regular Online Users */}
              {regularCards.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <h2 className="font-cairo font-bold text-xs text-neutral-300">
                      قائمة المتواجدين حالياً
                    </h2>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800 font-bold">
                      {regularCards.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {regularCards.map(item => renderUserCard(item, false))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Activity Status Selector Modal */}
        {isEditingStatus && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="w-full max-w-md bg-[#0e131d] border border-neutral-800 rounded-3xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
                <div className="flex items-center gap-2">
                  <Smile className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-cairo font-bold text-base text-white">تحديد حالتي المباشرة</h3>
                </div>
                <button
                  onClick={() => setIsEditingStatus(false)}
                  className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-neutral-400 font-tajawal">اختر من الحالات الشائعة:</div>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVITY_PRESETS.map((statusText) => (
                    <button
                      key={statusText}
                      onClick={() => handleUpdateStatus(statusText)}
                      disabled={savingStatus}
                      className={`px-3 py-1.5 rounded-xl text-xs font-tajawal transition-all cursor-pointer border active:scale-95 ${
                        myActivityStatus === statusText
                          ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-md shadow-emerald-600/20'
                          : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                      }`}
                    >
                      {statusText}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customStatusInput.trim()) {
                    handleUpdateStatus(customStatusInput.trim());
                    setCustomStatusInput('');
                  }
                }}
                className="space-y-2 pt-2 border-t border-neutral-850"
              >
                <div className="text-xs text-neutral-400 font-tajawal">أو اكتب حالة مخصصة:</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customStatusInput}
                    onChange={(e) => setCustomStatusInput(e.target.value)}
                    placeholder="مثال: أستمتع بقهوتي الصباحية ☕"
                    maxLength={40}
                    className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 outline-none font-tajawal"
                  />
                  <button
                    type="submit"
                    disabled={!customStatusInput.trim() || savingStatus}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
                  >
                    حفظ
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in" dir="rtl">
      {/* 1. Sleek Header & Fast Clean Search (All Clutter/Filters Removed) */}
      <div className="relative overflow-hidden rounded-3xl bg-[#0a0d14]/90 border border-neutral-800 shadow-xl p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-cairo font-black text-white tracking-wide">
                المتواجدون حالياً
              </h1>

              {/* Dynamic Real-time Online Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-600/60 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-cairo font-black text-emerald-300">
                  {onlineCount} متواجد الآن
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-neutral-400 font-tajawal">
              اضغط على أي كرت لاستعراض الملف الشخصي وبدء المحادثة الفورية بجانب القائمة.
            </p>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIsEditingStatus(true)}
              className="px-3 py-2 rounded-2xl bg-[#111622] hover:bg-[#161c2a] text-neutral-300 border border-neutral-750 text-xs font-tajawal flex items-center gap-2 cursor-pointer transition-all active:scale-95"
              title="تعديل حالتي المباشرة"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span className="truncate max-w-[140px] font-medium text-emerald-200">
                {myActivityStatus}
              </span>
              <span className="text-[10px] text-neutral-400 font-bold bg-neutral-800/80 px-1.5 py-0.5 rounded-md">
                ✏️
              </span>
            </button>

            <button
              onClick={fetchUsers}
              className="p-2.5 rounded-2xl bg-[#111622] hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-750 transition-colors cursor-pointer active:scale-95"
              title="تحديث"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Clean, Simple Search Bar (No Filters / Chips) */}
        <div className="mt-4 pt-3.5 border-t border-neutral-800/80">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث باسم المستخدم أو الدولة..."
              className="w-full bg-[#080b12] border border-neutral-800 focus:border-emerald-500 rounded-2xl pr-10 pl-9 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all font-tajawal min-h-[42px]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs cursor-pointer p-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div
              key={i}
              className="h-20 rounded-2xl bg-[#090d14] border border-neutral-850 animate-pulse p-3 flex items-center gap-3"
            >
              <div className="w-14 h-14 rounded-2xl bg-neutral-800 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-800 rounded w-1/3" />
                <div className="h-3 bg-neutral-800/60 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#090d14] border border-neutral-800 space-y-3">
          <Users className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="font-cairo font-bold text-lg text-white">لا يوجد أعضاء يطابقون بحثك</h3>
          <p className="text-xs text-neutral-400 font-tajawal">
            تأكد من كتابة اسم المستخدم أو الدولة بشكل صحيح.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ========================================================================= */}
          {/* 2. DEDICATED PINNED CARDS SECTION (Owner & Pinned Accounts)               */}
          {/* ========================================================================= */}
          {pinnedCards.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <Crown className="w-4 h-4 text-amber-400" />
                <h2 className="font-cairo font-bold text-xs sm:text-sm text-amber-300">
                  الكروت المثبتة في الصدارة ⭐
                </h2>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/50 font-bold">
                  {pinnedCards.length}
                </span>
              </div>

              <div
                className={`grid ${
                  compactGrid
                    ? 'grid-cols-1'
                    : activeChatUserId
                    ? 'grid-cols-1 xl:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                } gap-2.5`}
              >
                {pinnedCards.map(item => renderUserCard(item, true))}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. ALL CONNECTED USERS SECTION                                            */}
          {/* ========================================================================= */}
          {regularCards.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-1">
                <Users className="w-4 h-4 text-emerald-400" />
                <h2 className="font-cairo font-bold text-xs sm:text-sm text-neutral-300">
                  قائمة المتواجدين حالياً
                </h2>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800 font-bold">
                  {regularCards.length}
                </span>
              </div>

              <div
                className={`grid ${
                  compactGrid
                    ? 'grid-cols-1'
                    : activeChatUserId
                    ? 'grid-cols-1 xl:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
                } gap-2.5`}
              >
                {regularCards.map(item => renderUserCard(item, false))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Activity Status Selector Modal */}
      {isEditingStatus && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-[#0e131d] border border-neutral-800 rounded-3xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
              <div className="flex items-center gap-2">
                <Smile className="w-5 h-5 text-emerald-400" />
                <h3 className="font-cairo font-bold text-base text-white">تحديد حالتي المباشرة</h3>
              </div>
              <button
                onClick={() => setIsEditingStatus(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-neutral-400 font-tajawal">اختر من الحالات الشائعة:</div>
              <div className="flex flex-wrap gap-1.5">
                {ACTIVITY_PRESETS.map((statusText) => (
                  <button
                    key={statusText}
                    onClick={() => handleUpdateStatus(statusText)}
                    disabled={savingStatus}
                    className={`px-3 py-1.5 rounded-xl text-xs font-tajawal transition-all cursor-pointer border active:scale-95 ${
                      myActivityStatus === statusText
                        ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-md shadow-emerald-600/20'
                        : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800'
                    }`}
                  >
                    {statusText}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customStatusInput.trim()) {
                  handleUpdateStatus(customStatusInput.trim());
                  setCustomStatusInput('');
                }
              }}
              className="space-y-2 pt-2 border-t border-neutral-850"
            >
              <div className="text-xs text-neutral-400 font-tajawal">أو اكتب حالة مخصصة:</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customStatusInput}
                  onChange={(e) => setCustomStatusInput(e.target.value)}
                  placeholder="مثال: أستمتع بقهوتي الصباحية ☕"
                  maxLength={40}
                  className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-neutral-500 outline-none font-tajawal"
                />
                <button
                  type="submit"
                  disabled={!customStatusInput.trim() || savingStatus}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
