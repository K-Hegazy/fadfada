import React, { useState } from 'react';
import { getInitials } from '../utils/formatters';
import { AVATAR_FRAMES, getGenderStyle } from '../utils/progression';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  frameId?: string;
  gender?: string;
  isOnline?: boolean;
  showPresence?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-8 h-8 text-[11px]',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-18 h-18 text-lg',
};

const DOT_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-2 h-2 border',
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-3.5 h-3.5 border-2',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  frameId = 'none',
  gender,
  isOnline = false,
  showPresence = false,
}) => {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = Boolean(src && src.trim().length > 0 && !imgFailed);
  const hasCustomFrame = Boolean(frameId && frameId !== 'none' && AVATAR_FRAMES[frameId]);
  const ringClass = hasCustomFrame
    ? AVATAR_FRAMES[frameId].ringClass
    : gender
    ? getGenderStyle(gender).avatarRingClass
    : '';

  return (
    <div className="relative inline-flex shrink-0">
      {showImage ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className={`${SIZE_CLASSES[size]} ${ringClass} rounded-full object-cover bg-slate-200 dark:bg-[#1E2D36] border border-slate-200/80 dark:border-white/10`}
        />
      ) : (
        <div
          aria-label={name}
          className={`${SIZE_CLASSES[size]} ${ringClass} rounded-full flex items-center justify-center font-bold bg-[#E6F4F0] text-[#0B7A62] dark:bg-[#132E28] dark:text-[#34D399] border border-[#0B7A62]/15 dark:border-[#34D399]/20 select-none`}
        >
          {getInitials(name)}
        </div>
      )}

      {showPresence && (
        <span
          title={isOnline ? 'متصل الآن' : 'غير متصل'}
          aria-label={isOnline ? 'متصل الآن' : 'غير متصل'}
          className={`absolute bottom-0 left-0 rounded-full border-white dark:border-[#121B20] transition-colors ${DOT_CLASSES[size]} ${
            isOnline
              ? 'bg-emerald-500 dark:bg-emerald-400'
              : 'bg-slate-300 dark:bg-slate-600'
          }`}
        />
      )}
    </div>
  );
};
