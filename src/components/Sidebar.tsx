import React, { useMemo, useState } from 'react';
import {
  Archive,
  Check,
  CheckCheck,
  Crown,
  DoorOpen,
  EyeOff,
  Gift,
  HeartHandshake,
  Home,
  LogOut,
  MessageSquare,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { getPeerIdFromConversation, getUnreadCountForUser } from '../services/messaging';
import { useApp } from '../state/AppContext';
import type { ActiveNavSection } from '../types/fadfada';
import { formatArabicTime, timestampToMillis } from '../utils/formatters';
import { getEffectiveVipTier } from '../utils/progression';
import { AdSlot } from './AdSlot';
import { Avatar } from './Avatar';
import { EmptyState } from './ui/Primitives';

interface SidebarEntry {
  key: string;
  section: ActiveNavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeTone?: 'rose' | 'emerald' | 'neutral';
}

export const Sidebar: React.FC = () => {
  const {
    authUser,
    profile,
    isGuest,
    usersById,
    conversations,
    activeSection,
    setActiveSection,
    activePeerId,
    openChatWith,
    closeActiveChat,
    totalUnreadCount,
    isPeerOnline,
    isStaff,
    logout,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filteredConversations = useMemo(() => {
    if (!authUser) return [];
    const term = searchQuery.trim().toLowerCase();
    return conversations
      .filter((conv) => {
        const isArchived = (conv.archivedBy ?? []).includes(authUser.uid);
        return showArchived ? isArchived : !isArchived;
      })
      .filter((conv) => {
        const peerId = getPeerIdFromConversation(conv, authUser.uid);
        const peer = usersById[peerId];
        if (!term) return true;
        if (!peer) return false;
        return (
          peer.displayName.toLowerCase().includes(term) ||
          peer.username.toLowerCase().includes(term) ||
          conv.lastMessageText.toLowerCase().includes(term)
        );
      });
  }, [authUser, conversations, usersById, searchQuery, showArchived]);

  if (!authUser) return null;

  const navEntries: SidebarEntry[] = [
    { key: 'wall', section: 'wall', label: 'الرئيسية', icon: Home },
    {
      key: 'online',
      section: 'online',
      label: 'المتواجدون الآن',
      icon: Users,
    },
    {
      key: 'rooms',
      section: 'rooms',
      label: 'الغرف',
      icon: DoorOpen,
    },
    {
      key: 'chats',
      section: 'chats',
      label: 'الرسائل الخاصة',
      icon: MessageSquare,
      badge: totalUnreadCount,
      badgeTone: 'rose',
    },
    { key: 'store', section: 'store', label: 'المتجر', icon: ShoppingBag },
    { key: 'tasks', section: 'tasks', label: 'المهام اليومية', icon: Gift },
    { key: 'secrets', section: 'secrets', label: 'الأسرار', icon: EyeOff },
    { key: 'social', section: 'social', label: 'الزواج والأصدقاء', icon: HeartHandshake },
    { key: 'random_match', section: 'random_match', label: 'التواصل العشوائي', icon: Shuffle },
    { key: 'leaderboards', section: 'leaderboards', label: 'المتصدرون', icon: Trophy },
    { key: 'creators', section: 'creators', label: 'المبدعون', icon: Sparkles },
    { key: 'settings', section: 'settings', label: 'الحساب', icon: Settings },
    ...(isStaff ? [{ key: 'admin', section: 'admin' as const, label: 'الإدارة', icon: Shield }] : []),
  ];

  const handleSelectEntry = (entry: SidebarEntry) => {
    if (entry.section !== 'chats') closeActiveChat();
    setActiveSection(entry.section);
  };

  const effectiveVip =
    !isGuest && profile ? getEffectiveVipTier(profile.vipTier, profile.vipExpiresAt) : 'none';
  const showInboxPanel = activeSection === 'chats';

  return (
    <aside className="w-full md:w-auto shrink-0 h-full flex bg-white dark:bg-[#121B20] md:border-l border-slate-200/90 dark:border-white/10">
      {/* Compact Arabic Live Chat Community Rail */}
      <nav
        aria-label="أقسام فضفضة"
        className="hidden md:flex flex-col w-[60px] xl:w-[206px] shrink-0 border-l border-slate-200/80 dark:border-white/10 bg-[#F8FAFC] dark:bg-[#0F171B]"
      >
        {/* Minimal Identity Row */}
        {profile && (
          <button
            type="button"
            onClick={() =>
              handleSelectEntry({
                key: 'settings',
                section: 'settings',
                label: 'الحساب',
                icon: Settings,
              })
            }
            className="hidden xl:flex items-center gap-2 px-3 py-2.5 border-b border-slate-200/80 dark:border-white/10 hover:bg-slate-200/50 dark:hover:bg-[#18242B] text-right transition-colors cursor-pointer"
          >
            <Avatar
              src={profile.avatar}
              name={profile.displayName}
              size="xs"
              frameId={profile.frameId}
              isOnline={isPeerOnline(profile)}
              showPresence
            />
            <span className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate flex-1">
              {profile.displayName}
            </span>
            {isGuest ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-[#18242B] text-slate-600 dark:text-slate-300 shrink-0">
                ضيف
              </span>
            ) : (
              effectiveVip !== 'none' && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            )}
          </button>
        )}

        {/* Dense Community Directory Links */}
        <div className="flex-1 overflow-y-auto fadfada-scroll p-1.5 space-y-0.5">
          {navEntries.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.section;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectEntry(item)}
                title={item.label}
                aria-label={item.label}
                className={`relative w-full min-h-[34px] px-2.5 rounded-md flex items-center justify-center xl:justify-between gap-2 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#0B7A62] text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#18242B]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden xl:inline truncate whitespace-nowrap">{item.label}</span>
                </div>
                {typeof item.badge === 'number' && item.badge > 0 && (
                  <span
                    className={`xl:static absolute top-0.5 left-0.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-mono tabular-nums flex items-center justify-center shrink-0 ${
                      active
                        ? 'bg-white text-[#0B7A62]'
                        : item.badgeTone === 'emerald'
                        ? 'bg-[#E6F4F0] dark:bg-[#132E28] text-[#0B7A62] dark:text-[#34D399]'
                        : item.badgeTone === 'rose'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200/80 dark:bg-[#18242B] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Distinct Logout Action at Bottom */}
        <div className="p-1.5 border-t border-slate-200/80 dark:border-white/10">
          <button
            type="button"
            onClick={() => void logout()}
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            className="w-full min-h-[36px] px-2.5 rounded-md flex items-center justify-center xl:justify-start gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xl:inline truncate whitespace-nowrap">تسجيل الخروج</span>
          </button>
        </div>
      </nav>

      {/* Contextual Conversations Panel (Private Messages Inbox) */}
      {showInboxPanel && (
        <div className="w-full md:w-[300px] xl:w-[320px] min-w-0 flex flex-col h-full bg-white dark:bg-[#121B20]">
          <div className="px-3.5 py-2 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                الرسائل الخاصة
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {showArchived ? 'الأرشيف' : `${filteredConversations.length} محادثة`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowArchived((p) => !p)}
              className="min-h-[30px] px-2.5 rounded-md bg-slate-100 dark:bg-[#18242B] hover:bg-slate-200 dark:hover:bg-[#1E2D36] inline-flex items-center gap-1 text-xs font-semibold text-[#0B7A62] dark:text-[#34D399] whitespace-nowrap cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'النشطة' : 'الأرشيف'}</span>
            </button>
          </div>

          <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في الرسائل..."
                className="w-full min-h-[34px] pr-8 pl-2.5 rounded-md border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-[#0B1114] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto fadfada-scroll pb-20 md:pb-2">
            {filteredConversations.length === 0 ? (
              <div className="p-3.5">
                <EmptyState
                  icon={<MessageSquare className="w-5 h-5" />}
                  title={showArchived ? 'لا توجد محادثات مؤرشفة' : 'لا توجد محادثات بعد'}
                  description={
                    showArchived
                      ? 'المحادثات المؤرشفة تظهر هنا.'
                      : 'اختر أي عضو من المتواجدين الآن لبدء محادثة فورية.'
                  }
                  action={
                    !showArchived ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleSelectEntry({
                            key: 'online',
                            section: 'online',
                            label: 'المتواجدون الآن',
                            icon: Users,
                          })
                        }
                        className="min-h-[34px] px-3.5 rounded-md bg-[#0B7A62] hover:bg-[#08634F] text-white text-xs font-semibold cursor-pointer"
                      >
                        المتواجدون الآن
                      </button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredConversations.map((conv) => {
                  const peerId = getPeerIdFromConversation(conv, authUser.uid);
                  const peer = usersById[peerId];
                  const peerName = peer?.displayName ?? 'مستخدم';
                  const online = peer ? isPeerOnline(peer) : false;
                  const unread = getUnreadCountForUser(conv, authUser.uid);
                  const isActive = activeSection === 'chats' && activePeerId === peerId;
                  const isMine = conv.lastMessageSenderId === authUser.uid;
                  const timeValue =
                    timestampToMillis(conv.lastMessageAt) || timestampToMillis(conv.updatedAt);

                  return (
                    <li key={conv.id}>
                      <button
                        type="button"
                        onClick={() => openChatWith(peerId)}
                        className={`w-full px-3 py-2 flex items-center gap-2.5 text-right transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#E6F4F0]/90 dark:bg-[#132E28]/80'
                            : 'hover:bg-slate-50 dark:hover:bg-[#18242B]/70'
                        }`}
                      >
                        <Avatar
                          src={peer?.avatar}
                          name={peerName}
                          size="md"
                          frameId={peer?.frameId}
                          isOnline={online}
                          showPresence
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate">
                              {peerName}
                            </span>
                            <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                              {formatArabicTime(timeValue)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 min-w-0 text-[11px] text-slate-500 dark:text-slate-400">
                              {isMine && conv.lastMessageStatus !== 'none' && (
                                <span
                                  className={
                                    conv.lastMessageStatus === 'seen'
                                      ? 'text-[#0B7A62] dark:text-[#34D399]'
                                      : 'text-slate-400'
                                  }
                                >
                                  {conv.lastMessageStatus === 'seen' ? (
                                    <CheckCheck className="w-3.5 h-3.5" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5" />
                                  )}
                                </span>
                              )}
                              <p className="truncate">{conv.lastMessageText || 'ابدأ المحادثة'}</p>
                            </div>
                            {unread > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#0B7A62] text-white text-[10px] font-mono tabular-nums flex items-center justify-center shrink-0">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="hidden md:block p-2.5 border-t border-slate-100 dark:border-white/10">
            <AdSlot slot="sidebar_card" />
          </div>
        </div>
      )}
    </aside>
  );
};
