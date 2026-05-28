import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Animated, Dimensions,
} from 'react-native';
import type { Album } from '../lib/types';

const C = {
  bg: '#E8D5B0', card: '#F8F0DC', dark: '#1C1208',
  muted: '#8A7A64', red: '#B8291C', green: '#2D5A3D',
  border: '#D4C4A0',
};

const { width: SW } = Dimensions.get('window');

// 仮写真の色パレット
const MOCK_PHOTO_COLORS = [
  ['#C8843A', '#3A2510'],
  ['#2D5A3D', '#1A3A28'],
  ['#B8291C', '#7A1A10'],
  ['#8A6A3A', '#5A4020'],
  ['#4A6A8A', '#2A4A6A'],
  ['#6A4A8A', '#3A2A5A'],
  ['#8A4A4A', '#5A2A2A'],
  ['#4A8A6A', '#2A5A4A'],
  ['#8A8A3A', '#5A5A1A'],
];

function MockPhoto({ colors, rotation }: { colors: string[]; rotation: number }) {
  return (
    <View style={[s.polaroid, { transform: [{ rotate: `${rotation}deg` }] }]}>
      <View style={[s.photoArea, { backgroundColor: colors[0] }]}>
        {/* 月 */}
        <View style={[s.moonSmall, { backgroundColor: colors[1], opacity: 0.6 }]} />
        {/* 人物シルエット */}
        <View style={[s.figureSmall, { backgroundColor: colors[1] }]} />
      </View>
      <View style={s.polaroidCaption} />
    </View>
  );
}

function SealedView({ album }: { album: Album }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const daysLeft = album.days_left ?? 0;

  return (
    <View style={s.sealedContainer}>
      {/* フィルム穴装飾 */}
      <View style={s.filmStrip}>
        {[...Array(6)].map((_, i) => <View key={i} style={s.filmDot} />)}
      </View>

      <View style={s.darkRoom}>
        {/* 暗室ランプ */}
        <View style={s.lamp}>
          <View style={s.lampGlow} />
          <View style={s.lampBulb} />
        </View>

        {/* カウントダウン */}
        <Animated.View style={[s.countdownBox, { transform: [{ scale: pulse }] }]}>
          <Text style={s.countdownLabel}>現 像 ま で</Text>
          <Text style={s.countdownNum}>{daysLeft}</Text>
          <Text style={s.countdownUnit}>日</Text>
        </Animated.View>

        <View style={s.sealedBadge}>
          <Text style={s.sealedBadgeText}>SEALED</Text>
        </View>

        <Text style={s.sealedDesc}>
          現像日 {album.reveal_date.slice(0, 10)} まで{'\n'}このアルバムは開封できません
        </Text>

        {/* フィルム情報 */}
        <View style={s.filmInfo}>
          <Text style={s.filmInfoText}>{album.photo_count} / {album.max_exposures} EXP</Text>
          <Text style={s.filmInfoText}>{album.member_count}人参加中</Text>
        </View>
      </View>

      <View style={s.filmStrip}>
        {[...Array(6)].map((_, i) => <View key={i} style={s.filmDot} />)}
      </View>
    </View>
  );
}

function OpenedView({ album }: { album: Album }) {
  const [revealed, setRevealed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    // 少し待ってから「現像完了」演出
    const t = setTimeout(() => {
      setRevealed(true);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }, 300);
    return () => clearTimeout(t);
  }, [fadeAnim, slideAnim]);

  const photos = MOCK_PHOTO_COLORS.slice(0, Math.min(Math.max(album.photo_count, 6), 9));

  return (
    <ScrollView contentContainerStyle={s.openedContainer}>
      {/* 現像完了バナー */}
      <Animated.View style={[s.revealBanner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={s.revealEmoji}>📸</Text>
        <Text style={s.revealTitle}>現 像 完 了 ！</Text>
        <Text style={s.revealDate}>{album.reveal_date.slice(0, 10)} に現像されました</Text>
      </Animated.View>

      {/* 写真グリッド */}
      <Animated.View style={[s.photoGrid, { opacity: fadeAnim }]}>
        {photos.map((colors, i) => (
          <MockPhoto
            key={i}
            colors={colors}
            rotation={(i % 3 === 0 ? -2 : i % 3 === 1 ? 1 : -1) + (i % 2 === 0 ? 0.5 : -0.5)}
          />
        ))}
        {photos.length === 0 && (
          <View style={s.emptyPhotos}>
            <Text style={s.emptyPhotosText}>写真がまだありません</Text>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

export function AlbumDetailScreen({ album, onBack }: { album: Album; onBack: () => void }) {
  const isSealed = album.status === 'sealed';

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{album.title}</Text>
        <View style={[s.headerBadge, isSealed ? s.headerBadgeRed : s.headerBadgeGreen]}>
          <Text style={[s.headerBadgeText, { color: isSealed ? C.red : C.green }]}>
            {isSealed ? 'SEALED' : 'OPENED'}
          </Text>
        </View>
      </View>

      {isSealed ? <SealedView album={album} /> : <OpenedView album={album} />}
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
  openedContainer: { padding: 20, gap: 24, paddingBottom: 48 },
  revealBanner: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  revealEmoji: { fontSize: 48 },
  revealTitle: { fontSize: 28, fontWeight: '900', color: C.dark, letterSpacing: 6 },
  revealDate: { fontSize: 12, color: C.muted },

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
    alignItems: 'center', justifyContent: 'flex-end',
    position: 'relative',
  },
  moonSmall: {
    position: 'absolute', top: 12, alignSelf: 'center',
    width: 30, height: 30, borderRadius: 15,
  },
  figureSmall: {
    width: 36, height: 40, borderTopLeftRadius: 14,
    borderTopRightRadius: 14, marginBottom: 0,
  },
  polaroidCaption: { height: 8 },

  emptyPhotos: { padding: 32, alignItems: 'center' },
  emptyPhotosText: { color: C.muted, fontSize: 14 },
});
