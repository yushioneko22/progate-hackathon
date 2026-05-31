import { useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Linking, Modal, Share,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { api } from '../lib/api';

const { width: SW } = Dimensions.get('window');

const C = {
  card: '#F8F0DC', dark: '#1C1208', text: '#F5EDD8',
  muted: '#8A7A64', border: '#D4C4A0', red: '#B8291C',
};

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 180_000; // 3分上限(Render無料プランの遅さを考慮)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Phase = 'idle' | 'working' | 'ready' | 'error';

/**
 * アルバムの写真からスライドショー動画(MP4)をサーバーで生成し、
 * 進捗 → プレビュー再生 → 保存/シェア までを1つのモーダルで完結させる。
 */
export function MovieExportButton({ albumId }: { albumId: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  async function generate() {
    setPhase('working');
    setVideoUrl(null);
    try {
      await api.requestMovie(albumId); // 生成開始(202 pending)
      const start = Date.now();
      while (Date.now() - start < POLL_TIMEOUT_MS) {
        await sleep(POLL_INTERVAL_MS);
        const movie = await api.getMovie(albumId);
        if (movie.status === 'ready' && movie.url) {
          setVideoUrl(movie.url);
          setPhase('ready');
          return;
        }
        if (movie.status === 'failed') {
          throw new Error(movie.error ?? '動画の生成に失敗しました');
        }
      }
      throw new Error('生成がタイムアウトしました。時間をおいて再度お試しください');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '動画の生成に失敗しました');
      setPhase('error');
    }
  }

  function close() {
    setPhase('idle');
    setVideoUrl(null);
  }

  async function share() {
    if (!videoUrl) return;
    try {
      await Share.share({ url: videoUrl, message: '思い出のフォトムービー 🎞️' });
    } catch {
      // シェアシートが使えない場合はブラウザで開いて保存できるようにする
      Linking.openURL(videoUrl).catch(() =>
        Alert.alert('エラー', '動画を開けませんでした'),
      );
    }
  }

  return (
    <>
      <TouchableOpacity style={s.cta} onPress={generate} activeOpacity={0.85}>
        <Text style={s.ctaText}>🎬  フォトムービーを作る</Text>
      </TouchableOpacity>

      <Modal visible={phase !== 'idle'} transparent animationType="fade" onRequestClose={close}>
        <View style={s.backdrop}>
          <View style={s.sheet}>
            {phase === 'working' && (
              <View style={s.center}>
                <ActivityIndicator size="large" color={C.dark} />
                <Text style={s.title}>フィルムを現像しています…</Text>
                <Text style={s.sub}>写真を動画に合成中。少しお待ちください</Text>
              </View>
            )}

            {phase === 'ready' && videoUrl && (
              <View style={s.center}>
                <Text style={s.title}>できあがり！🎞️</Text>
                <Video
                  source={{ uri: videoUrl }}
                  style={s.video}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay
                  isLooping
                />
                <TouchableOpacity style={s.primary} onPress={share} activeOpacity={0.85}>
                  <Text style={s.primaryText}>保存・シェア</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondary} onPress={close}>
                  <Text style={s.secondaryText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            )}

            {phase === 'error' && (
              <View style={s.center}>
                <Text style={s.title}>うまくいきませんでした</Text>
                <Text style={s.sub}>{errorMsg}</Text>
                <TouchableOpacity style={s.primary} onPress={generate} activeOpacity={0.85}>
                  <Text style={s.primaryText}>もう一度試す</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.secondary} onPress={close}>
                  <Text style={s.secondaryText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  cta: {
    marginTop: 10,
    paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1.5, borderColor: C.dark,
  },
  ctaText: { color: C.dark, fontSize: 14, fontWeight: '700', letterSpacing: 1 },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(14,10,4,0.75)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  sheet: {
    width: '100%', maxWidth: 420,
    backgroundColor: C.card,
    borderRadius: 16, padding: 24,
    borderWidth: 1.5, borderColor: C.dark,
  },
  center: { alignItems: 'center', gap: 14 },
  title: { fontSize: 18, fontWeight: '800', color: C.dark, textAlign: 'center' },
  sub: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
  video: {
    width: SW * 0.55, aspectRatio: 9 / 16,
    backgroundColor: '#000', borderRadius: 8, marginVertical: 4,
  },
  primary: {
    width: '100%', paddingVertical: 14, alignItems: 'center',
    backgroundColor: C.dark, borderRadius: 6,
  },
  primaryText: { color: C.text, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
  secondary: { width: '100%', paddingVertical: 10, alignItems: 'center' },
  secondaryText: { color: C.muted, fontSize: 14, fontWeight: '600' },
});
