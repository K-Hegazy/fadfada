import React, { useEffect } from 'react';
import { EyeOff, X } from 'lucide-react';
import { sanitizeHttpUrl } from '../utils/formatters';

interface MediaViewerModalProps {
  open: boolean;
  type: 'image' | 'video';
  url: string;
  caption?: string;
  isViewOnce?: boolean;
  onClose: () => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  open,
  type,
  url,
  caption,
  isViewOnce,
  onClose,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const safeUrl = sanitizeHttpUrl(url, { allowRelative: true, allowBlob: true });
  if (!open || !safeUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/88 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="عارض الوسائط"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2 text-xs">
            {isViewOnce && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-200 font-semibold">
                <EyeOff className="w-3.5 h-3.5" />
                <span>مشاهدة مرة واحدة — ستختفي الوسائط عند الإغلاق</span>
              </span>
            )}
            {caption && !isViewOnce && (
              <span className="text-slate-200 truncate">{caption}</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[36px] min-w-[36px] rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="w-full flex items-center justify-center bg-black/50 rounded-xl overflow-hidden border border-white/10 p-1">
          {type === 'video' ? (
            <video
              src={safeUrl}
              controls
              autoPlay
              playsInline
              controlsList={isViewOnce ? 'nodownload' : undefined}
              className="max-h-[78vh] w-full rounded-lg object-contain bg-black"
            />
          ) : (
            <img
              src={safeUrl}
              alt={caption || 'وسائط مرفقة'}
              referrerPolicy="no-referrer"
              className="max-h-[78vh] max-w-full rounded-lg object-contain select-none"
            />
          )}
        </div>
      </div>
    </div>
  );
};
