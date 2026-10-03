import type { Request } from 'express';
import geoip from 'geoip-lite';

export interface GeolocationResult {
  country: string; // Arabic country name (e.g. 'مصر', 'السعودية', 'سوريا')
  countryCode: string; // ISO 2-letter country code (e.g. 'EG', 'SA', 'SY')
  detectedAutomatically: boolean;
  method: 'cloudflare_header' | 'appengine_header' | 'geoip_lite' | 'ip_api_fallback' | 'default_fallback';
}

// Comprehensive ISO-3166-1 alpha-2 to Arabic Country Name Mapping
export const ISO_TO_ARABIC: Record<string, string> = {
  // Arab League Countries
  EG: 'مصر',
  SA: 'السعودية',
  AE: 'الإمارات',
  KW: 'الكويت',
  QA: 'قطر',
  BH: 'البحرين',
  OM: 'عمان',
  IQ: 'العراق',
  JO: 'الأردن',
  LB: 'لبنان',
  SY: 'سوريا',
  PS: 'فلسطين',
  YE: 'اليمن',
  MA: 'المغرب',
  DZ: 'الجزائر',
  TN: 'تونس',
  LY: 'ليبيا',
  SD: 'السودان',
  MR: 'موريتانيا',
  SO: 'الصومال',
  DJ: 'جيبوتي',
  KM: 'جزر القمر',

  // Major Worldwide Countries with Arab Diaspora
  TR: 'تركيا',
  US: 'الولايات المتحدة',
  GB: 'المملكة المتحدة',
  DE: 'ألمانيا',
  FR: 'فرنسا',
  CA: 'كندا',
  SE: 'السويد',
  NL: 'هولندا',
  IT: 'إيطاليا',
  ES: 'إسبانيا',
  BE: 'بلجيكا',
  AT: 'النمسا',
  CH: 'سويسرا',
  AU: 'أستراليا',
  RU: 'روسيا',
  MY: 'ماليزيا',
  ID: 'إندونيسيا',
  IN: 'الهند',
  PK: 'باكستان',
  BR: 'البرازيل',
  NO: 'النرويج',
  DK: 'الدنمارك',
  FI: 'فنلندا',
  GR: 'اليونان',
  CY: 'قبرص',
  IR: 'إيران',
  CN: 'الصين',
  JP: 'اليابان',
  KR: 'كوريا الجنوبية'
};

// Reverse mapping for country normalization
export const ARABIC_TO_ISO: Record<string, string> = Object.entries(ISO_TO_ARABIC).reduce(
  (acc, [code, name]) => {
    acc[name] = code;
    return acc;
  },
  {} as Record<string, string>
);

// Standard list of Arab countries for select menus
export const ARAB_COUNTRIES = [
  'مصر',
  'السعودية',
  'الإمارات',
  'الكويت',
  'قطر',
  'البحرين',
  'عمان',
  'العراق',
  'الأردن',
  'لبنان',
  'سوريا',
  'فلسطين',
  'اليمن',
  'المغرب',
  'الجزائر',
  'تونس',
  'ليبيا',
  'السودان',
  'موريتانيا',
  'الصومال',
  'جيبوتي',
  'جزر القمر',
  'تركيا',
  'ألمانيا',
  'المملكة المتحدة',
  'السويد',
  'الولايات المتحدة',
  'كندا',
  'أخرى'
];

/**
 * Check if an IP address belongs to private/internal/loopback ranges
 */
export function isPrivateOrLoopbackIp(ip: string): boolean {
  if (!ip) return true;

  // Clean IPv6 mapped IPv4
  const cleanIp = ip.replace(/^::ffff:/, '').trim();

  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp === 'localhost' ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('169.254.') ||
    cleanIp.startsWith('fc00:') ||
    cleanIp.startsWith('fe80:')
  ) {
    return true;
  }

  // Check 172.16.0.0 - 172.31.255.255
  if (cleanIp.startsWith('172.')) {
    const parts = cleanIp.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extract the real client IP from incoming Express Request
 */
export function getClientIp(req: Request): string {
  // 1. Cloudflare header
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && typeof cfIp === 'string') {
    return cfIp.trim();
  }

  // 2. Standard X-Forwarded-For header (comma-separated list of proxies)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',');
    for (const rawIp of ips) {
      const trimmed = rawIp.replace(/^::ffff:/, '').trim();
      if (trimmed && !isPrivateOrLoopbackIp(trimmed)) {
        return trimmed;
      }
    }
    // If all are private, return the first one
    if (ips[0]) return ips[0].replace(/^::ffff:/, '').trim();
  }

  // 3. X-Real-IP
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.replace(/^::ffff:/, '').trim();
  }

  // 4. Remote Address from socket
  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    return socketIp.replace(/^::ffff:/, '').trim();
  }

  return '127.0.0.1';
}

/**
 * Resolve Arabic Country Name from country code or string
 */
