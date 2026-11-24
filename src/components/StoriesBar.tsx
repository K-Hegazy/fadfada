import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Plus, Trash2, X } from 'lucide-react';
import {
  createStory,
  deleteStory,
  markStoryViewed,
  subscribeToStories,
} from '../services/community';
import { uploadImageAsset, uploadStoryVideo } from '../services/storage';
import { useApp } from '../state/AppContext';
import type { Story } from '../types/fadfada';
import { formatArabicTime } from '../utils/formatters';
import { Avatar } from './Avatar';

const STORY_BG_COLORS = ['#0B7A62', '#1E293B', '#9F1239', '#B45309', '#0369A1'];

export const StoriesBar: React.FC = () => {
  const { profile, usersById, isPeerOnline, isStaff } = useApp();
  const [stories, setStories] = useState<Story[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [storyType, setStoryType] = useState<'text' | 'image' | 'video'>('text');
  const [storyText, setStoryText] = useState('');
  const [bgColor, setBgColor] = useState(STORY_BG_COLORS[0]);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsub = subscribeToStories(setStories);
    return () => unsub();
  }, []);

  const activeStory = viewerIndex !== null ? stories[viewerIndex] ?? null : null;

  useEffect(() => {
    if (!activeStory || !profile) return;
    if (!activeStory.viewerIds.includes(profile.uid)) {
      void markStoryViewed(activeStory.id, profile.uid);
    }
  }, [activeStory, profile]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);
    setSubmitting(true);
    try {
      let mediaUrl = '';
      if (storyType === 'image') {
        if (!mediaFile) throw new Error('يرجى اختيار صورة للقصة.');
        mediaUrl = await uploadImageAsset('stories', profile.uid, mediaFile);
      } else if (storyType === 'video') {
        if (!mediaFile) throw new Error('يرجى اختيار فيديو للقصة.');
        mediaUrl = await uploadStoryVideo(profile.uid, mediaFile);
      } else if (!storyText.trim()) {
        throw new Error('يرجى كتابة نص القصة.');
      }

      await createStory(profile, {
        type: storyType,
        text: storyText,
        mediaUrl,
        bgColor,
      });
      setStoryText('');
      setMediaFile(null);
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر نشر القصة.');
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueAuthorStories = useMemo(() => stories, [stories]);

  if (!profile) return null;

  return (
    <>
      <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5 fadfada-scroll">
        {/* Add Story Button */}
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="group flex flex-col items-center gap-1 shrink-0 w-14 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#0B7A62]/60 dark:border-[#34D399]/50 bg-[#E6F4F0]/80 dark:bg-[#14332C]/80 flex items-center justify-center text-[#0B7A62] dark:text-[#34D399] group-hover:scale-[1.03] transition-transform">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 truncate w-full text-center">
            قصتك
          </span>
        </button>

        {uniqueAuthorStories.map((story, idx) => {
          const isViewed = story.viewerIds.includes(profile.uid);
          const author = usersById[story.authorId];
          const authorOnline = author ? isPeerOnline(author, isStaff) : false;

          return (
            <button
              key={story.id}
              type="button"
              onClick={() => setViewerIndex(idx)}
              className="group flex flex-col items-center gap-1 shrink-0 w-14 cursor-pointer"
            >
              <div
                className={`p-[2px] rounded-full transition-transform group-hover:scale-[1.03] ${
                  isViewed
                    ? 'bg-slate-300 dark:bg-slate-700'
                    : 'bg-gradient-to-tr from-[#0B7A62] via-emerald-500 to-amber-500'
                }`}
              >
                <div className="p-[1.5px] rounded-full bg-white dark:bg-[#121B20]">
                  <Avatar
                    src={story.authorAvatar}
                    name={story.authorName}
                    size="md"
                    isOnline={authorOnline}
                    showPresence={Boolean(author)}
                  />
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300 truncate w-full text-center">
                {story.authorName}
              </span>
            </button>
          );
        })}

        {uniqueAuthorStories.length === 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500 px-2">
            لا توجد قصص نشطة الآن — شارك أول قصة مع المجتمع.
          </span>
        )}
      </div>

      {/* Create Story Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-4">
          <form
            onSubmit={handlePublish}
            className="w-full max-w-md bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-xl p-5 space-y-3.5 shadow-xl fadfada-modal-in"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-50">
                  إضافة قصة يومية
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  تختفي القصة تلقائيًا بعد 24 ساعة
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="إغلاق"
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-[#18242B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#F2F4F7] dark:bg-[#0B1114]">
              {(['text', 'image', 'video'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setStoryType(t)}
                  className={`min-h-[34px] rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    storyType === t
                      ? 'bg-white dark:bg-[#18242B] text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t === 'text' ? 'نصية' : t === 'image' ? 'صورة' : 'فيديو'}
                </button>
              ))}
            </div>

            {storyType === 'text' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">خلفية البطاقة</span>
                <div className="flex items-center gap-2">
                  {STORY_BG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setBgColor(c)}
                      aria-label={`اختيار لون ${c}`}
                      className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                        bgColor === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}

            {storyType !== 'text' && (
              <label className="block p-3 rounded-lg border border-dashed border-slate-300 dark:border-white/15 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs text-center cursor-pointer hover:border-[#0B7A62]">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {mediaFile ? mediaFile.name : storyType === 'image' ? 'اختر صورة للقصة' : 'اختر فيديو للقصة'}
                </span>
                <input
                  type="file"
                  accept={storyType === 'image' ? 'image/*' : 'video/mp4,video/webm,video/quicktime'}
                  onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </label>
            )}

            <textarea
              rows={3}
              maxLength={500}
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder={storyType === 'text' ? 'اكتب قصتك هنا...' : 'تعليق اختياري...'}
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
            />

            {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[40px] rounded-lg bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold cursor-pointer"
            >
              {submitting ? 'جاري النشر...' : 'نشر القصة الآن'}
            </button>
          </form>
        </div>
      )}

      {/* Story Viewer Modal */}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-md rounded-xl overflow-hidden bg-slate-900 text-white relative shadow-2xl fadfada-modal-in">
            <div className="absolute top-2 inset-x-3 z-20 flex gap-1">
              {stories.map((s, i) => (
                <div
                  key={s.id}
                  className={`h-1 flex-1 rounded-full ${
                    i <= (viewerIndex ?? 0) ? 'bg-white' : 'bg-white/25'
                  }`}
                />
              ))}
            </div>

            <div className="pt-6 px-4 pb-4 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent absolute inset-x-0 top-0 z-10">
              <div className="flex items-center gap-2.5">
                <Avatar src={activeStory.authorAvatar} name={activeStory.authorName} size="sm" />
                <div>
                  <p className="text-xs font-bold">{activeStory.authorName}</p>
                  <p className="text-[11px] text-white/75 font-mono tabular-nums">
                    {formatArabicTime(activeStory.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {activeStory.authorId === profile.uid && (
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteStory(activeStory.id);
                      setViewerIndex(null);
                    }}
                    aria-label="حذف القصة"
                    className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full bg-black/45 hover:bg-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewerIndex(null)}
                  aria-label="إغلاق"
                  className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-full bg-black/45 hover:bg-black/70 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="min-h-[420px] flex items-center justify-center">
              {activeStory.type === 'text' ? (
                <div
                  className="w-full min-h-[420px] flex items-center justify-center p-8 text-center text-lg font-medium leading-relaxed"
                  style={{ backgroundColor: activeStory.bgColor || '#0B7A62' }}
                >
                  {activeStory.text}
                </div>
              ) : activeStory.type === 'image' ? (
                <div className="relative w-full">
                  <img
                    src={activeStory.mediaUrl}
                    alt={activeStory.authorName}
                    referrerPolicy="no-referrer"
                    className="w-full max-h-[500px] object-contain"
                  />
                  {activeStory.text && (
                    <p className="p-4 text-center text-sm bg-black/60">{activeStory.text}</p>
                  )}
                </div>
              ) : (
                <video
                  src={activeStory.mediaUrl}
                  controls
                  autoPlay
                  className="w-full max-h-[500px]"
                />
              )}
            </div>

            <div className="p-3.5 bg-black/85 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-white/80 min-w-0">
                <Eye className="w-4 h-4 shrink-0" />
                <span className="font-mono tabular-nums">{activeStory.viewerIds.length} مشاهدة</span>
                {activeStory.authorId === profile.uid && (
                  <span className="text-[11px] text-white/60 truncate max-w-[150px]">
                    ({activeStory.viewerIds
                      .map((id) => usersById[id]?.displayName)
                      .filter(Boolean)
                      .join('، ')})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={viewerIndex === 0}
                  onClick={() => setViewerIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                  className="min-h-[32px] px-2.5 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-30 inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span>السابق</span>
                </button>
                <button
                  type="button"
                  disabled={viewerIndex === stories.length - 1}
                  onClick={() =>
                    setViewerIndex((i) => (i !== null && i < stories.length - 1 ? i + 1 : i))
                  }
                  className="min-h-[32px] px-2.5 rounded-lg bg-white/15 hover:bg-white/25 disabled:opacity-30 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
