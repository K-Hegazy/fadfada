import React, { useEffect, useRef, useState } from 'react';
import {
  Award,
  Calendar,
  Camera,
  Eye,
  ImagePlus,
  KeyRound,
  LogOut,
  MailCheck,
  MapPin,
  Save,
  Shield,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { subscribeToWallPosts } from '../services/community';
import {
  subscribeToProfileVisits,
  updateUserPrivacy,
  updateUserProfile,
} from '../services/profiles';
import { uploadImageAsset } from '../services/storage';
import { useApp } from '../state/AppContext';
import {
  SCHEMA_LIMITS,
  type AppTimestamp,
  type GenderType,
  type MaritalStatusType,
  type MessagePermission,
  type ProfileVisit,
} from '../types/fadfada';
import { formatRelativeLastSeen, timestampToMillis } from '../utils/formatters';
import {
  AVATAR_FRAMES,
  COUNTRIES,
  displayCountryName,
  getActiveBadges,
  getEffectiveVipTier,
  getGenderStyle,
  getLevelProgress,
  VIP_LABELS,
} from '../utils/progression';
import { Avatar } from './Avatar';
import { FeedbackBanner, SectionSkeleton, SegmentedTabs } from './ui/Primitives';

type SettingsTab = 'overview' | 'profile' | 'privacy' | 'security';

const MARITAL_LABELS: Record<string, string> = {
  single: 'أعزب',
  engaged: 'مخطوب',
  married: 'متزوج',
  complicated: 'علاقة معقدة',
};

function formatJoinDate(ts: AppTimestamp): string {
  const millis = timestampToMillis(ts);
  if (!millis) return 'غير مسجل';
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(millis));
}