export function resolveArabicCountry(countryInput?: string): { country: string; countryCode: string } {
  if (!countryInput) {
    return { country: 'مصر', countryCode: 'EG' };
  }

  const trimmed = countryInput.trim();
  const upper = trimmed.toUpperCase();

  // If already an ISO code (e.g. 'EG', 'SA')
  if (ISO_TO_ARABIC[upper]) {
    return { country: ISO_TO_ARABIC[upper], countryCode: upper };
  }

  // If Arabic name directly exists in mapping
  if (ARABIC_TO_ISO[trimmed]) {
    return { country: trimmed, countryCode: ARABIC_TO_ISO[trimmed] };
  }

  // Check aliases / partial matches
  if (trimmed === 'Egypt') return { country: 'مصر', countryCode: 'EG' };
  if (trimmed.includes('سعودي') || trimmed === 'Saudi Arabia' || trimmed === 'KSA') {
    return { country: 'السعودية', countryCode: 'SA' };
  }
  if (trimmed.includes('إمارات') || trimmed === 'UAE') {
    return { country: 'الإمارات', countryCode: 'AE' };
  }
  if (trimmed.includes('كويت') || trimmed === 'Kuwait') {
    return { country: 'الكويت', countryCode: 'KW' };
  }
  if (trimmed.includes('سوريا') || trimmed === 'Syria') {
    return { country: 'سوريا', countryCode: 'SY' };
  }
  if (trimmed.includes('عراق') || trimmed === 'Iraq') {
    return { country: 'العراق', countryCode: 'IQ' };
  }
  if (trimmed.includes('أردن') || trimmed === 'Jordan') {
    return { country: 'الأردن', countryCode: 'JO' };
  }
  if (trimmed.includes('مغرب') || trimmed === 'Morocco') {
    return { country: 'المغرب', countryCode: 'MA' };
  }
  if (trimmed.includes('جزائر') || trimmed === 'Algeria') {
    return { country: 'الجزائر', countryCode: 'DZ' };
  }
  if (trimmed.includes('تونس') || trimmed === 'Tunisia') {
    return { country: 'تونس', countryCode: 'TN' };
  }
  if (trimmed.includes('لبنان') || trimmed === 'Lebanon') {
    return { country: 'لبنان', countryCode: 'LB' };
  }
  if (trimmed.includes('فلسطين') || trimmed === 'Palestine') {
    return { country: 'فلسطين', countryCode: 'PS' };
  }
  if (trimmed.includes('يمن') || trimmed === 'Yemen') {
    return { country: 'اليمن', countryCode: 'YE' };
  }
  if (trimmed.includes('سودان') || trimmed === 'Sudan') {
    return { country: 'السودان', countryCode: 'SD' };
  }

  // Default fallback
  return { country: trimmed, countryCode: 'XX' };
}

/**
 * Automatically detect user's country from network information server-side.
 * Never stores or returns GPS coordinates, street address, or exposed IP to other users.
 */
export async function detectUserCountry(req: Request): Promise<GeolocationResult> {
  try {
    // 1. Check Cloudflare Country header
    const cfCountry = req.headers['cf-ipcountry'];
    if (cfCountry && typeof cfCountry === 'string') {
      const code = cfCountry.trim().toUpperCase();
      if (code && code !== 'XX' && code !== 'T1' && ISO_TO_ARABIC[code]) {
        return {
          country: ISO_TO_ARABIC[code],
          countryCode: code,
          detectedAutomatically: true,
          method: 'cloudflare_header'
        };
      }
    }

    // 2. Check App Engine / Google Cloud Country header
    const gcpCountry = req.headers['x-appengine-country'] || req.headers['x-country-code'];
    if (gcpCountry && typeof gcpCountry === 'string') {
      const code = gcpCountry.trim().toUpperCase();
      if (code && code !== 'ZZ' && code !== 'XX' && ISO_TO_ARABIC[code]) {
        return {
          country: ISO_TO_ARABIC[code],
          countryCode: code,
          detectedAutomatically: true,
          method: 'appengine_header'
        };
      }
    }

    // 3. Extract client IP
    const clientIp = getClientIp(req);

    // 4. If public IP, perform fast offline MaxMind geoip-lite lookup
    if (!isPrivateOrLoopbackIp(clientIp)) {
      const geo = geoip.lookup(clientIp);
      if (geo && geo.country) {
        const code = geo.country.toUpperCase();
        const arabicName = ISO_TO_ARABIC[code] || geo.country;
        return {
          country: arabicName,
          countryCode: code,
          detectedAutomatically: true,
          method: 'geoip_lite'
        };
      }

      // If geoip-lite didn't find the range, try secondary IP lookup service
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        const resp = await fetch(
          `http://ip-api.com/json/${clientIp}?fields=status,country,countryCode`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (resp.ok) {
          const data = (await resp.json()) as any;
          if (data && data.status === 'success' && data.countryCode) {
            const code = data.countryCode.toUpperCase();
            return {
              country: ISO_TO_ARABIC[code] || data.country || 'مصر',
              countryCode: code,
              detectedAutomatically: true,
              method: 'ip_api_fallback'
            };
          }
        }
      } catch (err) {
        // Fall through gracefully
      }
    }

    // 5. If local development / private IP or unknown network:
    // Try to check server's public egress IP for local testing convenience, or fallback to 'مصر'
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const resp = await fetch('http://ip-api.com/json/?fields=status,country,countryCode', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = (await resp.json()) as any;
        if (data && data.status === 'success' && data.countryCode) {
          const code = data.countryCode.toUpperCase();
          return {
            country: ISO_TO_ARABIC[code] || data.country || 'مصر',
            countryCode: code,
            detectedAutomatically: true,
            method: 'ip_api_fallback'
          };
        }
      }
    } catch {
      // Fallback
    }

    // Graceful default for Arab community platform
    return {
      country: 'مصر',
      countryCode: 'EG',
      detectedAutomatically: false,
      method: 'default_fallback'
    };
  } catch (error) {
    console.error('Geolocation error:', error);
    return {
      country: 'مصر',
      countryCode: 'EG',
      detectedAutomatically: false,
      method: 'default_fallback'
    };
  }
}
