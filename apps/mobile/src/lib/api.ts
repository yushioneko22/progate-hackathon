import { Platform } from 'react-native';
import type { Todo } from './types';

// Resolve API base URL with platform-aware fallbacks:
// - EXPO_PUBLIC_API_URL wins if set (best for physical devices on the LAN).
// - Android emulator can't reach the host via "localhost"; it uses 10.0.2.2.
// - iOS Simulator and Web can use localhost directly.
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787';
  return 'http://localhost:8787';
}

const API_URL = resolveApiUrl();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  list: () => request<Todo[]>('/todos'),
  create: (title: string) =>
    request<Todo>('/todos', { method: 'POST', body: JSON.stringify({ title }) }),
  update: (id: string, patch: { title?: string; completed?: boolean }) =>
    request<Todo>(`/todos/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => request<void>(`/todos/${id}`, { method: 'DELETE' }),
};
