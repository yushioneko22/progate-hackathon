import { useEffect, useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, Text, StyleSheet,
  Dimensions, Animated, Platform, PanResponder,
} from 'react-native';
import type { Photo } from '../lib/types';

const { width: SW, height: SH } = Dimensions.get('window');
const HEADER_H = Platform.OS === 'ios' ? 100 : 68;
const CARD_W   = 72;
const CARD_H   = 104;
const FAN_BOT  = Platform.OS === 'ios' ? 44 : 24;
const FAN_H    = CARD_H + FAN_BOT + 16;
const PHOTO_H  = SH - HEADER_H - FAN_H;
const PHOTO_CY = HEADER_H + PHOTO_H / 2;
const FAN_STEP = 3;
const ROT_DEG  = 11;
const PIVOT    = CARD_H / 2;

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

  const photoScale = useRef(new Animated.Value(1)).current;
  const photoTX    = useRef(new Animated.Value(0)).current;
  const photoTY    = useRef(new Animated.Value(0)).current;
  const photoOp    = useRef(new Animated.Value(1)).current;
  const fanSlideY  = useRef(new Animated.Value(FAN_H + 20)).current;
  const headerOp   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    currentIndexRef.current = initialIndex;
    photoOp.setValue(1);

    if (origin) {
      const startScale = origin.width / SW;
      const tx = (origin.x + origin.width / 2) - SW / 2;
      const ty = (origin.y + origin.height / 2) - PHOTO_CY;
      photoScale.setValue(startScale);
      photoTX.setValue(tx);
      photoTY.setValue(ty);
      headerOp.setValue(0);
      fanSlideY.setValue(FAN_H + 20);

      Animated.parallel([
        Animated.spring(photoScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.spring(photoTX,    { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.spring(photoTY,    { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
        Animated.timing(headerOp,   { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(100),
          Animated.spring(fanSlideY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }),
        ]),
      ]).start();
    } else {
      photoScale.setValue(0.9);
      photoTX.setValue(0);
      photoTY.setValue(0);
      headerOp.setValue(0);
      fanSlideY.setValue(FAN_H + 20);
      Animated.parallel([
        Animated.spring(photoScale, { toValue: 1, useNativeDriver: true, tension: 110, friction: 8 }),
        Animated.timing(headerOp,   { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(fanSlideY,  { toValue: 0, useNativeDriver: true, tension: 90, friction: 10 }),
      ]).start();
    }
  }, [visible, initialIndex]);

  function close() {
    if (!origin) { onClose(); return; }
    const startScale = origin.width / SW;
    const tx = (origin.x + origin.width / 2) - SW / 2;
    const ty = (origin.y + origin.height / 2) - PHOTO_CY;
    Animated.parallel([
      Animated.spring(photoScale, { toValue: startScale, useNativeDriver: true, tension: 130, friction: 10 }),
      Animated.spring(photoTX,    { toValue: tx, useNativeDriver: true, tension: 130, friction: 10 }),
      Animated.spring(photoTY,    { toValue: ty, useNativeDriver: true, tension: 130, friction: 10 }),
      Animated.timing(headerOp,   { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fanSlideY,  { toValue: FAN_H + 20, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  function fadeToPhoto(idx: number) {
    if (idx < 0 || idx >= photos.length) return;
    Animated.timing(photoOp, { toValue: 0, duration: 120, useNativeDriver: true })
      .start(() => {
        setCurrentIndex(idx);
        currentIndexRef.current = idx;
        Animated.timing(photoOp, { toValue: 1, duration: 160, useNativeDriver: true }).start();
      });
  }

  // スワイプ（左右両方向）
  const swipeX = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => swipeX.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      const ci = currentIndexRef.current;
      const isLeft  = g.dx < -50 || (g.dx < -10 && g.vx < -0.3);
      const isRight = g.dx >  50 || (g.dx >  10 && g.vx >  0.3);

      if (isLeft && ci < photos.length - 1) {
        // 左スワイプ → 次の写真
        Animated.timing(swipeX, { toValue: -SW * 0.3, duration: 140, useNativeDriver: true })
          .start(() => { swipeX.setValue(0); fadeToPhoto(ci + 1); });
      } else if (isRight && ci > 0) {
        // 右スワイプ → 前の写真
        Animated.timing(swipeX, { toValue: SW * 0.3, duration: 140, useNativeDriver: true })
          .start(() => { swipeX.setValue(0); fadeToPhoto(ci - 1); });
      } else {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 200, friction: 12 }).start();
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

      {/* ヘッダー（✕ + カウンター） */}
      <Animated.View style={[s.header, { opacity: headerOp }]}>
        <TouchableOpacity onPress={close} style={s.closeBtn}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.counter}>{currentIndex + 1} / {photos.length}</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* 全画面写真（ポラロイド風カード背景のまま拡大） */}
      <View
        style={[s.photoWrap, { top: HEADER_H, height: PHOTO_H }]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[s.photoCard, {
          transform: [
            { scale: photoScale },
            { translateX: photoTX },
            { translateY: photoTY },
            { translateX: swipeX },
          ],
          opacity: photoOp,
        }]}>
          {photos[currentIndex] && (
            <Image
              source={{ uri: photos[currentIndex].url }}
              style={s.photo}
              resizeMode="contain"
            />
          )}
        </Animated.View>
      </View>

      {/* ファンカード */}
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
  header: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: HEADER_H,
    flexDirection: 'row', alignItems: 'flex-end',
    paddingBottom: 14, paddingHorizontal: 20,
    zIndex: 10,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(28,18,8,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#1C1208', fontSize: 14, fontWeight: '700' },
  counter: {
    flex: 1, textAlign: 'center',
    color: 'rgba(28,18,8,0.45)', fontSize: 12, letterSpacing: 2,
  },

  photoWrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  // ポラロイド風カード（白背景＋下余白）のまま拡大
  photoCard: {
    width: SW,
    height: PHOTO_H,
    backgroundColor: '#F8F0DC', // アプリのカード色
    padding: 8,
    paddingBottom: 28,
    shadowColor: '#1C1208',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  photo: { width: '100%', height: '100%' },

  fanArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: FAN_H,
    alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: FAN_BOT,
  },
  fanTouch: {
    position: 'absolute',
    bottom: FAN_BOT,
    left: SW / 2 - CARD_W / 2,
  },
  fanCard: {
    width: CARD_W, height: CARD_H, borderRadius: 4, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
    backgroundColor: '#F8F0DC',
    shadowColor: '#1C1208', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  fanCardActive: { borderColor: '#1C1208' },
  fanCardImg: { width: '100%', height: '100%' },
  fanDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,18,8,0.4)' },
});
