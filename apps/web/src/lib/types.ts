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
