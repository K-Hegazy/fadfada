import { APPWRITE_CONFIG, ID, Permission, Query, Role } from '../appwrite/config';
import { subscribeToTableRows } from '../appwrite/realtime';
import {
  createTableRow,
  deleteTableRow,
  executeAppwriteFunction,
  getTableRow,
  normalizeAppDate,
  parseJsonField,
  serializeJsonField,
  updateTableRow,
  type AppwriteRow,
} from '../appwrite/tables';
import type {
  CreatorProposal,
  MessageType,
  PollOption,
  Room,
  Secret,
  SimpleMessage,
  Story,
  UserProfile,
  WallPost,
} from '../types/fadfada';
import { timestampToMillis } from '../utils/formatters';
import { awardActivityXp } from './profiles';

// ============================================================================
// 1. Rooms & Group Chat
// ============================================================================
export async function ensureOfficialRooms(_ownerUid?: string, _ownerName?: string): Promise<void> {
  try {
    await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'ensureOfficialRooms');
  } catch {
    // Non-blocking if non-staff
  }
}

export function subscribeToRooms(onUpdate: (rooms: Room[]) => void): () => void {
  return subscribeToTableRows<Room>({
    tableId: APPWRITE_CONFIG.tables.rooms,
    queries: [Query.limit(100)],
    mapRow: (row) => ({
      id: String(row.$id),
      name: String(row.name || ''),
      description: String(row.description || ''),
      category: String(row.category || 'عام'),
      isOfficial: Boolean(row.isOfficial),
      ownerId: String(row.ownerId || ''),
      ownerName: String(row.ownerName || ''),
      theme: String(row.theme || 'emerald'),
      pinnedMessage: String(row.pinnedMessage || ''),
      memberIds: Array.isArray(row.memberIds) ? (row.memberIds as string[]) : [],
      activeCount: Number(row.activeCount ?? 0),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    sort: (a, b) => Number(b.isOfficial) - Number(a.isOfficial),
    onData: onUpdate,
  });
}

export async function createMemberRoom(
  _owner: UserProfile,
  input: { name: string; description: string; category: string; theme: string },
  _creationCost: number
): Promise<string> {
  const res = await executeAppwriteFunction<{ roomId: string }>(
    APPWRITE_CONFIG.economyFunctionId,
    'createMemberRoom',
    {
      name: input.name,
      description: input.description,
      category: input.category,
      theme: input.theme,
    }
  );
  return res.roomId;
}

export async function joinRoom(roomId: string, _uid?: string): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'joinRoom', { roomId });
}

export async function leaveRoom(roomId: string, _uid?: string): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'leaveRoom', { roomId });
}

export async function updateRoomMeta(
  roomId: string,
  updates: { pinnedMessage?: string; theme?: string }
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'updateRoomMeta', {
    roomId,
    ...updates,
  });
}

export async function deleteRoomAsOwner(roomId: string): Promise<{
  ok: boolean;
  deletedRoomId: string;
  deletedMessagesCount: number;
  deletedFilesCount: number;
}> {
  return await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'deleteRoomAsOwner', {
    roomId,
  });
}

