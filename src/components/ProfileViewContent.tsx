import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  Check,
  ExternalLink,
  Flag,
  Gift,
  Heart,
  HeartHandshake,
  Info,
  MapPin,
  MessageCircle,
  Sparkles,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { subscribeToWallPosts } from '../services/community';
import {
  proposeMarriage,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
  sendGiftToUser,
  submitReport,
} from '../services/economy';
import { likeUserProfile } from '../services/profiles';
import { useApp } from '../state/AppContext';
import type { UserProfile } from '../types/fadfada';
import { formatRelativeLastSeen, timestampToMillis } from '../utils/formatters';
import {
  AVATAR_FRAMES,
  displayCountryName,
  getActiveBadges,
  getEffectiveVipTier,
  getGenderStyle,
  getLevelProgress,
  VIP_LABELS,
} from '../utils/progression';
import { Avatar } from './Avatar';
import { FeedbackBanner, SegmentedTabs } from './ui/Primitives';

type ProfileTab = 'overview' | 'info' | 'badges' | 'relations' | 'stats';

const MARITAL_LABELS: Record<string, string> = {
  single: 'أعزب',
  engaged: 'مخطوب',
  married: 'متزوج',
  complicated: 'علاقة معقدة',
};

const MESSAGE_PERM_LABELS: Record<string, string> = {
  everyone: 'متاح للجميع',
  friends: 'الأصدقاء فقط',
  nobody: 'مغلق',
};

function formatJoinDate(ts: UserProfile['createdAt']): string {
  const millis = timestampToMillis(ts);
  if (!millis) return 'غير مسجل';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(millis));
}

interface ProfileViewContentProps {
  target: UserProfile;
  onStartChat: (uid: string) => void;
  onInspectUser?: (uid: string) => void;
  onClose?: () => void;
  onBackMobile?: () => void;
  onExpandModal?: () => void;
}

