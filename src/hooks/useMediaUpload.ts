import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isUploadAbortedError,
  uploadChatImage,
  uploadChatVideo,
  uploadChatVoice,
  type MediaKind,
  type UploadProgressInfo,
} from '../services/storage';

export type UploadTaskStatus = 'idle' | 'uploading' | 'sending_message' | 'success' | 'error';

export interface UploadTaskState {
  status: UploadTaskStatus;
  kind: MediaKind;
  fileName: string;
  fileSize: number;
  loaded: number;
  total: number;
  percent: number;
  errorDetail: string | null;
}

export interface MediaUploadRequest {
  kind: MediaKind;
  scopeId: string;
  uid: string;
  fileName: string;
  fileSize: number;
  file?: File;
  blob?: Blob;
  sendMessage: (mediaUrl: string) => Promise<void>;
  onSuccess?: () => void;
}

interface StoredUploadPayload extends MediaUploadRequest {
  uploadedUrl?: string;
}

export const INITIAL_UPLOAD_TASK: UploadTaskState = {
  status: 'idle',
  kind: 'image',
  fileName: '',
  fileSize: 0,
  loaded: 0,
  total: 0,
  percent: 0,
  errorDetail: null,
};

export function useMediaUpload(scopeKey: string | null) {
  const [uploadTask, setUploadTask] = useState<UploadTaskState>(INITIAL_UPLOAD_TASK);
  const uploadLockRef = useRef(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const uploadGenerationRef = useRef(0);
  const uploadSuccessTimerRef = useRef<number | null>(null);
  const retryPayloadRef = useRef<StoredUploadPayload | null>(null);

  const resetAndAbort = useCallback(() => {
    if (uploadSuccessTimerRef.current !== null) {
      window.clearTimeout(uploadSuccessTimerRef.current);
      uploadSuccessTimerRef.current = null;
    }
    uploadGenerationRef.current += 1;
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    uploadLockRef.current = false;
    retryPayloadRef.current = null;
    setUploadTask(INITIAL_UPLOAD_TASK);
  }, []);

  useEffect(() => {
    return () => {
      resetAndAbort();
    };
  }, [scopeKey, resetAndAbort]);

  const dismissUpload = useCallback(() => {
    if (uploadLockRef.current) return;
    if (uploadSuccessTimerRef.current !== null) {
      window.clearTimeout(uploadSuccessTimerRef.current);
      uploadSuccessTimerRef.current = null;
    }
    retryPayloadRef.current = null;
    setUploadTask(INITIAL_UPLOAD_TASK);
  }, []);

  const executeUpload = useCallback(async (payload: StoredUploadPayload) => {
    if (uploadLockRef.current) return;

    uploadLockRef.current = true;
    if (uploadSuccessTimerRef.current !== null) {
      window.clearTimeout(uploadSuccessTimerRef.current);
      uploadSuccessTimerRef.current = null;
    }

    const generation = ++uploadGenerationRef.current;
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    retryPayloadRef.current = payload;

    setUploadTask({
      status: payload.uploadedUrl ? 'sending_message' : 'uploading',
      kind: payload.kind,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      loaded: payload.uploadedUrl ? payload.fileSize : 0,
      total: payload.fileSize,
      percent: payload.uploadedUrl ? 100 : 0,
      errorDetail: null,
    });

    const onProgress = (progress: UploadProgressInfo) => {
      if (uploadGenerationRef.current !== generation || controller.signal.aborted) return;
      setUploadTask((prev) =>
        prev.status === 'uploading'
          ? {
              ...prev,
              loaded: progress.loaded,
              total: progress.total > 0 ? progress.total : prev.total,
              percent: progress.percent,
            }
          : prev
      );
    };

    try {
      let mediaUrl = payload.uploadedUrl;
      if (!mediaUrl) {
        if (payload.kind === 'image' && payload.file) {
          mediaUrl = await uploadChatImage(payload.scopeId, payload.uid, payload.file, {
            onProgress,
            signal: controller.signal,
          });
        } else if (payload.kind === 'video' && payload.file) {
          mediaUrl = await uploadChatVideo(payload.scopeId, payload.uid, payload.file, {
            onProgress,
            signal: controller.signal,
          });
        } else if (payload.kind === 'audio' && payload.blob) {
          mediaUrl = await uploadChatVoice(payload.scopeId, payload.uid, payload.blob, {
            onProgress,
            signal: controller.signal,
          });
        }
      }

      if (controller.signal.aborted || uploadGenerationRef.current !== generation) {
        return;
      }

      if (!mediaUrl) {
        throw new Error('تعذر الحصول على رابط الملف المرفوع.');
      }

      if (retryPayloadRef.current) {
        retryPayloadRef.current = { ...retryPayloadRef.current, uploadedUrl: mediaUrl };
      }

      setUploadTask((prev) => ({
        ...prev,
        status: 'sending_message',
        loaded: prev.total || payload.fileSize,
        total: prev.total || payload.fileSize,
        percent: 100,
        errorDetail: null,
      }));

      await payload.sendMessage(mediaUrl);

      if (uploadGenerationRef.current !== generation) return;

      payload.onSuccess?.();
      retryPayloadRef.current = null;

      setUploadTask((prev) => ({
        ...prev,
        status: 'success',
        loaded: prev.total || payload.fileSize,
        total: prev.total || payload.fileSize,
        percent: 100,
        errorDetail: null,
      }));

      uploadSuccessTimerRef.current = window.setTimeout(() => {
        if (uploadGenerationRef.current === generation) {
          setUploadTask(INITIAL_UPLOAD_TASK);
          uploadSuccessTimerRef.current = null;
        }
      }, 2200);
    } catch (err) {
      if (
        isUploadAbortedError(err) ||
        controller.signal.aborted ||
        uploadGenerationRef.current !== generation
      ) {
        if (uploadGenerationRef.current === generation) {
          setUploadTask(INITIAL_UPLOAD_TASK);
        }
        retryPayloadRef.current = null;
        return;
      }

      const errorDetail = err instanceof Error ? err.message : 'تعذر رفع الملف.';
      setUploadTask((prev) => ({
        ...prev,
        status: 'error',
        errorDetail,
      }));
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
      }
      uploadLockRef.current = false;
    }
  }, []);

  const startUpload = useCallback(
    (request: MediaUploadRequest) => {
      if (uploadLockRef.current) return false;
      void executeUpload(request);
      return true;
    },
    [executeUpload]
  );

  const retryUpload = useCallback(() => {
    const payload = retryPayloadRef.current;
    if (!payload || uploadLockRef.current) return;
    void executeUpload(payload);
  }, [executeUpload]);

  const isMediaBusy =
    uploadTask.status === 'uploading' || uploadTask.status === 'sending_message';

  return {
    uploadTask,
    isMediaBusy,
    isUploadLocked: () => uploadLockRef.current,
    startUpload,
    cancelUpload: resetAndAbort,
    retryUpload,
    dismissUpload,
  };
}
