import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { PlatformPost } from '../types';
import { OwnerBadge, isUserOwner } from './OwnerBadge';
import {
  Newspaper,
  Pin,
  Heart,
  Eye,
  Calendar,
  Share2,
  Plus,
  Search,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  BookOpen,
  X,
  ShieldCheck,
  Megaphone,
  Edit2,
  Trash2
} from 'lucide-react';

interface NewsPageProps {
  onOpenProfile?: (userId: string) => void;
}

export const NewsPage: React.FC<NewsPageProps> = ({ onOpenProfile }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PlatformPost[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Reader Modal State
  const [activePost, setActivePost] = useState<PlatformPost | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [likingPostId, setLikingPostId] = useState<string | null>(null);

  // Create Post Modal State
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('تحديثات المنصة');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newIsPinned, setNewIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.username?.toLowerCase() === 'hegazy';

  const categories = [
    { key: 'all', label: 'كافة المنشورات' },
    { key: 'تحديثات المنصة', label: 'تحديثات المنصة' },
    { key: 'إرشادات وأمان', label: 'إرشادات وأمان' },
    { key: 'قوانين المجتمع', label: 'قوانين المجتمع' },
    { key: 'بيانات رسمية', label: 'بيانات رسمية' }
  ];

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ posts: PlatformPost[] }>('/news');
      if (res && res.posts) {
        setPosts(res.posts);
      }
    } catch (err) {
      console.error('Failed to load news:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleOpenPost = async (postId: string) => {
    try {
      setDetailLoading(true);
      const res = await apiRequest<{ post: PlatformPost }>(`/news/${postId}`);
      if (res && res.post) {
        setActivePost(res.post);
        // Increment views in local list as well
        setPosts(prev =>
          prev.map(p => (p.id === postId ? { ...p, viewsCount: p.viewsCount + 1 } : p))
        );
      }
    } catch (err) {
      console.error('Failed to load post detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleToggleLike = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      setLikingPostId(postId);
      const res = await apiRequest<{ success: boolean; isLiked: boolean; likesCount: number }>(
        `/news/${postId}/like`,
        { method: 'POST' }
      );

      if (res && res.success) {
        setPosts(prev =>
          prev.map(p =>
            p.id === postId ? { ...p, isLiked: res.isLiked, likesCount: res.likesCount } : p
          )
        );

        if (activePost && activePost.id === postId) {
          setActivePost(prev =>
            prev ? { ...prev, isLiked: res.isLiked, likesCount: res.likesCount } : null
          );
        }
      }
    } catch (err) {
      console.error('Failed to like post:', err);
    } finally {
      setLikingPostId(null);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingPostId(null);
    setNewTitle('');
    setNewContent('');
    setNewCategory('تحديثات المنصة');
    setNewImageUrl('');
    setNewIsPinned(false);
    setErrorMsg('');
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (post: PlatformPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPostId(post.id);
    setNewTitle(post.title);
    setNewContent(post.content);
    setNewCategory(post.category);
    setNewImageUrl(post.imageUrl || '');
    setNewIsPinned(post.isPinned);
    setErrorMsg('');
    setCreateModalOpen(true);
  };

  const handleDeletePost = async (postId: string, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`هل أنت متأكد من حذف المنشور: "${title}"؟`)) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>(`/news/${postId}`, {
        method: 'DELETE'
      });
      if (res && res.success) {
        setSuccessToast('تم حذف المنشور بنجاح');
        setTimeout(() => setSuccessToast(''), 3500);
        if (activePost && activePost.id === postId) {
          setActivePost(null);
        }
        fetchPosts();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر حذف المنشور');
    }
  };

  const handleCreateOrUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      setErrorMsg('يرجى ملء عنوان ومحتوى المنشور');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const payload = {
        title: newTitle.trim(),
        content: newContent.trim(),
        category: newCategory,
        imageUrl: newImageUrl.trim(),
        isPinned: newIsPinned
      };

      if (editingPostId) {
        const res = await apiRequest<{ success: boolean; message: string }>(`/news/${editingPostId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        if (res && res.success) {
          setCreateModalOpen(false);
          setSuccessToast('تم تحديث المنشور بنجاح!');
          setTimeout(() => setSuccessToast(''), 3500);
          fetchPosts();
          if (activePost && activePost.id === editingPostId) {
            handleOpenPost(editingPostId);
          }
        }
      } else {
        const res = await apiRequest<{ success: boolean; postId: string; message: string }>('/news', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        if (res && res.success) {
          setCreateModalOpen(false);
          setSuccessToast('تم نشر الخبر بنجاح في المنصة!');
          setTimeout(() => setSuccessToast(''), 3500);
          fetchPosts();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر حفظ المنشور');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSharePost = (post: PlatformPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.title,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${post.title}\n${window.location.href}`);
      setSuccessToast('تم نسخ رابط المنشور إلى الحافظة!');
      setTimeout(() => setSuccessToast(''), 3000);
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || post.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in" dir="rtl">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 z-50 max-w-md bg-emerald-950/90 border border-emerald-500/80 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold font-tajawal">{successToast}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-950/80 via-neutral-900 to-[#0e1017] border border-amber-500/30 p-4 sm:p-6 md:p-8 shadow-2xl">
        <div className="absolute -top-16 -left-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-700/60 text-amber-300 text-xs font-bold">
              <Megaphone className="w-3.5 h-3.5 text-amber-400" />
              <span>المركز الإعلامي الرسمي</span>
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-cairo font-black text-white flex items-center gap-2.5">
              <span>المنشورات والأخبار</span>
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
            </h1>
            <p className="text-xs sm:text-sm text-neutral-300 font-tajawal max-w-2xl leading-relaxed">
              تابع آخر المستجدات، تحديثات النظام، البيانات الرسمية، وإرشادات الأمان الصادرة مباشرة من إدارة ومالك فضفضه.
            </p>
          </div>

          {/* Owner/Admin Publish Button */}
          {isOwnerOrAdmin && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-cairo font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>نشر خبر جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-4">
        {/* Categories */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelectedCategory(c.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === c.key
                  ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                  : 'bg-neutral-900/80 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في الأخبار والتحديثات..."
            className="w-full bg-[#0b0d14] border border-neutral-800 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="p-12 text-center space-y-3">
          <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 font-tajawal">جاري تحميل الأخبار والمنشورات...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#0c0e16] border border-neutral-800 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-neutral-500 mx-auto">
            <Newspaper className="w-6 h-6" />
          </div>
          <h3 className="font-cairo font-bold text-white text-base">لا توجد منشورات حالياً</h3>
          <p className="text-xs text-neutral-400 font-tajawal max-w-sm mx-auto">
            لم نجد أي منشورات تطابق معايير البحث. تفقّد التحديثات لاحقاً لموافاتك بكل جديد.
          </p>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {filteredPosts.map((post) => {
            const isOwner = isUserOwner({ role: post.authorRole, username: post.authorName });

            return (
              <article
                key={post.id}
                onClick={() => handleOpenPost(post.id)}
                className={`bg-[#0c0e17] border rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-xl hover:border-neutral-700 transition-all duration-300 cursor-pointer group ${
                  post.isPinned
                    ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-[#0c0e17] to-[#0c0e17]'
                    : 'border-neutral-800/90'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Author Bar & Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-neutral-950 font-bold font-cairo shadow-md shrink-0">
                        {post.authorAvatar ? (
                          <img src={post.authorAvatar} alt={post.authorName} className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          '👑'
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-cairo font-bold text-sm text-white group-hover:text-amber-400 transition-colors">
                            {post.authorName}
                          </span>
                          {isOwner && <OwnerBadge size="xs" />}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-tajawal">
                          <span>{new Date(post.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          <span>·</span>
                          <span className="text-amber-400/90 font-semibold">{post.category}</span>
                        </div>
                      </div>
                    </div>

                    {/* Pinned Tag & Views */}
                    <div className="flex items-center gap-2">
                      {post.isPinned && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300">
                          <Pin className="w-3 h-3 text-amber-400" />
                          <span>مثبت</span>
                        </span>
                      )}
                      <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-tajawal px-2 py-1 rounded-lg bg-neutral-900/60">
                        <Eye className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{post.viewsCount} مشاهدة</span>
                      </div>
                    </div>
                  </div>

                  {/* Post Title */}
                  <h2 className="font-cairo font-black text-base sm:text-xl text-white group-hover:text-amber-300 transition-colors leading-snug">
                    {post.title}
                  </h2>

                  {/* Optional Image Banner */}
                  {post.imageUrl && (
                    <div className="relative h-48 sm:h-72 w-full rounded-xl sm:rounded-2xl overflow-hidden bg-neutral-900">
                      <img
                        src={post.imageUrl}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    </div>
                  )}

                  {/* Content Preview */}
                  <p className="text-xs sm:text-sm text-neutral-300 font-tajawal leading-relaxed whitespace-pre-line line-clamp-3">
                    {post.content}
                  </p>

                  {/* Bottom Actions Bar */}
                  <div className="pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs text-neutral-400 font-tajawal">
                    <button
                      onClick={(e) => handleToggleLike(post.id, e)}
                      disabled={likingPostId === post.id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        post.isLiked
                          ? 'bg-rose-950/80 border border-rose-500/60 text-rose-300'
                          : 'bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${post.isLiked ? 'fill-rose-400 text-rose-400' : ''}`} />
                      <span>{post.likesCount} إعجاب</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleSharePost(post, e)}
                        className="p-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                        title="مشاركة المنشور"
                      >
                        <Share2 className="w-4 h-4" />
                      </button>

                      <span className="text-amber-400 hover:text-amber-300 font-bold inline-flex items-center gap-1 text-xs">
                        <span>قراءة المنشور كاملاً</span>
                        <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* FULL POST DETAIL MODAL (Reader View) */}
      {activePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0d0f17] border border-neutral-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-neutral-800 flex items-center justify-between bg-[#0a0c12] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center text-neutral-950 font-bold font-cairo shadow-md">
                  👑
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-cairo font-bold text-sm text-white">
                      {activePost.authorName}
                    </span>
                    {isUserOwner({ role: activePost.authorRole, username: activePost.authorName }) && (
                      <OwnerBadge size="xs" />
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-400 font-tajawal">
                    {new Date(activePost.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })} · {activePost.category}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setActivePost(null)}
                className="p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-5 sm:p-7 overflow-y-auto space-y-5">
              <h1 className="text-lg sm:text-2xl font-cairo font-black text-white leading-tight">
                {activePost.title}
              </h1>

              {activePost.imageUrl && (
                <div className="w-full rounded-2xl overflow-hidden bg-neutral-900 max-h-96">
                  <img
                    src={activePost.imageUrl}
                    alt={activePost.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Full Article Content */}
              <div className="text-xs sm:text-sm text-neutral-200 font-tajawal leading-relaxed whitespace-pre-line space-y-3">
                {activePost.content}
              </div>

              {/* Official Seal / Signature */}
              <div className="pt-4 border-t border-neutral-800/80 p-4 rounded-2xl bg-neutral-900/40 border flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-tajawal text-neutral-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>منشور رسمي معتمد من إدارة منصة فضفضه</span>
                </div>
                <OwnerBadge size="xs" />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-neutral-800/80 bg-[#090b10] flex items-center justify-between gap-3 shrink-0">
              <button
                onClick={() => handleToggleLike(activePost.id)}
                disabled={likingPostId === activePost.id}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activePost.isLiked
                    ? 'bg-rose-950/80 border border-rose-500/60 text-rose-300'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300'
                }`}
              >
                <Heart className={`w-4 h-4 ${activePost.isLiked ? 'fill-rose-400 text-rose-400' : ''}`} />
                <span>{activePost.likesCount} إعجاب</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSharePost(activePost)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-4 h-4" />
                  <span>مشاركة</span>
                </button>

                <button
                  onClick={() => setActivePost(null)}
                  className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POST MODAL (Owner & Admin only) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="relative w-full max-w-lg bg-[#0d0f17] border border-neutral-800 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-amber-400" />
                <h3 className="font-cairo font-bold text-base text-white">نشر خبر رسمي جديد</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
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

            <form onSubmit={handleCreateOrUpdatePost} className="space-y-3.5 text-xs font-tajawal">
              <div>
                <label className="block text-neutral-300 font-bold mb-1">عنوان المنشور *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: إطلاق التحديث الجديد للمحادثات الفورية"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">التصنيف</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="تحديثات المنصة">تحديثات المنصة</option>
                  <option value="إرشادات وأمان">إرشادات وأمان</option>
                  <option value="قوانين المجتمع">قوانين المجتمع</option>
                  <option value="بيانات رسمية">بيانات رسمية</option>
                </select>
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">رابط الصورة (اختياري)</label>
                <input
                  type="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 text-left"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-bold mb-1">نص الخبر / المنشور *</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={6}
                  placeholder="اكتب المحتوى الكامل للمنشور هنا..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl p-3 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={newIsPinned}
                  onChange={(e) => setNewIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-0 focus:ring-offset-0 bg-neutral-900 border-neutral-700"
                />
                <label htmlFor="pinCheck" className="text-neutral-300 font-semibold cursor-pointer select-none">
                  تثبيت هذا المنشور في أعلى الصفحة (Pinned)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-cairo font-bold transition-all shadow-md cursor-pointer"
                >
                  {submitting ? 'جاري النشر...' : 'نشر الخبر'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
