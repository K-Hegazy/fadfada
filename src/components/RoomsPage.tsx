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
  Mic,
  MicOff,
  Video,
  VideoOff,
  Radio,
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

export const RoomsPage: React.FC = () => {
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
  const [createLoading, setCreateLoading] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>('');

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ rooms: Room[]; pricing: { audioCostPerMinute: number; videoCostPerMinute: number } }>('/rooms');
      setRooms(res.rooms || []);
      if (res.pricing) {
        setPricingInfo(res.pricing);
        if (newRoomType === 'audio') setNewRoomCost(res.pricing.audioCostPerMinute);
        else setNewRoomCost(res.pricing.videoCostPerMinute);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
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
      setJoinError(err.message || 'فشل الانضمام للمجلس');
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
      console.error('Error entering room:', err);
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

    // Attach local audio and video tracks if available
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        try {
          pc.addTrack(track, localStreamRef.current!);
        } catch (e) {
          console.warn('Track add error:', e);
        }
      });
    }

    // ICE Candidate Exchange
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

    // Receive Remote Audio / Video Stream
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

    // Fetch initial stage participants
    apiRequest<{ speakers: RoomParticipant[] }>(`/rooms/${activeRoomId}/audio-speakers`)
      .then(res => setParticipants(res.speakers || []))
      .catch(() => {});

    // 1. Room message
    const unsubMsg = socketService.on('room:message', (data: any) => {
      if (data.roomId === activeRoomId && data.message) {
        setRoomMessages(prev => [...prev, data.message]);
        scrollToBottom();
      }
    });

    // 2. User joined
    const unsubJoin = socketService.on('room:user_joined', (data: any) => {
      if (data.roomId === activeRoomId && data.user) {
        setRoomMembers(prev => {
          if (prev.some(m => m.id === data.user.id)) return prev;
          return [...prev, data.user];
        });
      }
    });

    // 3. User left
    const unsubLeave = socketService.on('room:user_left', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setRoomMembers(prev => prev.filter(m => m.id !== data.userId));
        setParticipants(prev => prev.filter(s => s.user_id !== data.userId));
        // Clean up peer connection
        if (peerConnectionsRef.current.has(data.userId)) {
          peerConnectionsRef.current.get(data.userId)?.close();
          peerConnectionsRef.current.delete(data.userId);
        }
      }
    });

    // 4. Participant joined stage
    const unsubStageJoin = socketService.on('room:audio_speaker_join', async (data: any) => {
      if (data.roomId === activeRoomId && data.speaker) {
        setParticipants(prev => {
          if (prev.some(p => p.user_id === data.speaker.user_id)) return prev;
          return [...prev, data.speaker];
        });

        // If I am already on stage, initiate WebRTC offer to the newcomer
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

    // 5. Participant left stage
    const unsubStageLeave = socketService.on('room:audio_speaker_leave', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setParticipants(prev => prev.filter(s => s.user_id !== data.userId));
        if (peerConnectionsRef.current.has(data.userId)) {
          peerConnectionsRef.current.get(data.userId)?.close();
          peerConnectionsRef.current.delete(data.userId);
        }
      }
    });

    // 6. Speaking state change
    const unsubSpeaking = socketService.on('room:audio_speaker_speaking', (data: any) => {
      if (data.roomId === activeRoomId && data.userId) {
        setParticipants(prev =>
          prev.map(p => (p.user_id === data.userId ? { ...p, is_speaking: data.isSpeaking ? 1 : 0 } : p))
        );
      }
    });

    // 7. Media state change (Mute / Camera)
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

    // 8. Server-Side Pay-Per-Minute Billed Event
    const unsubBilled = socketService.on('room:billed', (data: any) => {
      if (data.roomId === activeRoomId) {
        setCoinsSpent(data.totalSpent || (prev => prev + data.cost));
        refreshUser();
      }
    });

    // 9. Balance Depleted Server Event (Session terminated)
    const unsubDepleted = socketService.on('room:balance_depleted', (data: any) => {
      if (data.roomId === activeRoomId) {
        leaveStage();
        setActiveRoomId(null);
        setActiveRoom(null);
        setDepletedAlert(data.message || 'تم إنهاء مشاركتك في الروم لنفاد رصيد الكوينز في محفظتك. يرجى شحن الرصيد للمتابعة.');
        refreshUser();
      }
    });

    // 10. WebRTC Multi-Peer Signaling Exchange
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

  // Join Live Stage (Audio or Video with WebRTC MediaStream)
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

      // Audio volume analysis for animated speaking ring
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const source = audioCtx.createMediaStreamSource(new MediaStream([audioTrack]));
        source.connect(analyser);
      }

      await apiRequest(`/rooms/${activeRoomId}/audio-stage/join`, { method: 'POST' });
      setIsOnStage(true);
      setIsMicMuted(false);
      setIsCameraOff(false);

      const myParticipantData: RoomParticipant = {
        user_id: user?.id || '',
        username: user?.username || 'أنا',
        avatar_url: user?.avatarUrl,
        gender: user?.gender,
        role: user?.role,
        is_speaking: 0,
        is_muted: 0,
        is_camera_off: 0,
        stream
      };

      setParticipants(prev => {
        if (prev.some(p => p.user_id === user?.id)) return prev;
        return [...prev, myParticipantData];
      });

      socketService.send({
        type: 'room:audio_speaker_join',
        roomId: activeRoomId,
        speaker: myParticipantData
      });

      // Initiate WebRTC peer connections to all existing participants on stage
      participants.forEach(async (p) => {
        if (p.user_id && p.user_id !== user?.id) {
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
            console.error('Error offering to existing speaker:', e);
          }
        }
      });

      // Continuous volume analyzer loop
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

      // Close all active peer connections
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
          roomType: newRoomType,
          costPerMinute: newRoomCost,
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

  const canCreateRoom = !user?.isGuest && !(user as any)?.is_guest;

  return (
    <div className="space-y-4 animate-in fade-in" dir="rtl">
      {/* Depleted Balance Alert Modal */}
      {depletedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0e111a] border border-rose-500/60 p-6 space-y-4 text-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto text-2xl">
              <Coins className="w-7 h-7" />
            </div>
            <h3 className="font-cairo font-black text-lg text-white">انتهى رصيد الكوينز</h3>
            <p className="text-xs text-neutral-300 font-tajawal leading-relaxed">
              {depletedAlert}
            </p>
            <button
              onClick={() => setDepletedAlert(null)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-cairo font-black text-xs cursor-pointer shadow-lg shadow-amber-500/20"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}

      {/* Pre-Join Confirmation Modal */}
      {joinConfirmRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0e111a] border border-teal-500/50 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center">
                  {joinConfirmRoom.room_type === 'video' ? <Video className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </div>
                <h3 className="font-cairo font-black text-lg text-white">تأكيد دخول الروم</h3>
              </div>
              <button onClick={() => setJoinConfirmRoom(null)} className="text-neutral-400 hover:text-white cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {joinError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-tajawal">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{joinError}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#07090e] border border-neutral-800 space-y-3 text-xs font-tajawal">
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">اسم الروم:</span>
                <span className="font-bold text-white font-cairo">{joinConfirmRoom.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">نوع الروم:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  joinConfirmRoom.room_type === 'video'
                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                    : 'bg-teal-950 text-teal-300 border border-teal-800'
                }`}>
                  {joinConfirmRoom.room_type === 'video' ? '📹 روم فيديو جماعي' : '🎙️ روم صوتي جماعي'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">تكلفة المشاركة:</span>
                <span className="font-bold text-amber-400 font-mono text-sm">
                  {(joinConfirmRoom.costPerMinute ?? (joinConfirmRoom.room_type === 'video' ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute)) > 0
                    ? `${joinConfirmRoom.costPerMinute ?? (joinConfirmRoom.room_type === 'video' ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute)} كوينز / دقيقة`
                    : 'مجاني'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-neutral-850">
                <span className="text-neutral-400">رصيدك الحالي:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">{user?.coins || 0} كوينز</span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 font-tajawal leading-relaxed">
              * يتم احتساب الرصيد وخصم الكوينز من جهة الخادم بدقة كل 60 ثانية. لن يتم السماح برصيد سالب، وفي حال نفاد الكوينز تنتهي المشاركة المدفوعة بأمان.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setJoinConfirmRoom(null)}
                className="w-1/3 py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmJoin}
                className="w-2/3 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-neutral-950 font-cairo font-black text-xs sm:text-sm shadow-lg shadow-teal-500/20 cursor-pointer active:scale-95"
              >
                تأكيد الدخول الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Directory Header */}
      <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-teal-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-400">
              <Compass className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-cairo font-black text-white">
              الغرف والمجالس الحوارية (صوت وفيديو جماعي)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            مساحات حوارية جماعية تدعم أكثر من 5 أشخاص في الوقت نفسه، مع شفافية كاملة في احتساب سعر الدقيقة لكل مشارك.
          </p>
        </div>

        {canCreateRoom && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-teal-600/20 shrink-0 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء مجلس صوتي أو فيديو جديد</span>
          </button>
        )}
      </div>

      {/* Main Dual-Pane View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* RIGHT: ROOMS DIRECTORY LIST */}
        <div className={`space-y-3 ${activeRoomId ? 'hidden lg:block lg:col-span-4' : 'col-span-12'}`}>
          <div className="p-3 rounded-2xl bg-[#090b10] border border-neutral-800 flex items-center justify-between">
            <span className="font-cairo font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-teal-400" />
              المجالس والرومات المتاحة
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/50 font-bold font-mono">
              {rooms.length} مجلس
            </span>
          </div>

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-28 rounded-2xl bg-neutral-900/40 border border-neutral-800 animate-pulse" />
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className="p-8 text-center rounded-3xl bg-[#090b10] border border-neutral-800 space-y-3">
              <Compass className="w-10 h-10 text-neutral-600 mx-auto" />
              <h3 className="font-cairo font-bold text-sm text-white">لا توجد مجالس منشأة حالياً</h3>
              <p className="text-xs text-neutral-400 font-tajawal">
                يمكن للمالك والإدارة إنشاء رومات صوتية ورومات فيديو للجميع.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rooms.map(room => {
                const isSelected = room.id === activeRoomId;
                const isVideo = room.room_type === 'video';
                const cost = room.costPerMinute ?? (isVideo ? pricingInfo.videoCostPerMinute : pricingInfo.audioCostPerMinute);

                return (
                  <div
                    key={room.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                      isSelected
                        ? 'border-teal-500 bg-[#0f1722] ring-2 ring-teal-500/40 shadow-lg shadow-teal-950/50'
                        : 'border-neutral-800/80 bg-[#0c0f16] hover:bg-[#111520] hover:border-neutral-700'
                    }`}
                  >
                    {/* Header: Category & Type Badge */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/50 font-bold">
                          {room.category}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          isVideo
                            ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                            : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                        }`}>
                          {isVideo ? <Video className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                          <span>{isVideo ? 'فيديو جماعي' : 'صوتي جماعي'}</span>
                        </span>
                      </div>

                      {room.is_private === 1 && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    </div>

                    {/* Room Info */}
                    <div>
                      <h3 className="font-cairo font-bold text-sm text-white">{room.name}</h3>
                      <p className="text-xs text-neutral-400 line-clamp-2 font-tajawal mt-1 leading-relaxed">
                        {room.description || 'مجلس حواري راقٍ لتبادل الرأي والفائدة.'}
                      </p>
                    </div>

                    {/* Price and Active Count */}
                    <div className="pt-2 border-t border-neutral-850 flex items-center justify-between text-xs font-tajawal">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-neutral-300 font-medium">
                          <Users className="w-3.5 h-3.5 text-teal-400" />
                          <span>{room.active_participants_count || room.member_count || 1} مشارك</span>
                        </span>

                        <span className="flex items-center gap-1 text-amber-400 font-bold font-mono">
                          <Coins className="w-3.5 h-3.5" />
                          <span>{cost > 0 ? `${cost} كوينز / دقيقة` : 'مجاني'}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (isSelected) return;
                          handleInitiateJoin(room);
                        }}
                        className={`px-3 py-1.5 rounded-xl font-cairo font-bold text-xs flex items-center gap-1 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                            : 'bg-teal-600 hover:bg-teal-500 text-white shadow-sm active:scale-95'
                        }`}
                      >
                        <span>{isSelected ? 'أنت هنا حالياً ✓' : 'انضمام للروم'}</span>
                        {!isSelected && <ArrowRight className="w-3 h-3 rotate-180" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LEFT: ACTIVE ROOM WITH MULTI-PARTICIPANT STAGE & CHAT */}
        {activeRoomId && activeRoom ? (
          <div className="col-span-12 lg:col-span-8 rounded-3xl bg-[#090b10] border border-neutral-800 flex flex-col overflow-hidden shadow-2xl min-h-[640px]">
            {/* Top Bar with Live Duration & Billing Counter */}
            <div className="px-4 sm:px-6 py-3.5 border-b border-neutral-800 bg-[#07090e] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveRoomId(null)}
                  className="lg:hidden text-xs text-neutral-300 hover:text-white px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer"
                >
                  ← الرومات
                </button>
                <div>
                  <h2 className="font-cairo font-black text-base sm:text-lg text-white flex items-center gap-2">
                    <span>{activeRoom.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-tajawal ${
                      activeRoom.room_type === 'video'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : 'bg-teal-950 text-teal-300 border border-teal-800'
                    }`}>
                      {activeRoom.room_type === 'video' ? '📹 فيديو جماعي' : '🎙️ صوتي جماعي'}
                    </span>
                  </h2>
                  <div className="text-[11px] text-neutral-400 font-tajawal flex items-center gap-2">
                    <span>{roomMembers.length} حاضر بالمجلس</span>
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

            {/* MULTI-PARTICIPANT STAGE (Supports > 5 Participants Concurrently via WebRTC Mesh) */}
            <div className="bg-gradient-to-b from-[#0c0f18] to-[#080b11] border-b border-neutral-800 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="font-cairo font-bold text-xs text-white">
                    منصة الروم المباشرة ({participants.length} على المنصة)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/80 text-teal-300 border border-teal-800/60 font-tajawal">
                    WebRTC P2P Mesh · يدعم أكثر من 5 مشاركين في آن واحد
                  </span>
                </div>

                {mediaError && (
                  <span className="text-[11px] text-rose-400 font-tajawal truncate max-w-xs">{mediaError}</span>
                )}
              </div>

              {/* Technical Capability & Recommendation Notice */}
              <div className="text-[11px] text-neutral-400 font-tajawal bg-[#07090e] px-3 py-2 rounded-xl border border-neutral-850 flex items-start gap-2">
                <span className="text-teal-400 shrink-0">💡</span>
                <span className="leading-relaxed">
                  <strong>تقنية الاتصال:</strong> تعتمد على شبكة WebRTC المباشرة (P2P Mesh). تدعم المنصة انضمام أكثر من خمسة مشاركين في الوقت نفسه (حتى 10-12 مشارك على المنصة وعدد غير محدود من المستمعين في الغرفة)، مع التوصية بـ 6 مشاركين على المنصة في رومات الفيديو للحفاظ على جودة البث واستهلاك البيانات.
                </span>
              </div>

              {/* Responsive Participants Grid (Supports 6, 8, 10+ participants) */}
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
                        {/* Video Feed: Local video if I'm on camera */}
                        {isVideo && !isCamOff && isMe && (
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                          />
                        )}

                        {/* Video Feed: Remote video for other participants */}
                        {isVideo && !isCamOff && !isMe && p.stream && (
                          <video
                            autoPlay
                            playsInline
                            ref={(el) => {
                              if (el && p.stream && el.srcObject !== p.stream) {
                                el.srcObject = p.stream;
                              }
                            }}
                            className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                          />
                        )}

                        {/* Remote Audio Playback Element for WebRTC Mesh sound */}
                        {!isMe && p.stream && (
                          <audio
                            autoPlay
                            playsInline
                            ref={(el) => {
                              if (el && p.stream && el.srcObject !== p.stream) {
                                el.srcObject = p.stream;
                              }
                            }}
                          />
                        )}

                        {/* Top participant info */}
                        <div className="relative z-10 flex items-center justify-between w-full">
                          <span className="text-[10px] font-bold text-white font-cairo truncate max-w-[80px] bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
                            {p.username} {isMe ? '(أنت)' : ''}
                          </span>

                          <div className="flex items-center gap-1">
                            {isMuted ? (
                              <MicOff className="w-3.5 h-3.5 text-rose-400 bg-black/60 p-0.5 rounded" />
                            ) : (
                              <Mic className={`w-3.5 h-3.5 ${isSpeaking ? 'text-emerald-400 animate-pulse' : 'text-neutral-400'} bg-black/60 p-0.5 rounded`} />
                            )}
                          </div>
                        </div>

                        {/* Center Avatar (When Audio Room, Camera Off, or awaiting remote stream) */}
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
                  مغادرة المجلس
                </button>
              </div>
            </div>

            {/* Room Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar min-h-[220px]">
              {roomMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-neutral-500 font-tajawal text-xs">
                  <MessageSquare className="w-8 h-8 text-neutral-600" />
                  <p>المجلس مفتوح للحديث والفضفضة. اكتب رسالتك وتفاعل مع المشاركين!</p>
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
                placeholder="اكتب رسالتك في المجلس..."
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
        ) : null}
      </div>

      {/* Create Room Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0e1017] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-cairo font-bold text-lg text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-teal-400" />
                إنشاء مجلس حواري (صوتي أو فيديو)
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
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">اسم المجلس</label>
                <input
                  type="text"
                  required
                  value={newRoomName}
                  onChange={e => setNewRoomName(e.target.value)}
                  placeholder="مثال: مجلس رواد المعرفة والتقنية"
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs sm:text-sm focus:outline-none focus:border-teal-500"
                />
              </div>

              {/* Room Type Selector: Audio vs Video */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">نوع الروم</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewRoomType('audio');
                      setNewRoomCost(pricingInfo.audioCostPerMinute);
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                      newRoomType === 'audio'
                        ? 'border-teal-500 bg-teal-950/60 text-teal-300 shadow-sm'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Mic className="w-4 h-4 text-teal-400 shrink-0" />
                    <div>
                      <div className="font-cairo font-bold text-xs text-white">روم صوتي جماعي</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{pricingInfo.audioCostPerMinute} كوينز / دقيقة</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNewRoomType('video');
                      setNewRoomCost(pricingInfo.videoCostPerMinute);
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex items-center gap-2.5 ${
                      newRoomType === 'video'
                        ? 'border-purple-500 bg-purple-950/60 text-purple-300 shadow-sm'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Video className="w-4 h-4 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-cairo font-bold text-xs text-white">روم فيديو جماعي</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{pricingInfo.videoCostPerMinute} كوينز / دقيقة</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">التصنيف</label>
                  <select
                    value={newRoomCategory}
                    onChange={e => setNewRoomCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-tajawal"
                  >
                    {ROOM_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">سعر الدقيقة (كوينز)</label>
                  <input
                    type="number"
                    min={0}
                    value={newRoomCost}
                    onChange={e => setNewRoomCost(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs font-bold font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1 font-tajawal">الوصف</label>
                <textarea
                  rows={2}
                  value={newRoomDesc}
                  onChange={e => setNewRoomDesc(e.target.value)}
                  placeholder="نبذة عن موضوع النقاش في هذا المجلس..."
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs resize-none font-tajawal"
                />
              </div>

              <button
                type="submit"
                disabled={createLoading}
                className="w-full py-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-600/20 cursor-pointer disabled:opacity-50 transition-all"
              >
                {createLoading ? 'جاري الإنشاء...' : 'نشر وتفعيل الروم الآن'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
