import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Animated, Dimensions, Image, ActivityIndicator, Alert, Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api } from '../lib/api';
import type { Album, FilterPreset, Photo } from '../lib/types';
import { SlideshowScreen } from './SlideshowScreen';

// 送信前に端末側で長辺をこのサイズに収める。フル解像度のままだと端末→サーバーの
// WiFi転送が重くアップロードが遅い(サーバー処理自体は約1秒)。表示版は1280pxなので
// 2048pxあれば焼き直しにも十分で、実用上の劣化なく転送量を大幅に削減できる。
const MAX_UPLOAD_EDGE = 2048;

async function downscaleForUpload(
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ uri: string; fileName?: string | null; mimeType?: string | null }> {
  const longEdge = Math.max(asset.width ?? 0, asset.height ?? 0);
  // 既に十分小さい / サイズ不明ならそのまま送る
  if (!longEdge || longEdge <= MAX_UPLOAD_EDGE) return asset;
  try {
    const isLandscape = (asset.width ?? 0) >= (asset.height ?? 0);
    const ctx = ImageManipulator.manipulate(asset.uri);
    ctx.resize(isLandscape ? { width: MAX_UPLOAD_EDGE } : { height: MAX_UPLOAD_EDGE });
    const ref = await ctx.renderAsync();
    const result = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return { uri: result.uri, fileName: asset.fileName ?? 'photo.jpg', mimeType: 'image/jpeg' };
  } catch {
    // 失敗時は元画像でアップロード(遅くなるが送れる方を優先)
    return asset;
  }
}

