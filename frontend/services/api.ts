export const API_BASE_URL = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname}:8000`
  : 'http://127.0.0.1:8000';

export const WS_BASE_URL = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname}:8000`
  : 'ws://127.0.0.1:8000';

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
