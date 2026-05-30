import { useRef, useState, useCallback } from 'react';
import {
  View, Image, TouchableOpacity, Text, StyleSheet,
  Dimensions, FlatList, Platform, Modal,
} from 'react-native';
import type { Photo } from '../lib/types';

const { width: SW, height: SH } = Dimensions.get('window');

const THUMB_SIZE = 56;
const THUMB_GAP = 8;
const HEADER_H = Platform.OS === 'ios' ? 100 : 70;
const STRIP_H = THUMB_SIZE + 32;
const PHOTO_H = SH - HEADER_H - STRIP_H;

type Props = {
  photos: Photo[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
};

export function PhotoViewerScreen({ photos, initialIndex, visible, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const mainListRef = useRef<FlatList>(null);
  const thumbListRef = useRef<FlatList>(null);

  const onMainScroll = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
    if (idx !== currentIndex && idx >= 0 && idx < photos.length) {
      setCurrentIndex(idx);
      thumbListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    }
  }, [currentIndex, photos.length]);

  function jumpTo(idx: number) {
    setCurrentIndex(idx);
    mainListRef.current?.scrollToIndex({ index: idx, animated: true });
    thumbListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
  }

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.container}>

        {/* ヘッダー */}
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={s.counter}>{currentIndex + 1} / {photos.length}</Text>
          <View style={s.headerSpacer} />
        </View>

        {/* メイン写真スワイパー */}
        <FlatList
          ref={mainListRef}
          data={photos}
          keyExtractor={p => p.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          onScroll={onMainScroll}
          scrollEventThrottle={16}
          getItemLayout={(_, index) => ({
            length: SW, offset: SW * index, index,
          })}
          renderItem={({ item }) => (
            <View style={s.photoWrap}>
              <Image
                source={{ uri: item.url }}
                style={s.photo}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* サムネイルストリップ */}
        <View style={s.strip}>
          <FlatList
            ref={thumbListRef}
            data={photos}
            keyExtractor={p => p.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.stripContent}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: THUMB_SIZE + THUMB_GAP,
              offset: (THUMB_SIZE + THUMB_GAP) * index,
              index,
            })}
            renderItem={({ item, index }) => {
              const active = index === currentIndex;
              return (
                <TouchableOpacity
                  onPress={() => jumpTo(index)}
                  activeOpacity={0.75}
                  style={s.thumbBtn}
                >
                  <View style={[s.thumb, active && s.thumbActive]}>
                    <Image
                      source={{ uri: item.url }}
                      style={s.thumbImg}
                      resizeMode="cover"
                    />
                    {/* 選択中以外は暗くする */}
                    {!active && <View style={s.thumbDim} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
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

  // ヘッダー
  header: {
    height: HEADER_H,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 12,
    paddingHorizontal: 20,
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeText: { color: '#F5EDD8', fontSize: 14, fontWeight: '600' },
  counter: {
    flex: 1, textAlign: 'center',
    color: 'rgba(245,237,216,0.6)',
    fontSize: 13, letterSpacing: 2,
  },
  headerSpacer: { width: 36 },

  // 写真
  photoWrap: {
    width: SW,
    height: PHOTO_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: SW,
    height: PHOTO_H,
  },

  // サムネイルストリップ
  strip: {
    height: STRIP_H,
    justifyContent: 'center',
  },
  stripContent: {
    paddingHorizontal: (SW - THUMB_SIZE) / 2, // 中央揃えのパディング
    gap: THUMB_GAP,
    alignItems: 'center',
  },
  thumbBtn: {},
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: {
    borderColor: '#F5EDD8',
    transform: [{ scale: 1.12 }],
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
