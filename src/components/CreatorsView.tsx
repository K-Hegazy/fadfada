import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Heart, MessageSquare, Sparkles, XCircle } from 'lucide-react';
import {
  addProposalComment,
  subscribeToCreatorProposals,
  subscribeToProposalComments,
  submitCreatorProposal,
  toggleProposalLike,
} from '../services/community';
import { useApp } from '../state/AppContext';
import type { CreatorProposal, SimpleMessage } from '../types/fadfada';
import { formatArabicTime } from '../utils/formatters';
import { Avatar } from './Avatar';
import { EmptyState, FeedbackBanner, PageHeader } from './ui/Primitives';

const ProposalComments: React.FC<{ proposalId: string }> = ({ proposalId }) => {
  const { profile } = useApp();
  const [comments, setComments] = useState<SimpleMessage[]>([]);
  const [text, setText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToProposalComments(proposalId, setComments);
    return () => unsub();
  }, [proposalId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !text.trim()) return;
    setCommentError(null);
    try {
      await addProposalComment(proposalId, profile, text);
      setText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'تعذر إضافة التعليق.');
    }
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 dark:border-white/10 space-y-2">
      {comments.map((c) => (
        <div key={c.id} className="p-2.5 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/60 dark:border-white/10 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{c.senderName}</span>
            <span className="font-mono tabular-nums text-[10px]">{formatArabicTime(c.createdAt)}</span>
          </div>
          <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed">{c.text}</p>
        </div>
      ))}
      {commentError && <p className="text-xs text-rose-600">{commentError}</p>}
      <form onSubmit={handleAdd} className="flex items-center gap-1.5">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="شارك برأيك حول المقترح..."
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

export const CreatorsView: React.FC = () => {
  const { profile, openProfileModal } = useApp();
  const [proposals, setProposals] = useState<CreatorProposal[]>([]);
  const [category, setCategory] = useState('كتابة وأدب');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsub = subscribeToCreatorProposals(setProposals);
    return () => unsub();
  }, []);

  if (!profile) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitCreatorProposal(profile, { category, title, description });
      setTitle('');
      setDescription('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إرسال المقترح.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-3 sm:p-4 pb-20 md:pb-6">
      <div className="max-w-3xl mx-auto space-y-3.5">
        <PageHeader
          title="مركز المبدعين والأفكار"
          subtitle="قدّم فكرتك أو موهبتك للحصول على دعم المجتمع وشارة مبدع معتمد"
          icon={<Sparkles className="w-4 h-4" />}
        />

        <form
          onSubmit={handleSubmit}
          className="p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs font-medium"
            >
              <option value="كتابة وأدب">كتابة وأدب</option>
              <option value="تصميم وفن">تصميم وفن</option>
              <option value="بودكاست وصوت">بودكاست وصوت</option>
              <option value="مبادرة مجتمعية">مبادرة مجتمعية</option>
              <option value="تطوير أفكار">تطوير أفكار</option>
            </select>
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان المقترح الإبداعي..."
              className="sm:col-span-2 min-h-[38px] px-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
            />
          </div>

          <textarea
            rows={3}
            required
            minLength={5}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="اشرح فكرتك أو مشروعك الإبداعي..."
            className="w-full p-3 rounded-lg border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
          />

          {error && <FeedbackBanner type="error" message={error} />}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[36px] px-4 rounded-lg bg-[#0B7A62] hover:bg-[#08614D] text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              {submitting ? 'جاري التقديم...' : 'تقديم المقترح للمراجعة'}
            </button>
          </div>
        </form>

        {proposals.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="w-5 h-5" />}
            title="لا توجد مقترحات إبداعية بعد"
            description="شارك بأول فكرة أو مبادرة لمجتمع فضفضة واحصل على تفاعل الأعضاء."
          />
        ) : (
          <div className="rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 divide-y divide-slate-200/75 dark:divide-white/8">
            {proposals.map((p) => {
              const isLiked = p.likedBy.includes(profile.uid);
              return (
                <article key={p.id} className="p-3.5 sm:p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openProfileModal(p.authorId)}
                      className="flex items-center gap-2.5 text-right cursor-pointer"
                    >
                      <Avatar src={p.authorAvatar} name={p.authorName} size="sm" />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{p.authorName}</p>
                        <p className="text-[11px] text-slate-400">
                          {p.category} · {formatArabicTime(p.createdAt)}
                        </p>
                      </div>
                    </button>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 ${
                        p.status === 'approved'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : p.status === 'rejected'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {p.status === 'approved' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : p.status === 'rejected' ? (
                        <XCircle className="w-3.5 h-3.5" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {p.status === 'approved'
                          ? `مقبول (${p.badgeDurationDays} يوم شارة)`
                          : p.status === 'rejected'
                          ? 'مرفوض'
                          : 'قيد المراجعة'}
                      </span>
                    </span>
                  </div>

                  <div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {p.description}
                    </p>
                  </div>

                  {p.adminReply && (
                    <div className="p-2.5 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/70 dark:border-white/10 text-xs">
                      <span className="font-bold text-[#0B7A62] dark:text-[#34D399]">رد الإدارة: </span>
                      <span>{p.adminReply}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-1.5 text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        try {
                          await toggleProposalLike(p, profile.uid);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'تعذر تحديث الإعجاب.');
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        isLiked ? 'text-rose-600 font-semibold' : 'hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                      <span className="font-mono tabular-nums">{p.likesCount}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setOpenComments((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                      }
                      className="inline-flex items-center gap-1.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="font-mono tabular-nums">{p.commentsCount} تعليق</span>
                    </button>
                  </div>

                  {openComments[p.id] && <ProposalComments proposalId={p.id} />}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
