import {
  APPWRITE_CONFIG,
  deterministicRowId,
  Query,
} from '../appwrite/config';
import { subscribeToTableRows } from '../appwrite/realtime';
import {
  executeAppwriteFunction,
  normalizeAppDate,
  parseJsonField,
  serializeJsonField,
  updateTableRow,
  type AppwriteRow,
} from '../appwrite/tables';
import {
  SCHEMA_LIMITS,
  type Conversation,
  type ConversationLastStatus,
  type Message,
  type MessageStatus,
  type MessageType,
  type UserProfile,
} from '../types/fadfada';
import { timestampToMillis } from '../utils/formatters';

export function getSortedParticipants(uid1: string, uid2: string): [string, string] {
  return uid1 < uid2 ? [uid1, uid2] : [uid2, uid1];
}

export function getConversationId(uid1: string, uid2: string): string {
  const [a, b] = getSortedParticipants(uid1, uid2);
  return deterministicRowId('c', `${a}_${b}`);
}

export function getUnreadCountForUser(conversation: Conversation, uid: string): number {
  if (conversation.participantA === uid) return conversation.unreadCountA ?? 0;
  if (conversation.participantB === uid) return conversation.unreadCountB ?? 0;
  return 0;
}

export function getClearedAtForUser(conversation: Conversation | null, uid: string): number {
  if (!conversation) return 0;
  if (conversation.participantA === uid) return conversation.clearedAtA ?? 0;
  if (conversation.participantB === uid) return conversation.clearedAtB ?? 0;
  return 0;
}

export function getPeerIdFromConversation(conversation: Conversation, currentUid: string): string {
  return conversation.participantA === currentUid
    ? conversation.participantB
    : conversation.participantA;
}

function mapConversationRow(row: AppwriteRow): Conversation {
  const participantA = String(row.participantA || '');
  const participantB = String(row.participantB || '');
  const participantIds = Array.isArray(row.participantIds) && row.participantIds.length === 2
    ? ([String(row.participantIds[0]), String(row.participantIds[1])] as [string, string])
    : ([participantA, participantB] as [string, string]);

  return {
    id: String(row.$id),
    participantA,
    participantB,
    participantIds,
    lastMessageText: String(row.lastMessageText || ''),
    lastMessageSenderId: String(row.lastMessageSenderId || ''),
    lastMessageStatus: (row.lastMessageStatus as ConversationLastStatus) || 'none',
    lastMessageAt: normalizeAppDate(row, 'lastMessageAt'),
    unreadCountA: Number(row.unreadCountA ?? 0),
    unreadCountB: Number(row.unreadCountB ?? 0),
    theme: String(row.theme || 'emerald'),
    pinnedMessageId: String(row.pinnedMessageId || ''),
    pinnedMessageText: String(row.pinnedMessageText || ''),
    archivedBy: Array.isArray(row.archivedBy) ? (row.archivedBy as string[]) : [],
    clearedAtA: Number(row.clearedAtA ?? 0),
    clearedAtB: Number(row.clearedAtB ?? 0),
    createdAt: normalizeAppDate(row, 'createdAt'),
    updatedAt: normalizeAppDate(row, 'updatedAt'),
  };
}

function mapMessageRow(row: AppwriteRow): Message {
  const rawExpires = Number(row.expiresAt ?? 0);
  const participantIds = Array.isArray(row.participantIds) && row.participantIds.length === 2
    ? ([String(row.participantIds[0]), String(row.participantIds[1])] as [string, string])
    : ([String(row.senderId || ''), String(row.recipientId || '')] as [string, string]);

  return {
    id: String(row.$id),
    conversationId: String(row.conversationId || ''),
    senderId: String(row.senderId || ''),
    recipientId: String(row.recipientId || ''),
    participantIds,
    type: (row.type as MessageType) || 'text',
    text: String(row.text || ''),
    mediaUrl: String(row.mediaUrl || ''),
    replyToId: String(row.replyToId || ''),
    replyToText: String(row.replyToText || ''),
    reactions: parseJsonField<Record<string, string[]>>(row.reactionsJson ?? row.reactions, {}),
    isWhisper: Boolean(row.isWhisper),
    whisperRevealed: Boolean(row.whisperRevealed),
    expiresAt: rawExpires > 0 ? rawExpires : null,
    isDeleted: Boolean(row.isDeleted),
    editedAt: normalizeAppDate(row, 'editedAt'),
    voiceDurationSec: Number(row.voiceDurationSec ?? 0),
    isViewOnce: Boolean(row.isViewOnce),
    viewOnceConsumed: Boolean(row.viewOnceConsumed),
    status: (row.status as MessageStatus) || 'sent',
    createdAt: normalizeAppDate(row, 'createdAt'),
    seenAt: normalizeAppDate(row, 'seenAt'),
  };
}

