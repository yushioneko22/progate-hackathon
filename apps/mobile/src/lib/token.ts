import AsyncStorage from '@react-native-async-storage/async-storage';

// メモリキャッシュ + AsyncStorage で永続化する。
// get() は同期で参照できるよう、起動時に hydrate() でキャッシュへ読み込む。
const KEY = 'kawarun_token';
let _token: string | null = null;

export const token = {
  get: (): string | null => _token,
  set: (t: string): void => {
    _token = t;
    void AsyncStorage.setItem(KEY, t);
  },
  remove: (): void => {
    _token = null;
    void AsyncStorage.removeItem(KEY);
  },
  // 起動時に永続化トークンをキャッシュへ読み込む。戻り値は読み込めたトークン。
  hydrate: async (): Promise<string | null> => {
    _token = await AsyncStorage.getItem(KEY);
    return _token;
  },
};
