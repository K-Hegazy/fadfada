import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { Mission } from '../types';
import { useAuth } from '../context/AuthContext';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Target,
  Coins,
  Sparkles,
  Check,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Crown
} from 'lucide-react';

export const MissionsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [claimLoading, setClaimLoading] = useState<string | null>(null);

  // Owner Management Modal States
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'daily' | 'weekly' | 'milestone'>('daily');
  const [actionType, setActionType] = useState('message');
  const [targetCount, setTargetCount] = useState<number>(5);
  const [xpReward, setXpReward] = useState<number>(30);
  const [coinsReward, setCoinsReward] = useState<number>(20);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [toastMsg, setToastMsg] = useState<string>('');

  const isOwner = user?.role === 'owner' || user?.username?.toLowerCase() === 'hegazy';

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const fetchMissions = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ missions: Mission[] }>('/missions');
      setMissions(res.missions);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  const handleClaim = async (missionId: string) => {
    setClaimLoading(missionId);
    try {
      const res = await apiRequest(`/missions/${missionId}/claim`, { method: 'POST' });
      showToast(res.message);
      await refreshUser();
      await fetchMissions();
    } catch (err: any) {
      showToast(err.message || 'فشل استلام المكافأة');
    } finally {
      setClaimLoading(null);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingMission(null);
    setTitle('');
    setDescription('');
    setCategory('daily');
    setActionType('message');
    setTargetCount(5);
    setXpReward(30);
    setCoinsReward(20);
    setIsActive(true);
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (m: Mission) => {
    setEditingMission(m);
    setTitle(m.title);
    setDescription(m.description);
    setCategory((m.category as any) || 'daily');
    setActionType((m as any).action_type || (m as any).actionType || 'message');
    setTargetCount(m.targetCount);
    setXpReward(m.xpReward);
    setCoinsReward(m.coinsReward);
    setIsActive((m as any).is_active !== 0);
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSaveMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg('العنوان والوصف مطلوبان');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        actionType,
        targetCount: Number(targetCount) || 1,
        xpReward: Number(xpReward) || 10,
        coinsReward: Number(coinsReward) || 5,
        isActive
      };

      if (editingMission) {
        const res = await apiRequest(`/admin/missions/${editingMission.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(res.message || 'تم تحديث المهمة بنجاح');
      } else {
        const res = await apiRequest('/admin/missions', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(res.message || 'تم إنشاء المهمة بنجاح');
      }

      setModalOpen(false);
      await fetchMissions();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل حفظ المهمة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMission = async (missionId: string, missionTitle: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف المهمة: "${missionTitle}"؟`)) {
      return;
    }

    try {
      const res = await apiRequest(`/admin/missions/${missionId}`, {
        method: 'DELETE'
      });
      showToast(res.message || 'تم حذف المهمة');
      await fetchMissions();
    } catch (err: any) {
      showToast(err.message || 'فشل حذف المهمة');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in" dir="rtl">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 z-50 max-w-md bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold font-tajawal">{toastMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-amber-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white">المهام اليومية والمكافآت</h1>
            {isOwner && <OwnerBadge size="xs" />}
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            أكمل المهام الاجتماعية اليومية لتحصل على كوينز إضافية ونقاط خبرة لترقية مستواك.
          </p>
        </div>

        {/* Owner Add Mission Button */}
        {isOwner && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-cairo font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>إضافة مهمة جديدة</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-32 rounded-2xl sm:rounded-3xl bg-neutral-900/40 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {missions.map(m => {
            const pct = Math.min(100, Math.round((m.currentCount / m.targetCount) * 100));

            return (
              <div
                key={m.id}
                className="p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-[#0e1017] border border-neutral-800/80 space-y-3.5 sm:space-y-4 shadow-lg flex flex-col justify-between relative group"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-cairo font-bold text-base text-white">{m.title}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 font-tajawal">
                          {m.category === 'daily' ? 'يومية' : m.category === 'weekly' ? 'أسبوعية' : 'إنجاز'}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 font-tajawal mt-1">{m.description}</p>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold shrink-0">
                      <span className="flex items-center gap-1 text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-800/50">
                        +{m.coinsReward} <Coins className="w-3 h-3" />
                      </span>
                      <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-800/50">
                        +{m.xpReward} XP
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1 pt-2">
                    <div className="flex justify-between text-[11px] text-neutral-400 font-tajawal">
                      <span>التقدم:</span>
                      <span>{m.currentCount} / {m.targetCount}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer Controls: Claim Button & Owner Action Buttons */}
                <div className="pt-2 border-t border-neutral-900 flex items-center justify-between gap-2">
                  {/* Owner Controls */}
                  {isOwner ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditModal(m)}
                        className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="تعديل المهمة"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                        <span>تعديل</span>
                      </button>
                      <button
                        onClick={() => handleDeleteMission(m.id, m.title)}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/50 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="حذف المهمة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  ) : <div />}

                  {/* Claim Button */}
                  <div>
                    {m.isClaimed ? (
                      <div className="flex items-center gap-1 text-xs text-emerald-400 font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم استلام المكافأة</span>
                      </div>
                    ) : (
                      <button
                        disabled={!m.isCompleted || claimLoading === m.id}
                        onClick={() => handleClaim(m.id)}
                        className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        {claimLoading === m.id ? 'جاري الاستلام...' : m.isCompleted ? 'استلام المكافأة 🎉' : 'غير مكتملة بعد'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MISSION MODAL (Owner Only) */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#0d0f17] border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="font-cairo font-bold text-base text-white">
                  {editingMission ? 'تعديل المهمة اليومية' : 'إضافة مهمة يومية جديدة'}
                </h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-tajawal">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveMission} className="space-y-3.5 text-xs font-tajawal">
              <div>
                <label className="block text-neutral-300 font-bold mb-1">عنوان المهمة *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: رسائل الود والتحية"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">الوصف والإرشادات *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="مثال: أرسل 5 رسائل في المحادثات وتعرف على أصدقاء جدد..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">التصنيف</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="daily">مهمة يومية (Daily)</option>
                    <option value="weekly">مهمة أسبوعية (Weekly)</option>
                    <option value="milestone">مرحلة / إنجاز (Milestone)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">نوع النشاط (Action Type)</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="message">إرسال رسائل خاصة (message)</option>
                    <option value="room_chat">حوار في الغرف (room_chat)</option>
                    <option value="gift">إرسال هدية (gift)</option>
                    <option value="story">نشر قصة (story)</option>
                    <option value="game">لعب مسابقة أو لعبة (game)</option>
                    <option value="daily_login">تسجيل دخول يومي (daily_login)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-300 font-bold mb-1">العدد المطلوب</label>
                  <input
                    type="number"
                    min="1"
                    value={targetCount}
                    onChange={(e) => setTargetCount(parseInt(e.target.value) || 1)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">مكافأة الكوينز</label>
                  <input
                    type="number"
                    min="0"
                    value={coinsReward}
                    onChange={(e) => setCoinsReward(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-bold mb-1">نقاط الخبرة (XP)</label>
                  <input
                    type="number"
                    min="0"
                    value={xpReward}
                    onChange={(e) => setXpReward(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 focus:ring-offset-0 bg-neutral-900 border-neutral-700"
                />
                <label htmlFor="activeCheck" className="text-neutral-300 font-semibold cursor-pointer select-none">
                  تفعيل المهمة وظهورها للمستخدمين
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-cairo font-bold transition-all shadow-md cursor-pointer"
                >
                  {submitting ? 'جاري الحفظ...' : editingMission ? 'حفظ التعديلات' : 'إضافة المهمة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
