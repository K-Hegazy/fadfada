import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Room, RoomMessage } from '../types';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Compass,
  Plus,
  Lock,
  Users,
  Send,
  Sparkles,
  Shield,
  MessageSquare,
  X,
  Volume2,
  VolumeX,
  UserX,
  Flame,
  Crown,
  Mic,
  MicOff,
  Radio,
  Headphones,
  PhoneOff
} from 'lucide-react';

const ROOM_CATEGORIES = [
  'فضفضة عامة', 'أدب وشعر', 'تقنية وبرمجة', 'تجارب حياتية', 'ألعاب ومسابقات', 'تطوير الذات'
];

interface AudioSpeaker {
  user_id: string;
  username: string;
  avatar_url?: string;
  gender?: string;
  role?: string;
  is_speaking: number;
  is_muted: number;
}

export const RoomsPage: React.FC = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [roomInput, setRoomInput] = useState<string>('');
  const [partnerTyping, setPartnerTyping] = useState<string | null>(null);

  // Live Audio Room State
  const [audioSpeakers, setAudioSpeakers] = useState<AudioSpeaker[]>([]);
  const [isOnAudioStage, setIsOnAudioStage] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Modal Create Room
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomDesc, setNewRoomDesc] = useState<string>('');
  const [newRoomCategory, setNewRoomCategory] = useState<string>('فضفضة عامة');
  const [newRoomRules, setNewRoomRules] = useState<string>('');
  const [newRoomPrivate, setNewRoomPrivate] = useState<boolean>(false);
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ rooms: Room[] }>('/rooms');
      setRooms(res.rooms || []);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const enterRoom = async (roomId: string) => {
    try {
      await apiRequest(`/rooms/${roomId}/join`, { method: 'POST' });
      const res = await apiRequest<{ room: Room; messages: RoomMessage[]; members: any[] }>(
        `/rooms/${roomId}/messages`
      );
      setActiveRoomId(roomId);
      setActiveRoom(res.room);
      setRoomMessages(res.messages || []);
      setRoomMembers(res.members || []);
      scrollToBottom();
    } catch (err) {
      console.error('Error entering room:', err);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // WebSockets for Real-time chat & Audio stage in room
  useEffect(() => {
    if (!activeRoomId) return;

    socketService.send({ type: 'room:join', roomId: activeRoomId });

    // Fetch live audio speakers
    apiRequest<{ speakers: AudioSpeaker[] }>(`/rooms/${activeRoomId}/audio-speakers`)
      .then(res => setAudioSpeakers(res.speakers || []))
      .catch(() => {});

    const unsubMsg = socketService.on('room:message', (data: any) => {
      if (data.roomId === activeRoomId && data.message) {
        setRoomMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
    });

    const unsubJoin = socketService.on('room:user_joined', (data: any) => {
      if (data.roomId === activeRoomId && data.user) {
        setRoomMembers(prev => {
          if (prev.some(m => m.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
      }
    });

    const unsubLeave = socketService.on('room:user_left', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setRoomMembers(prev => prev.filter(m => m.id !== data.userId));
        setAudioSpeakers(prev => prev.filter(s => s.user_id !== data.userId));
      }
    });

    const unsubTyping = socketService.on('room:typing', (data: any) => {
      if (data.roomId === activeRoomId && data.userId !== user?.id) {
        setPartnerTyping(data.username);
        setTimeout(() => setPartnerTyping(null), 3000);
      }
    });

    const unsubAudio = socketService.on('room:audio_speaker_update', (data: any) => {
      if (data.roomId === activeRoomId && data.speaker) {
        setAudioSpeakers(prev => {
          const idx = prev.findIndex(s => s.user_id === data.speaker.user_id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...next[idx], ...data.speaker };
            return next;
          }
          return [...prev, data.speaker];
        });
      }
    });

    const unsubAudioLeave = socketService.on('room:audio_speaker_leave', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setAudioSpeakers(prev => prev.filter(s => s.user_id !== data.userId));
      }
    });

    return () => {
      leaveAudioStage();
      socketService.send({ type: 'room:leave', roomId: activeRoomId });
      unsubMsg();
      unsubJoin();
      unsubLeave();
      unsubTyping();
      unsubAudio();
      unsubAudioLeave();
    };
  }, [activeRoomId]);

  const joinAudioStage = async () => {
    if (!activeRoomId) return;
    setAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      await apiRequest(`/rooms/${activeRoomId}/audio-stage/join`, { method: 'POST' });
      setIsOnAudioStage(true);
      setIsMicMuted(false);

      socketService.send({
        type: 'room:audio_speaker_join',
        roomId: activeRoomId,
        speaker: {
          user_id: user?.id,
          username: user?.username,
          avatar_url: user?.avatarUrl,
          gender: user?.gender,
          role: user?.role,
          is_speaking: 0,
          is_muted: 0
        }
      });

      const checkVolume = () => {
        if (!analyserRef.current || !isOnAudioStage) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 20 ? 1 : 0;

        socketService.send({
          type: 'room:audio_speaker_speaking',
          roomId: activeRoomId,
          userId: user?.id,
          isSpeaking
        });

        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (err: any) {
      console.error('Audio stage error:', err);
      setAudioError('يرجى منح إذن الميكروفون للصعود للمنصة الصوتية');
    }
  };

  const leaveAudioStage = async () => {
    if (!activeRoomId || !isOnAudioStage) return;
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      await apiRequest(`/rooms/${activeRoomId}/audio-stage/leave`, { method: 'POST' });
      setIsOnAudioStage(false);
      setIsMicMuted(false);

      socketService.send({
        type: 'room:audio_speaker_leave',
        roomId: activeRoomId,
        userId: user?.id
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleMicMute = async () => {
    if (!activeRoomId || !isOnAudioStage) return;
    const newMuted = !isMicMuted;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !newMuted;
      });
    }
    setIsMicMuted(newMuted);

    try {
      await apiRequest(`/rooms/${activeRoomId}/audio-stage/mute`, {
        method: 'POST',
        body: JSON.stringify({ isMuted: newMuted ? 1 : 0 })
      });
      socketService.send({
        type: 'room:audio_speaker_mute',
        roomId: activeRoomId,
        userId: user?.id,
        isMuted: newMuted ? 1 : 0
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim() || !activeRoomId) return;

    const content = roomInput.trim();
    setRoomInput('');

    try {
      const res = await apiRequest<{ success: boolean; message: RoomMessage }>(
        `/rooms/${activeRoomId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content })
        }
      );
      setRoomMessages(prev => [...prev, res.message]);
      scrollToBottom();
      socketService.send({
        type: 'room:message',
        roomId: activeRoomId,
        message: res.message
      });
    } catch (err) {
      console.error('Failed to send room message:', err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    setCreateLoading(true);
    setCreateError('');
    try {
      const res = await apiRequest<{ success: boolean; roomId: string }>('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoomName.trim(),
          description: newRoomDesc.trim(),
          category: newRoomCategory,
          rules: newRoomRules,
          isPrivate: newRoomPrivate
        })
      });

      setCreateModalOpen(false);
      setNewRoomName('');
      setNewRoomDesc('');
      setNewRoomRules('');
      await fetchRooms();
      enterRoom(res.roomId);
    } catch (err: any) {
      setCreateError(err.message || 'فشل إنشاء المجلس');
    } finally {
      setCreateLoading(false);
    }
  };

  const canCreateRoom = user?.role === 'owner' || user?.role === 'admin';

  return (
    <div className="space-y-4 animate-in fade-in" dir="rtl">
      {/* Rooms Directory Header */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-teal-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Compass className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-cairo font-black text-white">
              الغرف والمجالس الحوارية
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            مساحات حوارية جماعية متخصصة للنقاش الراقي وتبادل الأفكار والصعود للمنصة الصوتية الحية.
          </p>
        </div>

        {canCreateRoom && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-teal-600/20 shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء مجلس جديد</span>
          </button>
        )}
      </div>

      {/* DUAL-PANE SIDE-BY-SIDE VIEW (Like Online Users & Chat) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* RIGHT (RTL): SIDE LIST OF ROOMS */}
        <div className={`space-y-3 ${activeRoomId ? 'hidden lg:block lg:col-span-4' : 'col-span-12'}`}>
          <div className="p-3 rounded-2xl bg-[#090b10] border border-neutral-800 flex items-center justify-between">
            <span className="font-cairo font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-teal-400" />
              قائمة المجالس المتاحة
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/50 font-bold">
              {rooms.length} مجلس
            </span>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-24 rounded-2xl bg-neutral-900/40 border border-neutral-800 animate-pulse" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-[#090b10] border border-neutral-800 space-y-3">
              <Compass className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="font-cairo font-bold text-sm text-white">لا توجد مجالس منشأة حتى الآن</h3>
              <p className="text-xs text-neutral-400 font-tajawal">
                يتم إنشاء المجالس حصرياً من قبل مالك المنصة والإدارة.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {rooms.map(room => {
                const isSelected = room.id === activeRoomId;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => enterRoom(room.id)}
                    className={`w-full text-right p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'border-teal-500 bg-[#0f1722] ring-2 ring-teal-500/40 shadow-lg shadow-teal-950/50'
                        : 'border-neutral-800/80 bg-[#0c0f16] hover:bg-[#111520] hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/50 font-bold">
                        {room.category}
                      </span>
                      {room.is_private === 1 && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    </div>

                    <div>
                      <h3 className="font-cairo font-bold text-sm text-white">{room.name}</h3>
                      <p className="text-xs text-neutral-400 line-clamp-1 font-tajawal mt-0.5">
                        {room.description || 'مجلس حواري راقٍ لتبادل الرأي'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-400 w-full">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-teal-400" />
                        {room.member_count || 1} حاضر
                      </span>
                      <span className="text-teal-400 font-bold">
                        {isSelected ? 'المجلس الحالي ✓' : 'دخول المجلس ←'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* LEFT (RTL): ACTIVE ROOM CONVERSATION & AUDIO STAGE */}
        {activeRoomId && activeRoom ? (
          <div className="col-span-12 lg:col-span-8 h-[calc(100vh-12rem)] min-h-[550px] rounded-3xl bg-[#090b10] border border-neutral-800 flex flex-col overflow-hidden shadow-2xl">
            {/* Active Room Top Bar */}
            <div className="h-16 px-4 sm:px-6 border-b border-neutral-800/80 bg-[#07090e] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveRoomId(null)}
                  className="lg:hidden text-xs text-neutral-300 hover:text-white px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer"
                >
                  ← العودة للمجالس
                </button>
                <div>
                  <h2 className="font-cairo font-black text-base sm:text-lg text-white flex items-center gap-2">
                    {activeRoom.name}
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800/50">
                      {activeRoom.category}
                    </span>
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Users className="w-4 h-4 text-teal-400" />
                <span>{roomMembers.length} حاضر</span>
              </div>
            </div>

            {/* Live Audio Room Stage */}
            <div className="bg-gradient-to-r from-[#0c1017] via-[#0f1420] to-[#0c1017] border-b border-neutral-800/80 px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white font-cairo">
                    <Radio className="w-3.5 h-3.5 text-teal-400" />
                    <span>المنصة الصوتية الحية</span>
                  </div>
                </div>

                {/* Speakers Avatars List */}
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {audioSpeakers.length === 0 ? (
                    <span className="text-[11px] text-neutral-500 font-tajawal">المايك متاح للحاضرين في المجلس</span>
                  ) : (
                    audioSpeakers.map(spk => {
                      const isTalking = spk.is_speaking === 1;
                      const isMuted = spk.is_muted === 1;
                      return (
                        <div
                          key={spk.user_id}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/90 border border-neutral-700/60 transition-all shrink-0"
                        >
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all relative ${
                              isTalking
                                ? 'ring-2 ring-emerald-400 ring-offset-1 ring-offset-neutral-900 bg-emerald-950 text-emerald-300'
                                : spk.gender === 'female'
                                ? 'bg-rose-950 text-rose-300'
                                : 'bg-teal-950 text-teal-300'
                            }`}
                          >
                            {spk.username.slice(0, 1).toUpperCase()}
                            {isTalking && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            )}
                          </div>
                          <span className="text-[11px] font-tajawal font-medium text-neutral-200 max-w-[80px] truncate">
                            {spk.username}
                          </span>
                          {isMuted ? (
                            <MicOff className="w-3 h-3 text-rose-400 shrink-0" />
                          ) : (
                            <Mic className={`w-3 h-3 shrink-0 ${isTalking ? 'text-emerald-400 animate-bounce' : 'text-neutral-400'}`} />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Stage Controls */}
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                {audioError && (
                  <span className="text-[11px] text-rose-400 font-tajawal truncate max-w-xs">{audioError}</span>
                )}
                {!isOnAudioStage ? (
                  <button
                    onClick={joinAudioStage}
                    className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-600/20 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>الصعود للمنصة الصوتية</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleMicMute}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isMicMuted
                          ? 'bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/60'
                          : 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/60'
                      }`}
                    >
                      {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>{isMicMuted ? 'إلغاء الكتم' : 'كتم المايك'}</span>
                    </button>
                    <button
                      onClick={leaveAudioStage}
                      className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>مغادرة المنصة</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Room Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
              {roomMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-teal-950/40 border border-teal-800/40 flex items-center justify-center text-teal-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="font-cairo font-bold text-white text-base">المجلس مفتوح للحديث</h3>
                  <p className="text-xs text-neutral-400 font-tajawal max-w-sm">
                    ابدأ المحادثة وشارك أفكارك مع الحاضرين في المجلس الآن!
                  </p>
                </div>
              ) : (
                roomMessages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  const isFemale = msg.gender === 'female';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isFemale ? 'bg-rose-950 text-rose-300' : 'bg-sky-950 text-sky-300'
                        }`}
                      >
                        {msg.username.slice(0, 1).toUpperCase()}
                      </div>

                      <div className={`space-y-1 max-w-[80%] ${isMe ? 'text-left' : 'text-right'}`}>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                          <span className="font-bold text-white">{msg.username}</span>
                          {isUserOwner({ role: msg.role, username: msg.username }) && (
                            <OwnerBadge size="xs" />
                          )}
                          <span>·</span>
                          <span>{new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-sm font-tajawal leading-relaxed ${
                            isMe
                              ? 'bg-teal-600 text-white rounded-tr-none'
                              : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-[#07090e] border-t border-neutral-800 flex gap-2">
              <input
                type="text"
                value={roomInput}
                onChange={e => setRoomInput(e.target.value)}
                placeholder="اكتب رسالتك في المجلس..."
                className="flex-1 bg-neutral-900/80 border border-neutral-800 focus:border-teal-500 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none font-tajawal"
              />
              <button
                type="submit"
                disabled={!roomInput.trim()}
                className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-teal-600/20"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">إرسال</span>
              </button>
            </form>
          </div>
        ) : null}
      </div>

      {/* Create Room Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0e1017] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-cairo font-bold text-lg text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-teal-400" />
                إنشاء مجلس حواري جديد
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">اسم المجلس</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="مثال: مجلس شعراء وأدباء فضفضه"
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">التصنيف</label>
                <select
                  value={newRoomCategory}
                  onChange={e => setNewRoomCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm"
                >
                  {ROOM_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">الوصف</label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  placeholder="نبذة عن موضوع النقاش في هذا المجلس"
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">قوانين المجلس (اختياري)</label>
                <input
                  type="text"
                  value={newRoomRules}
                  onChange={e => setNewRoomRules(e.target.value)}
                  placeholder="مثال: يمنع الجدال السياسي، احترام الجميع شرط أساسي"
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-lg shadow-teal-600/20 cursor-pointer disabled:opacity-50"
              >
                {createLoading ? 'جاري الإنشاء...' : 'نشر المجلس الآن'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
