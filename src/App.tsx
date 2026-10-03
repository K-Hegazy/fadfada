import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './components/LandingPage';
import { AppLayout } from './components/AppLayout';
import { OnlineUsersPage } from './components/OnlineUsersPage';
import { OnlineChatPanel } from './components/OnlineChatPanel';
import { MessagesPage } from './components/MessagesPage';
import { FriendsPage } from './components/FriendsPage';
import { RoomsPage } from './components/RoomsPage';
import { StoriesPage } from './components/StoriesPage';
import { MissionsPage } from './components/MissionsPage';
import { AchievementsPage } from './components/AchievementsPage';
import { LevelsPage } from './components/LevelsPage';
import { WalletPage } from './components/WalletPage';
import { GamesPage } from './components/GamesPage';
import { ShopPage } from './components/ShopPage';
import { EventsPage } from './components/EventsPage';
import { NewsPage } from './components/NewsPage';
import { SettingsPage } from './components/SettingsPage';
import { AdminPage } from './components/AdminPage';
import { UserProfileModal } from './components/UserProfileModal';
import { GiftsModal } from './components/GiftsModal';
import { FadfadaAssistantModal } from './components/FadfadaAssistantModal';
import { EmailVerificationBanner } from './components/EmailVerificationBanner';
import { LiveToastContainer } from './components/LiveToastContainer';
import { LegalModal, LegalTab } from './components/LegalModal';
import { MessageSquareHeart } from 'lucide-react';
import { OnlineUserItem } from './types';
import { apiRequest } from './services/api';

function AppContent() {
  const { user, loading } = useAuth();
  // Default tab after login: "online" ("المتصلون الآن")
  const [currentTab, setCurrentTab] = useState<string>('online');

  // Modals state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [chatRecipientId, setChatRecipientId] = useState<string | null>(null);
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);
  const [legalModalTab, setLegalModalTab] = useState<LegalTab | null>(null);

  // Side Panel Chat State for 'المتصلون الآن'
  const [onlineChatTargetUser, setOnlineChatTargetUser] = useState<OnlineUserItem | null>(null);

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
          // Redirect directly to "المتصلون الآن" upon success
          setCurrentTab('online');
        }}
      />
    );
  }

  const handleStartChatWithUser = async (targetUserId: string) => {
    // If we're on the "online" tab, open chat directly in the side panel instead of navigating away!
    if (currentTab === 'online') {
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
          return;
        }
      } catch (e) {
        console.error('Failed to load profile for side panel chat', e);
      }
    }

    setChatRecipientId(targetUserId);
    setCurrentTab('messages');
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
            <div className="hidden lg:grid lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 xl:col-span-8 space-y-4">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-tajawal bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-800">
                  <span>المحادثة مفتوحة بجانب قائمة المتصلين</span>
                  <button
                    onClick={() => setOnlineChatTargetUser(null)}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold transition-colors cursor-pointer"
                  >
                    إغلاق المحادثة الجانبية ✕
                  </button>
                </div>
                <OnlineUsersPage
                  onOpenProfile={(id) => setSelectedProfileId(id)}
                  onStartChat={(targetUser) => setOnlineChatTargetUser(targetUser)}
                  activeChatUserId={onlineChatTargetUser.id}
                  compactGrid={true}
                />
              </div>

              {/* Chat Side Panel on Desktop */}
              <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
                <OnlineChatPanel
                  targetUser={onlineChatTargetUser}
                  onClose={() => setOnlineChatTargetUser(null)}
                  onOpenProfile={(id) => setSelectedProfileId(id)}
                  isMobileModal={false}
                />
              </div>
            </div>

            {/* Small Screens / Mobile: Fullscreen Overlay with Back Button */}
            <div className="block lg:hidden">
              <OnlineChatPanel
                targetUser={onlineChatTargetUser}
                onClose={() => setOnlineChatTargetUser(null)}
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
      {currentTab === 'missions' && <MissionsPage />}
      {currentTab === 'achievements' && <AchievementsPage />}
      {currentTab === 'levels' && (
        <LevelsPage onOpenProfile={(id) => setSelectedProfileId(id)} />
      )}
      {currentTab === 'wallet' && <WalletPage />}
      {currentTab === 'games' && <GamesPage />}
      {currentTab === 'shop' && <ShopPage />}
      {currentTab === 'settings' && <SettingsPage />}
      {currentTab === 'admin' && <AdminPage />}

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
