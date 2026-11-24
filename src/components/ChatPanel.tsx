import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  Clock,
  Contact,
  Edit3,
  Eye,
  EyeOff,
  Gift,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Mic,
  Palette,
  Pin,
  Play,
  Reply,
  Send,
  Smile,
  Sparkles,
  Square,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { sendGiftToUser } from '../services/economy';
import {
  clearConversationForUser,
  consumeViewOnceMessage,
  deletePrivateMessage,
  editPrivateMessage,
  getClearedAtForUser,
  getConversationId,
  markConversationAsRead,
  pinConversationMessage,
  revealWhisperMessage,
  sendPrivateMessage,
  setConversationTheme,
  subscribeToMessages,
  toggleArchiveConversation,
  toggleMessageReaction,
} from '../services/messaging';
import { uploadChatImage, uploadChatVideo, uploadChatVoice } from '../services/storage';
import { useApp } from '../state/AppContext';
import { SCHEMA_LIMITS, type Message } from '../types/fadfada';
import {
  formatArabicTime,
  formatDurationMmSs,
  formatRelativeLastSeen,
  timestampToMillis,
} from '../utils/formatters';
import { CHAT_THEMES } from '../utils/progression';
import { Avatar } from './Avatar';
import { MediaViewerModal } from './MediaViewerModal';
import { EmptyState, SectionSkeleton } from './ui/Primitives';
import emptyChatArt from '../assets/images/fadfada_empty_chat_1795297623140.jpg';

const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];
const STICKER_GIFS = [
  '👋 أهلاً بك!',
  '☕ تفضل قهوتك',
  '🌹 باقة ورد لك',
  '🎉 ألف مبروك!',
  '✨ كلام جميل جدًا',
  '🤝 تشرفنا بمعرفتك',
];

