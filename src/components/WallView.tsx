import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Crown,
  DoorOpen,
  Flame,
  Heart,
  ImagePlus,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  addWallComment,
  createWallPost,
  deleteWallPost,
  subscribeToRooms,
  subscribeToWallComments,
  subscribeToWallPosts,
  toggleWallPostLike,
  voteOnWallPoll,
} from '../services/community';
import { getPeerIdFromConversation, getUnreadCountForUser } from '../services/messaging';
import { uploadImageAsset } from '../services/storage';
import { useApp } from '../state/AppContext';
import type { Room, SimpleMessage, WallPost } from '../types/fadfada';
import { formatArabicTime, timestampToMillis } from '../utils/formatters';
import { CHAT_THEMES, displayCountryName, isKnownCountry, sortOnlineUsers, VIP_LABELS } from '../utils/progression';
import { AdSlot } from './AdSlot';
import { Avatar } from './Avatar';
import { MegaphoneBar } from './MegaphoneBar';
import { StoriesBar } from './StoriesBar';
import { EmptyState, FeedbackBanner } from './ui/Primitives';

const WallCommentsSection: React.FC<{ postId: string }> = ({ postId }) => {
  const { profile, openProfileModal } = useApp();
  const [comments, setComments] = useState<SimpleMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToWallComments(postId, setComments);
    return () => unsub();
  }, [postId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !text.trim()) return;
    setSending(true);
    setCommentError(null);
    try {
      await addWallComment(postId, profile, text);
      setText('');
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'تعذر إضافة التعليق.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-white/10 space-y-2 fadfada-enter">
      <div className="space-y-1.5 max-h-52 overflow-y-auto fadfada-scroll">
        {comments.length === 0 ? (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            لا توجد تعليقات بعد. كن أول من يرد.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2 text-xs">
              <button
                type="button"
                onClick={() => openProfileModal(c.senderId)}
                className="shrink-0 cursor-pointer"
              >
                <Avatar src={c.senderAvatar} name={c.senderName} size="xs" />
              </button>
              <div className="flex-1 min-w-0 bg-[#F2F4F7] dark:bg-[#0B1114] rounded-md px-2.5 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openProfileModal(c.senderId)}
                    className="font-bold text-slate-900 dark:text-slate-100 hover:underline cursor-pointer"
                  >
                    {c.senderName}
                  </button>
                  <span className="text-[10px] font-mono tabular-nums text-slate-400">
                    {formatArabicTime(c.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {c.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {commentError && <FeedbackBanner type="error" message={commentError} />}

      <form onSubmit={handleAdd} className="flex items-center gap-1.5">
        <input
          type="text"
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب تعليقًا..."
          className="flex-1 min-h-[34px] px-3 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-xs focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="min-h-[34px] px-3 rounded-md bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
        >
          <Send className="w-3.5 h-3.5 -scale-x-100" />
          <span>رد</span>
        </button>
      </form>
    </div>
  );
};

export const WallView: React.FC = () => {
  const {
    authUser,
    profile,
    users,
    usersById,
    conversations,
    shoutouts,
    isStaff,
    isPeerOnline,
    getPeerLastSeenMillis,
    openProfileModal,
    openChatWith,
    setActiveSection,
  } = useApp();

  const [posts, setPosts] = useState<WallPost[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCommentsFor, setOpenCommentsFor] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const u1 = subscribeToWallPosts(setPosts);
    const u2 = subscribeToRooms(setRooms);
    return () => {
      u1();
      u2();
    };
  }, []);

  const onlineMembers = useMemo(
    () =>
      sortOnlineUsers(
        users.filter((u) => u.uid !== profile?.uid && isPeerOnline(u, isStaff)),
        profile,
        (u) => isPeerOnline(u, isStaff),
        getPeerLastSeenMillis
      ).slice(0, 20),
    [users, profile, isPeerOnline, getPeerLastSeenMillis, isStaff]
  );

  const onlineTotalCount = useMemo(
    () => users.filter((u) => isPeerOnline(u, isStaff)).length,
    [users, isPeerOnline, isStaff]
  );

  const activeRoomsPreview = useMemo(
    () => [...rooms].sort((a, b) => b.activeCount - a.activeCount).slice(0, 6),
    [rooms]
  );

  const recentConversations = useMemo(() => {
    if (!authUser) return [];
    return conversations
      .filter((c) => !(c.archivedBy ?? []).includes(authUser.uid))
      .slice(0, 5);
  }, [authUser, conversations]);

  if (!profile) return null;

  const enterRoomDirect = (roomId: string) => {
    try {
      sessionStorage.setItem('fadfada_pending_room', roomId);
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent('fadfada:enter-room', { detail: roomId }));
    setActiveSection('rooms');
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview('');
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPosting(true);
    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadImageAsset('wall', profile.uid, imageFile);
      }
      await createWallPost(profile, {
        text,
        imageUrl,
        pollQuestion: showPollBuilder ? pollQuestion : '',
        pollOptions: showPollBuilder ? pollOptions : [],
      });
      setText('');
      setImageFile(null);
      setImagePreview('');
      setShowPollBuilder(false);
      setPollQuestion('');
      setPollOptions(['', '']);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر نشر المنشور.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto fadfada-scroll p-2.5 sm:p-3.5 pb-20 md:pb-5">
      <div className="max-w-6xl mx-auto space-y-2.5">
        {/* Mobile Megaphone Strip */}
        <div className="md:hidden">
          <MegaphoneBar compact />
        </div>

        {/* 1. Live Online Users Strip (Avatar + online dot + username + status, no nested boxes) */}
        <section className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
              <h2 className="font-display text-xs font-bold text-slate-900 dark:text-slate-50 truncate">
                المتواجدون الآن ({onlineTotalCount})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('online')}
              className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              كل المتواجدين
            </button>
          </div>

          {onlineMembers.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-1.5">
              لا يوجد أعضاء آخرون متصلون حاليًا — تصفح دليل الأعضاء للمحادثة.
            </p>
          ) : (
            <div className="flex items-center gap-3 overflow-x-auto pt-2 pb-0.5 fadfada-scroll">
              {onlineMembers.map((u) => (
                <div
                  key={u.uid}
                  className="shrink-0 flex items-center gap-1.5 pl-2 border-l border-slate-100 dark:border-white/5 last:border-l-0 last:pl-0"
                >
                  <button
                    type="button"
                    onClick={() => openProfileModal(u.uid)}
                    className="flex items-center gap-2 text-right cursor-pointer min-w-0 group"
                  >
                    <Avatar
                      src={u.avatar}
                      name={u.displayName}
                      size="sm"
                      frameId={u.frameId}
                      isOnline
                      showPresence
                    />
                    <div className="min-w-0 max-w-[96px]">
                      <p
                        className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate group-hover:underline"
                        style={u.nameColor ? { color: u.nameColor } : undefined}
                      >
                        {u.displayName}
                      </p>
                      <p className="text-[10px] text-[#0B7A62] dark:text-[#34D399] truncate">
                        {isKnownCountry(u.country) ? `${u.countryFlag} ${u.country}` : 'متصل الآن'}
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => openChatWith(u.uid)}
                    aria-label={`محادثة ${u.displayName}`}
                    title={`مراسلة ${u.displayName}`}
                    className="min-h-[28px] min-w-[28px] rounded-md text-[#0B7A62] dark:text-[#34D399] hover:bg-[#E6F4F0] dark:hover:bg-[#14332C] flex items-center justify-center cursor-pointer shrink-0 transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 2. Mobile Active Rooms Strip (7rkchat-style horizontal/compact community list) */}
        <section className="lg:hidden bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg px-3 py-2">
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-1.5">
              <DoorOpen className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
              <h2 className="font-display text-xs font-bold text-slate-900 dark:text-slate-50">
                الغرف النشطة ({rooms.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('rooms')}
              className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399] hover:underline cursor-pointer"
            >
              كل الغرف
            </button>
          </div>
          {activeRoomsPreview.length === 0 ? (
            <button
              type="button"
              onClick={() => setActiveSection('rooms')}
              className="w-full py-2 text-xs text-[#0B7A62] dark:text-[#34D399] font-semibold cursor-pointer"
            >
              دخول أو إنشاء غرفة دردشة
            </button>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pt-2 pb-0.5 fadfada-scroll">
              {activeRoomsPreview.map((r) => {
                const rt = CHAT_THEMES[r.theme] ?? CHAT_THEMES.emerald;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => enterRoomDirect(r.id)}
                    className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#F2F4F7] dark:bg-[#18242B] border border-slate-200/70 dark:border-white/10 text-right cursor-pointer"
                  >
                    <span
                      className={`w-7 h-7 rounded-md ${rt.accent} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                    >
                      {r.name.slice(0, 1)}
                    </span>
                    <div className="min-w-0 max-w-[130px]">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                          {r.name}
                        </span>
                        {r.isOfficial && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                      <p className="text-[10px] font-mono tabular-nums text-[#0B7A62] dark:text-[#34D399]">
                        {r.activeCount} متصل
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Main Chat Community Grid: Feed/Stories + Rooms/Online/Active Chats */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
          {/* Center Stream: Stories + Composer + Connected Social Wall */}
          <div className="lg:col-span-8 space-y-2.5 min-w-0">
            <section className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg divide-y divide-slate-200/70 dark:divide-white/8">
              <div id="wall-stories" className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="font-display text-xs font-bold text-slate-900 dark:text-slate-50">
                    القصص الآن
                  </h2>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    24 ساعة
                  </span>
                </div>
                <StoriesBar />
              </div>

              <form onSubmit={handlePublish} className="px-3 py-2.5 space-y-2">
                <div className="flex items-start gap-2">
                  <Avatar
                    src={profile.avatar}
                    name={profile.displayName}
                    size="sm"
                    frameId={profile.frameId}
                  />
                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={`شارك ما يدور في بالك الآن يا ${profile.displayName}...`}
                    className="flex-1 p-2 rounded-md border border-slate-200/80 dark:border-white/10 bg-[#F2F4F7] dark:bg-[#0B1114] text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#0B7A62]"
                  />
                </div>

                {imagePreview && (
                  <div className="relative rounded-md overflow-hidden border border-slate-200 dark:border-white/10 max-h-60">
                    <img
                      src={imagePreview}
                      alt="معاينة الصورة"
                      className="w-full max-h-60 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setImagePreview('');
                      }}
                      aria-label="إزالة الصورة"
                      className="absolute top-2 left-2 min-h-[30px] min-w-[30px] flex items-center justify-center rounded-full bg-black/65 text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {showPollBuilder && (
                  <div className="p-2.5 rounded-md bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/80 dark:border-white/10 space-y-2 fadfada-enter">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        استطلاع رأي
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowPollBuilder(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                    <input
                      type="text"
                      maxLength={200}
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="سؤال الاستطلاع..."
                      className="w-full min-h-[34px] px-3 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121B20] text-xs"
                    />
                    {pollOptions.map((opt, idx) => (
                      <input
                        key={idx}
                        type="text"
                        maxLength={80}
                        value={opt}
                        onChange={(e) =>
                          setPollOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                        }
                        placeholder={`الخيار ${idx + 1}`}
                        className="w-full min-h-[32px] px-3 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121B20] text-xs"
                      />
                    ))}
                    {pollOptions.length < 4 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions((prev) => [...prev, ''])}
                        className="text-xs font-semibold text-[#0B7A62] dark:text-[#34D399] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة خيار</span>
                      </button>
                    )}
                  </div>
                )}

                {error && <FeedbackBanner type="error" message={error} />}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className="min-h-[32px] px-2.5 rounded-md border border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors">
                      <ImagePlus className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
                      <span>صورة</span>
                      <input type="file" accept="image/*" onChange={handleImagePick} className="hidden" />
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPollBuilder((p) => !p)}
                      className={`min-h-[32px] px-2.5 rounded-md border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                        showPollBuilder
                          ? 'border-[#0B7A62] bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399]'
                          : 'border-slate-200/80 dark:border-white/10 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B]'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>استطلاع</span>
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={posting || (!text.trim() && !imageFile && !showPollBuilder)}
                    className="min-h-[34px] px-4 rounded-md bg-[#0B7A62] hover:bg-[#08614D] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 -scale-x-100" />
                    <span>{posting ? 'جاري النشر...' : 'نشر'}</span>
                  </button>
                </div>
              </form>
            </section>

            <AdSlot slot="feed_inline" />

            {/* Connected Social Wall Stream */}
            <div id="wall-feed">
              {posts.length === 0 ? (
                <EmptyState
                  icon={<Flame className="w-5 h-5" />}
                  title="الحائط بانتظار أول مشاركة"
                  description="شارك خاطرة أو صورة أو استطلاع رأي مع المتواجدين الآن."
                />
              ) : (
                <div className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg divide-y divide-slate-200/75 dark:divide-white/8">
                  {posts.map((post) => {
                    const isLiked = post.likedBy.includes(profile.uid);
                    const myVote = post.pollVoters?.[profile.uid];
                    const totalVotes = (post.pollOptions ?? []).reduce((s, o) => s + o.votes, 0);
                    const vipInfo = VIP_LABELS[post.authorVip as keyof typeof VIP_LABELS];
                    const author = usersById[post.authorId];
                    const authorOnline = author ? isPeerOnline(author, isStaff) : false;

                    return (
                      <article key={post.id} className="p-3 sm:p-3.5 space-y-2 fadfada-enter">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openProfileModal(post.authorId)}
                            className="flex items-center gap-2.5 text-right cursor-pointer min-w-0"
                          >
                            <Avatar
                              src={post.authorAvatar}
                              name={post.authorName}
                              size="sm"
                              frameId={author?.frameId}
                              isOnline={authorOnline}
                              showPresence={Boolean(author)}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-50 truncate hover:underline"
                                  style={author?.nameColor ? { color: author.nameColor } : undefined}
                                >
                                  {post.authorName}
                                </span>
                                {vipInfo && post.authorVip !== 'none' && (
                                  <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                    · {vipInfo.label}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                                {author?.countryFlag && <span>{author.countryFlag}</span>}
                                <span>·</span>
                                <span className="font-mono tabular-nums">
                                  {formatArabicTime(post.createdAt)}
                                </span>
                              </div>
                            </div>
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            {post.authorId !== profile.uid && (
                              <button
                                type="button"
                                onClick={() => openChatWith(post.authorId)}
                                aria-label={`محادثة ${post.authorName}`}
                                title="محادثة خاصة"
                                className="min-h-[30px] min-w-[30px] flex items-center justify-center rounded-md text-[#0B7A62] dark:text-[#34D399] hover:bg-[#E6F4F0] dark:hover:bg-[#14332C] transition-colors cursor-pointer"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(post.authorId === profile.uid || isStaff) && (
                              <button
                                type="button"
                                onClick={async () => {
                                  setError(null);
                                  try {
                                    await deleteWallPost(post.id);
                                  } catch (err) {
                                    setError(err instanceof Error ? err.message : 'تعذر حذف المنشور.');
                                  }
                                }}
                                aria-label="حذف المنشور"
                                className="min-h-[30px] min-w-[30px] flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {post.text && (
                          <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {post.text}
                          </p>
                        )}

                        {post.imageUrl && (
                          <img
                            src={post.imageUrl}
                            alt="صورة المنشور"
                            referrerPolicy="no-referrer"
                            className="w-full max-h-[420px] object-cover rounded-md border border-slate-200/80 dark:border-white/10"
                          />
                        )}

                        {post.pollOptions && post.pollOptions.length >= 2 && (
                          <div className="p-2.5 rounded-md bg-[#F2F4F7] dark:bg-[#0B1114] border border-slate-200/80 dark:border-white/10 space-y-1.5">
                            {post.pollQuestion && (
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-50">
                                {post.pollQuestion}
                              </p>
                            )}
                            <div className="space-y-1">
                              {post.pollOptions.map((opt) => {
                                const pct =
                                  totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                                const isChosen = myVote === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    disabled={Boolean(myVote)}
                                    onClick={async () => {
                                      setError(null);
                                      try {
                                        await voteOnWallPoll(post.id, opt.id, profile.uid);
                                      } catch (err) {
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : 'تعذر التصويت في الاستطلاع.'
                                        );
                                      }
                                    }}
                                    className={`w-full min-h-[34px] relative overflow-hidden px-3 py-1 rounded-md border text-right text-xs transition-colors ${
                                      isChosen
                                        ? 'border-[#0B7A62] bg-[#E6F4F0]/60 dark:bg-[#14332C]/50'
                                        : 'border-slate-200 dark:border-white/10 bg-white dark:bg-[#121B20]'
                                    } ${
                                      myVote ? 'cursor-default' : 'hover:border-[#0B7A62] cursor-pointer'
                                    }`}
                                  >
                                    <div
                                      className="absolute inset-y-0 right-0 bg-[#0B7A62]/15 dark:bg-[#10B981]/20 transition-all duration-300"
                                      style={{ width: myVote ? `${pct}%` : '0%' }}
                                    />
                                    <div className="relative flex items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                                        {opt.label}
                                      </span>
                                      {myVote && (
                                        <span className="font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300 shrink-0">
                                          {pct}% ({opt.votes})
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono tabular-nums">
                              إجمالي الأصوات: {totalVotes}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center gap-2 pt-0.5 text-xs text-slate-600 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={async () => {
                              setError(null);
                              try {
                                await toggleWallPostLike(post, profile.uid);
                              } catch (err) {
                                setError(err instanceof Error ? err.message : 'تعذر تحديث الإعجاب.');
                              }
                            }}
                            className={`min-h-[30px] px-2 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer ${
                              isLiked
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-semibold'
                                : 'hover:bg-[#F2F4F7] dark:hover:bg-[#18242B]'
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                            <span className="font-mono tabular-nums">{post.likesCount}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setOpenCommentsFor((prev) => ({ ...prev, [post.id]: !prev[post.id] }))
                            }
                            className={`min-h-[30px] px-2 rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer ${
                              openCommentsFor[post.id]
                                ? 'bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] font-semibold'
                                : 'hover:bg-[#F2F4F7] dark:hover:bg-[#18242B]'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="font-mono tabular-nums">{post.commentsCount} تعليق</span>
                          </button>
                        </div>

                        {openCommentsFor[post.id] && <WallCommentsSection postId={post.id} />}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Live Community Column (Rooms + Active Chats + Online Users + Recent Shoutouts) */}
          <aside className="hidden lg:flex lg:col-span-4 flex-col gap-2.5 sticky top-0">
            {/* 1. Chat Rooms List (7rkchat-style: Avatar + Room Name + Online Count) */}
            <section className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-display text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                  <DoorOpen className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
                  <span>الغرف النشطة ({rooms.length})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSection('rooms')}
                  className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399] hover:underline cursor-pointer"
                >
                  عرض الكل
                </button>
              </div>

              {activeRoomsPreview.length === 0 ? (
                <p className="p-3 text-xs text-slate-400 dark:text-slate-500">
                  لا توجد غرف نشطة بعد.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/65 dark:divide-white/8">
                  {activeRoomsPreview.map((r) => {
                    const rt = CHAT_THEMES[r.theme] ?? CHAT_THEMES.emerald;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => enterRoomDirect(r.id)}
                        className="w-full px-3 py-2 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] flex items-center justify-between gap-2 text-right transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-8 h-8 rounded-full ${rt.accent} text-white text-xs font-bold flex items-center justify-center shrink-0`}
                          >
                            {r.name.slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                                {r.name}
                              </p>
                              {r.isOfficial && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {r.category} · {r.activeCount > 0 ? 'نشطة الآن' : 'مفتوحة'}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono tabular-nums text-[11px] font-bold text-[#0B7A62] dark:text-[#34D399] shrink-0">
                          {r.activeCount} متصل
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 2. Active Private Conversations (Chat-first presence right on Home) */}
            <section className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-display text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
                  <span>المحادثات النشطة</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSection('chats')}
                  className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399] hover:underline cursor-pointer"
                >
                  صندوق الرسائل
                </button>
              </div>

              {recentConversations.length === 0 ? (
                <p className="p-3 text-xs text-slate-400 dark:text-slate-500">
                  ابدأ محادثة خاصة من قائمة المتواجدين الآن.
                </p>
              ) : (
                <div className="divide-y divide-slate-200/65 dark:divide-white/8">
                  {recentConversations.map((conv) => {
                    const peerId = authUser ? getPeerIdFromConversation(conv, authUser.uid) : '';
                    const peer = usersById[peerId];
                    const online = peer ? isPeerOnline(peer) : false;
                    const unread = authUser ? getUnreadCountForUser(conv, authUser.uid) : 0;
                    const tMs =
                      timestampToMillis(conv.lastMessageAt) || timestampToMillis(conv.updatedAt);

                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => peerId && openChatWith(peerId)}
                        className="w-full px-3 py-2 hover:bg-[#F2F4F7] dark:hover:bg-[#18242B] flex items-center gap-2.5 text-right transition-colors cursor-pointer"
                      >
                        <Avatar
                          src={peer?.avatar}
                          name={peer?.displayName ?? 'مستخدم'}
                          size="sm"
                          frameId={peer?.frameId}
                          isOnline={online}
                          showPresence
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {peer?.displayName ?? 'مستخدم'}
                            </span>
                            <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                              {formatArabicTime(tMs)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {conv.lastMessageText || 'ابدأ الحديث'}
                            </span>
                            {unread > 0 && (
                              <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-mono tabular-nums flex items-center justify-center shrink-0">
                                {unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. Compact Online Users List */}
            <section className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-200/70 dark:border-white/10 flex items-center justify-between">
                <h3 className="font-display text-xs font-bold text-slate-900 dark:text-slate-50 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
                  <span>المتصلون الآن ({onlineTotalCount})</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveSection('online')}
                  className="text-[11px] font-semibold text-[#0B7A62] dark:text-[#34D399] hover:underline cursor-pointer"
                >
                  عرض الكل
                </button>
              </div>

              {onlineMembers.length === 0 ? (
                <p className="p-3 text-xs text-slate-400 dark:text-slate-500">
                  لا يوجد أعضاء متصلون حاليًا.
                </p>
              ) : (
                <ul className="divide-y divide-slate-200/65 dark:divide-white/8">
                  {onlineMembers.slice(0, 6).map((u) => (
                    <li
                      key={u.uid}
                      className="px-3 py-1.5 flex items-center justify-between gap-2 hover:bg-[#F2F4F7]/60 dark:hover:bg-[#18242B]/60 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => openProfileModal(u.uid)}
                        className="flex items-center gap-2 min-w-0 flex-1 text-right cursor-pointer"
                      >
                        <Avatar
                          src={u.avatar}
                          name={u.displayName}
                          size="xs"
                          frameId={u.frameId}
                          isOnline
                          showPresence
                        />
                        <div className="min-w-0">
                          <p
                            className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate"
                            style={u.nameColor ? { color: u.nameColor } : undefined}
                          >
                            {u.displayName}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {displayCountryName(u.country, u.countryFlag)} · متصل الآن
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => openChatWith(u.uid)}
                        aria-label={`محادثة ${u.displayName}`}
                        className="min-h-[28px] min-w-[28px] rounded-md bg-[#E6F4F0] dark:bg-[#14332C] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center hover:opacity-90 shrink-0 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 4. Recent Community Activity (Live Shoutouts) */}
            {shoutouts.length > 0 && (
              <section className="bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 rounded-lg overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200/70 dark:border-white/10 flex items-center gap-1.5">
                  <Megaphone className="w-3.5 h-3.5 text-[#0B7A62] dark:text-[#34D399]" />
                  <h3 className="font-display text-xs font-bold text-slate-900 dark:text-slate-50">
                    آخر نداءات المجتمع
                  </h3>
                </div>
                <ul className="divide-y divide-slate-200/65 dark:divide-white/8">
                  {shoutouts.slice(0, 3).map((s) => (
                    <li key={s.id} className="px-3 py-2 text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {s.authorName}:{' '}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">{s.text}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <AdSlot slot="sidebar_card" />
          </aside>
        </div>
      </div>
    </div>
  );
};