export function subscribeToRoomMessages(
  roomId: string,
  onUpdate: (messages: SimpleMessage[]) => void
): () => void {
  return subscribeToTableRows<SimpleMessage>({
    tableId: APPWRITE_CONFIG.tables.roomMessages,
    queries: [Query.equal('roomId', roomId), Query.orderDesc('$createdAt'), Query.limit(120)],
    mapRow: (row) => ({
      id: String(row.$id),
      roomId: String(row.roomId || ''),
      senderId: String(row.senderId || ''),
      senderName: String(row.senderName || ''),
      senderAvatar: String(row.senderAvatar || ''),
      senderVip: String(row.senderVip || 'none'),
      type: (row.type as MessageType) || 'text',
      text: String(row.text || ''),
      mediaUrl: String(row.mediaUrl || ''),
      replyToId: String(row.replyToId || ''),
      replyToText: String(row.replyToText || ''),
      reactions: parseJsonField<Record<string, string[]>>(row.reactionsJson ?? row.reactions, {}),
      editedAt: normalizeAppDate(row, 'editedAt'),
      isDeleted: Boolean(row.isDeleted),
      voiceDurationSec: Number(row.voiceDurationSec ?? 0),
      isViewOnce: Boolean(row.isViewOnce),
      viewOnceViewedBy: Array.isArray(row.viewOnceViewedBy) ? (row.viewOnceViewedBy as string[]) : [],
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (m) => m.roomId === roomId,
    sort: (a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt),
    onData: onUpdate,
  });
}

export interface SendRoomMessageOptions {
  type?: MessageType;
  mediaUrl?: string;
  replyToId?: string;
  replyToText?: string;
  voiceDurationSec?: number;
  isViewOnce?: boolean;
}

export async function sendRoomMessage(
  roomId: string,
  sender: UserProfile,
  text: string,
  _guestDailyLimit = 0,
  options: SendRoomMessageOptions = {}
): Promise<void> {
  const clean = text.trim();
  if (!clean || clean.length > 1200) throw new Error('نص الرسالة غير صالح.');
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'sendRoomMessage', {
    roomId,
    text: clean,
    type: options.type ?? 'text',
    mediaUrl: options.mediaUrl ?? '',
    replyToId: options.replyToId ?? '',
    replyToText: options.replyToText ?? '',
    voiceDurationSec: options.voiceDurationSec ?? 0,
    isViewOnce: Boolean(options.isViewOnce),
  });
  if (sender.role !== 'guest' && !sender.isAnonymous) {
    void awardActivityXp(sender.uid, sender.xp, 5);
  }
}

export async function editRoomMessage(messageId: string, text: string): Promise<void> {
  const clean = text.trim();
  if (!clean || clean.length > 1200) throw new Error('نص الرسالة غير صالح.');
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'editRoomMessage', {
    messageId,
    text: clean,
  });
}

export async function deleteRoomMessage(messageId: string): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'deleteRoomMessage', {
    messageId,
  });
}

export async function toggleRoomMessageReaction(messageId: string, emoji: string): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'toggleRoomMessageReaction', {
    messageId,
    emoji,
  });
}

export async function consumeRoomViewOnce(
  messageId: string
): Promise<{ mediaUrl: string; type: MessageType }> {
  return await executeAppwriteFunction<{ mediaUrl: string; type: MessageType }>(
    APPWRITE_CONFIG.economyFunctionId,
    'consumeRoomViewOnce',
    { messageId }
  );
}

