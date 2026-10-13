import React, { useState, useEffect, useRef } from 'react';
import { apiRequest, uploadMedia, getMediaUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Story } from '../types';
import {
  Sparkles,
  Plus,
  Eye,
  Trash2,
  X,
  Image as ImageIcon,
  Video,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Clock,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Megaphone,
  Upload,
  AlertCircle,
  FileVideo,
  CheckCircle2,
  RotateCcw
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

const MAX_FILE_SIZE_MB = 35;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];

export const StoriesPage: React.FC = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [ads, setAds] = useState<StoryAd[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [activeAd, setActiveAd] = useState<StoryAd | null>(null);
  const [storiesViewedCount, setStoriesViewedCount] = useState<number>(0);

  // New Story modal state
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [storyContent, setStoryContent] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [fileError, setFileError] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Story Viewer video state
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);

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

  // Cleanup object url on unmount or file reset
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError('');
    if (!file) return;

    // 1. Validate file size (max 35MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(`حجم الملف (${(file.size / (1024 * 1024)).toFixed(1)} ميجابايت) يتجاوز الحد الأقصى المسموح به (${MAX_FILE_SIZE_MB} ميجابايت).`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Validate file type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/');
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setFileError('صيغة الملف غير مدعومة. الصيغ المقبولة: صور (JPG, PNG, WebP) وفيديوهات (MP4, WebM, MOV).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Clean previous preview
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setFileType(isVideo ? 'video' : 'image');
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleClearFile = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl('');
    setFileType(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePublishStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storyContent.trim() && !selectedFile) {
      setFileError('يرجى كتابة نص للقصة أو اختيار صورة أو فيديو لنشره');
      return;
    }

    setSubmitting(true);
    setIsUploading(true);
    setFileError('');
    setUploadProgress(15);

    try {
      let uploadedMediaUrl = '';
      let targetType: 'text' | 'image' | 'video' = 'text';

      if (selectedFile) {
        setUploadProgress(40);
        // Convert file to base64 for authenticated upload endpoint
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });

        setUploadProgress(70);
        uploadedMediaUrl = await uploadMedia(base64Data, selectedFile.name);
        targetType = fileType === 'video' ? 'video' : 'image';
        setUploadProgress(90);
      }

      await apiRequest('/stories', {
        method: 'POST',
        body: JSON.stringify({
          content: storyContent.trim(),
          mediaUrl: uploadedMediaUrl,
          type: targetType
        })
      });

      setUploadProgress(100);
      handleClearFile();
      setStoryContent('');
      setCreateModalOpen(false);
      fetchStoriesAndAds();
    } catch (err: any) {
      setFileError(err.message || 'حدث خطأ أثناء رفع القصة ونشرها. يرجى المحاولة ثانية.');
    } finally {
      setSubmitting(false);
      setIsUploading(false);
      setUploadProgress(0);
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
    setIsVideoPlaying(true);
    const s = stories[index];
    if (s) {
      apiRequest(`/stories/${s.id}/view`, { method: 'POST' }).catch(() => {});
    }
  };

  const handleNextStory = () => {
    if (activeStoryIndex === null) return;
    const nextCount = storiesViewedCount + 1;
    setStoriesViewedCount(nextCount);

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

  const toggleVideoPlayback = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const toggleVideoMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsVideoMuted(videoRef.current.muted);
  };

  const currentStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  const isCurrentStoryVideo = (s?: Story | null): boolean => {
    if (!s) return false;
    if (s.type === 'video') return true;
    if (s.media_url) {
      const lower = s.media_url.toLowerCase();
      return lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.m4v');
    }
    return false;
  };

  return (
    <div className="space-y-6 animate-in fade-in" dir="rtl">
      {/* Stories Header */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-purple-950/40 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 shrink-0" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white">القصص واللحظات (24 ساعة)</h1>
          </div>
          <p className="text-xs sm:text-sm text-neutral-400 font-tajawal max-w-xl">
            شارك لحظاتك بصور وفيديوهات أو خواطر مكتوبة لتظهر للأعضاء لمدة 24 ساعة ثم تختفي تلقائياً وبأمان تام.
          </p>
        </div>

        <button
          onClick={() => {
            setFileError('');
            setCreateModalOpen(true);
          }}
          className="w-full sm:w-auto px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-purple-600/20 shrink-0 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>نشر قصة (صورة أو فيديو)</span>
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
            كن أول من يشارك لحظاته اليومية وينشر قصة مصورة أو فيديو تظهر لمدة 24 ساعة!
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
            const isStoryVideo = isCurrentStoryVideo(story);

            return (
              <div
                key={story.id}
                onClick={() => openStoryViewer(index)}
                className={`h-64 rounded-3xl border p-4 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] relative overflow-hidden shadow-lg ${
                  isFemale
                    ? 'bg-gradient-to-b from-rose-950/40 to-[#0e1017] border-rose-900/40 hover:border-rose-700'
                    : 'bg-gradient-to-b from-sky-950/40 to-[#0e1017] border-sky-900/40 hover:border-sky-700'
                }`}
              >
                {/* Background image or video thumbnail */}
                {story.media_url && !isStoryVideo && (
                  <img
                    src={getMediaUrl(story.media_url)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover opacity-35"
                  />
                )}
                {story.media_url && isStoryVideo && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <video
                      src={getMediaUrl(story.media_url)}
                      muted
                      preload="metadata"
                      className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none"
                    />
                    <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white z-10 border border-white/20">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                )}

                {/* Top header on card */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-900/80 border border-purple-500/60 flex items-center justify-center text-xs font-bold text-white shadow">
                      {story.avatar_url ? (
                        <img src={getMediaUrl(story.avatar_url)} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        story.username?.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <span className="text-xs font-bold text-white drop-shadow font-cairo truncate max-w-[85px]">
                      {story.username}
                    </span>
                  </div>

                  {isStoryVideo ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-black/60 border border-purple-500/40 text-[10px] text-purple-300 font-tajawal flex items-center gap-1 backdrop-blur-md">
                      <Video className="w-2.5 h-2.5" />
                      <span>فيديو</span>
                    </span>
                  ) : story.media_url ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-black/60 border border-white/20 text-[10px] text-neutral-300 font-tajawal flex items-center gap-1 backdrop-blur-md">
                      <ImageIcon className="w-2.5 h-2.5" />
                      <span>صورة</span>
                    </span>
                  ) : null}
                </div>

                {/* Card text teaser */}
                <div className="relative z-10 my-auto text-center px-1">
                  {story.content && (
                    <p className="text-xs text-white font-tajawal line-clamp-3 leading-relaxed drop-shadow-md">
                      {story.content}
                    </p>
                  )}
                </div>

                {/* Card footer */}
                <div className="relative z-10 flex items-center justify-between text-[10px] text-neutral-300 font-tajawal border-t border-white/10 pt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-neutral-400" />
                    <span>24 ساعة</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-purple-400" />
                    <span>{story.view_count || 0}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Story Viewer Modal */}
      {(activeStoryIndex !== null || activeAd !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in select-none">
          {activeAd ? (
            /* A. Sponsored Ad View */
            <div className="relative w-full max-w-sm h-[82dvh] sm:h-[75vh] bg-[#0c0e15] border border-amber-500/40 rounded-2xl sm:rounded-3xl flex flex-col justify-between p-4 sm:p-6 overflow-hidden shadow-2xl">
              {activeAd.image_url && (
                <img
                  src={activeAd.image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-50"
                />
              )}
              <div className="relative z-10 flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                  إعلان ممول
                </span>
                <button onClick={handleSkipAd} className="p-1 rounded-lg bg-black/50 text-neutral-300 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative z-10 my-auto p-4 text-center space-y-2">
                <h3 className="font-cairo font-black text-xl text-white drop-shadow">{activeAd.title}</h3>
                {activeAd.description && (
                  <p className="font-tajawal text-xs text-neutral-200 leading-relaxed drop-shadow">{activeAd.description}</p>
                )}
                {activeAd.link_url && (
                  <button
                    onClick={() => handleAdClick(activeAd)}
                    className="mt-3 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs font-cairo inline-flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    <span>معرفة المزيد</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative z-10 flex items-center justify-between text-xs text-neutral-400 pt-3 border-t border-white/10">
                <button onClick={handlePrevStory} className="flex items-center gap-1 cursor-pointer text-white">
                  <ChevronRight className="w-4 h-4" />
                  <span>السابقة</span>
                </button>
                <button onClick={handleSkipAd} className="px-4 py-1.5 rounded-xl bg-white/10 text-white text-xs font-bold cursor-pointer">
                  تخطي الإعلان ✕
                </button>
                <button onClick={handleNextStory} className="flex items-center gap-1 cursor-pointer text-white">
                  <span>التالية</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : currentStory ? (
            /* B. Normal Story Viewer (Image or Video) */
            <div className="relative w-full max-w-sm h-[84dvh] sm:h-[78vh] bg-[#0c0e15] border border-neutral-800 rounded-2xl sm:rounded-3xl flex flex-col justify-between p-4 sm:p-5 overflow-hidden shadow-2xl">
              {/* Media Layer */}
              {isCurrentStoryVideo(currentStory) ? (
                <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    src={getMediaUrl(currentStory.media_url)}
                    autoPlay
                    playsInline
                    loop
                    muted={isVideoMuted}
                    onLoadedMetadata={() => {
                      if (videoRef.current) setVideoDuration(videoRef.current.duration);
                    }}
                    onTimeUpdate={() => {
                      if (videoRef.current) setVideoCurrentTime(videoRef.current.currentTime);
                    }}
                    className="w-full h-full object-contain cursor-pointer"
                    onClick={toggleVideoPlayback}
                  />
                  {/* Subtle Video Overlay Controls Bar */}
                  <div className="absolute bottom-16 right-4 left-4 z-20 flex items-center justify-between bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={toggleVideoPlayback}
                      className="text-white hover:text-purple-400 p-1 cursor-pointer flex items-center gap-1.5 text-xs font-tajawal"
                    >
                      {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
                      <span>{isVideoPlaying ? 'إيقاف' : 'تشغيل'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={toggleVideoMute}
                      className="text-white hover:text-purple-400 p-1 cursor-pointer"
                    >
                      {isVideoMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                    </button>
                  </div>
                </div>
              ) : currentStory.media_url ? (
                <img
                  src={getMediaUrl(currentStory.media_url)}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-b from-purple-950/60 to-neutral-950 opacity-90" />
              )}

              {/* Gradient scrims for readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/70 pointer-events-none" />

              {/* Viewer Header */}
              <div className="relative z-20 space-y-3">
                {/* Progress Bar */}
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 transition-all duration-200"
                    style={{
                      width: isCurrentStoryVideo(currentStory) && videoDuration > 0
                        ? `${(videoCurrentTime / videoDuration) * 100}%`
                        : '100%'
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-purple-900 flex items-center justify-center font-bold text-sm text-white border border-purple-500 shadow">
                      {currentStory.avatar_url ? (
                        <img src={getMediaUrl(currentStory.avatar_url)} alt="" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        currentStory.username.slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-cairo font-bold text-sm text-white drop-shadow">{currentStory.username}</div>
                      <div className="text-[10px] text-neutral-300 drop-shadow font-tajawal">
                        {new Date(currentStory.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStory.user_id === user?.id && (
                      <button
                        onClick={() => deleteStory(currentStory.id)}
                        className="text-rose-400 hover:text-rose-300 p-2 rounded-xl bg-black/60 backdrop-blur-md cursor-pointer border border-white/10"
                        title="حذف قصتي"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setActiveStoryIndex(null)}
                      className="text-neutral-300 hover:text-white p-2 rounded-xl bg-black/60 backdrop-blur-md cursor-pointer border border-white/10"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Viewer Text Content Overlay */}
              {currentStory.content && (
                <div className="relative z-20 text-center my-auto p-4 bg-black/40 backdrop-blur-sm rounded-2xl border border-white/10 max-h-48 overflow-y-auto">
                  <p className="font-tajawal text-base sm:text-lg text-white font-medium leading-relaxed drop-shadow-md">
                    {currentStory.content}
                  </p>
                </div>
              )}

              {/* Viewer Navigation Controls */}
              <div className="relative z-20 flex items-center justify-between text-xs text-neutral-300 pt-3 border-t border-white/10">
                <button
                  disabled={activeStoryIndex === 0}
                  onClick={handlePrevStory}
                  className="flex items-center gap-1 disabled:opacity-30 cursor-pointer text-white px-2 py-1 rounded bg-black/40"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابقة</span>
                </button>

                <span className="flex items-center gap-1.5 text-neutral-200 text-xs font-tajawal bg-black/50 px-2.5 py-1 rounded-full">
                  <Eye className="w-3.5 h-3.5 text-purple-400" />
                  <span>{currentStory.view_count || 0} مشاهدة</span>
                </span>

                <button
                  onClick={handleNextStory}
                  className="flex items-center gap-1 cursor-pointer text-white px-2 py-1 rounded bg-black/40"
                >
                  <span>التالية</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Create Story Modal with Photo & Video Preview and Upload Progress */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="relative w-full max-w-lg bg-[#0e1017] border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-cairo font-bold text-lg text-white">نشر قصة مصورة أو فيديو</h3>
                  <p className="text-[11px] text-neutral-400 font-tajawal">تبقى نشطة لمدة 24 ساعة فقط ثم تختفي</p>
                </div>
              </div>

              <button
                type="button"
                disabled={isUploading || submitting}
                onClick={() => {
                  handleClearFile();
                  setCreateModalOpen(false);
                }}
                className="text-neutral-400 hover:text-white cursor-pointer p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {fileError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-tajawal">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{fileError}</span>
              </div>
            )}

            <form onSubmit={handlePublishStory} className="space-y-4">
              {/* Text Area */}
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5 font-tajawal">
                  نص القصة أو الخاطرة (اختياري مع الوسائط)
                </label>
                <textarea
                  rows={3}
                  value={storyContent}
                  onChange={(e) => setStoryContent(e.target.value)}
                  placeholder="اكتب عبارة ملهمة أو خاطرة تشاركها مع الأصدقاء..."
                  className="w-full px-4 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 focus:border-purple-500 text-white text-xs sm:text-sm outline-none font-tajawal resize-none leading-relaxed"
                />
              </div>

              {/* Media File Picker & Preview */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-neutral-300 font-tajawal">
                  إرفاق صورة أو مقطع فيديو من جهازك
                </label>

                {!selectedFile ? (
                  /* File Selection Dropzone */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-neutral-800 hover:border-purple-500/60 rounded-2xl p-5 text-center cursor-pointer transition-all bg-[#0a0d14] hover:bg-neutral-900/60 space-y-2 group"
                  >
                    <div className="flex items-center justify-center gap-2 text-purple-400">
                      <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <Video className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="text-xs font-bold text-white font-cairo">
                      اضغط لاختيار صورة أو فيديو من الهاتف أو الكمبيوتر
                    </div>
                    <p className="text-[11px] text-neutral-400 font-tajawal leading-relaxed">
                      الصيغ المقبولة: صور (JPG, PNG, WebP) وفيديوهات (MP4, WebM, MOV)
                      <br />
                      الحد الأقصى لحجم الملف: <span className="text-purple-300 font-bold">35 ميجابايت</span>
                    </p>
                  </div>
                ) : (
                  /* Rich Interactive Preview Card */
                  <div className="rounded-2xl border border-purple-500/40 bg-neutral-900/80 p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-300 font-cairo">
                        {fileType === 'video' ? <FileVideo className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                        <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-[11px] text-neutral-300 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 font-tajawal cursor-pointer transition-colors"
                        >
                          تغيير الملف
                        </button>
                        <button
                          type="button"
                          onClick={handleClearFile}
                          className="text-[11px] text-rose-300 hover:text-rose-200 px-2 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800/60 font-tajawal cursor-pointer transition-colors"
                        >
                          إلغاء ✕
                        </button>
                      </div>
                    </div>

                    {/* Preview Box */}
                    <div className="relative rounded-xl overflow-hidden bg-black/60 max-h-56 flex items-center justify-center">
                      {fileType === 'video' ? (
                        <video
                          src={previewUrl}
                          controls
                          className="w-full max-h-52 rounded-xl object-contain bg-black"
                        />
                      ) : (
                        <img
                          src={previewUrl}
                          alt="معاينة"
                          className="w-full max-h-52 object-contain rounded-xl"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,video/x-m4v"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="space-y-1.5 p-3 rounded-2xl bg-purple-950/40 border border-purple-800/50">
                  <div className="flex items-center justify-between text-xs font-bold text-purple-300 font-tajawal">
                    <span className="flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 animate-bounce" />
                      <span>جاري تشفير ورفع وسائط القصة بأمان...</span>
                    </span>
                    <span className="font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={isUploading || submitting}
                  onClick={() => {
                    handleClearFile();
                    setCreateModalOpen(false);
                  }}
                  className="w-1/3 py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs font-tajawal cursor-pointer transition-colors"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={submitting || isUploading || (!storyContent.trim() && !selectedFile)}
                  className="w-2/3 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-cairo font-black text-xs sm:text-sm shadow-lg shadow-purple-600/25 cursor-pointer disabled:opacity-50 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {isUploading ? 'جاري الرفع والمعالجة...' : submitting ? 'جاري النشر...' : 'نشر القصة الآن (24 ساعة)'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
