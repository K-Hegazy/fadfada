const API_BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('fadfada_token');
}

export function setToken(token: string): void {
  localStorage.setItem('fadfada_token', token);
  try {
    const isHttps = window.location.protocol === 'https:';
    const sameSitePolicy = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
    document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; max-age=${30 * 24 * 60 * 60}; ${sameSitePolicy}`;
  } catch (e) {}
}

export function removeToken(): void {
  localStorage.removeItem('fadfada_token');
  try {
    const isHttps = window.location.protocol === 'https:';
    const sameSitePolicy = isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
    document.cookie = `auth_token=; path=/; max-age=0; ${sameSitePolicy}`;
  } catch (e) {}
}

/**
 * Returns a clean media URL with no sensitive tokens or query secrets in the URL string.
 */
export function getMediaUrl(url?: string): string {
  if (!url) return '';
  // Strip any accidental token query parameters to maintain clean URLs
  if (url.includes('token=')) {
    return url.replace(/([?&])token=[^&]+(&|$)/, '$1').replace(/[?&]$/, '');
  }
  return url;
}

// Global in-memory cache for loaded media blobs to prevent duplicate downloads and flicker
const mediaBlobCache = new Map<string, string>();

/**
 * Loads protected media securely using standard HTTP headers (Bearer token and cookies),
 * returning a secure, clean Object URL (blob:) with ZERO credentials or tokens in the URL.
 */
export async function loadSecureMediaBlob(url?: string): Promise<string> {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  const cleanUrl = getMediaUrl(url);
  if (mediaBlobCache.has(cleanUrl)) {
    return mediaBlobCache.get(cleanUrl)!;
  }

  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(cleanUrl, {
    headers,
    credentials: 'include'
  });

  if (!res.ok) {
    let errMessage = `تعذر تحميل الوسائط (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson?.error) errMessage = errJson.error;
    } catch {}
    throw new Error(errMessage);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  mediaBlobCache.set(cleanUrl, blobUrl);
  return blobUrl;
}


export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'حدث خطأ في الاتصال بالخادم');
  }

  return data;
}

// Upload helper for base64 media
export async function uploadMedia(dataUrl: string, fileName?: string): Promise<string> {
  const res = await apiRequest<{ success: boolean; url: string }>('/upload', {
    method: 'POST',
    body: JSON.stringify({ dataUrl, fileName })
  });
  return res.url;
}
