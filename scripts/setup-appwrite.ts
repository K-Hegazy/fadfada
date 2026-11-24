import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { InputFile } from 'node-appwrite/file';
import {
  Client,
  Compression,
  Functions,
  ID,
  Permission,
  Project,
  ProjectAuthMethodId,
  ProjectKeyScopes,
  Query,
  Role,
  Runtime,
  Storage,
  TablesDB,
  TablesDBIndexType,
} from 'node-appwrite';

const endpoint = (process.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1').trim();
const projectId = (process.env.VITE_APPWRITE_PROJECT_ID || '6b022cc5002da26b7487').trim();
const apiKey = (process.env.APPWRITE_API_KEY || '').trim();

if (!endpoint || !projectId || !apiKey) {
  console.error(
    'Missing required setup env vars: VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID, APPWRITE_API_KEY.'
  );
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tablesDB = new TablesDB(client);
const storage = new Storage(client);
const functionsApi = new Functions(client);
const projectApi = new Project(client);

type ColumnSpec =
  | { kind: 'varchar'; key: string; size: number; required?: boolean; xdefault?: string | null; array?: boolean }
  | { kind: 'text'; key: string; required?: boolean; xdefault?: string | null; array?: boolean }
  | { kind: 'mediumtext'; key: string; required?: boolean; xdefault?: string | null }
  | { kind: 'integer'; key: string; required?: boolean; xdefault?: number | null }
  | { kind: 'bigint'; key: string; required?: boolean; xdefault?: number | null }
  | { kind: 'boolean'; key: string; required?: boolean; xdefault?: boolean | null };

interface IndexSpec {
  key: string;
  type: TablesDBIndexType;
  columns: string[];
}

interface TableSpec {
  id: string;
  name: string;
  rowSecurity: boolean;
  permissions: string[];
  columns: ColumnSpec[];
  indexes?: IndexSpec[];
}

function toCamelCase(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

async function ignoreConflict<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 409) return null;
    throw err;
  }
}

async function ensureColumn(databaseId: string, tableId: string, col: ColumnSpec): Promise<void> {
  const required = Boolean(col.required);

  switch (col.kind) {
    case 'varchar':
      await ignoreConflict(() =>
        tablesDB.createVarcharColumn({
          databaseId,
          tableId,
          key: col.key,
          size: col.size,
          required,
          xdefault: required ? undefined : col.xdefault,
          array: col.array,
        })
      );
      break;
    case 'text':
      await ignoreConflict(() =>
        tablesDB.createTextColumn({
          databaseId,
          tableId,
          key: col.key,
          required,
          xdefault: required ? undefined : col.xdefault,
          array: col.array,
        })
      );
      break;
    case 'mediumtext':
      await ignoreConflict(() =>
        tablesDB.createMediumtextColumn({
          databaseId,
          tableId,
          key: col.key,
          required,
          xdefault: required ? undefined : col.xdefault,
        })
      );
      break;
    case 'integer':
      await ignoreConflict(() =>
        tablesDB.createIntegerColumn({
          databaseId,
          tableId,
          key: col.key,
          required,
          xdefault: required ? undefined : col.xdefault,
        })
      );
      break;
    case 'bigint':
      await ignoreConflict(() =>
        tablesDB.createBigIntColumn({
          databaseId,
          tableId,
          key: col.key,
          required,
          xdefault: required ? undefined : col.xdefault,
        })
      );
      break;
    case 'boolean':
      await ignoreConflict(() =>
        tablesDB.createBooleanColumn({
          databaseId,
          tableId,
          key: col.key,
          required,
          xdefault: required ? undefined : col.xdefault,
        })
      );
      break;
  }
}

const READ_USERS = [Permission.read(Role.users())];
const CREATE_AND_READ_USERS = [Permission.read(Role.users()), Permission.create(Role.users())];

