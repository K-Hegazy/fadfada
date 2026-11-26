import { COUNTRIES, isKnownCountry } from '../utils/progression';

export interface DetectedCountry {
  country: string;
  countryCode: string;
  countryFlag: string;
}

interface CachedDetectedCountry extends DetectedCountry {
  detectedAt: number;
}

interface StoredUserGeoSync {
  country: string;
  countryCode: string;
  syncedAt: number;
}

const GEO_CACHE_KEY = 'fadfada_geo_country_v1';
const USER_GEO_SYNC_PREFIX = 'fadfada_user_geo_sync_v1_';
export const GEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const DEFAULT_TIMEOUT_MS = 3_500;

let memoryCache: CachedDetectedCountry | null = null;
let inFlightDetection: Promise<DetectedCountry | null> | null = null;

export function normalizeCountryCode(raw: unknown): string {
  const clean = String(raw || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(clean) ? clean : '';
}

export function countryCodeToFlag(rawCode: string): string {
  const code = normalizeCountryCode(rawCode);
  if (!code) return '';
  const A = 0x1f1e6;
  const first = A + (code.charCodeAt(0) - 65);
  const second = A + (code.charCodeAt(1) - 65);
  return String.fromCodePoint(first, second);
}

export function resolveArabicCountryName(countryCode: string, fallbackName = ''): string {
  const code = normalizeCountryCode(countryCode);
  if (code) {
    const localMatch = COUNTRIES.find((c) => c.code === code);
    if (localMatch && isKnownCountry(localMatch.name)) {
      return localMatch.name;
    }
    try {
      if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
        const displayNames = new Intl.DisplayNames(['ar'], { type: 'region' });
        const arabic = displayNames.of(code);
        if (arabic && arabic !== code && isKnownCountry(arabic)) {
          return arabic.slice(0, 60);
        }
      }
    } catch {
      // Fallback below
    }
  }

  const cleanFallback = String(fallbackName || '').trim().slice(0, 60);
  if (isKnownCountry(cleanFallback)) {
    return cleanFallback;
  }
  return code || '';
}

function getStorageSafe(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage restricted (private browsing)
  }
  return null;
}

