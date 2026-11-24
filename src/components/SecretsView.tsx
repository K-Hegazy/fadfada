import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, HeartHandshake, MessageSquare, Send, ShieldCheck, Sparkles } from 'lucide-react';
import {
  addSecretComment,
  createSecret,
  reactEmpathyToSecret,
  subscribeToSecretComments,
  subscribeToSecrets,
} from '../services/community';
import { useApp } from '../state/AppContext';
import type { Secret, SimpleMessage } from '../types/fadfada';
import { formatArabicTime, timestampToMillis } from '../utils/formatters';
import { EmptyState, FeedbackBanner, PageHeader, SegmentedTabs } from './ui/Primitives';

const SECRET_CATEGORIES = ['الكل', 'فضفضة', 'مشاعر', 'عمل وحياة', 'عائلة', 'قصة طويلة'];

const SecretCommentsList: React.FC<{ secretId: string }> = ({ secretId }) => {
  const [comments, setComments] = useState<SimpleMessage[]>([]);
  const [text, setText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToSecretComments(secretId, setComments);
    return () => unsub();
  }, [secretId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setCommentError(null);
    try {
      await addSecretComment(secretId, text);
      setText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'تعذر إضافة التعليق.');
    }
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 dark:border-white/10 space-y-2">
      <div className="space-y-1.5 max-h-48 overflow-y-auto fadfada-scroll">
        {comments.map((c) => (
          <div key={c.id} className="p-2.5 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/60 dark:border-white/10 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-0.5">
              <span className="font-semibold text-slate-800 dark:text-slate-200">{c.senderName}</span>
              <span className="font-mono tabular-nums text-[10px]">{formatArabicTime(c.createdAt)}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{c.text}</p>
          </div>
        ))}
      </div>
      {commentError && <p className="text-xs text-rose-600">{commentError}</p>}
      <form onSubmit={handleSend} className="flex items-center gap-1.5">
        <input
          type="text"
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب مواساة أو رأيًا بهوية مجهولة..."
          className="flex-1 min-h-[36px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="min-h-[36px] px-3.5 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold cursor-pointer"
        >
          إرسال
        </button>
      </form>
    </div>
  );
};

