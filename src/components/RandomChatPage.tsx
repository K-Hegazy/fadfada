import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import {
  Shuffle,
  MessageSquare,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  SkipForward,
  Flag,
  ShieldAlert,
  Coins,
  Clock,
  Sparkles,
  Users,
  Search,
  Globe2,
  Tag,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Send,
  Volume2
} from 'lucide-react';

const ARAB_COUNTRIES = [
  'مصر', 'السعودية', 'الإمارات', 'الكويت', 'قطر', 'البحرين', 'عمان',
  'العراق', 'الأردن', 'لبنان', 'سوريا', 'فلسطين', 'اليمن', 'المغرب',
  'الجزائر', 'تونس', 'ليبia', 'السودان'
];

const INTEREST_TAGS = [
  'فضفضة ونقاش', 'أدب وشعر', 'تقنية وبرمجة', 'رياضة ولياقة',
  'ألعاب وترفيه', 'سينما وموسيقى', 'سفر وتجارب', 'تطوير الذات',
  'ريادة أعمال', 'طبخ وطعام', 'كتب وقراءة', 'علم نفس'
];

interface PartnerProfile {
  id: string;
  username: string;
  gender: string;
  country: string;
  avatarUrl?: string;
  level?: number;
  bio?: string;
  interests?: string[];
}

interface ActiveSession {
  sessionId: string;
  partner: PartnerProfile;
  type: 'text' | 'voice' | 'video';
  isFree: boolean;
  startedAt: string;
  elapsedSeconds: number;
  freeDurationSeconds: number;
  pricePerMin?: number;
}

interface StatusData {
  freeSessionsRemaining: number;
  freeSessionsLimit: number;
  freeMinutesPerSession: number;
  prices: {
    text: number;
    voice: number;
    video: number;
  };
  userCoins: number;
}

