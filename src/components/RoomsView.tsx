import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Crown,
  DoorOpen,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Lock,
  LogOut,
  MessageCircle,
  MessagesSquare,
  Mic,
  Palette,
  Pin,
  Play,
  Plus,
  Reply,
  Search,
  Send,
  Smile,
  Square,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import {
  consumeRoomViewOnce,
  createMemberRoom,
  deleteRoomMessage,
  editRoomMessage,
  joinRoom,
  leaveRoom,
  sendRoomMessage,
  subscribeToRoomMessages,
  subscribeToRooms,
  toggleRoomMessageReaction,
  updateRoomMeta,
} from '../services/community';
import { uploadChatImage, uploadChatVideo, uploadChatVoice } from '../services/storage';
import { useApp } from '../state/AppContext';
import type { Room, SimpleMessage } from '../types/fadfada';
import { formatArabicTime, formatDurationMmSs } from '../utils/formatters';
import { CHAT_THEMES, displayCountryName, VIP_LABELS } from '../utils/progression';
import { Avatar } from './Avatar';
import { MediaViewerModal } from './MediaViewerModal';
import { EmptyState, FeedbackBanner, PageHeader } from './ui/Primitives';

const QUICK_ROOM_EMOJIS = ['👋', '❤️', '😂', '🔥', '🌹', '✨', '👍', '☕'];
const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

