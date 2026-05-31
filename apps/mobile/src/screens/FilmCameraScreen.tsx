import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width: SW } = Dimensions.get('window');
const SAFE_TOP = Platform.OS === 'ios' ? 56 : 32;
const SAFE_BOT = Platform.OS === 'ios' ? 44 : 24;

// ファインダー寸法（気持ち横長・小さめで覗き込む感）
const FINDER_W = SW * 0.52;
const FINDER_H = FINDER_W * 1.22;
const BORDER   = 18;

type Props = {
  exposuresLeft: number;
  onCapture: (uri: string, width: number, height: number) => void;
  onClose: () => void;
};

export function FilmCameraScreen({ exposuresLeft, onCapture, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [shooting, setShooting] = useState(false);
  const cameraRef = useRef<CameraView>(null);

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
      <StatusBar barStyle="dark-content" />

      {/* 上部：ブランド + 閉じる + カウンター */}
      <View style={[s.top, { paddingTop: SAFE_TOP }]}>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>

        {/* ブランドピル */}
        <View style={s.brandPill}>
          <Text style={s.brandText}>変ルンです</Text>
        </View>

        {/* 残りコマ数 */}
        <View style={s.counter}>
          <Text style={s.counterNum}>{exposuresLeft}</Text>
          <Text style={s.counterLabel}>EXP</Text>
        </View>
      </View>

      {/* ファインダー */}
      <View style={s.finderArea}>
        {/* 外枠（カメラボディの窪み） */}
        <View style={s.finderOuter}>
          {/* カメラプレビュー */}
          <CameraView
            ref={cameraRef}
            style={s.preview}
            flash={flash ? 'on' : 'off'}
          />
          {/* シャッター時フラッシュ演出 */}
          {shooting && <View style={s.shootFlash} />}
        </View>
      </View>

      {/* 下部コントロール */}
      <View style={[s.controls, { paddingBottom: SAFE_BOT + 16 }]}>

        {/* フラッシュボタン */}
        <TouchableOpacity
          style={s.sideBtn}
          onPress={() => setFlash(f => !f)}
          activeOpacity={0.7}
        >
          <View style={[s.sideBtnInner, flash && s.sideBtnActive]}>
            <Text style={s.sideBtnIcon}>⚡</Text>
          </View>
        </TouchableOpacity>

        {/* シャッターボタン */}
        <TouchableOpacity
          style={s.shutter}
          onPress={shoot}
          activeOpacity={0.85}
          disabled={shooting}
        >
          <View style={s.shutterRing}>
            <View style={[s.shutterInner, shooting && s.shutterPressed]} />
          </View>
        </TouchableOpacity>

        {/* 右側スペーサー（対称） */}
        <View style={s.sideBtn} />
      </View>

      {/* ボディ底部の装飾ライン */}
      <View style={s.bottomStrip} />
    </View>
  );
}

const BODY_BG   = '#CACACA';
const DARK      = '#1C1208';
const FRAME_BG  = '#252520';

const s = StyleSheet.create({
  body: {
    flex: 1,
    backgroundColor: BODY_BG,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },

  // 権限リクエスト
  permText: {
    fontSize: 16,
    color: DARK,
    textAlign: 'center',
    lineHeight: 26,
    fontWeight: '600',
  },
  permBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: DARK,
    borderRadius: 8,
  },
  permBtnText: { color: '#F8F0DC', fontSize: 15, fontWeight: '700' },
  permClose: { marginTop: 4 },
  permCloseText: { color: '#888', fontSize: 14 },

  // 上部
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(28,18,8,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: DARK, fontSize: 13, fontWeight: '700' },

  brandPill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: DARK,
    borderRadius: 20,
  },
  brandText: {
    color: '#F8F0DC',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },

  counter: {
    width: 36,
    alignItems: 'center',
  },
  counterNum: {
    fontSize: 18,
    fontWeight: '900',
    color: DARK,
    lineHeight: 20,
  },
  counterLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 1,
  },

  // ファインダー
  finderArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finderOuter: {
    width: FINDER_W,
    height: FINDER_H,
    borderRadius: 20,
    backgroundColor: FRAME_BG,
    padding: BORDER,
    // ボディの窪み感
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
  },
  preview: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  shootFlash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },

  // コントロール
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 28,
  },
  sideBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(28,18,8,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnActive: {
    backgroundColor: 'rgba(201,168,76,0.3)',
  },
  sideBtnIcon: {
    fontSize: 20,
  },

  // シャッター
  shutter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#B0B0B0',
    borderWidth: 3,
    borderColor: '#909090',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  shutterPressed: {
    backgroundColor: '#D0D0D0',
  },

  // 底部の装飾
  bottomStrip: {
    height: 6,
    backgroundColor: '#B8B8B8',
  },
});
