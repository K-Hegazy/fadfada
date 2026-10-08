import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import { socketService } from '../services/socket';
import { supabase, RealtimeChannel } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import {
  Send,
  Image as ImageIcon,
  Mic,
  Square,
  Eye,
  EyeOff,
  Crown,
  Sparkles,
  ArrowRight,
  X,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Smile,
  Shield,
  Trash2
} from 'lucide-react';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import { SelfDestructModal } from './SelfDestructModal';

interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  type: string;
  mediaUrl?: string;
  isRead?: boolean;
  isSelfDestruct?: boolean;
  selfDestructDuration?: number;
  isDestroyed?: boolean;
  isViewOnce?: boolean;
  isViewed?: boolean;
  viewedAt?: string;
  status?: 'sending' | 'sent' | 'failed';
  createdAt: string;
}

interface OnlineChatPanelProps {
  targetUser: {
    id: string;
    username: string;
    role?: string;
    gender: 'female' | 'male';
    country: string;
    avatarUrl?: string;
    level: number;
    vipLevel: string;
    isOnline: boolean;
    equippedBadge?: string | null;
    isGuest?: boolean;
  };
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
  isMobileModal?: boolean;
}

const QUICK_EMOJIS = ['❤️', '🌹', '👋', '✨', '😂', '🔥', '👑', '👍', '🤍', '🌸'];

