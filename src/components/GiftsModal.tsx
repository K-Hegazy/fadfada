import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { Gift } from '../types';
import { useAuth } from '../context/AuthContext';
import { X, Coins, Sparkles, Send, Check } from 'lucide-react';

interface GiftsModalProps {
  recipientId: string;
  recipientName?: string;
  roomId?: string;
  onClose: () => void;
  onSent?: () => void;
}

export const GiftsModal: React.FC<GiftsModalProps> = ({
  recipientId,
  recipientName,
  roomId,
  onClose,
  onSent
}) => {
  const { user, updateCoins } = useAuth();
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [selectedGift, setSelectedGift] = useState<Gift | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ gifts: Gift[] }>('/gifts')
      .then(res => setGifts(res.gifts))
      .catch(console.error);
  }, []);

  const handleSendGift = async () => {
    if (!selectedGift) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest('/gifts/send', {
        method: 'POST',
        body: JSON.stringify({
          receiverId: recipientId,
          giftId: selectedGift.id,
          roomId
        })
      });

      updateCoins(-selectedGift.price_coins);
      setSuccess(true);
      setTimeout(() => {
        if (onSent) onSent();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'فشل إرسال الهدية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#0e1017] border border-neutral-800 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 max-h-[92dvh] flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <div>
            <h3 className="font-cairo font-bold text-base sm:text-lg text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              إرسال هدية مميزة
            </h3>
            {recipientName && (
              <p className="text-[11px] sm:text-xs text-neutral-400">إلى: {recipientName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-xl text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Balance */}
        <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-950/30 border border-amber-800/40 flex items-center justify-between">
          <span className="text-xs text-amber-200">رصيد محفظتك الحالي:</span>
          <div className="flex items-center gap-1.5 font-cairo font-black text-amber-400 text-xs sm:text-sm">
            <Coins className="w-4 h-4" />
            <span>{user?.coins || 0} كوينز</span>
          </div>
        </div>

        {error && (
          <div className="p-2.5 sm:p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="text-5xl animate-bounce">
              {selectedGift?.icon || '🎁'}
            </div>
            <div className="font-cairo font-bold text-white text-lg">
              تم إرسال {selectedGift?.arabic_name} بنجاح!
            </div>
            <p className="text-xs text-emerald-400 font-tajawal">
              تم إشعار المستلم وإضافة نقاط الخبرة إلى حسابك ✨
            </p>
          </div>
        ) : (
          <>
            {/* Gifts Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-2.5 max-h-56 sm:max-h-60 overflow-y-auto p-1">
              {gifts.map((g) => {
                const isSelected = selectedGift?.id === g.id;
                const canAfford = (user?.coins || 0) >= g.price_coins;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGift(g)}
                    className={`p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-between active:scale-95 ${
                      isSelected
                        ? 'bg-amber-950/60 border-amber-500 scale-105 shadow-md shadow-amber-950/50'
                        : canAfford
                        ? 'bg-neutral-900/60 hover:bg-neutral-800/80 border-neutral-800'
                        : 'bg-neutral-900/20 border-neutral-900 opacity-50'
                    }`}
                  >
                    <span className="text-2xl sm:text-3xl my-1">{g.icon}</span>
                    <div className="text-[10px] sm:text-[11px] font-bold text-neutral-200 truncate w-full">
                      {g.arabic_name}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-semibold text-amber-400 flex items-center gap-0.5 mt-1">
                      <span>{g.price_coins}</span>
                      <Coins className="w-2.5 h-2.5" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Send Button */}
            <button
              disabled={!selectedGift || loading || (user?.coins || 0) < (selectedGift?.price_coins || 0)}
              onClick={handleSendGift}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-sm shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>
                {selectedGift
                  ? `إرسال ${selectedGift.arabic_name} (${selectedGift.price_coins} كوينز)`
                  : 'اختر هدية للإرسال'}
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
