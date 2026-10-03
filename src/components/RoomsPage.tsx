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
      setRooms(res.rooms);
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
      setRoomMessages(res.messages);
      setRoomMembers(res.members);
      scrollToBottom();
    } catch (err) {
      console.error('Error entering room:', err);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    fetchRooms();

    // Listen for room messages
    const unsub = socketService.on('room:message', (data: any) => {
      if (data.roomId === activeRoomId) {
        setRoomMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
    });

    const unsubTyping = socketService.on('room:typing', (data: any) => {
      if (data.roomId === activeRoomId) {
        setPartnerTyping(data.username);
        setTimeout(() => setPartnerTyping(null), 2500);
      }
    });

    // Listen for live audio room state
    const unsubAudio = socketService.on('audio:state', (data: any) => {
      if (data && data.roomId === activeRoomId) {
        setAudioSpeakers(data.speakers || []);
        // Check if current user is still in speaker list
        if (user && data.speakers) {
          const amSpeaker = data.speakers.some((s: any) => s.user_id === user.id);
          if (!amSpeaker && isOnAudioStage) {
            leaveAudioStage();
          }
        }
      }
    });

    return () => {
      unsub();
      unsubTyping();
      unsubAudio();
      leaveAudioStage();
    };
  }, [activeRoomId, user?.id]);

  const joinAudioStage = async () => {
    if (!activeRoomId) return;
    setAudioError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyserRef.current = analyser;

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        let wasSpeaking = false;

        const checkVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) sum += buffer[i];
          const avg = sum / buffer.length;
          const isSpeaking = avg > 25;

          if (isSpeaking !== wasSpeaking) {
            wasSpeaking = isSpeaking;
            socketService.send({
              type: 'audio:speaking_state',
              roomId: activeRoomId,
              isSpeaking
            });
          }
          animFrameRef.current = requestAnimationFrame(checkVolume);
        };
        animFrameRef.current = requestAnimationFrame(checkVolume);
      }

      socketService.send({ type: 'audio:join', roomId: activeRoomId });
      setIsOnAudioStage(true);
      setIsMicMuted(false);
    } catch (err: any) {
      console.warn('Audio device access notice:', err);
      setAudioError('يرجى السماح بالوصول إلى الميكروفون للصعود للمنصة الصوتية.');
      setTimeout(() => setAudioError(null), 5000);
    }
  };

  const toggleMicMute = () => {
    if (localStreamRef.current) {
      const newMuted = !isMicMuted;
      localStreamRef.current.getAudioTracks().forEach(t => {
        t.enabled = !newMuted;
      });
      setIsMicMuted(newMuted);
      if (activeRoomId) {
        socketService.send({ type: 'audio:mute_toggle', roomId: activeRoomId });
      }
    }
  };

  const leaveAudioStage = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (activeRoomId) {
      socketService.send({ type: 'audio:leave', roomId: activeRoomId });
    }
    setIsOnAudioStage(false);
    setIsMicMuted(false);
  };

  const handleSendRoomMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim() || !activeRoomId) return;

    const content = roomInput;
    setRoomInput('');

    try {
      const res = await apiRequest(`/rooms/${activeRoomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, type: 'text' })
      });
      setRoomMessages(prev => [...prev, res.message]);
      scrollToBottom();
    } catch (err: any) {
      alert(err.message || 'خطأ في إرسال الرسالة');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    try {
      const res = await apiRequest('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoomName,
          description: newRoomDesc,
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
    <div className="space-y-6 animate-in fade-in">
      {/* Rooms Directory Header */}
      {!activeRoomId && (
        <div className="p-6 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-teal-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Compass className="w-6 h-6 text-teal-400" />
              <h1 className="text-2xl sm:text-3xl font-cairo font-black text-white">الغرف والمجالس الحوارية</h1>
            </div>
            <p className="text-sm text-neutral-400 font-tajawal max-w-xl">
              مساحات حوارية جماعية متخصصة للنقاش الراقي وتبادل الأفكار. هذا القسم منفصل كلياً عن المتصلين الآن.
            </p>
          </div>

          {canCreateRoom && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-teal-600/20 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء مجلس حواري جديد</span>
            </button>
          )}
        </div>
      )}

      {/* ACTIVE ROOM VIEW */}
      {activeRoomId && activeRoom ? (
        <div className="h-[calc(100vh-10rem)] rounded-3xl bg-[#090b10] border border-neutral-800 flex flex-col md:flex-row overflow-hidden shadow-2xl">
          {/* Main Chat Stream */}
          <div className="flex-1 flex flex-col justify-between">
            {/* Room Header */}
            <div className="h-18 px-6 border-b border-neutral-800/80 bg-[#07090e] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveRoomId(null)}
                  className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded bg-neutral-900 border border-neutral-800 cursor-pointer"
                >
                  ← خروج من المجلس
                </button>
                <div>
                  <h2 className="font-cairo font-black text-lg text-white flex items-center gap-2">
                    {activeRoom.name}
                    <span className="text-xs px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800/50">
                      {activeRoom.category}
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-400 truncate max-w-md font-tajawal">
                    {activeRoom.description || 'مجلس حواري راقٍ لتبادل الرأي والفضفضة'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <Users className="w-4 h-4 text-teal-400" />
                <span>{roomMembers.length} حاضر في المجلس</span>
              </div>
            </div>

            {/* Live Audio Room Stage (Free WebRTC & Web Audio Integration) */}
            <div className="bg-gradient-to-r from-[#0c1017] via-[#0f1420] to-[#0c1017] border-b border-neutral-800/80 px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
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
                    audioSpeakers.map((spk) => {
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
                          {isUserOwner({ role: spk.role, username: spk.username }) && (
                            <OwnerBadge size="xs" showLabel={false} />
                          )}
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

            {/* Room Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {roomMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-teal-950/40 border border-teal-800/40 flex items-center justify-center text-teal-400">
                    <MessageSquare className="w-7 h-7" />
                  </div>
                  <h3 className="font-cairo font-bold text-white text-lg">المجلس مفتوح للحديث</h3>
                  <p className="text-xs text-neutral-400 max-w-sm font-tajawal">
                    كن أول من يفتتح الحوار في هذا المجلس بكلمات طيبة وفائدة للحاضرين.
                  </p>
                </div>
              ) : (
                roomMessages.map((m) => {
                  const isMine = m.sender_id === user?.id;
                  const isFemale = m.sender_gender === 'female';

                  return (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-cairo font-bold text-xs shrink-0 border ${
                        isFemale ? 'bg-rose-950/60 text-rose-300 border-rose-800/50' : 'bg-sky-950/60 text-sky-300 border-sky-800/50'
                      }`}>
                        {m.sender_username?.slice(0, 1).toUpperCase()}
                      </div>

                      <div className="space-y-1 max-w-[85%]">
                        <div className="flex items-center gap-2">
                          <span className={`font-cairo font-bold text-xs ${isFemale ? 'text-rose-300' : 'text-sky-300'}`}>
                            {m.sender_username}
                          </span>
                          {isUserOwner({ role: (m as any).sender_role || (m as any).senderRole, username: m.sender_username }) && (
                            <OwnerBadge size="xs" />
                          )}
                          <span className="text-[10px] text-neutral-500 font-tajawal">
                            {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                          isMine ? 'bg-teal-900/60 border border-teal-700/60 text-teal-100' : 'bg-neutral-900/80 border border-neutral-800 text-neutral-200'
                        }`}>
                          <p className="whitespace-pre-wrap font-tajawal">{m.content}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Room Input Bar */}
            <div className="p-4 border-t border-neutral-800/80 bg-[#07090e]">
              {partnerTyping && (
                <div className="text-[11px] text-teal-400 px-2 pb-1 animate-pulse font-tajawal">
                  {partnerTyping} يشارك الآن...
                </div>
              )}
              <form onSubmit={handleSendRoomMessage} className="flex items-center gap-2">
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value)}
                  placeholder="اكتب مشاركتك في المجلس..."
                  className="flex-1 px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-white placeholder:text-neutral-500 text-sm focus:outline-none focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={!roomInput.trim()}
                  className="p-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold transition-all shadow-lg shadow-teal-600/20 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>

          {/* Room Members & Rules Sidebar */}
          <div className="w-full md:w-64 border-r border-neutral-800/80 bg-[#07090e] p-4 flex flex-col space-y-4">
            {activeRoom.rules && (
              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200/90 font-tajawal space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-300">
                  <Shield className="w-3.5 h-3.5" />
                  قوانين المجلس
                </div>
                <p>{activeRoom.rules}</p>
              </div>
            )}

            <div className="font-cairo font-bold text-sm text-neutral-300 border-b border-neutral-800 pb-2 flex items-center justify-between">
              <span>الحاضرون في المجلس</span>
              <span className="text-xs text-teal-400 font-semibold">{roomMembers.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2">
              {roomMembers.map((m) => (
                <div key={m.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-900/40 border border-neutral-800/40">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    m.gender === 'female' ? 'bg-rose-950 text-rose-300' : 'bg-sky-950 text-sky-300'
                  }`}>
                    {m.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                      {m.username}
                      {m.room_role === 'owner' && <Crown className="w-3 h-3 text-amber-400" />}
                    </div>
                    <div className="text-[10px] text-neutral-500">{m.isOnline ? 'متصل' : 'غائب'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ROOMS DIRECTORY GRID */
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-44 rounded-3xl bg-neutral-900/40 border border-neutral-800 animate-pulse" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            /* ZERO DEMO ROOMS STATE (STRICT REQUIREMENT) */
            <div className="p-12 text-center rounded-3xl bg-neutral-900/30 border border-neutral-800/80 space-y-4 max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-teal-950/40 border border-teal-800/40 flex items-center justify-center text-teal-400 mx-auto">
                <Compass className="w-8 h-8" />
              </div>
              <h3 className="font-cairo font-bold text-xl text-white">لا توجد مجالس منشأة حتى الآن</h3>
              <p className="text-sm text-neutral-400 font-tajawal leading-relaxed">
                وفقاً لسياسة منصة فضفضه، لا يتم إنشاء غرف وهمية أو تجريبية. يتم إنشاء المجالس الحوارية حصرياً من قبل مالك المنصة (Hegazy) والإدارة.
              </p>
              {canCreateRoom && (
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="px-6 py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-lg shadow-teal-600/20 cursor-pointer"
                >
                  إنشاء أول مجلس الآن بصفتك إدارة
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  onClick={() => enterRoom(room.id)}
                  className="p-6 rounded-3xl bg-[#0e1017] hover:bg-[#121520] border border-neutral-800/80 hover:border-teal-700/60 transition-all cursor-pointer shadow-lg space-y-4 flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs px-3 py-1 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/50 font-bold">
                        {room.category}
                      </span>
                      {room.is_private === 1 && (
                        <Lock className="w-4 h-4 text-amber-400" />
                      )}
                    </div>

                    <div>
                      <h3 className="font-cairo font-black text-lg text-white group-hover:text-teal-400 transition-colors">
                        {room.name}
                      </h3>
                      <p className="text-xs text-neutral-400 line-clamp-2 mt-1 font-tajawal">
                        {room.description || 'انضم للمجلس للمشاركة في النقاش وطرح الآراء'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-900 flex items-center justify-between text-xs text-neutral-400">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-teal-400" />
                      {room.member_count || 1} عضو
                    </span>
                    <span className="text-teal-400 font-bold group-hover:-translate-x-1 transition-transform">
                      دخول المجلس ←
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Room Modal (Owner / Admin Only) */}
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
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="مثال: مجلس شعراء وأدباء فضفضه"
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">التصنيف</label>
                <select
                  value={newRoomCategory}
                  onChange={(e) => setNewRoomCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm"
                >
                  {ROOM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">الوصف</label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  placeholder="نبذة عن موضوع النقاش في هذا المجلس"
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">قوانين المجلس (اختياري)</label>
                <input
                  type="text"
                  value={newRoomRules}
                  onChange={(e) => setNewRoomRules(e.target.value)}
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