// ============================================================================
// 2. Stories (24h)
// ============================================================================
export function subscribeToStories(onUpdate: (stories: Story[]) => void): () => void {
  return subscribeToTableRows<Story>({
    tableId: APPWRITE_CONFIG.tables.stories,
    queries: [Query.orderDesc('$createdAt'), Query.limit(100)],
    mapRow: (row) => ({
      id: String(row.$id),
      authorId: String(row.authorId || ''),
      authorName: String(row.authorName || ''),
      authorAvatar: String(row.authorAvatar || ''),
      type: (row.type as Story['type']) || 'text',
      text: String(row.text || ''),
      mediaUrl: String(row.mediaUrl || ''),
      bgColor: String(row.bgColor || '#0D7A5F'),
      viewerIds: Array.isArray(row.viewerIds) ? (row.viewerIds as string[]) : [],
      expiresAt: Number(row.expiresAt ?? 0),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (s) => s.expiresAt > Date.now(),
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function createStory(
  author: UserProfile,
  input: { type: 'text' | 'image' | 'video'; text: string; mediaUrl: string; bgColor: string }
): Promise<void> {
  await createTableRow(
    APPWRITE_CONFIG.tables.stories,
    ID.unique(),
    {
      authorId: author.uid,
      authorName: author.displayName,
      authorAvatar: author.avatar,
      type: input.type,
      text: input.text.trim().slice(0, 500),
      mediaUrl: input.mediaUrl.trim().slice(0, 800),
      bgColor: input.bgColor || '#0D7A5F',
      viewerIds: [author.uid],
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.user(author.uid)),
    ]
  );
  void awardActivityXp(author.uid, author.xp, 10);
}

export async function markStoryViewed(storyId: string, viewerUid: string): Promise<void> {
  try {
    const row = await getTableRow(APPWRITE_CONFIG.tables.stories, storyId);
    if (!row) return;
    const current = Array.isArray(row.viewerIds) ? (row.viewerIds as string[]) : [];
    if (!current.includes(viewerUid)) {
      await updateTableRow(APPWRITE_CONFIG.tables.stories, storyId, {
        viewerIds: [...current, viewerUid],
      });
    }
  } catch {
    // Silent non-blocking
  }
}

export async function deleteStory(storyId: string): Promise<void> {
  try {
    await deleteTableRow(APPWRITE_CONFIG.tables.stories, storyId);
  } catch {
    await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'deleteContentAsStaff', {
      tableKey: 'stories',
      rowId: storyId,
    });
  }
}

// ============================================================================
// 3. Wall Posts, Polls & Comments
// ============================================================================
function mapWallPostRow(row: AppwriteRow): WallPost {
  return {
    id: String(row.$id),
    authorId: String(row.authorId || ''),
    authorName: String(row.authorName || ''),
    authorAvatar: String(row.authorAvatar || ''),
    authorVip: String(row.authorVip || 'none'),
    text: String(row.text || ''),
    imageUrl: String(row.imageUrl || ''),
    pollQuestion: String(row.pollQuestion || ''),
    pollOptions: parseJsonField<PollOption[]>(row.pollOptionsJson ?? row.pollOptions, []),
    pollVoters: parseJsonField<Record<string, string>>(row.pollVotersJson ?? row.pollVoters, {}),
    likedBy: Array.isArray(row.likedBy) ? (row.likedBy as string[]) : [],
    likesCount: Number(row.likesCount ?? 0),
    commentsCount: Number(row.commentsCount ?? 0),
    createdAt: normalizeAppDate(row, 'createdAt'),
  };
}

export function subscribeToWallPosts(onUpdate: (posts: WallPost[]) => void): () => void {
  return subscribeToTableRows<WallPost>({
    tableId: APPWRITE_CONFIG.tables.wallPosts,
    queries: [Query.orderDesc('$createdAt'), Query.limit(60)],
    mapRow: mapWallPostRow,
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function createWallPost(
  author: UserProfile,
  input: {
    text: string;
    imageUrl?: string;
    pollQuestion?: string;
    pollOptions?: string[];
  }
): Promise<void> {
  const cleanText = input.text.trim();
  const cleanQuestion = (input.pollQuestion ?? '').trim();
  const cleanOptions: PollOption[] = (input.pollOptions ?? [])
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((label, idx) => ({ id: `opt_${idx + 1}`, label, votes: 0 }));

  if (!cleanText && !input.imageUrl && cleanOptions.length < 2) {
    throw new Error('اكتب منشورًا أو أضف صورة أو استطلاع رأي.');
  }

  await createTableRow(
    APPWRITE_CONFIG.tables.wallPosts,
    ID.unique(),
    {
      authorId: author.uid,
      authorName: author.displayName,
      authorAvatar: author.avatar,
      authorVip: author.vipTier,
      text: cleanText.slice(0, 2000),
      imageUrl: (input.imageUrl ?? '').slice(0, 800),
      pollQuestion: cleanQuestion.slice(0, 200),
      pollOptionsJson: serializeJsonField(cleanOptions),
      pollVotersJson: '{}',
      likedBy: [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.user(author.uid)),
    ]
  );
  void awardActivityXp(author.uid, author.xp, 12);
}

export async function toggleWallPostLike(post: WallPost, uid: string): Promise<void> {
  const liked = post.likedBy ?? [];
  const next = liked.includes(uid) ? liked.filter((id) => id !== uid) : [...liked, uid];
  await updateTableRow(APPWRITE_CONFIG.tables.wallPosts, post.id, {
    likedBy: next,
    likesCount: next.length,
  });
}

export async function voteOnWallPoll(
  postId: string,
  optionId: string,
  _uid: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'voteOnWallPoll', {
    postId,
    optionId,
  });
}

export function subscribeToWallComments(
  postId: string,
  onUpdate: (comments: SimpleMessage[]) => void
): () => void {
  return subscribeToTableRows<SimpleMessage>({
    tableId: APPWRITE_CONFIG.tables.wallComments,
    queries: [Query.equal('postId', postId), Query.limit(50)],
    mapRow: (row) => ({
      id: String(row.$id),
      postId: String(row.postId || ''),
      senderId: String(row.senderId || ''),
      senderName: String(row.senderName || ''),
      senderAvatar: String(row.senderAvatar || ''),
      text: String(row.text || ''),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (c) => c.postId === postId,
    sort: (a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt),
    onData: onUpdate,
  });
}

export async function addWallComment(
  postId: string,
  author: UserProfile,
  text: string
): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  await createTableRow(
    APPWRITE_CONFIG.tables.wallComments,
    ID.unique(),
    {
      postId,
      senderId: author.uid,
      senderName: author.displayName,
      senderAvatar: author.avatar,
      text: clean.slice(0, 1000),
      createdAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.users()),
      Permission.delete(Role.user(author.uid)),
    ]
  );

  const post = await getTableRow(APPWRITE_CONFIG.tables.wallPosts, postId);
  if (post) {
    await updateTableRow(APPWRITE_CONFIG.tables.wallPosts, postId, {
      commentsCount: Number(post.commentsCount ?? 0) + 1,
    });
  }
  void awardActivityXp(author.uid, author.xp, 5);
}

export async function deleteWallPost(postId: string): Promise<void> {
  try {
    await deleteTableRow(APPWRITE_CONFIG.tables.wallPosts, postId);
  } catch {
    await executeAppwriteFunction(APPWRITE_CONFIG.adminFunctionId, 'deleteContentAsStaff', {
      tableKey: 'wallPosts',
      rowId: postId,
    });
  }
}

// ============================================================================
// 4. Creators Hub
// ============================================================================
export function subscribeToCreatorProposals(
  onUpdate: (proposals: CreatorProposal[]) => void
): () => void {
  return subscribeToTableRows<CreatorProposal>({
    tableId: APPWRITE_CONFIG.tables.creatorProposals,
    queries: [Query.orderDesc('$createdAt'), Query.limit(60)],
    mapRow: (row) => ({
      id: String(row.$id),
      authorId: String(row.authorId || ''),
      authorName: String(row.authorName || ''),
      authorAvatar: String(row.authorAvatar || ''),
      category: String(row.category || ''),
      title: String(row.title || ''),
      description: String(row.description || ''),
      status: (row.status as CreatorProposal['status']) || 'pending',
      adminReply: String(row.adminReply || ''),
      badgeDurationDays: Number(row.badgeDurationDays ?? 0),
      likedBy: Array.isArray(row.likedBy) ? (row.likedBy as string[]) : [],
      likesCount: Number(row.likesCount ?? 0),
      commentsCount: Number(row.commentsCount ?? 0),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function submitCreatorProposal(
  author: UserProfile,
  input: { category: string; title: string; description: string }
): Promise<void> {
  await createTableRow(
    APPWRITE_CONFIG.tables.creatorProposals,
    ID.unique(),
    {
      authorId: author.uid,
      authorName: author.displayName,
      authorAvatar: author.avatar,
      category: input.category.trim().slice(0, 40),
      title: input.title.trim().slice(0, 120),
      description: input.description.trim().slice(0, 2000),
      status: 'pending',
      adminReply: '',
      badgeDurationDays: 0,
      likedBy: [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.user(author.uid)),
    ]
  );
}

export async function toggleProposalLike(proposal: CreatorProposal, uid: string): Promise<void> {
  const liked = proposal.likedBy ?? [];
  const next = liked.includes(uid) ? liked.filter((id) => id !== uid) : [...liked, uid];
  await updateTableRow(APPWRITE_CONFIG.tables.creatorProposals, proposal.id, {
    likedBy: next,
    likesCount: next.length,
  });
}

export function subscribeToProposalComments(
  proposalId: string,
  onUpdate: (comments: SimpleMessage[]) => void
): () => void {
  return subscribeToTableRows<SimpleMessage>({
    tableId: APPWRITE_CONFIG.tables.proposalComments,
    queries: [Query.equal('proposalId', proposalId), Query.limit(50)],
    mapRow: (row) => ({
      id: String(row.$id),
      proposalId: String(row.proposalId || ''),
      senderId: String(row.senderId || ''),
      senderName: String(row.senderName || ''),
      senderAvatar: String(row.senderAvatar || ''),
      text: String(row.text || ''),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (c) => c.proposalId === proposalId,
    sort: (a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt),
    onData: onUpdate,
  });
}

export async function addProposalComment(
  proposalId: string,
  author: UserProfile,
  text: string
): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  await createTableRow(
    APPWRITE_CONFIG.tables.proposalComments,
    ID.unique(),
    {
      proposalId,
      senderId: author.uid,
      senderName: author.displayName,
      senderAvatar: author.avatar,
      text: clean.slice(0, 1000),
      createdAt: new Date().toISOString(),
    },
    [
      Permission.read(Role.users()),
      Permission.delete(Role.user(author.uid)),
    ]
  );
  const prop = await getTableRow(APPWRITE_CONFIG.tables.creatorProposals, proposalId);
  if (prop) {
    await updateTableRow(APPWRITE_CONFIG.tables.creatorProposals, proposalId, {
      commentsCount: Number(prop.commentsCount ?? 0) + 1,
    });
  }
}

// ============================================================================
// 5. Secrets Box (Anonymous Confessions)
// ============================================================================
const ANONYMOUS_ALIASES = [
  'قلب عابر',
  'صوت هادئ',
  'كاتب الليل',
  'طيف بعيد',
  'نسمة صافية',
  'مسافر صامت',
];

export function subscribeToSecrets(onUpdate: (secrets: Secret[]) => void): () => void {
  return subscribeToTableRows<Secret>({
    tableId: APPWRITE_CONFIG.tables.secrets,
    queries: [Query.orderDesc('$createdAt'), Query.limit(60)],
    mapRow: (row) => ({
      id: String(row.$id),
      authorHash: String(row.authorHash || ''),
      alias: String(row.alias || 'قلب عابر'),
      category: String(row.category || 'فضفضة'),
      isLongStory: Boolean(row.isLongStory),
      text: String(row.text || ''),
      empathyCounts: parseJsonField(row.empathyCountsJson ?? row.empathyCounts, {
        feel: 0,
        pray: 0,
        strength: 0,
      }),
      empathyUsers: Array.isArray(row.empathyUsers) ? (row.empathyUsers as string[]) : [],
      commentsCount: Number(row.commentsCount ?? 0),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    sort: (a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt),
    onData: onUpdate,
  });
}

export async function createSecret(
  uid: string,
  input: { category: string; isLongStory: boolean; text: string }
): Promise<void> {
  const clean = input.text.trim();
  if (clean.length < 3 || clean.length > 4000) {
    throw new Error('النص يجب أن يكون بين 3 و4000 حرف.');
  }

  const alias = ANONYMOUS_ALIASES[Math.floor(Math.random() * ANONYMOUS_ALIASES.length)];
  const pseudoHash = btoa(uid.slice(0, 8)).replace(/[^a-zA-Z0-9]/g, '');

  await createTableRow(
    APPWRITE_CONFIG.tables.secrets,
    ID.unique(),
    {
      authorHash: pseudoHash,
      alias,
      category: input.category || 'فضفضة',
      isLongStory: input.isLongStory,
      text: clean,
      empathyCountsJson: serializeJsonField({ feel: 0, pray: 0, strength: 0 }),
      empathyUsers: [],
      commentsCount: 0,
      createdAt: new Date().toISOString(),
    },
    [Permission.read(Role.users()), Permission.update(Role.users())]
  );
}

export async function reactEmpathyToSecret(
  secret: Secret,
  kind: 'feel' | 'pray' | 'strength',
  _uid: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'reactEmpathyToSecret', {
    secretId: secret.id,
    kind,
  });
}

export function subscribeToSecretComments(
  secretId: string,
  onUpdate: (comments: SimpleMessage[]) => void
): () => void {
  return subscribeToTableRows<SimpleMessage>({
    tableId: APPWRITE_CONFIG.tables.secretComments,
    queries: [Query.equal('secretId', secretId), Query.limit(50)],
    mapRow: (row) => ({
      id: String(row.$id),
      secretId: String(row.secretId || ''),
      senderId: String(row.senderId || 'anonymous'),
      senderName: String(row.senderName || 'قلب عابر'),
      text: String(row.text || ''),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (c) => c.secretId === secretId,
    sort: (a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt),
    onData: onUpdate,
  });
}

export async function addSecretComment(secretId: string, text: string): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  const alias = ANONYMOUS_ALIASES[Math.floor(Math.random() * ANONYMOUS_ALIASES.length)];
  await createTableRow(
    APPWRITE_CONFIG.tables.secretComments,
    ID.unique(),
    {
      secretId,
      senderId: 'anonymous',
      senderName: alias,
      text: clean.slice(0, 1000),
      createdAt: new Date().toISOString(),
    },
    [Permission.read(Role.users())]
  );
  const secret = await getTableRow(APPWRITE_CONFIG.tables.secrets, secretId);
  if (secret) {
    await updateTableRow(APPWRITE_CONFIG.tables.secrets, secretId, {
      commentsCount: Number(secret.commentsCount ?? 0) + 1,
    });
  }
}
