import React, { useState, useEffect, useRef } from 'react';
import { apiRequest, uploadMedia, getMediaUrl, loadSecureMediaBlob } from '../services/api';
import { socketService } from '../services/socket';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { ConversationItem, PrivateMessage } from '../types';
import { GiftsModal } from './GiftsModal';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import { SelfDestructModal } from './SelfDestructModal';
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
  CircleDot,
  Maximize2,
  Loader2,
  Reply,
  Edit2,
  CornerDownRight,
  Copy
} from 'lucide-react';

const NormalImageAttachment: React.FC<{ src: string; alt?: string; onClick?: () => void }> = ({ src, alt = 'مرفق', onClick }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [blobUrl, setBlobUrl] = useState<string>('');

  useEffect(() => {
    let active = true;
    let currentBlob = '';

    async function load() {
      try {
        setLoading(true);
        setError(false);
        const url = await loadSecureMediaBlob(src);
        if (active) {
          currentBlob = url;
          setBlobUrl(url);
          setLoading(false);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch (e) {
        if (active) {
          setLoading(false);
          setError(true);
        }
      }
    }

    load();

    return () => {
      active = false;
      if (currentBlob) {
        URL.revokeObjectURL(currentBlob);
      }
    };
  }, [src]);

  return (
    <div
      onClick={() => {
        if (!error && onClick) onClick();
      }}
      className={`relative rounded-xl overflow-hidden bg-black/40 max-h-72 w-full max-w-sm flex items-center justify-center border border-white/10 group ${
        !error && onClick ? 'cursor-pointer hover:border-emerald-500/50 transition-all' : ''
      }`}
    >
      {loading && !error && (
        <div className="h-44 w-full flex flex-col items-center justify-center gap-2 text-neutral-400 bg-neutral-900/60 animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
          <span className="text-[11px] font-tajawal">جاري تحميل الصورة...</span>
        </div>
      )}

      {error ? (
        <div className="h-28 w-full p-3 flex flex-col items-center justify-center gap-1.5 bg-rose-950/40 text-rose-300 border border-rose-800/50 rounded-xl">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span className="text-xs font-semibold font-tajawal">تعذر تحميل الصورة</span>
        </div>
      ) : blobUrl ? (
        <img
          src={blobUrl}
          alt={alt}
          loading="lazy"
          draggable={false}
          onContextMenu={e => e.preventDefault()}
          onDragStart={e => e.preventDefault()}
          className="rounded-xl max-h-72 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] select-none"
        />
      ) : null}

      {!loading && !error && blobUrl && (
        <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold font-cairo pointer-events-none select-none">
          <Maximize2 className="w-4 h-4" />
          <span>انقر للمعاينة بحجم كامل</span>
        </div>
      )}
    </div>
  );
};

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
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [partnerTyping, setPartnerTyping] = useState<boolean>(false);
  const [giftModalOpen, setGiftModalOpen] = useState<boolean>(false);

  // Message Interaction States: Reply, Edit, Delete, Reactions
  const [replyingTo, setReplyingTo] = useState<PrivateMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<PrivateMessage | null>(null);
  const [deleteModalMsg, setDeleteModalMsg] = useState<PrivateMessage | null>(null);
  const [activeReactionPickerMsgId, setActiveReactionPickerMsgId] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);

  // Self Destruct & Lightbox states
  const [activeSelfDestruct, setActiveSelfDestruct] = useState<{
    messageId: string;
    mediaUrl: string;
    duration: number;
  } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title?: string } | null>(null);

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

    // Listen for real-time reactions
    const unsubReaction = socketService.on('message:reaction', (data: any) => {
      if (data.messageId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === data.messageId ? { ...m, reactions: data.reactions } : m
          )
        );
      }
    });

    // Listen for real-time message edits
    const unsubEdit = socketService.on('message:edited', (data: any) => {
      if (data.messageId) {
        setMessages(prev =>
          prev.map(m =>
            m.id === data.messageId
              ? { ...m, content: data.content, isEdited: true, editedAt: data.editedAt }
              : m
          )
        );
      }
    });

    // Listen for real-time message deletions
    const unsubDelete = socketService.on('message:deleted', (data: any) => {
      if (data.messageId) {
        if (data.mode === 'me') {
          setMessages(prev => prev.filter(m => m.id !== data.messageId));
        } else {
          setMessages(prev =>
            prev.map(m =>
              m.id === data.messageId
                ? { ...m, isDeleted: true, content: '🚫 تم حذف هذه الرسالة', mediaUrl: '' }
                : m
            )
          );
        }
      }
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
      unsubReaction();
      unsubEdit();
      unsubDelete();
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

    // If we are currently editing a message, save the edit instead of sending a new message
    if (editingMessage) {
      handleSaveEdit();
      return;
    }

    const text = inputText.trim();
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const convId = activeConvId;
    const recipientId = activeRecipient?.id || '';

    // Clear input immediately so user never experiences UI hangs or input freezing!
    setInputText('');

    const currentReplyingTo = replyingTo;
    const optimisticMessage: PrivateMessage = {
      id: tempId,
      conversationId: convId,
      senderId: user?.id || '',
      recipientId: activeRecipient?.id || '',
      content: text,
      type: 'text',
      isRead: false,
      isSelfDestruct: false,
      isViewOnce: false,
      isViewed: false,
      replyToId: currentReplyingTo?.id || null,
      replyTo: currentReplyingTo ? {
        id: currentReplyingTo.id,
        senderId: currentReplyingTo.senderId,
        senderUsername: currentReplyingTo.senderId === user?.id ? 'أنت' : (activeRecipient?.username || 'مستخدم'),
        content: currentReplyingTo.content,
        type: currentReplyingTo.type
      } : null,
      isEdited: false,
      isDeleted: false,
      reactions: [],
      status: 'sending',
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setReplyingTo(null);
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
              type: 'text',
              replyToId: currentReplyingTo?.id || null
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

  // Edit Message Handlers
  const handleStartEdit = (msg: PrivateMessage) => {
    if (msg.senderId !== user?.id || msg.type !== 'text' || msg.isDeleted) return;
    setEditingMessage(msg);
    setInputText(msg.content);
    setReplyingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !inputText.trim()) return;
    const msgId = editingMessage.id;
    const newContent = inputText.trim();

    // Optimistic update
    setMessages(prev =>
      prev.map(m => (m.id === msgId ? { ...m, content: newContent, isEdited: true } : m))
    );
    setEditingMessage(null);
    setInputText('');

    try {
      await apiRequest(`/messages/${msgId}/edit`, {
        method: 'POST',
        body: JSON.stringify({ content: newContent })
      });
    } catch (err: any) {
      console.error('Failed to edit message:', err);
    }
  };

  // Delete Message Handler
  const handleDeleteMessage = async (msgId: string, mode: 'everyone' | 'me') => {
    setDeleteModalMsg(null);
    if (mode === 'me') {
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } else {
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, isDeleted: true, content: '🚫 تم حذف هذه الرسالة', mediaUrl: '' }
            : m
        )
      );
    }

    try {
      await apiRequest(`/messages/${msgId}/delete`, {
        method: 'POST',
        body: JSON.stringify({ mode })
      });
    } catch (err: any) {
      console.error('Failed to delete message:', err);
    }
  };

  // Reaction Toggle Handler
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    setActiveReactionPickerMsgId(null);

    // Optimistic toggle
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId) return m;
        const currentRx = m.reactions || [];
        const myActive = currentRx.find(r => r.hasReacted);
        let nextRx: any[];

        if (myActive && myActive.emoji === emoji) {
          // Toggle off
          nextRx = currentRx
            .map(r => r.emoji === emoji ? { ...r, count: r.count - 1, hasReacted: false } : r)
            .filter(r => r.count > 0);
        } else {
          // Decrement previous if user had one
          let cleaned = currentRx
            .map(r => r.hasReacted ? { ...r, count: r.count - 1, hasReacted: false } : r)
            .filter(r => r.count > 0);
          const found = cleaned.findIndex(r => r.emoji === emoji);
          if (found !== -1) {
            cleaned[found] = { ...cleaned[found], count: cleaned[found].count + 1, hasReacted: true };
          } else {
            cleaned.push({ emoji, count: 1, hasReacted: true });
          }
          nextRx = cleaned;
        }
        return { ...m, reactions: nextRx };
      })
    );

    try {
      const res = await apiRequest<{ success: boolean; reactions: any[] }>(
        `/messages/${msgId}/reactions`,
        {
          method: 'POST',
          body: JSON.stringify({ emoji })
        }
      );
      if (res.reactions) {
        setMessages(prev =>
          prev.map(m => (m.id === msgId ? { ...m, reactions: res.reactions } : m))
        );
      }
    } catch (err: any) {
      console.error('Failed to react to message:', err);
    }
  };

  // Scroll to original replied-to message with highlight pulse
  const handleScrollToMessage = (targetId: string) => {
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetId);
      setTimeout(() => {
        setHighlightedMsgId(null);
      }, 2000);
    }
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
            replyToId: failedMsg.replyToId
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

  // Image Upload with Self-Destruct options (View-once completely removed)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConvId) return;

    const tempId = 'temp_img_' + Date.now();
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
        content: isSelfDestruct ? 'صورة مؤقتة ذاتية التدمير' : 'صورة مرفقة',
        type: 'image',
        mediaUrl: dataUrl,
        isRead: false,
        isSelfDestruct,
        selfDestructDuration: isSelfDestruct ? selfDestructDuration : 0,
        isViewOnce: false,
        isViewed: false,
        reactions: [],
        status: 'sending',
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, optimisticMsg]);
      scrollToBottom();
      setSelfDestructEnabled(false);

      try {
        const uploadedUrl = await uploadMedia(dataUrl, file.name);

        const res = await apiRequest<{ success: boolean; message: PrivateMessage }>(
          `/conversations/${convId}/messages`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: isSelfDestruct ? 'صورة مؤقتة ذاتية التدمير' : 'صورة مرفقة',
              type: 'image',
              mediaUrl: uploadedUrl,
              isSelfDestruct,
              selfDestructDuration: isSelfDestruct ? selfDestructDuration : 0
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

  // Trigger Self-Destruct view
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
            ? { ...m, isDestroyed: true, mediaUrl: '', content: '⚠️ تم فتح الصورة ذاتية التدمير وانتهت صلاحيتها' }
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
            ? { ...m, isDestroyed: true, mediaUrl: '', content: '⚠️ تم فتح الصورة ذاتية التدمير وانتهت صلاحيتها' }
            : m
        )
      );
      setActiveSelfDestruct(null);
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
                  محادثة آمنة ومشفرة تماماً. تدعم الصور المؤقتة ذاتية التدمير، والرسائل الصوتية، والتفاعلات، والردود المقتبسة، وتعديل الرسائل.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.senderId === user?.id;
                const quickEmojis = ['❤️', '😂', '👍', '😮', '😢', '🔥', '👏'];

                return (
                  <div
                    key={m.id}
                    id={`msg-${m.id}`}
                    className={`group relative flex flex-col ${isMine ? 'items-start mr-auto' : 'items-end ml-auto'} max-w-[85%] sm:max-w-[70%] transition-all duration-300 ${
                      highlightedMsgId === m.id ? 'ring-2 ring-emerald-400 bg-emerald-500/10 p-1 rounded-2xl' : ''
                    }`}
                  >
                    {/* Floating Action Bar on hover/focus */}
                    {!m.isDeleted && (
                      <div
                        className={`absolute -top-3.5 ${
                          isMine ? 'left-2' : 'right-2'
                        } hidden group-hover:flex items-center gap-1 bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-xl px-1.5 py-0.5 shadow-xl z-20 transition-all`}
                      >
                        {/* Reaction Trigger Button */}
                        <button
                          type="button"
                          onClick={() => setActiveReactionPickerMsgId(activeReactionPickerMsgId === m.id ? null : m.id)}
                          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 rounded-lg cursor-pointer transition-colors"
                          title="تفاعل بإيموجي"
                        >
                          <Smile className="w-3.5 h-3.5" />
                        </button>

                        {/* Reply Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(m);
                            setEditingMessage(null);
                          }}
                          className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-sky-400 rounded-lg cursor-pointer transition-colors"
                          title="رد على الرسالة"
                        >
                          <Reply className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Button (Text messages by sender only) */}
                        {isMine && m.type === 'text' && !m.isSelfDestruct && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(m)}
                            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-emerald-400 rounded-lg cursor-pointer transition-colors"
                            title="تعديل الرسالة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Copy Text Button */}
                        {m.type === 'text' && (
                          <button
                            type="button"
                            onClick={() => {
                              try { navigator.clipboard.writeText(m.content); } catch (e) {}
                            }}
                            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded-lg cursor-pointer transition-colors"
                            title="نسخ النص"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => setDeleteModalMsg(m)}
                          className="p-1 hover:bg-rose-950/80 text-neutral-400 hover:text-rose-400 rounded-lg cursor-pointer transition-colors"
                          title="حذف الرسالة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Quick Reactions Picker Popup */}
                    {activeReactionPickerMsgId === m.id && (
                      <div
                        className={`absolute -top-11 ${
                          isMine ? 'left-2' : 'right-2'
                        } flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl z-30 animate-in fade-in zoom-in-95`}
                      >
                        {quickEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleToggleReaction(m.id, emoji)}
                            className="w-7 h-7 flex items-center justify-center text-base hover:scale-125 transition-transform cursor-pointer rounded-lg hover:bg-neutral-800"
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setActiveReactionPickerMsgId(null)}
                          className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 cursor-pointer ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Message Bubble Box */}
                    <div
                      className={`p-3.5 rounded-2xl text-sm relative space-y-1.5 shadow-md w-full ${
                        m.isDeleted
                          ? 'bg-neutral-900/60 border border-neutral-800 text-neutral-500 italic'
                          : isMine
                          ? 'bg-emerald-700 text-white rounded-br-none'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-bl-none'
                      }`}
                    >
                      {/* Quoted Replying Preview inside bubble */}
                      {m.replyTo && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleScrollToMessage(m.replyTo!.id);
                          }}
                          className={`mb-1 p-2 rounded-xl text-right cursor-pointer transition-colors max-w-full overflow-hidden select-none border-r-3 ${
                            isMine
                              ? 'bg-black/35 hover:bg-black/50 border-r-emerald-300 text-emerald-100'
                              : 'bg-black/40 hover:bg-black/60 border-r-emerald-500 text-neutral-300'
                          }`}
                          title="انقر للانتقال إلى الرسالة الأصلية"
                        >
                          <div className="flex items-center gap-1.5 text-[10px] font-bold font-cairo text-emerald-300">
                            <CornerDownRight className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {m.replyTo.senderUsername || (m.replyTo.senderId === user?.id ? 'أنت' : 'مستخدم')}
                            </span>
                          </div>
                          <div className="text-[11px] opacity-90 font-tajawal truncate max-w-xs mt-0.5">
                            {m.replyTo.content || (m.replyTo.type === 'image' ? '📷 صورة' : m.replyTo.type === 'audio' ? '🎤 تسجيل صوتي' : 'رسالة')}
                          </div>
                        </div>
                      )}

                      {/* Deleted Message Notice */}
                      {m.isDeleted ? (
                        <div className="flex items-center gap-1.5 py-1 text-xs text-neutral-400">
                          <Trash2 className="w-3.5 h-3.5 opacity-60" />
                          <span className="font-tajawal">🚫 تم حذف هذه الرسالة</span>
                        </div>
                      ) : m.isSelfDestruct ? (
                        /* Self-Destructing Image Message */
                        <div className="p-3 rounded-2xl bg-black/50 border border-amber-500/40 space-y-2 max-w-sm">
                          <div className="flex items-center justify-between text-xs text-amber-300 font-bold font-cairo">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              صورة ذاتية التدمير ({m.selfDestructDuration || 10} ثوانٍ)
                            </span>
                          </div>

                          {m.isDestroyed ? (
                            <div className="text-xs text-rose-400 font-semibold py-1.5 flex items-center gap-1.5 font-tajawal">
                              <span>⚠️ تم فتح هذه الصورة ذاتياً وانتهت صلاحيتها نهائياً.</span>
                            </div>
                          ) : isMine ? (
                            <div className="text-xs text-amber-200/80 py-1.5 font-tajawal flex items-center gap-1.5">
                              <EyeOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>صورة مؤقتة ومحمية (في انتظار فتحها من الطرف الآخر)</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTriggerSelfDestruct(m.id)}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-amber-600/30 active:scale-95 transition-all"
                            >
                              <Eye className="w-4 h-4" />
                              <span>انقر للمشاهدة قبل تدميرها</span>
                            </button>
                          )}
                        </div>
                      ) : m.type === 'image' && m.mediaUrl ? (
                        /* Normal Image Attachment */
                        <div className="space-y-1">
                          <NormalImageAttachment
                            src={getMediaUrl(m.mediaUrl)}
                            alt="مرفق"
                            onClick={() => setLightboxImage({ url: getMediaUrl(m.mediaUrl!), title: m.content || 'معاينة الصورة المرفقة' })}
                          />
                          {m.content && m.content !== 'صورة مرفقة' && (
                            <p className="whitespace-pre-wrap leading-relaxed font-tajawal pt-1">{m.content}</p>
                          )}
                        </div>
                      ) : m.type === 'audio' && m.mediaUrl ? (
                        /* Audio Voice Note Player */
                        <div className="flex items-center gap-3 p-2 bg-black/30 rounded-xl min-w-[200px]">
                          <Volume2 className="w-5 h-5 text-emerald-300 shrink-0" />
                          <audio controls src={getMediaUrl(m.mediaUrl)} className="w-full h-8" />
                        </div>
                      ) : (
                        /* Standard Text Content */
                        <p className="whitespace-pre-wrap leading-relaxed font-tajawal">{m.content}</p>
                      )}

                      {/* Timestamp, Edited badge & Status indicators */}
                      <div className={`flex items-center gap-1.5 text-[10px] ${isMine ? 'text-emerald-200' : 'text-neutral-500'}`}>
                        <span>{new Date(m.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>

                        {m.isEdited && !m.isDeleted && (
                          <span className="text-[9px] font-tajawal px-1 py-0.2 rounded bg-black/30 text-emerald-200 border border-emerald-400/30">
                            (معدّلة)
                          </span>
                        )}

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

                    {/* Emoji Reactions List Display below message bubble */}
                    {m.reactions && m.reactions.length > 0 && !m.isDeleted && (
                      <div className={`flex flex-wrap items-center gap-1 mt-1 ${isMine ? 'justify-start' : 'justify-end'}`}>
                        {m.reactions.map((rx) => (
                          <button
                            key={rx.emoji}
                            type="button"
                            onClick={() => handleToggleReaction(m.id, rx.emoji)}
                            className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition-all cursor-pointer active:scale-95 ${
                              rx.hasReacted
                                ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold ring-1 ring-emerald-500/50 shadow-sm'
                                : 'bg-neutral-900/90 border-neutral-700/80 text-neutral-300 hover:border-neutral-500 hover:text-white'
                            }`}
                            title={rx.hasReacted ? 'إزالة تفاعلك' : 'إضافة تفاعل'}
                          >
                            <span>{rx.emoji}</span>
                            <span className="text-[10px] font-mono">{rx.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
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

          {/* Edit Message Mode Preview Bar */}
          {editingMessage && (
            <div className="px-4 sm:px-6 py-2 bg-emerald-950/60 border-t border-emerald-700/60 flex items-center justify-between text-xs text-emerald-200 font-tajawal animate-in fade-in">
              <div className="flex items-center gap-2 truncate">
                <Edit2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-white font-cairo">تعديل الرسالة:</span>
                <span className="text-neutral-300 truncate max-w-xs">{editingMessage.content}</span>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                title="إلغاء التعديل"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Reply Message Mode Preview Bar */}
          {replyingTo && (
            <div className="px-4 sm:px-6 py-2 bg-sky-950/60 border-t border-sky-700/60 flex items-center justify-between text-xs text-sky-200 font-tajawal animate-in fade-in">
              <div className="flex items-center gap-2 truncate">
                <Reply className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="font-bold text-white font-cairo">
                  الرد على {replyingTo.senderId === user?.id ? 'رسالتك' : (activeRecipient?.username || 'المستخدم')}:
                </span>
                <span className="text-neutral-300 truncate max-w-xs">
                  {replyingTo.content || (replyingTo.type === 'image' ? '📷 صورة' : replyingTo.type === 'audio' ? '🎤 تسجيل صوتي' : 'رسالة')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                className="p-1 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
                title="إلغاء الرد"
              >
                <X className="w-4 h-4" />
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

                {/* Self Destruct Toggle */}
                <button
                  type="button"
                  onClick={() => setSelfDestructEnabled(!selfDestructEnabled)}
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
                  placeholder={editingMessage ? 'قم بتعديل نص الرسالة ثم اضغط حفظ...' : 'فضفض بكلماتك الراقية...'}
                  className="flex-1 min-w-0 px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-500 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                />

                {/* Send / Save Button */}
                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className={`p-2 sm:p-3.5 rounded-xl sm:rounded-2xl text-white font-bold transition-all shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 active:scale-95 ${
                    editingMessage
                      ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                  }`}
                  title={editingMessage ? 'حفظ التعديل' : 'إرسال'}
                >
                  {editingMessage ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
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

      {/* Delete Confirmation Modal */}
      {deleteModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" dir="rtl">
          <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/60 border border-rose-800/60 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-cairo font-bold text-sm text-white">حذف الرسالة</h4>
                <p className="text-xs text-neutral-400 font-tajawal">اختر نوع الحذف المطلوب لهذه الرسالة:</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {deleteModalMsg.senderId === user?.id && !deleteModalMsg.isDeleted && (
                <button
                  type="button"
                  onClick={() => handleDeleteMessage(deleteModalMsg.id, 'everyone')}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-md shadow-rose-600/20"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف لدى الجميع</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteMessage(deleteModalMsg.id, 'me')}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <span>حذف لدي فقط</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteModalMsg(null)}
                className="w-full py-2 px-4 rounded-xl text-neutral-400 hover:text-white text-xs font-semibold cursor-pointer transition-colors"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Normal Image Lightbox Modal with Subtle Watermark & Anti-Save */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 animate-in fade-in select-none"
          dir="rtl"
          onClick={() => setLightboxImage(null)}
          onContextMenu={e => e.preventDefault()}
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-white">
              <span className="font-bold text-sm font-cairo">{lightboxImage.title || 'معاينة الصورة'}</span>
            </div>
            <button
              onClick={() => setLightboxImage(null)}
              className="p-2 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Image Display with subtle watermark overlay */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0" onClick={e => e.stopPropagation()}>
            <div className="relative select-none flex items-center justify-center max-h-[80vh] max-w-full">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title || 'معاينة'}
                draggable={false}
                onContextMenu={e => e.preventDefault()}
                onDragStart={e => e.preventDefault()}
                className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl border border-neutral-800 select-none"
              />
              {/* Discreet watermark overlay */}
              <div className="absolute inset-0 pointer-events-none select-none flex flex-col justify-between p-3 z-20">
                <div className="flex justify-start">
                  <span className="text-[10px] font-mono text-white/40 bg-black/50 px-2 py-0.5 rounded backdrop-blur-[1px] border border-white/10">
                    فضفضه • {user?.username || 'مستخدم'}
                  </span>
                </div>
                <div className="flex items-center justify-center rotate-[-22deg] opacity-20 text-white font-mono text-xs sm:text-base tracking-widest uppercase select-none pointer-events-none drop-shadow">
                  {user?.username || 'FADFADA'} • {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex justify-end">
                  <span className="text-[9px] font-mono text-white/40 bg-black/50 px-2 py-0.5 rounded backdrop-blur-[1px] border border-white/10">
                    ID: {user?.id?.slice(0, 8) || 'user'} • {new Date().toLocaleDateString('ar-EG')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom dismiss button */}
          <div className="flex justify-center pb-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="px-6 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-700 text-white font-bold text-xs hover:bg-neutral-800 cursor-pointer shadow-lg active:scale-95 transition-all"
            >
              إغلاق المعاينة
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