export function subscribeToConversations(
  currentUid: string,
  onUpdate: (conversations: Conversation[]) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeToTableRows<Conversation>({
    tableId: APPWRITE_CONFIG.tables.conversations,
    queries: [
      Query.or([
        Query.equal('participantA', currentUid),
        Query.equal('participantB', currentUid),
      ]),
      Query.orderDesc('$updatedAt'),
      Query.limit(100),
    ],
    mapRow: mapConversationRow,
    matchesRow: (c) => c.participantIds.includes(currentUid),
    sort: (a, b) => {
      const timeB = timestampToMillis(b.updatedAt) || timestampToMillis(b.lastMessageAt);
      const timeA = timestampToMillis(a.updatedAt) || timestampToMillis(a.lastMessageAt);
      return timeB - timeA;
    },
    onData: onUpdate,
    onError,
  });
}

export function subscribeToMessages(
  conversationId: string,
  currentUid: string,
  onUpdate: (messages: Message[]) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeToTableRows<Message>({
    tableId: APPWRITE_CONFIG.tables.messages,
    queries: [
      Query.equal('conversationId', conversationId),
      Query.orderDesc('$createdAt'),
      Query.limit(200),
    ],
    mapRow: mapMessageRow,
    matchesRow: (m) => {
      if (m.conversationId !== conversationId) return false;
      if (!m.participantIds.includes(currentUid)) return false;
      if (m.expiresAt && m.expiresAt <= Date.now()) return false;
      return true;
    },
    sort: (a, b) => {
      const timeA = timestampToMillis(a.createdAt) || Number.MAX_SAFE_INTEGER;
      const timeB = timestampToMillis(b.createdAt) || Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) return timeA - timeB;
      return a.id.localeCompare(b.id);
    },
    onData: onUpdate,
    onError,
  });
}

export interface SendMessageOptions {
  type?: MessageType;
  mediaUrl?: string;
  replyToId?: string;
  replyToText?: string;
  isWhisper?: boolean;
  disappearSeconds?: number | null;
  voiceDurationSec?: number;
  isViewOnce?: boolean;
  senderProfile?: UserProfile;
  recipientProfile?: UserProfile;
  guestDailyLimit?: number;
  isFriend?: boolean;
  isStaff?: boolean;
}

export async function sendPrivateMessage(
  senderUid: string,
  recipientUid: string,
  rawText: string,
  options: SendMessageOptions = {}
): Promise<string> {
  if (senderUid === recipientUid) {
    throw new Error('لا يمكنك إرسال رسالة لنفسك.');
  }

  if (options.recipientProfile && !options.isStaff) {
    const perm = options.recipientProfile.privacy?.messagePermission ?? 'everyone';
    if (perm === 'nobody') {
      throw new Error('أغلق هذا العضو استقبال الرسائل الخاصة في إعدادات الخصوصية.');
    }
    if (perm === 'friends' && !options.isFriend) {
      throw new Error('يسمح هذا العضو باستقبال الرسائل الخاصة من الأصدقاء فقط.');
    }
  }

  const text = rawText.trim();
  if (
    text.length < SCHEMA_LIMITS.MESSAGE_MIN_LENGTH ||
    text.length > SCHEMA_LIMITS.MESSAGE_MAX_LENGTH
  ) {
    throw new Error(
      `نص الرسالة يجب أن يكون بين ${SCHEMA_LIMITS.MESSAGE_MIN_LENGTH} و${SCHEMA_LIMITS.MESSAGE_MAX_LENGTH} حرفًا.`
    );
  }

  const result = await executeAppwriteFunction<{ messageId: string; conversationId: string }>(
    APPWRITE_CONFIG.economyFunctionId,
    'sendPrivateMessage',
    {
      recipientId: recipientUid,
      text,
      type: options.type ?? 'text',
      mediaUrl: options.mediaUrl ?? '',
      replyToId: options.replyToId ?? '',
      replyToText: options.replyToText ?? '',
      isWhisper: Boolean(options.isWhisper),
      disappearSeconds: options.disappearSeconds ?? null,
      voiceDurationSec: options.voiceDurationSec ?? 0,
      isViewOnce: Boolean(options.isViewOnce),
    }
  );

  return result.messageId;
}

