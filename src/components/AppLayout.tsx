import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquareHeart,
  Users,
  Compass,
  MessageCircle,
  UserPlus,
  Sparkles,
  Target,
  Award,
  Trophy,
  Dices,
  Coins,
  ShoppingBag,
  Settings,
  ShieldAlert,
  LogOut,
  Flame,
  Crown,
  Menu,
  X,
  Bot,
  Calendar,
  Newspaper,
  Shuffle
} from 'lucide-react';
import { OwnerBadge, isUserOwner } from './OwnerBadge';

interface AppLayoutProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onOpenAssistant: () => void;
  children: React.ReactNode;
}

interface NavItem {
  key: string;
  label: string;
  icon: any;
  badge?: number | null;
  memberOnly?: boolean;
  adminOnly?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onNavigate,
  onOpenAssistant,
  children
}) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isModeratorOrAbove = user?.role === 'moderator' || user?.role === 'admin' || user?.role === 'owner';

  // Grouped Navigation Sections: Logical categories, compact spacing, unified icons
  const NAV_SECTIONS: NavSection[] = [
    {
      title: 'المجتمع والتواصل',
      items: [
        { key: 'online', label: 'المتواجدون حالياً', icon: Users },
        { key: 'rooms', label: 'الغرف والمجالس', icon: Compass },
        { key: 'events', label: 'الفعاليات', icon: Calendar },
        { key: 'news', label: 'المنشورات والأخبار', icon: Newspaper },
      ]
    },
    {
      title: 'المحادثات والعلاقات',
      items: [
        { key: 'random_chat', label: 'تواصل عشوائي', icon: Shuffle },
        { key: 'messages', label: 'الرسائل', icon: MessageCircle, badge: user?.unreadMessages },
        { key: 'friends', label: 'الأصدقاء', icon: UserPlus, badge: user?.pendingFriendRequests },
        { key: 'stories', label: 'القصص (24h)', icon: Sparkles },
      ]
    },
    {
      title: 'المميزات والمكافآت',
      items: [
        { key: 'shop', label: 'متجر الشارات', icon: ShoppingBag },
        { key: 'missions', label: 'المهام اليومية', icon: Target, memberOnly: true },
        { key: 'levels', label: 'المستويات والشرف', icon: Trophy, memberOnly: true },
        { key: 'games', label: 'الألعاب والمسابقات', icon: Dices },
        { key: 'wallet', label: 'المحفظة وVIP', icon: Coins, memberOnly: true },
      ]
    },
    {
      title: 'الإعدادات والرقابة',
      items: [
        { key: 'settings', label: 'الإعدادات والخصوصية', icon: Settings },
        ...(isModeratorOrAbove ? [{ key: 'admin', label: 'لوحة الإدارة والرقابة', icon: ShieldAlert, adminOnly: true }] : [])
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#07090e] text-neutral-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Header */}
      <header className="h-15 sm:h-16 border-b border-neutral-800/80 bg-[#090b10]/95 backdrop-blur-md sticky top-0 z-40 px-2.5 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-neutral-900 text-neutral-300 hover:text-white cursor-pointer active:scale-95 transition-transform"
            aria-label="القائمة الجانبية"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div
            onClick={() => onNavigate('online')}
            className="flex items-center gap-1.5 sm:gap-2.5 cursor-pointer select-none"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <MessageSquareHeart className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-cairo font-black text-lg sm:text-xl text-white">فضفضه</span>
              <span className="hidden min-[380px]:inline-block text-[9px] sm:text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/50">
                Fadfada
              </span>
            </div>
          </div>
        </div>

        {/* Header Badges & Quick Tools */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Guest message notice */}
          {user?.isGuest && (
            <div className="flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-xl bg-amber-950/60 border border-amber-800/50 text-amber-300 text-[10px] sm:text-xs font-semibold max-w-[130px] sm:max-w-none truncate">
              <span className="truncate">زائر (باقي {user.guestMessagesRemaining})</span>
            </div>
          )}

          {/* Gamification indicators - only for registered members */}
          {!user?.isGuest && (
            <>
              {/* Streak */}
              <div
                onClick={() => onNavigate('levels')}
                className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl bg-amber-950/40 border border-amber-800/40 text-amber-300 text-[11px] sm:text-xs font-bold cursor-pointer hover:bg-amber-950/60 transition-colors"
                title="شعلة تسجيل الدخول اليومي"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{user?.streak || 1} <span className="hidden min-[350px]:inline">يوم</span></span>
              </div>

              {/* Coins */}
              <div
                onClick={() => onNavigate('wallet')}
                className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] sm:text-xs font-bold cursor-pointer hover:bg-amber-500/20 transition-colors"
                title="رصيد الكوينز"
              >
                <Coins className="w-3.5 h-3.5 shrink-0" />
                <span>{user?.coins || 0}</span>
              </div>

              {/* Level - visible on tablets and desktop */}
              <div
                onClick={() => onNavigate('levels')}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-950/50 border border-emerald-800/40 text-emerald-300 text-xs font-bold cursor-pointer"
              >
                <span>مستوى {user?.level || 1}</span>
              </div>
            </>
          )}

          {/* Fadfada Assistant Quick Launch - desktop/tablet (on mobile it's in bottom nav) */}
          <button
            onClick={onOpenAssistant}
            className="hidden sm:flex p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer items-center gap-1.5 text-xs font-bold"
            title="مساعد فضفضه الذكي"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden lg:inline">مساعد فضفضه</span>
          </button>

          {/* User Profile avatar trigger */}
          <div
            onClick={() => onNavigate('settings')}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer"
            title="الملف الشخصي والإعدادات"
          >
            {isUserOwner(user) && <OwnerBadge size="xs" />}
            <div
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-cairo font-bold text-xs border shrink-0 transition-transform active:scale-95 ${
                user?.gender === 'female'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-700'
                  : 'bg-sky-950/80 text-sky-300 border-sky-700'
              }`}
            >
              {user?.username ? user.username.slice(0, 1).toUpperCase() : '👤'}
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        {/* Desktop Fixed Stationary Sidebar */}
        <aside className="w-64 shrink-0 border-l border-neutral-800/80 p-3.5 hidden md:flex flex-col justify-between bg-[#080a10] sticky top-15 sm:top-16 h-[calc(100vh-3.75rem)] sm:h-[calc(100vh-4rem)] overflow-y-auto z-30">
          {/* Scrollable Navigation Groups */}
          <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-3.5">
            {NAV_SECTIONS.map((sec, secIdx) => {
              const visibleItems = sec.items.filter(item => !user?.isGuest || !item.memberOnly);
              if (visibleItems.length === 0) return null;

              return (
                <div key={sec.title || secIdx} className="space-y-1">
                  <div className="text-[10px] font-bold text-neutral-500 font-tajawal uppercase tracking-wider px-2.5 pb-0.5 select-none">
                    {sec.title}
                  </div>
                  <div className="space-y-0.5">
                    {visibleItems.map(item => {
                      const Icon = item.icon;
                      const isActive = currentTab === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => onNavigate(item.key)}
                          className={`w-full px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer group active:scale-98 ${
                            isActive
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                              : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 truncate">
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive ? 'text-white' : 'text-neutral-400 group-hover:text-emerald-400'
                              }`}
                            />
                            <span className="truncate">{item.label}</span>
                          </div>

                          {/* Unread & Action Badges */}
                          {item.badge && item.badge > 0 ? (
                            <span
                              className={`min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                item.key === 'messages'
                                  ? 'bg-emerald-500 text-neutral-950 font-black shadow-sm shadow-emerald-500/40 animate-pulse'
                                  : 'bg-teal-600 text-white shadow-sm'
                              }`}
                            >
                              {item.badge > 99 ? '+99' : item.badge}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* User info & Logout */}
          <div className="pt-3 mt-2 border-t border-neutral-900 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    user?.gender === 'female' ? 'bg-rose-950 text-rose-300' : 'bg-sky-950 text-sky-300'
                  }`}
                >
                  {user?.username.slice(0, 1).toUpperCase()}
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate max-w-[100px]">{user?.username}</span>
                    {isUserOwner(user) && <OwnerBadge size="xs" />}
                  </div>
                  <div className="text-[10px] text-neutral-500 font-tajawal">📍 {user?.country}</div>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-neutral-900 cursor-pointer transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile Drawer with Grouped Sections */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/80 backdrop-blur-sm flex flex-col justify-between p-5 animate-in fade-in">
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <MessageSquareHeart className="w-6 h-6 text-emerald-400" />
                  <span className="font-cairo font-bold text-lg text-white">أقسام فضفضه</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 -mr-1">
                {NAV_SECTIONS.map((sec, secIdx) => {
                  const visibleItems = sec.items.filter(item => !user?.isGuest || !item.memberOnly);
                  if (visibleItems.length === 0) return null;

                  return (
                    <div key={sec.title || secIdx} className="space-y-1">
                      <div className="text-[10px] font-bold text-neutral-500 font-tajawal uppercase tracking-wider px-2 select-none">
                        {sec.title}
                      </div>
                      <div className="space-y-1">
                        {visibleItems.map(item => {
                          const Icon = item.icon;
                          const isActive = currentTab === item.key;
                          return (
                            <button
                              key={item.key}
                              onClick={() => {
                                onNavigate(item.key);
                                setMobileMenuOpen(false);
                              }}
                              className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-bold transition-all cursor-pointer ${
                                isActive ? 'bg-emerald-600 text-white shadow-md' : 'text-neutral-300 hover:bg-neutral-900'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Icon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </div>
                              {item.badge && item.badge > 0 ? (
                                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-neutral-950 font-black text-[10px] flex items-center justify-center animate-pulse">
                                  {item.badge > 99 ? '+99' : item.badge}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full py-3 rounded-xl bg-neutral-900 hover:bg-rose-950 text-rose-400 font-bold text-xs border border-neutral-800 flex items-center justify-center gap-2 cursor-pointer mt-3 shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 overflow-y-auto max-w-full flex flex-col justify-between pb-20 md:pb-6">
          <div className="w-full max-w-full">{children}</div>

          {/* Platform Footer */}
          <footer className="mt-10 sm:mt-12 pt-6 pb-4 border-t border-neutral-800/60 text-center text-xs text-neutral-500 font-tajawal space-y-2.5">
            <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-[11px] text-neutral-400">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_legal_modal', { detail: { tab: 'terms' } }))}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                شروط الاستخدام
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_legal_modal', { detail: { tab: 'privacy' } }))}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                سياسة الخصوصية
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_legal_modal', { detail: { tab: 'community' } }))}
                className="hover:text-emerald-400 transition-colors cursor-pointer"
              >
                إرشادات المجتمع
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open_legal_modal', { detail: { tab: 'age18' } }))}
                className="hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
              >
                <span className="px-1 py-0.5 bg-amber-950 text-amber-300 rounded border border-amber-800/60 text-[9px] font-bold">18+</span>
                سياسة الفئات العمرية
              </button>
            </div>
            <p className="text-[10px] text-neutral-600">
              منصة فضفضه (Fadfada) © {new Date().getFullYear()} - ملتقى الحوار العربي الراقي والآمن
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden h-16 border-t border-neutral-800/80 bg-[#090b10]/95 backdrop-blur-md sticky bottom-0 z-40 px-1 flex items-center justify-around pb-safe shadow-[0_-4px_25px_rgba(0,0,0,0.6)]">
        <button
          onClick={() => onNavigate('online')}
          className={`flex flex-col items-center justify-center min-w-[50px] py-1 cursor-pointer transition-all active:scale-90 ${
            currentTab === 'online' ? 'text-emerald-400 font-bold scale-105' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-tajawal mt-0.5">المتواجدون</span>
        </button>

        <button
          onClick={() => onNavigate('rooms')}
          className={`flex flex-col items-center justify-center min-w-[50px] py-1 cursor-pointer transition-all active:scale-90 ${
            currentTab === 'rooms' ? 'text-teal-400 font-bold scale-105' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-tajawal mt-0.5">المجالس</span>
        </button>

        <button
          onClick={() => onNavigate('messages')}
          className={`flex flex-col items-center justify-center min-w-[50px] py-1 relative cursor-pointer transition-all active:scale-90 ${
            currentTab === 'messages' ? 'text-emerald-400 font-bold scale-105' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="text-[10px] font-tajawal mt-0.5">الرسائل</span>
          {user?.unreadMessages && user.unreadMessages > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-neutral-950 text-[9px] flex items-center justify-center font-black shadow-md shadow-emerald-500/50 animate-pulse">
              {user.unreadMessages > 99 ? '+99' : user.unreadMessages}
            </span>
          ) : null}
        </button>

        <button
          onClick={() => onNavigate('friends')}
          className={`flex flex-col items-center justify-center min-w-[50px] py-1 relative cursor-pointer transition-all active:scale-90 ${
            currentTab === 'friends' ? 'text-emerald-400 font-bold scale-105' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          <UserPlus className="w-5 h-5" />
          <span className="text-[10px] font-tajawal mt-0.5">الأصدقاء</span>
          {user?.pendingFriendRequests && user.pendingFriendRequests > 0 ? (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-teal-600 text-white text-[9px] flex items-center justify-center font-bold">
              {user.pendingFriendRequests}
            </span>
          ) : null}
        </button>

        <button
          onClick={onOpenAssistant}
          className="flex flex-col items-center justify-center min-w-[50px] py-1 text-emerald-400 hover:text-emerald-300 cursor-pointer transition-transform active:scale-90"
        >
          <Bot className="w-5 h-5" />
          <span className="text-[10px] font-tajawal mt-0.5">مساعد فضفضه</span>
        </button>
      </nav>
    </div>
  );
};
