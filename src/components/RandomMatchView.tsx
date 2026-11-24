import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  MessageSquare,
  Mic,
  PhoneOff,
  Send,
  Shuffle,
  Video,
} from 'lucide-react';
import {
  addIceCandidate,
  endMatchSession,
  joinRandomMatchQueue,
  leaveRandomMatchQueue,
  publishRtcAnswer,
  publishRtcOffer,
  sendMatchMessage,
  subscribeToIceCandidates,
  subscribeToMatchMessages,
  subscribeToMatchSession,
  subscribeToMyMatchQueue,
} from '../services/randomMatch';
import { useApp } from '../state/AppContext';
import type { MatchSession, SimpleMessage } from '../types/fadfada';
import { formatArabicTime } from '../utils/formatters';
import { COUNTRIES } from '../utils/progression';
import { FeedbackBanner, PageHeader } from './ui/Primitives';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export const RandomMatchView: React.FC = () => {
  const { profile, siteSettings, usersById } = useApp();
  const [mode, setMode] = useState<'text' | 'voice' | 'video'>('text');
  const [preferredGender, setPreferredGender] = useState<'all' | 'male' | 'female'>('all');
  const [preferredCountry, setPreferredCountry] = useState('');
  const [searching, setSearching] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<MatchSession | null>(null);
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const answeredRef = useRef(false);
  const offeredRef = useRef(false);
  const activeStateRef = useRef<{ uid: string; searching: boolean; sessionId: string | null }>({
    uid: '',
    searching: false,
    sessionId: null,
  });

  useEffect(() => {
    activeStateRef.current = {
      uid: profile?.uid ?? '',
      searching,
      sessionId: session?.status === 'active' ? sessionId : null,
    };
  }, [profile?.uid, searching, sessionId, session?.status]);

  useEffect(() => {
    const handleUnload = () => {
      const { uid, searching: isSearching, sessionId: activeSid } = activeStateRef.current;
      if (isSearching && uid) {
        void leaveRandomMatchQueue(uid);
      }
      if (activeSid) {
        void endMatchSession(activeSid);
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, []);

  const cleanupMediaAndRtc = () => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    answeredRef.current = false;
    offeredRef.current = false;
  };

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToMyMatchQueue(profile.uid, (entry) => {
      if (entry?.status === 'matched' && entry.sessionId) {
        setSearching(false);
        setSessionId(entry.sessionId);
      }
    });
    return () => {
      unsub();
      void leaveRandomMatchQueue(profile.uid);
    };
  }, [profile?.uid]);

  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setMessages([]);
      cleanupMediaAndRtc();
      return;
    }
    const unsubSession = subscribeToMatchSession(sessionId, setSession);
    const unsubMsgs = subscribeToMatchMessages(sessionId, setMessages);
    return () => {
      unsubSession();
      unsubMsgs();
      cleanupMediaAndRtc();
    };
  }, [sessionId]);

  useEffect(() => {
    if (!session || session.status !== 'active') return;
    const tick = () => {
      const rem = Math.max(0, Math.floor((session.endsAt - Date.now()) / 1000));
      setSecondsLeft(rem);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || !profile || session.status !== 'active' || session.mode === 'text') return;

    let cancelled = false;
    let unsubIce: (() => void) | null = null;

    const startRtc = async () => {
      if (typeof RTCPeerConnection === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('المكالمات المباشرة (WebRTC) أو أجهزة الصوت/الفيديو غير مدعومة في هذا المتصفح، يمكنك متابعة الدردشة النصية.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: session.mode === 'video',
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        if (localVideoRef.current && session.mode === 'video') {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.ontrack = (ev) => {
          const remoteStream = ev.streams[0];
          if (session.mode === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
          } else if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            void addIceCandidate(session.id, profile.uid, ev.candidate.toJSON());
          }
        };

        unsubIce = subscribeToIceCandidates(session.id, profile.uid, async (candidate) => {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            // Ignore race before remote description
          }
        });

        const isOfferer = session.participantIds[0] === profile.uid;
        if (isOfferer && !offeredRef.current && !session.offer) {
          offeredRef.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await publishRtcOffer(session.id, offer);
        }
      } catch {
        setError('تعذر الوصول إلى الميكروفون أو الكاميرا للمكالمة المباشرة، يمكنك متابعة الدردشة النصية.');
      }
    };

    void startRtc();
    return () => {
      cancelled = true;
      unsubIce?.();
    };
  }, [session?.id, session?.mode, session?.status]);

  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !session || !profile || session.mode === 'text') return;

    const handleSignaling = async () => {
      const isOfferer = session.participantIds[0] === profile.uid;
      try {
        if (!isOfferer && session.offer && !answeredRef.current && !pc.currentRemoteDescription) {
          answeredRef.current = true;
          await pc.setRemoteDescription(new RTCSessionDescription(session.offer as RTCSessionDescriptionInit));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await publishRtcAnswer(session.id, answer);
        } else if (isOfferer && session.answer && !pc.currentRemoteDescription) {
          await pc.setRemoteDescription(new RTCSessionDescription(session.answer as RTCSessionDescriptionInit));
        }
      } catch {
        // Ignore duplicate SDP set
      }
    };
    void handleSignaling();
  }, [session?.offer, session?.answer]);

  if (!profile) return null;

  const today = new Date().toISOString().slice(0, 10);
  const usedToday = profile.lastMatchDate === today ? profile.freeMatchesUsedToday : 0;
  const freeLeft = Math.max(0, siteSettings.randomMatchFreeDaily - usedToday);

  const handleStart = async () => {
    setError(null);
    setSearching(true);
    try {
      const res = await joinRandomMatchQueue(profile, {
        mode,
        preferredGender,
        preferredCountry,
        freeDailyLimit: siteSettings.randomMatchFreeDaily,
        matchCost: siteSettings.randomMatchCost,
        durationSec: siteSettings.randomMatchDurationSec,
      });
      if (res.matchedSessionId) {
        setSearching(false);
        setSessionId(res.matchedSessionId);
      }
    } catch (err) {
      setSearching(false);
      setError(err instanceof Error ? err.message : 'تعذر بدء التواصل العشوائي.');
    }
  };

  const handleCancelSearch = async () => {
    setError(null);
    try {
      await leaveRandomMatchQueue(profile.uid);
      setSearching(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء البحث.');
    }
  };

  const handleEndSession = async () => {
    setError(null);
    try {
      if (sessionId) {
        await endMatchSession(sessionId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنهاء الجلسة.');
    } finally {
      cleanupMediaAndRtc();
      setSessionId(null);
    }
  };

  const handleSendMsg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !msgText.trim()) return;
    setError(null);
    try {
      await sendMatchMessage(sessionId, profile, msgText);
      setMsgText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال الرسالة.');
    }
  };

  const peerUid = session?.participantIds.find((id) => id !== profile.uid) ?? '';
  const peerName = usersById[peerUid]?.displayName ?? 'شريك عشوائي';

  if (session) {
    const mins = Math.floor(secondsLeft / 60);
    const secs = String(secondsLeft % 60).padStart(2, '0');
    return (
      <div className="flex-1 flex flex-col min-h-0 h-full pb-14 md:pb-0">
        <div className="px-3 sm:px-5 py-2.5 bg-white dark:bg-[#121B20] border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
              جلسة عشوائية مع {peerName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
              <span className="font-mono tabular-nums font-semibold">
                {session.status === 'ended' ? 'انتهت الجلسة' : `${mins}:${secs}`}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleEndSession()}
            className="min-h-[36px] px-3.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
            <span>إنهاء الجلسة</span>
          </button>
        </div>

        {session.mode === 'video' && (
          <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-950 shrink-0">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-44 rounded-lg bg-slate-900 object-cover" />
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-44 rounded-lg bg-slate-900 object-cover" />
          </div>
        )}
        {session.mode === 'voice' && <audio ref={remoteAudioRef} autoPlay className="hidden" />}

        <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 space-y-2">
          {messages.map((m) => {
            const mine = m.senderId === profile.uid;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[78%] rounded-xl px-3.5 py-2 text-[13px] shadow-2xs ${
                    mine
                      ? 'bg-[#0B7A62] text-white rounded-tr-xs'
                      : 'bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-tl-xs'
                  }`}
                >
                  <p>{m.text}</p>
                  <p className="text-[10px] opacity-75 font-mono tabular-nums mt-0.5">
                    {formatArabicTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="px-4 py-1.5 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 shrink-0">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSendMsg}
          className="p-2.5 sm:px-4 bg-white dark:bg-[#121B20] border-t border-slate-200/80 dark:border-white/10 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="اكتب رسالة لشريكك..."
            className="flex-1 min-h-[40px] px-3.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
          />
          <button
            type="submit"
            disabled={!msgText.trim()}
            className="min-h-[40px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4 -scale-x-100" />
            <span>إرسال</span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-3xl mx-auto space-y-3.5">
        <PageHeader
          title="التواصل العشوائي الفوري"
          subtitle={`تحدث مع شخص جديد بالصوت أو الفيديو أو النص لمدة ${Math.round(siteSettings.randomMatchDurationSec / 60)} دقائق`}
          icon={<Shuffle className="w-4 h-4" />}
          action={
            <div className="text-left text-xs">
              <p className="font-semibold text-[#0B7A62] dark:text-[#34D399]">
                مجاني متبقي اليوم: <span className="font-mono tabular-nums">{freeLeft}</span>
              </p>
              <p className="text-[11px] text-slate-400">
                بعدها: {siteSettings.randomMatchCost} عملة
              </p>
            </div>
          }
        />

        <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'text', label: 'دردشة نصية', desc: 'سريعة وآمنة', icon: MessageSquare },
              { id: 'voice', label: 'مكالمة صوتية', desc: 'تواصل صوتي حي', icon: Mic },
              { id: 'video', label: 'مكالمة فيديو', desc: 'صوت وصورة', icon: Video },
            ].map((m) => {
              const Icon = m.icon;
              const selected = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id as 'text' | 'voice' | 'video')}
                  className={`p-3 rounded-lg border text-center space-y-1 cursor-pointer transition-all ${
                    selected
                      ? 'border-[#0B7A62] bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] shadow-2xs'
                      : 'border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B]'
                  }`}
                >
                  <Icon className="w-5 h-5 mx-auto" />
                  <p className="text-xs font-bold">{m.label}</p>
                  <p className="text-[10px] opacity-75 hidden sm:block">{m.desc}</p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                تصفية حسب النوع
              </label>
              <select
                value={preferredGender}
                onChange={(e) => setPreferredGender(e.target.value as 'all' | 'male' | 'female')}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs font-medium"
              >
                <option value="all">الجميع</option>
                <option value="male">شباب</option>
                <option value="female">بنات</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                تصفية حسب الدولة
              </label>
              <select
                value={preferredCountry}
                onChange={(e) => setPreferredCountry(e.target.value)}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs font-medium"
              >
                <option value="">كل الدول</option>
                {COUNTRIES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && <FeedbackBanner type="error" message={error} />}

          {searching ? (
            <div className="p-6 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/80 dark:border-white/10 text-center space-y-3.5">
              <div className="relative w-14 h-14 mx-auto flex items-center justify-center">
                <span className="fadfada-radar-ring absolute inset-0 rounded-full border-2 border-[#0B7A62] dark:border-[#34D399]" />
                <div className="w-11 h-11 rounded-full bg-[#0B7A62] text-white flex items-center justify-center relative z-10">
                  <Shuffle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[#0B7A62] dark:text-[#34D399]">
                جاري البحث عن شريك مناسب في قائمة الانتظار الحقيقية...
              </p>
              <button
                type="button"
                onClick={() => void handleCancelSearch()}
                className="min-h-[36px] px-4 rounded-lg border border-slate-300 dark:border-white/15 hover:bg-slate-200/70 dark:hover:bg-[#18242B] text-xs font-semibold cursor-pointer"
              >
                إلغاء البحث
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void handleStart()}
              className="w-full min-h-[42px] rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Shuffle className="w-4 h-4" />
              <span>
                {freeLeft > 0
                  ? 'ابدأ التواصل العشوائي الآن (مجانًا)'
                  : `ابدأ التواصل العشوائي (${siteSettings.randomMatchCost} عملة)`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