export const ProfilePanel: React.FC = () => {
  const {
    authUser,
    profile,
    isGuest,
    logout,
    upgradeGuest,
    sendResetEmail,
    sendVerifyEmail,
    presenceState,
    isPeerOnline,
    getPeerLastSeenMillis,
    openProfileModal,
    usersById,
  } = useApp();

  const [tab, setTab] = useState<SettingsTab>('overview');
  const [visits, setVisits] = useState<ProfileVisit[]>([]);
  const [wallPostsCount, setWallPostsCount] = useState(0);

  // Profile fields
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [cover, setCover] = useState('');
  const [gender, setGender] = useState<GenderType>('unspecified');
  const [age, setAge] = useState(0);
  const [country, setCountry] = useState('');
  const [countryFlag, setCountryFlag] = useState('');
  const [maritalStatus, setMaritalStatus] = useState<MaritalStatusType>('single');
  const [affiliation, setAffiliation] = useState('');

  // Privacy fields
  const [ghostMode, setGhostMode] = useState(false);
  const [hideLastSeen, setHideLastSeen] = useState(false);
  const [messagePermission, setMessagePermission] = useState<MessagePermission>('everyone');
  const [showOnline, setShowOnline] = useState(true);
  const [soundNotifications, setSoundNotifications] = useState(true);
  const [visualNotifications, setVisualNotifications] = useState(true);
  const [isPublic, setIsPublic] = useState(true);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [upgradeEmail, setUpgradeEmail] = useState('');
  const [upgradePassword, setUpgradePassword] = useState('');
  const [upgradeName, setUpgradeName] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setUsername(profile.username);
    setBio(profile.bio);
    setAvatar(profile.avatar);
    setCover(profile.cover);
    setGender(profile.gender);
    setAge(profile.age);
    setCountry(profile.country);
    setCountryFlag(profile.countryFlag);
    setMaritalStatus(profile.maritalStatus);
    setAffiliation(profile.affiliation);

    setGhostMode(profile.ghostMode);
    setHideLastSeen(profile.hideLastSeen);
    setMessagePermission(profile.privacy?.messagePermission ?? 'everyone');
    setShowOnline(profile.privacy?.showOnline ?? true);
    setSoundNotifications(profile.privacy?.soundNotifications ?? true);
    setVisualNotifications(profile.privacy?.visualNotifications ?? true);
    setIsPublic(profile.isPublic);
  }, [profile]);

  useEffect(() => {
    if (!authUser?.uid) return;
    const unsubVisits = subscribeToProfileVisits(authUser.uid, (list) => {
      const sorted = [...list].sort(
        (a, b) => timestampToMillis(b.visitedAt) - timestampToMillis(a.visitedAt)
      );
      setVisits(sorted);
    });
    const unsubWall = subscribeToWallPosts((posts) => {
      setWallPostsCount(posts.filter((p) => p.authorId === authUser.uid).length);
    });
    return () => {
      unsubVisits();
      unsubWall();
    };
  }, [authUser?.uid]);

  if (!authUser || !profile) {
    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-3xl mx-auto">
          <SectionSkeleton rows={3} />
        </div>
      </div>
    );
  }

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      const url = await uploadImageAsset('avatars', authUser.uid, file);
      setAvatar(url);
      await updateUserProfile(authUser.uid, {
        username,
        displayName,
        avatar: url,
        cover,
        bio,
        gender,
        age,
        country,
        countryFlag,
        maritalStatus,
        affiliation,
      });
      setFeedback({ type: 'success', text: 'تم رفع وتحديث الصورة الشخصية.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'تعذر رفع الصورة.' });
    } finally {
      setUploading(false);
    }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setFeedback(null);
    try {
      const url = await uploadImageAsset('covers', authUser.uid, file);
      setCover(url);
      await updateUserProfile(authUser.uid, {
        username,
        displayName,
        avatar,
        cover: url,
        bio,
        gender,
        age,
        country,
        countryFlag,
        maritalStatus,
        affiliation,
      });
      setFeedback({ type: 'success', text: 'تم تحديث صورة الغلاف.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'تعذر رفع الغلاف.' });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await updateUserProfile(authUser.uid, {
        username,
        displayName,
        avatar,
        cover,
        bio,
        gender,
        age,
        country,
        countryFlag,
        maritalStatus,
        affiliation,
      });
      setFeedback({ type: 'success', text: 'تم حفظ بيانات الملف الشخصي بنجاح.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'تعذر الحفظ.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrivacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await updateUserPrivacy(authUser.uid, {
        ghostMode,
        hideLastSeen,
        isPublic,
        privacy: {
          messagePermission,
          showOnline,
          soundNotifications,
          visualNotifications,
        },
      });
      setFeedback({ type: 'success', text: 'تم حفظ إعدادات الخصوصية والإشعارات.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'تعذر تحديث الخصوصية.' });
    } finally {
      setSaving(false);
    }
  };

  const onlineNow = isPeerOnline(profile);
  const lastSeenMs = getPeerLastSeenMillis(profile);
  const genderStyle = getGenderStyle(profile.gender);
  const levelInfo = getLevelProgress(profile.xp);
  const effectiveVip = !isGuest ? getEffectiveVipTier(profile.vipTier, profile.vipExpiresAt) : 'none';
  const vipMeta = VIP_LABELS[effectiveVip];
  const activeBadges = getActiveBadges(profile.badges);
  const frameLabel = AVATAR_FRAMES[profile.frameId]?.label ?? 'بدون إطار';

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-3xl mx-auto space-y-3.5">
        {/* Social Profile Header Card */}
        <div className="rounded-xl overflow-hidden bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10">
          <div className={`relative h-32 sm:h-36 bg-gradient-to-l ${genderStyle.headerGradientClass}`}>
            {cover && (
              <img
                src={cover}
                alt="صورة الغلاف"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            )}
            <button
              type="button"
              disabled={uploading}
              onClick={() => coverInputRef.current?.click()}
              className="absolute top-2.5 left-2.5 min-h-[32px] px-2.5 rounded-lg bg-black/55 hover:bg-black/75 text-white text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span>تغيير الغلاف</span>
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadCover}
              className="hidden"
            />
          </div>

          <div className="p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex items-end gap-3.5">
                <div className="relative -mt-12 shrink-0">
                  <Avatar
                    src={avatar}
                    name={displayName || profile.displayName}
                    size="xl"
                    frameId={profile.frameId}
                    gender={profile.gender}
                    isOnline={onlineNow}
                    showPresence
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => avatarInputRef.current?.click()}
                    aria-label="تغيير الصورة"
                    className="absolute -bottom-1 -left-1 min-h-[32px] min-w-[32px] rounded-full bg-white dark:bg-[#18242B] border border-slate-200 dark:border-white/15 flex items-center justify-center cursor-pointer shadow-xs hover:scale-105 transition-transform"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadAvatar}
                    className="hidden"
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h1
                      className="font-display text-lg font-bold text-slate-900 dark:text-slate-50"
                      style={profile.nameColor ? { color: profile.nameColor } : undefined}
                    >
                      {profile.displayName}
                    </h1>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1 ${genderStyle.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${genderStyle.dotClass}`} />
                      <span>{genderStyle.label}</span>
                    </span>
                    {effectiveVip !== 'none' && (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        · {vipMeta.label}
                      </span>
                    )}
                    {profile.role !== 'member' && (
                      <span className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399]">
                        · {profile.role === 'owner' ? 'المالك' : profile.role === 'moderator' ? 'مشرف' : 'ضيف'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span dir="ltr" className="font-mono">@{profile.username}</span>
                    <span>·</span>
                    <span>{formatRelativeLastSeen(lastSeenMs, onlineNow)}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{displayCountryName(profile.country, profile.countryFlag)}</span>
                    </span>
                    {profile.age > 0 && (
                      <>
                        <span>·</span>
                        <span>{profile.age} سنة</span>
                      </>
                    )}
                    {!isGuest && (
                      <>
                        <span>·</span>
                        <span>{MARITAL_LABELS[profile.maritalStatus] ?? 'أعزب'}</span>
                        {profile.partnerName && (
                          <>
                            <span>مع</span>
                            {profile.partnerUid && usersById[profile.partnerUid] ? (
                              <button
                                type="button"
                                onClick={() => openProfileModal(profile.partnerUid)}
                                className="font-bold text-[#0B7A62] dark:text-[#34D399] hover:underline cursor-pointer"
                              >
                                {profile.partnerName}
                              </button>
                            ) : (
                              <strong className="text-slate-700 dark:text-slate-200">{profile.partnerName}</strong>
                            )}
                          </>
                        )}
                      </>
                    )}
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>انضم {formatJoinDate(profile.createdAt)}</span>
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void logout()}
                className="min-h-[36px] px-3.5 rounded-lg border border-rose-200 dark:border-rose-900/70 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل الخروج</span>
              </button>
            </div>

            {isGuest ? (
              <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-amber-900 dark:text-amber-200">
                  حساب ضيف — العملات والمستويات والهدايا متاحة بعد ترقية الحساب لعضو دائم.
                </span>
                <button
                  type="button"
                  onClick={() => setTab('security')}
                  className="min-h-[30px] px-3 rounded-md bg-[#0B7A62] text-white font-semibold cursor-pointer"
                >
                  ترقية الحساب
                </button>
              </div>
            ) : (
              /* Level progress + inline stats */
              <div className="p-3 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">
                      المستوى {levelInfo.level} · {levelInfo.rankTitle}
                    </span>
                    <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      {profile.xp} XP
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
                      {profile.coins}
                    </p>
                    <p className="text-[10px] text-slate-500">عملة</p>
                  </div>
                  <div>
                    <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {profile.friendsCount}
                    </p>
                    <p className="text-[10px] text-slate-500">صديق</p>
                  </div>
                  <div>
                    <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {profile.likesCount}
                    </p>
                    <p className="text-[10px] text-slate-500">إعجاب</p>
                  </div>
                  <div>
                    <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {profile.visitsCount}
                    </p>
                    <p className="text-[10px] text-slate-500">زيارة</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings & Profile Sub-tabs */}
        <SegmentedTabs<SettingsTab>
          value={tab}
          onChange={(next) => {
            setTab(next);
            setFeedback(null);
          }}
          items={[
            { id: 'overview', label: 'ملفي والزوار', icon: Sparkles },
            { id: 'profile', label: 'تعديل الملف الشخصي', icon: UserCheck },
            { id: 'privacy', label: 'الخصوصية والإشعارات', icon: Shield },
            { id: 'security', label: 'الأمان والحساب', icon: KeyRound },
          ]}
        />

        {feedback && <FeedbackBanner type={feedback.type} message={feedback.text} />}

        {tab === 'overview' && (
          <div className="space-y-3">
            {/* Bio & Affiliation */}
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  النبذة والمعلومات
                </h2>
                <button
                  type="button"
                  onClick={() => setTab('profile')}
                  className="text-xs font-semibold text-[#0B7A62] dark:text-[#34D399] hover:underline cursor-pointer"
                >
                  تعديل البيانات
                </button>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {profile.bio ? profile.bio : 'لم تكتب نبذة تعريفية بعد.'}
              </p>
              {profile.affiliation && (
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  الانتماء / الاهتمام: <strong>{profile.affiliation}</strong>
                </p>
              )}
              {!isGuest && (
                <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                    <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {profile.giftsReceivedCount}
                    </p>
                    <p className="text-[11px] text-slate-500">هدايا مستلمة</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                    <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {profile.giftsSentCount}
                    </p>
                    <p className="text-[11px] text-slate-500">هدايا مرسلة</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                    <p className="font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                      {wallPostsCount}
                    </p>
                    <p className="text-[11px] text-slate-500">منشورات الحائط</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-[#F7F9FB] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/8">
                    <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {frameLabel}
                    </p>
                    <p className="text-[11px] text-slate-500">إطار الصورة</p>
                  </div>
                </div>
              )}
            </div>

            {/* Badges Showcase */}
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#0B7A62] dark:text-[#34D399]" />
                <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  الشارات المكتسبة ({activeBadges.length})
                </h2>
              </div>
              {activeBadges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeBadges.map((b) => (
                    <span
                      key={b.id}
                      className="px-3 py-1 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F7F9FB] dark:bg-[#0B1114] text-xs font-semibold inline-flex items-center gap-1.5"
                      style={{ color: b.color }}
                    >
                      <Award className="w-3.5 h-3.5 shrink-0" />
                      <span>{b.name}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  لا توجد شارات نشطة بعد — يمكنك اقتناء الشارات من المتجر أو كسبها من الأنشطة.
                </p>
              )}
            </div>

            {/* Real Profile Visitors */}
            <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#0B7A62] dark:text-[#34D399]" />
                  <h2 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                    آخر زوار الملف الشخصي
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  {profile.visitsCount} إجمالي الزيارات
                </span>
              </div>

              {visits.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  لا توجد زيارات مسجلة مؤخرًا.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/8">
                  {visits.slice(0, 12).map((v) => {
                    const visitorUser = usersById[v.visitorUid];
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => openProfileModal(v.visitorUid)}
                        className="w-full py-2 px-1 flex items-center justify-between gap-2 text-right hover:bg-slate-50 dark:hover:bg-[#18242B]/70 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar
                            src={visitorUser?.avatar || v.visitorAvatar}
                            name={visitorUser?.displayName || v.visitorName}
                            size="sm"
                            gender={visitorUser?.gender}
                            frameId={visitorUser?.frameId}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {visitorUser?.displayName || v.visitorName || 'عضو فضفضة'}
                            </p>
                            {visitorUser && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {displayCountryName(visitorUser.country, visitorUser.countryFlag)}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                          {formatRelativeLastSeen(timestampToMillis(v.visitedAt), false).replace('آخر ظهور ', '')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <form
            onSubmit={handleSaveProfile}
            className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-3.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">الاسم الظاهر</label>
                <input
                  type="text"
                  maxLength={SCHEMA_LIMITS.DISPLAY_NAME_MAX_LENGTH}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">اسم المستخدم (إنجليزي)</label>
                <input
                  type="text"
                  dir="ltr"
                  maxLength={SCHEMA_LIMITS.USERNAME_MAX_LENGTH}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm font-mono text-left focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">النوع</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as GenderType)}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
                >
                  <option value="unspecified">غير محدد</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">العمر</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">الدولة</label>
                <select
                  value={country}
                  onChange={(e) => {
                    const found = COUNTRIES.find((c) => c.name === e.target.value);
                    setCountry(e.target.value);
                    setCountryFlag(found?.flag ?? '');
                  }}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
                >
                  <option value="">دولة غير محددة</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">الحالة الاجتماعية</label>
                <select
                  value={maritalStatus}
                  onChange={(e) => setMaritalStatus(e.target.value as MaritalStatusType)}
                  disabled={profile.maritalStatus === 'married'}
                  className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm disabled:opacity-60"
                >
                  <option value="single">أعزب</option>
                  <option value="engaged">مخطوب</option>
                  <option value="married">متزوج</option>
                  <option value="complicated">علاقة معقدة</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">الانتماء / الاهتمام الرئيسي</label>
              <input
                type="text"
                maxLength={60}
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                placeholder="مثال: محب للقراءة، هادئ، موسيقى..."
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">النبذة التعريفية</label>
              <textarea
                rows={3}
                maxLength={SCHEMA_LIMITS.BIO_MAX_LENGTH}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
              />
            </div>

            <button
              type="submit"
              disabled={saving || uploading}
              className="min-h-[40px] px-5 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </form>
        )}

        {tab === 'privacy' && (
          <form
            onSubmit={handleSavePrivacy}
            className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-3.5 text-sm"
          >
            <div>
              <label className="block text-xs font-semibold mb-1">من يمكنه مراسلتي؟</label>
              <select
                value={messagePermission}
                onChange={(e) => setMessagePermission(e.target.value as MessagePermission)}
                className="w-full min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm"
              >
                <option value="everyone">الجميع</option>
                <option value="friends">الأصدقاء فقط</option>
                <option value="nobody">لا أحد</option>
              </select>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-white/8">
              {[
                { label: 'إظهار حالة الاتصال في قائمة المتواجدين', value: showOnline, setter: setShowOnline },
                { label: 'تفعيل وضع الشبح (التصفح دون ظهور)', value: ghostMode, setter: setGhostMode },
                { label: 'إخفاء وقت آخر ظهور', value: hideLastSeen, setter: setHideLastSeen },
                { label: 'إظهار حسابي في البحث والدليل العام', value: isPublic, setter: setIsPublic },
                { label: 'تنبيهات الصوت للإشعارات', value: soundNotifications, setter: setSoundNotifications },
                { label: 'إظهار إشعارات منبثقة فورية', value: visualNotifications, setter: setVisualNotifications },
              ].map((row) => (
                <label key={row.label} className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
                  <span className="text-xs sm:text-sm text-slate-700 dark:text-slate-200">{row.label}</span>
                  <input
                    type="checkbox"
                    checked={row.value}
                    onChange={(e) => row.setter(e.target.checked)}
                    className="w-4 h-4 accent-[#0B7A62] cursor-pointer"
                  />
                </label>
              ))}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] px-5 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs sm:text-sm font-semibold cursor-pointer transition-colors"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ إعدادات الخصوصية'}
            </button>
          </form>
        )}

        {tab === 'security' && (
          <div className="p-4 sm:p-5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-3.5 text-xs">
            <div className="p-3.5 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 space-y-1">
              <p className="text-slate-500 dark:text-slate-400">معرّف الحساب</p>
              <p dir="ltr" className="font-mono font-semibold text-slate-900 dark:text-white select-all">
                {authUser.uid}
              </p>
              <p className="text-slate-500 dark:text-slate-400 pt-1">
                حالة التواجد والمزامنة اللحظية:{' '}
                <strong className="text-[#0B7A62] dark:text-[#34D399]">
                  {presenceState === 'connected'
                    ? 'متصل ونشط لحظيًا'
                    : presenceState === 'connecting'
                    ? 'جاري المزامنة...'
                    : 'غير متصل'}
                </strong>
              </p>
            </div>

            {authUser.isAnonymous && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setFeedback(null);
                  if (!upgradeEmail.trim() || upgradePassword.length < 8) {
                    setFeedback({
                      type: 'error',
                      text: 'أدخل بريدًا إلكترونيًا صحيحًا وكلمة مرور لا تقل عن 8 أحرف.',
                    });
                    return;
                  }
                  setSaving(true);
                  try {
                    await upgradeGuest(upgradeEmail, upgradePassword, upgradeName || displayName);
                    setUpgradeEmail('');
                    setUpgradePassword('');
                    setFeedback({
                      type: 'success',
                      text: 'تمت ترقية حساب الضيف إلى عضو دائم مع الاحتفاظ برصيدك ومحادثاتك.',
                    });
                  } catch (err) {
                    setFeedback({
                      type: 'error',
                      text: err instanceof Error ? err.message : 'تعذرت ترقية الحساب.',
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
                className="p-3.5 rounded-lg border border-[#0B7A62]/30 bg-[#E6F4F0]/60 dark:bg-[#14332C]/50 space-y-2.5"
              >
                <div>
                  <p className="font-bold text-sm text-[#0B7A62] dark:text-[#34D399]">
                    ترقية حساب الضيف إلى عضو دائم
                  </p>
                  <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    اربط حسابك ببريد وكلمة مرور للاحتفاظ بالعملات، النقاط، والمحادثات عبر جميع الأجهزة.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={upgradeName}
                    onChange={(e) => setUpgradeName(e.target.value)}
                    placeholder="الاسم الظاهر (اختياري)"
                    className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1114]"
                  />
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={upgradeEmail}
                    onChange={(e) => setUpgradeEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1114] text-left"
                  />
                  <input
                    type="password"
                    dir="ltr"
                    required
                    minLength={8}
                    value={upgradePassword}
                    onChange={(e) => setUpgradePassword(e.target.value)}
                    placeholder="كلمة مرور (8+ أحرف)"
                    className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1114] text-left"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-[38px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white font-semibold cursor-pointer transition-colors"
                >
                  {saving ? 'جاري الترقية...' : 'ترقية الحساب الآن'}
                </button>
              </form>
            )}

            {authUser.email && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-slate-200/80 dark:border-white/10">
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{authUser.email}</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    حالة التحقق:{' '}
                    {authUser.emailVerified ? 'بريد موثّق' : 'بانتظار توثيق البريد الإلكتروني'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!authUser.emailVerified && (
                    <button
                      type="button"
                      onClick={async () => {
                        setFeedback(null);
                        try {
                          await sendVerifyEmail();
                          setFeedback({ type: 'success', text: 'تم إرسال رابط التحقق إلى بريدك الإلكتروني.' });
                        } catch (err) {
                          setFeedback({
                            type: 'error',
                            text: err instanceof Error ? err.message : 'تعذر إرسال رابط التوثيق.',
                          });
                        }
                      }}
                      className="min-h-[36px] px-3 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MailCheck className="w-4 h-4" />
                      <span>إرسال رابط التوثيق</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!authUser.email) return;
                      setFeedback(null);
                      try {
                        await sendResetEmail(authUser.email);
                        setFeedback({ type: 'success', text: 'تم إرسال رابط تغيير كلمة المرور إلى بريدك.' });
                      } catch (err) {
                        setFeedback({
                          type: 'error',
                          text: err instanceof Error ? err.message : 'تعذر إرسال رابط إعادة التعيين.',
                        });
                      }
                    }}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] font-semibold cursor-pointer"
                  >
                    إعادة تعيين كلمة المرور
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
