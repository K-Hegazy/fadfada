import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { Achievement } from '../types';
import { Award, Lock, Sparkles, CheckCircle } from 'lucide-react';

export const AchievementsPage: React.FC = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    apiRequest<{ achievements: Achievement[] }>('/achievements')
      .then(res => setAchievements(res.achievements))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-yellow-950/40 border border-neutral-800 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white">لوحة الإنجازات والأوسمة</h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            أوسمة الشرف التي تثبت بصمتك وتفاعلك الراقي في منصة فضفضه.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="h-28 rounded-2xl sm:rounded-3xl bg-neutral-900/40 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {achievements.map(ach => (
            <div
              key={ach.id}
              className={`p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border transition-all flex items-center gap-3 sm:gap-4 ${
                ach.isUnlocked
                  ? 'bg-[#0f120e] border-emerald-800/60 shadow-lg shadow-emerald-950/20'
                  : 'bg-[#0e1017]/60 border-neutral-800/60 opacity-60'
              }`}
            >
              <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shrink-0 border ${
                ach.isUnlocked
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : 'bg-neutral-900 border-neutral-800 grayscale'
              }`}>
                {ach.icon}
              </div>

              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-cairo font-bold text-sm text-white truncate">{ach.title}</h3>
                  {ach.isUnlocked && (
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-neutral-400 font-tajawal">{ach.description}</p>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-500 pt-1">
                  <span className="text-amber-400">+{ach.coins_reward} كوينز</span>
                  <span>·</span>
                  <span className="text-emerald-400">+{ach.xp_reward} XP</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
