import type { DailyTask, GenderType, SiteSettings, StoreItem, UserProfile, VipTier } from '../types/fadfada';

export const COUNTRIES = [
  { code: 'EG', name: 'مصر', flag: '🇪🇬' },
  { code: 'SA', name: 'السعودية', flag: '🇸🇦' },
  { code: 'AE', name: 'الإمارات', flag: '🇦🇪' },
  { code: 'JO', name: 'الأردن', flag: '🇯🇴' },
  { code: 'MA', name: 'المغرب', flag: '🇲🇦' },
  { code: 'TN', name: 'تونس', flag: '🇹🇳' },
  { code: 'DZ', name: 'الجزائر', flag: '🇩🇿' },
  { code: 'IQ', name: 'العراق', flag: '🇮🇶' },
  { code: 'KW', name: 'الكويت', flag: '🇰🇼' },
  { code: 'QA', name: 'قطر', flag: '🇶🇦' },
  { code: 'LB', name: 'لبنان', flag: '🇱🇧' },
  { code: 'PS', name: 'فلسطين', flag: '🇵🇸' },
  { code: 'SY', name: 'سوريا', flag: '🇸🇾' },
  { code: 'YE', name: 'اليمن', flag: '🇾🇪' },
  { code: 'SD', name: 'السودان', flag: '🇸🇩' },
  { code: '', name: 'أخرى', flag: '🌍' },
] as const;

export function findCountryByNameOrCode(country?: string, countryCode?: string) {
  const cleanCode = String(countryCode || '').trim().toUpperCase();
  if (cleanCode) {
    const byCode = COUNTRIES.find((c) => c.code === cleanCode);
    if (byCode) return byCode;
  }
  const cleanName = String(country || '').trim();
  if (cleanName) {
    const byName = COUNTRIES.find((c) => c.name === cleanName);
    if (byName) return byName;
  }
  return undefined;
}

export const CHAT_THEMES: Record<string, { label: string; bg: string; accent: string }> = {
  emerald: { label: 'زمردي هادئ', bg: 'bg-[#F7F7F5] dark:bg-[#0D1110]', accent: 'bg-[#0D7A5F]' },
  midnight: { label: 'ليل عميق', bg: 'bg-slate-950 text-slate-100', accent: 'bg-sky-600' },
  sand: { label: 'رملي دافئ', bg: 'bg-amber-50/70 dark:bg-stone-900', accent: 'bg-amber-700' },
  rose: { label: 'ورد خافت', bg: 'bg-rose-50/60 dark:bg-rose-950/30', accent: 'bg-rose-600' },
  ocean: { label: 'بحري صافي', bg: 'bg-cyan-50/60 dark:bg-cyan-950/30', accent: 'bg-teal-700' },
  slate: { label: 'حجري أنيق', bg: 'bg-stone-100 dark:bg-neutral-950', accent: 'bg-stone-800' },
};

