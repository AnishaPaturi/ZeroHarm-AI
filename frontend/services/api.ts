const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (isLocalhost ? `${window.location.protocol}//127.0.0.1:8000` : 'https://zeroharm-ai-77m2.onrender.com');

export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (isLocalhost ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//127.0.0.1:8000` : 'wss://zeroharm-ai-77m2.onrender.com');

export async function fetchBackend<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    let errorDetail = '';
    try {
      const errJson = await res.json();
      errorDetail = errJson?.detail || errJson?.message || '';
    } catch (e) {}
    throw new Error(errorDetail || `API call failed: ${options?.method || 'GET'} ${endpoint} returned ${res.status}`);
  }
  return res.json() as Promise<T>;
}
