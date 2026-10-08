import React, { useState, useEffect, useRef } from 'react';
import { Clock, ShieldAlert, X } from 'lucide-react';
import { apiRequest } from '../services/api';

interface SelfDestructModalProps {
  messageId: string;
  mediaUrl: string;
  duration?: number;
  onClose: () => void;
}

export const SelfDestructModal: React.FC<SelfDestructModalProps> = ({
  messageId,
  mediaUrl,
  duration = 10,
  onClose
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(duration);
  const destroyedRef = useRef<boolean>(false);

  const performDestruction = async () => {
    if (destroyedRef.current) return;
    destroyedRef.current = true;
    try {
      await apiRequest(`/messages/${messageId}/destroy-now`, { method: 'POST' });
    } catch (e) {
      // Ignore network errors on cleanup
    } finally {
      onClose();
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          performDestruction();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      if (!destroyedRef.current) {
        performDestruction();
      }
    };
  }, [messageId]);

  const percentage = Math.max(0, Math.min(100, (secondsLeft / duration) * 100));

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-in fade-in select-none"
      dir="rtl"
    >
      {/* Top Banner */}
      <div className="w-full max-w-lg flex items-center justify-between bg-neutral-900/90 border border-amber-500/40 rounded-2xl p-3.5 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/40">
            <ShieldAlert className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-300 font-cairo">
              صورة مؤقتة ذاتية التدمير (عرض لمرة واحدة)
            </div>
            <div className="text-[10px] text-neutral-400 font-tajawal">
              يتم تدمير الصورة ومسحها من السيرفر نهائياً فور انتهاء العداد
            </div>
          </div>
        </div>

        {/* Countdown Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 font-black text-sm font-cairo">
          <Clock className="w-4 h-4 animate-spin" />
          <span>{secondsLeft} ث</span>
        </div>
      </div>

      {/* Progress Line */}
      <div className="w-full max-w-lg h-1.5 bg-neutral-800 rounded-full overflow-hidden my-2">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-1000 ease-linear rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* The Self-Destruct Image */}
      <div className="flex-1 w-full max-w-2xl flex items-center justify-center p-2 min-h-0">
        <div className="relative max-h-full max-w-full rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl bg-neutral-950 flex items-center justify-center">
          <img
            src={mediaUrl}
            alt="صورة ذاتية التدمير"
            className="max-h-[68vh] sm:max-h-[72vh] w-auto max-w-full object-contain pointer-events-none select-none"
            onContextMenu={e => e.preventDefault()}
          />
        </div>
      </div>

      {/* Footer Close & Destroy button */}
      <div className="w-full max-w-lg pt-2">
        <button
          onClick={performDestruction}
          className="w-full py-3 rounded-2xl bg-rose-950/80 hover:bg-rose-900 border border-rose-700/60 text-rose-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-lg shadow-rose-950/50"
        >
          <X className="w-4 h-4" />
          <span>إغلاق وتدمير الصورة الآن</span>
        </button>
      </div>
    </div>
  );
};
