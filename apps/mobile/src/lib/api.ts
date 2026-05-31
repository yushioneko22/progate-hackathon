import { Platform } from 'react-native';
import { token } from './token';
import type { AiTransformResult, Album, FiltersResponse, Movie, Photo, Todo, TokenResponse } from './types';

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
    const detail = (body as { detail?: unknown }).detail;
    const msg =
      typeof detail === 'string' ? detail :
      Array.isArray(detail)
        ? (detail as Array<{ msg?: string; loc?: string[] }>)
            .map(d => d.msg ?? JSON.stringify(d))
            .join(' / ')
        : `API ${res.status}`;
    throw new Error(msg);
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
    filter?: { preset?: string; presetB?: string; mix?: number; strength?: number },
  ) => {
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
    // 省略時はサーバー側の既定プリセットで焼き込まれる。
    // preset=主, presetB=混ぜる副, mix=混合比(0..1), strength=効き具合(0..1)
    if (filter?.preset) form.append('filter_preset', filter.preset);
    if (filter?.presetB) form.append('filter_preset_b', filter.presetB);
    if (filter?.mix != null) form.append('filter_mix', String(filter.mix));
    if (filter?.strength != null) form.append('filter_strength', String(filter.strength));
    return request<Photo>(`/albums/${albumId}/photos`, { method: 'POST', body: form }, true);
  },

  listFilters: () => request<FiltersResponse>('/filters', undefined, true),

  aiTransformPhoto: (albumId: string, photoId: string, prompt: string) =>
    request<AiTransformResult>(
      `/albums/${albumId}/photos/${photoId}/ai-transform`,
      { method: 'POST', body: JSON.stringify({ prompt }) },
      true,
    ),

  // スライドショー動画(MP4)の生成を開始する(非同期)。pending のジョブが返る。
  requestMovie: (albumId: string) =>
    request<Movie>(`/albums/${albumId}/movie`, { method: 'POST' }, true),
  // 最新の動画生成ジョブの状態を取得する(ポーリング用)。
  getMovie: (albumId: string) =>
    request<Movie>(`/albums/${albumId}/movie`, undefined, true),
};