export const OnlineChatPanel: React.FC<OnlineChatPanelProps> = ({
  targetUser,
  onClose,
  onOpenProfile,
  isMobileModal = false
}) => {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [inputText, setInputText] = useState<string>('');
  const [viewOnceEnabled, setViewOnceEnabled] = useState<boolean>(false);
  const [selfDestructEnabled, setSelfDestructEnabled] = useState<boolean>(false);
  const [activeSelfDestruct, setActiveSelfDestruct] = useState<{
    messageId: string;
    mediaUrl: string;
    duration: number;
  } | null>(null);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [partnerTyping, setPartnerTyping] = useState<boolean>(false);
  const [partnerOnline, setPartnerOnline] = useState<boolean>(!!targetUser.isOnline);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);

  // Audio recording
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);
  const chatPresenceChannelRef = useRef<RealtimeChannel | null>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 50);
  };

  // Track active chat user globally to suppress duplicate notifications
  useEffect(() => {
    (window as any).__fadfada_active_chat_user_id = targetUser.id;
    return () => {
      if ((window as any).__fadfada_active_chat_user_id === targetUser.id) {
        (window as any).__fadfada_active_chat_user_id = null;
      }
    };
  }, [targetUser.id]);

  // Initialize or fetch conversation
  useEffect(() => {
    isMountedRef.current = true;
    let currentConvId = '';

    const initConversation = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        // Create or get existing conversation
        const res = await apiRequest<{ conversationId: string }>(
          `/conversations/with/${targetUser.id}`,
          { method: 'POST' }
        );

        if (!isMountedRef.current) return;
        currentConvId = res.conversationId;
        setConversationId(res.conversationId);

        // Fetch messages
        const msgRes = await apiRequest<{ messages: Message[] }>(
          `/conversations/${res.conversationId}/messages`
        );

        if (!isMountedRef.current) return;
        setMessages(msgRes.messages || []);
        scrollToBottom('auto');
      } catch (err: any) {
        if (isMountedRef.current) {
          setErrorMsg(err.message || 'تعذر فتح المحادثة');
        }
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    };

    initConversation();

    return () => {
      isMountedRef.current = false;
    };
  }, [targetUser.id]);

  // Realtime listeners
  useEffect(() => {
    if (!conversationId) return;

    const unsubMsg = socketService.on('message:new', (data: any) => {
      if (data.message && data.message.conversationId === conversationId) {
        setMessages(prev => {
          // If we already have this message (e.g. from optimistic send), don't duplicate
          if (prev.some(m => m.id === data.message.id)) return prev;
          // If it matches by content and senderId from a pending temp message, update it
          const tempIdx = prev.findIndex(
            m => m.status === 'sending' && m.senderId === data.message.senderId && m.content === data.message.content
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = { ...data.message, status: 'sent' };
            return updated;
          }
          return [...prev, { ...data.message, status: 'sent' }];
        });
        scrollToBottom();

        // If message is from target user, mark as read immediately
        if (data.message.senderId === targetUser.id) {
          apiRequest(`/conversations/${conversationId}/read`, { method: 'POST' }).catch(() => {});
        }
      }
    });

    const unsubViewOnce = socketService.on('message:view_once_opened', (data: any) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? { ...m, isViewed: true, viewedAt: data.viewedAt, mediaUrl: '' }
            : m
        )
      );
    });

    const unsubDestroyed = socketService.on('message:destroyed', (data: any) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? {
                ...m,
                isDestroyed: true,
                isViewed: true,
                mediaUrl: '',
                content: '⚠️ تم فتح الصورة ذاتية التدمير وانتهت صلاحيتها'
              }
            : m
        )
      );
    });

    const unsubTypingStart = socketService.on('typing:start', (data: any) => {
      if (data.senderId === targetUser.id) {
        setPartnerTyping(true);
      }
    });

    const unsubTypingStop = socketService.on('typing:stop', (data: any) => {
      if (data.senderId === targetUser.id) {
        setPartnerTyping(false);
      }
    });

    const unsubPresence = socketService.on('presence:update', (data: any) => {
      if (data?.userId === targetUser.id) {
        setPartnerOnline(!!data.isOnline);
      }
    });

    return () => {
      unsubMsg();
      unsubViewOnce();
      unsubDestroyed();
      unsubTypingStart();
      unsubTypingStop();
      unsubPresence();
    };
  }, [conversationId, targetUser.id]);

  // Supabase Presence for typing indicator & status tracking
  useEffect(() => {
    if (!conversationId) return;

    const channelName = `chat-presence-${conversationId}`;
    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user?.id || `anon_${Date.now()}`
        }
      }
    });

    chatPresenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const targetList = state[targetUser.id];
        const isTargetTyping = targetList?.some((p: any) => p.isTyping === true);
        if (isMountedRef.current) {
          setPartnerTyping(!!isTargetTyping);
          if (isTargetTyping) scrollToBottom();
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key === targetUser.id) {
          const isTargetTyping = newPresences?.some((p: any) => p.isTyping === true);
          if (isMountedRef.current && typeof isTargetTyping === 'boolean') {
            setPartnerTyping(isTargetTyping);
            if (isTargetTyping) scrollToBottom();
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key === targetUser.id && isMountedRef.current) {
          setPartnerTyping(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && user) {
          await presenceChannel.track({
            id: user.id,
            username: user.username,
            isTyping: false
          });
        }
      });

    return () => {
      presenceChannel.untrack();
      presenceChannel.unsubscribe();
      supabase.removeChannel(presenceChannel);
      chatPresenceChannelRef.current = null;
    };
  }, [conversationId, targetUser.id, user?.id]);

  // Typing emitter using Supabase Presence & WebSocket fallback
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!conversationId) return;

    if (!isTyping) {
      setIsTyping(true);
      // Track typing state via Supabase Presence
      if (chatPresenceChannelRef.current && user) {
        chatPresenceChannelRef.current.track({
          id: user.id,
          username: user.username,
          isTyping: true,
          typedAt: Date.now()
        });
      }
      socketService.send({
        type: 'typing:start',
        recipientId: targetUser.id,
        conversationId
      });
    }

    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      // Untrack typing in Supabase Presence
      if (chatPresenceChannelRef.current && user) {
        chatPresenceChannelRef.current.track({
          id: user.id,
          username: user.username,
          isTyping: false
        });
      }
      socketService.send({
        type: 'typing:stop',
        recipientId: targetUser.id,
        conversationId
      });
    }, 2500);
  };

  // Instant optimistic send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !conversationId) return;

    // Reset typing state on send
    if (isTyping) {
      setIsTyping(false);
      clearTimeout(typingTimerRef.current);
      if (chatPresenceChannelRef.current && user) {
        chatPresenceChannelRef.current.track({
          id: user.id,
          username: user.username,
          isTyping: false
        });
      }
      socketService.send({
        type: 'typing:stop',
        recipientId: targetUser.id,
        conversationId
      });
    }

    const text = inputText.trim();
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
    setInputText('');
    setShowEmojiPicker(false);

    // Optimistic message
    const optimisticMsg: Message = {
      id: tempId,
      senderId: user?.id || '',
      recipientId: targetUser.id,
      content: text,
      type: 'text',
      isRead: false,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    try {
      const res = await apiRequest<{ success: boolean; message: Message }>(
        `/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: text,
            type: 'text'
          })
        }
      );

      setMessages(prev =>
        prev.map(m => (m.id === tempId ? { ...res.message, status: 'sent' } : m))
      );
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m))
      );
      setErrorMsg(err.message || 'تعذر إرسال الرسالة');
    }
  };

  // Image Upload with optional View-Once or Self-Destruct
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const tempId = 'temp_img_' + Date.now();
      const isViewOnce = viewOnceEnabled;
      const isSelfDestruct = selfDestructEnabled;

      const optimisticMsg: Message = {
        id: tempId,
        senderId: user?.id || '',
        recipientId: targetUser.id,
        content: isSelfDestruct
          ? '⏳ صورة مؤقتة ذاتية التدمير'
          : isViewOnce
          ? '📷 صورة للعرض لمرة واحدة'
          : '📷 صورة مرفقة',
        type: 'image',
        mediaUrl: reader.result as string,
        isViewOnce,
        isSelfDestruct,
        selfDestructDuration: 10,
        isViewed: false,
        status: 'sending',
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom();
      setViewOnceEnabled(false);
      setSelfDestructEnabled(false);

      try {
        const uploadRes = await apiRequest<{ success: boolean; url: string }>('/upload', {
          method: 'POST',
          body: JSON.stringify({
            mediaBase64: reader.result,
            mimeType: file.type || 'image/jpeg'
          })
        });

        const res = await apiRequest<{ success: boolean; message: Message }>(
          `/conversations/${conversationId}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: isSelfDestruct
                ? '⏳ صورة مؤقتة ذاتية التدمير'
                : isViewOnce
                ? '📷 صورة للعرض لمرة واحدة'
                : '📷 صورة مرفقة',
              type: 'image',
              mediaUrl: uploadRes.url,
              isViewOnce,
              isSelfDestruct,
              selfDestructDuration: isSelfDestruct ? 10 : 0
            })
          }
        );

        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...res.message, status: 'sent' } : m))
        );
      } catch (err: any) {
        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m))
        );
        setErrorMsg(err.message || 'تعذر رفع الصورة');
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTriggerSelfDestruct = async (msgId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; duration: number; mediaUrl: string }>(
        `/messages/${msgId}/view-self-destruct`,
        { method: 'POST' }
      );
      if (res && res.mediaUrl) {
        setActiveSelfDestruct({
          messageId: msgId,
          mediaUrl: res.mediaUrl,
          duration: res.duration || 10
        });
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? {
                ...m,
                isDestroyed: true,
                mediaUrl: '',
                content: '⚠️ تم فتح الصورة ذاتية التدمير وانتهت صلاحيتها'
              }
            : m
        )
      );
    }
  };

  const handleCloseSelfDestruct = () => {
    if (activeSelfDestruct) {
      const destroyedId = activeSelfDestruct.messageId;
      setMessages(prev =>
        prev.map(m =>
          m.id === destroyedId
            ? {
                ...m,
                isDestroyed: true,
                mediaUrl: '',
                content: '⚠️ تم فتح الصورة ذاتية التدمير وانتهت صلاحيتها'
              }
            : m
        )
      );
      setActiveSelfDestruct(null);
    }
  };

  // Voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          const tempId = 'temp_audio_' + Date.now();

          const optimisticMsg: Message = {
            id: tempId,
            senderId: user?.id || '',
            recipientId: targetUser.id,
            content: '🎤 رسالة صوتية',
            type: 'audio',
            mediaUrl: base64Audio,
            status: 'sending',
            createdAt: new Date().toISOString()
          };

          setMessages(prev => [...prev, optimisticMsg]);
          scrollToBottom();

          try {
            const uploadRes = await apiRequest<{ success: boolean; url: string }>('/upload', {
              method: 'POST',
              body: JSON.stringify({
                mediaBase64: base64Audio,
                mimeType: 'audio/webm'
              })
            });

            const res = await apiRequest<{ success: boolean; message: Message }>(
              `/conversations/${conversationId}/messages`,
              {
                method: 'POST',
                body: JSON.stringify({
                  content: '🎤 رسالة صوتية',
                  type: 'audio',
                  mediaUrl: uploadRes.url
                })
              }
            );

            setMessages(prev =>
              prev.map(m => (m.id === tempId ? { ...res.message, status: 'sent' } : m))
            );
          } catch (err: any) {
            setMessages(prev =>
              prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m))
            );
          }
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (e) {
      setErrorMsg('يرجى السماح بالوصول إلى الميكروفون لتسجيل الصوت');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  const isFemale = targetUser.gender === 'female';

  return (
    <div
      className={`flex flex-col bg-[#090c13] border border-neutral-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all ${
        isMobileModal
          ? 'fixed inset-0 z-50 rounded-none bg-neutral-950 flex flex-col h-[100dvh] max-h-[100dvh]'
          : 'h-full min-h-0 flex-1'
      }`}
      dir="rtl"
    >
      {/* Chat Header */}
      <div className="p-2.5 sm:p-4 bg-gradient-to-r from-neutral-900 via-neutral-850 to-neutral-900 border-b border-neutral-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Back Button for mobile or dismiss */}
          <button
            onClick={onClose}
            className={`p-1.5 sm:p-2 rounded-xl flex items-center gap-1 sm:gap-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
              isMobileModal
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white'
            }`}
            title="العودة لقائمة المتواجدين حالياً"
          >
            <ArrowRight className="w-4 h-4 shrink-0" />
            <span className="inline text-xs font-bold">رجوع</span>
          </button>

          {/* Recipient Avatar */}
          <div
            onClick={() => onOpenProfile(targetUser.id)}
            className="relative cursor-pointer group shrink-0"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center font-bold text-white shadow-inner">
              {targetUser.avatarUrl ? (
                <img
                  src={targetUser.avatarUrl}
                  alt={targetUser.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs sm:text-sm font-cairo">
                  {targetUser.username.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            {partnerOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-emerald-500 border-2 border-neutral-900 rounded-full animate-pulse" />
            )}
          </div>

          {/* User details */}
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                onClick={() => onOpenProfile(targetUser.id)}
                className="font-cairo font-bold text-xs sm:text-base text-white hover:text-emerald-400 transition-colors cursor-pointer truncate max-w-[110px] min-[360px]:max-w-[140px] sm:max-w-[200px]"
              >
                {targetUser.username}
              </span>
              {isUserOwner({ role: targetUser.role, username: targetUser.username }) && (
                <OwnerBadge size="xs" />
              )}
              {targetUser.equippedBadge && (
                <span className="text-xs sm:text-sm shrink-0" title="شارة خاصة">
                  {targetUser.equippedBadge}
                </span>
              )}
              {targetUser.vipLevel && targetUser.vipLevel !== 'none' && (
                <span className="text-[9px] sm:text-[10px] font-bold text-amber-300 bg-amber-950/80 border border-amber-800/50 px-1 sm:px-1.5 py-0.2 rounded shrink-0">
                  VIP
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-neutral-400 font-tajawal truncate">
              {partnerTyping ? (
                <span className="text-emerald-400 animate-pulse font-medium">يكتب الآن...</span>
              ) : partnerOnline ? (
                <span className="text-emerald-400">متصل الآن</span>
              ) : (
                <span>غير متصل</span>
              )}
              <span>·</span>
              <span className="truncate">📍 {targetUser.country}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onOpenProfile(targetUser.id)}
            className="p-1.5 sm:p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1 active:scale-95"
            title="عرض الملف الشخصي"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">الملف</span>
          </button>
          {!isMobileModal && (
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-neutral-800 hover:bg-rose-900/40 text-neutral-400 hover:text-rose-300 transition-colors cursor-pointer active:scale-95"
              title="إغلاق المحادثة"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-800 text-rose-200 text-xs flex items-center justify-between font-tajawal animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg(null)}
            className="text-rose-300 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Messages Body */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-neutral-950/50 custom-scrollbar">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-neutral-400">
            <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-tajawal">جاري تحميل الرسائل...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-2xl shadow-xl">
              👋
            </div>
            <div className="space-y-1">
              <h3 className="font-cairo font-bold text-white text-sm">
                ابدأ محادثة راقية مع {targetUser.username}
              </h3>
              <p className="text-xs text-neutral-400 font-tajawal max-w-xs">
                محادثة خاصة ومحمية بتشفير فوري وسرعة عالية.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center pt-2">
              {QUICK_EMOJIS.slice(0, 6).map((em, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputText(prev => prev + em);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-sm transition-transform active:scale-90"
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = msg.senderId === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-start' : 'items-end'} animate-in fade-in`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 shadow-md ${
                    isMe
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-none'
                      : 'bg-neutral-850 border border-neutral-800 text-neutral-100 rounded-tl-none'
                  }`}
                >
                  {/* Self-Destruct Image Message */}
                  {msg.isSelfDestruct ? (
                    <div className="p-3 rounded-2xl bg-black/50 border border-amber-500/40 space-y-2 max-w-sm">
                      <div className="flex items-center justify-between text-xs text-amber-300 font-bold font-cairo">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          صورة ذاتية التدمير ({msg.selfDestructDuration || 10} ثوانٍ)
                        </span>
                      </div>

                      {msg.isDestroyed ? (
                        <div className="text-xs text-rose-400 font-semibold py-1.5 flex items-center gap-1.5 font-tajawal">
                          <span>⚠️ تم فتح هذه الصورة ذاتياً وانتهت صلاحيتها نهائياً.</span>
                        </div>
                      ) : isMe ? (
                        <div className="text-xs text-amber-200/80 py-1.5 font-tajawal flex items-center gap-1.5">
                          <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>صورة مؤقتة ومحمية (في انتظار فتحها من الطرف الآخر)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTriggerSelfDestruct(msg.id)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-600/30 active:scale-95 transition-all"
                        >
                          <Eye className="w-4 h-4" />
                          <span>انقر للمشاهدة لمرة واحدة قبل تدميرها</span>
                        </button>
                      )}
                    </div>
                  ) : msg.isViewOnce ? (
                    <div className="flex items-center gap-2 text-xs py-1.5 px-2 bg-black/40 rounded-xl border border-amber-500/30 font-tajawal">
                      <span className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 font-black flex items-center justify-center text-[10px] border border-amber-400/40">
                        1
                      </span>
                      <span>{msg.content}</span>
                    </div>
                  ) : msg.type === 'image' && msg.mediaUrl ? (
                    <div className="space-y-1">
                      <img
                        src={msg.mediaUrl}
                        alt="مرفق"
                        className="rounded-xl max-h-56 object-cover border border-black/20"
                      />
                      {msg.content && msg.content !== '📷 صورة مرفقة' && (
                        <p className="text-xs font-tajawal pt-1">{msg.content}</p>
                      )}
                    </div>
                  ) : msg.type === 'audio' && msg.mediaUrl ? (
                    <div className="py-1">
                      <audio controls className="max-w-[220px] h-8" src={msg.mediaUrl} />
                    </div>
                  ) : (
                    <p className="text-sm font-tajawal whitespace-pre-wrap leading-relaxed">
                      {msg.content}
                    </p>
                  )}

                  {/* Message footer: time & status indicator */}
                  <div
                    className={`flex items-center gap-1.5 text-[10px] mt-1 pt-1 font-tajawal ${
                      isMe ? 'text-emerald-100/80 justify-start' : 'text-neutral-400 justify-end'
                    }`}
                  >
                    <span>
                      {new Date(msg.createdAt).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    {isMe && (
                      <span>
                        {msg.status === 'sending' ? (
                          <span className="flex items-center gap-1 text-[9px] text-amber-200 animate-pulse" title="جاري الإرسال...">
                            <Clock className="w-3 h-3 animate-spin" />
                            <span>جاري الإرسال...</span>
                          </span>
                        ) : msg.status === 'failed' ? (
                          <span className="text-[9px] text-rose-300 font-bold" title="فشل الإرسال">فشل الإرسال ⚠️</span>
                        ) : msg.isRead ? (
                          <span title="تمت القراءة"><CheckCheck className="w-3.5 h-3.5 text-cyan-200" /></span>
                        ) : (
                          <span title="تم الإرسال"><Check className="w-3 h-3 text-emerald-200" /></span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Supabase Presence Typing Indicator */}
        {partnerTyping && (
          <div className="flex items-end gap-2 text-neutral-400 text-xs font-tajawal animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300 shadow-sm shrink-0">
              {targetUser.username ? targetUser.username.slice(0, 1).toUpperCase() : '؟'}
            </div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tr-sm bg-neutral-900/90 border border-neutral-800/80 text-emerald-400 flex items-center gap-2 shadow-sm">
              <span className="font-medium text-xs font-tajawal">{targetUser.username} يكتب رسالة...</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice recording active indicator */}
      {isRecording && (
        <div className="px-4 py-2 bg-rose-950/90 border-t border-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-200 text-xs font-tajawal">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span>جاري تسجيل رسالة صوتية: {recordingSeconds} ثانية</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelRecording}
              className="p-1.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-xs cursor-pointer"
              title="إلغاء"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
            </button>
            <button
              onClick={stopRecording}
              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              إرسال الصوت
            </button>
          </div>
        </div>
      )}

      {/* Quick emoji drawer */}
      {showEmojiPicker && (
        <div className="p-2 bg-neutral-900 border-t border-neutral-800 flex items-center gap-2 overflow-x-auto">
          {QUICK_EMOJIS.map((em, i) => (
            <button
              key={i}
              onClick={() => {
                setInputText(prev => prev + em);
              }}
              className="p-2 hover:bg-neutral-800 rounded-xl text-lg transition-transform active:scale-95"
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="p-2 sm:p-3 pb-safe bg-neutral-900 border-t border-neutral-800 flex items-center gap-1 sm:gap-2 shrink-0"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />

        {/* View once toggle */}
        <button
          type="button"
          onClick={() => {
            setViewOnceEnabled(prev => !prev);
            if (!viewOnceEnabled) setSelfDestructEnabled(false);
          }}
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl flex items-center justify-center text-[10px] sm:text-xs font-black transition-all cursor-pointer shrink-0 active:scale-95 ${
            viewOnceEnabled
              ? 'bg-amber-500 text-black shadow-md shadow-amber-500/30 font-bold'
              : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title={viewOnceEnabled ? 'العرض لمرة واحدة مفعّل ➀' : 'تفعيل العرض لمرة واحدة ➀'}
        >
          ➀
        </button>

        {/* Self destruct toggle */}
        <button
          type="button"
          onClick={() => {
            setSelfDestructEnabled(prev => !prev);
            if (!selfDestructEnabled) setViewOnceEnabled(false);
          }}
          className={`px-2 py-1 rounded-lg sm:rounded-xl flex items-center gap-1 text-[10px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
            selfDestructEnabled
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-bold border border-amber-400'
              : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
          }`}
          title={selfDestructEnabled ? 'التدمير الذاتي مفعّل (10 ثوانٍ)' : 'تفعيل التدمير الذاتي للصورة'}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">تدمير ذاتي</span>
        </button>

        {/* Image attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer shrink-0 active:scale-95"
          title="إرسال صورة"
        >
          <ImageIcon className="w-4 h-4" />
        </button>

        {/* Emoji trigger */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(prev => !prev)}
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors cursor-pointer shrink-0 active:scale-95 ${
            showEmojiPicker
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200'
          }`}
          title="رموز تعبيرية"
        >
          <Smile className="w-4 h-4" />
        </button>

        {/* Voice recording trigger */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-colors cursor-pointer shrink-0 active:scale-95 ${
            isRecording
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200'
          }`}
          title={isRecording ? 'إيقاف التسجيل' : 'تسجيل صوتي'}
        >
          <Mic className="w-4 h-4" />
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="اكتب رسالتك هنا..."
          className="flex-1 min-w-0 bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl px-2.5 sm:px-3.5 py-2 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all font-tajawal min-h-[38px]"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 sm:p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 shrink-0 min-w-[36px] sm:min-w-[40px] flex items-center justify-center min-h-[38px]"
          title="إرسال"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
      {/* Self Destruct Viewer Modal */}
      {activeSelfDestruct && (
        <SelfDestructModal
          messageId={activeSelfDestruct.messageId}
          mediaUrl={activeSelfDestruct.mediaUrl}
          duration={activeSelfDestruct.duration}
          onClose={handleCloseSelfDestruct}
        />
      )}
    </div>
  );
};
