import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import { playNotificationSound, SoundType } from '../services/sound';
import { MessageSquare, Gift, UserPlus, X, Bell } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'message' | 'gift' | 'friend_request' | 'general';
  title: string;
  body: string;
  avatarUrl?: string;
  senderId?: string;
  linkTab?: string;
  data?: any;
}

export const LiveToastContainer: React.FC = () => {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Get user sound preferences
  const soundPref = (user?.notificationSound || localStorage.getItem('fadfada_sound') || 'chime') as SoundType;
  const soundEnabled = user?.soundEnabled !== undefined ? user.soundEnabled : (localStorage.getItem('fadfada_sound_enabled') !== 'false');

  const addToast = (toast: Omit<ToastItem, 'id'>) => {
    const id = 'tst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newToast: ToastItem = { ...toast, id };

    setToasts(prev => [newToast, ...prev.slice(0, 3)]); // Keep at most 4 toasts visible

    // Play customizable live notification sound
    playNotificationSound(soundPref, soundEnabled);

    // Auto dismiss after 6 seconds
    setTimeout(() => {
      removeToast(id);
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    // Listen to custom window toast events
    const handleCustomToast = (e: any) => {
      if (e.detail) {
        addToast(e.detail);
      }
    };
    window.addEventListener('fadfada-toast', handleCustomToast);

    // Listen to WebSocket events
    const unbindMessage = socketService.on('private_message', (data: any) => {
      // Don't show toast if message is sent by current user or marked silent (muted)
      if (data && data.senderId !== user?.id && !data.silent) {
        addToast({
          type: 'message',
          title: `رسالة جديدة من ${data.senderName || 'صديق'} 💬`,
          body: data.type === 'image' ? '📷 أرسل صورة' : (data.content || 'رسالة جديدة'),
          avatarUrl: data.senderAvatar,
          senderId: data.senderId,
          linkTab: 'messages'
        });
      }
    });

    const unbindToastNew = socketService.on('toast:new', (data: any) => {
      if (data?.toast && !data.silent) {
        addToast({
          type: data.toast.type || 'message',
          title: data.toast.title || 'إشعار جديد',
          body: data.toast.body || '',
          avatarUrl: data.toast.avatarUrl,
          senderId: data.toast.senderId,
          linkTab: data.toast.type === 'message' ? 'messages' : 'notifications'
        });
      }
    });

    const unbindGift = socketService.on('gift_received', (data: any) => {
      addToast({
        type: 'gift',
        title: 'وصلتك هدية جديدة! 🎁',
        body: `${data.senderName || 'أحد الأعضاء'} أرسل لك هدية (${data.giftName || 'هدية راقية'})`,
        avatarUrl: data.senderAvatar,
        linkTab: 'wallet'
      });
    });

    const unbindFriendReq = socketService.on('friend_request', (data: any) => {
      addToast({
        type: 'friend_request',
        title: 'طلب صداقة جديد 🤝',
        body: `${data.senderName || 'عضو جديد'} أرسل لك طلب صداقة`,
        avatarUrl: data.senderAvatar,
        linkTab: 'friends'
      });
    });

    return () => {
      window.removeEventListener('fadfada-toast', handleCustomToast);
      unbindMessage();
      unbindToastNew();
      unbindGift();
      unbindFriendReq();
    };
  }, [user?.id, soundPref, soundEnabled]);

  const handleToastClick = (toast: ToastItem) => {
    if (toast.linkTab) {
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: toast.linkTab }));
    }
    removeToast(toast.id);
  };

  if (toasts.length === 0) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-20 md:bottom-6 left-2 sm:left-4 right-2 sm:right-auto sm:max-w-sm z-50 flex flex-col gap-2 pointer-events-none select-none"
    >
      {toasts.map(t => {
        let icon = <Bell className="w-5 h-5 text-emerald-400" />;
        let borderClass = 'border-emerald-500/40';
        let bgGradient = 'from-neutral-900 via-neutral-900 to-emerald-950/40';

        if (t.type === 'message') {
          icon = <MessageSquare className="w-5 h-5 text-sky-400" />;
          borderClass = 'border-sky-500/40';
          bgGradient = 'from-neutral-900 via-neutral-900 to-sky-950/40';
        } else if (t.type === 'gift') {
          icon = <Gift className="w-5 h-5 text-amber-400" />;
          borderClass = 'border-amber-500/40';
          bgGradient = 'from-neutral-900 via-neutral-900 to-amber-950/40';
        } else if (t.type === 'friend_request') {
          icon = <UserPlus className="w-5 h-5 text-purple-400" />;
          borderClass = 'border-purple-500/40';
          bgGradient = 'from-neutral-900 via-neutral-900 to-purple-950/40';
        }

        return (
          <div
            key={t.id}
            onClick={() => handleToastClick(t)}
            className={`pointer-events-auto cursor-pointer p-3.5 rounded-2xl bg-gradient-to-l ${bgGradient} border ${borderClass} shadow-2xl shadow-black/80 flex items-start gap-3 transform transition-all duration-300 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-2`}
          >
            {t.avatarUrl ? (
              <img
                src={t.avatarUrl}
                alt=""
                className="w-10 h-10 rounded-xl object-cover border border-neutral-700 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center shrink-0 border border-neutral-700">
                {icon}
              </div>
            )}

            <div className="flex-1 min-w-0 pr-1">
              <div className="text-xs font-bold text-white font-cairo flex items-center justify-between">
                <span>{t.title}</span>
                <span className="text-[10px] text-neutral-400 font-normal">الآن</span>
              </div>
              <p className="text-xs text-neutral-300 font-tajawal truncate mt-0.5">
                {t.body}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(t.id);
              }}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