export async function markConversationAsRead(
  conversation: Conversation,
  currentUid: string,
  messages: Message[]
): Promise<void> {
  const unreadMessages = messages.filter(
    (m) => m.recipientId === currentUid && m.status !== 'seen'
  );
  const myUnreadCount = getUnreadCountForUser(conversation, currentUid);
  const needsConversationSeenUpdate =
    conversation.lastMessageSenderId !== currentUid &&
    conversation.lastMessageStatus !== 'none' &&
    conversation.lastMessageStatus !== 'seen';

  if (unreadMessages.length === 0 && myUnreadCount === 0 && !needsConversationSeenUpdate) {
    return;
  }

  const nowIso = new Date().toISOString();
  await Promise.all(
    unreadMessages.slice(0, 50).map((msg) =>
      updateTableRow(APPWRITE_CONFIG.tables.messages, msg.id, {
        status: 'seen',
        seenAt: nowIso,
      }).catch(() => {})
    )
  );

  const isParticipantA = conversation.participantA === currentUid;
  await updateTableRow(APPWRITE_CONFIG.tables.conversations, conversation.id, {
    unreadCountA: isParticipantA ? 0 : conversation.unreadCountA,
    unreadCountB: isParticipantA ? conversation.unreadCountB : 0,
    lastMessageStatus:
      conversation.lastMessageSenderId !== currentUid && conversation.lastMessageStatus !== 'none'
        ? 'seen'
        : conversation.lastMessageStatus,
    updatedAt: nowIso,
  });
}

export async function editPrivateMessage(
  _conversationId: string,
  messageId: string,
  newText: string
): Promise<void> {
  const clean = newText.trim();
  if (!clean || clean.length > SCHEMA_LIMITS.MESSAGE_MAX_LENGTH) {
    throw new Error('نص الرسالة غير صالح.');
  }
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'editPrivateMessage', {
    messageId,
    text: clean,
  });
}

export async function deletePrivateMessage(
  _conversationId: string,
  messageId: string
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'deletePrivateMessage', {
    messageId,
  });
}

export async function consumeViewOnceMessage(
  messageId: string
): Promise<{ mediaUrl: string; type: MessageType }> {
  const res = await executeAppwriteFunction<{ mediaUrl: string; type: MessageType }>(
    APPWRITE_CONFIG.economyFunctionId,
    'consumeViewOnceMessage',
    { messageId }
  );
  return res;
}

export async function toggleMessageReaction(
  _conversationId: string,
  message: Message,
  emoji: string,
  uid: string
): Promise<void> {
  const current = message.reactions?.[emoji] ?? [];
  const nextForEmoji = current.includes(uid)
    ? current.filter((id) => id !== uid)
    : [...current, uid];

  const nextReactions = { ...(message.reactions ?? {}) };
  if (nextForEmoji.length === 0) {
    delete nextReactions[emoji];
  } else {
    nextReactions[emoji] = nextForEmoji;
  }

  await updateTableRow(APPWRITE_CONFIG.tables.messages, message.id, {
    reactionsJson: serializeJsonField(nextReactions),
  });
}

export async function revealWhisperMessage(
  _conversationId: string,
  messageId: string
): Promise<void> {
  await updateTableRow(APPWRITE_CONFIG.tables.messages, messageId, {
    whisperRevealed: true,
    status: 'seen',
    seenAt: new Date().toISOString(),
  });
}

export async function pinConversationMessage(
  conversationId: string,
  messageId: string,
  text: string
): Promise<void> {
  await updateTableRow(APPWRITE_CONFIG.tables.conversations, conversationId, {
    pinnedMessageId: messageId,
    pinnedMessageText: text.slice(0, 300),
    updatedAt: new Date().toISOString(),
  });
}

export async function setConversationTheme(
  conversationId: string,
  theme: string
): Promise<void> {
  await updateTableRow(APPWRITE_CONFIG.tables.conversations, conversationId, {
    theme,
    updatedAt: new Date().toISOString(),
  });
}

export async function toggleArchiveConversation(
  conversation: Conversation,
  uid: string
): Promise<void> {
  const archived = conversation.archivedBy ?? [];
  const next = archived.includes(uid)
    ? archived.filter((id) => id !== uid)
    : [...archived, uid];
  await updateTableRow(APPWRITE_CONFIG.tables.conversations, conversation.id, {
    archivedBy: next,
    updatedAt: new Date().toISOString(),
  });
}

export async function clearConversationForUser(
  conversation: Conversation,
  uid: string
): Promise<void> {
  const now = Date.now();
  const isA = conversation.participantA === uid;
  await updateTableRow(APPWRITE_CONFIG.tables.conversations, conversation.id, {
    clearedAtA: isA ? now : conversation.clearedAtA ?? 0,
    clearedAtB: isA ? conversation.clearedAtB ?? 0 : now,
    updatedAt: new Date().toISOString(),
  });
}
