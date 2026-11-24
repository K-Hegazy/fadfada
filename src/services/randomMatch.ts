import {
  APPWRITE_CONFIG,
  Query,
} from '../appwrite/config';
import { subscribeToSingleRow, subscribeToTableRows } from '../appwrite/realtime';
import {
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
  GenderType,
  MatchQueueEntry,
  MatchSession,
  SimpleMessage,
  UserProfile,
} from '../types/fadfada';
import { timestampToMillis } from '../utils/formatters';

export async function joinRandomMatchQueue(
  _user: UserProfile,
  options: {
    mode: 'text' | 'voice' | 'video';
    preferredGender: 'all' | 'male' | 'female';
    preferredCountry: string;
    freeDailyLimit: number;
    matchCost: number;
    durationSec: number;
  }
): Promise<{ matchedSessionId: string | null }> {
  return await executeAppwriteFunction<{ matchedSessionId: string | null }>(
    APPWRITE_CONFIG.economyFunctionId,
    'joinRandomMatch',
    {
      mode: options.mode,
      preferredGender: options.preferredGender,
      preferredCountry: options.preferredCountry,
    }
  );
}

export async function leaveRandomMatchQueue(uid: string): Promise<void> {
  try {
    await deleteTableRow(APPWRITE_CONFIG.tables.matchQueue, uid);
  } catch {
    // Ignore if already removed
  }
}

export function subscribeToMyMatchQueue(
  uid: string,
  onUpdate: (entry: MatchQueueEntry | null) => void
): () => void {
  const mapQueue = (row: AppwriteRow): MatchQueueEntry => ({
    uid: String(row.uid || row.$id),
    displayName: String(row.displayName || ''),
    gender: (row.gender as GenderType) || 'unspecified',
    country: String(row.country || ''),
    mode: (row.mode as MatchQueueEntry['mode']) || 'text',
    preferredGender: (row.preferredGender as MatchQueueEntry['preferredGender']) || 'all',
    preferredCountry: String(row.preferredCountry || ''),
    status: (row.status as MatchQueueEntry['status']) || 'waiting',
    sessionId: String(row.sessionId || ''),
    createdAt: normalizeAppDate(row, 'createdAt'),
  });

  return subscribeToSingleRow<MatchQueueEntry>({
    tableId: APPWRITE_CONFIG.tables.matchQueue,
    rowId: uid,
    fetchRow: async () => {
      const row = await getTableRow(APPWRITE_CONFIG.tables.matchQueue, uid);
      return row ? mapQueue(row) : null;
    },
    mapRow: mapQueue,
    onData: onUpdate,
  });
}

function mapMatchSessionRow(row: AppwriteRow): MatchSession {
  const p = Array.isArray(row.participantIds) ? (row.participantIds as string[]) : [];
  return {
    id: String(row.$id),
    participantIds: [p[0] ?? '', p[1] ?? ''] as [string, string],
    mode: (row.mode as MatchSession['mode']) || 'text',
    status: (row.status as MatchSession['status']) || 'active',
    endsAt: Number(row.endsAt ?? 0),
    offer: parseJsonField<{ type: string; sdp: string } | null>(row.offerJson ?? row.offer, null),
    answer: parseJsonField<{ type: string; sdp: string } | null>(row.answerJson ?? row.answer, null),
    createdAt: normalizeAppDate(row, 'createdAt'),
  };
}

export function subscribeToMatchSession(
  sessionId: string,
  onUpdate: (session: MatchSession | null) => void
): () => void {
  return subscribeToSingleRow<MatchSession>({
    tableId: APPWRITE_CONFIG.tables.matchSessions,
    rowId: sessionId,
    fetchRow: async () => {
      const row = await getTableRow(APPWRITE_CONFIG.tables.matchSessions, sessionId);
      return row ? mapMatchSessionRow(row) : null;
    },
    mapRow: mapMatchSessionRow,
    onData: onUpdate,
  });
}

export function subscribeToMatchMessages(
  sessionId: string,
  onUpdate: (messages: SimpleMessage[]) => void
): () => void {
  return subscribeToTableRows<SimpleMessage>({
    tableId: APPWRITE_CONFIG.tables.matchMessages,
    queries: [Query.equal('sessionId', sessionId), Query.limit(100)],
    mapRow: (row) => ({
      id: String(row.$id),
      sessionId: String(row.sessionId || ''),
      senderId: String(row.senderId || ''),
      senderName: String(row.senderName || ''),
      text: String(row.text || ''),
      createdAt: normalizeAppDate(row, 'createdAt'),
    }),
    matchesRow: (m) => m.sessionId === sessionId,
    sort: (a, b) => timestampToMillis(a.createdAt) - timestampToMillis(b.createdAt),
    onData: onUpdate,
  });
}

export async function sendMatchMessage(
  sessionId: string,
  _sender: UserProfile,
  text: string
): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'sendMatchMessage', {
    sessionId,
    text: clean.slice(0, 1000),
  });
}

export async function endMatchSession(sessionId: string): Promise<void> {
  try {
    await updateTableRow(APPWRITE_CONFIG.tables.matchSessions, sessionId, {
      status: 'ended',
    });
  } catch {
    // Ignore
  }
}

export async function publishRtcOffer(
  sessionId: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await updateTableRow(APPWRITE_CONFIG.tables.matchSessions, sessionId, {
    offerJson: serializeJsonField({ type: offer.type ?? 'offer', sdp: offer.sdp ?? '' }),
  });
}

export async function publishRtcAnswer(
  sessionId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await updateTableRow(APPWRITE_CONFIG.tables.matchSessions, sessionId, {
    answerJson: serializeJsonField({ type: answer.type ?? 'answer', sdp: answer.sdp ?? '' }),
  });
}

export async function addIceCandidate(
  sessionId: string,
  _senderId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await executeAppwriteFunction(APPWRITE_CONFIG.economyFunctionId, 'addIceCandidate', {
    sessionId,
    candidate: candidate.candidate ?? '',
    sdpMid: candidate.sdpMid ?? '',
    sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
  });
}

export function subscribeToIceCandidates(
  sessionId: string,
  currentUid: string,
  onCandidate: (candidate: RTCIceCandidateInit) => void
): () => void {
  const seenIds = new Set<string>();
  return subscribeToTableRows<{
    id: string;
    sessionId: string;
    senderId: string;
    candidate: string;
    sdpMid: string;
    sdpMLineIndex: number;
  }>({
    tableId: APPWRITE_CONFIG.tables.matchCandidates,
    queries: [Query.equal('sessionId', sessionId), Query.limit(100)],
    mapRow: (row) => ({
      id: String(row.$id),
      sessionId: String(row.sessionId || ''),
      senderId: String(row.senderId || ''),
      candidate: String(row.candidate || ''),
      sdpMid: String(row.sdpMid || ''),
      sdpMLineIndex: Number(row.sdpMLineIndex ?? 0),
    }),
    matchesRow: (c) => c.sessionId === sessionId,
    onData: (list) => {
      for (const item of list) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);
        if (item.senderId !== currentUid && item.candidate) {
          onCandidate({
            candidate: item.candidate,
            sdpMid: item.sdpMid,
            sdpMLineIndex: item.sdpMLineIndex,
          });
        }
      }
    },
  });
}
