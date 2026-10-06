import React, { useState, useEffect } from 'react';
import { apiRequest, uploadMedia } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Story } from '../types';
import {
  Sparkles,
  Plus,
  Eye,
  Trash2,
  X,
  Image,
  Clock,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Megaphone
} from 'lucide-react';

export interface StoryAd {
  id: string;
  title: string;
  description: string;
  image_url: string;
  link_url?: string;
  is_active: number;
  display_interval: number;
  views_count?: number;
  clicks_count?: number;
  priority?: number;
}

export const StoriesPage: React.FC = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [ads, setAds] = useState<StoryAd[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeAd, setActiveAd] = useState<StoryAd | null>(null);
  const [storiesViewedCount, setStoriesViewedCount] = useState<number>(0);

  // New Story modal
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [storyContent, setStoryContent] = useState<string>('');
  const [storyImage, setStoryImage] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchStoriesAndAds = async () => {
    try {
      setLoading(true);
      const [storiesRes, adsRes] = await Promise.allSettled([
        apiRequest<{ stories: Story[] }>('/stories'),
        apiRequest<{ success: boolean; ads: StoryAd[] }>('/story-ads')
      ]);

      if (storiesRes.status === 'fulfilled') {
        setStories(storiesRes.value.stories || []);
      }
      if (adsRes.status === 'fulfilled' && adsRes.value?.ads) {
        setAds(adsRes.value.ads.filter(a => a.is_active !== 0));
      }
    } catch (err) {
      console.error('Error fetching stories or ads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoriesAndAds();
  }, []);

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const uploaded = await uploadMedia(reader.result as string, file.name);
        setStoryImage(uploaded);
      } catch (err) {
        alert('فشل رفع الصورة');
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyContent && !storyImage) return;

    setSubmitting(true);
    try {
      await apiRequest('/stories', {
        method: 'POST',
        body: JSON.stringify({
          content: storyContent,
          mediaUrl: storyImage,
          type: storyImage ? 'image' : 'text'
        })
      });
      setCreateModalOpen(false);
      setStoryContent('');
      setStoryImage('');
      fetchStoriesAndAds();
    } catch (err: any) {
      alert(err.message || 'فشل نشر القصة');
    } finally {
      setSubmitting(false);
    }
  };

  const recordAdImpression = (adId: string) => {
    apiRequest(`/story-ads/${adId}/view`, { method: 'POST' }).catch(() => {});
  };

  const handleAdClick = (ad: StoryAd) => {
    apiRequest(`/story-ads/${ad.id}/click`, { method: 'POST' }).catch(() => {});
    if (ad.link_url) {
      window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    }
  };

  const openStoryViewer = (index: number) => {
    setActiveAd(null);
    setActiveStoryIndex(index);
    const s = stories[index];
    if (s) {
      apiRequest(`/stories/${s.id}/view`, { method: 'POST' }).catch(() => {});
    }
  };

  const handleNextStory = () => {
    if (activeStoryIndex === null) return;
    const nextCount = storiesViewedCount + 1;
    setStoriesViewedCount(nextCount);

    // Check if an ad should be displayed based on interval
    if (ads.length > 0) {
      const selectedAd = ads[(nextCount - 1) % ads.length];
      const interval = selectedAd.display_interval || 3;
      if (nextCount % interval === 0) {
        setActiveAd(selectedAd);
        recordAdImpression(selectedAd.id);
        return;
      }
    }

    if (activeStoryIndex < stories.length - 1) {
      openStoryViewer(activeStoryIndex + 1);
    } else {
      setActiveStoryIndex(null);
    }
  };

  const handlePrevStory = () => {
    if (activeAd) {
      setActiveAd(null);
      return;
    }
    if (activeStoryIndex !== null && activeStoryIndex > 0) {
      openStoryViewer(activeStoryIndex - 1);
    }
  };

  const handleSkipAd = () => {
    setActiveAd(null);
    if (activeStoryIndex !== null && activeStoryIndex < stories.length - 1) {
      openStoryViewer(activeStoryIndex + 1);
    } else {
      setActiveStoryIndex(null);
    }
  };

  const deleteStory = async (storyId: string) => {
    if (!confirm('هل تريد حذف هذه القصة؟')) return;
    try {
      await apiRequest(`/stories/${storyId}`, { method: 'DELETE' });
      setActiveStoryIndex(null);
      fetchStoriesAndAds();
    } catch (err) {
      alert('فشل حذف القصة');
    }
  };

  const currentStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Stories Header */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-purple-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white">القصص واللحظات (24 ساعة)</h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            شارك لحظاتك وأفكارك اليومية لتظهر للأعضاء لمدة 24 ساعة فقط ثم تختفي تلقائياً وبأمان.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/20 shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>نشر قصة جديدة</span>
        </button>
      </div>

      {/* Stories Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-64 rounded-3xl bg-neutral-900/40 border border-neutral-800 animate-pulse" />
          ))}
        </div>
      ) : stories.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-neutral-900/30 border border-neutral-800/80 space-y-4 max-w-lg mx-auto">
          <Sparkles className="w-12 h-12 text-purple-400 mx-auto" />
          <h3 className="font-cairo font-bold text-lg text-white">لا توجد قصص نشطة حالياً</h3>
          <p className="text-xs text-neutral-400 font-tajawal">
            كن أول من يشارك لحظاته اليومية وينشر قصة تظهر لمدة 24 ساعة!
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-bold cursor-pointer"
          >
            نشر قصة الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {stories.map((story, index) => {
            const isFemale = story.gender === 'female';
            const isMine = story.user_id === user?.id;
            // Check if we should insert an ad card after this story
            const adToRender = ads.length > 0 && (index + 1) % 4 === 0
              ? ads[Math.floor((index + 1) / 4 - 1) % ads.length]
              : null;

            return (
              <React.Fragment key={story.id}>
                <div
                  onClick={() => openStoryViewer(index)}
                  className={`h-64 rounded-3xl border p-4 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] relative overflow-hidden shadow-lg ${
                    isFemale
                      ? 'bg-gradient-to-b from-rose-950/40 to-[#0e1017] border-rose-900/40 hover:border-rose-700'
                      : 'bg-gradient-to-b from-sky-950/40 to-[#0e1017] border-sky-900/40 hover:border-sky-700'
                  }`}
                >
                  {/* Background image if image story */}
                  {story.media_url && (
                    <img
                      src={story.media_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover opacity-35"
                    />
                  )}

                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border ${
                        isFemale ? 'bg-rose-950 text-rose-200 border-rose-600' : 'bg-sky-950 text-sky-200 border-sky-600'
                      }`}>
                        {story.username.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="font-cairo font-bold text-xs text-white truncate max-w-[90px]">
                        {story.username}
                      </span>
                    </div>

                    <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      24h
                    </span>
                  </div>

                  <div className="relative z-10 my-auto">
                    {story.content && (
                      <p className="text-xs text-neutral-200 line-clamp-4 font-tajawal font-medium leading-relaxed">
                        "{story.content}"
                      </p>
                    )}
                  </div>

                  <div className="relative z-10 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-neutral-300">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {story.view_count || 0}
                    </span>
                    {isMine && (
                      <span className="text-purple-300 font-bold">قصتي</span>
                    )}
                  </div>
                </div>

                {/* Embedded Sponsored Ad Card */}
                {adToRender && (
                  <div
                    onClick={() => {
                      recordAdImpression(adToRender.id);
                      setActiveAd(adToRender);
                    }}
                    className="h-64 rounded-3xl border border-amber-600/50 bg-gradient-to-b from-amber-950/40 via-[#10131c] to-[#0e1017] p-4 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] relative overflow-hidden shadow-lg group"
                  >
                    {adToRender.image_url && (
                      <img
                        src={adToRender.image_url}
                        alt={adToRender.title}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity"
                      />
                    )}

                    <div className="relative z-10 flex items-center justify-between">
                      <div className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                        <Megaphone className="w-3 h-3" />
                        <span>إعلان ممول</span>
                      </div>
                      <span className="text-[9px] text-neutral-400 font-tajawal">Sponsored</span>
                    </div>

                    <div className="relative z-10 my-auto space-y-1">
                      <h4 className="text-xs font-cairo font-bold text-white line-clamp-2">
                        {adToRender.title}
                      </h4>
                      {adToRender.description && (
                        <p className="text-[11px] text-neutral-300 line-clamp-3 font-tajawal leading-relaxed">
                          {adToRender.description}
                        </p>
                      )}
                    </div>

                    <div className="relative z-10 pt-2 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-amber-300 font-bold">
                      <span>عرض الإعلان</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Story Viewer Modal */}
      {(activeStoryIndex !== null || activeAd !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/95 backdrop-blur-md animate-in fade-in">
          {/* A. If showing an Ad Slide */}
          {activeAd ? (
            <div className="relative w-full max-w-sm h-[82dvh] sm:h-[75vh] bg-[#0c0e15] border border-amber-600/50 rounded-2xl sm:rounded-3xl flex flex-col justify-between p-4 sm:p-6 overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
              {activeAd.image_url && (
                <img
                  src={activeAd.image_url}
                  alt={activeAd.title}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover opacity-35"
                />
              )}

              {/* Header */}
              <div className="relative z-10 space-y-3">
                <div className="w-full h-1 bg-amber-500/20 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-amber-500" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-amber-500/30 border border-amber-500/60 text-amber-300 text-xs font-bold font-cairo flex items-center gap-1.5 shadow-sm">
                      <Megaphone className="w-3.5 h-3.5" />
                      إعلان ممول (Sponsored)
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setActiveAd(null);
                      setActiveStoryIndex(null);
                    }}
                    className="text-neutral-400 hover:text-white p-1.5 rounded-lg bg-black/40 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="relative z-10 text-center my-auto p-4 space-y-3">
                <h3 className="font-cairo font-bold text-lg sm:text-xl text-white drop-shadow-md">
                  {activeAd.title}
                </h3>
                {activeAd.description && (
                  <p className="font-tajawal text-xs sm:text-sm text-neutral-200 font-medium leading-relaxed drop-shadow-sm max-w-xs mx-auto">
                    {activeAd.description}
                  </p>
                )}

                {activeAd.link_url && (
                  <button
                    onClick={() => handleAdClick(activeAd)}
                    className="mt-3 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs font-cairo inline-flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <span>زيارة الرابط / معرفة المزيد</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Footer controls */}
              <div className="relative z-10 flex items-center justify-between text-xs text-neutral-400 pt-3 border-t border-white/10">
                <button
                  onClick={handlePrevStory}
                  className="flex items-center gap-1 cursor-pointer text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابقة</span>
                </button>

                <button
                  onClick={handleSkipAd}
                  className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  تخطي الإعلان ✕
                </button>

                <button
                  onClick={handleNextStory}
                  className="flex items-center gap-1 cursor-pointer text-white"
                >
                  <span>التالية</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : currentStory ? (
            /* B. Normal Story Viewer */
            <div className="relative w-full max-w-sm h-[82dvh] sm:h-[75vh] bg-[#0c0e15] border border-neutral-800 rounded-2xl sm:rounded-3xl flex flex-col justify-between p-4 sm:p-6 overflow-hidden shadow-2xl">
              {/* Background Image */}
              {currentStory.media_url && (
                <img
                  src={currentStory.media_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover opacity-40"
                />
              )}

              {/* Viewer Header */}
              <div className="relative z-10 space-y-3">
                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="w-full h-full bg-purple-500 animate-pulse" />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-purple-900 flex items-center justify-center font-bold text-sm text-white border border-purple-500">
                      {currentStory.username.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-cairo font-bold text-sm text-white">{currentStory.username}</div>
                      <div className="text-[10px] text-neutral-400">
                        {new Date(currentStory.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStory.user_id === user?.id && (
                      <button
                        onClick={() => deleteStory(currentStory.id)}
                        className="text-rose-400 hover:text-rose-300 p-1.5 rounded-lg bg-black/40 cursor-pointer"
                        title="حذف قصتي"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setActiveStoryIndex(null)}
                      className="text-neutral-400 hover:text-white p-1.5 rounded-lg bg-black/40 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Viewer Content */}
              <div className="relative z-10 text-center my-auto p-4">
                <p className="font-tajawal text-base sm:text-lg text-white font-medium leading-relaxed drop-shadow-md">
                  {currentStory.content}
                </p>
              </div>

              {/* Viewer Navigation Controls */}
              <div className="relative z-10 flex items-center justify-between text-xs text-neutral-400 pt-3 border-t border-white/10">
                <button
                  disabled={activeStoryIndex === 0}
                  onClick={handlePrevStory}
                  className="flex items-center gap-1 disabled:opacity-30 cursor-pointer text-white"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابقة</span>
                </button>

                <span className="flex items-center gap-1.5 text-neutral-300">
                  <Eye className="w-4 h-4" />
                  {currentStory.view_count || 0} مشاهدة
                </span>

                <button
                  onClick={handleNextStory}
                  className="flex items-center gap-1 cursor-pointer text-white"
                >
                  <span>التالية</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Create Story Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0e1017] border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="font-cairo font-bold text-lg text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                نشر قصة لمدة 24 ساعة
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishStory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">ماذا تود أن تفضفض اليوم؟</label>
                <textarea
                  rows={4}
                  value={storyContent}
                  onChange={(e) => setStoryContent(e.target.value)}
                  placeholder="اكتب خاطرة، فكرة، أو حكمة لتبقى 24 ساعة..."
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">صورة للقصة (اختياري)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImagePick}
                  className="w-full text-xs text-neutral-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-purple-950 file:text-purple-300 hover:file:bg-purple-900 cursor-pointer"
                />
                {storyImage && (
                  <div className="mt-2 rounded-xl overflow-hidden h-28 border border-neutral-800">
                    <img src={storyImage} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || (!storyContent && !storyImage)}
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm shadow-lg shadow-purple-600/20 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'جاري النشر...' : 'نشر القصة الآن'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

