import { useEffect, useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, Text, StyleSheet,
  Dimensions, Animated, Platform, PanResponder, StatusBar,
} from 'react-native';
import type { Photo } from '../lib/types';

const { width: SW, height: SH } = Dimensions.get('window');
const STATUS_H  = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
const HEADER_H  = Platform.OS === 'ios' ? 100 : 68;
const CARD_W    = 72;
const CARD_H    = 104;
const FAN_BOT   = Platform.OS === 'ios' ? 44 : 24;
const FAN_H     = CARD_H + FAN_BOT + 16;
const PHOTO_H   = SH - HEADER_H - FAN_H;
// 写真エリアの中心（画面全体基準）
const PHOTO_CY  = HEADER_H + PHOTO_H / 2;
const FAN_STEP  = 3;
const ROT_DEG   = 11;
const PIVOT     = CARD_H / 2;
const SWIPE_THR = 60;

export type Origin = { x: number; y: number; width: number; height: number };

type Props = {
  photos: Photo[];
  initialIndex: number;
  origin?: Origin | null;
  visible: boolean;
  onClose: () => void;
};

export function PhotoViewerScreen({ photos, initialIndex, origin, visible, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentIndexRef = useRef(initialIndex);

  // ─── アニメーション値（すべて useNativeDriver: true） ───
  const bgOpacity  = useRef(new Animated.Value(0)).current; // 黒背景フェードイン
  const photoScale = useRef(new Animated.Value(1)).current;
  const photoTX    = useRef(new Animated.Value(0)).current;
  const photoTY    = useRef(new Animated.Value(0)).current;
  const photoOp    = useRef(new Animated.Value(1)).current; // 写真切り替え時フェード
  const swipeX     = useRef(new Animated.Value(0)).current; // スワイプ追従
  const fanSlideY  = useRef(new Animated.Value(FAN_H + 20)).current; // ファンカード上スライド

  useEffect(() => {
    if (!visible) {
      // 閉じるとき：すべてリセット
      bgOpacity.setValue(0);
      return;
    }

    setCurrentIndex(initialIndex);
    currentIndexRef.current = initialIndex;
    photoOp.setValue(1);
    swipeX.setValue(0);

    if (origin) {
      // 写真が polaroid の位置・サイズから始まり全画面へ拡大
      const startScale = origin.width / SW;
      const tx = (origin.x + origin.width / 2) - SW / 2;
      const ty = (origin.y + origin.height / 2) - PHOTO_CY;

      photoScale.setValue(startScale);
      photoTX.setValue(tx);
      photoTY.setValue(ty);
      bgOpacity.setValue(0);
      fanSlideY.setValue(FAN_H + 20);

      Animated.parallel([
        // 背景フェードイン
        Animated.timing(bgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        // 写真を拡大しながらセンターへ
        Animated.spring(photoScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.spring(photoTX,    { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.spring(photoTY,    { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
        // ファンカード：少し遅れて下からスライドアップ
        Animated.sequence([
          Animated.delay(120),
          Animated.spring(fanSlideY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }),
        ]),
      ]).start();
    } else {
      photoScale.setValue(0.9);
      photoTX.setValue(0);
      photoTY.setValue(0);
      fanSlideY.setValue(FAN_H + 20);

      Animated.parallel([
        Animated.timing(bgOpacity,  { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(photoScale, { toValue: 1, useNativeDriver: true, tension: 110, friction: 8 }),
        Animated.spring(fanSlideY,  { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }),
      ]).start();
    }
  }, [visible, initialIndex]);

  function close() {
    if (!origin) { onClose(); return; }
    // 閉じるときは逆方向に縮小
    const startScale = origin.width / SW;
    const tx = (origin.x + origin.width / 2) - SW / 2;
    const ty = (origin.y + origin.height / 2) - PHOTO_CY;
    Animated.parallel([
      Animated.timing(bgOpacity,  { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.spring(photoScale, { toValue: startScale, useNativeDriver: true, tension: 130, friction: 10 }),
      Animated.spring(photoTX,    { toValue: tx, useNativeDriver: true, tension: 130, friction: 10 }),
      Animated.spring(photoTY,    { toValue: ty, useNativeDriver: true, tension: 130, friction: 10 }),
      Animated.timing(fanSlideY,  { toValue: FAN_H + 20, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  function fadeToPhoto(idx: number) {
    Animated.timing(photoOp, { toValue: 0, duration: 130, useNativeDriver: true })
      .start(() => {
        setCurrentIndex(idx);
        currentIndexRef.current = idx;
        Animated.timing(photoOp, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      });
  }

  // スワイプジェスチャー
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (_, g) => swipeX.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      const ci = currentIndexRef.current;
      if ((g.dx < -SWIPE_THR || g.vx < -0.5) && ci < photos.length - 1) {
        Animated.timing(swipeX, { toValue: -SW * 0.35, duration: 150, useNativeDriver: true })
          .start(() => { swipeX.setValue(0); fadeToPhoto(ci + 1); });
      } else if ((g.dx > SWIPE_THR || g.vx > 0.5) && ci > 0) {
        Animated.timing(swipeX, { toValue: SW * 0.35, duration: 150, useNativeDriver: true })
          .start(() => { swipeX.setValue(0); fadeToPhoto(ci - 1); });
      } else {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 180, friction: 10 }).start();
      }
    },
  })).current;

  if (!visible) return null;

  const fanItems: { idx: number; offset: number }[] = [];
  for (let off = -FAN_STEP; off <= FAN_STEP; off++) {
    const idx = currentIndex + off;
    if (idx >= 0 && idx < photos.length) fanItems.push({ idx, offset: off });
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 黒背景：徐々にフェードイン */}
      <Animated.View style={[StyleSheet.absoluteFill, s.bg, { opacity: bgOpacity }]} />

      {/* ヘッダー */}
      <Animated.View style={[s.header, { opacity: bgOpacity }]}>
        <TouchableOpacity onPress={close} style={s.closeBtn}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.counter}>{currentIndex + 1} / {photos.length}</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* 全画面写真 */}
      <Animated.View
        style={[s.photoWrap, { height: PHOTO_H, top: HEADER_H }]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[s.photoInner, {
          opacity: photoOp,
          transform: [
            { scale: photoScale },
            { translateX: photoTX },
            { translateY: photoTY },
            { translateX: swipeX },
          ],
        }]}>
          {photos[currentIndex] && (
            <Image source={{ uri: photos[currentIndex].url }} style={s.photo} resizeMode="contain" />
          )}
        </Animated.View>
      </Animated.View>

      {/* ファンカード（下からスライドアップ） */}
      <Animated.View style={[s.fanArea, { transform: [{ translateY: fanSlideY }] }]}>
        {fanItems.map(({ idx, offset }) => {
          const isActive = idx === currentIndex;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => fadeToPhoto(idx)}
              activeOpacity={0.8}
              style={[s.fanTouch, { zIndex: FAN_STEP + 1 - Math.abs(offset) }]}
            >
              <View style={{
                transform: [
                  { translateY: PIVOT },
                  { rotate: `${offset * ROT_DEG}deg` },
                  { translateY: -PIVOT },
                ],
              }}>
                <View style={[s.fanCard, isActive && s.fanCardActive]}>
                  <Image source={{ uri: photos[idx].url }} style={s.fanCardImg} resizeMode="cover" />
                  {!isActive && <View style={s.fanDim} />}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { backgroundColor: '#0A0806' },

  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: HEADER_H,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingBottom: 12, paddingHorizontal: 20,
    zIndex: 10,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#F5EDD8', fontSize: 14, fontWeight: '600' },
  counter: {
    flex: 1, textAlign: 'center',
    color: 'rgba(245,237,216,0.5)', fontSize: 12, letterSpacing: 2,
  },

  photoWrap: {
    position: 'absolute', left: 0, right: 0,
    overflow: 'hidden',
  },
  photoInner: { flex: 1 },
  photo: { width: SW, height: '100%' },

  fanArea: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: FAN_H,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: FAN_BOT,
  },
  fanTouch: {
    position: 'absolute',
    bottom: FAN_BOT,
    left: SW / 2 - CARD_W / 2,
  },
  fanCard: {
    width: CARD_W, height: CARD_H, borderRadius: 6, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6, shadowRadius: 8, elevation: 10,
  },
  fanCardActive: { borderColor: '#F5EDD8' },
  fanCardImg: { width: '100%', height: '100%' },
  fanDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
});