export function getCachedDetectedCountry(nowMs = Date.now()): DetectedCountry | null {
  if (memoryCache && nowMs - memoryCache.detectedAt < GEO_CACHE_TTL_MS) {
    return {
      country: memoryCache.country,
      countryCode: memoryCache.countryCode,
      countryFlag: memoryCache.countryFlag,
    };
  }

  const storage = getStorageSafe();
  if (!storage) return null;

  try {
    const raw = storage.getItem(GEO_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedDetectedCountry>;
    const code = normalizeCountryCode(parsed.countryCode);
    const country = String(parsed.country || '').trim();
    const flag = String(parsed.countryFlag || '').trim() || countryCodeToFlag(code);
    const detectedAt = Number(parsed.detectedAt ?? 0);

    if (!code || !isKnownCountry(country) || !Number.isFinite(detectedAt)) {
      return null;
    }
    if (nowMs - detectedAt >= GEO_CACHE_TTL_MS) {
      return null;
    }

    memoryCache = { country, countryCode: code, countryFlag: flag, detectedAt };
    return { country, countryCode: code, countryFlag: flag };
  } catch {
    return null;
  }
}

function writeCachedDetectedCountry(result: DetectedCountry, nowMs = Date.now()): void {
  memoryCache = { ...result, detectedAt: nowMs };
  const storage = getStorageSafe();
  if (!storage) return;
  try {
    // Store ONLY country metadata (NEVER store IP address)
    storage.setItem(
      GEO_CACHE_KEY,
      JSON.stringify({
        country: result.country,
        countryCode: result.countryCode,
        countryFlag: result.countryFlag,
        detectedAt: nowMs,
      })
    );
  } catch {
    // Non-blocking storage write
  }
}

export function getLastSyncedUserCountry(uid: string): StoredUserGeoSync | null {
  if (!uid) return null;
  const storage = getStorageSafe();
  if (!storage) return null;
  try {
    const raw = storage.getItem(`${USER_GEO_SYNC_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredUserGeoSync>;
    const countryCode = normalizeCountryCode(parsed.countryCode);
    const country = String(parsed.country || '').trim();
    const syncedAt = Number(parsed.syncedAt ?? 0);
    if (!countryCode && !country) return null;
    return { country, countryCode, syncedAt };
  } catch {
    return null;
  }
}

export function markUserCountrySynced(uid: string, result: DetectedCountry, nowMs = Date.now()): void {
  if (!uid) return;
  const storage = getStorageSafe();
  if (!storage) return;
  try {
    storage.setItem(
      `${USER_GEO_SYNC_PREFIX}${uid}`,
      JSON.stringify({
        country: result.country,
        countryCode: result.countryCode,
        syncedAt: nowMs,
      })
    );
  } catch {
    // Non-blocking
  }
}

export function resetGeolocationCacheForTests(): void {
  memoryCache = null;
  inFlightDetection = null;
  const storage = getStorageSafe();
  if (storage) {
    try {
      storage.removeItem(GEO_CACHE_KEY);
    } catch {
      // Ignore
    }
  }
}

async function fetchJsonWithTimeout(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number
): Promise<Record<string, unknown> | null> {
  if (!url.startsWith('https://')) {
    return null;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => {
        controller.abort();
      }, timeoutMs)
    : null;

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response.ok) {
      console.warn(`[Geo] Provider returned HTTP ${response.status}:`, url);
      return null;
    }
    const data = (await response.json()) as unknown;
    if (!data || typeof data !== 'object') {
      console.warn('[Geo] Provider returned non-object payload:', url);
      return null;
    }
    return data as Record<string, unknown>;
  } catch (err) {
    console.warn(
      `[Geo] Provider request failed (${err instanceof Error ? err.name : 'Error'}):`,
      url
    );
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function buildDetectedCountry(rawCode: unknown, rawName: unknown, rawFlag?: unknown): DetectedCountry | null {
  const countryCode = normalizeCountryCode(rawCode);
  if (!countryCode) return null;
  const country = resolveArabicCountryName(countryCode, String(rawName || ''));
  if (!isKnownCountry(country)) return null;
  const countryFlag =
    countryCodeToFlag(countryCode) ||
    String(rawFlag || '').trim().slice(0, 16) ||
    '🌍';
  return { country, countryCode, countryFlag };
}

interface GeoProvider {
  url: string;
  parse: (data: Record<string, unknown>) => DetectedCountry | null;
}

const HTTPS_GEO_PROVIDERS: GeoProvider[] = [
  {
    // Primary HTTPS provider (CORS-enabled, no API key required)
    url: 'https://ipwho.is/',
    parse: (data) => {
      if (data.success === false) return null;
      const flagObj = data.flag && typeof data.flag === 'object' ? (data.flag as { emoji?: unknown }) : null;
      return buildDetectedCountry(data.country_code, data.country, flagObj?.emoji);
    },
  },
  {
    // Fallback 1: api.country.is lightweight HTTPS endpoint (fast, CORS *)
    url: 'https://api.country.is/',
    parse: (data) => buildDetectedCountry(data.country, ''),
  },
  {
    // Fallback 2: GeoJS HTTPS endpoint (CORS *)
    url: 'https://get.geojs.io/v1/ip/country.json',
    parse: (data) => buildDetectedCountry(data.country, data.name),
  },
  {
    // Fallback 3: ipinfo.io HTTPS endpoint (CORS *)
    url: 'https://ipinfo.io/json',
    parse: (data) => buildDetectedCountry(data.country, ''),
  },
  {
    // Fallback 4: ipapi.co HTTPS JSON endpoint
    url: 'https://ipapi.co/json/',
    parse: (data) => {
      if (data.error) return null;
      return buildDetectedCountry(data.country_code ?? data.country, data.country_name);
    },
  },
];

/**
 * Detects user's country using HTTPS IP geolocation APIs (no GPS permission, no IP storage).
 * Deduplicates concurrent calls and caches result to avoid repeated requests.
 */
export async function detectUserCountry(options: {
  forceRefresh?: boolean;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
} = {}): Promise<DetectedCountry | null> {
  const {
    forceRefresh = false,
    fetchImpl = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  if (!forceRefresh) {
    const cached = getCachedDetectedCountry();
    if (cached) {
      console.info('[Geo] Using cached detected country:', cached);
      return cached;
    }
    if (inFlightDetection) {
      console.info('[Geo] Reusing in-flight detection promise');
      return inFlightDetection;
    }
  }

  if (!fetchImpl) {
    console.warn('[Geo] fetchImpl unavailable');
    return null;
  }

  const task = (async (): Promise<DetectedCountry | null> => {
    for (const provider of HTTPS_GEO_PROVIDERS) {
      const payload = await fetchJsonWithTimeout(provider.url, fetchImpl, timeoutMs);
      if (!payload) continue;
      const detected = provider.parse(payload);
      if (detected) {
        console.info('[Geo] Detected country via', provider.url, detected);
        writeCachedDetectedCountry(detected);
        return detected;
      }
      console.warn('[Geo] Provider payload rejected/unparseable:', provider.url);
    }
    console.warn('[Geo] All HTTPS geolocation providers failed');
    return null;
  })();

  if (!forceRefresh) {
    inFlightDetection = task;
  }

  try {
    return await task;
  } finally {
    if (inFlightDetection === task) {
      inFlightDetection = null;
    }
  }
}
