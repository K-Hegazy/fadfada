import React, { useMemo, useState } from 'react';
import { Award, Coins, Crown, Eye, Gift, TrendingUp, Trophy, Users } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { displayCountryName } from '../utils/progression';
import { Avatar } from './Avatar';
import { EmptyState, PageHeader, SegmentedTabs } from './ui/Primitives';

type LeaderboardTab = 'xp' | 'level' | 'coins' | 'supporters' | 'visits' | 'friends';

export const LeaderboardView: React.FC = () => {
  const { users, isPeerOnline, openProfileModal } = useApp();
  const [tab, setTab] = useState<LeaderboardTab>('xp');

  const ranked = useMemo(() => {
    const list = users.filter((u) => u.role !== 'guest' && !u.isAnonymous);
    list.sort((a, b) => {
      switch (tab) {
        case 'level':
          return b.level - a.level || b.xp - a.xp;
        case 'coins':
          return b.coins - a.coins;
        case 'supporters':
          return b.giftsSentCount - a.giftsSentCount;
        case 'visits':
          return b.visitsCount - a.visitsCount;
        case 'friends':
          return b.friendsCount - a.friendsCount;
        case 'xp':
        default:
          return b.xp - a.xp;
      }
    });
    return list.slice(0, 30);
  }, [users, tab]);

  const tabs: Array<{ id: LeaderboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'xp', label: 'الأكثر نشاطًا', icon: TrendingUp },
    { id: 'level', label: 'أعلى مستوى', icon: Award },
    { id: 'coins', label: 'الأغنى بالعملات', icon: Coins },
    { id: 'supporters', label: 'الداعمون', icon: Gift },
    { id: 'visits', label: 'زيارات الملف', icon: Eye },
    { id: 'friends', label: 'الأصدقاء', icon: Users },
  ];

  const metricValue = (u: (typeof users)[number]) => {
    switch (tab) {
      case 'level':
        return `المستوى ${u.level}`;
      case 'coins':
        return `${u.coins} عملة`;
      case 'supporters':
        return `${u.giftsSentCount} هدية`;
      case 'visits':
        return `${u.visitsCount} زيارة`;
      case 'friends':
        return `${u.friendsCount} صديق`;
      case 'xp':
      default:
        return `${u.xp} XP`;
    }
  };

  const topThree = ranked.slice(0, 3);
  const restRanked = ranked.slice(3);

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-4xl mx-auto space-y-3.5">
        <PageHeader
          title="لوحة الشرف والتصنيفات"
          subtitle="أبرز أعضاء فضفضة حسب النشاط والمستوى والدعم وتفاعل المجتمع"
          icon={<Trophy className="w-4 h-4" />}
        />

        <SegmentedTabs<LeaderboardTab>
          items={tabs}
          value={tab}
          onChange={setTab}
        />

        {ranked.length === 0 ? (
          <EmptyState
            icon={<Trophy className="w-5 h-5" />}
            title="لا توجد تصنيفات بعد"
            description="بمجرد تفاعل الأعضاء في الغرف والحائط ستظهر قائمة الشرف هنا."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {topThree.map((u, idx) => {
                const isFirst = idx === 0;
                const badgeColors =
                  idx === 0
                    ? 'border-amber-400/70 bg-amber-50/40 dark:bg-amber-950/20'
                    : idx === 1
                    ? 'border-slate-300 dark:border-slate-600'
                    : 'border-orange-300/80 dark:border-orange-700/60';
                return (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => openProfileModal(u.uid)}
                    className={`p-3.5 rounded-xl bg-white dark:bg-[#121B20] border ${badgeColors} flex flex-col items-center text-center gap-2 hover:border-[#0B7A62] transition-colors cursor-pointer`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
                      {isFirst && <Crown className="w-4 h-4 text-amber-500" />}
                      <span
                        className={
                          idx === 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : idx === 1
                            ? 'text-slate-600 dark:text-slate-300'
                            : 'text-orange-600 dark:text-orange-400'
                        }
                      >
                        المركز #{idx + 1}
                      </span>
                    </div>

                    <Avatar
                      src={u.avatar}
                      name={u.displayName}
                      size="lg"
                      frameId={u.frameId}
                      isOnline={isPeerOnline(u)}
                      showPresence
                    />

                    <div className="min-w-0 w-full">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-50 truncate">
                        {u.displayName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {displayCountryName(u.country, u.countryFlag)} · Lv.{u.level}
                      </p>
                    </div>

                    <span className="font-mono tabular-nums text-xs font-bold text-[#0B7A62] dark:text-[#34D399]">
                      {metricValue(u)}
                    </span>
                  </button>
                );
              })}
            </div>

            {restRanked.length > 0 && (
              <div className="rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 divide-y divide-slate-200/70 dark:divide-white/8 overflow-hidden">
                {restRanked.map((u, idx) => (
                  <button
                    key={u.uid}
                    type="button"
                    onClick={() => openProfileModal(u.uid)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 text-right hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-6 text-center text-xs font-mono tabular-nums font-bold text-slate-400 dark:text-slate-500 shrink-0">
                        {idx + 4}
                      </span>
                      <Avatar
                        src={u.avatar}
                        name={u.displayName}
                        size="sm"
                        frameId={u.frameId}
                        isOnline={isPeerOnline(u)}
                        showPresence
                      />
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {u.displayName}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {displayCountryName(u.country, u.countryFlag)} · المستوى {u.level}
                        </p>
                      </div>
                    </div>

                    <span className="font-mono tabular-nums text-xs font-bold text-[#0B7A62] dark:text-[#34D399] shrink-0">
                      {metricValue(u)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
