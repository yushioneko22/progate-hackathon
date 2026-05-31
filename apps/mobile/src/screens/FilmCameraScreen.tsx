import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar,
  useWindowDimensions, PanResponder,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Haptics from 'expo-haptics';

const SAFE_H = Platform.OS === 'ios' ? 44 : 24;
const BORDER = 14;

// ズームダイアル定数
const DIAL_R  = 54; // 弧の半径（大きめ）
const DIAL_D  = DIAL_R * 2;
const ARC_W   = 3;
const THUMB_R = 7;
// コンテナ内での円の中心座標（上端にサムが出るぶんTHUMB_R分下げる）
const DIAL_CX = DIAL_R;
const DIAL_CY = DIAL_R + THUMB_R;
const DIAL_H  = DIAL_R + THUMB_R; // コンテナ高さ

type Facing = 'back' | 'front';

// ── ズームダイアル ────────────────────────────────────────────
type ZoomDialProps = { zoom: number; onChange: (z: number) => void };

function ZoomDial({ zoom, onChange }: ZoomDialProps) {
  const viewRef       = useRef<View>(null);
  const offsetRef     = useRef({ x: 0, y: 0 });
  const lastStepRef   = useRef(-1);

  function applyTouch(pageX: number, pageY: number) {
    const tx = pageX - offsetRef.current.x;
    const ty = pageY - offsetRef.current.y;
    const dx = tx - DIAL_CX;
    const dy = DIAL_CY - ty; // Y反転（上が正）
    let angle = Math.atan2(dy, dx); // -π〜π
    // 下半分タッチは端にクランプ
    if (angle < 0) angle = dx >= 0 ? 0 : Math.PI;
    const newZoom = Math.max(0, Math.min(1, 1 - angle / Math.PI));
    onChange(newZoom);
    // 0.1刻みでハプティクス
    const step = Math.round(newZoom * 10);
    if (step !== lastStepRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      lastStepRef.current = step;
    }
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: e => {
        viewRef.current?.measureInWindow((x, y) => {
          offsetRef.current = { x, y };
          applyTouch(e.nativeEvent.pageX, e.nativeEvent.pageY);
        });
      },
      onPanResponderMove: e => applyTouch(e.nativeEvent.pageX, e.nativeEvent.pageY),
    })
  ).current;

  // サムの位置（時計回りに動かすと zoom 増加: 左端θ=π→zoom=0、右端θ=0→zoom=1）
  const angle    = Math.PI * (1 - zoom);
  const thumbLeft = DIAL_CX + DIAL_R * Math.cos(angle) - THUMB_R;
  const thumbTop  = DIAL_CY - DIAL_R * Math.sin(angle) - THUMB_R;

  return (
    <View
      ref={viewRef}
      style={{ width: DIAL_D, height: DIAL_H, alignSelf: 'center' }}
      {...pan.panHandlers}
    >
      {/* 弧（円の上半分だけ overflow:hidden でクリップ） */}
      <View style={{
        position: 'absolute', left: 0, top: THUMB_R,
        width: DIAL_D, height: DIAL_R,
        overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', left: 0, top: 0,
          width: DIAL_D, height: DIAL_D,
          borderRadius: DIAL_R,
          borderWidth: ARC_W,
          borderColor: 'rgba(28,18,8,0.35)',
          backgroundColor: 'transparent',
        }} />
      </View>
      {/* サム（現在位置を示す白丸） */}
      <View style={{
        position: 'absolute',
        left: thumbLeft,
        top: thumbTop,
        width: THUMB_R * 2,
        height: THUMB_R * 2,
        borderRadius: THUMB_R,
        backgroundColor: DARK,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 2,
        elevation: 4,
      }} />
    </View>
  );
}

// ────────────────────────────────────────────────────────────
type Props = {
  exposuresLeft: number;
  onCapture: (uri: string, width: number, height: number) => void;
  onClose: () => void;
};

