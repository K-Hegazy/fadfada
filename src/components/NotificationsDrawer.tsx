import React from 'react';
import { Bell, CheckCheck, X } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { formatArabicTime } from '../utils/formatters';
import { EmptyState } from './ui/Primitives';

export const NotificationsDrawer: React.FC = () => {
  const {
    notifications,
    unreadNotificationsCount,
    notificationsOpen,
    setNotificationsOpen,
    markNotificationsRead,
  } = useApp();

  if (!notificationsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs">
      <div className="w-full max-w-md h-full bg-white dark:bg-[#121B20] border-r border-slate-200/80 dark:border-white/10 flex flex-col shadow-2xl fadfada-enter">
        <div className="px-4 py-3 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                الإشعارات
              </h2>
              <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {unreadNotificationsCount > 0 ? `${unreadNotificationsCount} غير مقروء` : 'جميعها مقروءة'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadNotificationsCount > 0 && (
              <button
                type="button"
                onClick={() => void markNotificationsRead()}
                className="min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399] hover:bg-[#E6F4F0] dark:hover:bg-[#14332C] inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تحديد الكل كمقروء</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              aria-label="إغلاق الإشعارات"
              className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto fadfada-scroll divide-y divide-slate-200/70 dark:divide-white/8">
          {notifications.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<Bell className="w-5 h-5" />}
                title="لا توجد إشعارات حتى الآن"
                description="ستظهر هنا تنبيهات الرسائل، الهدايا، وطلبات الصداقة والزواج فور وصولها."
              />
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`px-4 py-3 transition-colors ${
                  n.isRead ? '' : 'bg-[#E6F4F0]/55 dark:bg-[#14332C]/55'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-[#0B7A62] dark:bg-[#34D399] shrink-0" />
                    )}
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {n.title}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                    {formatArabicTime(n.createdAt)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {n.body}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
