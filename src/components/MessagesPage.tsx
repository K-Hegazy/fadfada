import React, { useState, useEffect, useRef } from 'react';
import { apiRequest, uploadMedia } from '../services/api';
import { socketService } from '../services/socket';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { ConversationItem, PrivateMessage } from '../types';
import { GiftsModal } from './GiftsModal';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Send,
  Image,
  Mic,
  MicOff,
  Clock,
  Sparkles,
  Gift,
  Check,
  CheckCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  Smile,
  Shield,
  PhoneCall,
  Flame,
  Volume2,
  Lock,
  X,
  CircleDot
} from 'lucide-react';

interface MessagesPageProps {
  initialRecipientId?: string | null;
  onOpenProfile: (userId: string) => void;
}

export const MessagesPage: React.FC<MessagesPageProps> = ({
  initialRecipientId,
  onOpenProfile
}) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeRecipient, setActiveRecipient] = useState<any>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [messagesLoading, setMessagesLoading] = useState<boolean>(false);

  // Input states
  const [inputText, setInputText] = useState<string>('');
  const [selfDestructEnabled, setSelfDestructEnabled] = useState<boolean>(false);
  const [selfDestructDuration, setSelfDestructDuration] = useState<number>(10);
  const [viewOnceEnabled, setViewOnceEnabled] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [partnerTyping, setPartnerTyping] = useState<boolean>(false);
  const [giftModalOpen, setGiftModalOpen] = useState<boolean>(false);

  // View Once active modal
  const [viewOnceModal, setViewOnceModal] = useState<{
    messageId: string;
    mediaUrl: string;
    type: string;
  } | null>(null);
  const [openingViewOnce, setOpeningViewOnce] = useState<string | null>(null);

  // Voice recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Image upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<any>(null);
  const activeConvIdRef = useRef<string | null>(activeConvId);
  const activeRecipientRef = useRef<any>(activeRecipient);
  const initialRecipientHandledRef = useRef<string | null>(null);

  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  useEffect(() => {
    activeRecipientRef.current = activeRecipient;
  }, [activeRecipient]);

  // Fetch conversations list without blocking UI if silent
  const fetchConversations = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await apiRequest<{ conversations: ConversationItem[] }>('/conversations');
      const convList = res.conversations || [];
      setConversations(convList);

      if (initialRecipientId && initialRecipientHandledRef.current !== initialRecipientId) {
        initialRecipientHandledRef.current = initialRecipientId;
        openChatWithUser(initialRecipientId);
      } else if (convList.length > 0 && !activeConvIdRef.current) {
        selectConversation(convList[0].id, convList[0].recipient);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openChatWithUser = async (targetUserId: string) => {
    try {
      setMessagesLoading(true);
      const res = await apiRequest<{ conversationId: string }>(`/conversations/with/${targetUserId}`, {
        method: 'POST'
      });
      const prof = await apiRequest(`/users/${targetUserId}/profile`);
      setActiveConvId(res.conversationId);
      setActiveRecipient(prof.user);
      await loadMessages(res.conversationId);
    } catch (e) {
      console.error('Could not open chat with user:', e);
    } finally {
      setMessagesLoading(false);
    }
  };

  const selectConversation = (convId: string, recipient: any) => {
    if (activeConvId === convId) return;
    setActiveConvId(convId);
    setActiveRecipient(recipient);
    if (recipient?.id) {
      (window as any).__fadfada_active_chat_user_id = recipient.id;
    }
    // Mark as read in state
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, unreadCount: 0 } : c))
    );
    loadMessages(convId);
  };

  useEffect(() => {
    return () => {
      (window as any).__fadfada_active_chat_user_id = null;
    };
  }, []);

  const loadMessages = async (convId: string) => {
    try {
      setMessagesLoading(true);
      const res = await apiRequest<{ messages: PrivateMessage[]; recipient: any }>(
        `/conversations/${convId}/messages`
      );
      setMessages(res.messages || []);
      if (res.recipient) setActiveRecipient(res.recipient);
      scrollToBottom();
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  // Initial load and stable Supabase Realtime & WebSocket subscriptions
  useEffect(() => {
    fetchConversations(false);

    // 1. Supabase Realtime channel for messages
    const channel = supabase.channel(`user-messages-${user?.id || 'guest'}`);
    channel
      .on('broadcast', { event: 'message:new' }, () => {
        // Broadcaster listener
      })
      .subscribe();

    // 2. Active WebSocket listeners with stable references
    const unsubMsg = socketService.on('message:new', (data: any) => {
      const currentActiveId = activeConvIdRef.current;
      if (data.message) {
        if (data.message.conversationId === currentActiveId) {
          setMessages(prev => {
            // Avoid duplicate if already received or matched with optimistic
            if (prev.some(m => m.id === data.message.id)) return prev;
            // Match with temporary optimistic message
            const tempIdx = prev.findIndex(
              m => m.status === 'sending' && m.content === data.message.content && m.senderId === data.message.senderId
            );
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = { ...data.message, status: 'sent' };
              return updated;
            }
            return [...prev, { ...data.message, status: 'sent' }];
          });
          scrollToBottom();
        }

        // Update conversation preview in sidebar locally without HTTP re-fetching!
        setConversations(prev => {
          const idx = prev.findIndex(c => c.id === data.message.conversationId);
          if (idx !== -1) {
            const updated = [...prev];
            const isCurrent = currentActiveId === data.message.conversationId;
            updated[idx] = {
              ...updated[idx],
              lastMessage: {
                content: data.message.content,
                type: data.message.type,
                createdAt: data.message.createdAt
              },
              unreadCount: isCurrent ? 0 : (updated[idx].unreadCount || 0) + 1,
              updatedAt: data.message.createdAt
            };
            // Move active conversation to top
            const [item] = updated.splice(idx, 1);
            return [item, ...updated];
          } else {
            // Fetch silently if it is a completely new conversation from another user
            fetchConversations(true);
            return prev;
          }
        });
      }
    });

    // Listen for self-destruct events
    const unsubDestroy = socketService.on('message:destroyed', (data: any) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? { ...m, isDestroyed: true, content: '⚠️ تم تدمير هذه الصورة ذاتياً', mediaUrl: '' }
            : m
        )
      );
    });

    // Listen for View-Once opened events (notifies sender)
    const unsubViewOnce = socketService.on('message:view_once_opened', (data: any) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === data.messageId
            ? { ...m, isViewed: true, viewedAt: data.viewedAt, mediaUrl: '' }
            : m
        )
      );
    });

    // Listen for typing events
    const unsubTypingStart = socketService.on('typing:start', (data: any) => {
      if (data.senderId === activeRecipientRef.current?.id) {
        setPartnerTyping(true);
      }
    });

    const unsubTypingStop = socketService.on('typing:stop', (data: any) => {
      if (data.senderId === activeRecipientRef.current?.id) {
        setPartnerTyping(false);
      }
    });

    // Clean up all subscriptions and timers on component unmount to prevent memory leaks and duplicate listeners
    return () => {
      unsubMsg();
      unsubDestroy();
      unsubViewOnce();
      unsubTypingStart();
      unsubTypingStop();
      channel.unsubscribe();
      supabase.removeChannel(channel);

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
    };
  }, [user?.id]); // Stable mount effect, cleans up properly on unmount

  // Real-time Supabase channel for the active conversation with exact cleanup on change/close
  useEffect(() => {
    if (!activeConvId) {
      return;
    }

    const channelName = `conversation-${activeConvId}`;
    const convChannel = supabase.channel(channelName);

    convChannel
      .on('broadcast', { event: 'message:new' }, (payload: any) => {
        const msg = payload.payload?.message || payload.payload;
        if (!msg) return;
        if (msg.conversationId === activeConvId) {
          setMessages(prev => {
            // Avoid duplicate message injection
            if (prev.some(m => m.id === msg.id)) return prev;
            const tempIdx = prev.findIndex(
              m => m.status === 'sending' && m.content === msg.content && m.senderId === msg.senderId
            );
            if (tempIdx !== -1) {
              const updated = [...prev];
              updated[tempIdx] = { ...msg, status: 'sent' };
              return updated;
            }
            return [...prev, { ...msg, status: 'sent' }];
          });
          scrollToBottom();
        }
      })
      .on('broadcast', { event: 'typing:start' }, (payload: any) => {
        const data = payload.payload;
        if (data && data.senderId === activeRecipientRef.current?.id) {
          setPartnerTyping(true);
        }
      })
      .on('broadcast', { event: 'typing:stop' }, (payload: any) => {
        const data = payload.payload;
        if (data && data.senderId === activeRecipientRef.current?.id) {
          setPartnerTyping(false);
        }
      })
      .subscribe();

    // Precise cleanup: unsubscribe and remove channel when switching conversations or closing the chat
    return () => {
      convChannel.unsubscribe();
      supabase.removeChannel(convChannel);
    };
  }, [activeConvId]);


  // Handle typing notification
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    if (!activeRecipient) return;

    if (!isTyping) {
      setIsTyping(true);
      socketService.send({
        type: 'typing:start',
        recipientId: activeRecipient.id,
        conversationId: activeConvId
      });
    }

    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
      socketService.send({
        type: 'typing:stop',
        recipientId: activeRecipient.id,
        conversationId: activeConvId
      });
    }, 2000);
  };

  // Optimistic fast send text message (eliminates UI hangs completely!)
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConvId) return;

    const text = inputText.trim();
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const convId = activeConvId;
    const recipientId = activeRecipient?.id || '';

    // Clear input immediately so user never experiences UI hangs or input freezing!
    setInputText('');

    // Instant optimistic render with explicit 'sending' status
    const optimisticMessage: PrivateMessage = {
      id: tempId,
      conversationId: convId,
      senderId: user?.id || '',
      recipientId,
      content: text,
      type: 'text',
      isRead: false,
      isSelfDestruct: false,
      isViewOnce: false,
      isViewed: false,
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();

    // Instantly update conversations list preview in sidebar without waiting for network
    setConversations(prev => {
      const idx = prev.findIndex(c => c.id === convId);
      if (idx !== -1) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          lastMessage: {
            content: text,
            type: 'text',
            createdAt: new Date().toISOString()
          },
          updatedAt: new Date().toISOString()
        };
        const [item] = updated.splice(idx, 1);
        return [item, ...updated];
      }
      return prev;
    });

    // Send HTTP request asynchronously in background without blocking UI
    (async () => {
      try {
        const res = await apiRequest<{ success: boolean; message: PrivateMessage }>(
          `/conversations/${convId}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: text,
              type: 'text'
            })
          }
        );

        // Replace optimistic message with saved one
        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...res.message, status: 'sent' } : m))
        );
      } catch (err: any) {
        console.error('Failed to send message:', err);
        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m))
        );
      }
    })();
  };

  // Retry sending a failed message
  const handleRetryMessage = async (failedMsg: PrivateMessage) => {
    setMessages(prev =>
      prev.map(m => (m.id === failedMsg.id ? { ...m, status: 'sending' } : m))
    );

    try {
      const res = await apiRequest<{ success: boolean; message: PrivateMessage }>(
        `/conversations/${failedMsg.conversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            content: failedMsg.content,
            type: failedMsg.type,
            mediaUrl: failedMsg.mediaUrl,
            isSelfDestruct: failedMsg.isSelfDestruct,
            selfDestructDuration: failedMsg.selfDestructDuration,
            isViewOnce: failedMsg.isViewOnce
          })
        }
      );

      setMessages(prev =>
        prev.map(m => (m.id === failedMsg.id ? { ...res.message, status: 'sent' } : m))
      );
    } catch (e) {
      setMessages(prev =>
        prev.map(m => (m.id === failedMsg.id ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // Image Upload with View-Once and Self-Destruct options
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    const tempId = 'temp_img_' + Date.now();
    const isViewOnce = viewOnceEnabled;
    const isSelfDestruct = selfDestructEnabled;
    const convId = activeConvId;
    const recipientId = activeRecipient?.id || '';

    // Reset file input immediately so user can choose again
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;

      // Optimistic message placeholder with immediate 'sending' status
      const optimisticMsg: PrivateMessage = {
        id: tempId,
        conversationId: convId,
        senderId: user?.id || '',
        recipientId,
        content: isViewOnce ? 'صورة تُعرض لمرة واحدة' : isSelfDestruct ? 'صورة مؤقتة ذاتية التدمير' : 'صورة مرفقة',
        type: 'image',
        mediaUrl: isViewOnce ? '' : dataUrl,
        isRead: false,
        isSelfDestruct,
        selfDestructDuration: isSelfDestruct ? selfDestructDuration : 0,
        isViewOnce,
        isViewed: false,
        status: 'sending',
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom();
      setViewOnceEnabled(false);
      setSelfDestructEnabled(false);

      try {
        const uploadedUrl = await uploadMedia(dataUrl, file.name);

        const res = await apiRequest<{ success: boolean; message: PrivateMessage }>(
          `/conversations/${convId}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: isViewOnce ? 'صورة تُعرض لمرة واحدة' : isSelfDestruct ? 'صورة مؤقتة ذاتية التدمير' : 'صورة مرفقة',
              type: 'image',
              mediaUrl: uploadedUrl,
              isSelfDestruct,
              selfDestructDuration: isSelfDestruct ? selfDestructDuration : 0,
              isViewOnce
            })
          }
        );

        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...res.message, status: 'sent' } : m))
        );
        scrollToBottom();
      } catch (err: any) {
        setMessages(prev =>
          prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m))
        );
      }
    };
    reader.readAsDataURL(file);
  };

  // Open View-Once Media Modal (Recipient side)
  const handleOpenViewOnce = async (msgId: string) => {
    try {
      setOpeningViewOnce(msgId);
      const res = await apiRequest<{ success: boolean; mediaUrl: string; type: string }>(
        `/messages/${msgId}/view-once`,
        { method: 'POST' }
      );

      if (res && res.mediaUrl) {
        setViewOnceModal({
          messageId: msgId,
          mediaUrl: res.mediaUrl,
          type: res.type || 'image'
        });

        // Mark as viewed in local state
        setMessages(prev =>
          prev.map(m =>
            m.id === msgId ? { ...m, isViewed: true, mediaUrl: '' } : m
          )
        );
      }
    } catch (err: any) {
      alert(err.message || 'تعذر فتح الصورة، ربما تم فتحها مسبقاً');
    } finally {
      setOpeningViewOnce(null);
    }
  };

  // Trigger Self-Destruct view
  const handleTriggerSelfDestruct = async (msgId: string) => {
    try {
      const res = await apiRequest(`/messages/${msgId}/view-self-destruct`, {
        method: 'POST'
      });
      alert(`هذه الصورة ستتدمر ذاتياً بعد ${res.duration} ثوانٍ!`);
    } catch (err: any) {
      alert(err.message || 'خطأ في عرض الصورة المؤقتة');
    }
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const localAudioUrl = URL.createObjectURL(audioBlob);
        const tempId = 'temp_audio_' + Date.now();
        const currentConv = activeConvIdRef.current;
        const currentRecipient = activeRecipientRef.current;

        // Immediate optimistic audio note with 'sending' status!
        const optimisticAudioMsg: PrivateMessage = {
          id: tempId,
          conversationId: currentConv || '',
          senderId: user?.id || '',
          recipientId: currentRecipient?.id || '',
          content: 'رسالة صوتية 🎙️',
          type: 'audio',
          mediaUrl: localAudioUrl,
          isRead: false,
          isSelfDestruct: false,
          selfDestructDuration: 0,
          isViewOnce: false,
          isViewed: false,
          status: 'sending',
          createdAt: new Date().toISOString()
        };

        setMessages(prev => [...prev, optimisticAudioMsg]);
        scrollToBottom();

        // Update sidebar conversations preview immediately
        if (currentConv) {
          setConversations(prev => {
            const idx = prev.findIndex(c => c.id === currentConv);
            if (idx !== -1) {
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                lastMessage: {
                  content: 'رسالة صوتية 🎙️',
                  type: 'audio',
                  createdAt: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
              };
              const [item] = updated.splice(idx, 1);
              return [item, ...updated];
            }
            return prev;
          });
        }

        // Upload in background without blocking the UI
        const reader = new FileReader();
        reader.onload = async () => {
          const base64data = reader.result as string;
          try {
            const uploadedUrl = await uploadMedia(base64data, 'voice_note.webm');
            const res = await apiRequest<{ success: boolean; message: PrivateMessage }>(
              `/conversations/${currentConv}/messages`,
              {
                method: 'POST',
                body: JSON.stringify({
                  content: 'رسالة صوتية 🎙️',
                  type: 'audio',
                  mediaUrl: uploadedUrl
                })
              }
            );
            setMessages(prev =>
              prev.map(m => (m.id === tempId ? { ...res.message, status: 'sent' } : m))
            );
          } catch (err) {
            console.error('Audio upload error:', err);
            setMessages(prev =>
              prev.map(m => (m.id === tempId ? { ...m, status: 'failed' } : m))
            );
          }
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    } catch (err) {
      alert('يرجى السماح بالوصول إلى الميكروفون لتسجيل الرسائل الصوتية.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  return (
    <div className="h-[calc(100dvh-10rem)] md:h-[calc(100vh-8.5rem)] rounded-2xl sm:rounded-3xl bg-[#0a0c12] border border-neutral-800 flex overflow-hidden shadow-2xl">
      {/* 1. Conversations Sidebar */}
      <div className={`w-full md:w-80 lg:w-96 border-l border-neutral-800/80 flex flex-col bg-[#07090e] ${activeConvId ? 'hidden md:flex' : 'flex'}`}>
        {/* Sidebar Header */}
        <div className="p-3 sm:p-4 border-b border-neutral-800/80 flex items-center justify-between">
          <div className="font-cairo font-black text-base sm:text-lg text-white">المحادثات الخاصة</div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-semibold">
            {conversations.length} محادثة
          </span>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-900/60">
          {loading ? (
            <div className="p-6 text-center text-xs text-neutral-500 font-tajawal">جاري تحميل المحادثات...</div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-sm font-cairo font-bold text-neutral-400">لا توجد محادثات حتى الآن</p>
              <p className="text-xs text-neutral-500 font-tajawal">
                تصفح "المتواجدون حالياً" وابدأ أول محادثة راقية!
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === activeConvId;
              const isFemale = conv.recipient?.gender === 'female';
              return (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id, conv.recipient)}
                  className={`p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3.5 transition-all cursor-pointer active:bg-neutral-900/60 ${
                    isSelected ? 'bg-neutral-900/90 border-r-4 border-r-emerald-500' : 'hover:bg-neutral-900/40'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center font-cairo font-bold text-sm sm:text-base border ${
                      isFemale ? 'bg-rose-950/60 text-rose-300 border-rose-800/50' : 'bg-sky-950/60 text-sky-300 border-sky-800/50'
                    }`}>
                      {conv.recipient?.username ? conv.recipient.username.slice(0, 1).toUpperCase() : '؟'}
                    </div>
                    {conv.recipient?.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-[#07090e]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-cairo font-bold text-xs sm:text-sm text-white truncate flex items-center gap-1">
                        <span className="truncate">{conv.recipient?.username}</span>
                        {isUserOwner({ username: conv.recipient?.username }) && (
                          <OwnerBadge size="xs" />
                        )}
                      </div>
                      <span className="text-[9px] sm:text-[10px] text-neutral-500 font-tajawal shrink-0">
                        {conv.lastMessage ? new Date(conv.lastMessage.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] sm:text-xs text-neutral-400 font-tajawal truncate max-w-[170px]">
                        {conv.lastMessage?.content || 'ابدأ المحادثة...'}
                      </p>
                      {conv.unreadCount > 0 && (
                        <span className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-600 text-white text-[9px] sm:text-[10px] font-black flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Active Chat Area */}
      {activeConvId && activeRecipient ? (
        <div className="flex-1 flex flex-col bg-[#0b0e17] overflow-hidden">
          {/* Chat Header */}
          <div className="h-14 sm:h-18 px-2.5 sm:px-6 border-b border-neutral-800/80 bg-[#07090e]/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => setActiveConvId(null)}
                className="md:hidden text-xs text-neutral-300 hover:text-white font-bold p-1 rounded-lg bg-neutral-900 border border-neutral-800 cursor-pointer shrink-0 active:scale-95"
              >
                ← العودة
              </button>
              <div
                className="relative cursor-pointer shrink-0"
                onClick={() => onOpenProfile(activeRecipient.id)}
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-cairo font-bold text-xs sm:text-sm border ${
                  activeRecipient.gender === 'female'
                    ? 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                    : 'bg-sky-950/60 text-sky-300 border-sky-800/50'
                }`}>
                  {activeRecipient.username ? activeRecipient.username.slice(0, 1).toUpperCase() : '؟'}
                </div>
                {activeRecipient.isOnline && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border-2 border-[#07090e]" />
                )}
              </div>

              <div className="min-w-0">
                <div
                  onClick={() => onOpenProfile(activeRecipient.id)}
                  className="font-cairo font-bold text-xs sm:text-base text-white hover:text-emerald-400 transition-colors cursor-pointer flex items-center gap-1 sm:gap-2 truncate"
                >
                  <span className="truncate">{activeRecipient.username}</span>
                  <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded border shrink-0 ${
                    activeRecipient.gender === 'female'
                      ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                      : 'bg-sky-950/60 text-sky-300 border-sky-800/60'
                  }`}>
                    {activeRecipient.gender === 'female' ? 'أنثى' : 'ذكر'}
                  </span>
                  {activeRecipient.isMuted && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 font-tajawal shrink-0">
                      🔕
                    </span>
                  )}
                  {activeRecipient.isBlockedByMe && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60 font-tajawal shrink-0">
                      🚫
                    </span>
                  )}
                </div>
                <div className="text-[10px] sm:text-[11px] text-neutral-400 font-tajawal truncate">
                  {partnerTyping ? (
                    <span className="text-emerald-400 animate-pulse font-medium">يكتب الآن...</span>
                  ) : activeRecipient.isOnline ? (
                    <span className="text-emerald-400">متصل الآن</span>
                  ) : (
                    <span className="truncate">📍 {activeRecipient.country}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setGiftModalOpen(true)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-semibold text-[11px] sm:text-xs flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-md shadow-amber-600/20 active:scale-95"
              >
                <Gift className="w-3.5 h-3.5" />
                <span className="hidden min-[380px]:inline">إرسال هدية</span>
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messagesLoading ? (
              <div className="text-center text-xs text-neutral-500 font-tajawal">جاري تحميل الرسائل...</div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-14 h-14 rounded-full bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-7 h-7" />
                </div>
                <h3 className="font-cairo font-bold text-white text-lg">بداية محادثة جديدة</h3>
                <p className="text-xs text-neutral-400 max-w-sm font-tajawal">
                  محادثة آمنة ومشفرة تماماً. تدعم ميزة "عرض لمرة واحدة ➀" لحماية الخصوصية كالواتساب، والرسائل الصوتية والهدايا.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.senderId === user?.id;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-start' : 'items-end'} max-w-[85%] sm:max-w-[70%] ${isMine ? 'mr-auto' : 'ml-auto'}`}
                  >
                    <div
                      className={`p-3.5 rounded-2xl text-sm relative space-y-1.5 shadow-md ${
                        isMine
                          ? 'bg-emerald-700 text-white rounded-br-none'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-none'
                      }`}
                    >
                      {/* WhatsApp-Style View Once Media (عرض لمرة واحدة) */}
                      {m.isViewOnce ? (
                        <div className="p-3 rounded-2xl bg-black/40 border border-emerald-500/40 space-y-2 min-w-[240px]">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                            <span className="w-6 h-6 rounded-full border-2 border-emerald-400 flex items-center justify-center font-black text-xs">
                              1
                            </span>
                            <span>صورة تُعرض لمرة واحدة</span>
                          </div>

                          {isMine ? (
                            /* Sender View */
                            <div className="text-xs py-1.5 px-3 rounded-xl bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between">
                              {m.isViewed ? (
                                <span className="text-cyan-300 font-bold flex items-center gap-1.5">
                                  <CheckCheck className="w-4 h-4 text-cyan-400" />
                                  <span>تم فتحها بواسطة المستلم</span>
                                </span>
                              ) : (
                                <span className="text-neutral-400 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                                  <span>بانتظار المشاهدة لمرة واحدة</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            /* Recipient View */
                            <div>
                              {m.isViewed ? (
                                <div className="text-xs py-2 px-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-neutral-400 flex items-center gap-2">
                                  <Lock className="w-4 h-4 text-neutral-500" />
                                  <span>تم فتح هذه الصورة مسبقاً (انتهت الصلاحية)</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleOpenViewOnce(m.id)}
                                  disabled={openingViewOnce === m.id}
                                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                                >
                                  <Eye className="w-4 h-4" />
                                  <span>{openingViewOnce === m.id ? 'جاري فتح الصورة...' : 'اضغط للمشاهدة لمرة واحدة'}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : m.isSelfDestruct ? (
                        /* Self-Destructing Image Message */
                        <div className="p-3 rounded-xl bg-black/40 border border-amber-500/40 space-y-2">
                          <div className="flex items-center justify-between text-xs text-amber-300 font-bold">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              صورة ذاتية التدمير ({m.selfDestructDuration || 10} ثوانٍ)
                            </span>
                          </div>

                          {m.isDestroyed ? (
                            <div className="text-xs text-rose-400 font-semibold py-2">
                              ⚠️ تم تدمير هذه الصورة ذاتياً وانتهت صلاحيتها نهائياً.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {m.mediaUrl ? (
                                <img
                                  src={m.mediaUrl}
                                  alt="Self destructing media"
                                  className="rounded-lg max-h-60 object-cover w-full"
                                />
                              ) : (
                                <button
                                  onClick={() => handleTriggerSelfDestruct(m.id)}
                                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>انقر للمشاهدة قبل تدميرها</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ) : m.type === 'image' && m.mediaUrl ? (
                        /* Normal Image */
                        <img
                          src={m.mediaUrl}
                          alt="Attachment"
                          className="rounded-xl max-h-64 object-cover w-full"
                        />
                      ) : m.type === 'audio' && m.mediaUrl ? (
                        /* Audio Voice Note Player */
                        <div className="flex items-center gap-3 p-2 bg-black/30 rounded-xl min-w-[200px]">
                          <Volume2 className="w-5 h-5 text-emerald-300 shrink-0" />
                          <audio controls src={m.mediaUrl} className="w-full h-8" />
                        </div>
                      ) : (
                        /* Standard Text Content */
                        <p className="whitespace-pre-wrap leading-relaxed font-tajawal">{m.content}</p>
                      )}

                      {/* Timestamp & Status ticks with immediate Sending indicator and Retry for failed */}
                      <div className={`flex items-center gap-1.5 text-[10px] ${isMine ? 'text-emerald-200' : 'text-neutral-500'}`}>
                        <span>{new Date(m.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMine && (
                          m.status === 'sending' ? (
                            <div className="flex items-center gap-1 text-[10px] text-amber-300 font-tajawal animate-pulse" title="جاري الإرسال...">
                              <Clock className="w-3 h-3 animate-spin" />
                              <span className="text-[9px]">جاري الإرسال...</span>
                            </div>
                          ) : m.status === 'failed' ? (
                            <button
                              onClick={() => handleRetryMessage(m)}
                              className="flex items-center gap-1 text-[9px] text-rose-300 hover:text-white bg-rose-950/90 px-1.5 py-0.5 rounded border border-rose-700/60 cursor-pointer transition-colors"
                              title="فشل الإرسال. اضغط لإعادة المحاولة"
                            >
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              <span>إعادة المحاولة</span>
                            </button>
                          ) : m.isRead ? (
                            <span title="تمت القراءة"><CheckCheck className="w-3.5 h-3.5 text-cyan-200" /></span>
                          ) : (
                            <span title="تم الإرسال"><Check className="w-3.5 h-3.5 text-emerald-300" /></span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Guest message reminder if user is guest */}
          {user?.isGuest && (
            <div className="px-6 py-1.5 bg-amber-950/60 border-t border-amber-800/40 text-[11px] text-amber-300 flex items-center justify-between font-tajawal">
              <span>⚠️ أنت داخل كزائر: متبقي لك {user.guestMessagesRemaining} رسالة</span>
              <span className="font-semibold text-white">سجّل حساباً دائماً مجاناً لحرية مطلقة</span>
            </div>
          )}

          {/* View Once Alert Banner */}
          {viewOnceEnabled && (
            <div className="px-6 py-2 bg-emerald-950/50 border-t border-emerald-800/50 flex items-center justify-between text-xs text-emerald-300 font-tajawal">
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border-2 border-emerald-400 flex items-center justify-center font-black text-[11px]">
                  1
                </span>
                <span>وضع العرض لمرة واحدة مُفعّل (مثل واتساب): ستختفي الصورة فور خروج المستلم منها ولن يتمكن من حفظها.</span>
              </span>
              <button
                onClick={() => setViewOnceEnabled(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          )}

          {/* Self Destruct Settings Toggle Bar */}
          {selfDestructEnabled && (
            <div className="px-6 py-2 bg-amber-950/40 border-t border-amber-800/50 flex items-center justify-between text-xs text-amber-300 font-tajawal">
              <span className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                وضع الصورة ذاتية التدمير مفعل:
              </span>
              <div className="flex items-center gap-2">
                <span>تختفي بعد:</span>
                <select
                  value={selfDestructDuration}
                  onChange={(e) => setSelfDestructDuration(Number(e.target.value))}
                  className="px-2 py-1 rounded bg-neutral-900 border border-amber-700 text-white text-xs"
                >
                  <option value={10}>10 ثوانٍ</option>
                  <option value={30}>30 ثانية</option>
                  <option value={60}>دقيقة واحدة</option>
                </select>
                <button
                  onClick={() => setSelfDestructEnabled(false)}
                  className="text-neutral-400 hover:text-white cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Message Input Bar */}
          <div className="p-2 sm:p-4 border-t border-neutral-800/80 bg-[#07090e] shrink-0">
            {activeRecipient?.isBlockedByThem ? (
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-950/40 border border-rose-800/50 text-center text-xs text-rose-300 font-tajawal flex items-center justify-center gap-2">
                <span>⛔ قام هذا المستخدم بحظرك، لا يمكنك إرسال الرسائل في هذه المحادثة.</span>
              </div>
            ) : activeRecipient?.isBlockedByMe ? (
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-950/40 border border-amber-800/50 text-center text-xs text-amber-300 font-tajawal flex items-center justify-center gap-2">
                <span>🚫 لقد قمت بحظر هذا المستخدم. يمكنك إلغاء الحظر من الملف الشخصي لاستئناف المحادثة.</span>
              </div>
            ) : isRecording ? (
              /* Recording Active State */
              <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-950/60 border border-rose-800/60">
                <div className="flex items-center gap-2 text-rose-300 text-xs sm:text-sm font-semibold truncate">
                  <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span className="truncate">تسجيل صوتي ({recordingSeconds} ث)...</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <MicOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>إرسال</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="flex items-center gap-1 sm:gap-2">
                {/* Image Upload Button */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 cursor-pointer shrink-0 active:scale-95"
                  title="إرفاق صورة"
                >
                  <Image className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* View Once Toggle Button (WhatsApp Style Circle-1) */}
                <button
                  type="button"
                  onClick={() => {
                    setViewOnceEnabled(!viewOnceEnabled);
                    if (!viewOnceEnabled) setSelfDestructEnabled(false);
                  }}
                  className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 active:scale-95 ${
                    viewOnceEnabled
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30'
                      : 'bg-neutral-900 text-neutral-400 hover:text-emerald-400 border-neutral-800'
                  }`}
                  title="عرض لمرة واحدة (مثل واتساب ➀)"
                >
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-current flex items-center justify-center font-black text-[10px] sm:text-[11px] leading-none">
                    1
                  </div>
                </button>

                {/* Self Destruct Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    setSelfDestructEnabled(!selfDestructEnabled);
                    if (!selfDestructEnabled) setViewOnceEnabled(false);
                  }}
                  className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all cursor-pointer shrink-0 active:scale-95 ${
                    selfDestructEnabled
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border-neutral-800'
                  }`}
                  title="صورة ذاتية التدمير بمؤقت"
                >
                  <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Voice Note Button */}
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 cursor-pointer shrink-0 active:scale-95"
                  title="تسجيل رسالة صوتية"
                >
                  <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Text Input */}
                <input
                  type="text"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="فضفض بكلماتك الراقية..."
                  className="flex-1 min-w-0 px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 active:scale-95"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8 space-y-3 bg-[#0b0e17]">
          <div className="w-16 h-16 rounded-3xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-center text-neutral-500">
            <Send className="w-8 h-8" />
          </div>
          <h3 className="font-cairo font-bold text-lg text-white">اختر محادثة للبدء</h3>
          <p className="text-xs text-neutral-400 font-tajawal max-w-sm">
            اختر أحد الأصدقاء من القائمة الجانبية أو توجه إلى "المتواجدون حالياً" للتعرف على أشخاص جدد.
          </p>
        </div>
      )}

      {/* WhatsApp-Style View Once Fullscreen Modal */}
      {viewOnceModal && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-4 sm:p-6 backdrop-blur-md">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              <span className="w-7 h-7 rounded-full border-2 border-emerald-400 flex items-center justify-center font-black text-sm text-emerald-400">
                1
              </span>
              <div>
                <span className="font-bold text-sm block">صورة تُعرض لمرة واحدة فقط</span>
                <span className="text-[11px] text-neutral-400 font-tajawal">
                  بمجرد إغلاق هذه النافذة، ستُحذف الصورة نهائياً ولن تتمكن من رؤيتها مجدداً.
                </span>
              </div>
            </div>

            <button
              onClick={() => setViewOnceModal(null)}
              className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Image Display */}
          <div className="flex-1 flex items-center justify-center p-4">
            <img
              src={viewOnceModal.mediaUrl}
              alt="View once content"
              className="max-h-[75vh] max-w-full rounded-2xl object-contain shadow-2xl border border-neutral-800"
            />
          </div>

          {/* Bottom dismiss button */}
          <div className="flex justify-center pb-2">
            <button
              onClick={() => setViewOnceModal(null)}
              className="px-6 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-700 text-white font-bold text-xs hover:bg-neutral-800 cursor-pointer shadow-lg"
            >
              إغلاق وحذف الصورة نهائياً
            </button>
          </div>
        </div>
      )}

      {/* Gift Modal */}
      {giftModalOpen && activeRecipient && (
        <GiftsModal
          recipientId={activeRecipient.id}
          recipientName={activeRecipient.username}
          onClose={() => setGiftModalOpen(false)}
          onSent={() => {
            fetchConversations();
            loadMessages(activeConvId!);
          }}
        />
      )}
    </div>
  );
};

