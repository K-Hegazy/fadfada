import React from 'react';
import { ExternalLink } from 'lucide-react';
import { useApp } from '../state/AppContext';
import { sanitizeHttpUrl } from '../utils/formatters';

export const AdSlot: React.FC<{ slot: 'header_banner' | 'sidebar_card' | 'feed_inline' }> = ({
  slot,
}) => {
  const { siteSettings } = useApp();
  const ad = siteSettings.ads?.[slot];
  if (!ad || !ad.enabled || !ad.title) return null;
  const safeTargetUrl = sanitizeHttpUrl(ad.targetUrl);

  return (
    <div className="p-3 rounded-xl bg-[#EAF4F1] dark:bg-[#132520] border border-[#0B7A62]/15 dark:border-[#34D399]/15 flex items-center justify-between gap-2.5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-[10px] font-semibold text-[#0B7A62] dark:text-[#34D399]">إعلان ممول</p>
        <p className="text-xs font-bold text-slate-900 dark:text-slate-50 truncate">{ad.title}</p>
        {ad.body && (
          <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {ad.body}
          </p>
        )}
      </div>
      {safeTargetUrl && (
        <a
          href={safeTargetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[34px] px-3 rounded-lg bg-[#0B7A62] hover:bg-[#08634F] text-white text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
        >
          <span>{ad.ctaText || 'زيارة'}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};
