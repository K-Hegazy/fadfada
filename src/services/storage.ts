import {
  APPWRITE_CONFIG,
  assertAppwriteConfigured,
  ID,
  Permission,
  Role,
  storage,
} from '../appwrite/config';
import { parseAppwriteError } from '../appwrite/errors';
import { compressImageFile, validateAudioBlob, validateVideoFile } from '../utils/media';

export type StorageFolder =
  | 'avatars'
  | 'covers'
  | 'stories'
  | 'wall'
  | 'store'
  | 'badges'
  | 'gifts'
  | 'chats';

export type MediaKind = 'image' | 'video' | 'audio';

function buildFileObject(input: File | Blob, prefix: string, fallbackExt: string, mimeOverride?: string): File {
  if (input instanceof File) {
    return input;
  }
  const type = mimeOverride || input.type || 'application/octet-stream';
  const ext = type.split('/')[1]?.split(';')[0] || fallbackExt;
  return new File([input], `${prefix}_${Date.now()}.${ext}`, { type });
}

async function uploadToAppwriteBucket(
  folder: StorageFolder,
  ownerId: string,
  file: File
): Promise<string> {
  assertAppwriteConfigured();
  try {
    const fileId = ID.unique();
    const renamed = new File([file], `${folder}_${ownerId.slice(0, 8)}_${file.name}`, {
      type: file.type || 'application/octet-stream',
    });

    const uploaded = await storage.createFile({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId,
      file: renamed,
      permissions: [
        Permission.read(Role.any()),
        Permission.delete(Role.user(ownerId)),
      ],
    });

    return storage.getFileView({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId: uploaded.$id,
    });
  } catch (error) {
    throw parseAppwriteError(error);
  }
}

export async function uploadImageAsset(
  folder: Exclude<StorageFolder, 'chats'>,
  ownerId: string,
  file: File
): Promise<string> {
  const compressed = await compressImageFile(file);
  const uploadFile = buildFileObject(
    compressed,
    folder,
    file.type === 'image/gif' ? 'gif' : 'webp',
    file.type === 'image/gif' ? 'image/gif' : 'image/webp'
  );
  return await uploadToAppwriteBucket(folder, ownerId, uploadFile);
}

export async function uploadStoryVideo(uid: string, file: File): Promise<string> {
  validateVideoFile(file, 15);
  return await uploadToAppwriteBucket('stories', uid, file);
}

export async function uploadChatImage(
  conversationId: string,
  uid: string,
  file: File
): Promise<string> {
  const compressed = await compressImageFile(file);
  const uploadFile = buildFileObject(
    compressed,
    `chat_${conversationId.slice(0, 10)}`,
    file.type === 'image/gif' ? 'gif' : 'webp',
    file.type === 'image/gif' ? 'image/gif' : 'image/webp'
  );
  return await uploadToAppwriteBucket('chats', uid, uploadFile);
}

export async function uploadChatVideo(
  conversationId: string,
  uid: string,
  file: File
): Promise<string> {
  validateVideoFile(file, 15);
  const uploadFile = buildFileObject(
    file,
    `video_${conversationId.slice(0, 10)}`,
    'mp4',
    file.type || 'video/mp4'
  );
  return await uploadToAppwriteBucket('chats', uid, uploadFile);
}

export async function uploadChatVoice(
  conversationId: string,
  uid: string,
  blob: Blob
): Promise<string> {
  validateAudioBlob(blob, 10);
  const uploadFile = buildFileObject(blob, `voice_${conversationId.slice(0, 10)}`, 'webm');
  return await uploadToAppwriteBucket('chats', uid, uploadFile);
}

export function extractFileIdFromViewUrl(url: string): string | null {
  const match = /\/files\/([^/]+)\/(?:view|download|preview)/.exec(url);
  return match?.[1] ?? null;
}

export async function deleteMediaFile(fileIdOrUrl: string): Promise<void> {
  assertAppwriteConfigured();
  const fileId = fileIdOrUrl.includes('/files/')
    ? extractFileIdFromViewUrl(fileIdOrUrl)
    : fileIdOrUrl;
  if (!fileId) return;
  try {
    await storage.deleteFile({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId,
    });
  } catch {
    // Non-blocking cleanup
  }
}
