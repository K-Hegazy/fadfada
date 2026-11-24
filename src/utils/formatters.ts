import type { AppTimestamp } from '../types/fadfada';

export function timestampToMillis(ts: AppTimestamp | Date | undefined): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return Number.isFinite(ts) ? ts : 0;
  if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? 0 : ts.getTime();
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function formatArabicTime(ts: AppTimestamp | Date | undefined): string {
  const millis = timestampToMillis(ts);
  if (!millis) return 'الآن';
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(millis));
}

export function formatRelativeLastSeen(
  ts: AppTimestamp | Date | undefined,
  isOnline: boolean
): string {
  if (isOnline) return 'متصل الآن';
  const millis = timestampToMillis(ts);
  if (!millis) return 'غير متصل';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - millis) / 1000));
  if (diffSeconds < 60) return 'آخر ظهور قبل لحظات';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `آخر ظهور منذ ${diffMinutes} د`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `آخر ظهور منذ ${diffHours} س`;

  return `آخر ظهور ${new Intl.DateTimeFormat('ar-EG', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(millis))}`;
}

export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'ف';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`;
}

export function formatDurationMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function sanitizeHttpUrl(
  raw?: string | null,
  options?: { allowRelative?: boolean; allowBlob?: boolean }
): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (options?.allowRelative && trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed;
  }
  if (options?.allowBlob && /^blob:/i.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}