export function FilmCameraScreen({ exposuresLeft, onCapture, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash]       = useState(false);
  const [shooting, setShooting] = useState(false);
  const [facing, setFacing]     = useState<Facing>('back');
  const [zoom, setZoom]         = useState(0);
  const cameraRef               = useRef<CameraView>(null);

  // 常に横画面ロック
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
  }, []);

  // アンマウント時は縦画面に戻す
  useEffect(() => {
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  const { width: WW, height: WH } = useWindowDimensions();

  // バックカメラ用ファインダーサイズ
  const TOP_BAR_H = SAFE_H + 48;
  const BOT_BAR_H = 36;
  const AVAIL_H   = WH - TOP_BAR_H - BOT_BAR_H;
  const FINDER_H  = Math.min(AVAIL_H * 0.9, WW * 0.65);
  const FINDER_W  = FINDER_H * 1.38;

  async function shoot() {
    if (!cameraRef.current || shooting) return;
    setShooting(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) onCapture(photo.uri, photo.width ?? 0, photo.height ?? 0);
    } finally {
      setShooting(false);
    }
  }

  if (!permission) return <View style={s.body} />;

  if (!permission.granted) {
    return (
      <View style={[s.body, s.centered]}>
        <Text style={s.permText}>カメラへのアクセスを{'\n'}許可してください</Text>
        <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
          <Text style={s.permBtnText}>許可する</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.permClose} onPress={onClose}>
          <Text style={s.permCloseText}>戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── インカメ：バックカメラと同じレイアウトで全画面プレビュー ──
  if (facing === 'front') {
    return (
      <View style={s.body}>
        <StatusBar hidden />
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
        {shooting && <View style={[s.shootFlash, StyleSheet.absoluteFill]} />}

        <View style={[s.topBar, { paddingTop: SAFE_H }]}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
          <View style={s.brandPill}>
            <Text style={s.brandText}>変ルンです</Text>
          </View>
        </View>

        <View style={s.mainArea}>
          <View style={{ flex: 1 }} />
          <View style={s.controlsCol}>
            <TouchableOpacity style={s.shutter} onPress={shoot} activeOpacity={0.85} disabled={shooting}>
              <View style={s.shutterRing}>
                <View style={[s.shutterInner, shooting && s.shutterPressed]} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.flipBtn} onPress={() => setFacing('back')} activeOpacity={0.7}>
              <View style={s.flipBtnInner}>
                <Text style={s.flipIcon}>⟳</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.bottomBar}>
          <Text style={s.counterNum}>{exposuresLeft}</Text>
          <Text style={s.counterLabel}>EXP</Text>
        </View>
      </View>
    );
  }

  // ── バックカメラ：フィルムカメラ横画面レイアウト ──────────
  return (
    <View style={s.body}>
      <StatusBar hidden />

      {/* ── トップバー：✕（左）・変ルンです（右隣） ── */}
      <View style={[s.topBar, { paddingTop: SAFE_H }]}>
        <TouchableOpacity onPress={onClose} style={s.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>
        <View style={s.brandPill}>
          <Text style={s.brandText}>変ルンです</Text>
        </View>
      </View>

      {/* ── メインエリア ── */}
      <View style={s.mainArea}>

        <View style={s.controlsSpacer} />

        {/* ファインダー */}
        <View style={s.finderArea}>
          <View style={[s.finderOuter, { width: FINDER_W, height: FINDER_H, marginBottom: TOP_BAR_H - BOT_BAR_H }]}>
            <CameraView ref={cameraRef} style={s.preview} flash={flash ? 'on' : 'off'} zoom={zoom} />
            {shooting && <View style={s.shootFlash} />}
          </View>
        </View>

        {/* 右上コーナー：ズームダイアル */}
        <View style={s.dialCorner}>
          <ZoomDial zoom={zoom} onChange={setZoom} />
        </View>

        {/* 右コントロール列：シャッター・フラッシュ・インカメ切替 */}
        <View style={s.controlsCol}>
          <TouchableOpacity style={s.shutter} onPress={shoot} activeOpacity={0.85} disabled={shooting}>
            <View style={s.shutterRing}>
              <View style={[s.shutterInner, shooting && s.shutterPressed]} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.flashBtn} onPress={() => setFlash(f => !f)} activeOpacity={0.7}>
            <View style={[s.flashBtnInner, flash && s.flashBtnActive]}>
              <Text style={s.flashIcon}>⚡</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.flipBtn} onPress={() => setFacing('front')} activeOpacity={0.7}>
            <View style={s.flipBtnInner}>
              <Text style={s.flipIcon}>⟳</Text>
            </View>
          </TouchableOpacity>
        </View>

      </View>

      {/* ── ボトムバー：EXP ── */}
      <View style={s.bottomBar}>
        <Text style={s.counterNum}>{exposuresLeft}</Text>
        <Text style={s.counterLabel}>EXP</Text>
      </View>

    </View>
  );
}

