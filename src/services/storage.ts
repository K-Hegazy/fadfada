import {
  APPWRITE_CONFIG,
  AppwriteException,
  assertAppwriteConfigured,
  client,
  ID,
  Permission,
  Role,
  storage,
} from '../appwrite/config';
import { parseAppwriteError } from '../appwrite/errors';
import { compressImageFile, validateAudioBlob, validateVideoFile } from '../utils/media';

export const APPWRITE_CHUNK_SIZE = 5 * 1024 * 1024;
const CHUNK_UPLOAD_CONCURRENCY = 4;

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

export interface UploadProgressInfo {
  loaded: number;
  total: number;
  percent: number;
  chunksUploaded: number;
  chunksTotal: number;
}

export interface UploadFileOptions {
  onProgress?: (progress: UploadProgressInfo) => void;
  signal?: AbortSignal;
}

export class UploadAbortedError extends Error {
  readonly isAborted = true;

  constructor(message = 'تم إلغاء رفع الملف.') {
    super(message);
    this.name = 'UploadAbortedError';
  }
}

export function isUploadAbortedError(error: unknown): boolean {
  if (error instanceof UploadAbortedError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: unknown; isAborted?: unknown };
  return candidate.name === 'UploadAbortedError' || candidate.isAborted === true;
}

export interface XhrLike {
  upload: {
    onprogress: ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
  };
  withCredentials: boolean;
  status: number;
  responseText: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  open: (method: string, url: string, async?: boolean) => void;
  setRequestHeader: (name: string, value: string) => void;
  getResponseHeader: (name: string) => string | null;
  send: (body?: Document | XMLHttpRequestBodyInit | null) => void;
  abort: () => void;
}

export interface UploadedFileResponse {
  $id: string;
  chunksTotal?: number;
  chunksUploaded?: number;
  [key: string]: unknown;
}

export function calculateUploadProgress(
  chunkLoadedBytes: number[],
  totalBytes: number,
  chunksCompleted: number,
  chunksTotal: number,
  isComplete = false
): UploadProgressInfo {
  const safeTotal = Math.max(1, totalBytes);
  if (isComplete) {
    return {
      loaded: totalBytes,
      total: totalBytes,
      percent: 100,
      chunksUploaded: chunksTotal,
      chunksTotal,
    };
  }
  const summed = chunkLoadedBytes.reduce((sum, bytes) => sum + Math.max(0, bytes), 0);
  const clampedLoaded = Math.min(totalBytes, Math.max(0, summed));
  const rawPercent = Math.round((clampedLoaded / safeTotal) * 100);
  const percent = Math.min(99, Math.max(0, rawPercent));
  return {
    loaded: clampedLoaded,
    total: totalBytes,
    percent,
    chunksUploaded: Math.min(chunksTotal, Math.max(0, chunksCompleted)),
    chunksTotal,
  };
}