export const SecretsView: React.FC = () => {
  const { profile } = useApp();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('الكل');
  const [sortBy, setSortBy] = useState<'latest' | 'empathy'>('latest');

  const [category, setCategory] = useState('فضفضة');
  const [isLongStory, setIsLongStory] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [revealedSecrets, setRevealedSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = subscribeToSecrets(setSecrets);
    return () => unsub();
  }, []);

  const visibleSecrets = useMemo(() => {
    return secrets
      .filter((s) => {
        if (categoryFilter === 'الكل') return true;
        if (categoryFilter === 'قصة طويلة') return s.isLongStory;
        return s.category === categoryFilter;
      })
      .sort((a, b) => {
        if (sortBy === 'empathy') {
          const scoreA = (a.empathyCounts?.feel ?? 0) + (a.empathyCounts?.pray ?? 0) + (a.empathyCounts?.strength ?? 0);
          const scoreB = (b.empathyCounts?.feel ?? 0) + (b.empathyCounts?.pray ?? 0) + (b.empathyCounts?.strength ?? 0);
          return scoreB - scoreA;
        }
        return timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt);
      });
  }, [secrets, categoryFilter, sortBy]);

  if (!profile) return null;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPosting(true);
    try {
      await createSecret(profile.uid, { category, isLongStory, text });
      setText('');
      setIsLongStory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر نشر السر.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-3xl mx-auto space-y-3.5">
        <PageHeader
          title="صندوق الأسرار والفضفضة المجهولة"
          subtitle="عبّر عما بداخلك باسم رمزي تلقائي وبسرّية تامة دون الكشف عن هويتك"
          icon={<EyeOff className="w-4 h-4" />}
        />

        <div className="p-3 rounded-xl bg-[#E6F4F0]/80 dark:bg-[#14332C]/70 border border-[#0B7A62]/20 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0B7A62] text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
            <strong className="font-bold">حماية كاملة للهوية:</strong> لا يتم حفظ اسمك أو صورتك أو معرّفك الظاهر في بطاقة السر أو الردود.
          </p>
        </div>

        <form
          onSubmit={handlePublish}
          className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-[36px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs font-medium"
            >
              {SECRET_CATEGORIES.filter((c) => c !== 'الكل' && c !== 'قصة طويلة').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isLongStory}
                onChange={(e) => setIsLongStory(e.target.checked)}
                className="accent-[#0B7A62] cursor-pointer"
              />
              <span>قصة طويلة</span>
            </label>
          </div>

          <textarea
            rows={isLongStory ? 5 : 3}
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="فضفض عما بداخلك بأمان وباسم مجهول تمامًا..."
            className="w-full p-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
          />

          {error && <FeedbackBanner type="error" message={error} />}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !text.trim()}
              className="min-h-[36px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Send className="w-3.5 h-3.5 -scale-x-100" />
              <span>{posting ? 'جاري النشر...' : 'إرسال بسرّية'}</span>
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <SegmentedTabs
              items={SECRET_CATEGORIES.map((c) => ({ id: c, label: c }))}
              value={categoryFilter}
              onChange={setCategoryFilter}
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'latest' | 'empathy')}
            className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#121B20] text-xs font-medium shrink-0"
          >
            <option value="latest">الأحدث</option>
            <option value="empathy">الأكثر تعاطفًا</option>
          </select>
        </div>

        {visibleSecrets.length === 0 ? (
          <EmptyState
            icon={<EyeOff className="w-5 h-5" />}
            title="لا توجد أسرار في هذا التصنيف"
            description="كن أول من يشارك تجربة أو فضفضة بهوية مجهولة في هذا القسم."
          />
        ) : (
          <div className="rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 divide-y divide-slate-200/75 dark:divide-white/8">
            {visibleSecrets.map((secret) => {
              const isSensitiveLong = secret.isLongStory && !revealedSecrets[secret.id];
              return (
                <article key={secret.id} className="p-3.5 sm:p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{secret.alias}</span>
                      <span>·</span>
                      <span>{secret.category}</span>
                      {secret.isLongStory && (
                        <>
                          <span>·</span>
                          <span className="text-[#0B7A62] dark:text-[#34D399] font-semibold">
                            قصة طويلة
                          </span>
                        </>
                      )}
                    </div>
                    <span className="font-mono tabular-nums text-[11px]">{formatArabicTime(secret.createdAt)}</span>
                  </div>

                  {isSensitiveLong ? (
                    <div className="p-3 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        قصة طويلة مخفية لحماية راحتك البصرية — اضغط لقراءة التفاصيل كاملة.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setRevealedSecrets((prev) => ({ ...prev, [secret.id]: true }))
                        }
                        className="min-h-[34px] px-3 rounded-lg bg-[#0B7A62] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>كشف القصة</span>
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                      {secret.text}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5 text-xs">
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          await reactEmpathyToSecret(secret, 'feel', profile.uid);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'تعذر تسجيل التفاعل.');
                        }
                      }}
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <HeartHandshake className="w-3.5 h-3.5 text-rose-500" />
                      <span>أشعر بك ({secret.empathyCounts?.feel ?? 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          await reactEmpathyToSecret(secret, 'pray', profile.uid);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'تعذر تسجيل التفاعل.');
                        }
                      }}
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>دعاء لك ({secret.empathyCounts?.pray ?? 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          await reactEmpathyToSecret(secret, 'strength', profile.uid);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'تعذر تسجيل التفاعل.');
                        }
                      }}
                      className="min-h-[32px] px-2.5 rounded-lg border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
                      <span>كن قويًا ({secret.empathyCounts?.strength ?? 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setOpenComments((p) => ({ ...p, [secret.id]: !p[secret.id] }))
                      }
                      className="mr-auto min-h-[32px] px-2.5 rounded-lg hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-medium text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="font-mono tabular-nums">{secret.commentsCount} تعليق</span>
                    </button>
                  </div>

                  {openComments[secret.id] && <SecretCommentsList secretId={secret.id} />}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
