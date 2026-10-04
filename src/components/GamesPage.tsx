import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  HelpCircle,
  Dices,
  RotateCw,
  Trophy,
  Coins,
  Check,
  X as XIcon,
  Circle,
  RefreshCw,
  Award
} from 'lucide-react';

type GameTab = 'tictactoe' | 'wheel' | 'quiz';

export const GamesPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [activeGame, setActiveGame] = useState<GameTab>('tictactoe');
  const [gameMessage, setGameMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // ==========================================
  // 1. TIC TAC TOE (X & O) WITH COINS
  // ==========================================
  const [ttoStake, setTtoStake] = useState<number>(20);
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [winner, setWinner] = useState<string | null>(null); // 'X', 'O', 'draw'
  const [playingWithAi, setPlayingWithAi] = useState<boolean>(true);
  const [ttoProcessing, setTtoProcessing] = useState<boolean>(false);

  const calculateWinner = (squares: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (squares.every(s => s !== null)) return 'draw';
    return null;
  };

  const handleStartTtoGame = async () => {
    if ((user?.coins || 0) < ttoStake) {
      setGameMessage({
        text: `رصيد الكوينز غير كافٍ. تحتاج إلى ${ttoStake} كوينز للمشاركة.`,
        type: 'error'
      });
      return;
    }

    setTtoProcessing(true);
    setGameMessage(null);

    try {
      // Deduct entry coins
      await apiRequest('/games/entry', {
        method: 'POST',
        body: JSON.stringify({ game: 'tictactoe', stake: ttoStake })
      });

      if (refreshUser) await refreshUser();

      setBoard(Array(9).fill(null));
      setIsXNext(true);
      setGameStarted(true);
      setGameOver(false);
      setWinner(null);
    } catch (e: any) {
      console.error(e);
      // Fallback local start
      setBoard(Array(9).fill(null));
      setIsXNext(true);
      setGameStarted(true);
      setGameOver(false);
      setWinner(null);
    } finally {
      setTtoProcessing(false);
    }
  };

  const handleCellClick = (index: number) => {
    if (!gameStarted || gameOver || board[index] || ttoProcessing) return;

    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);

    const winResult = calculateWinner(newBoard);
    if (winResult) {
      finishTtoGame(winResult);
      return;
    }

    if (playingWithAi) {
      setIsXNext(false);
      // Trigger Smart AI Move
      setTimeout(() => {
        makeAiMove(newBoard);
      }, 400);
    } else {
      setIsXNext(!isXNext);
    }
  };

  const makeAiMove = (currentBoard: (string | null)[]) => {
    // 1. Can AI Win?
    const emptyIndices = currentBoard
      .map((val, idx) => (val === null ? idx : null))
      .filter((val): val is number => val !== null);

    if (emptyIndices.length === 0) return;

    let chosenIndex: number | null = null;

    // Check winning move for AI ('O')
    for (const idx of emptyIndices) {
      const copy = [...currentBoard];
      copy[idx] = 'O';
      if (calculateWinner(copy) === 'O') {
        chosenIndex = idx;
        break;
      }
    }

    // Check blocking move against Player ('X')
    if (chosenIndex === null) {
      for (const idx of emptyIndices) {
        const copy = [...currentBoard];
        copy[idx] = 'X';
        if (calculateWinner(copy) === 'X') {
          chosenIndex = idx;
          break;
        }
      }
    }

    // Center preference
    if (chosenIndex === null && currentBoard[4] === null) {
      chosenIndex = 4;
    }

    // Random choice if no immediate tactic
    if (chosenIndex === null) {
      chosenIndex = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    const nextBoard = [...currentBoard];
    nextBoard[chosenIndex] = 'O';
    setBoard(nextBoard);

    const winResult = calculateWinner(nextBoard);
    if (winResult) {
      finishTtoGame(winResult);
    } else {
      setIsXNext(true);
    }
  };

  const finishTtoGame = async (winResult: string) => {
    setGameOver(true);
    setWinner(winResult);

    if (winResult === 'X') {
      const reward = ttoStake * 2;
      setGameMessage({
        text: `🎉 مبروك! فزت بالمباراة وحصلت على ${reward} كوينز!`,
        type: 'success'
      });
      try {
        await apiRequest('/games/win', {
          method: 'POST',
          body: JSON.stringify({ game: 'tictactoe', amount: reward })
        });
        if (refreshUser) await refreshUser();
      } catch (e) {
        console.error(e);
      }
    } else if (winResult === 'draw') {
      setGameMessage({
        text: `تعادل! تم استرداد رسوم الرهان (${ttoStake} كوينز).`,
        type: 'info'
      });
      try {
        await apiRequest('/games/win', {
          method: 'POST',
          body: JSON.stringify({ game: 'tictactoe', amount: ttoStake })
        });
        if (refreshUser) await refreshUser();
      } catch (e) {
        console.error(e);
      }
    } else {
      setGameMessage({
        text: `حظ أوفر في الجولة القادمة! لقد فاز الذكاء الاصطناعي (O).`,
        type: 'error'
      });
    }
  };

  // ==========================================
  // 2. LUCKY WHEEL WITH COINS
  // ==========================================
  const [spinning, setSpinning] = useState<boolean>(false);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const WHEEL_COST = 20;

  const handleSpinWheel = async () => {
    if (spinning) return;
    if ((user?.coins || 0) < WHEEL_COST) {
      setGameMessage({
        text: `تحتاج إلى ${WHEEL_COST} كوينز لتدوير عجلة الحظ.`,
        type: 'error'
      });
      return;
    }

    setSpinning(true);
    setWheelResult(null);
    setGameMessage(null);

    try {
      const res = await apiRequest<{ prize: string; coinsEarned: number; xpEarned: number }>('/games/spin-wheel', {
        method: 'POST',
        body: JSON.stringify({ cost: WHEEL_COST })
      });

      setTimeout(async () => {
        setSpinning(false);
        setWheelResult(res.prize);
        setGameMessage({
          text: `🎉 مبروك! ربحت: ${res.prize}`,
          type: 'success'
        });
        if (refreshUser) await refreshUser();
      }, 2500);
    } catch (e: any) {
      setSpinning(false);
      setGameMessage({ text: e.message || 'فشل تدوير العجلة', type: 'error' });
    }
  };

  // ==========================================
  // 3. PROVERBS & CULTURAL QUIZ WITH COINS
  // ==========================================
  const [quiz, setQuiz] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState<boolean>(false);
  const [quizResult, setQuizResult] = useState<any>(null);
  const QUIZ_COST = 15;
  const QUIZ_REWARD = 35;

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

  const handleAnswerQuiz = async (optionIndex: number) => {
    if (quizAnswered || !quiz) return;

    if ((user?.coins || 0) < QUIZ_COST) {
      setGameMessage({
        text: `تحتاج إلى ${QUIZ_COST} كوينز للإجابة على التحدي.`,
        type: 'error'
      });
      return;
    }

    setSelectedOption(optionIndex);
    setQuizAnswered(true);

    try {
      const res = await apiRequest<{ correct: boolean; reward: number; explanation: string }>('/games/proverbs-quiz/answer', {
        method: 'POST',
        body: JSON.stringify({
          questionId: quiz.id,
          selectedOption: optionIndex,
          cost: QUIZ_COST,
          reward: QUIZ_REWARD
        })
      });

      setQuizResult(res);
      if (res.correct) {
        setGameMessage({
          text: `🎯 إجابة صحيحة! حصلت على ${res.reward || QUIZ_REWARD} كوينز!`,
          type: 'success'
        });
      } else {
        setGameMessage({
          text: `إجابة خاطئة! حظ أوفر في السؤال التالي.`,
          type: 'error'
        });
      }
      if (refreshUser) await refreshUser();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in" dir="rtl">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-neutral-900 to-emerald-950/30 border border-neutral-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Dices className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-cairo font-black text-white">
              ساحة الألعاب والتحديات بالكوينز
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            تنافس وتحدَّ ذكاءك بالكوينز، واكسب جوائز ومضاعفات لأرصدتك ونقاط خبرتك.
          </p>
        </div>

        {/* Current Balance */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-900/90 border border-neutral-800 shrink-0">
          <Coins className="w-5 h-5 text-amber-400" />
          <div className="text-right">
            <div className="text-[10px] text-neutral-400 font-tajawal">رصيدك الحالي</div>
            <div className="text-sm font-black font-cairo text-amber-300">{user?.coins || 0} كوينز</div>
          </div>
        </div>
      </div>

      {/* Message Toast */}
      {gameMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-between transition-all ${
            gameMessage.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
              : gameMessage.type === 'error'
              ? 'bg-rose-950/80 text-rose-300 border border-rose-700/60'
              : 'bg-neutral-900 text-neutral-200 border border-neutral-800'
          }`}
        >
          <span>{gameMessage.text}</span>
          <button onClick={() => setGameMessage(null)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveGame('tictactoe')}
          className={`px-4 py-2.5 rounded-2xl font-cairo font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeGame === 'tictactoe'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-neutral-900/70 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <span>❌⭕ لعبة X & O (تحدي الكوينز)</span>
        </button>

        <button
          onClick={() => setActiveGame('wheel')}
          className={`px-4 py-2.5 rounded-2xl font-cairo font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeGame === 'wheel'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-neutral-900/70 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <RotateCw className="w-4 h-4 text-amber-400" />
          <span>🎡 عجلة الحظ الملكية</span>
        </button>

        <button
          onClick={() => setActiveGame('quiz')}
          className={`px-4 py-2.5 rounded-2xl font-cairo font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
            activeGame === 'quiz'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-neutral-900/70 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-teal-400" />
          <span>🧠 مسابقة الأمثال والثقافة</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. X & O TIC TAC TOE GAME                                                 */}
      {/* ========================================================================= */}
      {activeGame === 'tictactoe' && (
        <div className="max-w-xl mx-auto p-5 sm:p-7 rounded-3xl bg-[#0b0e16] border border-neutral-800 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-cairo font-black text-white flex items-center justify-center gap-2">
              <span className="text-emerald-400">X</span>
              <span className="text-neutral-500">ضد</span>
              <span className="text-rose-400">O</span>
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 font-tajawal">
              العب ضد الذكاء الاصطناعي الذكي، وضاعف رهان كوينز عند الفوز!
            </p>
          </div>

          {/* Stake Selector */}
          {!gameStarted && (
            <div className="space-y-3 p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800">
              <div className="text-xs font-bold text-neutral-300 font-tajawal text-center">
                اختر قيمة رهان الكوينز للجولة:
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[10, 25, 50, 100].map(stake => (
                  <button
                    key={stake}
                    onClick={() => setTtoStake(stake)}
                    className={`py-2 rounded-xl font-cairo font-bold text-xs transition-all cursor-pointer border ${
                      ttoStake === stake
                        ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md shadow-amber-500/20'
                        : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:bg-neutral-850'
                    }`}
                  >
                    {stake} كوينز
                  </button>
                ))}
              </div>

              <button
                onClick={handleStartTtoGame}
                disabled={ttoProcessing}
                className="w-full mt-2 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-cairo font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
              >
                دفع {ttoStake} كوينز وبدء المباراة
              </button>
            </div>
          )}

          {/* Active Game State */}
          {gameStarted && (
            <div className="space-y-5">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs font-bold">
                <span className="text-amber-400">الجائزة عند الفوز: {ttoStake * 2} كوينز 🏆</span>
                <span className={isXNext ? 'text-emerald-400' : 'text-rose-400'}>
                  {gameOver
                    ? winner === 'draw'
                      ? 'انتهت بالتعادل!'
                      : `الفائز: ${winner}!`
                    : isXNext
                    ? 'دورك الآن (X) 👈'
                    : 'دور الذكاء الاصطناعي (O) ⏳'}
                </span>
              </div>

              {/* 3x3 Board */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[320px] mx-auto">
                {board.map((cell, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleCellClick(idx)}
                    disabled={Boolean(cell) || gameOver || (!isXNext && playingWithAi)}
                    className={`h-24 sm:h-26 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl font-black font-cairo border-2 transition-all cursor-pointer ${
                      cell === 'X'
                        ? 'bg-emerald-950/40 border-emerald-500/70 text-emerald-400 shadow-inner'
                        : cell === 'O'
                        ? 'bg-rose-950/40 border-rose-500/70 text-rose-400 shadow-inner'
                        : 'bg-[#0f131d] border-neutral-800/80 hover:border-neutral-700 hover:bg-[#131824]'
                    }`}
                  >
                    {cell === 'X' ? <span className="animate-in zoom-in-75">✕</span> : cell === 'O' ? <span className="animate-in zoom-in-75">◯</span> : null}
                  </button>
                ))}
              </div>

              {gameOver && (
                <div className="pt-2 text-center">
                  <button
                    onClick={() => setGameStarted(false)}
                    className="px-6 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-cairo font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                  >
                    🔄 لعب جولة جديدة
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LUCKY WHEEL                                                            */}
      {/* ========================================================================= */}
      {activeGame === 'wheel' && (
        <div className="max-w-xl mx-auto p-6 rounded-3xl bg-[#0b0e16] border border-neutral-800 shadow-2xl text-center space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-xl font-cairo font-black text-white">عجلة الحظ اليومية</h2>
            <p className="text-xs text-neutral-400 font-tajawal">
              تكلفة الدورة: {WHEEL_COST} كوينز. يمكنك الفوز بشارات وجوائز كوينز كبرى!
            </p>
          </div>

          <div className="relative w-56 h-56 mx-auto flex items-center justify-center">
            <div
              className={`w-52 h-52 rounded-full border-4 border-amber-400/80 bg-gradient-to-tr from-amber-600 via-yellow-500 to-amber-700 flex items-center justify-center shadow-2xl transition-transform duration-1000 ${
                spinning ? 'animate-spin' : ''
              }`}
            >
              <div className="w-40 h-40 rounded-full bg-[#080a10] flex items-center justify-center text-amber-300 font-cairo font-bold text-sm border-2 border-amber-500/40">
                {wheelResult || '🎡 فضفضه'}
              </div>
            </div>
          </div>

          <button
            onClick={handleSpinWheel}
            disabled={spinning}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-40 text-neutral-950 font-cairo font-black text-sm shadow-xl shadow-amber-500/30 cursor-pointer active:scale-95 transition-all"
          >
            {spinning ? 'جاري التدوير... 🎡' : `تدوير العجلة الآن (${WHEEL_COST} كوينز)`}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PROVERBS & CULTURAL QUIZ                                               */}
      {/* ========================================================================= */}
      {activeGame === 'quiz' && (
        <div className="max-w-xl mx-auto p-6 rounded-3xl bg-[#0b0e16] border border-neutral-800 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div>
              <h2 className="text-lg font-cairo font-black text-white">مسابقة الأمثال العربية والثقافة</h2>
              <p className="text-xs text-neutral-400 font-tajawal">
                تكلفة السؤال: {QUIZ_COST} كوينز · الجائزة: {QUIZ_REWARD} كوينز
              </p>
            </div>
            <button
              onClick={fetchQuiz}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 cursor-pointer"
              title="سؤال جديد"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {quiz ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 font-cairo font-bold text-sm text-white leading-relaxed">
                {quiz.question}
              </div>

              <div className="space-y-2">
                {quiz.options?.map((option: string, idx: number) => {
                  const isSelected = selectedOption === idx;
                  const isCorrect = quizResult && idx === quiz.correctIndex;
                  const isWrong = quizResult && isSelected && !quizResult.correct;

                  return (
                    <button
                      key={idx}
                      onClick={() => handleAnswerQuiz(idx)}
                      disabled={quizAnswered}
                      className={`w-full text-right p-3.5 rounded-2xl border transition-all cursor-pointer font-tajawal text-xs sm:text-sm font-semibold flex items-center justify-between ${
                        isCorrect
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                          : isWrong
                          ? 'bg-rose-950/80 border-rose-500 text-rose-300'
                          : isSelected
                          ? 'bg-neutral-800 border-neutral-700 text-white'
                          : 'bg-neutral-950 border-neutral-800/80 text-neutral-300 hover:bg-neutral-900'
                      }`}
                    >
                      <span>{option}</span>
                      {isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                      {isWrong && <XIcon className="w-4 h-4 text-rose-400" />}
                    </button>
                  );
                })}
              </div>

              {quizResult && (
                <div className="pt-2 text-center">
                  <button
                    onClick={fetchQuiz}
                    className="px-6 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-cairo font-bold text-xs cursor-pointer shadow-md"
                  >
                    السؤال التالي ←
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-neutral-400">جاري تحميل السؤال...</div>
          )}
        </div>
      )}
    </div>
  );
};