function getClientDefaultHeaders(): Record<string, string> {
  const internalClient = client as unknown as { headers?: Record<string, string> };
  const headers: Record<string, string> = Object.assign({}, internalClient.headers ?? {});
  if (APPWRITE_CONFIG.projectId && !headers['X-Appwrite-Project'] && !headers['x-appwrite-project']) {
    headers['X-Appwrite-Project'] = APPWRITE_CONFIG.projectId;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cookieFallback = window.localStorage.getItem('cookieFallback');
      if (cookieFallback) {
        headers['X-Fallback-Cookies'] = cookieFallback;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return headers;
}

function parseXhrJsonResponse(xhr: XhrLike): UploadedFileResponse {
  const rawText = xhr.responseText || '';
  if (!rawText) return { $id: '' };
  try {
    return JSON.parse(rawText) as UploadedFileResponse;
  } catch {
    return { $id: '', message: rawText };
  }
}

export interface TransportUploadParams {
  endpoint: string;
  bucketId: string;
  fileId: string;
  file: File;
  permissions: string[];
  headers?: Record<string, string>;
  chunkSize?: number;
  concurrency?: number;
  onProgress?: (progress: UploadProgressInfo) => void;
  signal?: AbortSignal;
  createXhr?: () => XhrLike;
  onAbortPartialUpload?: (uploadId: string) => void;
}

export async function uploadFileWithProgress({
  endpoint,
  bucketId,
  fileId,
  file,
  permissions,
  headers: extraHeaders,
  chunkSize = APPWRITE_CHUNK_SIZE,
  concurrency = CHUNK_UPLOAD_CONCURRENCY,
  onProgress,
  signal,
  createXhr = () => new XMLHttpRequest() as unknown as XhrLike,
  onAbortPartialUpload,
}: TransportUploadParams): Promise<UploadedFileResponse> {
  if (signal?.aborted) {
    throw new UploadAbortedError();
  }

  const normalizedEndpoint = endpoint.replace(/\/+$/, '');
  const uploadUrl = `${normalizedEndpoint}/storage/buckets/${encodeURIComponent(bucketId)}/files`;
  const totalBytes = file.size;
  const totalChunks = Math.max(1, Math.ceil(totalBytes / chunkSize));
  const chunkLoadedBytes = new Array<number>(totalChunks).fill(0);
  let chunksCompleted = 0;
  let uploadId = '';
  let aborted = false;
  const activeXhrs = new Set<XhrLike>();

  const emitProgress = (isComplete = false) => {
    if (!onProgress || aborted) return;
    onProgress(
      calculateUploadProgress(
        chunkLoadedBytes,
        totalBytes,
        chunksCompleted,
        totalChunks,
        isComplete
      )
    );
  };

  const handleSignalAbort = () => {
    if (aborted) return;
    aborted = true;
    for (const xhr of activeXhrs) {
      try {
        xhr.abort();
      } catch {
        // Ignore abort errors on closed XHR
      }
    }
    activeXhrs.clear();
    if (uploadId && onAbortPartialUpload) {
      onAbortPartialUpload(uploadId);
    }
  };

  if (signal) {
    signal.addEventListener('abort', handleSignalAbort, { once: true });
  }

  const sendChunkXhr = (
    chunkIndex: number,
    chunkFile: File,
    chunkHeaders: Record<string, string>
  ): Promise<UploadedFileResponse> => {
    if (aborted || signal?.aborted) {
      return Promise.reject(new UploadAbortedError());
    }

    const chunkByteSize = chunkFile.size;

    return new Promise<UploadedFileResponse>((resolve, reject) => {
      const xhr = createXhr();
      activeXhrs.add(xhr);

      const cleanup = () => {
        activeXhrs.delete(xhr);
        xhr.upload.onprogress = null;
        xhr.onload = null;
        xhr.onerror = null;
        xhr.onabort = null;
      };

      xhr.open('POST', uploadUrl, true);
      xhr.withCredentials = true;

      const mergedHeaders: Record<string, string> = {
        accept: 'application/json',
        ...(extraHeaders ?? getClientDefaultHeaders()),
        ...chunkHeaders,
      };
      for (const [key, value] of Object.entries(mergedHeaders)) {
        if (key.toLowerCase() === 'content-type') continue;
        if (typeof value === 'string' && value.length > 0) {
          xhr.setRequestHeader(key, value);
        }
      }

      xhr.upload.onprogress = (event) => {
        if (aborted || signal?.aborted) return;
        if (event.lengthComputable && event.total > 0) {
          const ratio = Math.min(1, Math.max(0, event.loaded / event.total));
          chunkLoadedBytes[chunkIndex] = Math.min(
            chunkByteSize,
            Math.round(ratio * chunkByteSize)
          );
          emitProgress(false);
        }
      };

      xhr.onabort = () => {
        cleanup();
        reject(new UploadAbortedError());
      };

      xhr.onerror = () => {
        cleanup();
        if (aborted || signal?.aborted) {
          reject(new UploadAbortedError());
          return;
        }
        reject(new Error('تعذر الاتصال بخادم التخزين أثناء رفع الملف.'));
      };

      xhr.onload = () => {
        cleanup();
        if (aborted || signal?.aborted) {
          reject(new UploadAbortedError());
          return;
        }

        const fallbackCookies = xhr.getResponseHeader('X-Fallback-Cookies');
        if (fallbackCookies && typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.setItem('cookieFallback', fallbackCookies);
          } catch {
            // Ignore storage access errors
          }
        }

        const parsed = parseXhrJsonResponse(xhr);
        if (xhr.status >= 400 || xhr.status === 0) {
          const errMessage =
            typeof parsed.message === 'string' && parsed.message.length > 0
              ? parsed.message
              : xhr.responseText || `HTTP ${xhr.status}`;
          const errType = typeof parsed.type === 'string' ? parsed.type : '';
          reject(new AppwriteException(errMessage, xhr.status, errType, xhr.responseText));
          return;
        }

        chunkLoadedBytes[chunkIndex] = chunkByteSize;
        chunksCompleted += 1;
        emitProgress(false);
        resolve(parsed);
      };

      const formData = new FormData();
      formData.append('fileId', fileId);
      formData.append('file', chunkFile, chunkFile.name);
      for (const perm of permissions) {
        formData.append('permissions[]', perm);
      }

      if (aborted || signal?.aborted) {
        cleanup();
        reject(new UploadAbortedError());
        return;
      }

      xhr.send(formData);
    });
  };

  try {
    emitProgress(false);

    if (totalBytes <= chunkSize) {
      const response = await sendChunkXhr(0, file, {});
      emitProgress(true);
      return response;
    }

    const firstChunkEnd = Math.min(chunkSize, totalBytes);
    const firstChunkSlice = file.slice(0, firstChunkEnd);
    const firstChunkFile = new File([firstChunkSlice], file.name, {
      type: file.type || 'application/octet-stream',
    });

    const firstResponse = await sendChunkXhr(0, firstChunkFile, {
      'content-range': `bytes 0-${firstChunkEnd - 1}/${totalBytes}`,
    });

    uploadId = String(firstResponse.$id || fileId);
    if (totalChunks === 1) {
      emitProgress(true);
      return firstResponse;
    }

    const remainingChunks: Array<{ index: number; start: number; end: number }> = [];
    for (let i = 1; i < totalChunks; i += 1) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalBytes);
      remainingChunks.push({ index: i, start, end });
    }

    let lastResponse = firstResponse;
    let finalResponse: UploadedFileResponse | null = null;
    let nextQueueIdx = 0;
    let inFlight = 0;
    let completedRemaining = 0;
    let failed = false;

    const isUploadComplete = (res: UploadedFileResponse): boolean =>
      typeof res.chunksUploaded === 'number' &&
      typeof (res.chunksTotal ?? totalChunks) === 'number' &&
      res.chunksUploaded >= (res.chunksTotal ?? totalChunks);

    await new Promise<void>((resolve, reject) => {
      const pump = () => {
        if (failed || aborted || signal?.aborted) {
          if (!failed) {
            failed = true;
            reject(new UploadAbortedError());
          }
          return;
        }
        if (completedRemaining === remainingChunks.length) {
          resolve();
          return;
        }
        while (inFlight < concurrency && nextQueueIdx < remainingChunks.length) {
          const item = remainingChunks[nextQueueIdx++];
          inFlight += 1;
          const chunkSlice = file.slice(item.start, item.end);
          const chunkFile = new File([chunkSlice], file.name, {
            type: file.type || 'application/octet-stream',
          });
          const chunkHeaders: Record<string, string> = {
            'content-range': `bytes ${item.start}-${item.end - 1}/${totalBytes}`,
          };
          if (uploadId) {
            chunkHeaders['x-appwrite-id'] = uploadId;
          }

          sendChunkXhr(item.index, chunkFile, chunkHeaders)
            .then((chunkRes) => {
              inFlight -= 1;
              completedRemaining += 1;
              lastResponse = chunkRes;
              if (isUploadComplete(chunkRes)) {
                finalResponse = chunkRes;
              }
              pump();
            })
            .catch((err) => {
              if (!failed) {
                failed = true;
                for (const xhr of activeXhrs) {
                  try {
                    xhr.abort();
                  } catch {
                    // Ignore abort errors
                  }
                }
                activeXhrs.clear();
                reject(err);
              }
            });
        }
      };

      pump();
    });

    emitProgress(true);
    return finalResponse ?? lastResponse;
  } finally {
    if (signal) {
      signal.removeEventListener('abort', handleSignalAbort);
    }
  }
}

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
  file: File,
  options?: UploadFileOptions
): Promise<string> {
  assertAppwriteConfigured();
  if (options?.signal?.aborted) {
    throw new UploadAbortedError();
  }
  try {
    const fileId = ID.unique();
    const renamed = new File([file], `${folder}_${ownerId.slice(0, 8)}_${file.name}`, {
      type: file.type || 'application/octet-stream',
    });
    const permissions = [
      Permission.read(Role.any()),
      Permission.delete(Role.user(ownerId)),
    ];

    let uploadedId = '';
    if (typeof XMLHttpRequest !== 'undefined') {
      const uploaded = await uploadFileWithProgress({
        endpoint: APPWRITE_CONFIG.endpoint,
        bucketId: APPWRITE_CONFIG.bucketId,
        fileId,
        file: renamed,
        permissions,
        onProgress: options?.onProgress,
        signal: options?.signal,
        onAbortPartialUpload: (partialId) => {
          void storage
            .deleteFile({
              bucketId: APPWRITE_CONFIG.bucketId,
              fileId: partialId,
            })
            .catch(() => {});
        },
      });
      uploadedId = String(uploaded.$id || fileId);
    } else {
      const uploaded = await storage.createFile({
        bucketId: APPWRITE_CONFIG.bucketId,
        fileId,
        file: renamed,
        permissions,
        onProgress: options?.onProgress
          ? (p) => {
              options.onProgress?.({
                loaded: p.sizeUploaded,
                total: renamed.size,
                percent: Math.min(100, Math.max(0, Math.round(p.progress))),
                chunksUploaded: p.chunksUploaded,
                chunksTotal: p.chunksTotal,
              });
            }
          : undefined,
      });
      uploadedId = uploaded.$id;
      options?.onProgress?.({
        loaded: renamed.size,
        total: renamed.size,
        percent: 100,
        chunksUploaded: 1,
        chunksTotal: 1,
      });
    }

    return storage.getFileView({
      bucketId: APPWRITE_CONFIG.bucketId,
      fileId: uploadedId,
    });
  } catch (error) {
    if (isUploadAbortedError(error)) {
      throw error instanceof UploadAbortedError ? error : new UploadAbortedError();
    }
    throw parseAppwriteError(error);
  }
}

