import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Mic,
  RotateCcw,
  Video,
  X,
} from 'lucide-react';
import type { UploadTaskState } from '../hooks/useMediaUpload';
import type { MediaKind } from '../services/storage';

function formatUploadBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMediaKindLabel(kind: MediaKind): string {
  if (kind === 'image') return 'صورة';
  if (kind === 'video') return 'فيديو';
  return 'ملف صوتي';
}

interface MediaUploadProgressBarProps {
  task: UploadTaskState;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

export const MediaUploadProgressBar: React.FC<MediaUploadProgressBarProps> = ({
  task,
  onCancel,
  onRetry,
  onDismiss,
}) => {
  if (task.status === 'idle') return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mb-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
        task.status === 'error'
          ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-100'
          : task.status === 'success'
          ? 'bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-100'
          : 'bg-[#F2F4F7] dark:bg-[#18242B] border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="shrink-0">
            {task.status === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            ) : task.status === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : task.kind === 'image' ? (
              <ImageIcon className="w-4 h-4 text-[#0B7A62] dark:text-[#34D399]" />
            ) : task.kind === 'video' ? (
              <Video className="w-4 h-4 text-[#0B7A62] dark:text-[#34D399]" />
            ) : (
              <Mic className="w-4 h-4 text-[#0B7A62] dark:text-[#34D399]" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold">
                {task.status === 'uploading' && 'جاري رفع الملف...'}
                {task.status === 'sending_message' && 'اكتمل الرفع، جاري إرسال الرسالة...'}
                {task.status === 'success' && 'تم الإرسال بنجاح.'}
                {task.status === 'error' && 'فشل الرفع، مع إمكانية إعادة المحاولة.'}
              </span>
              <span className="font-mono tabular-nums font-bold text-[11px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10">
                {task.percent}%
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] opacity-75 truncate">
              <span>{getMediaKindLabel(task.kind)}</span>
              <span>·</span>
              <span className="truncate">{task.fileName}</span>
              {task.fileSize > 0 && (
                <>
                  <span>·</span>
                  <span className="font-mono tabular-nums shrink-0">
                    {task.status === 'uploading' && task.total > 0
                      ? `${formatUploadBytes(task.loaded)} / ${formatUploadBytes(task.total)}`
                      : formatUploadBytes(task.fileSize)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {task.status === 'uploading' && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[28px] px-2.5 rounded-md bg-white dark:bg-[#121B20] border border-slate-200/90 dark:border-white/15 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>إلغاء الرفع</span>
            </button>
          )}
          {task.status === 'error' && (
            <>
              <button
                type="button"
                onClick={onRetry}
                className="min-h-[28px] px-2.5 rounded-md bg-[#0B7A62] hover:bg-[#08614D] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة</span>
              </button>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="إغلاق"
                className="min-h-[28px] min-w-[28px] px-1.5 rounded-md bg-white dark:bg-[#121B20] border border-slate-200/90 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18242B] inline-flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={task.percent}
        aria-label="نسبة تقدم رفع الملف"
        className="w-full h-2 rounded-full bg-slate-200/90 dark:bg-white/10 overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-150 ease-out ${
            task.status === 'error'
              ? 'bg-rose-500'
              : task.status === 'success'
              ? 'bg-emerald-500'
              : 'bg-[#0B7A62]'
          }`}
          style={{ width: `${task.percent}%` }}
        />
      </div>

      {task.status === 'error' && task.errorDetail && (
        <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300 break-words">
          {task.errorDetail}
        </p>
      )}
    </div>
  );
};
