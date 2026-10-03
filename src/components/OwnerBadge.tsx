import React from 'react';
import { Crown, ShieldCheck } from 'lucide-react';

interface OwnerBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
  variant?: 'gold' | 'compact' | 'pill';
}

/**
 * Checks if a user is the platform Owner
 */
export function isUserOwner(user?: { role?: string; username?: string; isOwner?: boolean } | null): boolean {
  if (!user) return false;
  return user.role === 'owner' || user.isOwner === true || user.username?.toLowerCase() === 'hegazy';
}

export const OwnerBadge: React.FC<OwnerBadgeProps> = ({
  size = 'sm',
  showLabel = true,
  className = '',
  variant = 'gold'
}) => {
  const sizeClasses = {
    xs: {
      container: 'px-1.5 py-0.2 text-[9px] gap-0.5 rounded-md',
      icon: 'w-2.5 h-2.5',
      text: 'text-[9px]'
    },
    sm: {
      container: 'px-2 py-0.5 text-[10px] sm:text-[11px] gap-1 rounded-lg',
      icon: 'w-3 h-3',
      text: 'text-[10px] sm:text-[11px]'
    },
    md: {
      container: 'px-2.5 py-1 text-xs gap-1.5 rounded-xl',
      icon: 'w-3.5 h-3.5',
      text: 'text-xs'
    },
    lg: {
      container: 'px-3.5 py-1.5 text-sm gap-2 rounded-2xl',
      icon: 'w-4 h-4',
      text: 'text-sm font-black'
    }
  };

  const currentSize = sizeClasses[size];

  return (
    <span
      dir="rtl"
      title="المالك الرسمي لمنصة فضفضه 👑"
      className={`inline-flex items-center font-cairo font-bold select-none transition-all duration-300 ${
        variant === 'compact'
          ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]'
          : 'bg-gradient-to-r from-amber-500/25 via-yellow-500/35 to-amber-600/25 border border-amber-400/90 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)] hover:shadow-[0_0_16px_rgba(245,158,11,0.4)] backdrop-blur-sm'
      } ${currentSize.container} ${className}`}
    >
      <Crown className={`${currentSize.icon} text-amber-300 drop-shadow animate-pulse shrink-0 fill-amber-400/40`} />
      {showLabel && (
        <span className={`${currentSize.text} font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300`}>
          المالك
        </span>
      )}
    </span>
  );
};