export async function uploadImageAsset(
  folder: Exclude<StorageFolder, 'chats'>,
  ownerId: string,
  file: File,
  options?: UploadFileOptions
): Promise<string> {
  const compressed = await compressImageFile(file);
  if (options?.signal?.aborted) {
    throw new UploadAbortedError();
  }
  const uploadFile = buildFileObject(
    compressed,
    folder,
    file.type === 'image/gif' ? 'gif' : 'webp',
    file.type === 'image/gif' ? 'image/gif' : 'image/webp'
  );
  return await uploadToAppwriteBucket(folder, ownerId, uploadFile, options);
}

export async function uploadStoryVideo(
  uid: string,
  file: File,
  options?: UploadFileOptions
): Promise<string> {
  validateVideoFile(file, 15);
  return await uploadToAppwriteBucket('stories', uid, file, options);
}

export async function uploadChatImage(
  conversationId: string,
  uid: string,
  file: File,
  options?: UploadFileOptions
): Promise<string> {
  const compressed = await compressImageFile(file);
  if (options?.signal?.aborted) {
    throw new UploadAbortedError();
  }
  const uploadFile = buildFileObject(
    compressed,
    `chat_${conversationId.slice(0, 10)}`,
    file.type === 'image/gif' ? 'gif' : 'webp',
    file.type === 'image/gif' ? 'image/gif' : 'image/webp'
  );
  return await uploadToAppwriteBucket('chats', uid, uploadFile, options);
}

export async function uploadChatVideo(
  conversationId: string,
  uid: string,
  file: File,
  options?: UploadFileOptions
): Promise<string> {
  validateVideoFile(file, 15);
  const uploadFile = buildFileObject(
    file,
    `video_${conversationId.slice(0, 10)}`,
    'mp4',
    file.type || 'video/mp4'
  );
  return await uploadToAppwriteBucket('chats', uid, uploadFile, options);
}

export async function uploadChatVoice(
  conversationId: string,
  uid: string,
  blob: Blob,
  options?: UploadFileOptions
): Promise<string> {
  validateAudioBlob(blob, 10);
  const uploadFile = buildFileObject(blob, `voice_${conversationId.slice(0, 10)}`, 'webm');
  return await uploadToAppwriteBucket('chats', uid, uploadFile, options);
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
