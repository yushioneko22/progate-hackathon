import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Animated, Dimensions, Image, ActivityIndicator, Alert, Modal, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { api } from '../lib/api';
import type { Album, FilterPreset, Photo } from '../lib/types';
import { MovieExportButton } from '../components/MovieExportButton';
import { PhotoSelectScreen } from './PhotoSelectScreen';
import { PhotoViewerScreen, type Origin } from './PhotoViewerScreen';
import { ShakeRevealScreen } from './ShakeRevealScreen';
import { SlideshowScreen } from './SlideshowScreen';
import { FilmCameraScreen } from './FilmCameraScreen';

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

function formatRevealDate(isoString: string): string {
  const d = new Date(isoString);
  const DOW = ['日', '月', '火', '水', '木', '金', '土'];
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DOW[d.getDay()]}）${h}:${m}`;
}

function calcCountdown(revealDate: string): { value: string; unit: string; isClose: boolean } {
  const diff = Math.max(0, new Date(revealDate).getTime() - Date.now());
  const totalSecs = Math.floor(diff / 1000);
  const days = Math.floor(totalSecs / 86400);
  if (days >= 1) return { value: String(days), unit: '日', isClose: false };
  const hh = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
  const mm = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
  const ss = (totalSecs % 60).toString().padStart(2, '0');
  return { value: `${hh}:${mm}:${ss}`, unit: '', isClose: true };
}

const { width: SW } = Dimensions.get('window');

function SealedView({ album, count }: { album: Album; count: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const [countdown, setCountdown] = useState(() => calcCountdown(album.reveal_date));

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  // 1秒ごとにカウントダウンを更新
  useEffect(() => {
    const id = setInterval(() => setCountdown(calcCountdown(album.reveal_date)), 1000);
    return () => clearInterval(id);
  }, [album.reveal_date]);

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
          <Text style={[s.countdownNum, countdown.isClose && s.countdownNumSmall]}>
            {countdown.value}
          </Text>
          {countdown.unit ? <Text style={s.countdownUnit}>{countdown.unit}</Text> : null}
        </Animated.View>

        <View style={s.sealedBadge}>
          <Text style={s.sealedBadgeText}>SEALED</Text>
        </View>

        <Text style={s.sealedDesc}>
          現像日時 {formatRevealDate(album.reveal_date)} まで{'\n'}写真は封印されています（今のうちに撮影できます）
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
  album, photos, loading, onStartSlideshow, onPhotoPress,
}: {
  album: Album;
  photos: Photo[];
  loading: boolean;
  onStartSlideshow: () => void;
  onPhotoPress: (index: number, origin: Origin | null) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const photoRefs = useRef<Array<View | null>>([]);

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
        <Text style={s.revealDate}>{formatRevealDate(album.reveal_date)} に現像されました</Text>

        {!loading && photos.length > 0 && (
          <>
            <TouchableOpacity style={s.movieBtn} onPress={onStartSlideshow} activeOpacity={0.85}>
              <Text style={s.movieBtnText}>▶  フォトムービーを再生</Text>
            </TouchableOpacity>
            <MovieExportButton albumId={album.id} />
          </>
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
              <TouchableOpacity
                key={p.id}
                activeOpacity={0.85}
                onPress={() => {
                  const ref = photoRefs.current[i];
                  if (ref) {
                    ref.measure((_x, _y, w, h, px, py) =>
                      onPhotoPress(i, { x: px, y: py, width: w, height: h })
                    );
                  } else {
                    onPhotoPress(i, null);
                  }
                }}
                style={[s.polaroid, { transform: [{ rotate: `${rotation}deg` }] }]}
              >
                <View
                  ref={r => { photoRefs.current[i] = r; }}
                  style={s.photoArea}
                >
                  <Image source={{ uri: p.url }} style={s.photoImg} resizeMode="cover" />
                </View>
                <View style={s.polaroidCaption} />
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}
    </ScrollView>
  );
}

export function AlbumDetailScreen({ album, onBack }: { album: Album; onBack: () => void }) {
  const [localStatus, setLocalStatus] = useState<'sealed' | 'opened'>(album.status);
  const isSealed = localStatus === 'sealed';
  const [count, setCount] = useState(album.photo_count);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(!isSealed);
  const [uploading, setUploading] = useState(false);
  const [photoSelectVisible, setPhotoSelectVisible] = useState(false);
  const [slideshowPhotos, setSlideshowPhotos] = useState<Photo[]>([]);
  const [slideshowVisible, setSlideshowVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerOrigin, setViewerOrigin] = useState<Origin | null>(null);
  const [filters, setFilters] = useState<FilterPreset[]>([]);
  const [defaultPreset, setDefaultPreset] = useState('classic-film');
  const [pendingAsset, setPendingAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedPreset, setSelectedPreset] = useState('classic-film');
  // null = 確認中, false = 未開封（シェイク演出を表示）, true = 開封済み
  const [revealed, setRevealed] = useState<boolean | null>(null);
  const [filmCameraVisible, setFilmCameraVisible] = useState(false);

  // メンバー招待（オーナーのみ）
  const isOwner = album.my_role === 'owner';
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  async function handleInvite() {
    setInviteLoading(true);
    try {
      const invite = await api.createInvite(album.id);
      setInviteCode(invite.code);
    } catch (e) {
      Alert.alert('エラー', e instanceof Error ? e.message : '招待コードの発行に失敗しました');
    } finally {
      setInviteLoading(false);
    }
  }

  async function shareInvite() {
    if (!inviteCode) return;
    try {
      await Share.share({
        message: `「${album.title}」に参加しよう！\nアプリで「＋参加」から招待コードを入力：\n\n${inviteCode}`,
      });
    } catch {
      // 共有シートのキャンセル等は無視
    }
  }

  function handleDelete() {
    Alert.alert(
      'アルバムを削除',
      `「${album.title}」を削除しますか？\n写真・メンバー・招待もすべて削除され、元に戻せません。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除する',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteAlbum(album.id);
              onBack(); // 一覧へ戻ると再取得され、削除済みアルバムは消える
            } catch (e) {
              Alert.alert('エラー', e instanceof Error ? e.message : '削除に失敗しました');
            }
          },
        },
      ],
    );
  }

  // 現像日時になったら自動でOPENEDに切り替え
  useEffect(() => {
    if (album.status !== 'sealed') return;
    const delay = new Date(album.reveal_date).getTime() - Date.now();
    if (delay <= 0) { setLocalStatus('opened'); return; }
    const timer = setTimeout(() => setLocalStatus('opened'), delay);
    return () => clearTimeout(timer);
  }, [album.id, album.status, album.reveal_date]);

  useEffect(() => {
    if (isSealed) return;
    AsyncStorage.getItem(`revealed_${album.id}`).then(v => setRevealed(v === 'true'));
  }, [album.id, isSealed]);

  async function handleReveal() {
    await AsyncStorage.setItem(`revealed_${album.id}`, 'true');
    setRevealed(true);
  }

  useEffect(() => {
    if (isSealed) return;
    api
      .listPhotos(album.id)
      .then(data => {
        setPhotos(data);
        data.forEach(p => Image.prefetch(p.url).catch(() => {}));
      })
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

  // カメラ撮影はフィルムカメラUIで、ライブラリ選択はそのまま
  async function pickImage(source: 'camera' | 'library') {
    if (source === 'camera') {
      setFilmCameraVisible(true);
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('権限が必要です', '写真ライブラリへのアクセスを許可してください');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (result.canceled) return;
    setSelectedPreset(defaultPreset);
    setPendingAsset(result.assets[0]);
  }

  // フィルムカメラで撮影完了
  function handleFilmCapture(uri: string, width: number, height: number) {
    setFilmCameraVisible(false);
    setSelectedPreset(defaultPreset);
    setPendingAsset({ uri, width, height, assetId: null, fileName: 'photo.jpg', mimeType: 'image/jpeg', type: 'image', fileSize: undefined, duration: null, base64: null } as ImagePicker.ImagePickerAsset);
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

  // 初回のみシェイク開封演出（写真読み込み完了後に表示）
  if (!isSealed && revealed === false && photos.length > 0) {
    return (
      <ShakeRevealScreen
        photos={photos}
        albumTitle={album.title}
        onReveal={handleReveal}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{album.title}</Text>
        {isOwner && (
          <TouchableOpacity
            style={s.inviteBtn}
            onPress={handleInvite}
            disabled={inviteLoading}
            activeOpacity={0.8}
          >
            {inviteLoading
              ? <ActivityIndicator color={C.dark} size="small" />
              : <Text style={s.inviteBtnText}>招待</Text>}
          </TouchableOpacity>
        )}
        {isOwner && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Text style={s.deleteBtnText}>削除</Text>
          </TouchableOpacity>
        )}
        <View style={[s.headerBadge, isSealed ? s.headerBadgeRed : s.headerBadgeGreen]}>
          <Text style={[s.headerBadgeText, { color: isSealed ? C.red : C.green }]}>
            {isSealed ? 'SEALED' : 'OPENED'}
          </Text>
        </View>
      </View>

      {isSealed
        ? <SealedView album={album} count={count} />
        : <OpenedView
            album={album}
            photos={photos}
            loading={loadingPhotos}
            onStartSlideshow={() => setPhotoSelectVisible(true)}
            onPhotoPress={(i, origin) => { setViewerIndex(i); setViewerOrigin(origin); setViewerVisible(true); }}
          />}

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
        photos={slideshowPhotos}
        albumTitle={album.title}
        bgmUrl={album.bgm_url}
        visible={slideshowVisible}
        onClose={() => setSlideshowVisible(false)}
      />

      <PhotoViewerScreen
        photos={photos}
        initialIndex={viewerIndex}
        origin={viewerOrigin}
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />

      {photoSelectVisible && (
        <View style={StyleSheet.absoluteFill}>
          <PhotoSelectScreen
            photos={photos}
            onBack={() => setPhotoSelectVisible(false)}
            onPlay={selected => {
              setSlideshowPhotos(selected);
              setPhotoSelectVisible(false);
              setSlideshowVisible(true);
            }}
          />
        </View>
      )}

      {/* 招待コード表示モーダル（オーナー） */}
      <Modal
        visible={inviteCode !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteCode(null)}
      >
        <View style={s.inviteBackdrop}>
          <View style={s.inviteCard}>
            <Text style={s.inviteTitle}>招待コード</Text>
            <Text style={s.inviteDesc}>このコードを共有して、{'\n'}メンバーに参加してもらいましょう</Text>
            <View style={s.inviteCodeBox}>
              <Text style={s.inviteCodeText}>{inviteCode}</Text>
            </View>
            <TouchableOpacity style={s.inviteShareBtn} onPress={shareInvite} activeOpacity={0.85}>
              <Text style={s.inviteShareText}>共 有 す る</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.inviteCloseBtn} onPress={() => setInviteCode(null)}>
              <Text style={s.inviteCloseText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {filmCameraVisible && (
        <View style={StyleSheet.absoluteFill}>
          <FilmCameraScreen
            exposuresLeft={album.max_exposures - count}
            onCapture={handleFilmCapture}
            onClose={() => setFilmCameraVisible(false)}
          />
        </View>
      )}
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
  inviteBtn: {
    borderWidth: 1.5, borderColor: C.dark, backgroundColor: C.dark,
    paddingHorizontal: 10, paddingVertical: 4, minWidth: 44, alignItems: 'center',
  },
  inviteBtnText: { fontSize: 12, color: '#F5EDD8', fontWeight: '700', letterSpacing: 1 },
  deleteBtn: {
    borderWidth: 1.5, borderColor: C.red,
    paddingHorizontal: 10, paddingVertical: 4, alignItems: 'center',
  },
  deleteBtnText: { fontSize: 12, color: C.red, fontWeight: '700', letterSpacing: 1 },

  // 招待コードモーダル
  inviteBackdrop: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(14,10,4,0.7)', padding: 32,
  },
  inviteCard: {
    backgroundColor: C.card, padding: 28, width: '100%',
    borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.dark,
  },
  inviteTitle: { fontSize: 18, fontWeight: '900', color: C.dark, letterSpacing: 2 },
  inviteDesc: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  inviteCodeBox: {
    marginTop: 20, marginBottom: 24,
    borderWidth: 2, borderColor: C.dark, borderStyle: 'dashed',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#fff',
  },
  inviteCodeText: { fontSize: 36, fontWeight: '900', color: C.dark, letterSpacing: 8 },
  inviteShareBtn: {
    backgroundColor: C.dark, paddingVertical: 14, paddingHorizontal: 48,
    alignItems: 'center', borderRadius: 6,
  },
  inviteShareText: { color: '#F5EDD8', fontSize: 15, fontWeight: '700', letterSpacing: 4 },
  inviteCloseBtn: { marginTop: 12, paddingVertical: 8 },
  inviteCloseText: { color: C.muted, fontSize: 14, fontWeight: '600' },

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
  countdownNumSmall: { fontSize: 44, lineHeight: 52 }, // HH:MM:SS 表示用
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
