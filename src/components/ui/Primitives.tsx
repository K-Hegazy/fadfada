import React from 'react';
import { AlertCircle, CheckCircle2, Coins } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  action,
}) => (
  <header className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200/80 dark:border-white/10">
    <div className="flex items-center gap-2.5 min-w-0">
      {icon && (
        <div className="w-8 h-8 rounded-lg bg-[#E6F4F0] dark:bg-[#132E28] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h1 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-slate-50 truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </header>
);

export interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
}

interface SegmentedTabsProps<T extends string> {
  items: Array<SegmentedTabItem<T>>;
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedTabs<T extends string>({
  items,
  value,
  onChange,
}: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 overflow-x-auto pb-0.5 fadfada-scroll"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = value === item.id;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              active
                ? 'bg-[#0B7A62] text-white'
                : 'bg-white dark:bg-[#121B20] border border-slate-200/90 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#18242B]'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{item.label}</span>
            {typeof item.count === 'number' && item.count > 0 && (
              <span
                className={`font-mono tabular-nums text-[11px] ${
                  active ? 'text-white/85' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                ({item.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface FeedbackBannerProps {
  type: 'success' | 'error';
  message: string;
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({ type, message }) => (
  <div
    role={type === 'error' ? 'alert' : 'status'}
    className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 fadfada-enter ${
      type === 'success'
        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200'
        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80 text-rose-800 dark:text-rose-200'
    }`}
  >
    {type === 'success' ? (
      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
    ) : (
      <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
    )}
    <span className="leading-relaxed">{message}</span>
  </div>
);

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <div className="p-6 text-center rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2.5">
    <div className="w-10 h-10 rounded-xl bg-[#E6F4F0] dark:bg-[#132E28] text-[#0B7A62] dark:text-[#34D399] flex items-center justify-center mx-auto">
      {icon}
    </div>
    <div className="space-y-1 max-w-sm mx-auto">
      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    {action && <div className="pt-1">{action}</div>}
  </div>
);

export const SectionSkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="space-y-2" aria-busy="true" aria-label="جاري التحميل">
    {Array.from({ length: rows }).map((_, idx) => (
      <div
        key={idx}
        className="p-3.5 rounded-xl bg-white dark:bg-[#121B20] border border-slate-200/80 dark:border-white/10 space-y-2 animate-pulse"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-[#1E2D36]" />
          <div className="space-y-1.5 flex-1">
            <div className="h-3 w-28 rounded bg-slate-200 dark:bg-[#1E2D36]" />
            <div className="h-2.5 w-16 rounded bg-slate-100 dark:bg-[#18242B]" />
          </div>
        </div>
        <div className="h-2.5 w-4/5 rounded bg-slate-100 dark:bg-[#18242B]" />
      </div>
    ))}
  </div>
);

export const CoinWalletChip: React.FC<{
  coins: number;
  onClick?: () => void;
  size?: 'sm' | 'md';
}> = ({ coins, onClick, size = 'sm' }) => {
  const classes = `inline-flex items-center gap-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-700/40 text-amber-700 dark:text-amber-300 font-mono tabular-nums font-bold whitespace-nowrap shrink-0 transition-colors ${
    size === 'md' ? 'min-h-[36px] px-3 text-xs sm:text-sm' : 'min-h-[32px] px-2.5 text-xs'
  } ${onClick ? 'hover:bg-amber-100/80 dark:hover:bg-amber-900/40 cursor-pointer' : ''}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes} title="رصيد العملات والمتجر">
        <Coins className="w-3.5 h-3.5 shrink-0" />
        <span>{coins.toLocaleString('en-US')}</span>
      </button>
    );
  }

  return (
    <span className={classes}>
      <Coins className="w-3.5 h-3.5 shrink-0" />
      <span>{coins.toLocaleString('en-US')}</span>
    </span>
  );
};
