import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import { playNotificationSound, SoundType } from '../services/sound';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  MessageCircle,
  Gift,
  UserPlus,
  X,
  Bell,
  ArrowLeft,
  ChevronLeft
} from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'message' | 'gift' | 'friend_request' | 'general';
  title: string;
  body: string;
  avatarUrl?: string;
  senderId?: string;
  senderUsername?: string;
  senderRole?: string;
  unreadCount?: number;
  linkTab?: string;
  data?: any;
}

export const LiveToastContainer: React.FC = () => {
  const { user } = useAuth();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  // Sound preferences
  const soundPref = (user?.notificationSound || localStorage.getItem('fadfada_sound') || 'chime') as SoundType;
  const soundEnabled = user?.soundEnabled !== undefined ? user.soundEnabled : (localStorage.getItem('fadfada_sound_enabled') !== 'false');

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const addToast = (toast: Omit<ToastItem, 'id'>, dedupeKey?: string) => {
    if (dedupeKey) {
      if (seenMessageIdsRef.current.has(dedupeKey)) return;
      seenMessageIdsRef.current.add(dedupeKey);
      if (seenMessageIdsRef.current.size > 200) {
        // Keep set size manageable
        const first = seenMessageIdsRef.current.values().next().value;
        if (first) seenMessageIdsRef.current.delete(first);
      }
    }

    const id = 'tst_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newToast: ToastItem = { ...toast, id };

    setToasts(prev => [newToast, ...prev.slice(0, 2)]); // Keep at most 3 toasts visible to prevent visual clutter

    // Play subtle chime sound
    playNotificationSound(soundPref, soundEnabled);

    // Browser Notification (optional, if user gave permission previously)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(toast.title, {
          body: toast.body,
          icon: toast.avatarUrl || '/favicon.ico',
          dir: 'rtl'
        });
      } catch {}
    }

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  useEffect(() => {
    // 1. Custom window toast event listener
    const handleCustomToast = (e: any) => {
      if (e.detail) {
        addToast(e.detail);
      }
    };
    window.addEventListener('fadfada-toast', handleCustomToast);

    // 2. Real-time private message notifications (dedicated event)
    const unbindNewPrivateMsg = socketService.on('new_private_message', (data: any) => {
      if (!data) return;

      // Check if user is currently inside active chat with this sender
      const activeChatUserId = (window as any).__fadfada_active_chat_user_id;
      if (activeChatUserId && activeChatUserId === data.senderId) {
        // User is already looking at this chat! Do NOT show toast.
        return;
      }

      // Check if message is from myself or muted
      if (data.senderId === user?.id || data.silent) return;

      addToast(
        {
          type: 'message',
          title: data.senderUsername || 'رسالة جديدة',
          body: data.preview || 'أرسل لك رسالة جديدة',
          avatarUrl: data.senderAvatar,
          senderId: data.senderId,
          senderUsername: data.senderUsername,
          senderRole: data.senderRole,
          unreadCount: data.unreadCount,
          linkTab: 'online'
        },
        data.messageId
      );
    });

    // 3. Fallback: message:new event (if not caught by new_private_message)
    const unbindMessageNew = socketService.on('message:new', (data: any) => {
      const msg = data?.message;
      if (!msg || msg.senderId === user?.id || data.silent) return;

      const activeChatUserId = (window as any).__fadfada_active_chat_user_id;
      if (activeChatUserId && activeChatUserId === msg.senderId) {
        return;
      }

      addToast(
        {
          type: 'message',
          title: 'رسالة خاصة جديدة 💬',
          body: msg.type === 'image' ? '📷 أرسل لك صورة' : (msg.type === 'audio' ? '🎤 تسجيل صوتي' : (msg.content || '').slice(0, 60)),
          senderId: msg.senderId,
          linkTab: 'online'
        },
        msg.id
      );
    });

    // 4. Gift notifications
    const unbindGift = socketService.on('gift_received', (data: any) => {
      addToast({
        type: 'gift',
        title: 'وصلتك هدية جديدة! 🎁',
        body: `${data.senderName || 'أحد الأعضاء'} أرسل لك هدية (${data.giftName || 'هدية راقية'})`,
        avatarUrl: data.senderAvatar,
        linkTab: 'wallet'
      });
    });

    // 5. Friend request notifications
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
      unbindNewPrivateMsg();
      unbindMessageNew();
      unbindGift();
      unbindFriendReq();
    };
  }, [user?.id, soundPref, soundEnabled]);

  const handleToastClick = (toast: ToastItem) => {
    removeToast(toast.id);

    if (toast.type === 'message' && toast.senderId) {
      // Trigger instant chat opening in OnlineChatPanel (or MessagesPage)
      window.dispatchEvent(
        new CustomEvent('open_chat_with_user', {
          detail: {
            userId: toast.senderId,
            username: toast.senderUsername
          }
        })
      );
      return;
    }

    if (toast.linkTab) {
      window.dispatchEvent(new CustomEvent('navigate-tab', { detail: toast.linkTab }));
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div
      dir="rtl"
      className="fixed bottom-20 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-sm z-50 flex flex-col gap-2.5 pointer-events-none select-none"
    >
      {toasts.map(t => {
        const isMsg = t.type === 'message';
        const isGift = t.type === 'gift';
        const isFriend = t.type === 'friend_request';
        const isOwner = isUserOwner({ role: t.senderRole, username: t.senderUsername });

        return (
          <div
            key={t.id}
            onClick={() => handleToastClick(t)}
            className="pointer-events-auto cursor-pointer p-3 sm:p-3.5 rounded-2xl bg-[#0e111a]/95 backdrop-blur-md border border-emerald-500/50 hover:border-emerald-400 shadow-2xl shadow-black/90 flex items-center justify-between gap-3 transform transition-all duration-300 hover:scale-[1.02] active:scale-98 animate-in fade-in slide-in-from-bottom-3"
          >
            {/* Sender Avatar / Icon with Online beacon */}
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700/80 flex items-center justify-center font-bold text-white overflow-hidden shadow-inner">
                {t.avatarUrl ? (
                  <img src={t.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : isMsg ? (
                  <MessageCircle className="w-5 h-5 text-emerald-400" />
                ) : isGift ? (
                  <Gift className="w-5 h-5 text-amber-400" />
                ) : isFriend ? (
                  <UserPlus className="w-5 h-5 text-purple-400" />
                ) : (
                  <Bell className="w-5 h-5 text-neutral-300" />
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-neutral-900 rounded-full animate-pulse" />
            </div>

            {/* Notification content */}
            <div className="flex-1 min-w-0 pr-0.5">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs font-bold text-white font-cairo truncate">
                  {t.title}
                </span>
                {isOwner && <OwnerBadge size="xs" />}
                <span className="text-[10px] text-neutral-400 font-tajawal shrink-0 mr-auto">
                  الآن
                </span>
              </div>

              <p className="text-[11px] text-neutral-300 font-tajawal truncate mt-0.5 leading-snug">
                {t.body}
              </p>

              {/* Action hint */}
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-tajawal font-bold mt-1">
                <span>اضغط لفتح المحادثة فوراً</span>
                <ChevronLeft className="w-3 h-3" />
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(t.id);
              }}
              className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors shrink-0 cursor-pointer"
              title="إغلاق الإشعار"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
