import { useEffect, useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, Text, StyleSheet,
  Dimensions, Animated, Modal, Platform, PanResponder,
} from 'react-native';
import type { Photo } from '../lib/types';

const { width: SW, height: SH } = Dimensions.get('window');

const HEADER_H  = Platform.OS === 'ios' ? 100 : 68;
const CARD_W    = 72;
const CARD_H    = 104;
const FAN_H     = CARD_H + (Platform.OS === 'ios' ? 48 : 32);
const PHOTO_H   = SH - HEADER_H - FAN_H;
const FAN_STEP  = 3;   // 中央から左右何枚見せるか
const ROT_DEG   = 11;  // 1枚ごとの回転角度
const PIVOT     = CARD_H / 2;
const SWIPE_THR = 60;  // スワイプ判定距離

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

  // メイン写真のアニメーション値（すべて native driver 対応）
  const scale  = useRef(new Animated.Value(1)).current;
  const transX = useRef(new Animated.Value(0)).current;
  const transY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // スワイプ用
  const swipeX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    currentIndexRef.current = initialIndex;

    if (origin) {
      // 写真の中心からフルスクリーンへ拡大
      const startScale = origin.width / SW;
      const photoCenterY = HEADER_H + PHOTO_H / 2;
      const originCenterX = origin.x + origin.width / 2;
      const originCenterY = origin.y + origin.height / 2;

      scale.setValue(startScale);
      transX.setValue(originCenterX - SW / 2);
      transY.setValue(originCenterY - photoCenterY);
      opacity.setValue(1);
      swipeX.setValue(0);

      Animated.parallel([
        Animated.spring(scale,  { toValue: 1, useNativeDriver: true, tension: 110, friction: 8 }),
        Animated.spring(transX, { toValue: 0, useNativeDriver: true, tension: 110, friction: 8 }),
        Animated.spring(transY, { toValue: 0, useNativeDriver: true, tension: 110, friction: 8 }),
      ]).start();
    } else {
      scale.setValue(0.88);
      transX.setValue(0);
      transY.setValue(0);
      opacity.setValue(0);
      swipeX.setValue(0);
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 110, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, initialIndex]);

  function fadeToPhoto(idx: number) {
    Animated.timing(opacity, { toValue: 0, duration: 130, useNativeDriver: true })
      .start(() => {
        setCurrentIndex(idx);
        currentIndexRef.current = idx;
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
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
        Animated.timing(swipeX, { toValue: -SW * 0.4, duration: 160, useNativeDriver: true })
          .start(() => { swipeX.setValue(0); fadeToPhoto(ci + 1); });
      } else if ((g.dx > SWIPE_THR || g.vx > 0.5) && ci > 0) {
        Animated.timing(swipeX, { toValue: SW * 0.4, duration: 160, useNativeDriver: true })
          .start(() => { swipeX.setValue(0); fadeToPhoto(ci - 1); });
      } else {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, tension: 180, friction: 10 }).start();
      }
    },
  })).current;

  // ファンカード
  const fanItems: { idx: number; offset: number }[] = [];
  for (let off = -FAN_STEP; off <= FAN_STEP; off++) {
    const idx = currentIndex + off;
    if (idx >= 0 && idx < photos.length) fanItems.push({ idx, offset: off });
  }

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.container}>

        {/* ヘッダー */}
        <View style={[s.header, { height: HEADER_H }]}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.counter}>{currentIndex + 1} / {photos.length}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* 全画面写真（スワイプ対応） */}
        <Animated.View
          style={[s.photoWrap, { height: PHOTO_H }]}
          {...panResponder.panHandlers}
        >
          <Animated.View style={{
            flex: 1,
            opacity,
            transform: [{ scale }, { translateX: transX }, { translateY: transY }, { translateX: swipeX }],
          }}>
            {photos[currentIndex] && (
              <Image
                source={{ uri: photos[currentIndex].url }}
                style={s.photo}
                resizeMode="contain"
              />
            )}
          </Animated.View>
        </Animated.View>

        {/* ファンカード（手札風） */}
        <View style={[s.fanArea, { height: FAN_H }]}>
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
                    {!isActive && <View style={s.fanCardDim} />}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0806' },

  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingBottom: 12, paddingHorizontal: 20,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#F5EDD8', fontSize: 14, fontWeight: '600' },
  counter: {
    flex: 1, textAlign: 'center',
    color: 'rgba(245,237,216,0.45)', fontSize: 12, letterSpacing: 2,
  },

  photoWrap: { width: SW, overflow: 'hidden' },
  photo: { width: SW, height: '100%' },

  fanArea: { alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20 },
  fanTouch: { position: 'absolute', left: SW / 2 - CARD_W / 2, bottom: Platform.OS === 'ios' ? 40 : 20 },
  fanCard: {
    width: CARD_W, height: CARD_H, borderRadius: 6, overflow: 'hidden',
    borderWidth: 2, borderColor: 'transparent',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 8, elevation: 10,
  },
  fanCardActive: { borderColor: '#F5EDD8' },
  fanCardImg: { width: '100%', height: '100%' },
  fanCardDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.52)' },
});
