import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Trophy, Flame, Crown, Sparkles, Star } from 'lucide-react';
import { OwnerBadge, isUserOwner } from './OwnerBadge';

interface LevelsPageProps {
  onOpenProfile: (userId: string) => void;
}

export const LevelsPage: React.FC<LevelsPageProps> = ({ onOpenProfile }) => {
  const { user } = useAuth();
  const [xpLeaders, setXpLeaders] = useState<any[]>([]);
  const [streakLeaders, setStreakLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tab, setTab] = useState<'xp' | 'streak'>('xp');

  useEffect(() => {
    apiRequest<{ xpLeaders: any[]; streakLeaders: any[] }>('/leaderboards')
      .then(res => {
        setXpLeaders(res.xpLeaders);
        setStreakLeaders(res.streakLeaders);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-emerald-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white">المستويات ولوحة الشرف</h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            مستواك الحالي: <strong>المستوى {user?.level}</strong> ({user?.xp} XP) · شعلة الدخول: {user?.streak} يوم 🔥
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-xl sm:rounded-2xl overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setTab('xp')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
              tab === 'xp' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400'
            }`}
          >
            المتصدرون بالخبرة (XP)
          </button>
          <button
            onClick={() => setTab('streak')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
              tab === 'streak' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-400'
            }`}
          >
            المتصدرون بالشعلة 🔥
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="rounded-2xl sm:rounded-3xl bg-[#0e1017] border border-neutral-800 overflow-hidden shadow-xl">
        <div className="p-3.5 sm:p-4 border-b border-neutral-800/80 font-cairo font-bold text-xs sm:text-sm text-neutral-300">
          قائمة أفضل 20 عضواً في منصة فضفضه
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-neutral-500 font-tajawal">جاري تحميل لوحة المتصدرين...</div>
        ) : (
          <div className="divide-y divide-neutral-900">
            {(tab === 'xp' ? xpLeaders : streakLeaders).map((lead, idx) => {
              const isFemale = lead.gender === 'female';
              const rank = idx + 1;

              return (
                <div
                  key={lead.id}
                  onClick={() => onOpenProfile(lead.id)}
                  className="p-3 sm:p-4 flex items-center justify-between hover:bg-neutral-900/50 transition-colors cursor-pointer gap-2"
                >
                  <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                    {/* Rank Badge */}
                    <div className="w-6 sm:w-8 text-center font-cairo font-black text-base sm:text-lg shrink-0">
                      {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : <span className="text-neutral-500 text-xs sm:text-sm">{rank}</span>}
                    </div>

                    {/* Avatar */}
                    <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center font-cairo font-bold text-xs sm:text-sm border shrink-0 ${
                      isFemale ? 'bg-rose-950 text-rose-200 border-rose-800' : 'bg-sky-950 text-sky-200 border-sky-800'
                    }`}>
                      {lead.username.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <div className="font-cairo font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 sm:gap-2 truncate">
                        <span className="truncate">{lead.username}</span>
                        {isUserOwner(lead) && <OwnerBadge size="xs" />}
                        {lead.vip_level && lead.vip_level !== 'none' && (
                          <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-neutral-400 font-tajawal truncate">📍 {lead.country}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {tab === 'xp' ? (
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-emerald-400 font-cairo">{lead.xp} XP</div>
                        <div className="text-[9px] sm:text-[10px] text-neutral-500">مستوى {lead.level}</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs sm:text-sm font-bold text-amber-400 font-cairo">
                        <span>{lead.streak} يوم</span>
                        <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
