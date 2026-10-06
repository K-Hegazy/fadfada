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
        const res = await apiRequest<{ profile: any }>(`/users/${targetUserId}`);
        if (res && res.profile) {
          setOnlineChatTargetUser({
            id: res.profile.id,
            username: res.profile.username,
            role: res.profile.role,
            gender: res.profile.gender || 'male',
            country: res.profile.country || 'السعودية',
            bio: res.profile.bio || '',
            avatarUrl: res.profile.avatarUrl || '',
            level: res.profile.level || 0,
            vipLevel: res.profile.vipLevel || 'none',
            isOnline: !!res.profile.isOnline,
            interests: res.profile.interests || [],
            isPinned: !!res.profile.isPinned,
            equippedBadge: res.profile.equippedBadge,
            equippedFrame: res.profile.equippedFrame,
            isGuest: !!res.profile.isGuest
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

  const handleStartChatWithUser = async (targetUserId: string) => {
    try {
      const res = await apiRequest<{ profile: any }>(`/users/${targetUserId}`);
      if (res && res.profile) {
        setOnlineChatTargetUser({
          id: res.profile.id,
          username: res.profile.username,
          gender: res.profile.gender || 'male',
          country: res.profile.country || 'السعودية',
          bio: res.profile.bio || '',
          avatarUrl: res.profile.avatarUrl || '',
          level: res.profile.level || 0,
          vipLevel: res.profile.vipLevel || 'none',
          isOnline: !!res.profile.isOnline,
          interests: res.profile.interests || [],
          isPinned: !!res.profile.isPinned,
          equippedBadge: res.profile.equippedBadge,
          equippedFrame: res.profile.equippedFrame,
          isGuest: !!res.profile.isGuest
        });
        setSelectedProfileId(null);
        setCurrentTab('online');
        return;
      }
    } catch (e) {
      console.error('Failed to load profile for side panel chat', e);
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
        onlineChatTargetUser ? (
          <>
            {/* Desktop Side-by-Side: Online Users List alongside Chat Panel */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-5 items-start">
              {/* Online Users Side List (Right in RTL) */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-3.5 sticky top-20">
                <OnlineUsersPage
                  onOpenProfile={(id) => setSelectedProfileId(id)}
                  onStartChat={(targetUser) => setOnlineChatTargetUser(targetUser)}
                  activeChatUserId={onlineChatTargetUser.id}
                  compactGrid={true}
                />
              </div>

              {/* Chat Panel (Left in RTL - Main Area) */}
              <div className="lg:col-span-7 xl:col-span-8 space-y-3">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-tajawal bg-[#090c13] p-2.5 rounded-2xl border border-neutral-800">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    المحادثة مفتوحة بجانب قائمة المتواجدين حالياً
                  </span>
                  <button
                    onClick={handleCloseOnlineChat}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
                  >
                    إغلاق المحادثة الجانبية ✕
                  </button>
                </div>
                <OnlineChatPanel
                  targetUser={onlineChatTargetUser}
                  onClose={handleCloseOnlineChat}
                  onOpenProfile={(id) => setSelectedProfileId(id)}
                  isMobileModal={false}
                />
              </div>
            </div>

            {/* Small Screens / Mobile: Fullscreen Overlay with Back Button */}
            <div className="block lg:hidden">
              <OnlineChatPanel
                targetUser={onlineChatTargetUser}
                onClose={handleCloseOnlineChat}
                onOpenProfile={(id) => setSelectedProfileId(id)}
                isMobileModal={true}
              />
              {/* Preserves list state & scroll behind modal */}
              <div className="hidden">
                <OnlineUsersPage
                  onOpenProfile={(id) => setSelectedProfileId(id)}
                  onStartChat={(targetUser) => setOnlineChatTargetUser(targetUser)}
                  activeChatUserId={onlineChatTargetUser.id}
                />
              </div>
            </div>
          </>
        ) : (
          <OnlineUsersPage
            onOpenProfile={(id) => setSelectedProfileId(id)}
            onStartChat={(targetUser) => setOnlineChatTargetUser(targetUser)}
            compactGrid={false}
          />
        )
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
      {selectedProfileId && (
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
