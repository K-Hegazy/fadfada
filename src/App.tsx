import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Ban,
  Bell,
  MailCheck,
  MessageSquare,
  Moon,
  Sun,
  X,
} from 'lucide-react';
import { submitAppeal } from './services/economy';
import { AdSlot } from './components/AdSlot';
import { AdminPanelView } from './components/AdminPanelView';
import { AuthScreen } from './components/AuthScreen';
import { Avatar } from './components/Avatar';
import { ChatPanel } from './components/ChatPanel';
import { CreatorsView } from './components/CreatorsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LeaderboardView } from './components/LeaderboardView';
import { MegaphoneBar } from './components/MegaphoneBar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { NotificationsDrawer } from './components/NotificationsDrawer';
import { OnlineDirectoryView } from './components/OnlineDirectoryView';
import { ProfilePanel } from './components/ProfilePanel';
import { RandomMatchView } from './components/RandomMatchView';
import { RoomsView } from './components/RoomsView';
import { SecretsView } from './components/SecretsView';
import { Sidebar } from './components/Sidebar';
import { SocialHubView } from './components/SocialHubView';
import { StoreView } from './components/StoreView';
import { TasksView } from './components/TasksView';
import { UserProfileModal } from './components/UserProfileModal';
import { WallView } from './components/WallView';
import { CoinWalletChip } from './components/ui/Primitives';
import { AppProvider, useApp } from './state/AppContext';
import type { ActiveNavSection } from './types/fadfada';

