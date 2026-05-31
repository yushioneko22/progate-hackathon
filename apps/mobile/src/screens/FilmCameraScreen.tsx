import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar,
  useWindowDimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ScreenOrientation from 'expo-screen-orientation';

const SAFE_H   = Platform.OS === 'ios' ? 44 : 24; // 横画面のセーフエリア（短辺側）
const BORDER   = 14;

type Props = {
  exposuresLeft: number;
  onCapture: (uri: string, width: number, height: number) => void;
  onClose: () => void;
};

export function FilmCameraScreen({ exposuresLeft, onCapture, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash]       = useState(false);
  const [shooting, setShooting] = useState(false);
  const cameraRef               = useRef<CameraView>(null);

  // 横画面ロック（右回転 = 物理ボタンが左側へ）
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  // ロック後に横画面の実寸が返ってくる
  const { width: WW, height: WH } = useWindowDimensions();

  // ファインダーサイズ（横画面の短辺 WH を基準）
  const TOP_BAR_H  = SAFE_H + 48;
  const BOT_BAR_H  = 36;
  const AVAIL_H    = WH - TOP_BAR_H - BOT_BAR_H;
  const FINDER_H   = Math.min(AVAIL_H * 0.9, WW * 0.65);
  const FINDER_W   = FINDER_H * 1.38; // 若干横長

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

      {/* ── メインエリア：スペーサー＋ファインダー（完全中央）＋ コントロール（右列） ── */}
      <View style={s.mainArea}>

        {/* 左スペーサー（右コントロール列と同幅で finder を画面中央に揃える） */}
        <View style={s.controlsSpacer} />

        {/* ファインダー */}
        <View style={s.finderArea}>
          <View style={[s.finderOuter, { width: FINDER_W, height: FINDER_H, marginBottom: TOP_BAR_H - BOT_BAR_H }]}>
            <CameraView ref={cameraRef} style={s.preview} flash={flash ? 'on' : 'off'} />
            {shooting && <View style={s.shootFlash} />}
          </View>
        </View>

        {/* 右コントロール列：シャッター（上）＋ フラッシュ（下） */}
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
        </View>

      </View>

      {/* ── ボトムバー：EXP（左下） ── */}
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

  // トップバー
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

  // メインエリア
  mainArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 20,
  },
  controlsSpacer: { width: 80 },

  // ファインダー
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

  // 右コントロール列
  controlsCol: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },

  // シャッター
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

  // フラッシュ
  flashBtn: { alignItems: 'center', justifyContent: 'center' },
  flashBtnInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(28,18,8,0.10)', alignItems: 'center', justifyContent: 'center',
  },
  flashBtnActive: { backgroundColor: 'rgba(201,168,76,0.35)' },
  flashIcon:      { fontSize: 18 },

  // ボトムバー（EXP）
  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  counterNum:  { fontSize: 16, fontWeight: '900', color: DARK },
  counterLabel:{ fontSize: 9, fontWeight: '700', color: '#666', letterSpacing: 1 },
});
