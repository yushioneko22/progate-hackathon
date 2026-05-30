import { useState } from 'react';
import {
  ActivityIndicator, Alert, Linking, Share, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { api } from '../lib/api';

const C = { dark: '#1C1208', text: '#F5EDD8', muted: '#8A7A64' };

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 180_000; // 3分上限(Render無料プランの遅さを考慮)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * アルバムの写真からスライドショー動画(MP4)をサーバーで生成し、保存/シェアする。
 * 生成は非同期なので、開始後に完了までポーリングする。
 */
export function MovieExportButton({ albumId }: { albumId: string }) {
  const [working, setWorking] = useState(false);

  async function handleExport() {
    setWorking(true);
    try {
      await api.requestMovie(albumId); // 生成開始(202 pending)
      const start = Date.now();
      while (Date.now() - start < POLL_TIMEOUT_MS) {
        await sleep(POLL_INTERVAL_MS);
        const movie = await api.getMovie(albumId);
        if (movie.status === 'ready' && movie.url) {
          await shareMovie(movie.url);
          return;
        }
        if (movie.status === 'failed') {
          throw new Error(movie.error ?? '動画の生成に失敗しました');
        }
      }
      throw new Error('生成がタイムアウトしました。時間をおいて再度お試しください');
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '動画の書き出しに失敗しました');
    } finally {
      setWorking(false);
    }
  }

  async function shareMovie(url: string) {
    try {
      await Share.share({ url, message: '思い出のフォトムービー 🎞️' });
    } catch {
      // シェアシートが使えない場合はブラウザで開いて保存できるようにする
      Linking.openURL(url).catch(() => {});
    }
  }

  return (
    <TouchableOpacity
      style={[s.btn, working && s.btnDisabled]}
      onPress={handleExport}
      disabled={working}
      activeOpacity={0.85}
    >
      {working ? (
        <View style={s.row}>
          <ActivityIndicator color={C.text} size="small" />
          <Text style={s.txt}>動画を生成中…</Text>
        </View>
      ) : (
        <Text style={s.txt}>⬇  動画として保存・シェア</Text>
      )}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    marginTop: 10,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1.5, borderColor: C.dark,
  },
  btnDisabled: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  txt: { color: C.dark, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