const FadfadaShell: React.FC = () => {
  const {
    authReady,
    authUser,
    profile,
    isGuest,
    isStaff,
    activeSection,
    setActiveSection,
    activePeerId,
    closeActiveChat,
    siteSettings,
    runtimeError,
    clearRuntimeError,
    toastNotification,
    dismissToast,
    unreadNotificationsCount,
    setNotificationsOpen,
    totalUnreadCount,
    theme,
    toggleTheme,
    sendVerifyEmail,
    logout,
  } = useApp();

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [appealSent, setAppealSent] = useState(false);
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!toastNotification) return;
    const t = window.setTimeout(() => dismissToast(), 5000);
    return () => window.clearTimeout(t);
  }, [toastNotification, dismissToast]);

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F4F7] dark:bg-[#0B1114]">
        <div className="text-center space-y-2.5 fadfada-enter">
          <div className="w-11 h-11 rounded-xl bg-[#0B7A62] text-white font-display text-xl font-bold flex items-center justify-center mx-auto">
            ف
          </div>
          <div>
            <p className="font-display text-xl font-bold text-[#0B7A62] dark:text-[#34D399]">
              فضفضة
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              جاري دخول المجتمع...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthScreen />;
  }

  // Banned User Gate (non-staff only)
  if (profile?.isBanned && !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F4F7] dark:bg-[#0B1114] p-4">
        <div className="w-full max-w-md p-5 rounded-2xl bg-white dark:bg-[#121B20] border border-rose-200 dark:border-rose-900/70 space-y-4 shadow-sm fadfada-modal-in">
          <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold">تم تقييد هذا الحساب مؤقتًا</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                يمكنك تقديم التماس لمراجعة القرار من الإدارة
              </p>
            </div>
          </div>
          <p className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1114] text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            سبب التقييد: <strong>{profile.banReason || 'مخالفة شروط الاستخدام'}</strong>
          </p>

          {appealSent ? (
            <p className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300">
              تم إرسال التماس فك الحظر بنجاح وسيتم مراجعته من الإدارة.
            </p>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!appealText.trim() || appealSubmitting) return;
                setAppealError(null);
                setAppealSubmitting(true);
                try {
                  await submitAppeal(profile, appealText);
                  setAppealSent(true);
                } catch (err) {
                  setAppealError(err instanceof Error ? err.message : 'تعذر إرسال الالتماس.');
                } finally {
                  setAppealSubmitting(false);
                }
              }}
              className="space-y-3"
            >
              <textarea
                rows={3}
                required
                value={appealText}
                onChange={(e) => setAppealText(e.target.value)}
                placeholder="اكتب التماسًا لمراجعة قرار الحظر..."
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1114] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
              />
              {appealError && <p className="text-xs text-rose-600">{appealError}</p>}
              <button
                type="submit"
                disabled={appealSubmitting}
                className="w-full min-h-[42px] rounded-xl bg-[#0B7A62] hover:bg-[#08634F] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
              >
                {appealSubmitting ? 'جاري الإرسال...' : 'إرسال التماس للإدارة'}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => void logout()}
            className="w-full min-h-[40px] rounded-xl border border-slate-200 dark:border-white/10 text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#18242B] cursor-pointer"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  const showMobileSidebar = activeSection === 'chats' && !activePeerId;
  const inMobileActiveChat = activeSection === 'chats' && Boolean(activePeerId);

  const handleTopNav = (section: ActiveNavSection) => {
    if (section !== 'chats') closeActiveChat();
    setActiveSection(section);
  };

  const renderMainView = () => {
    switch (activeSection) {
      case 'online':
        return <OnlineDirectoryView />;
      case 'rooms':
        return <RoomsView />;
      case 'wall':
        return <WallView />;
      case 'random_match':
        return <RandomMatchView />;
      case 'secrets':
        return <SecretsView />;
      case 'creators':
        return <CreatorsView />;
      case 'store':
        return <StoreView />;
      case 'tasks':
        return <TasksView />;
      case 'leaderboards':
        return <LeaderboardView />;
      case 'social':
        return <SocialHubView />;
      case 'settings':
        return <ProfilePanel />;
      case 'admin':
        return <AdminPanelView />;
      case 'chats':
      default:
        return <ChatPanel />;
    }
  };

  return (
    <div className="h-dvh w-full flex flex-col bg-[#F2F4F7] dark:bg-[#0B1114] text-[#0F172A] dark:text-[#F1F5F9] overflow-hidden">
      {/* 3-Zone RTL Community Header */}
      {!inMobileActiveChat && (
        <header className="h-12 px-3 sm:px-5 bg-white dark:bg-[#121B20] border-b border-slate-200/90 dark:border-white/10 shrink-0 z-30">
          <div className="max-w-[1440px] h-full mx-auto grid grid-cols-3 items-center gap-2">
            {/* Zone 1 (Right / start in RTL): Notifications + Theme Toggle (+ Wallet for Members / Guest tag) */}
            <div className="flex items-center justify-start gap-1 sm:gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                aria-label="الإشعارات"
                title="الإشعارات"
                className="relative min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18242B] transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-0.5 left-0.5 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-mono tabular-nums flex items-center justify-center">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
                title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
                className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18242B] transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {profile && (
                isGuest ? (
                  <button
                    type="button"
                    onClick={() => handleTopNav('settings')}
                    className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#18242B] text-slate-600 dark:text-slate-300 text-[11px] font-semibold cursor-pointer hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]"
                  >
                    ضيف
                  </button>
                ) : (
                  <div className="hidden sm:flex items-center">
                    <CoinWalletChip coins={profile.coins} onClick={() => handleTopNav('store')} />
                  </div>
                )
              )}
            </div>

            {/* Zone 2 (Center): Dynamic Site Logo + Brand Name */}
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={() => handleTopNav('wall')}
                className="inline-flex items-center gap-2 font-display text-base sm:text-lg font-bold tracking-tight text-[#0B7A62] dark:text-[#34D399] whitespace-nowrap cursor-pointer"
              >
                {siteSettings.siteLogoUrl ? (
                  <img
                    src={siteSettings.siteLogoUrl}
                    alt="شعار فضفضة"
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-lg object-cover border border-slate-200/80 dark:border-white/10"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-lg bg-[#0B7A62] text-white flex items-center justify-center text-sm font-bold">
                    ف
                  </span>
                )}
                <span>فضفضة</span>
              </button>
            </div>

            {/* Zone 3 (Left / end in RTL): Private Messages Badge + Profile Avatar */}
            <div className="flex items-center justify-end gap-1 sm:gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => handleTopNav('chats')}
                aria-label="الرسائل الخاصة"
                title="الرسائل الخاصة"
                className={`relative min-h-[36px] min-w-[36px] px-2 flex items-center justify-center gap-1 rounded-lg transition-colors cursor-pointer ${
                  activeSection === 'chats'
                    ? 'bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18242B]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-semibold">الرسائل</span>
                {totalUnreadCount > 0 && (
                  <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono tabular-nums flex items-center justify-center">
                    {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                  </span>
                )}
              </button>

              {profile && (
                <button
                  type="button"
                  onClick={() => handleTopNav('settings')}
                  aria-label="الحساب"
                  className="min-h-[36px] px-1 flex items-center gap-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer"
                >
                  <Avatar
                    src={profile.avatar}
                    name={profile.displayName}
                    size="xs"
                    frameId={profile.frameId}
                  />
                  <span className="hidden lg:inline text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[96px] truncate">
                    {profile.displayName}
                  </span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {runtimeError && (
        <div
          role="alert"
          className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/60 border-b border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{runtimeError.message}</span>
          </div>
          <button
            type="button"
            onClick={clearRuntimeError}
            aria-label="إغلاق التنبيه"
            className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {authUser.email && !authUser.emailVerified && !authUser.isAnonymous && (
        <div className="hidden md:flex px-5 py-1 bg-amber-50/70 dark:bg-[#151F24] border-b border-slate-200/80 dark:border-white/10 text-[11px] items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <MailCheck className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
            <span>يرجى تأكيد بريدك الإلكتروني ({authUser.email}) لتفعيل كامل الأمان.</span>
            {verifyError && <span className="text-rose-600 font-medium">{verifyError}</span>}
          </div>
          <button
            type="button"
            disabled={verifySent}
            onClick={async () => {
              setVerifyError(null);
              try {
                await sendVerifyEmail();
                setVerifySent(true);
              } catch (err) {
                setVerifyError(err instanceof Error ? err.message : 'تعذر إرسال رابط التوثيق.');
              }
            }}
            className="text-[#0B7A62] dark:text-[#34D399] font-semibold cursor-pointer"
          >
            {verifySent ? 'تم الإرسال' : 'إعادة إرسال الرابط'}
          </button>
        </div>
      )}

      {/* Desktop Megaphone Shoutouts Bar */}
      <div className="hidden md:block shrink-0">
        <MegaphoneBar />
      </div>

      {/* Desktop Header Banner Ad Slot */}
      {siteSettings.ads?.header_banner?.enabled && siteSettings.ads.header_banner.title && (
        <div className="hidden md:block px-4 pt-2 max-w-[1440px] w-full mx-auto shrink-0">
          <AdSlot slot="header_banner" />
        </div>
      )}

      {/* Full-Bleed Chat Portal Shell */}
      <div className="flex-1 flex min-h-0 w-full max-w-[1440px] mx-auto bg-[#F2F4F7] dark:bg-[#0B1114] md:border-x md:border-slate-200/80 md:dark:border-white/10">
        <div
          className={`${showMobileSidebar ? 'flex' : 'hidden md:flex'} w-full md:w-auto h-full`}
        >
          <Sidebar />
        </div>

        <main
          className={`${
            showMobileSidebar ? 'hidden md:flex' : 'flex'
          } flex-1 min-w-0 h-full bg-[#F2F4F7] dark:bg-[#0B1114]`}
        >
          {renderMainView()}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      {!inMobileActiveChat && <MobileBottomNav />}

      {/* Drawers & Modals */}
      <NotificationsDrawer />
      <UserProfileModal />

      {/* Welcome Popup from SiteSettings */}
      {siteSettings.welcomePopupEnabled && !welcomeDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#121B20] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-3.5 shadow-xl fadfada-modal-in">
            <h3 className="font-display text-base font-bold text-[#0B7A62] dark:text-[#34D399]">
              {siteSettings.welcomePopupTitle}
            </h3>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
              {siteSettings.welcomePopupBody}
            </p>
            <button
              type="button"
              onClick={() => setWelcomeDismissed(true)}
              className="w-full min-h-[42px] rounded-xl bg-[#0B7A62] hover:bg-[#08634F] text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              دخول المنصة
            </button>
          </div>
        </div>
      )}

      {/* Visual Notification Toast */}
      {toastNotification && profile?.privacy?.visualNotifications !== false && (
        <div className="fixed top-14 left-3 z-50 max-w-sm p-3 rounded-xl bg-white dark:bg-[#18242B] border border-[#0B7A62]/30 shadow-lg flex items-start gap-2.5 fadfada-enter">
          <span className="w-7 h-7 rounded-lg bg-[#E6F4F0] dark:bg-[#132E28] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </span>
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-bold text-slate-900 dark:text-slate-50">{toastNotification.title}</p>
            <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
              {toastNotification.body}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissToast}
            aria-label="إغلاق"
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <FadfadaShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
