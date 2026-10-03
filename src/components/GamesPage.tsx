import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { socketService } from '../services/socket';
import {
  Sparkles,
  HelpCircle,
  Dices,
  Gift,
  Check,
  Flame,
  RefreshCw,
  Users,
  Send,
  MessageSquare,
  RotateCw,
  Trophy,
  UserCheck
} from 'lucide-react';

export const GamesPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [activeGame, setActiveGame] = useState<'wheel' | 'quiz' | 'truth'>('wheel');

  // Lucky Wheel state
  const [spinning, setSpinning] = useState<boolean>(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);

  // Quiz state
  const [quiz, setQuiz] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<any>(null);

  // Truth or Dare
  const TRUTH_PROMPTS = [
    'ما هي أكثر تجربة شخصية غيرت نظرتك للحياة بالكامل؟',
    'ما هي الصفة التي تتمنى أن تغيرها في شخصيتك بصراحة؟',
    'ما هو أكثر موقف شعرت فيه بالفخر بنفسك مؤخراً؟',
    'ما هي الكلمة أو النصيحة التي لا تنساها من شخص عزيز؟',
    'لو أتيحت لك فرصة الاعتذار لشخص ما من ماضيك، من سيكون؟',
    'ما هو الشيء الذي يسعدك مهما كان يومك صعباً ومزدحماً؟'
  ];

  const DARE_PROMPTS = [
    'أرسل رسالة شكر وتقدير راقية لأول صديق يظهر لك في المتصلين الآن.',
    'اكتب قصة ملهمة جديدة في قسم القصص تعبر عن خاطرة تفاؤلية.',
    'أرسل هدية رمزية (وردة أو قهوة) لشخص لا تعرفه جيداً لإسعاده.',
    'شارك مثلاً شعبياً عربياً في المجلس الحواري المفضل لديك.'
  ];

  const [currentPrompt, setCurrentPrompt] = useState<string>('اختر صراحة أو جرأة لبدء اللعبة!');
  const [promptType, setPromptType] = useState<'truth' | 'dare' | null>(null);
  const [currentPromptItem, setCurrentPromptItem] = useState<any>(null);
  const [promptLoading, setPromptLoading] = useState<boolean>(false);
  const [completedReward, setCompletedReward] = useState<string | null>(null);
  const [completing, setCompleting] = useState<boolean>(false);

  // Multiplayer Truth or Dare state
  const [todMode, setTodMode] = useState<'solo' | 'multiplayer'>('solo');
  const [todMultiState, setTodMultiState] = useState<any>({
    players: [],
    turnUserId: null,
    targetUserId: null,
    state: 'waiting'
  });
  const [bottleAngle, setBottleAngle] = useState<number>(0);
  const [isBottleSpinning, setIsBottleSpinning] = useState<boolean>(false);
  const [multiAnswerInput, setMultiAnswerInput] = useState<string>('');
  const [recentReactions, setRecentReactions] = useState<{ id: string; emoji: string; username: string }[]>([]);

  const fetchQuiz = async () => {
    try {
      const res = await apiRequest('/games/proverbs-quiz');
      setQuiz(res);
      setSelectedOption(null);
      setQuizAnswered(false);
      setQuizResult(null);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeGame === 'quiz') {
      fetchQuiz();
    }
  }, [activeGame]);

  useEffect(() => {
    if (activeGame === 'truth' && todMode === 'multiplayer') {
      socketService.send({ type: 'game:tod_join' });

      const unsubState = socketService.on('game:tod_state', (data: any) => {
        if (data && data.state) {
          setTodMultiState(data.state);
        }
      });

      const unsubSpun = socketService.on('game:tod_spun', (data: any) => {
        setIsBottleSpinning(true);
        setBottleAngle(prev => prev + (data.angle || 1440));
        setTimeout(() => setIsBottleSpinning(false), 2600);
      });

      const unsubReact = socketService.on('game:tod_reaction', (data: any) => {
        const id = 'rx_' + Date.now() + Math.random().toString(36).substring(2, 6);
        setRecentReactions(prev => [...prev.slice(-4), { id, emoji: data.reaction, username: data.username }]);
        setTimeout(() => {
          setRecentReactions(prev => prev.filter(r => r.id !== id));
        }, 3000);
      });

      return () => {
        socketService.send({ type: 'game:tod_leave' });
        unsubState();
        unsubSpun();
        unsubReact();
      };
    }
  }, [activeGame, todMode]);

  const handleMultiSpin = () => {
    socketService.send({ type: 'game:tod_spin' });
  };

  const handleMultiChoice = (choice: 'truth' | 'dare') => {
    socketService.send({ type: 'game:tod_choose', choice });
  };

  const handleMultiAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!multiAnswerInput.trim()) return;
    socketService.send({ type: 'game:tod_answer', answer: multiAnswerInput });
    setMultiAnswerInput('');
  };

  const sendReaction = (reaction: string) => {
    socketService.send({ type: 'game:tod_reaction', reaction });
  };

  const handleSpinWheel = async () => {
    setSpinning(true);
    setWheelResult(null);
    try {
      const res = await apiRequest('/games/lucky-wheel', { method: 'POST' });
      setTimeout(() => {
        setSpinning(false);
        setWheelResult(res.message);
        refreshUser();
      }, 1500);
    } catch (err: any) {
      setSpinning(false);
      alert(err.message || 'تعذر تدوير العجلة');
    }
  };

  const handleQuizAnswer = async (optIdx: number) => {
    if (quizAnswered) return;
    setSelectedOption(optIdx);
    setQuizAnswered(true);
    try {
      const res = await apiRequest('/games/proverbs-quiz/answer', {
        method: 'POST',
        body: JSON.stringify({ quizId: quiz.id, answerIndex: optIdx })
      });
      setQuizResult(res);
      if (res.correct) {
        refreshUser();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pickTruth = async () => {
    setPromptLoading(true);
    setCompletedReward(null);
    try {
      const res = await apiRequest<{ item: any }>('/games/truth-or-dare/item?type=truth');
      setCurrentPrompt(res.item.question);
      setCurrentPromptItem(res.item);
      setPromptType('truth');
    } catch {
      const p = TRUTH_PROMPTS[Math.floor(Math.random() * TRUTH_PROMPTS.length)];
      setCurrentPrompt(p);
      setCurrentPromptItem(null);
      setPromptType('truth');
    } finally {
      setPromptLoading(false);
    }
  };

  const pickDare = async () => {
    setPromptLoading(true);
    setCompletedReward(null);
    try {
      const res = await apiRequest<{ item: any }>('/games/truth-or-dare/item?type=dare');
      setCurrentPrompt(res.item.question);
      setCurrentPromptItem(res.item);
      setPromptType('dare');
    } catch {
      const p = DARE_PROMPTS[Math.floor(Math.random() * DARE_PROMPTS.length)];
      setCurrentPrompt(p);
      setCurrentPromptItem(null);
      setPromptType('dare');
    } finally {
      setPromptLoading(false);
    }
  };

  const completeChallenge = async () => {
    if (!currentPromptItem) return;
    setCompleting(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/games/truth-or-dare/complete', {
        method: 'POST',
        body: JSON.stringify({ itemId: currentPromptItem.id })
      });
      setCompletedReward(res.message);
      refreshUser();
    } catch (err: any) {
      alert(err.message || 'تعذر تسجيل إتمام التحدي');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-indigo-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Dices className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white">الألعاب والمسابقات الاجتماعية</h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            استمتع بالألعاب التفاعلية الخفيفة واربح كوينز إضافية واكتسب أصدقاء جدد.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveGame('wheel')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
              activeGame === 'wheel' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400'
            }`}
          >
            عجلة الحظ 🎡
          </button>
          <button
            onClick={() => setActiveGame('quiz')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
              activeGame === 'quiz' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400'
            }`}
          >
            تحدي الأمثال 🧠
          </button>
          <button
            onClick={() => setActiveGame('truth')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
              activeGame === 'truth' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400'
            }`}
          >
            صراحة أم جرأة 💬
          </button>
        </div>
      </div>

      {/* 1. LUCKY WHEEL */}
      {activeGame === 'wheel' && (
        <div className="max-w-xl mx-auto p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0e1017] border border-neutral-800 text-center space-y-6 shadow-2xl">
          <div className="space-y-2">
            <h2 className="font-cairo font-black text-2xl text-white">عجلة الحظ اليومية</h2>
            <p className="text-xs text-neutral-400 font-tajawal">
              يحق لكل عضو تدوير العجلة مرة واحدة كل 24 ساعة للفوز بكوينز ونقاط خبرة فورية!
            </p>
          </div>

          <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto flex items-center justify-center">
            <div className={`w-full h-full rounded-full border-8 border-amber-500/50 bg-gradient-to-tr from-amber-600 via-indigo-600 to-emerald-600 flex items-center justify-center shadow-2xl ${
              spinning ? 'animate-spin' : ''
            }`}>
              <div className="w-24 h-24 rounded-full bg-[#0e1017] border-4 border-white/30 flex items-center justify-center font-cairo font-black text-xl text-amber-300">
                {spinning ? '🌀' : '🎡'}
              </div>
            </div>
          </div>

          {wheelResult && (
            <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-700/60 text-emerald-300 font-cairo font-bold text-sm">
              {wheelResult}
            </div>
          )}

          <button
            disabled={spinning}
            onClick={handleSpinWheel}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-amber-600/20 cursor-pointer disabled:opacity-50 transition-all"
          >
            {spinning ? 'جاري تدوير العجلة...' : 'تدوير العجلة الآن ✨'}
          </button>
        </div>
      )}

      {/* 2. PROVERBS QUIZ */}
      {activeGame === 'quiz' && (
        <div className="max-w-xl mx-auto p-8 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <h2 className="font-cairo font-black text-lg text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-emerald-400" />
              تحدي الأمثال الشعبية العربية
            </h2>
            <button
              onClick={fetchQuiz}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>سؤال آخر</span>
            </button>
          </div>

          {quiz ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-center font-cairo font-bold text-base sm:text-lg text-white">
                {quiz.question}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {quiz.options.map((opt: string, idx: number) => {
                  return (
                    <button
                      key={idx}
                      disabled={quizAnswered}
                      onClick={() => handleQuizAnswer(idx)}
                      className={`p-4 rounded-2xl border text-sm font-bold transition-all cursor-pointer ${
                        selectedOption === idx
                          ? quizResult?.correct
                            ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                            : 'bg-rose-950/80 border-rose-500 text-rose-200'
                          : 'bg-neutral-900/60 hover:bg-neutral-800 border-neutral-800 text-neutral-200'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {quizResult && (
                <div className={`p-4 rounded-2xl border text-center font-cairo font-bold text-sm ${
                  quizResult.correct
                    ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                    : 'bg-rose-950/60 border-rose-700 text-rose-300'
                }`}>
                  {quizResult.message}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-neutral-500">جاري تحميل السؤال...</div>
          )}
        </div>
      )}

      {/* 3. TRUTH OR DARE */}
      {activeGame === 'truth' && (
        <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-[#0e1017] border border-neutral-800 space-y-6 shadow-2xl text-center relative overflow-hidden">
          {/* Floating Reactions Overlay */}
          <div className="absolute top-4 left-4 z-20 pointer-events-none flex flex-col gap-2">
            {recentReactions.map(r => (
              <div
                key={r.id}
                className="px-3 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-700/60 text-xs font-bold text-white flex items-center gap-1.5 animate-bounce shadow-xl"
              >
                <span className="text-base">{r.emoji}</span>
                <span className="text-[10px] text-neutral-300 font-tajawal">{r.username}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <h2 className="font-cairo font-black text-2xl text-white">لعبة صراحة أم جرأة</h2>
            <p className="text-xs text-neutral-400 font-tajawal">
              أسئلة وتحديات راقية مصممة لبناء حوار ممتع وكسر الجليد مع الأصدقاء.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center justify-center p-1 rounded-2xl bg-neutral-900/90 border border-neutral-800 max-w-xs mx-auto">
            <button
              onClick={() => setTodMode('solo')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                todMode === 'solo' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              فردي 👤
            </button>
            <button
              onClick={() => setTodMode('multiplayer')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                todMode === 'multiplayer' ? 'bg-gradient-to-r from-teal-600 to-indigo-600 text-white shadow-md' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>تحدي جماعي مباشر 👥</span>
            </button>
          </div>

          {todMode === 'solo' ? (
            /* SOLO MODE */
            <div className="space-y-6">
              <div className="p-8 rounded-3xl bg-neutral-900/60 border border-neutral-800 min-h-[140px] flex flex-col items-center justify-center gap-3">
                {promptLoading ? (
                  <div className="flex items-center gap-2 text-neutral-400 text-sm font-tajawal animate-pulse">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري اختيار التحدي...</span>
                  </div>
                ) : (
                  <>
                    {currentPromptItem && (
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          promptType === 'dare'
                            ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                            : 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60'
                        }`}>
                          {promptType === 'dare' ? 'تحدي جرأة 🔥' : 'سؤال صراحة 💎'}
                        </span>
                        {currentPromptItem.category && (
                          <span className="text-[10px] text-neutral-400 font-tajawal">
                            الفئة: {currentPromptItem.category}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="font-cairo font-bold text-lg text-neutral-100 leading-relaxed">
                      "{currentPrompt}"
                    </p>
                  </>
                )}
              </div>

              {/* Reward claiming button */}
              {currentPromptItem && !completedReward && (
                <button
                  onClick={completeChallenge}
                  disabled={completing}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{completing ? 'جاري التحقق...' : 'أتممت الإجابة / نفّذت التحدي (+10 كوينز 🪙)'}</span>
                </button>
              )}

              {completedReward && (
                <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 font-cairo font-bold text-sm animate-in fade-in flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>{completedReward}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={pickTruth}
                  disabled={promptLoading}
                  className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 cursor-pointer transition-all"
                >
                  اختر صراحة 💎
                </button>
                <button
                  onClick={pickDare}
                  disabled={promptLoading}
                  className="py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-rose-600/20 cursor-pointer transition-all"
                >
                  اختر جرأة 🔥
                </button>
              </div>
            </div>
          ) : (
            /* REAL-TIME MULTIPLAYER MODE */
            <div className="space-y-6">
              {/* Connected Players Bar */}
              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800 pb-2">
                  <div className="flex items-center gap-1.5 font-cairo font-bold text-white">
                    <Users className="w-3.5 h-3.5 text-teal-400" />
                    <span>اللاعبون المتصلون بالجلسة ({todMultiState.players?.length || 1})</span>
                  </div>
                  <span className="text-[11px] text-teal-400 font-tajawal">مباشر ⚡</span>
                </div>

                <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
                  {(todMultiState.players && todMultiState.players.length > 0 ? todMultiState.players : [
                    { userId: user?.id || 'me', username: user?.username || 'أنت', gender: user?.gender, score: 0 }
                  ]).map((p: any) => {
                    const isTarget = todMultiState.targetUserId === p.userId;
                    const isTurn = todMultiState.turnUserId === p.userId;

                    return (
                      <div
                        key={p.userId}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${
                          isTarget
                            ? 'bg-rose-950/80 border-rose-500 ring-2 ring-rose-500/50 scale-105'
                            : isTurn
                            ? 'bg-teal-950/80 border-teal-500 ring-2 ring-teal-500/40'
                            : 'bg-neutral-900 border-neutral-800'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            p.gender === 'female' ? 'bg-rose-900 text-rose-200' : 'bg-teal-900 text-teal-200'
                          }`}
                        >
                          {p.username.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-white max-w-[90px] truncate font-tajawal">
                          {p.username}
                        </span>
                        {p.score > 0 && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 font-bold border border-amber-800/60">
                            {p.score}★
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Central Bottle Arena */}
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-dashed border-neutral-800/80 animate-[spin_60s_linear_infinite]" />
                <div
                  className="text-6xl sm:text-7xl transition-transform cursor-pointer select-none filter drop-shadow-2xl"
                  style={{
                    transform: `rotate(${bottleAngle}deg)`,
                    transition: isBottleSpinning ? 'transform 2.5s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
                  }}
                  onClick={handleMultiSpin}
                >
                  🍾
                </div>
              </div>

              {/* Question or Challenge Display Card */}
              {todMultiState.currentQuestion ? (
                <div className="p-6 rounded-3xl bg-neutral-900/80 border border-neutral-700 space-y-3 animate-in zoom-in-95">
                  <div className="flex items-center justify-center gap-2">
                    <span className={`text-[10px] font-bold px-3 py-0.5 rounded-full border ${
                      todMultiState.currentType === 'dare'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                        : 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                    }`}>
                      {todMultiState.currentType === 'dare' ? 'تحدي جرأة 🔥' : 'سؤال صراحة 💎'}
                    </span>
                  </div>
                  <p className="font-cairo font-bold text-base sm:text-lg text-white leading-relaxed">
                    "{todMultiState.currentQuestion}"
                  </p>

                  {/* Display Target Player's Answer if completed */}
                  {todMultiState.currentAnswer && (
                    <div className="p-4 rounded-2xl bg-teal-950/40 border border-teal-800/50 text-teal-200 text-sm font-tajawal text-right space-y-1">
                      <div className="text-[10px] text-teal-400 font-bold">إجابة اللاعب:</div>
                      <p className="whitespace-pre-wrap">{todMultiState.currentAnswer}</p>
                    </div>
                  )}

                  {/* Answer Input if target is CURRENT USER */}
                  {todMultiState.state === 'answering' && todMultiState.targetUserId === user?.id && (
                    <form onSubmit={handleMultiAnswerSubmit} className="flex gap-2 pt-2">
                      <input
                        type="text"
                        value={multiAnswerInput}
                        onChange={(e) => setMultiAnswerInput(e.target.value)}
                        placeholder="اكتب إجابتك أو أكّد تنفيذ التحدي..."
                        className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-teal-500"
                      />
                      <button
                        type="submit"
                        disabled={!multiAnswerInput.trim()}
                        className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>إرسال</span>
                      </button>
                    </form>
                  )}
                </div>
              ) : null}

              {/* Action Buttons depending on Game State */}
              <div className="space-y-3">
                {/* 1. Choosing Truth vs Dare (Target's Turn) */}
                {todMultiState.state === 'choosing' && todMultiState.targetUserId === user?.id ? (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                    <button
                      onClick={() => handleMultiChoice('truth')}
                      className="py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/20 cursor-pointer"
                    >
                      اختر صراحة 💎
                    </button>
                    <button
                      onClick={() => handleMultiChoice('dare')}
                      className="py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/20 cursor-pointer"
                    >
                      اختر جرأة 🔥
                    </button>
                  </div>
                ) : (
                  /* 2. Spin the Bottle Button */
                  <button
                    onClick={handleMultiSpin}
                    disabled={isBottleSpinning}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-teal-600/20 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                  >
                    <RotateCw className={`w-4 h-4 ${isBottleSpinning ? 'animate-spin' : ''}`} />
                    <span>{isBottleSpinning ? 'الزجاجة تدور الآن...' : 'تدوير الزجاجة واختيار لاعب 🍾'}</span>
                  </button>
                )}

                {/* Reaction Bar */}
                <div className="flex items-center justify-center gap-3 pt-2">
                  <span className="text-[11px] text-neutral-500 font-tajawal">تفاعل مع الجلسة:</span>
                  {['🔥', '👏', '😂', '👑', '❤️'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="w-9 h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex items-center justify-center text-base hover:scale-110 active:scale-95 transition-all cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