// プリセットの色行列(Skia互換4x5)を中間グレーに適用し、フィルターの色味を表す
// スウォッチ色を算出する。クライアント側のプレビュー無し(Phase A)でも色の方向が伝わる。
function swatchColor(cm: number[]): string {
  const g = 0.5; // 中間グレー
  const ch = (r: number) =>
    Math.round(Math.max(0, Math.min(1, cm[r * 5] * g + cm[r * 5 + 1] * g + cm[r * 5 + 2] * g + cm[r * 5 + 4])) * 255);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

const C = {
  bg: '#E8D5B0', card: '#F8F0DC', dark: '#1C1208',
  muted: '#8A7A64', red: '#B8291C', green: '#2D5A3D',
  border: '#D4C4A0',
};

const { width: SW } = Dimensions.get('window');

function SealedView({ album, count }: { album: Album; count: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const daysLeft = album.days_left ?? 0;

  return (
    <View style={s.sealedContainer}>
      <View style={s.filmStrip}>
        {[...Array(6)].map((_, i) => <View key={i} style={s.filmDot} />)}
      </View>

      <View style={s.darkRoom}>
        <View style={s.lamp}>
          <View style={s.lampGlow} />
          <View style={s.lampBulb} />
        </View>

        <Animated.View style={[s.countdownBox, { transform: [{ scale: pulse }] }]}>
          <Text style={s.countdownLabel}>現 像 ま で</Text>
          <Text style={s.countdownNum}>{daysLeft}</Text>
          <Text style={s.countdownUnit}>日</Text>
        </Animated.View>

        <View style={s.sealedBadge}>
          <Text style={s.sealedBadgeText}>SEALED</Text>
        </View>

        <Text style={s.sealedDesc}>
          現像日 {album.reveal_date.slice(0, 10)} まで{'\n'}写真は封印されています（今のうちに撮影できます）
        </Text>

        <View style={s.filmInfo}>
          <Text style={s.filmInfoText}>{count} / {album.max_exposures} EXP</Text>
          <Text style={s.filmInfoText}>{album.member_count}人参加中</Text>
        </View>
      </View>

      <View style={s.filmStrip}>
        {[...Array(6)].map((_, i) => <View key={i} style={s.filmDot} />)}
      </View>
    </View>
  );
}

function OpenedView({
  album, photos, loading, onStartSlideshow,
}: {
  album: Album;
  photos: Photo[];
  loading: boolean;
  onStartSlideshow: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }, 300);
    return () => clearTimeout(t);
  }, [fadeAnim, slideAnim]);

  return (
    <ScrollView contentContainerStyle={s.openedContainer}>
      <Animated.View style={[s.revealBanner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={s.revealEmoji}>📸</Text>
        <Text style={s.revealTitle}>現 像 完 了 ！</Text>
        <Text style={s.revealDate}>{album.reveal_date.slice(0, 10)} に現像されました</Text>

        {!loading && photos.length > 0 && (
          <TouchableOpacity style={s.movieBtn} onPress={onStartSlideshow} activeOpacity={0.85}>
            <Text style={s.movieBtnText}>▶  フォトムービーを再生</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator size="large" color={C.dark} />
        </View>
      ) : photos.length === 0 ? (
        <View style={s.emptyPhotos}>
          <Text style={s.emptyPhotosText}>写真がまだありません</Text>
        </View>
      ) : (
        <Animated.View style={[s.photoGrid, { opacity: fadeAnim }]}>
          {photos.map((p, i) => {
            const rotation = (i % 3 === 0 ? -2 : i % 3 === 1 ? 1 : -1) + (i % 2 === 0 ? 0.5 : -0.5);
            return (
              <View key={p.id} style={[s.polaroid, { transform: [{ rotate: `${rotation}deg` }] }]}>
                <View style={s.photoArea}>
                  <Image source={{ uri: p.url }} style={s.photoImg} resizeMode="cover" />
                </View>
                <View style={s.polaroidCaption} />
              </View>
            );
          })}
        </Animated.View>
      )}
    </ScrollView>
  );
}

export function AlbumDetailScreen({ album, onBack }: { album: Album; onBack: () => void }) {
  const isSealed = album.status === 'sealed';
  const [count, setCount] = useState(album.photo_count);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(!isSealed);
  const [uploading, setUploading] = useState(false);
  const [slideshowVisible, setSlideshowVisible] = useState(false);
  const [filters, setFilters] = useState<FilterPreset[]>([]);
  const [defaultPreset, setDefaultPreset] = useState('classic-film');
  // 撮影/選択済みでフィルター選択待ちの画像
  const [pendingAsset, setPendingAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  // モーダルで選択中のフィルター(確認ボタンを押すまで確定しない)
  const [selectedPreset, setSelectedPreset] = useState('classic-film');

  useEffect(() => {
    if (isSealed) return;
    api
      .listPhotos(album.id)
      .then(setPhotos)
      .catch(() => Alert.alert('エラー', '写真の読み込みに失敗しました'))
      .finally(() => setLoadingPhotos(false));
  }, [album.id, isSealed]);

  // フィルタープリセット定義を取得(サーバーと共通の真実の源)
  useEffect(() => {
    api
      .listFilters()
      .then(res => {
        setFilters(res.presets.filter(p => p.id !== 'none'));
        setDefaultPreset(res.default_preset);
      })
      .catch(() => {
        // 取得失敗時は既定プリセットのみで継続できるようにする
        setFilters([]);
      });
  }, []);

  // 撮影/選択した画像を保持し、フィルター選択モーダルを開く
  async function pickImage(source: 'camera' | 'library') {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        '権限が必要です',
        source === 'camera'
          ? 'カメラへのアクセスを許可してください'
          : '写真ライブラリへのアクセスを許可してください',
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;

    setSelectedPreset(defaultPreset);
    setPendingAsset(result.assets[0]);
  }

  // 「このフィルターで保存」押下時に確認ダイアログを挟む
  function requestSaveConfirmation() {
    const name = filters.find(f => f.id === selectedPreset)?.name ?? 'このフィルター';
    Alert.alert('保存の確認', `「${name}」で保存しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '保存する', onPress: () => confirmUpload(selectedPreset) },
    ]);
  }

  // 選んだフィルターで焼き込みアップロード
  async function confirmUpload(presetId: string) {
    if (!pendingAsset) return;
    const asset = pendingAsset;
    setPendingAsset(null);
    setUploading(true);
    try {
      const upload = await downscaleForUpload(asset);
      const photo = await api.uploadPhoto(album.id, upload, presetId);
      setCount(c => c + 1);
      if (!isSealed) setPhotos(prev => [...prev, photo]);
      Alert.alert('保存しました', '写真をアルバムに追加しました');
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }

  function handleAddPhoto() {
    if (count >= album.max_exposures) {
      Alert.alert('フィルムを使い切りました', `このアルバムは ${album.max_exposures} 枚までです`);
      return;
    }
    Alert.alert('写真を追加', album.title, [
      { text: 'カメラで撮影', onPress: () => pickImage('camera') },
      { text: 'ライブラリから選択', onPress: () => pickImage('library') },
      { text: 'キャンセル', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{album.title}</Text>
        <View style={[s.headerBadge, isSealed ? s.headerBadgeRed : s.headerBadgeGreen]}>
          <Text style={[s.headerBadgeText, { color: isSealed ? C.red : C.green }]}>
            {isSealed ? 'SEALED' : 'OPENED'}
          </Text>
        </View>
      </View>

      {isSealed
        ? <SealedView album={album} count={count} />
        : <OpenedView album={album} photos={photos} loading={loadingPhotos} onStartSlideshow={() => setSlideshowVisible(true)} />}

      {count < album.max_exposures && (
        <TouchableOpacity style={s.fab} onPress={handleAddPhoto} activeOpacity={0.85}>
          <Text style={s.fabText}>＋</Text>
        </TouchableOpacity>
      )}

      {uploading && (
        <View style={s.uploadOverlay}>
          <ActivityIndicator size="large" color="#F5EDD8" />
          <Text style={s.uploadText}>アップロード中...</Text>
        </View>
      )}

      <Modal
        visible={pendingAsset !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPendingAsset(null)}
      >
        <View style={s.filterBackdrop}>
          <View style={s.filterSheet}>
            <Text style={s.filterTitle}>フィルターを選ぶ</Text>
            <Text style={s.filterHint}>現像日に、選んだフィルムで焼き上がります</Text>

            {pendingAsset && (
              <Image source={{ uri: pendingAsset.uri }} style={s.filterPreviewImg} resizeMode="cover" />
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.filterRow}
            >
              {(filters.length ? filters : [{ id: defaultPreset, name: 'フィルム', description: '', color_matrix: [], vignette: { intensity: 0, radius: 1 }, grain: { amount: 0 } }]).map(f => {
                const selected = f.id === selectedPreset;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={s.filterChip}
                    onPress={() => setSelectedPreset(f.id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        s.filterSwatch,
                        selected && s.filterSwatchSelected,
                        { backgroundColor: f.color_matrix.length ? swatchColor(f.color_matrix) : C.muted },
                      ]}
                    />
                    <Text style={[s.filterChipText, selected && s.filterChipTextSelected]} numberOfLines={1}>
                      {f.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={s.filterConfirm}
              onPress={requestSaveConfirmation}
              activeOpacity={0.85}
            >
              <Text style={s.filterConfirmText}>このフィルターで保存</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.filterCancel} onPress={() => setPendingAsset(null)}>
              <Text style={s.filterCancelText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SlideshowScreen
        photos={photos}
        albumTitle={album.title}
        bgmUrl={album.bgm_url}
        visible={slideshowVisible}
        onClose={() => setSlideshowVisible(false)}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1.5, borderBottomColor: C.dark,
  },
  backBtn: { paddingRight: 4 },
  backText: { fontSize: 14, color: C.muted },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: C.dark },
  headerBadge: { paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1.5 },
  headerBadgeRed: { borderColor: C.red },
  headerBadgeGreen: { borderColor: C.green },
  headerBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },

  // Sealed
  sealedContainer: { flex: 1 },
  filmStrip: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: C.dark, paddingVertical: 6,
  },
  filmDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: C.bg },

  darkRoom: {
    flex: 1, backgroundColor: '#0E0A04',
    alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32,
  },
  lamp: { alignItems: 'center', marginBottom: 8 },
  lampGlow: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#B8291C', opacity: 0.15,
    position: 'absolute', top: -10,
  },
  lampBulb: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#B8291C', opacity: 0.9,
  },

  countdownBox: { alignItems: 'center' },
  countdownLabel: { fontSize: 12, letterSpacing: 4, color: 'rgba(232,213,176,0.5)', marginBottom: 8 },
  countdownNum: { fontSize: 96, fontWeight: '900', color: '#E8D5B0', lineHeight: 100 },
  countdownUnit: { fontSize: 24, color: 'rgba(232,213,176,0.7)', marginTop: 4 },

  sealedBadge: {
    borderWidth: 1.5, borderColor: C.red,
    paddingHorizontal: 16, paddingVertical: 4,
  },
  sealedBadgeText: { color: C.red, fontSize: 12, fontWeight: '700', letterSpacing: 3 },

  sealedDesc: { color: 'rgba(232,213,176,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 22 },

  filmInfo: { flexDirection: 'row', gap: 24, marginTop: 8 },
  filmInfoText: { color: 'rgba(232,213,176,0.4)', fontSize: 12, letterSpacing: 1 },

  // Opened
  openedContainer: { padding: 20, gap: 24, paddingBottom: 96 },
  revealBanner: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  revealEmoji: { fontSize: 48 },
  revealTitle: { fontSize: 28, fontWeight: '900', color: C.dark, letterSpacing: 6 },
  revealDate: { fontSize: 12, color: C.muted },

  loadingBox: { paddingVertical: 48, alignItems: 'center' },

  photoGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, justifyContent: 'center',
  },
  polaroid: {
    backgroundColor: C.card,
    padding: 8, paddingBottom: 28,
    width: (SW - 64) / 2,
    shadowColor: C.dark, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  photoArea: {
    width: '100%', aspectRatio: 1,
    borderRadius: 2, overflow: 'hidden',
    backgroundColor: C.dark,
  },
  photoImg: { width: '100%', height: '100%' },
  polaroidCaption: { height: 8 },

  emptyPhotos: { padding: 32, alignItems: 'center' },
  emptyPhotosText: { color: C.muted, fontSize: 14 },

  movieBtn: {
    marginTop: 12,
    paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: C.dark,
    borderRadius: 4,
  },
  movieBtnText: {
    color: '#F5EDD8', fontSize: 14, fontWeight: '700', letterSpacing: 1.5,
  },

  // 撮影 FAB / アップロード中
  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.dark, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: '#F5EDD8', fontSize: 28, lineHeight: 32, fontWeight: '300' },

  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,18,8,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },
  uploadText: { color: '#F5EDD8', fontSize: 14, marginTop: 12, letterSpacing: 2 },

  // フィルター選択モーダル
  filterBackdrop: {
    flex: 1, justifyContent: 'flex-end',
    backgroundColor: 'rgba(14,10,4,0.7)',
  },
  filterSheet: {
    backgroundColor: C.card,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32,
    borderTopWidth: 1.5, borderTopColor: C.dark,
  },
  filterTitle: { fontSize: 18, fontWeight: '800', color: C.dark, textAlign: 'center' },
  filterHint: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 4 },
  filterPreviewImg: {
    width: '100%', aspectRatio: 4 / 3,
    borderRadius: 6, marginTop: 16, marginBottom: 8,
    backgroundColor: C.dark,
  },
  filterRow: { gap: 16, paddingVertical: 12, paddingHorizontal: 4 },
  filterChip: { alignItems: 'center', width: 64 },
  filterSwatch: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: C.dark,
  },
  filterSwatchSelected: {
    borderWidth: 3, borderColor: C.red,
    transform: [{ scale: 1.1 }],
  },
  filterChipText: { fontSize: 11, color: C.muted, marginTop: 6, fontWeight: '600' },
  filterChipTextSelected: { color: C.dark, fontWeight: '800' },
  filterConfirm: {
    marginTop: 8, paddingVertical: 14, alignItems: 'center',
    backgroundColor: C.dark, borderRadius: 6,
  },
  filterConfirmText: { fontSize: 15, color: '#F5EDD8', fontWeight: '700', letterSpacing: 1 },
  filterCancel: {
    marginTop: 10, paddingVertical: 12, alignItems: 'center',
  },
  filterCancelText: { fontSize: 14, color: C.muted, fontWeight: '600' },
});
