import { useEffect, useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, Text, StyleSheet,
  Dimensions, Animated, Platform, FlatList,
} from 'react-native';
import { AiTransformModal } from '../components/AiTransformModal';
import type { Photo } from '../lib/types';

const { width: SW, height: SH } = Dimensions.get('window');
const HEADER_H = Platform.OS === 'ios' ? 100 : 68;
const CARD_W   = 72;
const CARD_H   = 104;
const FAN_BOT  = Platform.OS === 'ios' ? 44 : 24;
const FAN_H    = CARD_H + FAN_BOT + 16;
const PHOTO_H  = SH - HEADER_H - FAN_H;
const PHOTO_CY = HEADER_H + PHOTO_H / 2;

const CARD_MARGIN  = 24;
const CARD_WIDTH   = SW - CARD_MARGIN * 2;

const FRAME_SIDE   = 8;
const FRAME_BOTTOM = 28;
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
  onPhotoAdded?: (photo: Photo) => void;
};

export function PhotoViewerScreen({ photos, initialIndex, origin, visible, onClose, onPhotoAdded }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentIndexRef = useRef(initialIndex);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiTargetPhoto, setAiTargetPhoto]   = useState<Photo | null>(null);
  const flatListRef = useRef<FlatList<Photo>>(null);

  const photoScale = useRef(new Animated.Value(1)).current;
  const photoTX    = useRef(new Animated.Value(0)).current;
  const photoTY    = useRef(new Animated.Value(0)).current;
  const photoOp    = useRef(new Animated.Value(1)).current;
  const fanSlideY  = useRef(new Animated.Value(FAN_H + 20)).current;
  const headerOp   = useRef(new Animated.Value(0)).current;

  // 前後の写真を先読みしてスワイプ時のラグを防ぐ
  useEffect(() => {
    [-1, 1].forEach(offset => {
      const p = photos[currentIndex + offset];
      if (p) Image.prefetch(p.url).catch(() => {});
    });
  }, [currentIndex, photos]);

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
      Animated.timing(photoOp,    { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(headerOp,   { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(fanSlideY,  { toValue: FAN_H + 20, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  function scrollToPhoto(idx: number) {
    flatListRef.current?.scrollToIndex({ index: idx, animated: true });
    currentIndexRef.current = idx;
    setCurrentIndex(idx);
  }

  if (!visible) return null;

  const fanItems: { idx: number; offset: number }[] = [];
  for (let off = -FAN_STEP; off <= FAN_STEP; off++) {
    const idx = currentIndex + off;
    if (idx >= 0 && idx < photos.length) fanItems.push({ idx, offset: off });
  }

  return (
    <View style={StyleSheet.absoluteFill}>

      {/* ヘッダー（✕ + カウンター） */}
      <Animated.View style={[s.header, { opacity: headerOp }]}>
        <TouchableOpacity onPress={close} style={s.closeBtn}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.counter}>{currentIndex + 1} / {photos.length}</Text>
        <View style={{ width: 36 }} />
      </Animated.View>

      {/* 写真エリア：FlatList でネイティブスワイプページング */}
      <View style={[s.photoWrap, { top: HEADER_H, height: PHOTO_H }]}>
        {/* 外側：開閉アニメーション + シャドウ（overflow hidden なし） */}
        <Animated.View style={[s.photoCardShadow, {
          transform: [
            { scale: photoScale },
            { translateX: photoTX },
            { translateY: photoTY },
          ],
          opacity: photoOp,
        }]}>
          {/* 内側：borderRadius でクリップ */}
          <View style={s.photoCardClip}>
            <FlatList
              ref={flatListRef}
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={p => p.id}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, i) => ({ length: CARD_WIDTH, offset: CARD_WIDTH * i, index: i })}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.photoItem}
                  activeOpacity={1}
                  onLongPress={() => { setAiTargetPhoto(item); setAiModalVisible(true); }}
                  delayLongPress={500}
                >
                  <Image source={{ uri: item.url }} style={s.photo} resizeMode="contain" />
                </TouchableOpacity>
              )}
              onMomentumScrollEnd={e => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
                if (idx !== currentIndexRef.current) {
                  currentIndexRef.current = idx;
                  setCurrentIndex(idx);
                }
              }}
            />
          </View>
        </Animated.View>
      </View>

      {/* ファンカード */}
      <Animated.View style={[s.fanArea, { transform: [{ translateY: fanSlideY }] }]}>
        {fanItems.map(({ idx, offset }) => {
          const isActive = idx === currentIndex;
          return (
            <TouchableOpacity
              key={idx}
              onPress={() => scrollToPhoto(idx)}
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

      {/* AI加工モーダル */}
      {aiTargetPhoto && (
        <AiTransformModal
          visible={aiModalVisible}
          photo={aiTargetPhoto}
          onClose={() => setAiModalVisible(false)}
          onSaved={photo => { onPhotoAdded?.(photo); setAiModalVisible(false); }}
        />
      )}

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
    backgroundColor: 'rgba(28,18,8,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#F8F0DC', fontSize: 14, fontWeight: '700' },
  counter: {
    flex: 1, textAlign: 'center',
    color: 'rgba(28,18,8,0.45)', fontSize: 12, letterSpacing: 2,
  },

  photoWrap: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  // シャドウ用（overflow:hidden なし。iOSはoverflow:hiddenがあるとシャドウが消える）
  photoCardShadow: {
    width: CARD_WIDTH,
    height: PHOTO_H,
    borderRadius: 8,
    shadowColor: '#1C1208',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  // クリップ用（FlatListのページングをborderRadiusで丸く切る）
  photoCardClip: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8F0DC',
  },
  // 各写真ページ
  photoItem: {
    width: CARD_WIDTH,
    height: PHOTO_H,
    backgroundColor: '#F8F0DC',
    padding: FRAME_SIDE,
    paddingBottom: FRAME_BOTTOM,
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
