import React, { useMemo, useState } from 'react';
import {
  DoorOpen,
  EyeOff,
  Flame,
  Gift,
  HeartHandshake,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  Shield,
  ShoppingBag,
  Shuffle,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../state/AppContext';
import type { ActiveNavSection } from '../types/fadfada';

export const MobileBottomNav: React.FC = () => {
  const {
    activeSection,
    setActiveSection,
    totalUnreadCount,
    users,
    isPeerOnline,
    closeActiveChat,
    isStaff,
    logout,
  } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);

  const onlineCount = useMemo(
    () => users.filter((u) => isPeerOnline(u, isStaff)).length,
    [users, isPeerOnline, isStaff]
  );

  const handleSelect = (section: ActiveNavSection) => {
    closeActiveChat();
    setActiveSection(section);
    setMoreOpen(false);
  };

  const extraSections: Array<{
    id: ActiveNavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'store', label: 'المتجر', icon: ShoppingBag },
    { id: 'tasks', label: 'المهام اليومية', icon: Gift },
    { id: 'secrets', label: 'الأسرار', icon: EyeOff },
    { id: 'social', label: 'الزواج والأصدقاء', icon: HeartHandshake },
    { id: 'random_match', label: 'التواصل العشوائي', icon: Shuffle },
    { id: 'leaderboards', label: 'المتصدرون', icon: Trophy },
    { id: 'creators', label: 'المبدعون', icon: Sparkles },
    { id: 'settings', label: 'الحساب', icon: Settings },
    ...(isStaff ? [{ id: 'admin' as const, label: 'الإدارة', icon: Shield }] : []),
  ];

  const primaryTabs: Array<{
    id: ActiveNavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'wall', label: 'الرئيسية', icon: Flame },
    { id: 'online', label: 'المتواجدون', icon: Users, badge: onlineCount },
    { id: 'rooms', label: 'الغرف', icon: DoorOpen },
    { id: 'chats', label: 'الرسائل', icon: MessageSquare, badge: totalUnreadCount },
  ];

  const isExtraActive = extraSections.some((s) => s.id === activeSection);

  return (
    <>
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end"
          onClick={() => setMoreOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white dark:bg-[#121B20] rounded-t-2xl border-t border-slate-200 dark:border-white/10 p-4 pt-2.5 space-y-3 max-h-[82vh] overflow-y-auto fadfada-sheet-in"
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto" />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                أقسام فضفضة
              </h3>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="إغلاق"
                className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pb-1">
              {extraSections.map((sec) => {
                const Icon = sec.icon;
                const active = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => handleSelect(sec.id)}
                    className={`min-h-[44px] px-3 py-2 rounded-xl border flex items-center gap-2 text-xs font-semibold text-right transition-colors active:scale-[0.98] cursor-pointer ${
                      active
                        ? 'border-[#0B7A62] bg-[#E6F4F0] dark:bg-[#132E28] text-[#0B7A62] dark:text-[#34D399]'
                        : 'border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-[#18242B] text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{sec.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  void logout();
                }}
                className="col-span-2 min-h-[44px] px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="التنقل الرئيسي"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-[#121B20]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-white/10 grid grid-cols-5 items-center"
      >
        {primaryTabs.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex flex-col items-center justify-center min-h-[46px] gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                active
                  ? 'text-[#0B7A62] dark:text-[#34D399]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-[18px] h-[18px]" />
                {item.badge && item.badge > 0 ? (
                  <span
                    className={`absolute -top-1.5 -left-2.5 min-w-[15px] h-[15px] px-1 rounded-full text-white text-[9px] font-mono tabular-nums flex items-center justify-center ${
                      item.id === 'online' ? 'bg-emerald-600' : 'bg-rose-600'
                    }`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </div>
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={`flex flex-col items-center justify-center min-h-[46px] gap-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
            isExtraActive || moreOpen
              ? 'text-[#0B7A62] dark:text-[#34D399]'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Menu className="w-[18px] h-[18px]" />
          <span className="whitespace-nowrap">المزيد</span>
        </button>
      </nav>
    </>
  );
};
