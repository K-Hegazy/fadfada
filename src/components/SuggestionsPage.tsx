import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { SiteSuggestion } from '../types';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Lightbulb,
  Plus,
  Send,
  Sparkles,
  CheckCircle2,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  MessageSquare,
  Award,
  Filter,
  User,
  Heart
} from 'lucide-react';

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  new: {
    label: 'جديد',
    color: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
    icon: Clock
  },
  under_review: {
    label: 'قيد المراجعة',
    color: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
    icon: RotateCcw
  },
  accepted: {
    label: 'مقبول وسيتم تنفيذه',
    color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    icon: CheckCircle
  },
  implemented: {
    label: 'تم التنفيذ بنجاح 🚀',
    color: 'bg-purple-950/80 text-purple-200 border-purple-700/60',
    icon: Sparkles
  },
  rejected: {
    label: 'مرفوض / غير متاح حالياً',
    color: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
    icon: XCircle
  }
};

export const SuggestionsPage: React.FC = () => {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<SiteSuggestion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<string>('all');

  // Submit modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [submitSuccess, setSubmitSuccess] = useState<string>('');

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ suggestions: SiteSuggestion[] }>('/suggestions');
      setSuggestions(res.suggestions || []);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleCreateSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setSubmitError('يرجى ملء عنوان ووصف الفكرة كاملاً');
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/suggestions', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim()
        })
      });

      setSubmitSuccess(res.message || 'تم إرسال فكرتك بنجاح للإدارة!');
      setTitle('');
      setDescription('');
      setTimeout(() => {
        setModalOpen(false);
        setSubmitSuccess('');
      }, 1500);
      fetchSuggestions();
    } catch (err: any) {
      setSubmitError(err.message || 'حدث خطأ أثناء إرسال الاقتراح');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredSuggestions = suggestions.filter(sug => {
    if (filter === 'all') return true;
    if (filter === 'my') return sug.user_id === user?.id;
    return sug.status === filter;
  });

  return (
    <div className="space-y-6 animate-in fade-in" dir="rtl">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-amber-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-cairo font-black text-white">
              اقتراحات الموقع وتطوير فضفضه
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            شارك أفكارك ومقترحاتك لتطوير المنصة. الأفكار المميزة والملهمة تحصل على وسام وشعار «المبدع» 💡 مهدى مباشرة من مالك فضفضه!
          </p>
        </div>

        <button
          onClick={() => {
            setSubmitError('');
            setSubmitSuccess('');
            setModalOpen(true);
          }}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-cairo font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>تقديم فكرة أو اقتراح جديد</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-tajawal">
        <button
          onClick={() => setFilter('all')}
          className={`px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
            filter === 'all'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          جميع المقترحات ({suggestions.length})
        </button>
        <button
          onClick={() => setFilter('my')}
          className={`px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
            filter === 'my'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          أفكاري الخاصة ({suggestions.filter(s => s.user_id === user?.id).length})
        </button>
        <button
          onClick={() => setFilter('implemented')}
          className={`px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
            filter === 'implemented'
              ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-bold'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          تم التنفيذ 🚀 ({suggestions.filter(s => s.status === 'implemented').length})
        </button>
        <button
          onClick={() => setFilter('accepted')}
          className={`px-3.5 py-1.5 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
            filter === 'accepted'
              ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-bold'
              : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
          }`}
        >
          مقبولة ({suggestions.filter(s => s.status === 'accepted').length})
        </button>
      </div>

      {/* Suggestions List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-28 rounded-3xl bg-neutral-900/40 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : filteredSuggestions.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-[#090b10] border border-neutral-800 space-y-3 max-w-md mx-auto">
          <Lightbulb className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="font-cairo font-bold text-white text-base">لا توجد اقتراحات مطابقة حالياً</h3>
          <p className="text-xs text-neutral-400 font-tajawal">
            كن أول من يشارك فكرة لتطوير فضفضه ونافس على نيل وسام «المبدع»!
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs cursor-pointer"
          >
            + شارك بفكرتك الآن
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSuggestions.map(sug => {
            const statusConfig = STATUS_LABELS[sug.status] || STATUS_LABELS.new;
            const StatusIcon = statusConfig.icon;
            const isMy = sug.user_id === user?.id;

            return (
              <div
                key={sug.id}
                className="p-5 rounded-3xl bg-[#0b0e15] border border-neutral-800/90 hover:border-neutral-700 transition-all space-y-3.5 shadow-md"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-neutral-850">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center font-cairo font-bold text-xs text-white">
                      {sug.author_username?.slice(0, 1).toUpperCase() || '👤'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-cairo font-bold text-sm text-white">
                          {sug.author_username || 'عضو في فضفضه'}
                        </span>
                        {isUserOwner({ role: sug.author_role, username: sug.author_username }) && (
                          <OwnerBadge size="xs" />
                        )}
                        {sug.has_creator_badge ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-[10px] font-bold">
                            <span>💡</span>
                            <span>المبدع</span>
                          </span>
                        ) : null}
                        {isMy && (
                          <span className="text-[10px] px-1.5 py-0.2 bg-teal-950 text-teal-300 rounded border border-teal-800">
                            فكرتك
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-500 font-tajawal">
                        {new Date(sug.created_at).toLocaleDateString('ar-EG', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 font-tajawal ${statusConfig.color}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      <span>{statusConfig.label}</span>
                    </span>
                  </div>
                </div>

                {/* Title & Description */}
                <div className="space-y-1.5">
                  <h3 className="font-cairo font-bold text-base text-white">{sug.title}</h3>
                  <p className="text-xs sm:text-sm text-neutral-300 font-tajawal leading-relaxed whitespace-pre-wrap">
                    {sug.description}
                  </p>
                </div>

                {/* Owner Reply if exists */}
                {sug.admin_reply && (
                  <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-800/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 font-cairo">
                      <OwnerBadge size="xs" />
                      <span>رد إدارة ومالك فضفضه:</span>
                    </div>
                    <p className="text-xs text-neutral-200 font-tajawal leading-relaxed pr-2 border-r-2 border-amber-500/60">
                      "{sug.admin_reply}"
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Suggestion Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in select-none">
          <div className="relative w-full max-w-lg bg-[#0e111a] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <h3 className="font-cairo font-black text-lg text-white">تقديم فكرة لتطوير فضفضه</h3>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-neutral-400 hover:text-white cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {submitError}
              </div>
            )}

            {submitSuccess && (
              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateSuggestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                  عنوان الفكرة أو المقترح
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="مثال: إضافة تحديات أسبوعية بين غرف الحوار"
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-amber-500 text-white text-sm outline-none font-tajawal"
                />
                <span className="text-[10px] text-neutral-500 font-mono mt-1 block">
                  {title.length}/120 حرف
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                  تفاصيل الفكرة وكيف تخدم مستخدمي فضفضه
                </label>
                <textarea
                  required
                  rows={4}
                  maxLength={3000}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="اشرح فكرتك بوضوح: ما هي المشكلة أو الإضافة، وكيف تقترح تطبيقها؟"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-amber-500 text-white text-sm outline-none font-tajawal resize-none leading-relaxed"
                />
                <span className="text-[10px] text-neutral-500 font-mono mt-1 block">
                  {description.length}/3000 حرف
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 font-tajawal flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                <span>تتم مراجعة كل فكرة من قبل مالك المنصة شخصياً، وتمنح الأفكار الفريدة وسام «المبدع» 💡!</span>
              </div>

              <button
                type="submit"
                disabled={submitting || !title.trim() || !description.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-cairo font-black text-sm shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? 'جاري الإرسال...' : 'إرسال الفكرة للإدارة'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
