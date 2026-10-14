import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Room, RoomMessage } from '../types';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Radio,
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
  Mic,
  MicOff,
  Video,
  VideoOff,
  Headphones,
  PhoneOff,
  Coins,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Tv,
  ArrowRight
} from 'lucide-react';

const ROOM_CATEGORIES = [
  'فضفضة عامة', 'أدب وشعر', 'تقنية وبرمجة', 'تجارب حياتية', 'ألعاب ومسابقات', 'تطوير الذات', 'موسيقى وفنون'
];

interface RoomParticipant {
  user_id: string;
  username: string;
  avatar_url?: string;
  gender?: string;
  role?: string;
  is_speaking: number;
  is_muted: number;
  is_camera_off?: number;
  stream?: MediaStream;
}

export const VoiceRoomsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [roomMessages, setRoomMessages] = useState<RoomMessage[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [roomInput, setRoomInput] = useState<string>('');
  const [pricingInfo, setPricingInfo] = useState<{ audioCostPerMinute: number; videoCostPerMinute: number }>({
    audioCostPerMinute: 2,
    videoCostPerMinute: 5
  });

  // Pre-join Confirmation Modal
  const [joinConfirmRoom, setJoinConfirmRoom] = useState<Room | null>(null);
  const [joinError, setJoinError] = useState<string>('');

  // Live Multi-Participant Audio / Video Stage
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [isOnStage, setIsOnStage] = useState<boolean>(false);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isCameraOff, setIsCameraOff] = useState<boolean>(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Real-time Session Billing Tracker
  const [sessionMinutes, setSessionMinutes] = useState<number>(0);
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);
  const [coinsSpent, setCoinsSpent] = useState<number>(0);
  const [depletedAlert, setDepletedAlert] = useState<string | null>(null);

  // References
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Create Room Modal State
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [newRoomName, setNewRoomName] = useState<string>('');
  const [newRoomDesc, setNewRoomDesc] = useState<string>('');
  const [newRoomCategory, setNewRoomCategory] = useState<string>('فضفضة عامة');
  const [newRoomType, setNewRoomType] = useState<'audio' | 'video'>('audio');
  const [newRoomCost, setNewRoomCost] = useState<number>(2);
  const [newRoomRules, setNewRoomRules] = useState<string>('');
  const [newRoomPrivate, setNewRoomPrivate] = useState<boolean>(false);
  const [newRoomPassword, setNewRoomPassword] = useState<string>('');
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMediaType, setFilterMediaType] = useState<'all' | 'audio' | 'video'>('all');

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ rooms: Room[]; pricing: { audioCostPerMinute: number; videoCostPerMinute: number } }>('/rooms?type=voice');
      setRooms(res.rooms || []);
      if (res.pricing) {
        setPricingInfo(res.pricing);
        if (newRoomType === 'audio') setNewRoomCost(res.pricing.audioCostPerMinute);
        else setNewRoomCost(res.pricing.videoCostPerMinute);
      }
    } catch (err) {
      console.error('Error fetching voice rooms:', err);
    } finally {
      setLoading(false);
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

  // Pre-join Room Handler
  const handleInitiateJoin = (room: Room) => {
    setJoinError('');
    setJoinConfirmRoom(room);
  };

  const handleConfirmJoin = async () => {
    if (!joinConfirmRoom) return;
    const room = joinConfirmRoom;
    const costPerMin = room.costPerMinute ?? (room.room_type === 'video' ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute);

    if (costPerMin > 0 && (user?.coins || 0) < costPerMin) {
      setJoinError(`رصيدك الحالي (${user?.coins || 0} كوينز) غير كافٍ. يتطلب الدخول ${costPerMin} كوينز على الأقل لدقيقة واحدة.`);
      return;
    }

    try {
      await apiRequest(`/rooms/${room.id}/join`, { method: 'POST' });
      setJoinConfirmRoom(null);
      await enterRoom(room.id);
    } catch (err: any) {
      setJoinError(err.message || 'فشل الانضمام للروم');
    }
  };

  const enterRoom = async (roomId: string) => {
    try {
      const res = await apiRequest<{ room: Room; messages: RoomMessage[]; members: any[] }>(
        `/rooms/${roomId}/messages`
      );
      setActiveRoomId(roomId);
      setActiveRoom(res.room);
      setRoomMessages(res.messages || []);
      setRoomMembers(res.members || []);
      setCoinsSpent(0);
      setSessionMinutes(0);
      setSessionSeconds(0);
      scrollToBottom();
    } catch (err) {
      console.error('Error entering voice room:', err);
    }
  };

  // Timer loop for active room participation duration
  useEffect(() => {
    if (activeRoomId) {
      timerIntervalRef.current = setInterval(() => {
        setSessionSeconds(sec => {
          if (sec + 1 >= 60) {
            setSessionMinutes(m => m + 1);
            return 0;
          }
          return sec + 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setSessionSeconds(0);
      setSessionMinutes(0);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeRoomId]);

  // WebRTC Peer Connection Factory (Full-Mesh for Audio & Video)
  const createPeerConnection = (remoteUserId: string): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(remoteUserId);
    if (pc && pc.connectionState !== 'closed' && pc.connectionState !== 'failed') {
      return pc;
    }

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch (e) {
          console.warn('Track add error:', e);
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && activeRoomId) {
        socketService.send({
          type: 'room:webrtc_signal',
          roomId: activeRoomId,
          targetUserId: remoteUserId,
          signal: { candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      setParticipants(prev =>
        prev.map(p => (p.user_id === remoteUserId ? { ...p, stream: remoteStream } : p))
      );
    };

    peerConnectionsRef.current.set(remoteUserId, pc);
    return pc;
  };

  // WebSockets for Real-time chat, participants stage, WebRTC signaling & billing
  useEffect(() => {
    if (!activeRoomId) return;

    socketService.send({ type: 'room:join', roomId: activeRoomId });

    apiRequest<{ speakers: RoomParticipant[] }>(`/rooms/${activeRoomId}/audio-speakers`)
      .then(res => setParticipants(res.speakers || []))
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
        setParticipants(prev => prev.filter(s => s.user_id !== data.userId));
        if (peerConnectionsRef.current.has(data.userId)) {
          peerConnectionsRef.current.get(data.userId)?.close();
          peerConnectionsRef.current.delete(data.userId);
        }
      }
    });

    const unsubStageJoin = socketService.on('room:audio_speaker_join', async (data: any) => {
      if (data.roomId === activeRoomId && data.speaker) {
        setParticipants(prev => {
          if (prev.some(p => p.user_id === data.speaker.user_id)) return prev;
          return [...prev, data.speaker];
        });

        if (localStreamRef.current && data.speaker.user_id !== user?.id) {
          try {
            const pc = createPeerConnection(data.speaker.user_id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketService.send({
              type: 'room:webrtc_signal',
              roomId: activeRoomId,
              targetUserId: data.speaker.user_id,
              signal: offer
            });
          } catch (err) {
            console.error('Error initiating WebRTC offer:', err);
          }
        }
      }
    });

    const unsubStageLeave = socketService.on('room:audio_speaker_leave', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setParticipants(prev => prev.filter(s => s.user_id !== data.userId));
        if (peerConnectionsRef.current.has(data.userId)) {
          peerConnectionsRef.current.get(data.userId)?.close();
          peerConnectionsRef.current.delete(data.userId);
        }
      }
    });

    const unsubSpeaking = socketService.on('room:audio_speaker_speaking', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setParticipants(prev =>
          prev.map(p => (p.user_id === data.userId ? { ...p, is_speaking: data.isSpeaking ? 1 : 0 } : p))
        );
      }
    });

    const unsubMediaState = socketService.on('room:media_state_change', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setParticipants(prev =>
          prev.map(p =>
            p.user_id === data.userId
              ? {
                  ...p,
                  is_muted: data.isMuted !== undefined ? (data.isMuted ? 1 : 0) : p.is_muted,
                  is_camera_off: data.isCameraOff !== undefined ? (data.isCameraOff ? 1 : 0) : p.is_camera_off
                }
              : p
          )
        );
      }
    });

    const unsubBilled = socketService.on('room:billed', (data: any) => {
      if (data.roomId === activeRoomId) {
        setCoinsSpent(data.totalSpent || (prev => prev + data.cost));
        refreshUser();
      }
    });

    const unsubDepleted = socketService.on('room:balance_depleted', (data: any) => {
      if (data.roomId === activeRoomId) {
        leaveStage();
        setActiveRoomId(null);
        setActiveRoom(null);
        setDepletedAlert(data.message || 'تم إنهاء مشاركتك في الروم لنفاد رصيد الكوينز في محفظتك. يرجى شحن الرصيد للمتابعة.');
        refreshUser();
      }
    });

    const unsubWebRTC = socketService.on('room:webrtc_signal', async (data: any) => {
      if (data.roomId === activeRoomId && data.fromUserId) {
        try {
          let pc = peerConnectionsRef.current.get(data.fromUserId);
          if (!pc || pc.connectionState === 'closed') {
            pc = createPeerConnection(data.fromUserId);
          }

          if (data.signal) {
            if (data.signal.type === 'offer') {
              await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socketService.send({
                type: 'room:webrtc_signal',
                roomId: activeRoomId,
                targetUserId: data.fromUserId,
                signal: answer
              });
            } else if (data.signal.type === 'answer') {
              await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            } else if (data.signal.candidate) {
              await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            }
          }
        } catch (e) {
          console.error('WebRTC error handling signal:', e);
        }
      }
    });

    return () => {
      leaveStage();
      socketService.send({ type: 'room:leave', roomId: activeRoomId });
      apiRequest(`/rooms/${activeRoomId}/leave`, { method: 'POST' }).catch(() => {});
      unsubMsg();
      unsubJoin();
      unsubLeave();
      unsubStageJoin();
      unsubStageLeave();
      unsubSpeaking();
      unsubMediaState();
      unsubBilled();
      unsubDepleted();
      unsubWebRTC();
    };
  }, [activeRoomId]);

  const joinStage = async () => {
    if (!activeRoomId || !activeRoom) return;
    setMediaError(null);
    const isVideoRoom = activeRoom.room_type === 'video';

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: isVideoRoom
          ? {
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: 'user'
            }
          : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && isVideoRoom) {
        localVideoRef.current.srcObject = stream;
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      await apiRequest(`/rooms/${activeRoomId}/audio-stage/join`, { method: 'POST' });
      setIsOnStage(true);
      setIsMicMuted(false);
      setIsCameraOff(false);

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
          is_muted: 0,
          is_camera_off: 0
        }
      });

      participants.forEach(async (p) => {
        if (p.user_id !== user?.id) {
          try {
            const pc = createPeerConnection(p.user_id);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketService.send({
              type: 'room:webrtc_signal',
              roomId: activeRoomId,
              targetUserId: p.user_id,
              signal: offer
            });
          } catch (e) {
            console.error('Peer connection setup error:', e);
          }
        }
      });

      const checkVolume = () => {
        if (!analyserRef.current || !isOnStage) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const avg = sum / dataArray.length;
        const isSpeaking = avg > 22 ? 1 : 0;

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
      console.error('Media Stage Error:', err);
      setMediaError('يرجى منح إذن الميكروفون والكاميرا للصعود للمنصة.');
    }
  };

  const leaveStage = async () => {
    if (!activeRoomId || !isOnStage) return;
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

      peerConnectionsRef.current.forEach(pc => pc.close());
      peerConnectionsRef.current.clear();

      await apiRequest(`/rooms/${activeRoomId}/audio-stage/leave`, { method: 'POST' });
      setIsOnStage(false);
      setIsMicMuted(false);
      setIsCameraOff(false);

      setParticipants(prev => prev.filter(p => p.user_id !== user?.id));

      socketService.send({
        type: 'room:audio_speaker_leave',
        roomId: activeRoomId,
        userId: user?.id
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleMic = () => {
    if (!isOnStage || !localStreamRef.current) return;
    const newMuted = !isMicMuted;
    localStreamRef.current.getAudioTracks().forEach(t => {
      t.enabled = !newMuted;
    });
    setIsMicMuted(newMuted);

    setParticipants(prev =>
      prev.map(p => (p.user_id === user?.id ? { ...p, is_muted: newMuted ? 1 : 0 } : p))
    );

    socketService.send({
      type: 'room:media_state_change',
      roomId: activeRoomId,
      isMuted: newMuted
    });
  };

  const toggleCamera = () => {
    if (!isOnStage || !localStreamRef.current) return;
    const newOff = !isCameraOff;
    localStreamRef.current.getVideoTracks().forEach(t => {
      t.enabled = !newOff;
    });
    setIsCameraOff(newOff);

    setParticipants(prev =>
      prev.map(p => (p.user_id === user?.id ? { ...p, is_camera_off: newOff ? 1 : 0 } : p))
    );

    socketService.send({
      type: 'room:media_state_change',
      roomId: activeRoomId,
      isCameraOff: newOff
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim() || !activeRoomId) return;

    try {
      const msg = await apiRequest<RoomMessage>(`/rooms/${activeRoomId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: roomInput.trim() })
      });

      socketService.send({
        type: 'room:message',
        roomId: activeRoomId,
        message: msg
      });

      setRoomInput('');
      scrollToBottom();
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      setCreateError('يرجى كتابة اسم الروم');
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError('');
      const res = await apiRequest<{ room: Room }>('/rooms', {
        method: 'POST',
        body: JSON.stringify({
          name: newRoomName.trim(),
          description: newRoomDesc.trim(),
          category: newRoomCategory,
          roomType: newRoomType,
          costPerMinute: newRoomCost,
          isPrivate: newRoomPrivate,
          password: newRoomPassword,
          rules: newRoomRules
        })
      });

      setCreateModalOpen(false);
      setNewRoomName('');
      setNewRoomDesc('');
      setNewRoomRules('');
      setNewRoomPassword('');
      setNewRoomPrivate(false);
      fetchRooms();
      if (res.room) {
        enterRoom(res.room.id);
      }
    } catch (err: any) {
      setCreateError(err.message || 'فشل إنشاء الروم الصوتي/المرئي');
    } finally {
      setCreateLoading(false);
    }
  };

  const filteredRooms = rooms.filter(r => {
    const matchCat = filterCategory === 'all' || r.category === filterCategory;
    const matchType = filterMediaType === 'all' || r.room_type === filterMediaType;
    return matchCat && matchType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-tajawal">
      {/* Depleted Alert Modal */}
      {depletedAlert && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-center justify-between shadow-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{depletedAlert}</span>
          </div>
          <button
            onClick={() => setDepletedAlert(null)}
            className="px-3 py-1 bg-rose-900/60 hover:bg-rose-900 text-white rounded-xl text-xs font-bold cursor-pointer"
          >
            حسناً
          </button>
        </div>
      )}

      {/* Pre-join Confirmation Modal */}
      {joinConfirmRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0e1017] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-850 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  {joinConfirmRoom.room_type === 'video' ? <Video className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </div>
                <h3 className="font-cairo font-bold text-base text-white">
                  الدخول إلى {joinConfirmRoom.name}
                </h3>
              </div>
              <button
                onClick={() => setJoinConfirmRoom(null)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-neutral-300 leading-relaxed">
              <div className="p-3.5 rounded-2xl bg-[#07090e] border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">نوع الروم:</span>
                  <span className="font-bold text-white">
                    {joinConfirmRoom.room_type === 'video' ? '📹 مرئي (صوت وصورة)' : '🎙️ صوتي جماعي'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">تكلفة المشاركة:</span>
                  <span className="font-bold text-amber-400 font-mono">
                    {joinConfirmRoom.costPerMinute ?? (joinConfirmRoom.room_type === 'video' ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute)} كوينز / دقيقة
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">رصيدك المتاح:</span>
                  <span className="font-bold text-emerald-400 font-mono">{user?.coins || 0} كوينز</span>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800 flex items-start gap-2">
                <Coins className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  يتم احتساب وخصم التكلفة تلقائياً من محفظتك كل 60 ثانية استناداً للخادم طوال فترة وجودك داخل الروم.
                </span>
              </div>

              {joinError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
                  {joinError}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConfirmJoin}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-neutral-950 font-cairo font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 cursor-pointer active:scale-95 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد الدخول والمتابعة</span>
              </button>
              <button
                type="button"
                onClick={() => setJoinConfirmRoom(null)}
                className="px-4 py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0c1322] via-[#09151e] to-[#0d1620] border border-teal-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-400 text-xs font-bold">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>الرومات الصوتية والمرئية المباشرة</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white font-cairo">
              الرومات الصوتية والمرئية — Fadfada Stages
            </h1>
            <p className="text-neutral-300 text-xs sm:text-sm max-w-xl leading-relaxed">
              انضم إلى مساحات حوارية حية صوتية وبثوث فيديو تفاعلية بدعم شبكة WebRTC المباشرة، مع احتساب عادل بالدقيقة.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-neutral-950 font-cairo font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-teal-500/20 cursor-pointer active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء روم صوتي أو مرئي</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content Area: Room Active OR Rooms Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ROOMS LIST (When no active room or side drawer) */}
        {!activeRoom ? (
          <div className="lg:col-span-3 space-y-5">
            {/* Filter Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                <button
                  onClick={() => setFilterMediaType('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    filterMediaType === 'all'
                      ? 'bg-teal-500 text-neutral-950 shadow-md'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setFilterMediaType('audio')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    filterMediaType === 'audio'
                      ? 'bg-teal-500 text-neutral-950 shadow-md'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>رومات صوتية</span>
                </button>
                <button
                  onClick={() => setFilterMediaType('video')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                    filterMediaType === 'video'
                      ? 'bg-teal-500 text-neutral-950 shadow-md'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                  }`}
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>رومات مرئية (فيديو)</span>
                </button>
              </div>

              <div className="text-xs text-neutral-400 font-tajawal">
                العدد المتاح: <span className="text-teal-400 font-bold">{filteredRooms.length}</span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-neutral-400 font-tajawal text-sm">
                جاري تحميل الرومات الصوتية والمرئية...
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-20 bg-[#0b0e14] border border-neutral-850 rounded-3xl p-8 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto">
                  <Radio className="w-8 h-8" />
                </div>
                <h3 className="font-cairo font-bold text-lg text-white">لا توجد رومات صوتية أو مرئية حالياً</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  كن أول من يبدأ مساحة حوارية أو بث فيديو تفاعلي وادعُ أصدقاءك ومجتمع فضفضه للمشاركة!
                </p>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء أول روم صوتي</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRooms.map(room => {
                  const isVideo = room.room_type === 'video';
                  const costPerMin = room.costPerMinute ?? (isVideo ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute);

                  return (
                    <div
                      key={room.id}
                      className="group p-5 rounded-3xl bg-[#0c1017] hover:bg-[#0f141e] border border-neutral-800 hover:border-teal-500/40 transition-all flex flex-col justify-between space-y-4 shadow-xl"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 ${
                              isVideo
                                ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                                : 'bg-teal-950/80 text-teal-300 border border-teal-800/60'
                            }`}
                          >
                            {isVideo ? <Video className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                            <span>{isVideo ? 'روم فيديو' : 'روم صوتي'}</span>
                          </span>

                          <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-800/50">
                            {costPerMin} كوينز/د
                          </span>
                        </div>

                        <h3 className="font-cairo font-bold text-base text-white group-hover:text-teal-300 transition-colors line-clamp-1">
                          {room.name}
                        </h3>

                        {room.description && (
                          <p className="text-xs text-neutral-400 font-tajawal line-clamp-2 leading-relaxed">
                            {room.description}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-neutral-850 flex items-center justify-between text-xs text-neutral-400 font-tajawal">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{room.member_count || 0}</span>
                          </span>
                          <span className="text-neutral-500">·</span>
                          <span className="text-[11px] text-neutral-400">{room.category}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleInitiateJoin(room)}
                          className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer active:scale-95 shadow-sm"
                        >
                          <span>انضمام</span>
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE ROOM CONTAINER */
          <div className="lg:col-span-3 bg-[#0a0d14] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[600px]">
            {/* Active Room Top Header */}
            <div className="p-4 sm:p-5 bg-[#0e121b] border-b border-neutral-800 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    leaveStage();
                    setActiveRoomId(null);
                    setActiveRoom(null);
                  }}
                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                  title="العودة لقائمة الرومات"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
                <div>
                  <h2 className="font-cairo font-black text-base sm:text-lg text-white flex items-center gap-2">
                    <span>{activeRoom.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        activeRoom.room_type === 'video'
                          ? 'bg-purple-950 text-purple-300 border border-purple-800'
                          : 'bg-teal-950 text-teal-300 border border-teal-800'
                      }`}
                    >
                      {activeRoom.room_type === 'video' ? '📹 فيديو جماعي' : '🎙️ صوتي جماعي'}
                    </span>
                  </h2>
                  <div className="text-[11px] text-neutral-400 font-tajawal flex items-center gap-2">
                    <span>{roomMembers.length} حاضر بالروم</span>
                    <span>·</span>
                    <span className="text-amber-400 font-mono">
                      السعر: {activeRoom.costPerMinute ?? (activeRoom.room_type === 'video' ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute)} كوينز/دقيقة
                    </span>
                  </div>
                </div>
              </div>

              {/* Real-time Billed Duration & Spent Indicator */}
              <div className="flex items-center gap-3 bg-neutral-950/80 px-3 py-1.5 rounded-2xl border border-neutral-800 text-xs font-mono">
                <div className="flex items-center gap-1.5 text-neutral-300" title="مدة المشاركة الحالية">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>
                    {String(sessionMinutes).padStart(2, '0')}:{String(sessionSeconds).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-amber-400 font-bold" title="إجمالي الكوينز المخصومة">
                  <Coins className="w-3.5 h-3.5" />
                  <span>{coinsSpent} كوينز</span>
                </div>

                <div className="text-[11px] text-emerald-400 font-tajawal">
                  رصيدك: {user?.coins || 0}
                </div>
              </div>
            </div>

            {/* MULTI-PARTICIPANT STAGE */}
            <div className="bg-gradient-to-b from-[#0c0f18] to-[#080b11] border-b border-neutral-800 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="font-cairo font-bold text-xs text-white">
                    منصة البث المباشرة ({participants.length} على المنصة)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/60 font-tajawal">
                    WebRTC P2P Mesh · مشاركة حية متعددة
                  </span>
                </div>

                {mediaError && (
                  <span className="text-[11px] text-rose-400 font-tajawal truncate max-w-xs">{mediaError}</span>
                )}
              </div>

              {/* Technical Notice */}
              <div className="text-[11px] text-neutral-400 font-tajawal bg-[#07090e] px-3 py-2 rounded-xl border border-neutral-850 flex items-start gap-2">
                <span className="text-teal-400 shrink-0">💡</span>
                <span className="leading-relaxed">
                  <strong>تقنية المنصة:</strong> تعتمد على شبكة WebRTC المباشرة لمحادثة صوتية ومرئية فورية عالية النقاوة. اضغط على «الصعود للمنصة» للبدء بالمشاركة الحية.
                </span>
              </div>

              {/* Participants Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto custom-scrollbar p-1">
                {participants.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-neutral-500 font-tajawal text-xs border border-dashed border-neutral-800 rounded-2xl">
                    المنصة شاغرة حالياً. اضغط على «الصعود للمنصة» لبدء التحدث والمشاركة!
                  </div>
                ) : (
                  participants.map((p, idx) => {
                    const isMe = p.user_id === user?.id;
                    const isSpeaking = p.is_speaking === 1;
                    const isMuted = p.is_muted === 1;
                    const isCamOff = p.is_camera_off === 1;
                    const isVideo = activeRoom.room_type === 'video';

                    return (
                      <div
                        key={p.user_id || idx}
                        className={`relative rounded-2xl overflow-hidden border transition-all h-36 flex flex-col justify-between p-2.5 ${
                          isSpeaking
                            ? 'border-emerald-500 bg-[#0f1d18] ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-950/40'
                            : 'border-neutral-800 bg-[#0c1017]'
                        }`}
                      >
                        {/* Video Feed: Local */}
                        {isVideo && !isCamOff && isMe && (
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                          />
                        )}

                        {/* Video Feed: Remote */}
                        {isVideo && !isCamOff && !isMe && p.stream && (
                          <video
                            autoPlay
                            playsInline
                            ref={el => {
                              if (el && p.stream && el.srcObject !== p.stream) {
                                el.srcObject = p.stream;
                              }
                            }}
                            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                          />
                        )}

                        {/* Top Overlay */}
                        <div className="relative z-10 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-white font-cairo bg-black/70 px-2 py-0.5 rounded-lg truncate max-w-[90px]">
                            {isMe ? 'أنت' : p.username}
                          </span>
                          <div className="flex items-center gap-1">
                            {isMuted ? (
                              <MicOff className="w-3.5 h-3.5 text-rose-400 bg-black/60 p-0.5 rounded" />
                            ) : (
                              <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-emerald-400 animate-pulse' : 'text-neutral-400'} bg-black/60 p-0.5 rounded`} />
                            )}
                          </div>
                        </div>

                        {/* Center Avatar */}
                        {(!isVideo || isCamOff || (!isMe && !p.stream)) && (
                          <div className="relative z-10 my-auto flex flex-col items-center justify-center space-y-1">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm text-white shadow-md transition-all ${
                                isSpeaking
                                  ? 'bg-emerald-600 ring-4 ring-emerald-400/50 scale-105'
                                  : p.gender === 'female'
                                  ? 'bg-rose-950 border border-rose-800'
                                  : 'bg-teal-950 border border-teal-800'
                              }`}
                            >
                              {p.avatar_url ? (
                                <img src={p.avatar_url} alt="" className="w-full h-full object-cover rounded-2xl" />
                              ) : (
                                p.username?.slice(0, 2).toUpperCase()
                              )}
                            </div>
                          </div>
                        )}

                        {/* Speaking Glow Wave */}
                        {isSpeaking && (
                          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 animate-pulse" />
                        )}

                        {/* Bottom Tag */}
                        <div className="relative z-10 flex items-center justify-between text-[9px] text-neutral-400 font-tajawal">
                          <span>{p.role === 'owner' ? '👑 مالك' : 'مشارك'}</span>
                          {isSpeaking && <span className="text-emerald-400 font-bold">يتحدث...</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Controls Toolbar */}
              <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3">
                {!isOnStage ? (
                  <button
                    type="button"
                    onClick={joinStage}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-neutral-950 font-cairo font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    {activeRoom.room_type === 'video' ? <Video className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>الصعود للمنصة والمشاركة الحية</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleMic}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                        isMicMuted
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      }`}
                    >
                      {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span>{isMicMuted ? 'إلغاء الكتم' : 'كتم المايك'}</span>
                    </button>

                    {activeRoom.room_type === 'video' && (
                      <button
                        type="button"
                        onClick={toggleCamera}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                          isCameraOff
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                            : 'bg-purple-950/80 text-purple-300 border border-purple-800'
                        }`}
                      >
                        {isCameraOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                        <span>{isCameraOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={leaveStage}
                      className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
                      <span>النزول من المنصة</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    leaveStage();
                    setActiveRoomId(null);
                    setActiveRoom(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-rose-400 border border-neutral-800 text-xs font-tajawal cursor-pointer"
                >
                  مغادرة الروم
                </button>
              </div>
            </div>

            {/* Room Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar min-h-[220px]">
              {roomMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-neutral-500 font-tajawal text-xs">
                  <MessageSquare className="w-8 h-8 text-neutral-600" />
                  <p>الروم مفتوح للحديث والفضفضة. اكتب رسالتك وتفاعل مع المشاركين!</p>
                </div>
              ) : (
                roomMessages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  const senderName = msg.username || msg.sender_username || 'عضو';
                  const isFemale = (msg.gender || msg.sender_gender) === 'female';

                  return (
                    <div key={msg.id} className={`flex gap-3 items-start ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                          isFemale ? 'bg-rose-950 text-rose-300' : 'bg-teal-950 text-teal-300'
                        }`}
                      >
                        {senderName.slice(0, 1).toUpperCase()}
                      </div>

                      <div className={`space-y-1 max-w-[80%] ${isMe ? 'text-left' : 'text-right'}`}>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                          <span className="font-bold text-white font-cairo">{senderName}</span>
                          {isUserOwner({ role: msg.role, username: senderName }) && <OwnerBadge size="xs" />}
                          <span>·</span>
                          <span className="font-mono">{new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-sm font-tajawal leading-relaxed ${
                            isMe ? 'bg-teal-600 text-white rounded-tr-none' : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-none'
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
                placeholder="اكتب رسالتك في الروم الصوتي/المرئي..."
                className="flex-1 bg-neutral-900/80 border border-neutral-800 focus:border-teal-500 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none font-tajawal"
              />
              <button
                type="submit"
                disabled={!roomInput.trim()}
                className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">إرسال</span>
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Create Room Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0e1017] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-cairo font-bold text-lg text-white flex items-center gap-2">
                <Radio className="w-5 h-5 text-teal-400" />
                إنشاء روم صوتي أو مرئي
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

            <form onSubmit={handleCreateRoom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                  اسم الروم
                </label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="مثال: مجلس شعراء المساء، استراحة التقنية..."
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-teal-500 text-white text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                    نوع الروم
                  </label>
                  <select
                    value={newRoomType}
                    onChange={e => {
                      const t = e.target.value as 'audio' | 'video';
                      setNewRoomType(t);
                      setNewRoomCost(t === 'video' ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-teal-500 text-white text-xs outline-none"
                  >
                    <option value="audio">🎙️ روم صوتي</option>
                    <option value="video">📹 روم مرئي (فيديو)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                    التصنيف
                  </label>
                  <select
                    value={newRoomCategory}
                    onChange={e => setNewRoomCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-teal-500 text-white text-xs outline-none"
                  >
                    {ROOM_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                  سعر الدقيقة (كوينز)
                </label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={newRoomCost}
                  onChange={e => setNewRoomCost(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-teal-500 text-white text-xs outline-none font-mono"
                />
                <p className="text-[10px] text-neutral-500 mt-1">
                  السعر الافتراضي للمنصة: {newRoomType === 'video' ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute} كوينز/دقيقة
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-300 mb-1.5 font-tajawal">
                  الوصف والقوانين
                </label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  placeholder="نبذة عن موضوع النقاش أو شروط المشاركة..."
                  className="w-full px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-teal-500 text-white text-xs outline-none resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-900 text-neutral-400 hover:text-white text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !newRoomName.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-neutral-950 font-cairo font-bold text-xs disabled:opacity-40 cursor-pointer shadow-md"
                >
                  {createLoading ? 'جاري الإنشاء...' : 'إنشاء الروم والبدء'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
