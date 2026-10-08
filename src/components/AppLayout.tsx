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
  const [userMenuOpen, setUserMenuOpen] = useState(false);

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
    <div
      className={`bg-[#07090e] text-neutral-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300 ${
        currentTab === 'online'
          ? 'h-screen max-h-screen overflow-hidden'
          : 'min-h-screen md:h-screen md:max-h-screen md:overflow-hidden'
      }`}
      dir="rtl"
    >
      {/* Top Header */}
      <header className="h-14 sm:h-16 shrink-0 border-b border-neutral-800/80 bg-[#090b10]/95 backdrop-blur-md z-40 px-2.5 sm:px-6 flex items-center justify-between shadow-lg">
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

        {/* Simplified Clean Header: Logo, Assistant Button, User Account */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Fadfada Assistant Button */}
          <button
            onClick={onOpenAssistant}
            className="flex px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-600/25 transition-all cursor-pointer items-center gap-1.5 text-xs font-bold active:scale-95"
            title="مساعد فضفضه الذكي"
          >
            <Bot className="w-4 h-4 text-emerald-100" />
            <span className="font-cairo">مساعد فضفضه</span>
          </button>

          {/* User Account Trigger & Menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(prev => !prev)}
              className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 transition-colors cursor-pointer select-none active:scale-95"
              title="قائمة الحساب"
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-cairo font-bold text-xs border shrink-0 ${
                  user?.gender === 'female'
                    ? 'bg-rose-950 text-rose-300 border-rose-700'
                    : 'bg-sky-950 text-sky-300 border-sky-700'
                }`}
              >
                {user?.username ? user.username.slice(0, 1).toUpperCase() : '👤'}
              </div>
              <div className="hidden sm:flex flex-col text-right leading-tight min-w-0 pr-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-white truncate max-w-[110px] font-cairo">
                    {user?.username}
                  </span>
                  {isUserOwner(user) && <OwnerBadge size="xs" />}
                </div>
                <span className="text-[10px] text-neutral-400 font-tajawal">{user?.country || 'عضو'}</span>
              </div>
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute left-0 top-full mt-2 w-48 bg-[#0d1017] border border-neutral-800 rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in space-y-1">
                  <div className="px-3 py-2 border-b border-neutral-850">
                    <div className="text-xs font-bold text-white truncate">{user?.username}</div>
                    <div className="text-[10px] text-emerald-400 font-tajawal">حساب نشط</div>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      onNavigate('settings');
                    }}
                    className="w-full px-3 py-2 rounded-xl text-right text-xs font-bold text-neutral-300 hover:text-white hover:bg-neutral-800/80 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-neutral-400" />
                    <span>الإعدادات والملف الشخصي</span>
                  </button>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      logout();
                    }}
                    className="w-full px-3 py-2 rounded-xl text-right text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout Body */}
      <div className="flex-1 min-h-0 flex max-w-[1800px] w-full mx-auto overflow-hidden">
        {/* Desktop Fixed Stationary Sidebar */}
        <aside className="w-64 shrink-0 border-l border-neutral-800/80 p-3.5 hidden md:flex flex-col justify-between bg-[#080a10] h-full overflow-hidden z-30">
          {/* Scrollable Navigation Groups */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 space-y-3.5 custom-scrollbar">
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
        <main
          className={`flex-1 min-h-0 h-full max-w-full flex flex-col ${
            currentTab === 'online'
              ? 'overflow-hidden p-2 sm:p-3 md:p-3.5 pb-20 md:pb-3.5'
              : 'overflow-y-auto p-3 sm:p-5 lg:p-6 pb-20 md:pb-6 justify-between custom-scrollbar'
          }`}
        >
          <div className={`w-full max-w-full ${currentTab === 'online' ? 'h-full min-h-0 flex-1 flex flex-col overflow-hidden' : ''}`}>
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden h-16 shrink-0 border-t border-neutral-800/80 bg-[#090b10]/95 backdrop-blur-md sticky bottom-0 z-40 px-1 flex items-center justify-around pb-safe shadow-[0_-4px_25px_rgba(0,0,0,0.6)]">
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