export const ProfileViewContent: React.FC<ProfileViewContentProps> = ({
  target,
  onStartChat,
  onInspectUser,
  onClose,
  onBackMobile,
  onExpandModal,
}) => {
  const {
    profile: me,
    isGuest,
    isStaff,
    usersById,
    isPeerOnline,
    getPeerLastSeenMillis,
    relationships,
    storeItems,
    siteSettings,
    openProfileModal,
  } = useApp();

  const [tab, setTab] = useState<ProfileTab>('overview');
  const [wallPostsCount, setWallPostsCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showGiftMenu, setShowGiftMenu] = useState(false);
  const [showMarriageBox, setShowMarriageBox] = useState(false);
  const [dowry, setDowry] = useState(100);
  const [marriageMsg, setMarriageMsg] = useState('');
  const [showReportBox, setShowReportBox] = useState(false);
  const [reportReason, setReportReason] = useState('محتوى مسيء');
  const [reportDetails, setReportDetails] = useState('');

  // Reset transient sub-panels when switching inspected user
  useEffect(() => {
    setTab('overview');
    setFeedback(null);
    setShowGiftMenu(false);
    setShowMarriageBox(false);
    setShowReportBox(false);
  }, [target.uid]);

  useEffect(() => {
    const unsub = subscribeToWallPosts((posts) => {
      setWallPostsCount(posts.filter((p) => p.authorId === target.uid).length);
    });
    return () => unsub();
  }, [target.uid]);

  const gifts = useMemo(
    () => storeItems.filter((item) => item.section === 'gift' && item.isActive),
    [storeItems]
  );

  if (!me) return null;

  const isMe = target.uid === me.uid;
  const targetIsGuest = target.role === 'guest' || target.isAnonymous;
  const online = isPeerOnline(target, isStaff);
  const lastSeenMs = getPeerLastSeenMillis(target);
  const genderStyle = getGenderStyle(target.gender);
  const levelInfo = getLevelProgress(target.xp);
  const effectiveVip = !targetIsGuest
    ? getEffectiveVipTier(target.vipTier, target.vipExpiresAt)
    : 'none';
  const vipMeta = VIP_LABELS[effectiveVip];
  const activeBadges = getActiveBadges(target.badges);
  const existingRel = relationships.find((r) => r.participantIds.includes(target.uid));
  const isFriend = existingRel?.status === 'accepted';
  const isIncomingRequest =
    existingRel?.status === 'pending' && existingRel.recipientId === me.uid;
  const isOutgoingRequest =
    existingRel?.status === 'pending' && existingRel.requesterId === me.uid;

  const msgPerm = target.privacy?.messagePermission ?? 'everyone';
  const canMessage =
    !isMe &&
    (isStaff || msgPerm === 'everyone' || (msgPerm === 'friends' && isFriend));
  const messageBlockedReason =
    msgPerm === 'nobody'
      ? 'أغلق العضو استقبال الرسائل الخاصة'
      : msgPerm === 'friends' && !isFriend
      ? 'المراسلة الخاصة متاحة للأصدقاء فقط'
      : null;

  const handleInspectPartner = (partnerUid: string) => {
    if (!partnerUid || !usersById[partnerUid]) return;
    if (onInspectUser) onInspectUser(partnerUid);
    else openProfileModal(partnerUid);
  };

  const handleLike = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await likeUserProfile(target.uid);
      setFeedback({ type: 'success', text: 'تم تسجيل إعجابك بالملف الشخصي.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تسجيل الإعجاب.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleFriendRequest = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await sendFriendRequest(me, target);
      setFeedback({ type: 'success', text: 'تم إرسال طلب الصداقة.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر إرسال طلب الصداقة.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRespondFriend = async (accept: boolean) => {
    if (!existingRel) return;
    setBusy(true);
    setFeedback(null);
    try {
      await respondFriendRequest(existingRel, me.uid, accept);
      setFeedback({
        type: 'success',
        text: accept ? 'تم قبول طلب الصداقة.' : 'تم رفض طلب الصداقة.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تنفيذ الإجراء.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveOrCancelFriend = async (isCancel: boolean) => {
    if (!existingRel) return;
    setBusy(true);
    setFeedback(null);
    try {
      await removeFriend(existingRel, me.uid);
      setFeedback({
        type: 'success',
        text: isCancel ? 'تم إلغاء طلب الصداقة.' : 'تمت إزالة الصداقة.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر تحديث الصداقة.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSendGift = async (giftId: string) => {
    const gift = gifts.find((g) => g.id === giftId);
    if (!gift) return;
    setBusy(true);
    setFeedback(null);
    try {
      await sendGiftToUser(me, target, gift, true);
      setShowGiftMenu(false);
      setFeedback({ type: 'success', text: `تم إرسال ${gift.name} إلى ${target.displayName}!` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر إرسال الهدية.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleProposeMarriage = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await proposeMarriage(
        me,
        target,
        dowry,
        siteSettings.marriageSiteFeePercent,
        marriageMsg
      );
      setShowMarriageBox(false);
      setFeedback({ type: 'success', text: 'تم إرسال عرض الزواج وحجز المهر بنجاح.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر إرسال عرض الزواج.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await submitReport(me.uid, target.uid, target.displayName, reportReason, reportDetails);
      setShowReportBox(false);
      setReportDetails('');
      setFeedback({ type: 'success', text: 'تم إرسال البلاغ للمراجعة من الإدارة.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر إرسال البلاغ.',
      });
    } finally {
      setBusy(false);
    }
  };

  const roleLabel =
    target.role === 'owner'
      ? 'المالك'
      : target.role === 'moderator'
      ? 'مشرف'
      : targetIsGuest
      ? 'ضيف'
      : 'عضو';

  const frameLabel = AVATAR_FRAMES[target.frameId]?.label ?? 'بدون إطار';

  return (
    <div className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-xl overflow-hidden shadow-2xs">
      {/* Mobile Back Header (Online Directory Preview) */}
      {onBackMobile && (
        <div className="md:hidden px-3 py-2 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackMobile}
            className="min-h-[34px] px-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة المتواجدين</span>
          </button>
          {onExpandModal && (
            <button
              type="button"
              onClick={onExpandModal}
              className="min-h-[32px] px-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>نافذة مستقلة</span>
            </button>
          )}
        </div>
      )}

      {/* Cover Header */}
      <div className={`relative h-28 sm:h-32 bg-gradient-to-l ${genderStyle.headerGradientClass}`}>
        {target.cover && (
          <img
            src={target.cover}
            alt="صورة الغلاف"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-2.5 left-2.5 min-h-[34px] min-w-[34px] rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {!onClose && onExpandModal && (
          <button
            type="button"
            onClick={onExpandModal}
            title="فتح في نافذة مستقلة"
            className="hidden md:inline-flex absolute top-2.5 left-2.5 min-h-[30px] px-2.5 rounded-lg bg-black/45 hover:bg-black/65 text-white text-[11px] font-semibold items-center gap-1 cursor-pointer transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>تكبير</span>
          </button>
        )}
      </div>

      <div className="px-4 sm:px-5 pb-5">
        {/* Avatar & Live Presence */}
        <div className="-mt-10 flex items-end justify-between gap-3">
          <Avatar
            src={target.avatar}
            name={target.displayName}
            size="xl"
            frameId={target.frameId}
            gender={target.gender}
            isOnline={online}
            showPresence
          />
          <div className="flex items-center gap-1.5 pb-1">
            <span
              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 ${genderStyle.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${genderStyle.dotClass}`} />
              <span>{genderStyle.label}</span>
            </span>
            <span
              className={`text-xs font-semibold ${
                online ? 'text-[#0B7A62] dark:text-[#34D399]' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {formatRelativeLastSeen(lastSeenMs, online)}
            </span>
          </div>
        </div>

        {/* Name, Role, VIP & Core Metadata */}
        <div className="mt-2.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2
              className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
              style={target.nameColor ? { color: target.nameColor } : undefined}
            >
              {target.displayName}
            </h2>
            {isMe && (
              <span className="px-1.5 py-0.5 rounded bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] text-[10px] font-bold">
                أنت
              </span>
            )}
            {effectiveVip !== 'none' && (
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                · {vipMeta.label}
              </span>
            )}
            {target.role !== 'member' && (
              <span className="text-xs font-semibold text-[#0B7A62] dark:text-[#34D399]">
                · {roleLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span dir="ltr" className="font-mono">
              @{target.username}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{displayCountryName(target.country, target.countryFlag)}</span>
            </span>
            {target.age > 0 && (
              <>
                <span>·</span>
                <span>{target.age} سنة</span>
              </>
            )}
            {!targetIsGuest && (
              <>
                <span>·</span>
                <span>{MARITAL_LABELS[target.maritalStatus] ?? 'أعزب'}</span>
                {target.partnerName && (
                  <>
                    <span>مع</span>
                    {target.partnerUid && usersById[target.partnerUid] ? (
                      <button
                        type="button"
                        onClick={() => handleInspectPartner(target.partnerUid)}
                        className="font-bold text-[#0B7A62] dark:text-[#34D399] hover:underline cursor-pointer"
                      >
                        {target.partnerName}
                      </button>
                    ) : (
                      <strong className="text-slate-800 dark:text-slate-200">
                        {target.partnerName}
                      </strong>
                    )}
                  </>
                )}
              </>
            )}
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>انضم {formatJoinDate(target.createdAt)}</span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        {!isMe && (
          <div className="mt-3.5 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!canMessage}
                onClick={() => onStartChat(target.uid)}
                className="min-h-[38px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{canMessage ? 'محادثة' : 'الرسائل مقيدة'}</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleLike}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${genderStyle.secondaryButtonClass}`}
              >
                <Heart className="w-4 h-4 text-rose-500" />
                <span>إعجاب</span>
                <span className="font-mono tabular-nums text-[11px] opacity-80">
                  ({target.likesCount})
                </span>
              </button>

              {!isGuest && !targetIsGuest && (
                <>
                  {!existingRel && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleFriendRequest}
                      className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>إضافة صديق</span>
                    </button>
                  )}

                  {isIncomingRequest && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRespondFriend(true)}
                        className="min-h-[38px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        <span>قبول الصداقة</span>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleRespondFriend(false)}
                        className="min-h-[38px] px-3 rounded-lg border border-rose-200 dark:border-rose-900/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-medium inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <X className="w-4 h-4" />
                        <span>رفض</span>
                      </button>
                    </>
                  )}

                  {isOutgoingRequest && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRemoveOrCancelFriend(true)}
                      className="min-h-[38px] px-3 rounded-lg border border-amber-300/80 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                      <span>إلغاء الطلب</span>
                    </button>
                  )}

                  {isFriend && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleRemoveOrCancelFriend(false)}
                      className="min-h-[38px] px-3 rounded-lg border border-emerald-300/80 dark:border-emerald-700/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>صديق · إزالة</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowGiftMenu((p) => !p);
                      setShowMarriageBox(false);
                      setShowReportBox(false);
                    }}
                    className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Gift className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>هدية</span>
                  </button>

                  {target.maritalStatus !== 'married' && me.maritalStatus !== 'married' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMarriageBox((p) => !p);
                        setShowGiftMenu(false);
                        setShowReportBox(false);
                      }}
                      className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <HeartHandshake className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>طلب زواج</span>
                    </button>
                  )}
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowReportBox((p) => !p);
                  setShowGiftMenu(false);
                  setShowMarriageBox(false);
                }}
                className="min-h-[38px] px-3 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>إبلاغ</span>
              </button>
            </div>

            {!canMessage && messageBlockedReason && (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/50 rounded-lg px-2.5 py-1.5">
                {messageBlockedReason}
              </p>
            )}
          </div>
        )}

        {feedback && (
          <div className="mt-3">
            <FeedbackBanner type={feedback.type} message={feedback.text} />
          </div>
        )}

        {/* Inline Gift Picker */}
        {showGiftMenu && (
          <div className="mt-3 p-3.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] space-y-2">
            <p className="text-xs font-semibold">اختر هدية لإرسالها (رصيدك: {me.coins} عملة)</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {gifts.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSendGift(g.id)}
                  className="p-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121B20] hover:border-[#0B7A62] text-right text-xs cursor-pointer transition-colors"
                >
                  <p className="font-semibold">{g.name}</p>
                  <p className="font-mono tabular-nums text-slate-500 mt-0.5">{g.priceCoins} عملة</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Inline Marriage Form */}
        {showMarriageBox && (
          <form
            onSubmit={handleProposeMarriage}
            className="mt-3 p-3.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] space-y-2.5"
          >
            <p className="text-xs font-semibold">
              تقديم عرض زواج (رسوم الموقع {siteSettings.marriageSiteFeePercent}% من المهر)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">المهر (عملة)</label>
                <input
                  type="number"
                  min={50}
                  value={dowry}
                  onChange={(e) => setDowry(Number(e.target.value))}
                  className="w-full min-h-[36px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121B20] text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">كلمة لطيفة</label>
                <input
                  type="text"
                  maxLength={200}
                  value={marriageMsg}
                  onChange={(e) => setMarriageMsg(e.target.value)}
                  placeholder="رسالة مرفقة..."
                  className="w-full min-h-[36px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121B20] text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="min-h-[36px] px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
            >
              إرسال طلب الزواج
            </button>
          </form>
        )}

        {/* Inline Report Form */}
        {showReportBox && (
          <form
            onSubmit={handleReport}
            className="mt-3 p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/70 bg-rose-50/40 dark:bg-rose-950/20 space-y-2"
          >
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">إرسال بلاغ للإدارة</p>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full min-h-[36px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121B20] text-xs"
            >
              <option value="محتوى مسيء">محتوى مسيء أو سب</option>
              <option value="تحرش أو إزعاج">تحرش أو إزعاج</option>
              <option value="انتحال شخصية">انتحال شخصية</option>
              <option value="احتيال">احتيال أو روابط مشبوهة</option>
            </select>
            <textarea
              rows={2}
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              placeholder="تفاصيل إضافية..."
              className="w-full p-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121B20] text-xs"
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[36px] px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
            >
              إرسال البلاغ
            </button>
          </form>
        )}

        {/* Organized Profile Tabs */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/8">
          <SegmentedTabs<ProfileTab>
            value={tab}
            onChange={setTab}
            items={[
              { id: 'overview', label: 'الرئيسية', icon: Sparkles },
              { id: 'info', label: 'المعلومات', icon: Info },
              { id: 'badges', label: 'الشارات', icon: Award, count: activeBadges.length },
              { id: 'relations', label: 'العلاقات', icon: Users },
              { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
            ]}
          />

          <div className="mt-3 space-y-3">
            {tab === 'overview' && (
              <>
                <div className="p-3 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 space-y-1.5">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    النبذة التعريفية
                  </p>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                    {target.bio ? target.bio : 'لم يُضف العضو نبذة تعريفية بعد.'}
                  </p>
                  {target.affiliation && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                      الانتماء / المزاج: <strong className="font-semibold">{target.affiliation}</strong>
                    </p>
                  )}
                </div>

                {targetIsGuest ? (
                  <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200">
                    حساب ضيف — المستويات والعملات والهدايا والزواج متاحة للأعضاء المسجلين فقط.
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/80 dark:border-white/10 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          المستوى {levelInfo.level} · {levelInfo.rankTitle}
                        </span>
                        <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                          {target.xp} XP
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#18242B] overflow-hidden">
                        <div
                          className="h-full bg-[#0B7A62] dark:bg-[#34D399] rounded-full transition-all"
                          style={{ width: `${levelInfo.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center text-xs pt-0.5">
                      <div>
                        <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {target.likesCount}
                        </p>
                        <p className="text-[10px] text-slate-500">إعجاب</p>
                      </div>
                      <div>
                        <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {target.visitsCount}
                        </p>
                        <p className="text-[10px] text-slate-500">زيارة</p>
                      </div>
                      <div>
                        <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {target.giftsReceivedCount}
                        </p>
                        <p className="text-[10px] text-slate-500">هدية</p>
                      </div>
                      <div>
                        <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {target.friendsCount}
                        </p>
                        <p className="text-[10px] text-slate-500">صديق</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeBadges.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                      أبرز الشارات
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {activeBadges.slice(0, 6).map((b) => (
                        <span
                          key={b.id}
                          className="text-xs font-semibold px-2.5 py-0.5 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114]"
                          style={{ color: b.color }}
                        >
                          {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {tab === 'info' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">النوع</span>
                  <span className={`px-2 py-0.5 rounded-md font-semibold ${genderStyle.badgeClass}`}>
                    {genderStyle.label}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">الدولة</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {displayCountryName(target.country, target.countryFlag)}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">العمر</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {target.age > 0 ? `${target.age} سنة` : 'غير محدد'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">تاريخ الانضمام</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {formatJoinDate(target.createdAt)}
                  </span>
                </div>
                {!targetIsGuest && (
                  <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">الحالة الاجتماعية</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      {MARITAL_LABELS[target.maritalStatus] ?? 'أعزب'}
                    </span>
                  </div>
                )}
                <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">الانتماء / الاهتمام</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100 truncate max-w-[160px]">
                    {target.affiliation || 'غير محدد'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">نوع الحساب</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{roleLabel}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">خصوصية المراسلة</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {MESSAGE_PERM_LABELS[msgPerm] ?? 'متاح للجميع'}
                  </span>
                </div>
              </div>
            )}

            {tab === 'badges' && (
              <div className="space-y-3">
                {!targetIsGuest && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                      <p className="text-[11px] text-slate-500">اللقب</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                        {levelInfo.rankTitle}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                      <p className="text-[11px] text-slate-500">عضوية VIP</p>
                      <p className="font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                        {vipMeta.label}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                      <p className="text-[11px] text-slate-500">الإطار النشط</p>
                      <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                        {frameLabel}
                      </p>
                    </div>
                  </div>
                )}

                {activeBadges.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {activeBadges.map((b) => (
                      <div
                        key={b.id}
                        className="px-3 py-1.5 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F7F9FB] dark:bg-[#0B1114] text-xs font-semibold flex items-center gap-1.5"
                        style={{ color: b.color }}
                      >
                        <Award className="w-3.5 h-3.5 shrink-0" />
                        <span>{b.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-4 text-center rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 text-xs text-slate-500 dark:text-slate-400">
                    لا توجد شارات نشطة لهذا الحساب حاليًا.
                  </p>
                )}
              </div>
            )}

            {tab === 'relations' && (
              <div className="space-y-2.5 text-xs">
                {!targetIsGuest && (
                  <div className="p-3 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">الارتباط والزواج</p>
                      <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {MARITAL_LABELS[target.maritalStatus] ?? 'أعزب'}
                        {target.partnerName ? ` · الشريك: ${target.partnerName}` : ''}
                      </p>
                    </div>
                    {target.partnerUid && usersById[target.partnerUid] && (
                      <button
                        type="button"
                        onClick={() => handleInspectPartner(target.partnerUid)}
                        className="min-h-[30px] px-2.5 rounded-md border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121B20] text-[#0B7A62] dark:text-[#34D399] font-semibold cursor-pointer"
                      >
                        عرض ملف الشريك
                      </button>
                    )}
                  </div>
                )}

                <div className="p-3 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">حالة الصداقة</p>
                    <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {isMe
                        ? `لديك ${target.friendsCount} صديق`
                        : targetIsGuest
                        ? 'حساب الضيف لا يدعم الصداقات الدائمة'
                        : isFriend
                        ? 'أصدقاء'
                        : isIncomingRequest
                        ? 'أرسل لك طلب صداقة بانتظار الرد'
                        : isOutgoingRequest
                        ? 'أرسلت له طلب صداقة (معلّق)'
                        : 'لستما أصدقاء بعد'}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-bold px-2.5 py-1 rounded-md bg-white dark:bg-[#121B20] border border-slate-200/70 dark:border-white/10">
                    {target.friendsCount} صديق
                  </span>
                </div>
              </div>
            )}

            {tab === 'stats' && (
              <>
                {targetIsGuest ? (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/70 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200">
                      إحصائيات المستويات والعملات والهدايا مخفية لحسابات الضيوف.
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="p-3 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                        <p className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-slate-100">
                          {target.visitsCount}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">زيارة للملف</p>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                        <p className="font-mono tabular-nums font-bold text-base text-slate-900 dark:text-slate-100">
                          {target.likesCount}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">إعجاب</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
                    {[
                      { label: 'الأصدقاء', value: target.friendsCount },
                      { label: 'الزيارات', value: target.visitsCount },
                      { label: 'الإعجابات', value: target.likesCount },
                      { label: 'الهدايا المستلمة', value: target.giftsReceivedCount },
                      { label: 'الهدايا المرسلة', value: target.giftsSentCount },
                      { label: 'منشورات الحائط', value: wallPostsCount },
                      { label: `المستوى (${levelInfo.level})`, value: `${target.xp} XP` },
                      ...(isMe ? [{ label: 'رصيد العملات', value: target.coins }] : []),
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8"
                      >
                        <p className="font-mono tabular-nums font-bold text-sm text-slate-900 dark:text-slate-100">
                          {stat.value}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