interface ChatPanelProps {
  embeddedPeerId?: string | null;
  onBackEmbedded?: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  embeddedPeerId = null,
  onBackEmbedded,
}) => {
  const {
    authUser,
    profile,
    isGuest,
    users,
    usersById,
    conversations,
    storeItems,
    siteSettings,
    relationships,
    isStaff,
    activePeerId: contextPeerId,
    openChatWith,
    closeActiveChat,
    openProfileModal,
    setActiveSection,
    isPeerOnline,
    getPeerLastSeenMillis,
  } = useApp();

  const effectivePeerId = embeddedPeerId ?? contextPeerId;
  const isEmbedded = Boolean(embeddedPeerId);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [emptyArtFallback, setEmptyArtFallback] = useState(false);

  // Rich chat states
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [isWhisperMode, setIsWhisperMode] = useState(false);
  const [isViewOnceMode, setIsViewOnceMode] = useState(false);
  const [disappearSeconds, setDisappearSeconds] = useState<number | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);

  // Media viewer modal
  const [viewerMedia, setViewerMedia] = useState<{
    type: 'image' | 'video';
    url: string;
    isViewOnce?: boolean;
  } | null>(null);

  // Voice recording with live timer
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingStartRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  const peer = effectivePeerId ? usersById[effectivePeerId] : undefined;
  const conversationId =
    authUser && effectivePeerId ? getConversationId(authUser.uid, effectivePeerId) : null;

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === conversationId) ?? null,
    [conversations, conversationId]
  );

  const clearedAt = useMemo(
    () => (authUser ? getClearedAtForUser(activeConversation, authUser.uid) : 0),
    [activeConversation, authUser]
  );

  const visibleMessages = useMemo(() => {
    if (!clearedAt) return messages;
    return messages.filter((m) => {
      const ms = timestampToMillis(m.createdAt);
      return !ms || ms > clearedAt;
    });
  }, [messages, clearedAt]);

  const gifts = useMemo(
    () => storeItems.filter((i) => i.section === 'gift' && i.isActive),
    [storeItems]
  );

  useEffect(() => {
    if (!recording) {
      setRecordingSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      const elapsed = Math.max(0, Math.floor((Date.now() - recordingStartRef.current) / 1000));
      setRecordingSeconds(elapsed);
    }, 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!authUser || !conversationId) {
      setMessages([]);
      return;
    }

    setLoadingMessages(true);
    setSendError(null);
    setReplyTo(null);
    setEditingMsg(null);
    setConfirmClear(false);

    const unsub = subscribeToMessages(
      conversationId,
      authUser.uid,
      (list) => {
        setMessages(list);
        setLoadingMessages(false);
      },
      (err) => {
        setLoadingMessages(false);
        setSendError(err.message);
      }
    );

    return () => unsub();
  }, [authUser, conversationId]);

  useEffect(() => {
    bottomAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length, conversationId]);

  useEffect(() => {
    if (!authUser || !activeConversation || messages.length === 0) return;

    const triggerMarkSeen = () => {
      if (document.visibilityState !== 'visible') return;
      void markConversationAsRead(activeConversation, authUser.uid, messages);
    };

    triggerMarkSeen();
    document.addEventListener('visibilitychange', triggerMarkSeen);
    return () => document.removeEventListener('visibilitychange', triggerMarkSeen);
  }, [authUser, activeConversation, messages]);

  useEffect(() => {
    if (!authUser || !effectivePeerId) return;
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') {
        void sendPrivateMessage(
          authUser.uid,
          effectivePeerId,
          '⚠️ قام الطرف الآخر بمحاولة التقاط لقطة شاشة للمحادثة',
          { type: 'screenshot_alert' }
        ).catch(() => {});
      }
    };
    window.addEventListener('keyup', onKeyUp);
    return () => window.removeEventListener('keyup', onKeyUp);
  }, [authUser, effectivePeerId]);

  if (!authUser || !effectivePeerId) {
    const quickPeers = users
      .filter((u) => u.uid !== authUser?.uid && isPeerOnline(u, isStaff))
      .slice(0, 6);
    return (
      <section className="hidden md:flex flex-1 flex-col items-center justify-center p-6 text-center bg-[#F2F4F7] dark:bg-[#0B1114]">
        <div className="w-full max-w-md space-y-3.5">
          {!emptyArtFallback ? (
            <img
              src={emptyChatArt}
              alt="ابدأ محادثة خاصة"
              referrerPolicy="no-referrer"
              onError={() => setEmptyArtFallback(true)}
              className="w-28 h-28 mx-auto rounded-xl object-cover border border-slate-200/80 dark:border-white/10 shadow-xs"
            />
          ) : (
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
          )}
          <div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              اختر محادثة من القائمة أو ابدأ مع عضو متصل
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              دردشة خاصة فورية بالصور والفيديو والصوت والهمس السري والرسائل ذاتية الاختفاء.
            </p>
          </div>

          {quickPeers.length > 0 && (
            <div className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg divide-y divide-slate-200/70 dark:divide-white/8 text-right">
              {quickPeers.map((u) => (
                <div key={u.uid} className="px-3 py-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openProfileModal(u.uid)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-right cursor-pointer"
                  >
                    <Avatar
                      src={u.avatar}
                      name={u.displayName}
                      size="xs"
                      frameId={u.frameId}
                      isOnline
                      showPresence
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {u.displayName}
                    </span>
                    <span className="text-[10px] text-[#0B7A62] dark:text-[#34D399] shrink-0">
                      متصل الآن
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openChatWith(u.uid)}
                    className="min-h-[28px] px-2.5 rounded-md bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] text-[11px] font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <MessageCircle className="w-3 h-3" />
                    <span>محادثة</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('online')}
              className="min-h-[36px] px-4 rounded-md bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              المتواجدون الآن
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('rooms')}
              className="min-h-[36px] px-4 rounded-md bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-[#18242B] transition-colors cursor-pointer"
            >
              غرف الدردشة
            </button>
          </div>
        </div>
      </section>
    );
  }

  const peerName = peer?.displayName ?? 'مستخدم';
  const peerUsername = peer?.username ?? 'user';
  const peerOnline = peer ? isPeerOnline(peer) : false;
  const peerLastSeen = peer ? getPeerLastSeenMillis(peer) : 0;
  const themeKey = activeConversation?.theme ?? 'emerald';
  const themeStyle = CHAT_THEMES[themeKey] ?? CHAT_THEMES.emerald;
  const isArchived = activeConversation?.archivedBy?.includes(authUser.uid) ?? false;

  const isFriend = effectivePeerId
    ? relationships.some((r) => r.status === 'accepted' && r.participantIds.includes(effectivePeerId))
    : false;
  const peerPermission = peer?.privacy?.messagePermission ?? 'everyone';
  const privacyBlockedReason =
    !isStaff && peer
      ? peerPermission === 'nobody'
        ? 'أغلق هذا العضو استقبال الرسائل الخاصة في إعدادات الخصوصية.'
        : peerPermission === 'friends' && !isFriend
        ? 'يسمح هذا العضو باستقبال الرسائل الخاصة من الأصدقاء فقط.'
        : null
      : null;

  const sendOptionsContext = {
    senderProfile: profile ?? undefined,
    recipientProfile: peer,
    guestDailyLimit: siteSettings.guestDailyMessageLimit,
    isFriend,
    isStaff,
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setSendError(null);
    const draft = messageText;
    setMessageText('');

    try {
      if (editingMsg && conversationId) {
        await editPrivateMessage(conversationId, editingMsg.id, trimmed);
        setEditingMsg(null);
      } else {
        await sendPrivateMessage(authUser.uid, effectivePeerId, trimmed, {
          ...sendOptionsContext,
          replyToId: replyTo?.id,
          replyToText: replyTo?.text,
          isWhisper: isWhisperMode,
          disappearSeconds,
        });
        setReplyTo(null);
        setIsWhisperMode(false);
      }
    } catch (error) {
      setMessageText(draft);
      setSendError(error instanceof Error ? error.message : 'تعذر إرسال الرسالة.');
    } finally {
      setSending(false);
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;
    setSending(true);
    setSendError(null);
    try {
      const url = await uploadChatImage(conversationId, authUser.uid, file);
      await sendPrivateMessage(
        authUser.uid,
        effectivePeerId,
        isViewOnceMode ? 'صورة للعرض مرة واحدة' : 'صورة مرفقة',
        {
          ...sendOptionsContext,
          type: 'image',
          mediaUrl: url,
          disappearSeconds,
          isViewOnce: isViewOnceMode,
        }
      );
      setIsViewOnceMode(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVideoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;
    setSending(true);
    setSendError(null);
    try {
      const url = await uploadChatVideo(conversationId, authUser.uid, file);
      await sendPrivateMessage(
        authUser.uid,
        effectivePeerId,
        isViewOnceMode ? 'فيديو للعرض مرة واحدة' : 'مقطع فيديو',
        {
          ...sendOptionsContext,
          type: 'video',
          mediaUrl: url,
          disappearSeconds,
          isViewOnce: isViewOnceMode,
        }
      );
      setIsViewOnceMode(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر رفع الفيديو.');
    } finally {
      setSending(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const toggleVoiceRecording = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      setRecording(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !conversationId) {
      setSendError('التسجيل الصوتي غير مدعوم في هذا المتصفح.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recordingStartRef.current = Date.now();
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const elapsedSec = Math.max(1, Math.round((Date.now() - recordingStartRef.current) / 1000));
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size < 500) return;
        setSending(true);
        try {
          const url = await uploadChatVoice(conversationId, authUser.uid, blob);
          await sendPrivateMessage(authUser.uid, effectivePeerId, 'رسالة صوتية', {
            ...sendOptionsContext,
            type: 'voice',
            mediaUrl: url,
            voiceDurationSec: elapsedSec,
          });
        } catch (err) {
          setSendError(err instanceof Error ? err.message : 'تعذر رفع الرسالة الصوتية.');
        } finally {
          setSending(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setSendError('يرجى السماح بالوصول إلى الميكروفون للتسجيل.');
    }
  };

  const handleOpenViewOnce = async (msg: Message) => {
    if (!conversationId) return;
    setSendError(null);
    try {
      const res = await consumeViewOnceMessage(msg.id);
      setViewerMedia({
        type: res.type === 'video' ? 'video' : 'image',
        url: res.mediaUrl,
        isViewOnce: true,
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر فتح الوسائط ذات العرض الواحد.');
    }
  };

  const sendScreenshotAlert = async () => {
    setSendError(null);
    try {
      await sendPrivateMessage(
        authUser.uid,
        effectivePeerId,
        `⚠️ تنبيه: التقط ${profile?.displayName ?? 'الطرف الآخر'} لقطة شاشة`,
        { type: 'screenshot_alert' }
      );
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر إرسال تنبيه لقطة الشاشة.');
    }
  };

  return (
    <section className={`flex-1 flex flex-col min-h-0 h-full ${themeStyle.bg}`}>
      {/* Compact WhatsApp-style Peer Header */}
      <header className="px-3 sm:px-5 py-2.5 bg-white dark:bg-[#121B20] border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={isEmbedded ? onBackEmbedded : closeActiveChat}
            aria-label="العودة"
            className={`${isEmbedded ? 'inline-flex' : 'md:hidden inline-flex'} min-h-[36px] min-w-[36px] items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer`}
          >
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={() => openProfileModal(effectivePeerId)}
            className="flex items-center gap-2.5 min-w-0 text-right cursor-pointer group"
          >
            <Avatar
              src={peer?.avatar}
              name={peerName}
              size="md"
              frameId={peer?.frameId}
              isOnline={peerOnline}
              showPresence
            />
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate group-hover:underline">
                {peerName}
              </h2>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                <span dir="ltr" className="font-mono">
                  @{peerUsername}
                </span>
                <span>·</span>
                <span className={peerOnline ? 'text-[#0B7A62] dark:text-[#34D399] font-semibold' : ''}>
                  {formatRelativeLastSeen(peerLastSeen, peerOnline)}
                </span>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title="تنبيه لقطة شاشة"
            onClick={() => void sendScreenshotAlert()}
            className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="ثيم المحادثة"
            onClick={() => setShowThemePicker((p) => !p)}
            className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              showThemePicker
                ? 'bg-[#E6F4F0] text-[#0B7A62] dark:bg-[#14332C] dark:text-[#34D399]'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#18242B]'
            }`}
          >
            <Palette className="w-4 h-4" />
          </button>
          {activeConversation && (
            <>
              <button
                type="button"
                title={isArchived ? 'إلغاء الأرشفة' : 'أرشفة المحادثة'}
                onClick={async () => {
                  try {
                    await toggleArchiveConversation(activeConversation, authUser.uid);
                  } catch (err) {
                    setSendError(err instanceof Error ? err.message : 'تعذر تحديث الأرشفة.');
                  }
                }}
                className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer transition-colors ${
                  isArchived ? 'text-[#0B7A62] dark:text-[#34D399]' : 'text-slate-500'
                }`}
              >
                <Archive className="w-4 h-4" />
              </button>
              <button
                type="button"
                title="مسح المحادثة لدي"
                onClick={() => setConfirmClear((prev) => !prev)}
                className={`min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer transition-colors ${
                  confirmClear ? 'text-rose-600 bg-rose-50 dark:bg-rose-950/40' : 'text-slate-500'
                }`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Clear Conversation Confirmation Bar */}
      {confirmClear && activeConversation && (
        <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <span className="font-medium text-rose-800 dark:text-rose-200">
            هل تريد مسح سجل هذه المحادثة من جهتك فقط؟
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await clearConversationForUser(activeConversation, authUser.uid);
                  setConfirmClear(false);
                } catch (err) {
                  setSendError(err instanceof Error ? err.message : 'تعذر مسح المحادثة.');
                }
              }}
              className="min-h-[32px] px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer"
            >
              تأكيد المسح
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="min-h-[32px] px-3 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#121B20] cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Theme Picker Bar */}
      {showThemePicker && conversationId && (
        <div className="px-4 py-2 bg-white dark:bg-[#121B20] border-b border-slate-200/80 dark:border-white/10 flex flex-wrap items-center gap-1.5 text-xs shrink-0">
          <span className="text-slate-500 dark:text-slate-400">ثيم المحادثة:</span>
          {Object.entries(CHAT_THEMES).map(([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={async () => {
                setShowThemePicker(false);
                try {
                  await setConversationTheme(conversationId, key);
                } catch (err) {
                  setSendError(err instanceof Error ? err.message : 'تعذر تغيير الثيم.');
                }
              }}
              className={`min-h-[30px] px-2.5 rounded-lg border cursor-pointer transition-colors ${
                themeKey === key
                  ? 'border-[#0B7A62] bg-[#E6F4F0] text-[#0B7A62] dark:bg-[#14332C] dark:text-[#34D399] font-semibold'
                  : 'border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B]'
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      )}

      {/* Pinned Message Banner */}
      {activeConversation?.pinnedMessageText && (
        <div className="px-4 py-1.5 bg-[#E6F4F0]/80 dark:bg-[#14332C]/80 border-b border-[#0B7A62]/20 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Pin className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399] shrink-0" />
            <span className="truncate font-medium">مثبت: {activeConversation.pinnedMessageText}</span>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!conversationId) return;
              try {
                await pinConversationMessage(conversationId, '', '');
              } catch (err) {
                setSendError(err instanceof Error ? err.message : 'تعذر إلغاء التثبيت.');
              }
            }}
            className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto fadfada-scroll px-3 sm:px-5 py-3.5 space-y-2.5">
        {loadingMessages ? (
          <SectionSkeleton rows={4} />
        ) : visibleMessages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="w-5 h-5" />}
            title="بداية المحادثة"
            description="لا توجد رسائل ظاهرة هنا بعد. أرسل تحية، صورة، فيديو، أو رسالة صوتية."
          />
        ) : (
          visibleMessages.map((msg) => {
            const isMine = msg.senderId === authUser.uid;
            const isSeen = msg.status === 'seen';

            if (msg.type === 'screenshot_alert') {
              return (
                <div key={msg.id} className="text-center my-1.5">
                  <span className="inline-block px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-[11px] font-medium">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const reactionEntries = Object.entries(msg.reactions ?? {});
            const isWhisperHidden = msg.isWhisper && !msg.whisperRevealed && !isMine;

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`relative max-w-[85%] sm:max-w-[68%] px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed shadow-2xs ${
                    msg.type === 'gift'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100'
                      : isMine
                      ? `${themeStyle.accent} text-white rounded-tr-xs`
                      : 'bg-white dark:bg-[#121B20] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 rounded-tl-xs'
                  }`}
                >
                  {msg.replyToText && (
                    <div className="mb-1.5 px-2.5 py-1 rounded-lg bg-black/10 dark:bg-white/10 text-[11px] opacity-90 line-clamp-2 border-r-2 border-current">
                      ردًا على: {msg.replyToText}
                    </div>
                  )}

                  {msg.isWhisper && (
                    <p className="text-[10px] opacity-85 mb-1 flex items-center gap-1 font-semibold">
                      <Sparkles className="w-3 h-3" />
                      <span>رسالة همس</span>
                    </p>
                  )}

                  {isWhisperHidden ? (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!conversationId) return;
                        try {
                          await revealWhisperMessage(conversationId, msg.id);
                        } catch (err) {
                          setSendError(err instanceof Error ? err.message : 'تعذر كشف الهمسة.');
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold underline cursor-pointer py-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>اضغط لكشف الهمسة السرية</span>
                    </button>
                  ) : msg.isViewOnce && !msg.isDeleted ? (
                    <div className="py-1">
                      {msg.viewOnceConsumed ? (
                        <div className="inline-flex items-center gap-1.5 text-xs opacity-75 italic">
                          <EyeOff className="w-3.5 h-3.5 shrink-0" />
                          <span>تم فتح الوسائط — اختفت بعد المشاهدة</span>
                        </div>
                      ) : isMine ? (
                        <div className="inline-flex items-center gap-1.5 text-xs font-medium opacity-90">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {msg.type === 'video'
                              ? 'فيديو للعرض مرة واحدة (بانتظار الفتح)'
                              : 'صورة للعرض مرة واحدة (بانتظار الفتح)'}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleOpenViewOnce(msg)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-xs font-bold cursor-pointer hover:bg-amber-500/25 transition-colors"
                        >
                          <Eye className="w-4 h-4 shrink-0" />
                          <span>
                            {msg.type === 'video' ? 'مشاهدة الفيديو مرة واحدة' : 'مشاهدة الصورة مرة واحدة'}
                          </span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {msg.type === 'image' && msg.mediaUrl && !msg.isDeleted && (
                        <button
                          type="button"
                          onClick={() =>
                            setViewerMedia({ type: 'image', url: msg.mediaUrl! })
                          }
                          className="block mb-1.5 cursor-zoom-in"
                        >
                          <img
                            src={msg.mediaUrl}
                            alt="صورة مرسلة"
                            referrerPolicy="no-referrer"
                            className="max-h-60 rounded-lg object-cover"
                          />
                        </button>
                      )}
                      {msg.type === 'video' && msg.mediaUrl && !msg.isDeleted && (
                        <div className="mb-1.5 space-y-1">
                          <video
                            src={msg.mediaUrl}
                            controls
                            playsInline
                            className="max-h-60 w-full rounded-lg bg-black"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setViewerMedia({ type: 'video', url: msg.mediaUrl! })
                            }
                            className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:underline cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>عرض بملء الشاشة</span>
                          </button>
                        </div>
                      )}
                      {msg.type === 'voice' && msg.mediaUrl && !msg.isDeleted && (
                        <div className="flex items-center gap-2 mb-1">
                          <audio controls src={msg.mediaUrl} className="max-w-full h-9" />
                          {typeof msg.voiceDurationSec === 'number' && msg.voiceDurationSec > 0 && (
                            <span className="font-mono tabular-nums text-[10px] opacity-85 shrink-0">
                              {formatDurationMmSs(msg.voiceDurationSec)}
                            </span>
                          )}
                        </div>
                      )}
                      <p className={`whitespace-pre-wrap break-words ${msg.isDeleted ? 'italic opacity-70' : ''}`}>
                        {msg.text}
                      </p>
                    </>
                  )}

                  <div
                    className={`mt-1 flex flex-wrap items-center justify-end gap-1.5 text-[10px] ${
                      isMine && msg.type !== 'gift' ? 'text-white/80' : 'text-slate-400'
                    }`}
                  >
                    {msg.expiresAt && <Clock className="w-3 h-3" />}
                    {msg.editedAt && !msg.isDeleted && <span>معدّلة ·</span>}
                    <span className="font-mono tabular-nums">{formatArabicTime(msg.createdAt)}</span>
                    {isMine && (
                      <span>
                        {isSeen ? (
                          <CheckCheck className="w-3.5 h-3.5 inline text-emerald-200" />
                        ) : (
                          <Check className="w-3.5 h-3.5 inline" />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {reactionEntries.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {reactionEntries.map(([emoji, uids]) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={async () => {
                          if (!conversationId) return;
                          try {
                            await toggleMessageReaction(conversationId, msg, emoji, authUser.uid);
                          } catch (err) {
                            setSendError(err instanceof Error ? err.message : 'تعذر تحديث التفاعل.');
                          }
                        }}
                        className="px-2 py-0.5 rounded-full bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 text-[11px] cursor-pointer hover:border-[#0B7A62]"
                      >
                        {emoji} {uids.length}
                      </button>
                    ))}
                  </div>
                )}

                {!msg.isDeleted && (
                  <div className="mt-0.5 flex items-center gap-0.5 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveActionMsgId((prev) => (prev === msg.id ? null : msg.id))
                      }
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      title="تفاعل"
                    >
                      <Smile className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReplyTo(msg)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      title="رد"
                    >
                      <Reply className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!conversationId) return;
                        try {
                          await pinConversationMessage(conversationId, msg.id, msg.text);
                        } catch (err) {
                          setSendError(err instanceof Error ? err.message : 'تعذر تثبيت الرسالة.');
                        }
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                      title="تثبيت"
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    {isMine && msg.type === 'text' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingMsg(msg);
                          setMessageText(msg.text);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                        title="تعديل"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isMine && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!conversationId) return;
                          try {
                            await deletePrivateMessage(conversationId, msg.id);
                          } catch (err) {
                            setSendError(err instanceof Error ? err.message : 'تعذر حذف الرسالة.');
                          }
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {activeActionMsgId === msg.id && (
                  <div className="mt-1 flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#18242B] border border-slate-200/80 dark:border-white/10 shadow-sm">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={async () => {
                          setActiveActionMsgId(null);
                          if (!conversationId) return;
                          try {
                            await toggleMessageReaction(conversationId, msg, emoji, authUser.uid);
                          } catch (err) {
                            setSendError(err instanceof Error ? err.message : 'تعذر إضافة التفاعل.');
                          }
                        }}
                        className="px-1.5 py-0.5 hover:scale-110 transition-transform text-sm cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomAnchorRef} />
      </div>

      {/* Drawers above Composer: GIFs, Contacts, Gifts */}
      {showGifPicker && (
        <div className="px-3 sm:px-4 py-2 bg-white dark:bg-[#121B20] border-t border-slate-200/80 dark:border-white/10 flex flex-wrap gap-1.5 shrink-0">
          {STICKER_GIFS.map((sticker) => (
            <button
              key={sticker}
              type="button"
              onClick={async () => {
                setShowGifPicker(false);
                try {
                  await sendPrivateMessage(authUser.uid, effectivePeerId, sticker, {
                    ...sendOptionsContext,
                    type: 'gif',
                  });
                } catch (err) {
                  setSendError(err instanceof Error ? err.message : 'تعذر إرسال الملصق.');
                }
              }}
              className="min-h-[32px] px-2.5 rounded-lg bg-[#F2F4F7] dark:bg-[#18242B] text-xs hover:bg-[#E6F4F0] dark:hover:bg-[#14332C] cursor-pointer"
            >
              {sticker}
            </button>
          ))}
        </div>
      )}

      {showContactPicker && (
        <div className="px-3 sm:px-4 py-2 bg-white dark:bg-[#121B20] border-t border-slate-200/80 dark:border-white/10 max-h-36 overflow-y-auto flex flex-wrap gap-1.5 shrink-0">
          {users
            .filter((u) => u.uid !== authUser.uid)
            .slice(0, 12)
            .map((u) => (
              <button
                key={u.uid}
                type="button"
                onClick={async () => {
                  setShowContactPicker(false);
                  try {
                    await sendPrivateMessage(
                      authUser.uid,
                      effectivePeerId,
                      `بطاقة تواصل: ${u.displayName} (@${u.username})`,
                      { ...sendOptionsContext, type: 'contact' }
                    );
                  } catch (err) {
                    setSendError(err instanceof Error ? err.message : 'تعذر إرسال بطاقة التواصل.');
                  }
                }}
                className="min-h-[32px] px-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 text-xs hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] cursor-pointer"
              >
                {u.displayName}
              </button>
            ))}
        </div>
      )}

      {showGiftPicker && profile && peer && (
        <div className="px-3 sm:px-4 py-2 bg-white dark:bg-[#121B20] border-t border-slate-200/80 dark:border-white/10 flex flex-wrap gap-1.5 shrink-0">
          {isGuest ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              إرسال الهدايا متاح للأعضاء المسجلين بعد ترقية الحساب من صفحة الحساب.
            </p>
          ) : (
            gifts.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={async () => {
                  try {
                    await sendGiftToUser(profile, peer, g, true);
                    setShowGiftPicker(false);
                  } catch (err) {
                    setSendError(err instanceof Error ? err.message : 'تعذر إرسال الهدية.');
                  }
                }}
                className="min-h-[32px] px-2.5 rounded-lg border border-amber-300/80 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40 text-xs font-medium cursor-pointer hover:opacity-90"
              >
                🎁 {g.name} ({g.priceCoins} عملة)
              </button>
            ))
          )}
        </div>
      )}

      {/* Slim Composer */}
      <footer className="px-3 sm:px-4 py-2.5 bg-white dark:bg-[#121B20] border-t border-slate-200/80 dark:border-white/10 shrink-0">
        {(replyTo || editingMsg) && (
          <div className="mb-1.5 px-3 py-1 rounded-lg bg-[#F2F4F7] dark:bg-[#18242B] flex items-center justify-between text-xs">
            <span className="truncate font-medium">
              {editingMsg ? `تعديل الرسالة: ${editingMsg.text}` : `الرد على: ${replyTo?.text}`}
            </span>
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setEditingMsg(null);
                if (editingMsg) setMessageText('');
              }}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {privacyBlockedReason && (
          <p className="mb-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-200">
            {privacyBlockedReason}
          </p>
        )}

        {sendError && <p className="mb-1.5 text-xs text-rose-600 dark:text-rose-400">{sendError}</p>}

        <div className="mb-1.5 flex items-center gap-1 overflow-x-auto fadfada-scroll text-[11px]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37] whitespace-nowrap shrink-0"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>صورة</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImagePick}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37] whitespace-nowrap shrink-0"
          >
            <Video className="w-3.5 h-3.5" />
            <span>فيديو</span>
          </button>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={handleVideoPick}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setIsViewOnceMode((p) => !p)}
            title="عند التفعيل، تختفي الصورة أو الفيديو التالي فور مشاهدته"
            className={`min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              isViewOnceMode
                ? 'bg-amber-600 text-white'
                : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>مرة واحدة</span>
          </button>

          <button
            type="button"
            onClick={() => void toggleVoiceRecording()}
            className={`min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              recording
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]'
            }`}
          >
            {recording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span className="font-mono">
              {recording ? `إيقاف (${formatDurationMmSs(recordingSeconds)})` : 'صوت'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowGifPicker((p) => !p);
              setShowContactPicker(false);
              setShowGiftPicker(false);
            }}
            className={`min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              showGifPicker
                ? 'bg-[#E6F4F0] text-[#0B7A62] dark:bg-[#14332C] dark:text-[#34D399]'
                : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>ملصق</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowGiftPicker((p) => !p);
              setShowGifPicker(false);
              setShowContactPicker(false);
            }}
            className={`min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              showGiftPicker
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]'
            }`}
          >
            <Gift className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>هدية</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShowContactPicker((p) => !p);
              setShowGifPicker(false);
              setShowGiftPicker(false);
            }}
            className={`min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              showContactPicker
                ? 'bg-[#E6F4F0] text-[#0B7A62] dark:bg-[#14332C] dark:text-[#34D399]'
                : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]'
            }`}
          >
            <Contact className="w-3.5 h-3.5" />
            <span>جهة اتصال</span>
          </button>

          <button
            type="button"
            onClick={() => setIsWhisperMode((p) => !p)}
            className={`min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              isWhisperMode
                ? 'bg-[#0B7A62] text-white'
                : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>همسة</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setDisappearSeconds((prev) => (prev === null ? 30 : prev === 30 ? 300 : null))
            }
            className={`min-h-[30px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
              disappearSeconds
                ? 'bg-amber-600 text-white'
                : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{disappearSeconds ? `مؤقت ${disappearSeconds}ث` : 'مؤقت'}</span>
          </button>
        </div>

        <form onSubmit={handleSend} className="flex items-end gap-2">
          <textarea
            rows={1}
            maxLength={SCHEMA_LIMITS.MESSAGE_MAX_LENGTH}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={isWhisperMode ? 'اكتب همسة سرية...' : 'اكتب رسالتك هنا...'}
            className="flex-1 min-h-[40px] max-h-28 px-3.5 py-2 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
          />
          <button
            type="submit"
            disabled={!messageText.trim() || sending}
            aria-label="إرسال"
            className="min-h-[40px] min-w-[44px] px-3.5 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <Send className="w-4 h-4 -scale-x-100" />
          </button>
        </form>
      </footer>

      <MediaViewerModal
        open={viewerMedia !== null}
        type={viewerMedia?.type ?? 'image'}
        url={viewerMedia?.url ?? ''}
        isViewOnce={viewerMedia?.isViewOnce}
        onClose={() => setViewerMedia(null)}
      />
    </section>
  );
};