export const AVATAR_FRAMES: Record<string, { label: string; ringClass: string }> = {
  none: { label: 'بدون إطار', ringClass: 'ring-0' },
  emerald_glow: { label: 'إطار الزمرد', ringClass: 'ring-2 ring-[#0D7A5F] ring-offset-2 dark:ring-offset-[#141A18]' },
  gold_crown: { label: 'إطار الذهب الملكي', ringClass: 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-[#141A18]' },
  royal_sapphire: { label: 'إطار الياقوت', ringClass: 'ring-2 ring-sky-500 ring-offset-2 dark:ring-offset-[#141A18]' },
  rose_aurora: { label: 'إطار الشفق الوردي', ringClass: 'ring-2 ring-rose-500 ring-offset-2 dark:ring-offset-[#141A18]' },
};

export const VIP_LABELS: Record<VipTier, { label: string; badgeClass: string }> = {
  none: { label: 'عادي', badgeClass: '' },
  silver: { label: 'VIP فضي', badgeClass: 'text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600' },
  gold: { label: 'VIP ذهبي', badgeClass: 'text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-600' },
  royal: { label: 'VIP ملكي', badgeClass: 'text-emerald-800 dark:text-emerald-300 border-emerald-500 dark:border-emerald-500' },
};

export function calculateLevelFromXp(xp: number): number {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
  return Math.min(100, Math.max(1, level));
}

export function xpRequiredForLevel(level: number): number {
  const clamped = Math.max(1, Math.min(100, level));
  return Math.pow(clamped - 1, 2) * 40;
}

export function getLevelProgress(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  percent: number;
  rankTitle: string;
} {
  const level = calculateLevelFromXp(xp);
  const currentLevelXp = xpRequiredForLevel(level);
  const nextLevelXp = level >= 100 ? xpRequiredForLevel(100) : xpRequiredForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const percent = level >= 100 ? 100 : Math.min(100, Math.round(((xp - currentLevelXp) / span) * 100));

  let rankTitle = 'عضو جديد';
  if (level >= 80) rankTitle = 'أسطورة فضفضة';
  else if (level >= 50) rankTitle = 'نجم المجتمع';
  else if (level >= 25) rankTitle = 'محاور متميز';
  else if (level >= 10) rankTitle = 'صديق نشيط';
  else if (level >= 3) rankTitle = 'مشارك متفاعل';

  return { level, currentLevelXp, nextLevelXp, percent, rankTitle };
}

export function getEffectiveVipTier(vipTier: VipTier, vipExpiresAt: number | null): VipTier {
  if (vipTier === 'none') return 'none';
  if (vipExpiresAt !== null && vipExpiresAt > 0 && vipExpiresAt <= Date.now()) {
    return 'none';
  }
  return vipTier;
}

export function getActiveBadges<T extends { expiresAt: number | null }>(badges: T[]): T[] {
  const now = Date.now();
  return badges.filter((b) => b.expiresAt === null || b.expiresAt === 0 || b.expiresAt > now);
}

export const DEFAULT_SITE_SETTINGS: Omit<SiteSettings, 'updatedAt'> = {
  id: 'global',
  guestDailyMessageLimit: 25,
  roomCreationCost: 150,
  randomMatchFreeDaily: 3,
  randomMatchCost: 30,
  randomMatchDurationSec: 300,
  shoutoutCost: 80,
  marriageSiteFeePercent: 20,
  welcomePopupEnabled: false,
  welcomePopupTitle: 'مرحباً بك في فضفضة',
  welcomePopupBody: 'تواصل بأمان واحترام مع أعضاء المجتمع في الغرف والمحادثات الخاصة.',
  paymentMethods: [
    {
      id: 'instapay',
      name: 'InstaPay (إنستاباي)',
      accountInfo: 'fadfada@instapay',
      rateCoinsPerUnit: 10,
      currency: 'ج.م',
      enabled: true,
    },
    {
      id: 'vodafone_cash',
      name: 'Vodafone Cash (فودافون كاش)',
      accountInfo: '01000000000',
      rateCoinsPerUnit: 10,
      currency: 'ج.م',
      enabled: true,
    },
  ],
  ads: {
    header_banner: { enabled: false, title: '', body: '', ctaText: '', targetUrl: '' },
    sidebar_card: { enabled: false, title: '', body: '', ctaText: '', targetUrl: '' },
    feed_inline: { enabled: false, title: '', body: '', ctaText: '', targetUrl: '' },
  },
  siteLogoUrl: '',
};

export const DEFAULT_STORE_ITEMS: StoreItem[] = [
  { id: 'vip_silver', section: 'vip', name: 'عضوية VIP فضية', description: 'شارة فضية وتمييز في الغرف والبحث لمدة 30 يومًا', priceCoins: 300, durationDays: 30, code: 'silver', color: '#64748B', imageUrl: '', isActive: true },
  { id: 'vip_gold', section: 'vip', name: 'عضوية VIP ذهبية', description: 'شارة ذهبية وأولوية في المطابقة والظهور لمدة 30 يومًا', priceCoins: 650, durationDays: 30, code: 'gold', color: '#D97706', imageUrl: '', isActive: true },
  { id: 'vip_royal', section: 'vip', name: 'عضوية VIP ملكية', description: 'الباقة الملكية الكاملة مع كل مزايا التمييز لمدة 30 يومًا', priceCoins: 1200, durationDays: 30, code: 'royal', color: '#0D7A5F', imageUrl: '', isActive: true },
  { id: 'feat_ghost', section: 'feature', name: 'وضع الشبح (Ghost Mode)', description: 'تصفح وزُر الملفات بدون الظهور في المتواجدين الآن', priceCoins: 200, durationDays: 30, code: 'ghostMode', color: '#475569', imageUrl: '', isActive: true },
  { id: 'feat_pin', section: 'feature', name: 'تثبيت الاسم (Pin Name)', description: 'ثبّت اسمك في أعلى قائمة المتصلين', priceCoins: 250, durationDays: 30, code: 'pinName', color: '#0D7A5F', imageUrl: '', isActive: true },
  { id: 'feat_color', section: 'feature', name: 'تلوين الاسم', description: 'اختر لونًا مميزًا لاسمك في جميع الأقسام', priceCoins: 120, durationDays: 30, code: 'nameColor', color: '#0369A1', imageUrl: '', isActive: true },
  { id: 'feat_hidelast', section: 'feature', name: 'إخفاء آخر ظهور', description: 'إخفاء وقت آخر ظهور عن الآخرين', priceCoins: 150, durationDays: 30, code: 'hideLastSeen', color: '#334155', imageUrl: '', isActive: true },
  { id: 'feat_themes', section: 'feature', name: 'ثيمات المحادثة', description: 'افتح جميع ثيمات الدردشة الخاصة المخصصة', priceCoins: 100, durationDays: 365, code: 'chatThemes', color: '#B45309', imageUrl: '', isActive: true },
  { id: 'frame_emerald', section: 'frame', name: 'إطار الزمرد', description: 'إطار متوهج هادئ حول صورتك الشخصية', priceCoins: 140, durationDays: 90, code: 'emerald_glow', color: '#0D7A5F', imageUrl: '', isActive: true },
  { id: 'frame_gold', section: 'frame', name: 'إطار الذهب الملكي', description: 'إطار ذهبي أنيق حول صورتك', priceCoins: 240, durationDays: 90, code: 'gold_crown', color: '#D97706', imageUrl: '', isActive: true },
  { id: 'frame_sapphire', section: 'frame', name: 'إطار الياقوت', description: 'إطار أزرق ياقوتي للصورة', priceCoins: 220, durationDays: 90, code: 'royal_sapphire', color: '#0284C7', imageUrl: '', isActive: true },
  { id: 'badge_supporter', section: 'badge', name: 'شارة داعم فضفضة', description: 'شارة دائمة تظهر في ملفك الشخصي', priceCoins: 350, durationDays: 365, code: 'supporter', color: '#0D7A5F', imageUrl: '', isActive: true },
  { id: 'badge_star', section: 'badge', name: 'شارة نجم الحوار', description: 'شارة تميز للمتحاورين الدائمين', priceCoins: 280, durationDays: 180, code: 'dialogue_star', color: '#B45309', imageUrl: '', isActive: true },
  { id: 'gift_coffee', section: 'gift', name: 'فنجان قهوة', description: 'هدية دافئة لصديقك في المحادثة أو الملف', priceCoins: 25, durationDays: 0, code: 'coffee', color: '#92400E', imageUrl: '', isActive: true },
  { id: 'gift_rose', section: 'gift', name: 'باقة ورد', description: 'تعبير أنيق عن التقدير والمودة', priceCoins: 60, durationDays: 0, code: 'rose', color: '#BE123C', imageUrl: '', isActive: true },
  { id: 'gift_crown', section: 'gift', name: 'تاج الفخامة', description: 'أرقى هدية داخل منصة فضفضة', priceCoins: 250, durationDays: 0, code: 'crown', color: '#D97706', imageUrl: '', isActive: true },
];

export const DEFAULT_DAILY_TASKS: DailyTask[] = [
  { id: 'task_checkin', key: 'checkin', title: 'تسجيل الحضور اليومي', description: 'سجّل دخولك اليومي للحصول على مكافأة فورية', rewardCoins: 35, rewardXp: 40, isActive: true },
  { id: 'task_engage', key: 'engage', title: 'التفاعل برسالة أو مشاركة', description: 'أرسل رسالة في الخاص أو الغرف أو شارك بتعليق اليوم', rewardCoins: 45, rewardXp: 60, isActive: true },
  { id: 'task_send_image', key: 'send_image', title: 'مشاركة صورة أو وسائط', description: 'أرسل صورة أو فيديو اليوم في الخاص أو الغرف', rewardCoins: 40, rewardXp: 45, isActive: true },
  { id: 'task_join_room', key: 'join_room', title: 'الانضمام إلى غرفة', description: 'انضم إلى إحدى غرف الدردشة النشطة', rewardCoins: 35, rewardXp: 40, isActive: true },
  { id: 'task_use_microphone', key: 'use_microphone', title: 'استخدام الميكروفون العام', description: 'انشر نداءً في الميكروفون العلوي اليوم', rewardCoins: 50, rewardXp: 60, isActive: true },
  { id: 'task_share', key: 'share', title: 'مشاركة فضفضة', description: 'شارك رابط دعوتك الفعلي مع أصدقائك', rewardCoins: 40, rewardXp: 50, isActive: true },
  { id: 'task_ad', key: 'ad_watch', title: 'مشاهدة رسالة الراعي', description: 'شاهد البطاقة الإعلانية اليومية بالكامل واحصل على مكافأة', rewardCoins: 30, rewardXp: 35, isActive: true },
  { id: 'task_referral', key: 'referral', title: 'مكافأة دعوة صديق', description: 'تفعيل كود إحالة صحيح من صديق مسجل', rewardCoins: 75, rewardXp: 80, isActive: true },
];

export const OFFICIAL_ROOMS_SEED = [
  { id: 'official_cafe', name: 'قهوة فضفضة', description: 'مجلس عام للحديث الودي وتبادل الأحاديث اليومية', category: 'عام', theme: 'emerald', pinnedMessage: 'أهلاً بكم في قهوة فضفضة — يرجى الالتزام بالاحترام المتبادل.' },
  { id: 'official_night', name: 'سهرة منتصف الليل', description: 'مساحة هادئة للفضفضة والأفكار المسائية', category: 'فضفضة', theme: 'midnight', pinnedMessage: 'شارك أفكارك بهدوء ولطف.' },
  { id: 'official_culture', name: 'ركن الكتب والثقافة', description: 'مناقشات الكتب والأفلام والاهتمامات الفكرية', category: 'ثقافة', theme: 'sand', pinnedMessage: 'ما الكتاب الذي تقرأه هذا الأسبوع؟' },
];

export function isKnownCountry(country?: string): boolean {
  const c = String(country || '').trim();
  return Boolean(c) && c !== 'أخرى' && c !== 'غير محدد' && c !== 'دولة غير محددة';
}

export function displayCountryName(country?: string, flag?: string): string {
  if (!isKnownCountry(country)) return 'دولة غير محددة';
  const clean = String(country).trim();
  const cleanFlag = String(flag || '').trim();
  return cleanFlag ? `${cleanFlag} ${clean}` : clean;
}

export function normalizeGender(rawGender?: string): GenderType {
  const val = String(rawGender || '').trim().toLowerCase();
  if (val === 'female' || val === 'أنثى' || val === 'f') return 'female';
  if (val === 'male' || val === 'ذكر' || val === 'm') return 'male';
  return 'unspecified';
}

export interface GenderStyle {
  gender: GenderType;
  label: 'أنثى' | 'ذكر' | 'غير محدد';
  symbol: '♀' | '♂' | '•';
  cardClass: string;
  rowHoverClass: string;
  headerGradientClass: string;
  avatarRingClass: string;
  badgeClass: string;
  dotClass: string;
  secondaryButtonClass: string;
}

export function getGenderStyle(rawGender?: string): GenderStyle {
  const gender = normalizeGender(rawGender);
  if (gender === 'female') {
    return {
      gender: 'female',
      label: 'أنثى',
      symbol: '♀',
      cardClass:
        'border border-rose-200/85 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-950/20',
      rowHoverClass: 'hover:bg-rose-100/65 dark:hover:bg-rose-950/35',
      headerGradientClass:
        'from-rose-200/75 via-rose-50 to-slate-100 dark:from-rose-950/60 dark:via-[#22161E] dark:to-[#0B1114]',
      avatarRingClass:
        'ring-2 ring-rose-400/90 dark:ring-rose-400/75 ring-offset-1 ring-offset-white dark:ring-offset-[#121B20]',
      badgeClass:
        'bg-rose-100/95 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/90 dark:border-rose-500/35',
      dotClass: 'bg-rose-500 dark:bg-rose-400',
      secondaryButtonClass:
        'border border-rose-200 dark:border-rose-500/35 bg-rose-50/75 dark:bg-rose-950/30 text-rose-700 dark:text-rose-200 hover:bg-rose-100/80 dark:hover:bg-rose-950/50',
    };
  }
  if (gender === 'male') {
    return {
      gender: 'male',
      label: 'ذكر',
      symbol: '♂',
      cardClass:
        'border border-sky-200/85 dark:border-sky-500/30 bg-sky-50/60 dark:bg-sky-950/20',
      rowHoverClass: 'hover:bg-sky-100/65 dark:hover:bg-sky-950/35',
      headerGradientClass:
        'from-sky-200/75 via-sky-50 to-slate-100 dark:from-sky-950/60 dark:via-[#121E29] dark:to-[#0B1114]',
      avatarRingClass:
        'ring-2 ring-sky-500/90 dark:ring-sky-400/75 ring-offset-1 ring-offset-white dark:ring-offset-[#121B20]',
      badgeClass:
        'bg-sky-100/95 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/90 dark:border-sky-500/35',
      dotClass: 'bg-sky-500 dark:bg-sky-400',
      secondaryButtonClass:
        'border border-sky-200 dark:border-sky-500/35 bg-sky-50/75 dark:bg-sky-950/30 text-sky-700 dark:text-sky-200 hover:bg-sky-100/80 dark:hover:bg-sky-950/50',
    };
  }
  return {
    gender: 'unspecified',
    label: 'غير محدد',
    symbol: '•',
    cardClass: 'border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121B20]',
    rowHoverClass: 'hover:bg-slate-50 dark:hover:bg-[#18242B]/70',
    headerGradientClass:
      'from-[#0B7A62]/25 via-[#E6F4F0] to-slate-200 dark:from-[#0B7A62]/30 dark:via-[#14332C] dark:to-[#0B1114]',
    avatarRingClass: 'ring-1 ring-slate-300/80 dark:ring-white/15',
    badgeClass:
      'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10',
    dotClass: 'bg-slate-400 dark:bg-slate-500',
    secondaryButtonClass:
      'border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-slate-700 dark:text-slate-200',
  };
}

function genderSortRank(gender?: string): number {
  const normalized = normalizeGender(gender);
  if (normalized === 'female') return 0;
  if (normalized === 'male') return 1;
  return 2;
}

export function sortOnlineUsers(
  users: UserProfile[],
  currentUser: UserProfile | null,
  isOnlineFn: (u: UserProfile) => boolean,
  getLastSeenFn: (u: UserProfile) => number
): UserProfile[] {
  const myCountry = isKnownCountry(currentUser?.country) ? String(currentUser?.country).trim() : '';
  const myCode = String(currentUser?.countryCode || '').trim().toUpperCase();

  const getCountryGroupRank = (u: UserProfile): number => {
    const known = isKnownCountry(u.country);
    const uCode = String(u.countryCode || '').trim().toUpperCase();
    if (!known && !uCode) return 2; // Unknown country ALWAYS at the very end
    if (myCode && uCode && uCode === myCode) return 0; // Same ISO country code first
    if (myCountry && String(u.country).trim() === myCountry) return 0; // Same country name first
    return 1; // Other known countries next
  };

  return [...users].sort((a, b) => {
    const groupDiff = getCountryGroupRank(a) - getCountryGroupRank(b);
    if (groupDiff !== 0) return groupDiff;

    const genderDiff = genderSortRank(a.gender) - genderSortRank(b.gender);
    if (genderDiff !== 0) return genderDiff;

    const onlineDiff = Number(isOnlineFn(b)) - Number(isOnlineFn(a));
    if (onlineDiff !== 0) return onlineDiff;

    const lastSeenDiff = getLastSeenFn(b) - getLastSeenFn(a);
    if (lastSeenDiff !== 0) return lastSeenDiff;

    return a.displayName.localeCompare(b.displayName, 'ar');
  });
}
