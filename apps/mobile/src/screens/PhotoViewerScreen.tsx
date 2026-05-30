import { useEffect, useRef, useState } from 'react';
import {
  View, Image, TouchableOpacity, Text, StyleSheet,
  Dimensions, Animated, Modal, Platform,
} from 'react-native';
import type { Photo } from '../lib/types';

const { width: SW, height: SH } = Dimensions.get('window');

const CARD_W = 72;
const CARD_H = 104;
const CARD_ROTATION_PER_STEP = 11; // 1枚ずつの回転角度（度）
const FAN_SPREAD = 3;              // 中央から左右それぞれ何枚見せるか
const PIVOT = CARD_H / 2;          // カード底辺を軸にするためのオフセット

type Props = {
  photos: Photo[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

export function PhotoViewerScreen({ photos, initialIndex, visible, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const photoOpacity = useRef(new Animated.Value(0)).current;
  const photoScale  = useRef(new Animated.Value(0.82)).current;

  // 開くたびにリセット＆アニメーション
  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    photoOpacity.setValue(0);
    photoScale.setValue(0.82);
    Animated.parallel([
      Animated.timing(photoOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(photoScale, {
        toValue: 1, useNativeDriver: true,
        tension: 100, friction: 7,
      }),
    ]).start();
  }, [visible, initialIndex]);

  function selectPhoto(idx: number) {
    if (idx === currentIndex) return;
    Animated.timing(photoOpacity, { toValue: 0, duration: 130, useNativeDriver: true })
      .start(() => {
        setCurrentIndex(idx);
        Animated.timing(photoOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
  }

  // 表示するファンカードを作成
  const fanItems: { idx: number; offset: number }[] = [];
  for (let off = -FAN_SPREAD; off <= FAN_SPREAD; off++) {
    const idx = currentIndex + off;
    if (idx >= 0 && idx < photos.length) {
      fanItems.push({ idx, offset: off });
    }
  }

  const BOTTOM_PADDING = Platform.OS === 'ios' ? 40 : 24;
  const FAN_HEIGHT = CARD_H + BOTTOM_PADDING + 24;
  const HEADER_HEIGHT = Platform.OS === 'ios' ? 100 : 68;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.container}>

        {/* ヘッダー：閉じるボタン + 枚数カウンター */}
        <View style={[s.header, { height: HEADER_HEIGHT }]}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.counter}>{currentIndex + 1} / {photos.length}</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* 全画面写真エリア */}
        <Animated.View style={[
          s.photoWrap,
          { height: SH - HEADER_HEIGHT - FAN_HEIGHT },
          { opacity: photoOpacity, transform: [{ scale: photoScale }] },
        ]}>
          {photos[currentIndex] && (
            <Image
              source={{ uri: photos[currentIndex].url }}
              style={s.photo}
              resizeMode="contain"
            />
          )}
        </Animated.View>

        {/* ファンカード（トランプの手札風） */}
        <View style={[s.fanArea, { height: FAN_HEIGHT, paddingBottom: BOTTOM_PADDING }]}>
          {fanItems.map(({ idx, offset }) => {
            const isActive = idx === currentIndex;
            const rotation = offset * CARD_ROTATION_PER_STEP;
            const zIndex = FAN_SPREAD + 1 - Math.abs(offset);
            return (
              <TouchableOpacity
                key={idx}
                onPress={() => selectPhoto(idx)}
                activeOpacity={0.8}
                style={[s.fanCardTouch, { zIndex }]}
              >
                {/* カード底辺を中心に回転 */}
                <View style={{
                  transform: [
                    { translateY: PIVOT },
                    { rotate: `${rotation}deg` },
                    { translateY: -PIVOT },
                  ],
                }}>
                  <View style={[s.fanCard, isActive && s.fanCardActive]}>
                    <Image
                      source={{ uri: photos[idx].url }}
                      style={s.fanCardImg}
                      resizeMode="cover"
                    />
                    {/* 選択中以外は暗く */}
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
  container: {
    flex: 1,
    backgroundColor: '#0A0806',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: 20,
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

  photoWrap: {
    width: SW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: SW,
    height: '100%',
  },

  // カードが全て重なる中央下部
  fanArea: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fanCardTouch: {
    position: 'absolute',
    bottom: 0, // paddingBottom は fanArea 側で管理
    left: SW / 2 - CARD_W / 2,
  },
  fanCard: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 10,
  },
  fanCardActive: {
    borderColor: '#F5EDD8',
  },
  fanCardImg: { width: '100%', height: '100%' },
  fanCardDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
});