export const RoomsView: React.FC = () => {
  const {
    profile,
    isGuest,
    users,
    usersById,
    siteSettings,
    isStaff,
    isPeerOnline,
    openProfileModal,
    openChatWith,
    setActiveSection,
  } = useApp();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [showRoomMembers, setShowRoomMembers] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState('عام');
  const [newTheme, setNewTheme] = useState('emerald');
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingPin, setEditingPin] = useState(false);
  const [pinDraft, setPinDraft] = useState('');

  // Rich messaging states
  const [replyTo, setReplyTo] = useState<SimpleMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<SimpleMessage | null>(null);
  const [isViewOnceMode, setIsViewOnceMode] = useState(false);
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [leavingRoom, setLeavingRoom] = useState(false);

  // Media viewer
  const [viewerMedia, setViewerMedia] = useState<{
    type: 'image' | 'video';
    url: string;
    isViewOnce?: boolean;
  } | null>(null);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingStartRef = useRef<number>(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const activeRoomIdRef = useRef<string | null>(null);
  const uidRef = useRef<string | null>(null);
  const roomsLoadedOnceRef = useRef(false);
  const wasActiveRoomPresentRef = useRef(false);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
    if (!activeRoomId) {
      wasActiveRoomPresentRef.current = false;
    }
  }, [activeRoomId]);

  useEffect(() => {
    uidRef.current = profile?.uid ?? null;
  }, [profile?.uid]);

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
    return () => {
      const prevRoomId = activeRoomIdRef.current;
      const uid = uidRef.current;
      if (prevRoomId && uid) {
        void leaveRoom(prevRoomId, uid).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToRooms((nextRooms) => {
      roomsLoadedOnceRef.current = true;
      setRooms(nextRooms);
    });
    return () => unsub();
  }, []);

  // Support 1-click direct entry from Home portal
  useEffect(() => {
    if (!profile || rooms.length === 0) return;

    const tryEnterById = (roomId: string | null) => {
      if (!roomId) return;
      const target = rooms.find((r) => r.id === roomId);
      if (!target) return;
      try {
        sessionStorage.removeItem('fadfada_pending_room');
      } catch {
        // ignore storage errors
      }
      if (activeRoomIdRef.current === target.id) return;
      const prevId = activeRoomIdRef.current;
      if (prevId && prevId !== target.id) {
        void leaveRoom(prevId, profile.uid).catch(() => {});
      }
      setActiveRoomId(target.id);
      setPinDraft(target.pinnedMessage || '');
      void joinRoom(target.id, profile.uid).catch((err) => {
        setSendError(err instanceof Error ? err.message : 'تعذر الانضمام للغرفة.');
      });
    };

    try {
      const pending = sessionStorage.getItem('fadfada_pending_room');
      if (pending) tryEnterById(pending);
    } catch {
      // ignore storage errors
    }

    const onEnterEvent = (e: Event) => {
      const custom = e as CustomEvent<string>;
      tryEnterById(custom.detail);
    };
    window.addEventListener('fadfada:enter-room', onEnterEvent);
    return () => window.removeEventListener('fadfada:enter-room', onEnterEvent);
  }, [profile, rooms]);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === activeRoomId) ?? null,
    [rooms, activeRoomId]
  );

  useEffect(() => {
    if (!activeRoomId) return;
    if (activeRoom) {
      wasActiveRoomPresentRef.current = true;
      return;
    }
    if (roomsLoadedOnceRef.current && wasActiveRoomPresentRef.current) {
      wasActiveRoomPresentRef.current = false;
      setActiveRoomId(null);
      setConfirmLeaveOpen(false);
      setShowRoomMembers(false);
      setEditingPin(false);
      setReplyTo(null);
      setEditingMsg(null);
      setSendError('تم حذف هذا الجروب من قبل المالك.');
    }
  }, [activeRoomId, activeRoom]);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      setReplyTo(null);
      setEditingMsg(null);
      return;
    }
    const unsub = subscribeToRoomMessages(activeRoomId, setMessages);
    return () => unsub();
  }, [activeRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const onlineDirectorySample = useMemo(
    () => users.filter((u) => isPeerOnline(u, isStaff)).slice(0, 30),
    [users, isPeerOnline, isStaff]
  );

  const filteredRooms = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return [...rooms]
      .filter((r) => {
        if (categoryFilter !== 'الكل' && r.category !== categoryFilter) return false;
        if (!term) return true;
        return (
          r.name.toLowerCase().includes(term) ||
          r.description.toLowerCase().includes(term) ||
          r.ownerName.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || b.activeCount - a.activeCount);
  }, [rooms, categoryFilter, searchTerm]);

  if (!profile) return null;

  const roomCost = Math.max(0, Math.floor(siteSettings.roomCreationCost ?? 0));
  const roomCostLabel = roomCost === 0 ? 'مجاني' : `${roomCost} عملة`;

  const isMemberOfActiveRoom = activeRoom
    ? (activeRoom.memberIds ?? []).includes(profile.uid)
    : false;

  const handleEnterRoom = async (room: Room) => {
    setSendError(null);
    const prevId = activeRoomIdRef.current;
    if (prevId && prevId !== room.id) {
      void leaveRoom(prevId, profile.uid).catch(() => {});
    }
    setActiveRoomId(room.id);
    setPinDraft(room.pinnedMessage || '');
    try {
      await joinRoom(room.id, profile.uid);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر الانضمام للغرفة.');
    }
  };

  const handleConfirmLeaveRoom = async () => {
    if (!activeRoom || leavingRoom) return;
    setLeavingRoom(true);
    const roomIdToLeave = activeRoom.id;
    try {
      await leaveRoom(roomIdToLeave, profile.uid);
      setConfirmLeaveOpen(false);
      setShowRoomMembers(false);
      setActiveRoomId(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر مغادرة الغرفة.');
    } finally {
      setLeavingRoom(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      const id = await createMemberRoom(
        profile,
        { name: newName, description: newDesc, category: newCategory, theme: newTheme },
        siteSettings.roomCreationCost
      );
      setNewName('');
      setNewDesc('');
      setCreateOpen(false);
      setActiveRoomId(id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'تعذر إنشاء الغرفة.');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !msgText.trim() || sending) return;
    setSending(true);
    setSendError(null);
    const draft = msgText;
    setMsgText('');
    try {
      if (editingMsg) {
        await editRoomMessage(editingMsg.id, draft.trim());
        setEditingMsg(null);
      } else {
        await sendRoomMessage(activeRoom.id, profile, draft, siteSettings.guestDailyMessageLimit, {
          replyToId: replyTo?.id,
          replyToText: replyTo?.text,
        });
        setReplyTo(null);
      }
    } catch (err) {
      setMsgText(draft);
      setSendError(err instanceof Error ? err.message : 'تعذر إرسال الرسالة.');
    } finally {
      setSending(false);
    }
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;
    setSending(true);
    setSendError(null);
    try {
      const url = await uploadChatImage(`room_${activeRoom.id}`, profile.uid, file);
      await sendRoomMessage(
        activeRoom.id,
        profile,
        isViewOnceMode ? 'صورة للعرض مرة واحدة' : 'صورة مرفقة',
        siteSettings.guestDailyMessageLimit,
        {
          type: 'image',
          mediaUrl: url,
          isViewOnce: isViewOnceMode,
        }
      );
      setIsViewOnceMode(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر رفع الصورة.');
    } finally {
      setSending(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const handleVideoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoom) return;
    setSending(true);
    setSendError(null);
    try {
      const url = await uploadChatVideo(`room_${activeRoom.id}`, profile.uid, file);
      await sendRoomMessage(
        activeRoom.id,
        profile,
        isViewOnceMode ? 'فيديو للعرض مرة واحدة' : 'مقطع فيديو',
        siteSettings.guestDailyMessageLimit,
        {
          type: 'video',
          mediaUrl: url,
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

    if (!navigator.mediaDevices?.getUserMedia || !activeRoom) {
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
          const url = await uploadChatVoice(`room_${activeRoom.id}`, profile.uid, blob);
          await sendRoomMessage(
            activeRoom.id,
            profile,
            'رسالة صوتية',
            siteSettings.guestDailyMessageLimit,
            {
              type: 'voice',
              mediaUrl: url,
              voiceDurationSec: elapsedSec,
            }
          );
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

  const handleOpenRoomViewOnce = async (msg: SimpleMessage) => {
    if (!activeRoom) return;
    setSendError(null);
    try {
      const res = await consumeRoomViewOnce(msg.id);
      setViewerMedia({
        type: res.type === 'video' ? 'video' : 'image',
        url: res.mediaUrl,
        isViewOnce: true,
      });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر فتح الوسائط ذات العرض الواحد.');
    }
  };

  const canManageRoom = activeRoom && (activeRoom.ownerId === profile.uid || isStaff);

  const savePinned = async () => {
    if (!activeRoom) return;
    setSendError(null);
    try {
      await updateRoomMeta(activeRoom.id, { pinnedMessage: pinDraft.trim() });
      setEditingPin(false);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'تعذر حفظ الرسالة المثبتة.');
    }
  };

  if (activeRoom) {
    const themeMeta = CHAT_THEMES[activeRoom.theme] ?? CHAT_THEMES.emerald;
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full pb-14 md:pb-0">
        {/* Compact Room Header */}
        <div className="px-3 sm:px-4 py-2 bg-white dark:bg-[#121B20] border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setConfirmLeaveOpen(true)}
              title="العودة لقائمة الغرف"
              className="min-h-[34px] px-2.5 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] hover:bg-slate-200/70 dark:hover:bg-[#18242B] text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">الغرف</span>
            </button>
            <span
              className={`w-8 h-8 rounded-full ${themeMeta.accent} text-white text-xs font-bold flex items-center justify-center shrink-0`}
            >
              {activeRoom.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                  {activeRoom.name}
                </h2>
                {activeRoom.isOfficial && (
                  <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="غرفة رسمية" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                <span className="font-mono tabular-nums text-[#0B7A62] dark:text-[#34D399] font-semibold">
                  {activeRoom.activeCount} متصل
                </span>
                <span>·</span>
                <span>{activeRoom.category}</span>
                <span className="hidden sm:inline">· بإدارة {activeRoom.ownerName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setShowRoomMembers((p) => !p)}
              className={`min-h-[32px] px-2.5 rounded-md border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                showRoomMembers
                  ? 'border-[#0B7A62] bg-[#E6F4F0] text-[#0B7A62] dark:bg-[#14332C] dark:text-[#34D399]'
                  : 'border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-slate-700 dark:text-slate-200'
              }`}
              title="المتواجدون"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">المتواجدون</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmLeaveOpen(true)}
              className="min-h-[32px] px-2.5 rounded-md border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              title="مغادرة الغرفة"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">مغادرة الغرفة</span>
            </button>

            {canManageRoom && (
              <>
                <button
                  type="button"
                  onClick={() => setEditingPin((p) => !p)}
                  className={`min-h-[32px] min-w-[32px] flex items-center justify-center rounded-md border transition-colors cursor-pointer ${
                    editingPin
                      ? 'border-[#0B7A62] bg-[#E6F4F0] text-[#0B7A62] dark:bg-[#14332C] dark:text-[#34D399]'
                      : 'border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B]'
                  }`}
                  title="تعديل الرسالة المثبتة"
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <select
                  value={activeRoom.theme}
                  onChange={async (e) => {
                    setSendError(null);
                    try {
                      await updateRoomMeta(activeRoom.id, { theme: e.target.value });
                    } catch (err) {
                      setSendError(err instanceof Error ? err.message : 'تعذر تحديث ثيم الغرفة.');
                    }
                  }}
                  aria-label="ثيم الغرفة"
                  className="min-h-[32px] px-2 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-[11px] font-medium"
                >
                  {Object.entries(CHAT_THEMES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Pinned Message */}
        {(activeRoom.pinnedMessage || editingPin) && (
          <div className="px-3 sm:px-4 py-1.5 bg-[#E6F4F0]/80 dark:bg-[#14332C]/70 border-b border-[#0B7A62]/15 text-xs flex items-center justify-between gap-2 shrink-0">
            {editingPin ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  maxLength={240}
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value)}
                  className="flex-1 min-h-[32px] px-3 rounded-md bg-white dark:bg-[#121B20] border border-slate-300 dark:border-white/10 text-xs"
                />
                <button
                  type="button"
                  onClick={() => void savePinned()}
                  className="min-h-[32px] px-3 rounded-md bg-[#0B7A62] text-white font-semibold cursor-pointer"
                >
                  حفظ
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#0B7A62] dark:text-[#34D399] font-medium">
                <Pin className="w-3.5 h-3.5 shrink-0" />
                <span>{activeRoom.pinnedMessage}</span>
              </div>
            )}
          </div>
        )}

        {/* Chat Messages + Toggleable Room Members Panel */}
        <div className="flex-1 flex min-h-0 relative">
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className={`flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 space-y-2.5 ${themeMeta.bg}`}>
              {messages.length === 0 ? (
                <EmptyState
                  icon={<MessagesSquare className="w-5 h-5" />}
                  title="الغرفة مفتوحة الآن"
                  description="كن أول من يلقي التحية أو يشارك صورة أو فيديو أو رسالة صوتية."
                />
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === profile.uid;
                  const vipInfo = VIP_LABELS[m.senderVip as keyof typeof VIP_LABELS];
                  const senderProfile = usersById[m.senderId];
                  const reactionEntries = Object.entries(m.reactions ?? {});
                  const alreadyViewedOnce = (m.viewOnceViewedBy ?? []).includes(profile.uid);

                  return (
                    <div
                      key={m.id}
                      className={`group flex items-start gap-2 ${mine ? 'flex-row-reverse' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => openProfileModal(m.senderId)}
                        className="shrink-0 cursor-pointer"
                      >
                        <Avatar
                          src={m.senderAvatar}
                          name={m.senderName}
                          size="sm"
                          frameId={senderProfile?.frameId}
                        />
                      </button>

                      <div className={`flex flex-col ${mine ? 'items-start' : 'items-end'} max-w-[82%] sm:max-w-[70%]`}>
                        <div
                          className={`rounded-2xl px-3 py-2 text-[13px] shadow-2xs ${
                            mine
                              ? 'bg-[#0B7A62] text-white rounded-tr-xs'
                              : 'bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-slate-100 rounded-tl-xs'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] mb-0.5 opacity-90">
                            <button
                              type="button"
                              onClick={() => openProfileModal(m.senderId)}
                              className="font-bold hover:underline cursor-pointer"
                              style={!mine && senderProfile?.nameColor ? { color: senderProfile.nameColor } : undefined}
                            >
                              {m.senderName}
                            </button>
                            {vipInfo && m.senderVip !== 'none' && senderProfile?.role !== 'guest' && (
                              <span>· {vipInfo.label}</span>
                            )}
                            <span>·</span>
                            <span className="font-mono tabular-nums opacity-75">
                              {formatArabicTime(m.createdAt)}
                            </span>
                            {m.editedAt && !m.isDeleted && <span className="opacity-75">· معدّلة</span>}
                          </div>

                          {m.replyToText && (
                            <div className="mb-1.5 px-2 py-1 rounded-lg bg-black/10 dark:bg-white/10 text-[11px] opacity-90 line-clamp-2 border-r-2 border-current">
                              ردًا على: {m.replyToText}
                            </div>
                          )}

                          {m.isViewOnce && !m.isDeleted ? (
                            <div className="py-1">
                              {alreadyViewedOnce ? (
                                <div className="inline-flex items-center gap-1.5 text-xs opacity-75 italic">
                                  <EyeOff className="w-3.5 h-3.5 shrink-0" />
                                  <span>تم فتح الوسائط — اختفت بعد المشاهدة</span>
                                </div>
                              ) : mine ? (
                                <div className="inline-flex items-center gap-1.5 text-xs font-medium opacity-90">
                                  <Lock className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {m.type === 'video'
                                      ? 'فيديو للعرض مرة واحدة في الغرفة'
                                      : 'صورة للعرض مرة واحدة في الغرفة'}
                                  </span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleOpenRoomViewOnce(m)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-xs font-bold cursor-pointer hover:bg-amber-500/30"
                                >
                                  <Eye className="w-3.5 h-3.5 shrink-0" />
                                  <span>
                                    {m.type === 'video' ? 'مشاهدة الفيديو مرة واحدة' : 'مشاهدة الصورة مرة واحدة'}
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <>
                              {m.type === 'image' && m.mediaUrl && !m.isDeleted && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setViewerMedia({ type: 'image', url: m.mediaUrl! })
                                  }
                                  className="block my-1 cursor-zoom-in"
                                >
                                  <img
                                    src={m.mediaUrl}
                                    alt="صورة الغرفة"
                                    referrerPolicy="no-referrer"
                                    className="max-h-56 rounded-lg object-cover"
                                  />
                                </button>
                              )}
                              {m.type === 'video' && m.mediaUrl && !m.isDeleted && (
                                <div className="my-1 space-y-1">
                                  <video
                                    src={m.mediaUrl}
                                    controls
                                    playsInline
                                    className="max-h-56 w-full rounded-lg bg-black"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewerMedia({ type: 'video', url: m.mediaUrl! })
                                    }
                                    className="inline-flex items-center gap-1 text-[11px] opacity-90 hover:underline cursor-pointer"
                                  >
                                    <Play className="w-3 h-3" />
                                    <span>عرض بملء الشاشة</span>
                                  </button>
                                </div>
                              )}
                              {m.type === 'voice' && m.mediaUrl && !m.isDeleted && (
                                <div className="flex items-center gap-2 my-1">
                                  <audio controls src={m.mediaUrl} className="max-w-full h-9" />
                                  {typeof m.voiceDurationSec === 'number' && m.voiceDurationSec > 0 && (
                                    <span className="font-mono tabular-nums text-[10px] opacity-85 shrink-0">
                                      {formatDurationMmSs(m.voiceDurationSec)}
                                    </span>
                                  )}
                                </div>
                              )}
                              <p className={`leading-relaxed whitespace-pre-wrap break-words ${m.isDeleted ? 'italic opacity-70' : ''}`}>
                                {m.text}
                              </p>
                            </>
                          )}
                        </div>

                        {reactionEntries.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {reactionEntries.map(([emoji, uids]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={async () => {
                                  try {
                                    await toggleRoomMessageReaction(m.id, emoji);
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

                        {!m.isDeleted && (
                          <div className="mt-0.5 flex items-center gap-0.5 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveActionMsgId((prev) => (prev === m.id ? null : m.id))
                              }
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              title="تفاعل"
                            >
                              <Smile className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyTo(m)}
                              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                              title="رد"
                            >
                              <Reply className="w-3.5 h-3.5" />
                            </button>
                            {mine && (m.type ?? 'text') === 'text' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsg(m);
                                  setMsgText(m.text);
                                }}
                                className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                title="تعديل"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(mine || isStaff) && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await deleteRoomMessage(m.id);
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

                        {activeActionMsgId === m.id && (
                          <div className="mt-1 flex items-center gap-1 p-1 rounded-lg bg-white dark:bg-[#18242B] border border-slate-200/80 dark:border-white/10 shadow-sm">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={async () => {
                                  setActiveActionMsgId(null);
                                  try {
                                    await toggleRoomMessageReaction(m.id, emoji);
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
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {sendError && (
              <div className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 shrink-0">
                {sendError}
              </div>
            )}

            {!isMemberOfActiveRoom ? (
              <div className="px-4 py-3 bg-white dark:bg-[#121B20] border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  لست منضمًا حاليًا لهذه الغرفة. انضم للمشاركة في الدردشة.
                </span>
                <button
                  type="button"
                  onClick={() => void handleEnterRoom(activeRoom)}
                  className="min-h-[34px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white font-semibold cursor-pointer"
                >
                  انضمام للغرفة
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSend}
                className="px-3 sm:px-4 py-2 bg-white dark:bg-[#121B20] border-t border-slate-200/80 dark:border-white/10 space-y-1.5 shrink-0"
              >
                {(replyTo || editingMsg) && (
                  <div className="px-3 py-1 rounded-lg bg-[#F2F4F7] dark:bg-[#18242B] flex items-center justify-between text-xs">
                    <span className="truncate font-medium">
                      {editingMsg ? `تعديل الرسالة: ${editingMsg.text}` : `الرد على ${replyTo?.senderName}: ${replyTo?.text}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(null);
                        setEditingMsg(null);
                        if (editingMsg) setMsgText('');
                      }}
                      className="text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-1 overflow-x-auto fadfada-scroll text-[11px]">
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="min-h-[28px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37] whitespace-nowrap shrink-0"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>صورة</span>
                  </button>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImagePick}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    className="min-h-[28px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer bg-[#F2F4F7] dark:bg-[#18242B] text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37] whitespace-nowrap shrink-0"
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
                    className={`min-h-[28px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
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
                    className={`min-h-[28px] px-2.5 rounded-md inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
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

                  {QUICK_ROOM_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setMsgText((prev) => `${prev}${em}`)}
                      className="min-h-[26px] px-2 rounded-md bg-[#F2F4F7] dark:bg-[#18242B] hover:bg-slate-200 dark:hover:bg-[#1F2E37] text-xs cursor-pointer shrink-0"
                    >
                      {em}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={1500}
                    value={msgText}
                    onChange={(e) => setMsgText(e.target.value)}
                    placeholder={`اكتب رسالتك في ${activeRoom.name}...`}
                    className="flex-1 min-h-[38px] px-3 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                  />
                  <button
                    type="submit"
                    disabled={sending || !msgText.trim()}
                    className="min-h-[38px] px-4 rounded-md bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <Send className="w-4 h-4 -scale-x-100" />
                    <span>{editingMsg ? 'حفظ' : 'إرسال'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {showRoomMembers && (
            <aside className="absolute md:static inset-y-0 left-0 z-20 w-64 bg-white dark:bg-[#121B20] border-r border-slate-200/80 dark:border-white/10 flex flex-col shrink-0 shadow-lg md:shadow-none">
              <div className="px-3 py-2 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-50">
                  المتواجدون ({onlineDirectorySample.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowRoomMembers(false)}
                  className="md:hidden min-h-[28px] min-w-[28px] flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto fadfada-scroll divide-y divide-slate-200/60 dark:divide-white/8">
                {onlineDirectorySample.map((u) => (
                  <div key={u.uid} className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openProfileModal(u.uid)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-right cursor-pointer"
                    >
                      <Avatar
                        src={u.avatar}
                        name={u.displayName}
                        size="xs"
                        isOnline
                        showPresence
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {u.displayName}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {displayCountryName(u.country, u.countryFlag)} · متصل الآن
                        </p>
                      </div>
                    </button>
                    {u.uid !== profile.uid && (
                      <button
                        type="button"
                        onClick={() => openChatWith(u.uid)}
                        aria-label={`محادثة ${u.displayName}`}
                        className="min-h-[28px] min-w-[28px] rounded-md bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>

        {/* Leave Room Confirmation Modal */}
        {confirmLeaveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 p-5 space-y-3.5 shadow-2xl fadfada-modal-in">
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                تأكيد مغادرة الغرفة
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                هل تريد مغادرة غرفة <strong>{activeRoom.name}</strong>؟ سيتم إخراجك من قائمة الأعضاء المتواجدين داخلها ويمكنك العودة والانضمام لها في أي وقت.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmLeaveOpen(false)}
                  className="min-h-[36px] px-3.5 rounded-lg border border-slate-200/80 dark:border-white/10 text-xs font-semibold cursor-pointer"
                >
                  البقاء في الغرفة
                </button>
                <button
                  type="button"
                  disabled={leavingRoom}
                  onClick={() => void handleConfirmLeaveRoom()}
                  className="min-h-[36px] px-4 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  {leavingRoom ? 'جاري الخروج...' : 'تأكيد المغادرة'}
                </button>
              </div>
            </div>
          </div>
        )}

        <MediaViewerModal
          open={viewerMedia !== null}
          type={viewerMedia?.type ?? 'image'}
          url={viewerMedia?.url ?? ''}
          isViewOnce={viewerMedia?.isViewOnce}
          onClose={() => setViewerMedia(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-5xl mx-auto space-y-2.5">
        <PageHeader
          title={`غرف الدردشة (${rooms.length})`}
          subtitle="اختر غرفة للدخول الفوري أو أنشئ غرفة جديدة للأصدقاء"
          icon={<MessagesSquare className="w-4 h-4" />}
          action={
            isGuest ? (
              <button
                type="button"
                onClick={() => setActiveSection('settings')}
                className="min-h-[34px] px-3 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#18242B] text-xs font-semibold cursor-pointer"
              >
                إنشاء غرفة للأعضاء
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="min-h-[34px] px-3 rounded-md bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء غرفة ({roomCostLabel})</span>
              </button>
            )
          }
        />

        {/* Compact Filter Bar */}
        <div className="p-2 rounded-lg bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث عن غرفة..."
              className="w-full min-h-[34px] pr-8 pl-3 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto fadfada-scroll">
            {['الكل', 'عام', 'فضفضة', 'ثقافة', 'ألعاب', 'تعارف'].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`min-h-[30px] px-2.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  categoryFilter === cat
                    ? 'bg-[#0B7A62] text-white'
                    : 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#1F2E37]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {sendError && <FeedbackBanner type="error" message={sendError} />}

        {/* Dense Chat Rooms List */}
        {filteredRooms.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare className="w-5 h-5" />}
            title="لا توجد غرف مطابقة"
            description="أنشئ أول غرفة دردشة أو جرّب تغيير التصنيف."
          />
        ) : (
          <div className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg divide-y divide-slate-200/70 dark:divide-white/8">
            {filteredRooms.map((room) => {
              const roomTheme = CHAT_THEMES[room.theme] ?? CHAT_THEMES.emerald;
              return (
                <div
                  key={room.id}
                  onClick={() => void handleEnterRoom(room)}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#F2F4F7]/80 dark:hover:bg-[#18242B]/70 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 rounded-full ${roomTheme.accent} text-white font-display font-bold text-sm flex items-center justify-center shrink-0`}
                    >
                      {room.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                          {room.name}
                        </h3>
                        {room.isOfficial && (
                          <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="رسمية" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5 truncate">
                        <span className="font-mono tabular-nums font-bold text-[#0B7A62] dark:text-[#34D399]">
                          {room.activeCount} متصل
                        </span>
                        <span>·</span>
                        <span>{room.activeCount > 0 ? 'نشط الآن' : 'مفتوحة للدخول'}</span>
                        <span>·</span>
                        <span>{room.category}</span>
                        {room.description && (
                          <>
                            <span className="hidden sm:inline">·</span>
                            <span className="hidden sm:inline truncate max-w-[260px]">
                              {room.description}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleEnterRoom(room);
                    }}
                    className="min-h-[32px] px-3 rounded-md bg-[#E6F4F0] hover:bg-[#d7ede7] dark:bg-[#14332C] dark:hover:bg-[#194037] text-[#0B7A62] dark:text-[#34D399] text-xs font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>دخول</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <form
            onSubmit={handleCreateRoom}
            className="w-full max-w-md bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-xl p-5 space-y-3.5 shadow-xl fadfada-modal-in"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                إنشاء غرفة جديدة
              </h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              required
              maxLength={80}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم الغرفة"
              className="w-full min-h-[40px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
            />
            <textarea
              rows={2}
              maxLength={240}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="وصف مختصر لموضوع الغرفة..."
              className="w-full p-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs font-medium"
              >
                <option value="عام">عام</option>
                <option value="فضفضة">فضفضة</option>
                <option value="ثقافة">ثقافة</option>
                <option value="ألعاب">ألعاب</option>
                <option value="تعارف">تعارف</option>
              </select>
              <div className="flex items-center gap-1.5 px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114]">
                <Palette className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  value={newTheme}
                  onChange={(e) => setNewTheme(e.target.value)}
                  className="w-full min-h-[38px] bg-transparent text-xs font-medium focus:outline-none"
                >
                  {Object.entries(CHAT_THEMES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between px-3 py-2 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114]">
              <span>سعر إنشاء الجروب</span>
              <strong className="font-mono text-[#0B7A62] dark:text-[#34D399]">{roomCostLabel}</strong>
            </div>

            {createError && <FeedbackBanner type="error" message={createError} />}

            <button
              type="submit"
              className="w-full min-h-[42px] rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
            >
              {roomCost === 0 ? 'إنشاء الغرفة (مجاني)' : `إنشاء وخصم ${roomCost} عملة`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
