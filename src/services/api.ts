const API_BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('fadfada_token');
}

export function setToken(token: string): void {
  localStorage.setItem('fadfada_token', token);
}

export function removeToken(): void {
  localStorage.removeItem('fadfada_token');
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