const BODY_BG  = '#CACACA';
const DARK     = '#1C1208';
const FRAME_BG = '#252520';

const s = StyleSheet.create({
  body:    { flex: 1, flexDirection: 'column', backgroundColor: BODY_BG },
  centered:{ alignItems: 'center', justifyContent: 'center', gap: 20 },

  permText:     { fontSize: 16, color: DARK, textAlign: 'center', lineHeight: 26, fontWeight: '600' },
  permBtn:      { paddingHorizontal: 28, paddingVertical: 12, backgroundColor: DARK, borderRadius: 8 },
  permBtnText:  { color: '#F8F0DC', fontSize: 15, fontWeight: '700' },
  permClose:    { marginTop: 4 },
  permCloseText:{ color: '#888', fontSize: 14 },

  // ── バックカメラ UI ──────────────────────────────────────

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 8,
    paddingRight: 20,
    paddingBottom: 8,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(28,18,8,0.12)', alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: DARK, fontSize: 13, fontWeight: '700' },
  brandPill: { paddingHorizontal: 14, paddingVertical: 5, backgroundColor: DARK, borderRadius: 20 },
  brandText: { color: '#F8F0DC', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },

  mainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 20,
  },
  controlsSpacer: { width: 80 },

  finderArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  finderOuter: {
    borderRadius: 16,
    backgroundColor: FRAME_BG,
    padding: BORDER,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  preview:    { flex: 1, borderRadius: 6, overflow: 'hidden' },
  shootFlash: { ...StyleSheet.absoluteFillObject, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.6)' },

  dialCorner: {
    position: 'absolute',
    top: 0,
    right: 0,
  },

  controlsCol: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },

  shutter: { alignItems: 'center', justifyContent: 'center' },
  shutterRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#B0B0B0', borderWidth: 3, borderColor: '#909090',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 6,
  },
  shutterInner: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8E8E8',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 2, elevation: 3,
  },
  shutterPressed: { backgroundColor: '#D0D0D0' },

  flashBtn: { alignItems: 'center', justifyContent: 'center' },
  flashBtnInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(28,18,8,0.10)', alignItems: 'center', justifyContent: 'center',
  },
  flashBtnActive: { backgroundColor: 'rgba(201,168,76,0.35)' },
  flashIcon:      { fontSize: 18 },

  flipBtn: { alignItems: 'center', justifyContent: 'center' },
  flipBtnInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(28,18,8,0.10)', alignItems: 'center', justifyContent: 'center',
  },
  flipIcon: { fontSize: 20, color: DARK },

  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  counterNum:  { fontSize: 16, fontWeight: '900', color: DARK },
  counterLabel:{ fontSize: 9, fontWeight: '700', color: '#666', letterSpacing: 1 },

  // ── インカメ全画面 UI ────────────────────────────────────

  selfieFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.7)' },

  selfieTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  selfieCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  selfieCloseText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  selfieExpRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  selfieExpNum:    { fontSize: 16, fontWeight: '900', color: '#fff' },
  selfieExpLabel:  { fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.8)', letterSpacing: 1 },

  selfieBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 48,
  },
  selfieFlipBtn: {
    width: 52, height: 52,
    alignItems: 'center', justifyContent: 'center',
  },
  selfieFlipIcon: { fontSize: 28, color: '#fff' },

  selfieShutterRing: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  selfieShutterInner: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff',
  },
});
