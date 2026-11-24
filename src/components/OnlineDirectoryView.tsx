import React, { useMemo, useRef, useState } from 'react';
import { MessageCircle, Pin, Search, Users } from 'lucide-react';
import { recordProfileVisit } from '../services/profiles';
import { useApp } from '../state/AppContext';
import { formatRelativeLastSeen } from '../utils/formatters';
import {
  COUNTRIES,
  displayCountryName,
  getEffectiveVipTier,
  getGenderStyle,
  sortOnlineUsers,
  VIP_LABELS,
} from '../utils/progression';
import { Avatar } from './Avatar';
import { ChatPanel } from './ChatPanel';
import { ProfileViewContent } from './ProfileViewContent';
import { EmptyState } from './ui/Primitives';

export const OnlineDirectoryView: React.FC = () => {
  const {
    authUser,
    profile,
    users,
    usersById,
    relationships,
    isPeerOnline,
    getPeerLastSeenMillis,
    openProfileModal,
    isStaff,
  } = useApp();

  const [search, setSearch] = useState('');
  const [onlyOnline, setOnlyOnline] = useState(true);
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [countryFilter, setCountryFilter] = useState('');

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [embeddedChatPeerId, setEmbeddedChatPeerId] = useState<string | null>(null);
  const visitedUidsRef = useRef<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = users.filter((u) => {
      const online = isPeerOnline(u, isStaff);
      if (onlyOnline && !online) return false;
      if (genderFilter !== 'all' && u.gender !== genderFilter) return false;
      if (countryFilter && u.country !== countryFilter) return false;
      if (!term) return true;
      return (
        u.displayName.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term) ||
        u.bio.toLowerCase().includes(term) ||
        displayCountryName(u.country).toLowerCase().includes(term)
      );
    });

    return sortOnlineUsers(
      list,
      profile,
      (u) => isPeerOnline(u, isStaff),
      getPeerLastSeenMillis
    );
  }, [
    users,
    profile,
    onlyOnline,
    genderFilter,
    countryFilter,
    search,
    isPeerOnline,
    getPeerLastSeenMillis,
    isStaff,
  ]);

  const onlineTotal = useMemo(
    () => users.filter((u) => isPeerOnline(u, isStaff)).length,
    [users, isPeerOnline, isStaff]
  );

  const selectedUser = selectedUid ? usersById[selectedUid] : undefined;

  const handleSelectUser = (uid: string) => {
    setSelectedUid(uid);
    setEmbeddedChatPeerId(null);
    if (profile && uid !== profile.uid && !visitedUidsRef.current.has(uid)) {
      visitedUidsRef.current.add(uid);
      void recordProfileVisit(uid, profile);
    }
  };

  return (
    <div className="flex-1 flex min-h-0 h-full overflow-hidden">
      {/* Persistent Independent Scrollable Online Users List (Desktop & Mobile) */}
      <aside
        className={`${
          selectedUid ? 'hidden md:flex' : 'flex'
        } w-full md:w-[340px] lg:w-[370px] shrink-0 flex-col h-full bg-white dark:bg-[#121B20] md:border-l border-slate-200/80 dark:border-white/10`}
      >
        <div className="px-3 py-2.5 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Users className="w-4 h-4 text-[#0B7A62] dark:text-[#34D399] shrink-0" />
            <h1 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
              المتواجدون الآن ({onlineTotal})
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setOnlyOnline((p) => !p)}
            className={`min-h-[28px] px-2.5 rounded-md text-[11px] font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
              onlyOnline
                ? 'bg-[#0B7A62] text-white border-[#0B7A62]'
                : 'bg-[#F2F4F7] dark:bg-[#18242B] border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200'
            }`}
          >
            {onlyOnline ? 'الكل' : 'المتصلون فقط'}
          </button>
        </div>

        {/* Compact Filter Bar */}
        <div className="p-2 border-b border-slate-100 dark:border-white/5 space-y-1.5 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو @المعرف أو الدولة..."
              className="w-full min-h-[34px] pr-8 pl-2.5 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as 'all' | 'male' | 'female')}
              className="min-h-[32px] px-2 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs font-medium"
            >
              <option value="all">كل الأجناس</option>
              <option value="female">أنثى</option>
              <option value="male">ذكر</option>
            </select>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="min-h-[32px] px-2 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs font-medium"
            >
              <option value="">كل الدول</option>
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.flag} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable Users List */}
        <div className="flex-1 overflow-y-auto fadfada-scroll p-2 space-y-1.5 pb-20 md:pb-2">
          {filtered.length === 0 ? (
            <div className="p-2">
              <EmptyState
                icon={<Users className="w-5 h-5" />}
                title="لا يوجد أعضاء مطابقون"
                description="جرّب تغيير خيارات التصفية."
                action={
                  onlyOnline ? (
                    <button
                      type="button"
                      onClick={() => setOnlyOnline(false)}
                      className="min-h-[32px] px-3 rounded-md bg-[#0B7A62] text-white text-xs font-semibold cursor-pointer"
                    >
                      عرض كل الأعضاء
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            filtered.map((user) => {
              const isMe = user.uid === authUser?.uid;
              const online = isPeerOnline(user, isStaff);
              const lastSeenMs = getPeerLastSeenMillis(user);
              const isSelected = selectedUid === user.uid;
              const userIsGuest = user.role === 'guest' || user.isAnonymous;
              const effectiveVip = !userIsGuest
                ? getEffectiveVipTier(user.vipTier, user.vipExpiresAt)
                : 'none';
              const vip = VIP_LABELS[effectiveVip];
              const genderStyle = getGenderStyle(user.gender);

              const rel = relationships.find((r) => r.participantIds.includes(user.uid));
              const isFriend = rel?.status === 'accepted';
              const msgPerm = user.privacy?.messagePermission ?? 'everyone';
              const canMessage =
                !isMe &&
                (isStaff || msgPerm === 'everyone' || (msgPerm === 'friends' && isFriend));

              return (
                <div
                  key={user.uid}
                  onClick={() => handleSelectUser(user.uid)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectUser(user.uid);
                    }
                  }}
                  className={`px-2.5 py-2 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    genderStyle.cardClass
                  } ${genderStyle.rowHoverClass} ${
                    isSelected
                      ? 'ring-2 ring-[#0B7A62] dark:ring-[#34D399]'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Avatar
                      src={user.avatar}
                      name={user.displayName}
                      size="md"
                      frameId={user.frameId}
                      gender={user.gender}
                      isOnline={online}
                      showPresence
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {user.isNamePinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
                        <span
                          className="text-xs sm:text-[13px] font-bold truncate text-slate-900 dark:text-slate-50"
                          style={user.nameColor ? { color: user.nameColor } : undefined}
                        >
                          {user.displayName}
                        </span>
                        {isMe && (
                          <span className="px-1.5 py-0.2 rounded bg-[#0B7A62]/15 text-[#0B7A62] dark:text-[#34D399] text-[10px] font-bold shrink-0">
                            أنت
                          </span>
                        )}
                        {userIsGuest ? (
                          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                            · ضيف
                          </span>
                        ) : (
                          effectiveVip !== 'none' && (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                              · {vip.label}
                            </span>
                          )
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold inline-flex items-center gap-1 shrink-0 ${genderStyle.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${genderStyle.dotClass}`} />
                          <span>{genderStyle.label}</span>
                        </span>
                        <span
                          className={`shrink-0 ${
                            online
                              ? 'text-[#0B7A62] dark:text-[#34D399] font-semibold'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {online ? 'متصل' : formatRelativeLastSeen(lastSeenMs, false)}
                        </span>
                        <span>·</span>
                        <span className="truncate">
                          {displayCountryName(user.country, user.countryFlag)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isMe && (
                    <button
                      type="button"
                      disabled={!canMessage}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canMessage) return;
                        handleSelectUser(user.uid);
                        setEmbeddedChatPeerId(user.uid);
                      }}
                      aria-label={`محادثة ${user.displayName}`}
                      title={canMessage ? 'فتح المحادثة هنا' : 'المراسلة مقيدة حسب خصوصية العضو'}
                      className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 transition-colors ${
                        canMessage
                          ? 'bg-[#E6F4F0] hover:bg-[#d7ede7] dark:bg-[#14332C] dark:hover:bg-[#194037] text-[#0B7A62] dark:text-[#34D399] cursor-pointer'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 opacity-65 cursor-not-allowed'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">محادثة</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Workspace Pane: Inline Profile Preview OR Embedded Private Chat */}
      <div
        className={`${
          selectedUid ? 'flex' : 'hidden md:flex'
        } flex-1 min-w-0 h-full flex-col bg-[#F2F4F7] dark:bg-[#0B1114]`}
      >
        {embeddedChatPeerId ? (
          <ChatPanel
            embeddedPeerId={embeddedChatPeerId}
            onBackEmbedded={() => setEmbeddedChatPeerId(null)}
          />
        ) : selectedUser ? (
          <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-5 pb-20 md:pb-6">
            <div className="max-w-xl mx-auto">
              <ProfileViewContent
                target={selectedUser}
                onStartChat={(uid) => setEmbeddedChatPeerId(uid)}
                onInspectUser={(uid) => handleSelectUser(uid)}
                onBackMobile={() => {
                  setSelectedUid(null);
                  setEmbeddedChatPeerId(null);
                }}
                onExpandModal={() => openProfileModal(selectedUser.uid)}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-6 text-center">
            <div className="max-w-sm space-y-2">
              <div className="w-12 h-12 rounded-xl bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
                اختر عضوًا من قائمة المتواجدين الآن
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                اضغط على أي عضو لمعاينة ملفه الشخصي بالكامل وبدء المحادثة الخاصة مباشرة هنا دون مغادرة القائمة.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
