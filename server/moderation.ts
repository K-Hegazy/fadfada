import { Database as SqlDatabase } from 'sql.js';
import { queryOne } from './db';

// Recent messages cache for duplicate text detection: userId -> { text: string, time: number, count: number }
const recentUserMessages = new Map<string, { text: string; time: number; count: number }>();

// Suspicious link domains / patterns commonly used in malicious abuse or phishing
const SUSPICIOUS_DOMAINS = [
  'iplogger', 'grabify', '2no.co', 'yip.su', 'blasze.tk', 'psh.bz',
  'token-grabber', 'free-nitro', 'free-coins', 'steam-gift', 'discord-nitro'
];

// Common severe profanity / hate speech / harassment words in Arabic and English
const BANNED_WORDS = [
  'كسامك', 'شرموط', 'قحبة', 'منيك', 'عرص', 'خول', 'طيزك', 'متناك', 'سكس', 'porn', 'xxx', 'nigger', 'faggot'
];

export function checkMessageContent(
  userId: string,
  content: string,
  db: SqlDatabase
): { allowed: boolean; reason?: string } {
  if (!content || typeof content !== 'string') {
    return { allowed: true };
  }

  const cleanText = content.trim();

  // Read admin moderation settings from DB
  const profanityEnabled = queryOne(db, "SELECT value FROM system_settings WHERE key = 'profanity_filter_enabled'")?.value !== 'false';
  const suspiciousLinksEnabled = queryOne(db, "SELECT value FROM system_settings WHERE key = 'suspicious_links_filter'")?.value !== 'false';

  // 1. Anti-Duplicate Flood Check
  const now = Date.now();
  const lastMsg = recentUserMessages.get(userId);
  if (lastMsg) {
    if (lastMsg.text === cleanText && (now - lastMsg.time) < 8000) {
      lastMsg.count++;
      if (lastMsg.count >= 3) {
        return {
          allowed: false,
          reason: 'تم منع إرسال نفس الرسالة بشكل متكرر لمنع الإزعاج (Anti-Spam).'
        };
      }
    } else {
      recentUserMessages.set(userId, { text: cleanText, time: now, count: 1 });
    }
  } else {
    recentUserMessages.set(userId, { text: cleanText, time: now, count: 1 });
  }

  // 2. Suspicious Links Filter
  if (suspiciousLinksEnabled) {
    const lowerContent = cleanText.toLowerCase();
    for (const domain of SUSPICIOUS_DOMAINS) {
      if (lowerContent.includes(domain)) {
        return {
          allowed: false,
          reason: 'تم حظر الرابط لاحتوائه على نطاق مشبوه أو غير آمن وفق سياسة الأمان.'
        };
      }
    }
  }

  // 3. Profanity / Offensive Language Filter
  if (profanityEnabled) {
    const normalized = cleanText.replace(/[\u064B-\u065F]/g, ''); // remove diacritics
    for (const badWord of BANNED_WORDS) {
      if (normalized.includes(badWord)) {
        return {
          allowed: false,
          reason: 'تحتوي الرسالة على عبارات تخالف إرشادات المجتمع والآداب العامة لمنصة فضفضه.'
        };
      }
    }
  }

  return { allowed: true };
}
