export type Todo = {
  id: string;
  title: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

export type Album = {
  id: string;
  title: string;
  reveal_date: string;
  max_exposures: number;
  bgm_url: string | null;
  status: 'sealed' | 'opened';
  days_left: number | null;
  member_count: number;
  photo_count: number;
  created_at: string;
};

export type TokenResponse = {
  token: string;
  user: User;
};

export type Photo = {
  id: string;
  album_id: string;
  url: string;
  filter_preset: string | null;
  taken_at: string | null;
  created_at: string;
};

// /filters で配信されるプリセット定義(サーバー/クライアント共通の真実の源)。
// Phase B のリアルタイムプレビューでクライアント(Skia)が同じ定義を解釈する。
export type FilterPreset = {
  id: string;
  name: string;
  description: string;
  color_matrix: number[];
  vignette: { intensity: number; radius: number };
  grain: { amount: number };
};

export type FiltersResponse = {
  presets: FilterPreset[];
  default_preset: string;
  realtime_preview_enabled: boolean;
};

// 写真から生成するスライドショー動画(MP4)の生成ジョブ。
export type Movie = {
  id: string;
  album_id: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  url: string | null;  // ready のときのみ動画の公開URL
  error: string | null;
  created_at: string;
  updated_at: string;
};
