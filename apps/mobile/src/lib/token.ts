// セッション中のみ保持（再起動でリセット）
// AsyncStorage を導入すれば永続化できる
let _token: string | null = null;

export const token = {
  get: () => _token,
  set: (t: string) => { _token = t; },
  remove: () => { _token = null; },
};
