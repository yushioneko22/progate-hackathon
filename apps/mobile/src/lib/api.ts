import { Platform } from 'react-native';
import { token } from './token';
import type { Album, FiltersResponse, Photo, Todo, TokenResponse } from './types';

function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'android') return 'http://10.0.2.2:8787';
  return 'http://localhost:8787';
}

const API_URL = resolveApiUrl();

// リクエストのタイムアウト(ms)。fetch は標準でタイムアウトしないため、
// AbortController で打ち切って UI がハングしないようにする。
const REQUEST_TIMEOUT_MS = 30_000;

async function request<T>(path: string, init?: RequestInit, auth = false): Promise<T> {
  // FormData の場合は content-type を指定しない(fetch が boundary 付きで自動設定する)
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isForm ? {} : { 'content-type': 'application/json' }),
    ...(init?.headers as Record<string, string> ?? {}),
  };
  if (auth) {
    const t = token.get();
    if (t) headers['authorization'] = `Bearer ${t}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: controller.signal });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`タイムアウトしました(${REQUEST_TIMEOUT_MS / 1000}秒)。通信環境を確認してください`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `API ${res.status}`);
  }
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

  register: (email: string, password: string, display_name: string) =>
    request<TokenResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name }),
    }),
  login: (email: string, password: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  listAlbums: () => request<Album[]>('/albums', undefined, true),
  createAlbum: (data: { title: string; reveal_date: string; max_exposures: number; bgm_url?: string }) =>
    request<Album>('/albums', { method: 'POST', body: JSON.stringify(data) }, true),

  listPhotos: (albumId: string) =>
    request<Photo[]>(`/albums/${albumId}/photos`, undefined, true),
  uploadPhoto: (
    albumId: string,
    asset: { uri: string; fileName?: string | null; mimeType?: string | null },
    filterPreset?: string,
  ) => {
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
    // 省略時はサーバー側の既定プリセットで焼き込まれる
    if (filterPreset) form.append('filter_preset', filterPreset);
    return request<Photo>(`/albums/${albumId}/photos`, { method: 'POST', body: form }, true);
  },

  listFilters: () => request<FiltersResponse>('/filters', undefined, true),
};