const TABLES_SCHEMA: TableSpec[] = [
  {
    id: 'users',
    name: 'Users',
    rowSecurity: true,
    permissions: READ_USERS,
    columns: [
      { kind: 'varchar', key: 'uid', size: 64, required: true },
      { kind: 'varchar', key: 'username', size: 40, required: true },
      { kind: 'varchar', key: 'displayName', size: 80, required: true },
      { kind: 'varchar', key: 'avatar', size: 600, xdefault: '' },
      { kind: 'varchar', key: 'cover', size: 600, xdefault: '' },
      { kind: 'varchar', key: 'bio', size: 300, xdefault: '' },
      { kind: 'varchar', key: 'gender', size: 24, xdefault: 'unspecified' },
      { kind: 'integer', key: 'age', xdefault: 0 },
      { kind: 'varchar', key: 'country', size: 64, xdefault: '' },
      { kind: 'varchar', key: 'countryFlag', size: 24, xdefault: '' },
      { kind: 'varchar', key: 'maritalStatus', size: 24, xdefault: 'single' },
      { kind: 'varchar', key: 'partnerUid', size: 64, xdefault: '' },
      { kind: 'varchar', key: 'partnerName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'affiliation', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'role', size: 24, xdefault: 'member' },
      { kind: 'varchar', key: 'permissions', size: 64, array: true },
      { kind: 'boolean', key: 'isBanned', xdefault: false },
      { kind: 'varchar', key: 'banReason', size: 300, xdefault: '' },
      { kind: 'integer', key: 'level', xdefault: 1 },
      { kind: 'integer', key: 'xp', xdefault: 0 },
      { kind: 'integer', key: 'coins', xdefault: 50 },
      { kind: 'varchar', key: 'lastClaimKey', size: 80, xdefault: '' },
      { kind: 'integer', key: 'giftsSentCount', xdefault: 0 },
      { kind: 'integer', key: 'giftsReceivedCount', xdefault: 0 },
      { kind: 'integer', key: 'likesCount', xdefault: 0 },
      { kind: 'integer', key: 'visitsCount', xdefault: 0 },
      { kind: 'integer', key: 'friendsCount', xdefault: 0 },
      { kind: 'varchar', key: 'vipTier', size: 24, xdefault: 'none' },
      { kind: 'bigint', key: 'vipExpiresAt', xdefault: 0 },
      { kind: 'varchar', key: 'frameId', size: 64, xdefault: 'none' },
      { kind: 'varchar', key: 'nameColor', size: 32, xdefault: '' },
      { kind: 'boolean', key: 'isNamePinned', xdefault: false },
      { kind: 'varchar', key: 'unlockedFeatures', size: 64, array: true },
      { kind: 'mediumtext', key: 'badgesJson', xdefault: '[]' },
      { kind: 'boolean', key: 'ghostMode', xdefault: false },
      { kind: 'boolean', key: 'hideLastSeen', xdefault: false },
      { kind: 'text', key: 'privacyJson', xdefault: '{}' },
      { kind: 'boolean', key: 'isOnline', xdefault: false },
      { kind: 'boolean', key: 'isAnonymous', xdefault: false },
      { kind: 'boolean', key: 'acceptedTerms', xdefault: false },
      { kind: 'boolean', key: 'isPublic', xdefault: true },
      { kind: 'integer', key: 'freeMatchesUsedToday', xdefault: 0 },
      { kind: 'varchar', key: 'lastMatchDate', size: 20, xdefault: '' },
      { kind: 'integer', key: 'dailyMessagesSent', xdefault: 0 },
      { kind: 'varchar', key: 'lastMessageDate', size: 20, xdefault: '' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
      { kind: 'varchar', key: 'lastSeen', size: 48, xdefault: '' },
    ],
    indexes: [
      { key: 'idx_username', type: TablesDBIndexType.Unique, columns: ['username'] },
      { key: 'idx_is_public', type: TablesDBIndexType.Key, columns: ['isPublic'] },
      { key: 'idx_is_online', type: TablesDBIndexType.Key, columns: ['isOnline'] },
    ],
  },
  {
    id: 'user_private',
    name: 'User Private',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'uid', size: 64, required: true },
      { kind: 'varchar', key: 'email', size: 256, xdefault: '' },
      { kind: 'varchar', key: 'provider', size: 40, xdefault: 'account' },
      { kind: 'text', key: 'dailyActivityJson', xdefault: '{}' },
      { kind: 'varchar', key: 'referredBy', size: 64, xdefault: '' },
      { kind: 'varchar', key: 'updatedAt', size: 48, xdefault: '' },
    ],
  },
  {
    id: 'conversations',
    name: 'Conversations',
    rowSecurity: true,
    permissions: [Permission.create(Role.users())],
    columns: [
      { kind: 'varchar', key: 'pairKey', size: 140, required: true },
      { kind: 'varchar', key: 'participantA', size: 64, required: true },
      { kind: 'varchar', key: 'participantB', size: 64, required: true },
      { kind: 'varchar', key: 'participantIds', size: 64, array: true },
      { kind: 'varchar', key: 'lastMessageText', size: 250, xdefault: '' },
      { kind: 'varchar', key: 'lastMessageSenderId', size: 64, xdefault: '' },
      { kind: 'varchar', key: 'lastMessageStatus', size: 24, xdefault: 'none' },
      { kind: 'varchar', key: 'lastMessageAt', size: 48, xdefault: '' },
      { kind: 'integer', key: 'unreadCountA', xdefault: 0 },
      { kind: 'integer', key: 'unreadCountB', xdefault: 0 },
      { kind: 'varchar', key: 'theme', size: 32, xdefault: 'emerald' },
      { kind: 'varchar', key: 'pinnedMessageId', size: 64, xdefault: '' },
      { kind: 'varchar', key: 'pinnedMessageText', size: 320, xdefault: '' },
      { kind: 'varchar', key: 'archivedBy', size: 64, array: true },
      { kind: 'bigint', key: 'clearedAtA', xdefault: 0 },
      { kind: 'bigint', key: 'clearedAtB', xdefault: 0 },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
      { kind: 'varchar', key: 'updatedAt', size: 48, xdefault: '' },
    ],
    indexes: [
      { key: 'idx_conv_part_a', type: TablesDBIndexType.Key, columns: ['participantA'] },
      { key: 'idx_conv_part_b', type: TablesDBIndexType.Key, columns: ['participantB'] },
      { key: 'idx_conv_pair', type: TablesDBIndexType.Unique, columns: ['pairKey'] },
    ],
  },
  {
    id: 'messages',
    name: 'Messages',
    rowSecurity: true,
    permissions: [Permission.create(Role.users())],
    columns: [
      { kind: 'varchar', key: 'conversationId', size: 64, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, required: true },
      { kind: 'varchar', key: 'recipientId', size: 64, required: true },
      { kind: 'varchar', key: 'participantIds', size: 64, array: true },
      { kind: 'varchar', key: 'type', size: 32, xdefault: 'text' },
      { kind: 'text', key: 'text', required: true },
      { kind: 'varchar', key: 'mediaUrl', size: 900, xdefault: '' },
      { kind: 'varchar', key: 'replyToId', size: 128, xdefault: '' },
      { kind: 'varchar', key: 'replyToText', size: 320, xdefault: '' },
      { kind: 'mediumtext', key: 'reactionsJson', xdefault: '{}' },
      { kind: 'boolean', key: 'isWhisper', xdefault: false },
      { kind: 'boolean', key: 'whisperRevealed', xdefault: false },
      { kind: 'bigint', key: 'expiresAt', xdefault: 0 },
      { kind: 'boolean', key: 'isDeleted', xdefault: false },
      { kind: 'varchar', key: 'editedAt', size: 48, xdefault: '' },
      { kind: 'integer', key: 'voiceDurationSec', xdefault: 0 },
      { kind: 'boolean', key: 'isViewOnce', xdefault: false },
      { kind: 'boolean', key: 'viewOnceConsumed', xdefault: false },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'sent' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
      { kind: 'varchar', key: 'seenAt', size: 48, xdefault: '' },
    ],
    indexes: [
      { key: 'idx_msg_conv', type: TablesDBIndexType.Key, columns: ['conversationId'] },
      { key: 'idx_msg_sender', type: TablesDBIndexType.Key, columns: ['senderId'] },
      { key: 'idx_msg_recipient', type: TablesDBIndexType.Key, columns: ['recipientId'] },
    ],
  },
  {
    id: 'rooms',
    name: 'Rooms',
    rowSecurity: true,
    permissions: READ_USERS,
    columns: [
      { kind: 'varchar', key: 'name', size: 100, required: true },
      { kind: 'varchar', key: 'description', size: 300, xdefault: '' },
      { kind: 'varchar', key: 'category', size: 48, xdefault: 'عام' },
      { kind: 'boolean', key: 'isOfficial', xdefault: false },
      { kind: 'varchar', key: 'ownerId', size: 64, required: true },
      { kind: 'varchar', key: 'ownerName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'theme', size: 32, xdefault: 'emerald' },
      { kind: 'varchar', key: 'pinnedMessage', size: 400, xdefault: '' },
      { kind: 'varchar', key: 'memberIds', size: 64, array: true },
      { kind: 'integer', key: 'activeCount', xdefault: 0 },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
  },
  {
    id: 'room_messages',
    name: 'Room Messages',
    rowSecurity: true,
    permissions: CREATE_AND_READ_USERS,
    columns: [
      { kind: 'varchar', key: 'roomId', size: 64, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, required: true },
      { kind: 'varchar', key: 'senderName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'senderAvatar', size: 600, xdefault: '' },
      { kind: 'varchar', key: 'senderVip', size: 24, xdefault: 'none' },
      { kind: 'varchar', key: 'type', size: 32, xdefault: 'text' },
      { kind: 'text', key: 'text', required: true },
      { kind: 'varchar', key: 'mediaUrl', size: 900, xdefault: '' },
      { kind: 'varchar', key: 'replyToId', size: 128, xdefault: '' },
      { kind: 'varchar', key: 'replyToText', size: 320, xdefault: '' },
      { kind: 'mediumtext', key: 'reactionsJson', xdefault: '{}' },
      { kind: 'varchar', key: 'editedAt', size: 48, xdefault: '' },
      { kind: 'boolean', key: 'isDeleted', xdefault: false },
      { kind: 'integer', key: 'voiceDurationSec', xdefault: 0 },
      { kind: 'boolean', key: 'isViewOnce', xdefault: false },
      { kind: 'varchar', key: 'viewOnceViewedBy', size: 64, array: true },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_room_msg_room', type: TablesDBIndexType.Key, columns: ['roomId'] }],
  },
  {
    id: 'stories',
    name: 'Stories',
    rowSecurity: true,
    permissions: CREATE_AND_READ_USERS,
    columns: [
      { kind: 'varchar', key: 'authorId', size: 64, required: true },
      { kind: 'varchar', key: 'authorName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'authorAvatar', size: 600, xdefault: '' },
      { kind: 'varchar', key: 'type', size: 24, xdefault: 'text' },
      { kind: 'varchar', key: 'text', size: 550, xdefault: '' },
      { kind: 'varchar', key: 'mediaUrl', size: 900, xdefault: '' },
      { kind: 'varchar', key: 'bgColor', size: 32, xdefault: '#0D7A5F' },
      { kind: 'varchar', key: 'viewerIds', size: 64, array: true },
      { kind: 'bigint', key: 'expiresAt', required: true },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_story_exp', type: TablesDBIndexType.Key, columns: ['expiresAt'] }],
  },
  {
    id: 'wall_posts',
    name: 'Wall Posts',
    rowSecurity: true,
    permissions: CREATE_AND_READ_USERS,
    columns: [
      { kind: 'varchar', key: 'authorId', size: 64, required: true },
      { kind: 'varchar', key: 'authorName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'authorAvatar', size: 600, xdefault: '' },
      { kind: 'varchar', key: 'authorVip', size: 24, xdefault: 'none' },
      { kind: 'text', key: 'text', xdefault: '' },
      { kind: 'varchar', key: 'imageUrl', size: 900, xdefault: '' },
      { kind: 'varchar', key: 'pollQuestion', size: 240, xdefault: '' },
      { kind: 'text', key: 'pollOptionsJson', xdefault: '[]' },
      { kind: 'mediumtext', key: 'pollVotersJson', xdefault: '{}' },
      { kind: 'varchar', key: 'likedBy', size: 64, array: true },
      { kind: 'integer', key: 'likesCount', xdefault: 0 },
      { kind: 'integer', key: 'commentsCount', xdefault: 0 },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
  },
  {
    id: 'wall_comments',
    name: 'Wall Comments',
    rowSecurity: true,
    permissions: CREATE_AND_READ_USERS,
    columns: [
      { kind: 'varchar', key: 'postId', size: 64, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, required: true },
      { kind: 'varchar', key: 'senderName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'senderAvatar', size: 600, xdefault: '' },
      { kind: 'text', key: 'text', required: true },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_wall_comment_post', type: TablesDBIndexType.Key, columns: ['postId'] }],
  },
  {
    id: 'creator_proposals',
    name: 'Creator Proposals',
    rowSecurity: true,
    permissions: CREATE_AND_READ_USERS,
    columns: [
      { kind: 'varchar', key: 'authorId', size: 64, required: true },
      { kind: 'varchar', key: 'authorName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'authorAvatar', size: 600, xdefault: '' },
      { kind: 'varchar', key: 'category', size: 48, xdefault: '' },
      { kind: 'varchar', key: 'title', size: 140, required: true },
      { kind: 'text', key: 'description', required: true },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'pending' },
      { kind: 'varchar', key: 'adminReply', size: 520, xdefault: '' },
      { kind: 'integer', key: 'badgeDurationDays', xdefault: 0 },
      { kind: 'varchar', key: 'likedBy', size: 64, array: true },
      { kind: 'integer', key: 'likesCount', xdefault: 0 },
      { kind: 'integer', key: 'commentsCount', xdefault: 0 },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
  },
  {
    id: 'proposal_comments',
    name: 'Proposal Comments',
    rowSecurity: true,
    permissions: CREATE_AND_READ_USERS,
    columns: [
      { kind: 'varchar', key: 'proposalId', size: 64, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, required: true },
      { kind: 'varchar', key: 'senderName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'senderAvatar', size: 600, xdefault: '' },
      { kind: 'text', key: 'text', required: true },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_prop_comment_id', type: TablesDBIndexType.Key, columns: ['proposalId'] }],
  },
  {
    id: 'secrets',
    name: 'Secrets',
    rowSecurity: true,
    permissions: CREATE_AND_READ_USERS,
    columns: [
      { kind: 'varchar', key: 'authorHash', size: 64, xdefault: '' },
      { kind: 'varchar', key: 'alias', size: 64, xdefault: 'قلب عابر' },
      { kind: 'varchar', key: 'category', size: 48, xdefault: 'فضفضة' },
      { kind: 'boolean', key: 'isLongStory', xdefault: false },
      { kind: 'mediumtext', key: 'text', required: true },
      { kind: 'varchar', key: 'empathyCountsJson', size: 256, xdefault: '{"feel":0,"pray":0,"strength":0}' },
      { kind: 'varchar', key: 'empathyUsers', size: 96, array: true },
      { kind: 'integer', key: 'commentsCount', xdefault: 0 },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
  },
  {
    id: 'secret_comments',
    name: 'Secret Comments',
    rowSecurity: true,
    permissions: CREATE_AND_READ_USERS,
    columns: [
      { kind: 'varchar', key: 'secretId', size: 64, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, xdefault: 'anonymous' },
      { kind: 'varchar', key: 'senderName', size: 80, xdefault: '' },
      { kind: 'text', key: 'text', required: true },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_secret_comment_id', type: TablesDBIndexType.Key, columns: ['secretId'] }],
  },
  {
    id: 'store_items',
    name: 'Store Items',
    rowSecurity: false,
    permissions: READ_USERS,
    columns: [
      { kind: 'varchar', key: 'id', size: 48, required: true },
      { kind: 'varchar', key: 'section', size: 24, required: true },
      { kind: 'varchar', key: 'name', size: 100, required: true },
      { kind: 'varchar', key: 'description', size: 320, xdefault: '' },
      { kind: 'integer', key: 'priceCoins', required: true },
      { kind: 'integer', key: 'durationDays', xdefault: 0 },
      { kind: 'varchar', key: 'code', size: 64, required: true },
      { kind: 'varchar', key: 'color', size: 24, xdefault: '#0D7A5F' },
      { kind: 'varchar', key: 'imageUrl', size: 600, xdefault: '' },
      { kind: 'boolean', key: 'isActive', xdefault: true },
    ],
  },
  {
    id: 'daily_tasks',
    name: 'Daily Tasks',
    rowSecurity: false,
    permissions: READ_USERS,
    columns: [
      { kind: 'varchar', key: 'id', size: 48, required: true },
      { kind: 'varchar', key: 'key', size: 48, required: true },
      { kind: 'varchar', key: 'title', size: 120, required: true },
      { kind: 'varchar', key: 'description', size: 260, xdefault: '' },
      { kind: 'integer', key: 'rewardCoins', xdefault: 0 },
      { kind: 'integer', key: 'rewardXp', xdefault: 0 },
      { kind: 'boolean', key: 'isActive', xdefault: true },
    ],
  },
  {
    id: 'daily_claims',
    name: 'Daily Claims',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'claimKey', size: 140, required: true },
      { kind: 'varchar', key: 'uid', size: 64, required: true },
      { kind: 'varchar', key: 'dateKey', size: 20, required: true },
      { kind: 'varchar', key: 'taskKey', size: 48, required: true },
      { kind: 'integer', key: 'rewardCoins', xdefault: 0 },
      { kind: 'integer', key: 'rewardXp', xdefault: 0 },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [
      { key: 'idx_claim_uid', type: TablesDBIndexType.Key, columns: ['uid'] },
      { key: 'idx_claim_key', type: TablesDBIndexType.Unique, columns: ['claimKey'] },
    ],
  },
  {
    id: 'coin_transactions',
    name: 'Coin Transactions',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'type', size: 32, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, required: true },
      { kind: 'varchar', key: 'recipientId', size: 64, required: true },
      { kind: 'integer', key: 'amount', required: true },
      { kind: 'integer', key: 'recipientAmount', xdefault: 0 },
      { kind: 'varchar', key: 'note', size: 240, xdefault: '' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [
      { key: 'idx_tx_sender', type: TablesDBIndexType.Key, columns: ['senderId'] },
      { key: 'idx_tx_recipient', type: TablesDBIndexType.Key, columns: ['recipientId'] },
    ],
  },
  {
    id: 'shoutouts',
    name: 'Shoutouts',
    rowSecurity: false,
    permissions: READ_USERS,
    columns: [
      { kind: 'varchar', key: 'authorId', size: 64, required: true },
      { kind: 'varchar', key: 'authorName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'kind', size: 24, xdefault: 'user' },
      { kind: 'varchar', key: 'text', size: 280, required: true },
      { kind: 'bigint', key: 'expiresAt', required: true },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_shout_exp', type: TablesDBIndexType.Key, columns: ['expiresAt'] }],
  },
  {
    id: 'relationships',
    name: 'Relationships',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'pairKey', size: 140, required: true },
      { kind: 'varchar', key: 'requesterId', size: 64, required: true },
      { kind: 'varchar', key: 'recipientId', size: 64, required: true },
      { kind: 'varchar', key: 'participantIds', size: 64, array: true },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'pending' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
      { kind: 'varchar', key: 'updatedAt', size: 48, xdefault: '' },
    ],
    indexes: [
      { key: 'idx_rel_req', type: TablesDBIndexType.Key, columns: ['requesterId'] },
      { key: 'idx_rel_rec', type: TablesDBIndexType.Key, columns: ['recipientId'] },
      { key: 'idx_rel_pair', type: TablesDBIndexType.Unique, columns: ['pairKey'] },
    ],
  },
  {
    id: 'marriages',
    name: 'Marriages',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'pairKey', size: 140, required: true },
      { kind: 'varchar', key: 'proposerId', size: 64, required: true },
      { kind: 'varchar', key: 'proposerName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'partnerId', size: 64, required: true },
      { kind: 'varchar', key: 'partnerName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'participantIds', size: 64, array: true },
      { kind: 'integer', key: 'dowry', required: true },
      { kind: 'integer', key: 'wifeShare', required: true },
      { kind: 'integer', key: 'siteFee', required: true },
      { kind: 'varchar', key: 'message', size: 320, xdefault: '' },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'pending' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
      { kind: 'varchar', key: 'updatedAt', size: 48, xdefault: '' },
    ],
    indexes: [
      { key: 'idx_mar_prop', type: TablesDBIndexType.Key, columns: ['proposerId'] },
      { key: 'idx_mar_part', type: TablesDBIndexType.Key, columns: ['partnerId'] },
      { key: 'idx_mar_pair', type: TablesDBIndexType.Unique, columns: ['pairKey'] },
    ],
  },
  {
    id: 'profile_visits',
    name: 'Profile Visits',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'profileUid', size: 64, required: true },
      { kind: 'varchar', key: 'visitorUid', size: 64, required: true },
      { kind: 'varchar', key: 'visitorName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'visitorAvatar', size: 600, xdefault: '' },
      { kind: 'varchar', key: 'visitedAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_visit_profile', type: TablesDBIndexType.Key, columns: ['profileUid'] }],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'recipientId', size: 64, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, required: true },
      { kind: 'varchar', key: 'type', size: 32, required: true },
      { kind: 'varchar', key: 'title', size: 140, required: true },
      { kind: 'varchar', key: 'body', size: 450, xdefault: '' },
      { kind: 'boolean', key: 'isRead', xdefault: false },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_notif_recipient', type: TablesDBIndexType.Key, columns: ['recipientId'] }],
  },
  {
    id: 'topup_requests',
    name: 'Topup Requests',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'userId', size: 64, required: true },
      { kind: 'varchar', key: 'userName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'method', size: 80, required: true },
      { kind: 'integer', key: 'amount', required: true },
      { kind: 'integer', key: 'coinsRequested', required: true },
      { kind: 'varchar', key: 'reference', size: 140, required: true },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'pending' },
      { kind: 'varchar', key: 'adminNote', size: 420, xdefault: '' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
      { kind: 'varchar', key: 'updatedAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_topup_user', type: TablesDBIndexType.Key, columns: ['userId'] }],
  },
  {
    id: 'reports',
    name: 'Reports',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'reporterId', size: 64, required: true },
      { kind: 'varchar', key: 'targetUid', size: 64, required: true },
      { kind: 'varchar', key: 'targetName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'reason', size: 120, required: true },
      { kind: 'text', key: 'details', xdefault: '' },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'open' },
      { kind: 'varchar', key: 'adminNote', size: 420, xdefault: '' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_report_reporter', type: TablesDBIndexType.Key, columns: ['reporterId'] }],
  },
  {
    id: 'appeals',
    name: 'Appeals',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'userId', size: 64, required: true },
      { kind: 'varchar', key: 'userName', size: 80, xdefault: '' },
      { kind: 'text', key: 'reason', required: true },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'pending' },
      { kind: 'varchar', key: 'adminNote', size: 420, xdefault: '' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_appeal_user', type: TablesDBIndexType.Key, columns: ['userId'] }],
  },
  {
    id: 'support_tickets',
    name: 'Support Tickets',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'userId', size: 64, required: true },
      { kind: 'varchar', key: 'userName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'subject', size: 140, required: true },
      { kind: 'text', key: 'message', required: true },
      { kind: 'text', key: 'adminReply', xdefault: '' },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'open' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
      { kind: 'varchar', key: 'updatedAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_ticket_user', type: TablesDBIndexType.Key, columns: ['userId'] }],
  },
  {
    id: 'site_settings',
    name: 'Site Settings',
    rowSecurity: false,
    permissions: READ_USERS,
    columns: [
      { kind: 'integer', key: 'guestDailyMessageLimit', xdefault: 25 },
      { kind: 'integer', key: 'roomCreationCost', xdefault: 150 },
      { kind: 'integer', key: 'randomMatchFreeDaily', xdefault: 3 },
      { kind: 'integer', key: 'randomMatchCost', xdefault: 30 },
      { kind: 'integer', key: 'randomMatchDurationSec', xdefault: 300 },
      { kind: 'integer', key: 'shoutoutCost', xdefault: 80 },
      { kind: 'integer', key: 'marriageSiteFeePercent', xdefault: 20 },
      { kind: 'boolean', key: 'welcomePopupEnabled', xdefault: false },
      { kind: 'varchar', key: 'welcomePopupTitle', size: 140, xdefault: 'مرحباً بك في فضفضة' },
      { kind: 'varchar', key: 'welcomePopupBody', size: 650, xdefault: '' },
      { kind: 'mediumtext', key: 'paymentMethodsJson', xdefault: '[]' },
      { kind: 'mediumtext', key: 'adsJson', xdefault: '{}' },
      { kind: 'varchar', key: 'siteLogoUrl', size: 600, xdefault: '' },
      { kind: 'varchar', key: 'updatedAt', size: 48, xdefault: '' },
    ],
  },
  {
    id: 'match_queue',
    name: 'Match Queue',
    rowSecurity: true,
    permissions: READ_USERS,
    columns: [
      { kind: 'varchar', key: 'uid', size: 64, required: true },
      { kind: 'varchar', key: 'displayName', size: 80, xdefault: '' },
      { kind: 'varchar', key: 'gender', size: 24, xdefault: 'unspecified' },
      { kind: 'varchar', key: 'country', size: 64, xdefault: 'مصر' },
      { kind: 'varchar', key: 'mode', size: 16, xdefault: 'text' },
      { kind: 'varchar', key: 'preferredGender', size: 16, xdefault: 'all' },
      { kind: 'varchar', key: 'preferredCountry', size: 64, xdefault: '' },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'waiting' },
      { kind: 'varchar', key: 'sessionId', size: 64, xdefault: '' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_match_status', type: TablesDBIndexType.Key, columns: ['status'] }],
  },
  {
    id: 'match_sessions',
    name: 'Match Sessions',
    rowSecurity: true,
    permissions: [],
    columns: [
      { kind: 'varchar', key: 'participantIds', size: 64, array: true },
      { kind: 'varchar', key: 'mode', size: 16, xdefault: 'text' },
      { kind: 'varchar', key: 'status', size: 24, xdefault: 'active' },
      { kind: 'bigint', key: 'endsAt', required: true },
      { kind: 'mediumtext', key: 'offerJson', xdefault: '' },
      { kind: 'mediumtext', key: 'answerJson', xdefault: '' },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
  },
  {
    id: 'match_messages',
    name: 'Match Messages',
    rowSecurity: true,
    permissions: [Permission.create(Role.users())],
    columns: [
      { kind: 'varchar', key: 'sessionId', size: 64, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, required: true },
      { kind: 'varchar', key: 'senderName', size: 80, xdefault: '' },
      { kind: 'text', key: 'text', required: true },
      { kind: 'varchar', key: 'createdAt', size: 48, xdefault: '' },
    ],
    indexes: [{ key: 'idx_match_msg_session', type: TablesDBIndexType.Key, columns: ['sessionId'] }],
  },
  {
    id: 'match_candidates',
    name: 'Match Candidates',
    rowSecurity: true,
    permissions: [Permission.create(Role.users())],
    columns: [
      { kind: 'varchar', key: 'sessionId', size: 64, required: true },
      { kind: 'varchar', key: 'senderId', size: 64, required: true },
      { kind: 'text', key: 'candidate', required: true },
      { kind: 'varchar', key: 'sdpMid', size: 64, xdefault: '' },
      { kind: 'integer', key: 'sdpMLineIndex', xdefault: 0 },
    ],
    indexes: [{ key: 'idx_match_cand_session', type: TablesDBIndexType.Key, columns: ['sessionId'] }],
  },
];

async function ensureDatabase(): Promise<string> {
  const list = await tablesDB.list();
  const existing = list.databases.find(
    (d) => d.$id === 'fadfada_db' || d.name === 'Fadfada Database'
  );
  if (existing) {
    return existing.$id;
  }
  try {
    const created = await tablesDB.create({
      databaseId: 'fadfada_db',
      name: 'Fadfada Database',
      enabled: true,
    });
    return created.$id;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 409) {
      const createdUnique = await tablesDB.create({
        databaseId: ID.unique(),
        name: 'Fadfada Database',
        enabled: true,
      });
      return createdUnique.$id;
    }
    throw err;
  }
}

async function ensureBucket(): Promise<string> {
  const list = await storage.listBuckets();
  const existing = list.buckets.find(
    (b) => b.$id === 'fadfada_media' || b.name === 'Fadfada Media'
  );
  if (existing) {
    return existing.$id;
  }

  const basePayload = {
    bucketId: 'fadfada_media',
    name: 'Fadfada Media',
    permissions: [
      Permission.read(Role.users()),
      Permission.create(Role.users()),
      Permission.delete(Role.users()),
    ],
    fileSecurity: true,
    enabled: true,
    maximumFileSize: 15 * 1024 * 1024,
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'mov', 'ogg', 'mp3', 'm4a'],
    compression: Compression.None,
  };

  try {
    const created = await storage.createBucket({
      ...basePayload,
      encryption: true,
      antivirus: true,
      transformations: true,
    });
    return created.$id;
  } catch {
    // Fallback for Cloud tiers where transformations/antivirus flags may be restricted
    const created = await storage.createBucket({
      ...basePayload,
      bucketId: ID.unique(),
      encryption: false,
      antivirus: false,
      transformations: false,
    });
    return created.$id;
  }
}

async function ensureTable(databaseId: string, table: TableSpec): Promise<string> {
  try {
    const existing = await tablesDB.getTable({ databaseId, tableId: table.id });
    return existing.$id;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 404) throw err;
  }
  try {
    const created = await tablesDB.createTable({
      databaseId,
      tableId: table.id,
      name: table.name,
      permissions: table.permissions,
      rowSecurity: table.rowSecurity,
      enabled: true,
    });
    return created.$id;
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code === 409) {
      const existing = await tablesDB.getTable({ databaseId, tableId: table.id });
      return existing.$id;
    }
    throw err;
  }
}

async function waitForColumnsAvailable(
  databaseId: string,
  tableId: string,
  expectedKeys: string[]
): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const res = await tablesDB.listColumns({
      databaseId,
      tableId,
      queries: [Query.limit(100)],
    });
    const byKey = new Map(res.columns.map((c) => [c.key, c.status]));
    const allReady = expectedKeys.every((key) => byKey.get(key) === 'available');
    if (allReady) return;
    await new Promise((r) => setTimeout(r, 700));
  }
}

async function createIndexWithRetry(
  databaseId: string,
  tableId: string,
  idx: IndexSpec
): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await ignoreConflict(() =>
        tablesDB.createIndex({
          databaseId,
          tableId,
          key: idx.key,
          type: idx.type,
          columns: idx.columns,
        })
      );
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not yet available') || msg.includes('processing')) {
        await new Promise((r) => setTimeout(r, 900));
        continue;
      }
      throw err;
    }
  }
  await ignoreConflict(() =>
    tablesDB.createIndex({
      databaseId,
      tableId,
      key: idx.key,
      type: idx.type,
      columns: idx.columns,
    })
  );
}

async function upsertFunctionVar(
  functionId: string,
  key: string,
  value: string,
  existingVars: Map<string, { id: string; value: string }>
): Promise<void> {
  const existing = existingVars.get(key);
  if (existing) {
    if (existing.value === value) return;
    await functionsApi.updateVariable({
      functionId,
      variableId: existing.id,
      key,
      value,
      secret: false,
    });
    existing.value = value;
    return;
  }
  const created = await functionsApi.createVariable({
    functionId,
    variableId: ID.unique(),
    key,
    value,
    secret: false,
  });
  existingVars.set(key, { id: created.$id, value });
}

async function waitForDeploymentReady(functionId: string, deploymentId: string): Promise<void> {
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const dep = await functionsApi.getDeployment({ functionId, deploymentId });
    if (dep.status === 'ready') return;
    if (dep.status === 'failed') {
      throw new Error(`Function deployment failed for ${functionId} (${deploymentId}): ${dep.buildLogs || 'unknown build error'}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timed out waiting for function deployment ${deploymentId} on ${functionId}`);
}

async function run(): Promise<void> {
  console.log(`Provisioning Appwrite project ${projectId} at ${endpoint}...`);

  const actualDatabaseId = await ensureDatabase();
  console.log(`Database ready: ${actualDatabaseId}`);

  const actualBucketId = await ensureBucket();
  console.log(`Storage bucket ready: ${actualBucketId}`);

  const tableIdsBySnake: Record<string, string> = {};
  const tableIdsByCamel: Record<string, string> = {};

  for (const table of TABLES_SCHEMA) {
    const actualTableId = await ensureTable(actualDatabaseId, table);
    tableIdsBySnake[table.id] = actualTableId;
    tableIdsByCamel[toCamelCase(table.id)] = actualTableId;

    const existingColsRes = await tablesDB.listColumns({
      databaseId: actualDatabaseId,
      tableId: actualTableId,
      queries: [Query.limit(100)],
    });
    const existingColKeys = new Set(existingColsRes.columns.map((c) => c.key));

    const missingCols = table.columns.filter((col) => !existingColKeys.has(col.key));
    for (const col of missingCols) {
      await ensureColumn(actualDatabaseId, actualTableId, col);
    }

    if (table.indexes && table.indexes.length > 0) {
      const existingIdxRes = await tablesDB.listIndexes({
        databaseId: actualDatabaseId,
        tableId: actualTableId,
        queries: [Query.limit(100)],
      });
      const existingIdxKeys = new Set(existingIdxRes.indexes.map((i) => i.key));
      const missingIdx = table.indexes.filter((idx) => !existingIdxKeys.has(idx.key));
      if (missingIdx.length > 0) {
        const indexCols = Array.from(new Set(missingIdx.flatMap((idx) => idx.columns)));
        await waitForColumnsAvailable(actualDatabaseId, actualTableId, indexCols);
        for (const idx of missingIdx) {
          await createIndexWithRetry(actualDatabaseId, actualTableId, idx);
        }
      }
    }

    console.log(`Table provisioned: ${table.id} -> ${actualTableId}`);
  }

  // Provision & deploy Cloud Functions
  const functionSpecs = [
    {
      key: 'economyFunctionId' as const,
      preferredId: 'fadfada-economy',
      name: 'fadfada-economy',
      dir: path.resolve(process.cwd(), 'appwrite-functions', 'fadfada-economy'),
    },
    {
      key: 'adminFunctionId' as const,
      preferredId: 'fadfada-admin',
      name: 'fadfada-admin',
      dir: path.resolve(process.cwd(), 'appwrite-functions', 'fadfada-admin'),
    },
  ];

  const fnScopes: ProjectKeyScopes[] = [
    ProjectKeyScopes.UsersRead,
    ProjectKeyScopes.UsersWrite,
    ProjectKeyScopes.DatabasesRead,
    ProjectKeyScopes.DatabasesWrite,
    ProjectKeyScopes.TablesRead,
    ProjectKeyScopes.RowsRead,
    ProjectKeyScopes.RowsWrite,
  ];

  const actualFunctionIds: Record<'economyFunctionId' | 'adminFunctionId', string> = {
    economyFunctionId: '',
    adminFunctionId: '',
  };

  for (const fn of functionSpecs) {
    let fnId = fn.preferredId;
    let currentScopes: ProjectKeyScopes[] = [];
    let exists = false;
    try {
      const existingFn = await functionsApi.get({ functionId: fn.preferredId });
      fnId = existingFn.$id;
      currentScopes = (existingFn.scopes || []) as ProjectKeyScopes[];
      exists = true;
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code !== 404) throw err;
    }

    if (!exists) {
      try {
        const createdFn = await functionsApi.create({
          functionId: fn.preferredId,
          name: fn.name,
          runtime: Runtime.Node22,
          execute: ['users'],
          timeout: 15,
          enabled: true,
          logging: true,
          entrypoint: 'src/main.js',
          commands: 'npm install',
          scopes: fnScopes,
        });
        fnId = createdFn.$id;
        currentScopes = fnScopes;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes('cannot grant scopes')) throw err;
        const createdMinimal = await functionsApi.create({
          functionId: fn.preferredId,
          name: fn.name,
          runtime: Runtime.Node22,
          execute: ['users'],
          timeout: 15,
          enabled: true,
          logging: true,
          entrypoint: 'src/main.js',
          commands: 'npm install',
          scopes: [],
        });
        fnId = createdMinimal.$id;
        currentScopes = [];
      }
    }

    // Grant any missing scopes that the API key holds without failing on unheld scopes
    const missingScopes = fnScopes.filter((s) => !currentScopes.includes(s));
    if (missingScopes.length > 0) {
      const rejectedScopes: string[] = [];
      for (const scope of missingScopes) {
        try {
          const next = [...currentScopes, scope];
          await functionsApi.update({
            functionId: fnId,
            name: fn.name,
            runtime: Runtime.Node22,
            execute: ['users'],
            timeout: 15,
            enabled: true,
            logging: true,
            entrypoint: 'src/main.js',
            commands: 'npm install',
            scopes: next,
          });
          currentScopes = next;
        } catch {
          rejectedScopes.push(scope);
        }
      }
      if (rejectedScopes.length > 0) {
        console.warn(
          `Function ${fnId} created/updated, but API key lacked permission to grant scopes: ${rejectedScopes.join(', ')}`
        );
      }
    }

    actualFunctionIds[fn.key] = fnId;

    const varList = await functionsApi.listVariables({
      functionId: fnId,
      queries: [Query.limit(100)],
    });
    const existingVars = new Map(
      varList.variables.map((v) => [v.key, { id: v.$id, value: v.value }])
    );
    await upsertFunctionVar(fnId, 'APPWRITE_DATABASE_ID', actualDatabaseId, existingVars);
    for (const [snakeId, actualId] of Object.entries(tableIdsBySnake)) {
      await upsertFunctionVar(fnId, `APPWRITE_TABLE_${snakeId.toUpperCase()}`, actualId, existingVars);
    }

    const tmpTar = path.join(os.tmpdir(), `${fnId}-${Date.now()}.tar.gz`);
    execFileSync('tar', ['-czf', tmpTar, '-C', fn.dir, '.']);
    try {
      const deployment = await functionsApi.createDeployment({
        functionId: fnId,
        code: InputFile.fromPath(tmpTar, `${fnId}.tar.gz`),
        activate: true,
        entrypoint: 'src/main.js',
        commands: 'npm install',
      });
      await waitForDeploymentReady(fnId, deployment.$id);
      console.log(`Function provisioned & deployed: ${fnId} (deployment ${deployment.$id})`);
    } finally {
      fs.rmSync(tmpTar, { force: true });
    }
  }

  // Best-effort Auth & Platform configuration (requires project.write / platforms.write if granted)
  for (const methodId of [ProjectAuthMethodId.Emailpassword, ProjectAuthMethodId.Anonymous]) {
    try {
      await projectApi.updateAuthMethod({ methodId, enabled: true });
      console.log(`Auth method enabled: ${methodId}`);
    } catch (err) {
      console.warn(`Skipped auth method ${methodId}:`, (err as Error)?.message ?? err);
    }
  }

  for (const hostname of [
    'ais-dev-pbqsbictj5u7fmcb6shgps-547187756541.europe-west2.run.app',
    'ais-pre-pbqsbictj5u7fmcb6shgps-547187756541.europe-west2.run.app',
    'localhost',
  ]) {
    try {
      await projectApi.createWebPlatform({
        platformId: `web_${hostname.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: `Fadfada Web (${hostname.slice(0, 24)})`,
        hostname,
      });
      console.log(`Platform registered: ${hostname}`);
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code !== 409) {
        console.warn(`Skipped platform ${hostname}:`, (err as Error)?.message ?? err);
      }
    }
  }

  // Output 1: Update src/appwrite/resources.json with real Appwrite IDs
  const resourcesPath = path.resolve(process.cwd(), 'src', 'appwrite', 'resources.json');
  const resourcesPayload = {
    provisioned: true,
    endpoint,
    projectId,
    databaseId: actualDatabaseId,
    bucketId: actualBucketId,
    economyFunctionId: actualFunctionIds.economyFunctionId,
    adminFunctionId: actualFunctionIds.adminFunctionId,
    tables: tableIdsByCamel,
  };
  fs.writeFileSync(resourcesPath, `${JSON.stringify(resourcesPayload, null, 2)}\n`, 'utf8');

  // Output 2: Sync resulting IDs into .env (public VITE_ variables only, preserving any existing non-VITE_APPWRITE_* lines)
  const envPath = path.resolve(process.cwd(), '.env');
  const existingLines = fs.existsSync(envPath)
    ? fs
        .readFileSync(envPath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '' && !line.startsWith('VITE_APPWRITE_'))
    : [];
  const envLines = [
    ...existingLines,
    `VITE_APPWRITE_ENDPOINT="${endpoint}"`,
    `VITE_APPWRITE_PROJECT_ID="${projectId}"`,
    `VITE_APPWRITE_DATABASE_ID="${actualDatabaseId}"`,
    `VITE_APPWRITE_STORAGE_BUCKET_ID="${actualBucketId}"`,
    `VITE_APPWRITE_ECONOMY_FUNCTION_ID="${actualFunctionIds.economyFunctionId}"`,
    `VITE_APPWRITE_ADMIN_FUNCTION_ID="${actualFunctionIds.adminFunctionId}"`,
    ...Object.entries(tableIdsBySnake).map(
      ([snakeId, actualId]) => `VITE_APPWRITE_TABLE_${snakeId.toUpperCase()}="${actualId}"`
    ),
  ];
  fs.writeFileSync(envPath, `${envLines.join('\n')}\n`, 'utf8');

  // Output 3: Sync appwrite.json IDs
  const appwriteJsonPath = path.resolve(process.cwd(), 'appwrite.json');
  if (fs.existsSync(appwriteJsonPath)) {
    const appwriteCfg = JSON.parse(fs.readFileSync(appwriteJsonPath, 'utf8')) as {
      projectId?: string;
      tablesDB?: Array<{ $id: string }>;
      buckets?: Array<{ $id: string }>;
      functions?: Array<{ $id: string; name?: string }>;
    };
    appwriteCfg.projectId = projectId;
    if (appwriteCfg.tablesDB?.[0]) appwriteCfg.tablesDB[0].$id = actualDatabaseId;
    if (appwriteCfg.buckets?.[0]) appwriteCfg.buckets[0].$id = actualBucketId;
    if (appwriteCfg.functions?.[0]) appwriteCfg.functions[0].$id = actualFunctionIds.economyFunctionId;
    if (appwriteCfg.functions?.[1]) appwriteCfg.functions[1].$id = actualFunctionIds.adminFunctionId;
    fs.writeFileSync(appwriteJsonPath, `${JSON.stringify(appwriteCfg, null, 2)}\n`, 'utf8');
  }

  console.log(
    `Appwrite setup completed: DB=${actualDatabaseId}, Tables=${Object.keys(tableIdsBySnake).length}, Bucket=${actualBucketId}, Functions=${actualFunctionIds.economyFunctionId}, ${actualFunctionIds.adminFunctionId}`
  );
}

void run().catch((err) => {
  console.error('Appwrite setup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