export const RandomChatPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Search filter states
  const [chatType, setChatType] = useState<'text' | 'voice' | 'video'>('text');
  const [targetGender, setTargetGender] = useState<'all' | 'female' | 'male'>('all');
  const [targetCountry, setTargetCountry] = useState<string>('all');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Stage: 'idle' | 'searching' | 'connected'
  const [stage, setStage] = useState<'idle' | 'searching' | 'connected'>('idle');
  const [searchMessage, setSearchMessage] = useState<string>('');
  const [noMatchFound, setNoMatchFound] = useState<boolean>(false);
  const searchTimeoutRef = useRef<any>(null);

  // Connected session states
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [messages, setMessages] = useState<Array<{ sender: 'me' | 'partner'; text: string; time: string }>>([]);
  const [inputMessage, setInputMessage] = useState<string>('');

  // WebRTC Audio/Video states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await apiRequest<{
        success: boolean;
        freeSessionsRemaining: number;
        freeSessionsLimit: number;
        freeMinutesPerSession: number;
        prices: { text: number; voice: number; video: number };
        userCoins: number;
        activeSession: any;
      }>('/random-chat/status');

      setStatusData({
        freeSessionsRemaining: res.freeSessionsRemaining,
        freeSessionsLimit: res.freeSessionsLimit,
        freeMinutesPerSession: res.freeMinutesPerSession,
        prices: res.prices,
        userCoins: res.userCoins
      });

      if (res.activeSession) {
        setSession(res.activeSession);
        setStage('connected');
        setTimerSeconds(res.activeSession.elapsedSeconds || 0);
      }
    } catch (err) {
      console.error('Failed to load random chat status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Timer Tick (Server Synchronized)
  useEffect(() => {
    if (stage !== 'connected' || !session) return;
    const interval = setInterval(() => {
      setTimerSeconds(prev => {
        const next = prev + 1;
        // If free session time expires, notify user
        if (session.isFree && next >= session.freeDurationSeconds) {
          handleEndSession('free_time_expired');
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [stage, session]);

  // WebSocket Listeners for Random Chat
  useEffect(() => {
    const unsubMatched = socketService.on('random_chat:matched', async (data: any) => {
      clearTimeout(searchTimeoutRef.current);
      setNoMatchFound(false);
      setSession({
        sessionId: data.sessionId,
        partner: data.partner,
        type: data.typeOfChat,
        isFree: data.isFree,
        startedAt: new Date().toISOString(),
        elapsedSeconds: 0,
        freeDurationSeconds: data.freeDurationSeconds || 300,
        pricePerMin: data.pricePerMin
      });
      setTimerSeconds(0);
      setMessages([]);
      setStage('connected');

      // Initialize WebRTC media if audio or video
      if (data.typeOfChat === 'voice' || data.typeOfChat === 'video') {
        initWebRTC(data.sessionId, data.partner.id, data.typeOfChat === 'video', true);
      }
    });

    const unsubMsg = socketService.on('random_chat:message', (data: any) => {
      setMessages(prev => [...prev, {
        sender: 'partner',
        text: data.text,
        time: new Date(data.timestamp || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    const unsubEnded = socketService.on('random_chat:ended', (data: any) => {
      cleanupWebRTC();
      setStage('idle');
      setSession(null);
      setToastMessage({
        text: data.reason === 'free_time_expired' ? 'انتهت مدة الجلسة المجانية (5 دقائق).' : 'قام الطرف الآخر بإنهاء المحادثة.',
        type: 'info'
      });
      fetchStatus();
      if (refreshUser) refreshUser();
    });

    const unsubSignal = socketService.on('random_chat:signal', async (data: any) => {
      if (!peerConnectionRef.current) return;
      try {
        const signal = data.signal;
        if (signal.type === 'offer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          socketService.send({
            type: 'random_chat:signal',
            targetUserId: data.fromUserId,
            sessionId: data.sessionId,
            signal: answer
          });
        } else if (signal.type === 'answer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error('WebRTC signal processing error:', err);
      }
    });

    return () => {
      unsubMatched();
      unsubMsg();
      unsubEnded();
      unsubSignal();
      cleanupWebRTC();
    };
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebRTC Setup (Voice / Video)
  const initWebRTC = async (sessionId: string, partnerId: string, withVideo: boolean, isInitiator: boolean) => {
    cleanupWebRTC();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: withVideo ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false
      });
      setLocalStream(stream);

      if (localVideoRef.current && withVideo) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // Handle remote tracks
      pc.ontrack = (event) => {
        const [rStream] = event.streams;
        setRemoteStream(rStream);
        if (withVideo && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = rStream;
        } else if (!withVideo && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = rStream;
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketService.send({
            type: 'random_chat:signal',
            targetUserId: partnerId,
            sessionId,
            signal: { candidate: event.candidate }
          });
        }
      };

      // Create offer if initiator
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketService.send({
          type: 'random_chat:signal',
          targetUserId: partnerId,
          sessionId,
          signal: offer
        });
      }
    } catch (err) {
      console.warn('Could not access media devices for WebRTC:', err);
      setToastMessage({
        text: 'يرجى السماح بالوصول إلى الميكروفون/الكاميرا للاتصال.',
        type: 'error'
      });
    }
  };

  const cleanupWebRTC = () => {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      setLocalStream(null);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
  };

  // Actions
  const handleStartSearch = async () => {
    setNoMatchFound(false);
    setSearchMessage('جاري البحث عن شخص عشوائي يطابق اختياراتك...');
    setStage('searching');

    try {
      const res = await apiRequest<{
        success: boolean;
        matched: boolean;
        queued?: boolean;
        sessionId?: string;
        partner?: PartnerProfile;
        typeOfChat?: 'text' | 'voice' | 'video';
        isFree?: boolean;
        freeDurationSeconds?: number;
        pricePerMin?: number;
        error?: string;
      }>('/random-chat/search', {
        method: 'POST',
        body: JSON.stringify({
          type: chatType,
          targetGender,
          targetCountry,
          targetInterests: selectedInterests
        })
      });

      if (res.matched && res.sessionId && res.partner) {
        setSession({
          sessionId: res.sessionId,
          partner: res.partner,
          type: res.typeOfChat || chatType,
          isFree: !!res.isFree,
          startedAt: new Date().toISOString(),
          elapsedSeconds: 0,
          freeDurationSeconds: res.freeDurationSeconds || 300,
          pricePerMin: res.pricePerMin
        });
        setTimerSeconds(0);
        setMessages([]);
        setStage('connected');

        if (chatType === 'voice' || chatType === 'video') {
          initWebRTC(res.sessionId, res.partner.id, chatType === 'video', true);
        }
      } else {
        // Queued, waiting for match
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
          setNoMatchFound(true);
          setSearchMessage('لا يوجد مستخدمون متوافقون مع خياراتك حالياً. يمكنك تجربة اختيار «الكل» أو تغيير نوع الاتصال.');
        }, 15000);
      }
    } catch (err: any) {
      setStage('idle');
      setToastMessage({ text: err.message || 'فشل بدء البحث', type: 'error' });
    }
  };

  const handleCancelSearch = async () => {
    clearTimeout(searchTimeoutRef.current);
    try {
      await apiRequest('/random-chat/cancel', { method: 'POST' });
    } catch (e) {}
    setStage('idle');
    setNoMatchFound(false);
  };

  const handleEndSession = async (reason?: string) => {
    if (!session) return;
    const currentSessionId = session.sessionId;
    cleanupWebRTC();
    setStage('idle');
    setSession(null);

    try {
      const res = await apiRequest<{ success: boolean; durationSeconds: number; costCharged: number }>('/random-chat/end', {
        method: 'POST',
        body: JSON.stringify({ sessionId: currentSessionId, reason })
      });

      if (res.costCharged > 0) {
        setToastMessage({
          text: `تم إنهاء الجلسة. التكلفة: ${res.costCharged} كوينز عن مدة ${Math.ceil(res.durationSeconds / 60)} دقيقة.`,
          type: 'info'
        });
      } else {
        setToastMessage({ text: 'تم إنهاء الجلسة بنجاح.', type: 'info' });
      }

      fetchStatus();
      if (refreshUser) refreshUser();
    } catch (e) {
      fetchStatus();
    }
  };

  const handleNextPerson = async () => {
    await handleEndSession();
    handleStartSearch();
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !session) return;
    const text = inputMessage.trim();
    setInputMessage('');

    setMessages(prev => [...prev, {
      sender: 'me',
      text,
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    }]);

    socketService.send({
      type: 'random_chat:message',
      targetUserId: session.partner.id,
      sessionId: session.sessionId,
      text
    });
  };

  const handleReportUser = async () => {
    if (!session) return;
    const reason = prompt('يرجى كتابة سبب الإبلاغ عن هذا المستخدم:');
    if (!reason || !reason.trim()) return;

    try {
      await apiRequest('/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportedId: session.partner.id,
          reason: `تواصل عشوائي: ${reason.trim()}`
        })
      });
      setToastMessage({ text: 'تم إرسال البلاغ لفريق الإشراف بنجاح. شكراً لحرصك.', type: 'success' });
    } catch (e) {
      setToastMessage({ text: 'فشل إرسال البلاغ', type: 'error' });
    }
  };

  const handleBlockUser = async () => {
    if (!session) return;
    if (!confirm(`هل أنت متأكد من حظر ${session.partner.username}؟ لن تتم مطابقتك معه مجدداً.`)) return;

    try {
      await apiRequest(`/users/${session.partner.id}/block`, { method: 'POST' });
      setToastMessage({ text: `تم حظر ${session.partner.username}. لن يظهر لك في التواصل العشوائي مجدداً.`, type: 'success' });
      handleNextPerson();
    } catch (e) {
      setToastMessage({ text: 'فشل حظر المستخدم', type: 'error' });
    }
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  // Format time remaining / elapsed
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-in fade-in" dir="rtl">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-tajawal flex items-center justify-between border shadow-lg ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
              : 'bg-neutral-900/90 text-neutral-200 border-neutral-700'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button onClick={() => setToastMessage(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* STAGE 1: SEARCH & FILTER SETUP */}
      {stage === 'idle' && (
        <div className="space-y-5">
          {/* Header Banner */}
          <div className="p-5 sm:p-7 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-teal-950/40 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-600/30 border border-teal-500/40 flex items-center justify-center text-teal-400">
                  <Shuffle className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-cairo font-black text-white">
                  تواصل عشوائي
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
                التقِ بقلوب تشبهك بشكل فوري وعشوائي وفق اهتماماتك المفضلة، بمحادثة نصية أو صوتية أو مرئية آمنة.
              </p>
            </div>

            {/* Free Sessions & Coins Badge */}
            <div className="flex items-center gap-3 bg-neutral-950/80 border border-neutral-800 p-3 rounded-2xl shrink-0 font-tajawal">
              <div className="space-y-1 text-right">
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>الجلسات المجانية:</span>
                  <span className="font-bold text-teal-300">
                    {statusData ? `${statusData.freeSessionsRemaining} من ${statusData.freeSessionsLimit}` : '4 من 4'}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-500">
                  كل جلسة مجانية <strong>5 دقائق</strong> كاملة
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Info Notice if free sessions low/exhausted */}
          {statusData && statusData.freeSessionsRemaining === 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/40 text-amber-200 text-xs font-tajawal flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>
                  لقد استنفدت جلساتك المجانية. الأسعار بالدقيقة:{' '}
                  <strong>نص: {statusData.prices.text} كوينز</strong> ·{' '}
                  <strong>صوت: {statusData.prices.voice} كوينز</strong> ·{' '}
                  <strong>فيديو: {statusData.prices.video} كوينز</strong>
                </span>
              </div>
              <span className="font-bold text-amber-300">رصيدك: {statusData.userCoins} كوينز</span>
            </div>
          )}

          {/* Filters Selection Card */}
          <div className="p-5 sm:p-6 rounded-3xl bg-[#0a0d14] border border-neutral-800 space-y-6 shadow-xl">
            {/* 1. Communication Type */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white font-cairo">
                1. اختر نوع التواصل المطلوب:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'text', label: 'محادثة نصية', icon: MessageSquare, desc: 'دردشة كتابية فورية' },
                  { id: 'voice', label: 'مكالمة صوتية', icon: Mic, desc: 'اتصال صوتي عالي النقاء' },
                  { id: 'video', label: 'مكالمة فيديو', icon: Video, desc: 'بث مرئي حي ومباشر' }
                ].map(item => {
                  const Icon = item.icon;
                  const isSelected = chatType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setChatType(item.id as any)}
                      className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer active:scale-98 flex flex-col justify-between gap-2 ${
                        isSelected
                          ? 'bg-teal-950/50 border-teal-500 ring-2 ring-teal-500/30 text-white shadow-lg shadow-teal-950/40'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isSelected ? 'text-teal-400' : 'text-neutral-500'}`} />
                      <div>
                        <div className="font-cairo font-bold text-xs sm:text-sm">{item.label}</div>
                        <div className="text-[10px] text-neutral-400 font-tajawal hidden sm:block mt-0.5">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Target Gender */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white font-cairo">
                2. تفضيل الجنس:
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'all', label: 'الكل (أي جنس)', color: 'text-neutral-300' },
                  { id: 'female', label: 'إناث فقط', color: 'text-rose-400' },
                  { id: 'male', label: 'ذكور فقط', color: 'text-sky-400' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTargetGender(item.id as any)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold font-tajawal transition-all cursor-pointer ${
                      targetGender === item.id
                        ? 'bg-teal-950/60 border-teal-500 text-white shadow-sm'
                        : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className={item.color}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Target Country */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-white font-cairo">
                  3. الدولة المفضلة:
                </label>
                {targetCountry !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setTargetCountry('all')}
                    className="text-[11px] text-teal-400 hover:underline cursor-pointer font-tajawal"
                  >
                    إعادة ضبط إلى «الكل»
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Globe2 className="w-4 h-4 text-neutral-400 absolute right-3 top-3 pointer-events-none" />
                  <select
                    value={targetCountry}
                    onChange={(e) => setTargetCountry(e.target.value)}
                    className="w-full pr-9 pl-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white focus:outline-none focus:border-teal-500 font-tajawal"
                  >
                    <option value="all">🌍 كافة الدول العربية (الكل)</option>
                    {ARAB_COUNTRIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Interests Filter */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-white font-cairo">
                4. اهتمامات مشتركة (اختياري):
              </label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_TAGS.map(tag => {
                  const isChecked = selectedInterests.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-tajawal transition-all cursor-pointer flex items-center gap-1.5 ${
                        isChecked
                          ? 'bg-teal-600 text-white font-bold shadow-md shadow-teal-600/30'
                          : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start Search Action */}
            <div className="pt-3 border-t border-neutral-800/80">
              <button
                type="button"
                onClick={handleStartSearch}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-black text-sm sm:text-base font-cairo shadow-xl shadow-teal-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-98"
              >
                <Shuffle className="w-5 h-5" />
                <span>بدء البحث والمطابقة الآن</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 2: SEARCHING RADAR */}
      {stage === 'searching' && (
        <div className="p-8 sm:p-12 rounded-3xl bg-[#090c13] border border-neutral-800 text-center space-y-6 shadow-2xl animate-in zoom-in-95">
          <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-teal-500/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-teal-400/40 animate-pulse" />
            <div className="w-16 h-16 rounded-2xl bg-teal-600/20 border border-teal-500/50 flex items-center justify-center text-teal-400 shadow-xl shadow-teal-500/20">
              <Shuffle className="w-8 h-8 animate-spin" />
            </div>
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="font-cairo font-black text-lg sm:text-xl text-white">
              جاري مطابقتك مع شخص عشوائي...
            </h3>
            <p className="text-xs sm:text-sm text-neutral-400 font-tajawal leading-relaxed">
              {searchMessage}
            </p>
          </div>

          {noMatchFound && (
            <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-800/50 text-amber-200 text-xs font-tajawal max-w-md mx-auto text-right space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-sm text-amber-300">
                <AlertCircle className="w-4 h-4" />
                نصيحة لتسريع المطابقة
              </div>
              <p>
                لا يتواجد حالياً مستخدم يطابق كل الفلاتر الدقيقة في نفس اللحظة. ننصحك باختيار الجنس «الكل» والدولة «الكل» للمطابقة الفورية مع أي متواجد الآن.
              </p>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={handleCancelSearch}
              className="px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs transition-colors cursor-pointer border border-neutral-800"
            >
              إلغاء البحث والعودة
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: ACTIVE CONNECTED SESSION */}
      {stage === 'connected' && session && (
        <div className="space-y-4 animate-in fade-in">
          {/* Top Session Bar */}
          <div className="p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl bg-[#090c13] border border-neutral-800 flex items-center justify-between flex-wrap gap-3 shadow-lg">
            {/* Partner Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-white overflow-hidden shrink-0">
                {session.partner.avatarUrl ? (
                  <img src={session.partner.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-cairo">{session.partner.username.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-cairo font-black text-sm sm:text-base text-white truncate max-w-[140px] sm:max-w-[200px]">
                    {session.partner.username}
                  </span>
                  <span className="text-xs" title={session.partner.country}>
                    📍 {session.partner.country}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 font-tajawal truncate">
                  {session.type === 'text' ? 'محادثة نصية' : session.type === 'voice' ? 'مكالمة صوتية' : 'مكالمة فيديو'}
                  {session.isFree ? (
                    <span className="text-teal-400 font-bold mr-2">· جلسة مجانية</span>
                  ) : (
                    <span className="text-amber-400 font-bold mr-2">· جلسة مدفوعة ({session.pricePerMin || 1} كوينز/دقيقة)</span>
                  )}
                </div>
              </div>
            </div>

            {/* Server-Side Timer */}
            <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 px-3.5 py-2 rounded-xl shrink-0">
              <Clock className="w-4 h-4 text-teal-400 animate-pulse" />
              <div className="text-center">
                <span className="font-mono font-bold text-sm sm:text-base text-white">
                  {session.isFree ? (
                    formatTime(Math.max(0, session.freeDurationSeconds - timerSeconds))
                  ) : (
                    formatTime(timerSeconds)
                  )}
                </span>
                <span className="text-[9px] text-neutral-500 block">
                  {session.isFree ? 'متبقي من المجاني' : 'المدة الإجمالية'}
                </span>
              </div>
            </div>

            {/* Session Action Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleNextPerson}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-teal-600/20 active:scale-95"
                title="الانتقال للشخص التالي"
              >
                <SkipForward className="w-4 h-4" />
                <span>التالي</span>
              </button>

              <button
                type="button"
                onClick={() => handleEndSession('user_terminated')}
                className="px-3.5 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                title="إنهاء المحادثة"
              >
                <PhoneOff className="w-4 h-4" />
                <span>إنهاء</span>
              </button>

              <button
                type="button"
                onClick={handleReportUser}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-amber-400 hover:text-amber-300 cursor-pointer"
                title="إبلاغ عن المستخدم"
              >
                <Flag className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleBlockUser}
                className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-rose-400 cursor-pointer"
                title="حظر المستخدم"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Video Call View */}
          {session.type === 'video' && (
            <div className="relative w-full h-[55vh] sm:h-[62vh] rounded-3xl bg-neutral-950 border border-neutral-800 overflow-hidden shadow-2xl flex items-center justify-center">
              {/* Remote Video Stream */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {!remoteStream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center space-y-3 bg-[#0a0d14]/90">
                  <div className="w-16 h-16 rounded-full bg-teal-950 border border-teal-500/50 flex items-center justify-center text-teal-400 animate-pulse">
                    <Video className="w-8 h-8" />
                  </div>
                  <p className="text-xs text-neutral-400 font-tajawal">جاري توصيل الكاميرا مع الطرف الآخر...</p>
                </div>
              )}

              {/* Local Video Stream (Picture in Picture) */}
              <div className="absolute bottom-4 left-4 w-28 sm:w-36 h-36 sm:h-48 rounded-2xl bg-neutral-900 border-2 border-teal-500/60 overflow-hidden shadow-2xl z-20">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Media Controls Overlay */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/70 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-neutral-800 z-30">
                <button
                  type="button"
                  onClick={() => {
                    if (localStream) {
                      const audioTrack = localStream.getAudioTracks()[0];
                      if (audioTrack) {
                        audioTrack.enabled = !audioTrack.enabled;
                        setIsAudioMuted(!audioTrack.enabled);
                      }
                    }
                  }}
                  className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                    isAudioMuted ? 'bg-rose-900/80 text-rose-300' : 'bg-neutral-800 text-white'
                  }`}
                  title={isAudioMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
                >
                  {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (localStream) {
                      const videoTrack = localStream.getVideoTracks()[0];
                      if (videoTrack) {
                        videoTrack.enabled = !videoTrack.enabled;
                        setIsVideoMuted(!videoTrack.enabled);
                      }
                    }
                  }}
                  className={`p-2.5 rounded-xl transition-colors cursor-pointer ${
                    isVideoMuted ? 'bg-rose-900/80 text-rose-300' : 'bg-neutral-800 text-white'
                  }`}
                  title={isVideoMuted ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'}
                >
                  {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Voice Call View */}
          {session.type === 'voice' && (
            <div className="p-8 sm:p-12 rounded-3xl bg-[#0a0d14] border border-neutral-800 flex flex-col items-center justify-center space-y-6 shadow-2xl">
              <audio ref={remoteAudioRef} autoPlay playsInline />
              <div className="relative w-28 h-28 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-teal-500/30 animate-ping" />
                <div className="w-20 h-20 rounded-full bg-teal-950 border border-teal-500 flex items-center justify-center text-teal-400 shadow-xl shadow-teal-500/20">
                  <Mic className="w-10 h-10 animate-pulse" />
                </div>
              </div>

              <div className="text-center space-y-1">
                <h3 className="font-cairo font-bold text-lg text-white">المكالمة الصوتية متصلة</h3>
                <p className="text-xs text-neutral-400 font-tajawal">جودة اتصال مشفرة ومباشرة مع {session.partner.username}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (localStream) {
                    const audioTrack = localStream.getAudioTracks()[0];
                    if (audioTrack) {
                      audioTrack.enabled = !audioTrack.enabled;
                      setIsAudioMuted(!audioTrack.enabled);
                    }
                  }
                }}
                className={`py-2.5 px-5 rounded-xl text-xs font-bold font-tajawal flex items-center gap-2 cursor-pointer transition-colors ${
                  isAudioMuted ? 'bg-rose-900/80 text-rose-300' : 'bg-neutral-800 text-white'
                }`}
              >
                {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isAudioMuted ? 'إلغاء كتم الصوت' : 'كتم الميكروفون'}</span>
              </button>
            </div>
          )}

          {/* In-Session Chat (Available for all types, primary for text) */}
          <div className="rounded-3xl bg-[#0a0d14] border border-neutral-800 flex flex-col h-[50vh] sm:h-[55vh] overflow-hidden shadow-2xl">
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-2 text-neutral-500 font-tajawal">
                  <MessageSquare className="w-8 h-8 text-neutral-600" />
                  <p className="text-xs">المحادثة بدأت الآن! قل مرحباً لـ {session.partner.username} 👋</p>
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.sender === 'me' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] sm:max-w-[70%] p-3 rounded-2xl text-xs sm:text-sm font-tajawal leading-relaxed ${
                        m.sender === 'me'
                          ? 'bg-teal-600 text-white rounded-tl-none'
                          : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tr-none'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[9px] text-neutral-500 font-tajawal mt-0.5 px-1">{m.time}</span>
                  </div>
                ))
              )}
              <div ref={chatMessagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-neutral-800/80 bg-neutral-950/60 flex items-center gap-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`اكتب رسالة إلى ${session.partner.username}...`}
                className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 font-tajawal"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white transition-all cursor-pointer disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
