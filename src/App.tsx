import React, { useState, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { AppLayout } from './components/AppLayout';
import { OnlineUsersPage } from './components/OnlineUsersPage';
import { OnlineChatPanel } from './components/OnlineChatPanel';
import { MessagesPage } from './components/MessagesPage';
import { FriendsPage } from './components/FriendsPage';
import { RoomsPage } from './components/RoomsPage';
import { StoriesPage } from './components/StoriesPage';
import { UserProfileModal } from './components/UserProfileModal';
import { GiftsModal } from './components/GiftsModal';
import { FadfadaAssistantModal } from './components/FadfadaAssistantModal';
import { EmailVerificationBanner } from './components/EmailVerificationBanner';
import { LiveToastContainer } from './components/LiveToastContainer';
import { LegalModal, LegalTab } from './components/LegalModal';
import { MessageSquareHeart, Loader2 } from 'lucide-react';
import { OnlineUserItem } from './types';
import { apiRequest } from './services/api';

// Code Splitting / Lazy Loading for heavy secondary pages
const MissionsPage = lazy(() => import('./components/MissionsPage').then(m => ({ default: m.MissionsPage })));
const AchievementsPage = lazy(() => import('./components/AchievementsPage').then(m => ({ default: m.AchievementsPage })));
const LevelsPage = lazy(() => import('./components/LevelsPage').then(m => ({ default: m.LevelsPage })));
const WalletPage = lazy(() => import('./components/WalletPage').then(m => ({ default: m.WalletPage })));
const GamesPage = lazy(() => import('./components/GamesPage').then(m => ({ default: m.GamesPage })));
const ShopPage = lazy(() => import('./components/ShopPage').then(m => ({ default: m.ShopPage })));
const EventsPage = lazy(() => import('./components/EventsPage').then(m => ({ default: m.EventsPage })));
const NewsPage = lazy(() => import('./components/NewsPage').then(m => ({ default: m.NewsPage })));
const SettingsPage = lazy(() => import('./components/SettingsPage').then(m => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import('./components/AdminPage').then(m => ({ default: m.AdminPage })));
const RandomChatPage = lazy(() => import('./components/RandomChatPage').then(m => ({ default: m.RandomChatPage })));

function PageFallback() {
  return (
    <div className="flex items-center justify-center p-12 space-y-3 flex-col text-neutral-400 min-h-[300px]">
      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      <span className="text-xs font-tajawal">جاري تحميل الصفحة...</span>
    </div>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  // Default tab after login: "online" ("المتواجدون حالياً")
  const [currentTab, setCurrentTab] = useState<string>('online');

  // Modals state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [chatRecipientId, setChatRecipientId] = useState<string | null>(null);
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab | null>(null);

  // Side Panel Chat State for 'المتواجدون حالياً'
  const [onlineChatTargetUser, setOnlineChatTargetUser] = useState<OnlineUserItem | null>(null);

  // Mobile popstate / back-gesture integration for online chat panel modal
  React.useEffect(() => {
    if (onlineChatTargetUser) {
      window.history.pushState({ modal: 'online-chat' }, '');
      const handlePopState = () => {
        setOnlineChatTargetUser(null);
      };
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [onlineChatTargetUser]);

  const handleCloseOnlineChat = () => {
    if (window.history.state?.modal === 'online-chat') {
      window.history.back();
    } else {
      setOnlineChatTargetUser(null);
    }
  };

  // Keep track of active chat recipient globally for notification suppression
  React.useEffect(() => {
    if (currentTab === 'online' && onlineChatTargetUser) {
      (window as any).__fadfada_active_chat_user_id = onlineChatTargetUser.id;
    } else if (currentTab === 'messages' && chatRecipientId) {
      (window as any).__fadfada_active_chat_user_id = chatRecipientId;
    } else {
      (window as any).__fadfada_active_chat_user_id = null;
    }
  }, [currentTab, onlineChatTargetUser, chatRecipientId]);

  React.useEffect(() => {
    const handleOpenChat = async (e: any) => {
      const targetUserId = e.detail?.userId;
      if (!targetUserId) return;

      try {
        const res = await apiRequest<{ user?: any; profile?: any }>(`/users/${targetUserId}/profile`);
        const p = res?.user || res?.profile;
        if (p) {
          setOnlineChatTargetUser({
            id: p.id,
            username: p.username,
            role: p.role,
            gender: p.gender || 'male',
            country: p.country || 'السعودية',
            bio: p.bio || '',
            avatarUrl: p.avatar_url || p.avatarUrl || '',
            level: p.level || 0,
            vipLevel: p.vip_level || p.vipLevel || 'none',
            isOnline: !!p.isOnline,
            interests: p.interests || [],
            isPinned: !!p.isPinned,
            equippedBadge: p.equipped_badge || p.equippedBadge,
            equippedFrame: p.equipped_frame || p.equippedFrame,
            isGuest: !!p.isGuest
          });
          setCurrentTab('online');
          setSelectedProfileId(null);
          return;
        }
      } catch (err) {
        console.error('Failed to open chat from event:', err);
      }

      setChatRecipientId(targetUserId);
      setCurrentTab('messages');
    };

    window.addEventListener('open_chat_with_user', handleOpenChat);
    return () => window.removeEventListener('open_chat_with_user', handleOpenChat);
  }, []);

  React.useEffect(() => {
    const handleOpenLegal = (e: any) => {
      setLegalModalTab(e.detail?.tab || 'terms');
    };
    window.addEventListener('open_legal_modal', handleOpenLegal);
    return () => window.removeEventListener('open_legal_modal', handleOpenLegal);
  }, []);

  React.useEffect(() => {
    const handleNav = (e: any) => {
      if (e.detail) {
        if (e.detail !== 'messages') setChatRecipientId(null);
        if (e.detail !== 'online') setOnlineChatTargetUser(null);
        setCurrentTab(e.detail);
      }
    };
    window.addEventListener('navigate-tab', handleNav);
    return () => window.removeEventListener('navigate-tab', handleNav);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 animate-pulse">
          <MessageSquareHeart className="w-7 h-7" />
        </div>
        <div className="font-cairo font-bold text-lg text-white">فضفضه — Fadfada</div>
        <div className="text-xs text-neutral-500 font-tajawal">جاري تحميل بيئة المنصة...</div>
      </div>
    );
  }

  // 1. PUBLIC LANDING PAGE (SEPARATE HOMEPAGE)
  // When not logged in, render only the welcoming Landing Page.
  if (!user) {
    return (
      <LandingPage
        onSuccess={() => {
          // Redirect directly to "المتواجدون حالياً" upon success
          setCurrentTab('online');
        }}
      />
    );
  }

  const handleStartChatWithUser = async (targetUserId: string, passedProfile?: any) => {
    let p = passedProfile;
    if (!p) {
      try {
        const res = await apiRequest<{ user?: any; profile?: any }>(`/users/${targetUserId}/profile`);
        p = res?.user || res?.profile;
      } catch (e) {
        console.error('Failed to load profile for side panel chat', e);
      }
    }

    if (p) {
      setOnlineChatTargetUser({
        id: p.id,
        username: p.username,
        role: p.role,
        gender: p.gender || 'male',
        country: p.country || 'السعودية',
        bio: p.bio || '',
        avatarUrl: p.avatar_url || p.avatarUrl || '',
        level: p.level || 0,
        vipLevel: p.vip_level || p.vipLevel || 'none',
        isOnline: !!p.isOnline,
        interests: p.interests || [],
        isPinned: !!p.isPinned,
        equippedBadge: p.equipped_badge || p.equippedBadge,
        equippedFrame: p.equipped_frame || p.equippedFrame,
        isGuest: !!p.isGuest
      });
      setSelectedProfileId(null);
      setCurrentTab('online');
      return;
    }

    // Fallback: switch to online tab and close profile
    setSelectedProfileId(null);
    setCurrentTab('online');
  };

  const handleOpenGiftsForUser = (targetUserId: string) => {
    setGiftRecipientId(targetUserId);
  };

  return (
    <AppLayout
      currentTab={currentTab}
      onNavigate={(tab) => {
        if (tab !== 'messages') setChatRecipientId(null);
        if (tab !== 'online') setOnlineChatTargetUser(null);
        setCurrentTab(tab);
      }}
      onOpenAssistant={() => setAssistantOpen(true)}
    >
      <EmailVerificationBanner />

      {/* Tab Routes */}
      {currentTab === 'online' && (
        <>
          {/* Desktop 3-Column Stationary Layout: [Main Sidebar] | [Column 2: Online Users List] | [Column 3: Content / Profile / Chat] */}
          <div className="hidden lg:flex flex-row gap-3 xl:gap-4 h-full min-h-0 flex-1 overflow-hidden">
            {/* Column 2: Online Users (المتواجدون حالياً) - Middle Column */}
            <div className="w-[360px] xl:w-[410px] shrink-0 h-full min-h-0 flex flex-col overflow-hidden">
              <OnlineUsersPage
                onOpenProfile={(id) => {
                  setSelectedProfileId(id);
                }}
                onStartChat={(targetUser) => {
                  setOnlineChatTargetUser(targetUser);
                }}
                activeChatUserId={onlineChatTargetUser?.id}
                selectedUserId={selectedProfileId}
                compactGrid={true}
                fillHeight={true}
              />
            </div>

            {/* Column 3: Content / Profile / Chat (المحتوى / الملف / المحادثة) - Left in RTL */}
            <div className="flex-1 min-h-0 h-full overflow-hidden flex flex-col">
              {onlineChatTargetUser ? (
                <OnlineChatPanel
                  targetUser={onlineChatTargetUser}
                  onClose={handleCloseOnlineChat}
                  onOpenProfile={(id) => {
                    setOnlineChatTargetUser(null);
                    setSelectedProfileId(id);
                  }}
                  isMobileModal={false}
                />
              ) : selectedProfileId ? (
                <UserProfileModal
                  userId={selectedProfileId}
                  onClose={() => setSelectedProfileId(null)}
                  onStartChat={handleStartChatWithUser}
                  onOpenGifts={handleOpenGiftsForUser}
                  embedded={true}
                />
              ) : (
                <div className="h-full min-h-0 flex-1 bg-[#090d14]/90 border border-neutral-800 rounded-2xl sm:rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-5 shadow-xl select-none">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
                    <MessageSquareHeart className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5 max-w-md">
                    <h2 className="text-xl font-cairo font-black text-white">
                      محادثات فضفضه الفورية
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-400 font-tajawal leading-relaxed">
                      اختر أي عضو من قائمة المتواجدين حالياً على اليمين لاستعراض ملفه الشخصي أو بدء محادثة فورية مشفرة وسريعة بجانب القائمة.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <div className="px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-tajawal flex items-center gap-1.5">
                      <span>🔒</span>
                      <span>تشفير كامل وسرعة فائقة</span>
                    </div>
                    <div className="px-3.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-tajawal flex items-center gap-1.5">
                      <span>⏱️</span>
                      <span>صور ذاتية التدمير</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Small Screens / Mobile: Stacked view */}
          <div className="block lg:hidden h-full min-h-0 flex-1 overflow-y-auto">
            {onlineChatTargetUser ? (
              <OnlineChatPanel
                targetUser={onlineChatTargetUser}
                onClose={handleCloseOnlineChat}
                onOpenProfile={(id) => {
                  setOnlineChatTargetUser(null);
                  setSelectedProfileId(id);
                }}
                isMobileModal={true}
              />
            ) : (
              <>
                <OnlineUsersPage
                  onOpenProfile={(id) => setSelectedProfileId(id)}
                  onStartChat={(targetUser) => setOnlineChatTargetUser(targetUser)}
                  compactGrid={false}
                  fillHeight={false}
                />
                {selectedProfileId && (
                  <UserProfileModal
                    userId={selectedProfileId}
                    onClose={() => setSelectedProfileId(null)}
                    onStartChat={handleStartChatWithUser}
                    onOpenGifts={handleOpenGiftsForUser}
                    embedded={false}
                  />
                )}
              </>
            )}
          </div>
        </>
      )}

      {currentTab === 'rooms' && <RoomsPage />}
      {currentTab === 'events' && (
        <EventsPage onOpenProfile={(id) => setSelectedProfileId(id)} />
      )}
      {currentTab === 'news' && (
        <NewsPage onOpenProfile={(id) => setSelectedProfileId(id)} />
      )}

      {currentTab === 'messages' && (
        <MessagesPage
          initialRecipientId={chatRecipientId}
          onOpenProfile={(id) => setSelectedProfileId(id)}
        />
      )}

      {currentTab === 'friends' && (
        <FriendsPage
          onOpenProfile={(id) => setSelectedProfileId(id)}
          onStartChat={handleStartChatWithUser}
          onOpenGifts={handleOpenGiftsForUser}
          onNavigate={(tab) => setCurrentTab(tab)}
        />
      )}

      {currentTab === 'stories' && <StoriesPage />}

      {currentTab === 'random_chat' && (
        <Suspense fallback={<PageFallback />}>
          <RandomChatPage />
        </Suspense>
      )}

      {currentTab === 'missions' && (
        <Suspense fallback={<PageFallback />}>
          <MissionsPage />
        </Suspense>
      )}

      {currentTab === 'achievements' && (
        <Suspense fallback={<PageFallback />}>
          <AchievementsPage />
        </Suspense>
      )}

      {currentTab === 'levels' && (
        <Suspense fallback={<PageFallback />}>
          <LevelsPage onOpenProfile={(id) => setSelectedProfileId(id)} />
        </Suspense>
      )}

      {currentTab === 'wallet' && (
        <Suspense fallback={<PageFallback />}>
          <WalletPage />
        </Suspense>
      )}

      {currentTab === 'games' && (
        <Suspense fallback={<PageFallback />}>
          <GamesPage />
        </Suspense>
      )}

      {currentTab === 'shop' && (
        <Suspense fallback={<PageFallback />}>
          <ShopPage />
        </Suspense>
      )}

      {currentTab === 'events' && (
        <Suspense fallback={<PageFallback />}>
          <EventsPage onOpenProfile={(id) => setSelectedProfileId(id)} />
        </Suspense>
      )}

      {currentTab === 'news' && (
        <Suspense fallback={<PageFallback />}>
          <NewsPage onOpenProfile={(id) => setSelectedProfileId(id)} />
        </Suspense>
      )}

      {currentTab === 'settings' && (
        <Suspense fallback={<PageFallback />}>
          <SettingsPage />
        </Suspense>
      )}

      {currentTab === 'admin' && (
        <Suspense fallback={<PageFallback />}>
          <AdminPage />
        </Suspense>
      )}

      {/* Global Modals */}
      {selectedProfileId && currentTab !== 'online' && (
        <UserProfileModal
          userId={selectedProfileId}
          onClose={() => setSelectedProfileId(null)}
          onStartChat={handleStartChatWithUser}
          onOpenGifts={handleOpenGiftsForUser}
        />
      )}

      {giftRecipientId && (
        <GiftsModal
          recipientId={giftRecipientId}
          onClose={() => setGiftRecipientId(null)}
        />
      )}

      {assistantOpen && (
        <FadfadaAssistantModal onClose={() => setAssistantOpen(false)} />
      )}

      {legalModalTab && (
        <LegalModal
          initialTab={legalModalTab}
          onClose={() => setLegalModalTab(null)}
        />
      )}

      {/* Live Toast Notifications */}
      <LiveToastContainer />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
