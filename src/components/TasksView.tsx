import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Eye,
  Gift,
  Lock,
  Share2,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import {
  claimDailyReward,
  getDailyTaskProgress,
  recordDailyTaskActivity,
  subscribeToDailyTasks,
  subscribeToMyDailyClaims,
} from '../services/economy';
import { useApp } from '../state/AppContext';
import type { DailyTask } from '../types/fadfada';
import { DEFAULT_DAILY_TASKS, getLevelProgress } from '../utils/progression';
import { FeedbackBanner, PageHeader } from './ui/Primitives';

const WHEEL_SEGMENTS = [
  { label: '25 عملة', coins: 25, xp: 30, color: '#0B7A62' },
  { label: '50 عملة', coins: 50, xp: 45, color: '#D97706' },
  { label: '75 عملة', coins: 75, xp: 60, color: '#0369A1' },
  { label: '100 عملة', coins: 100, xp: 90, color: '#BE123C' },
  { label: '150 عملة', coins: 150, xp: 120, color: '#059669' },
  { label: '200 عملة', coins: 200, xp: 150, color: '#7C3AED' },
];

export const TasksView: React.FC = () => {
  const { profile, isGuest, siteSettings, setActiveSection } = useApp();
  const [tasks, setTasks] = useState<DailyTask[]>(DEFAULT_DAILY_TASKS);
  const [claimedKeys, setClaimedKeys] = useState<string[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [referralInput, setReferralInput] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const [sponsorAdOpen, setSponsorAdOpen] = useState(false);
  const [adCountdown, setAdCountdown] = useState(3);

  const [spinning, setSpinning] = useState(false);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubTasks = subscribeToDailyTasks(setTasks);
    return () => unsubTasks();
  }, []);

  useEffect(() => {
    if (!profile || isGuest) return;
    const unsubClaims = subscribeToMyDailyClaims(profile.uid, setClaimedKeys);
    void getDailyTaskProgress()
      .then((res) => setProgressMap(res.completedByKey))
      .catch(() => {});
    return () => unsubClaims();
  }, [profile?.uid, isGuest]);

  useEffect(() => {
    if (!sponsorAdOpen || adCountdown <= 0) return;
    const timer = window.setTimeout(() => setAdCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [sponsorAdOpen, adCountdown]);

  const spinTimerRef = React.useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current !== null) {
        window.clearTimeout(spinTimerRef.current);
      }
    };
  }, []);

  if (!profile) return null;

  if (isGuest) {
    return (
      <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
        <div className="max-w-3xl mx-auto space-y-3.5">
          <PageHeader
            title="المهام اليومية وعجلة الحظ"
            subtitle="نظام المكافآت والنقاط للأعضاء المؤكدين"
            icon={<Trophy className="w-4 h-4" />}
          />
          <div className="p-6 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-50">
              متاح بعد إنشاء حساب مؤكد
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
              حسابات الضيوف لا تمتلك عملات أو مستويات أو مكافآت يومية. قم بترقية حسابك إلى عضو دائم من صفحة الحساب للاستفادة من المهام وعجلة الحظ.
            </p>
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className="min-h-[38px] px-5 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold cursor-pointer"
            >
              الانتقال لترقية الحساب
            </button>
          </div>
        </div>
      </div>
    );
  }

  const refreshProgress = async () => {
    try {
      const res = await getDailyTaskProgress();
      setProgressMap(res.completedByKey);
    } catch {
      // ignore transient error
    }
  };

  const levelInfo = getLevelProgress(profile.xp);
  const wheelClaimed = claimedKeys.includes('daily_wheel');
  const myReferralCode = profile.uid.slice(0, 8).toUpperCase();

  const handleClaimTask = async (task: DailyTask) => {
    setError(null);
    setFeedback(null);
    if (task.key === 'referral' && referralInput.trim().length < 4) {
      setError('أدخل كود إحالة صديقك أولاً (4 أحرف على الأقل).');
      return;
    }
    setBusyKey(task.key);
    try {
      const res = await claimDailyReward(profile, task.key, task.rewardCoins, task.rewardXp, {
        referralCode: task.key === 'referral' ? referralInput.trim() : undefined,
      });
      const earnedCoins = res?.rewardCoins ?? task.rewardCoins;
      const earnedXp = res?.rewardXp ?? task.rewardXp;
      setFeedback(`مبارك! حصلت على +${earnedCoins} عملة و +${earnedXp} XP.`);
      if (task.key === 'referral') setReferralInput('');
      await refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'لم تكتمل المهمة بعد أو تعذر الاستلام.');
      await refreshProgress();
    } finally {
      setBusyKey(null);
    }
  };

  const handleTriggerShare = async () => {
    setError(null);
    const shareUrl = window.location.origin;
    try {
      await navigator.clipboard?.writeText(`انضم إليّ في مجتمع فضفضة: ${shareUrl} (كود الدعوة: ${myReferralCode})`);
      await recordDailyTaskActivity('share');
      await refreshProgress();
      setFeedback('تم نسخ رابط الدعوة وتسجيل المشاركة! يمكنك الآن استلام المكافأة.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل المشاركة.');
    }
  };

  const handleCompleteSponsorAd = async () => {
    setError(null);
    try {
      await recordDailyTaskActivity('ad_watch');
      await refreshProgress();
      setSponsorAdOpen(false);
      setFeedback('تمت مشاهدة رسالة الراعي بنجاح! يمكنك الآن استلام المكافأة.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل مشاهدة الراعي.');
    }
  };

  const handleSpinWheel = async () => {
    if (wheelClaimed || spinning) return;
    setError(null);
    setFeedback(null);
    setSpinning(true);

    try {
      const res = await claimDailyReward(profile, 'daily_wheel', 0, 0);
      const pickIndex =
        typeof res?.wheelIndex === 'number' &&
        res.wheelIndex >= 0 &&
        res.wheelIndex < WHEEL_SEGMENTS.length
          ? res.wheelIndex
          : Math.max(
              0,
              WHEEL_SEGMENTS.findIndex((s) => s.coins === res?.rewardCoins)
            );
      const segAngle = 360 / WHEEL_SEGMENTS.length;
      const desiredMod = (360 - (pickIndex * segAngle + segAngle / 2)) % 360;
      const delta = (desiredMod - (rotationDeg % 360) + 360) % 360;
      const targetDeg = rotationDeg + 1440 + delta;
      setRotationDeg(targetDeg);

      const chosen = WHEEL_SEGMENTS[pickIndex];
      const earnedCoins = res?.rewardCoins ?? chosen.coins;
      const earnedXp = res?.rewardXp ?? chosen.xp;

      spinTimerRef.current = window.setTimeout(() => {
        setFeedback(`عجلة الحظ: ربحت ${earnedCoins} عملة و +${earnedXp} XP!`);
        setSpinning(false);
        spinTimerRef.current = null;
      }, 2350);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر استلام جائزة العجلة.');
      setSpinning(false);
    }
  };

  const handleCopyReferral = () => {
    navigator.clipboard?.writeText(myReferralCode);
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const activeTasks = tasks.filter((t) => t.isActive);
  const completedCount = activeTasks.filter((t) => claimedKeys.includes(t.key)).length;
  const sponsorAd = siteSettings.ads?.feed_inline;

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-5xl mx-auto space-y-3.5">
        <PageHeader
          title="المهام اليومية وعجلة الحظ"
          subtitle="أكمل النشاط المطلوب فعليًا ثم استلم مكافأتك الموثقة من السيرفر"
          icon={<Trophy className="w-4 h-4" />}
          action={
            <span className="text-xs font-semibold text-[#0B7A62] dark:text-[#34D399] font-mono tabular-nums">
              أُنجز {completedCount}/{activeTasks.length} اليوم
            </span>
          }
        />

        <div className="p-3.5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-900 dark:text-slate-100">
              المستوى {levelInfo.level} · {levelInfo.rankTitle}
            </span>
            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {profile.xp} / {levelInfo.nextLevelXp} XP
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-[#F2F4F7] dark:bg-[#18242B] overflow-hidden">
            <div
              className="h-full bg-[#0B7A62] dark:bg-[#34D399] rounded-full transition-all duration-300"
              style={{ width: `${levelInfo.percent}%` }}
            />
          </div>
        </div>

        {feedback && <FeedbackBanner type="success" message={feedback} />}
        {error && <FeedbackBanner type="error" message={error} />}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Daily Fortune Wheel */}
          <div className="lg:col-span-5 p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 flex flex-col items-center justify-between gap-3.5">
            <div className="text-center">
              <h2 className="font-display text-sm sm:text-base font-bold flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>عجلة الحظ اليومية</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                دورة مجانية واحدة كل 24 ساعة بجوائز فورية
              </p>
            </div>

            <div className="relative w-52 h-52 flex items-center justify-center">
              <div className="absolute -top-2 z-10 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-slate-900 dark:border-t-white" />
              <div
                className="w-48 h-48 rounded-full border-4 border-slate-200 dark:border-white/15 shadow-inner transition-transform duration-[2300ms] ease-out flex items-center justify-center relative overflow-hidden"
                style={{
                  transform: `rotate(${rotationDeg}deg)`,
                  background: `conic-gradient(${WHEEL_SEGMENTS.map(
                    (s, i) =>
                      `${s.color} ${(i * 100) / WHEEL_SEGMENTS.length}% ${
                        ((i + 1) * 100) / WHEEL_SEGMENTS.length
                      }%`
                  ).join(', ')})`,
                }}
              >
                <div className="w-12 h-12 rounded-full bg-white dark:bg-[#121B20] border-2 border-slate-200 dark:border-white/20 flex items-center justify-center shadow-sm">
                  <Gift className="w-5 h-5 text-[#0B7A62] dark:text-[#34D399]" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 w-full text-[11px]">
              {WHEEL_SEGMENTS.map((s) => (
                <div
                  key={s.label}
                  className="px-2 py-1 rounded-md bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 flex items-center justify-center gap-1.5 font-mono tabular-nums"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={wheelClaimed || spinning}
              onClick={() => void handleSpinWheel()}
              className="w-full min-h-[40px] rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
            >
              {wheelClaimed
                ? 'تم تدوير العجلة اليوم'
                : spinning
                ? 'جاري التدوير...'
                : 'أدر العجلة الآن!'}
            </button>
          </div>

          {/* Daily Tasks List + Referral */}
          <div className="lg:col-span-7 space-y-2.5">
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">كود الإحالة الخاص بك</p>
                <p dir="ltr" className="font-mono text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  {myReferralCode}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyReferral}
                className="min-h-[36px] px-3.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] hover:bg-slate-200/70 dark:hover:bg-[#18242B] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCode ? 'تم النسخ!' : 'نسخ الكود'}</span>
              </button>
            </div>

            <div className="rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 divide-y divide-slate-200/70 dark:divide-white/8">
              {activeTasks.map((task) => {
                const claimed = claimedKeys.includes(task.key);
                const verifiedReady =
                  claimed || task.key === 'checkin' || Boolean(progressMap[task.key]);

                return (
                  <div key={task.id} className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {task.title}
                          </h3>
                          {!claimed && (
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                verifiedReady
                                  ? 'bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399]'
                                  : 'bg-slate-100 dark:bg-[#18242B] text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {verifiedReady ? 'مكتملة' : 'لم تكتمل بعد'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {task.description}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-[#0B7A62] dark:text-[#34D399] font-semibold">
                          +{task.rewardCoins} عملة · +{task.rewardXp} XP ·{' '}
                          {claimed ? '1/1 تم الاستلام' : verifiedReady ? '1/1 جاهز' : '0/1'}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {task.key === 'share' && !claimed && !verifiedReady && (
                          <button
                            type="button"
                            onClick={() => void handleTriggerShare()}
                            className="min-h-[36px] px-3 rounded-lg border border-[#0B7A62]/40 text-[#0B7A62] dark:text-[#34D399] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>مشاركة</span>
                          </button>
                        )}
                        {task.key === 'ad_watch' && !claimed && !verifiedReady && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdCountdown(3);
                              setSponsorAdOpen(true);
                            }}
                            className="min-h-[36px] px-3 rounded-lg border border-[#0B7A62]/40 text-[#0B7A62] dark:text-[#34D399] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>مشاهدة</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={claimed || busyKey === task.key}
                          onClick={() => void handleClaimTask(task)}
                          className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                            claimed
                              ? 'bg-[#F2F4F7] dark:bg-[#18242B] text-slate-400 cursor-default'
                              : verifiedReady || task.key === 'referral'
                              ? 'bg-[#0B7A62] hover:bg-[#08614D] text-white cursor-pointer'
                              : 'bg-slate-200 dark:bg-[#18242B] text-slate-600 dark:text-slate-300 cursor-pointer'
                          }`}
                        >
                          {claimed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          <span>
                            {claimed
                              ? 'تم الاستلام'
                              : busyKey === task.key
                              ? 'جاري...'
                              : 'استلام'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {task.key === 'referral' && !claimed && (
                      <input
                        type="text"
                        value={referralInput}
                        onChange={(e) => setReferralInput(e.target.value)}
                        placeholder="أدخل كود إحالة صديقك هنا لتفعيل المكافأة..."
                        className="w-full min-h-[36px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs font-mono"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Sponsor Ad View Modal */}
      {sponsorAdOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 p-5 space-y-3.5 shadow-2xl fadfada-modal-in">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm sm:text-base font-bold">رسالة راعي المجتمع</h3>
              <button
                type="button"
                onClick={() => setSponsorAdOpen(false)}
                className="min-h-[32px] min-w-[32px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 rounded-xl bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 space-y-2 text-xs">
              <p className="font-bold text-sm text-slate-900 dark:text-slate-50">
                {sponsorAd?.title || 'شكرًا لكونك عضوًا فاعلًا في مجتمع فضفضة!'}
              </p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {sponsorAd?.body ||
                  'تواصل مع أصدقائك بأمان واحترام، وشارك في الغرف اليومية لرفع مستواك والحصول على شارات حصرية.'}
              </p>
            </div>
            <button
              type="button"
              disabled={adCountdown > 0}
              onClick={() => void handleCompleteSponsorAd()}
              className="w-full min-h-[38px] rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {adCountdown > 0
                ? `انتظر ${adCountdown} ثوانٍ لإتمام المشاهدة...`
                : 'تأكيد إتمام المشاهدة'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
