import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, Animated, Image,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import type { Photo } from '../lib/types';

const { width: SW, height: SH } = Dimensions.get('window');

const SHAKES_NEEDED = 7;
const SHAKE_THRESHOLD = 1.8; // gravity 単位で 1.8g 以上
const DEBOUNCE_MS = 450;

const C = {
  bg: '#0A0806',
  text: '#F5EDD8',
  muted: 'rgba(245,237,216,0.5)',
  gold: '#C9A84C',
};

type Props = {
  photos: Photo[];
  albumTitle: string;
  onReveal: () => void;
};

export function ShakeRevealScreen({ photos, albumTitle, onReveal }: Props) {
  const [shakeCount, setShakeCount] = useState(0);
  const lastShakeTime = useRef(0);
  const isRevealed = useRef(false);

  // アニメーション値
  const photoOpacity   = useRef(new Animated.Value(0.06)).current; // 写真の透明度
  const frostOpacity   = useRef(new Animated.Value(1)).current;    // 霜がかったオーバーレイ
  const hintOpacity    = useRef(new Animated.Value(1)).current;    // ヒント UI
  const phoneShake     = useRef(new Animated.Value(0)).current;    // ヒントアイコンの揺れ
  const flashAnim      = useRef(new Animated.Value(0)).current;    // 振った時のフラッシュ

  // ヒントアイコンの揺れループ
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(1200),
      Animated.timing(phoneShake, { toValue: -14, duration: 80, useNativeDriver: true }),
      Animated.timing(phoneShake, { toValue: 14,  duration: 80, useNativeDriver: true }),
      Animated.timing(phoneShake, { toValue: -10, duration: 70, useNativeDriver: true }),
      Animated.timing(phoneShake, { toValue: 10,  duration: 70, useNativeDriver: true }),
      Animated.timing(phoneShake, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  // 加速度センサー
  useEffect(() => {
    Accelerometer.setUpdateInterval(80);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      if (isRevealed.current) return;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - lastShakeTime.current > DEBOUNCE_MS) {
        lastShakeTime.current = now;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // 振った時のフラッシュ
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.25, duration: 60, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0,    duration: 180, useNativeDriver: true }),
        ]).start();

        setShakeCount(prev => {
          const next = prev + 1;
          const progress = next / SHAKES_NEEDED;

          // 写真が徐々に鮮明になる
          Animated.timing(photoOpacity, {
            toValue: 0.06 + 0.94 * progress,
            duration: 350,
            useNativeDriver: true,
          }).start();

          // 霜が徐々に晴れる
          Animated.timing(frostOpacity, {
            toValue: Math.max(0, 1 - progress * 1.15),
            duration: 350,
            useNativeDriver: true,
          }).start();

          if (next >= SHAKES_NEEDED) {
            isRevealed.current = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // ヒント UI をフェードアウトしてコールバック
            Animated.timing(hintOpacity, { toValue: 0, duration: 400, useNativeDriver: true })
              .start(() => setTimeout(onReveal, 300));
          }

          return next;
        });
      }
    });
    return () => sub.remove();
  }, []);

  const progress = Math.min(shakeCount / SHAKES_NEEDED, 1);

  return (
    <View style={s.container}>
      {/* 写真グリッド（徐々に見えてくる） */}
      <Animated.View style={[s.photoGrid, { opacity: photoOpacity }]}>
        {photos.slice(0, 9).map(p => (
          <Image
            key={p.id}
            source={{ uri: p.url }}
            style={s.photoCell}
            resizeMode="cover"
          />
        ))}
      </Animated.View>

      {/* 霜がかったオーバーレイ（振るたびに晴れる） */}
      <Animated.View style={[s.frost, { opacity: frostOpacity }]} />

      {/* 振った時のフラッシュ */}
      <Animated.View style={[s.flash, { opacity: flashAnim }]} />

      {/* ヒント UI */}
      <Animated.View style={[s.hint, { opacity: hintOpacity }]}>
        <Text style={s.albumTitle}>{albumTitle}</Text>
        <Text style={s.openLabel}>現像完了！</Text>

        {/* 振る回数インジケーター */}
        <View style={s.dots}>
          {Array.from({ length: SHAKES_NEEDED }).map((_, i) => (
            <View
              key={i}
              style={[s.dot, i < shakeCount && s.dotFilled]}
            />
          ))}
        </View>

        {/* ヒントアイコン */}
        <Animated.Text
          style={[s.phoneIcon, { transform: [{ translateX: phoneShake }] }]}
        >
          📱
        </Animated.Text>
        <Text style={s.shakeText}>
          {shakeCount === 0
            ? 'スマホを振って開封！'
            : shakeCount < SHAKES_NEEDED
              ? `あと ${SHAKES_NEEDED - shakeCount} 回！`
              : ''}
        </Text>
      </Animated.View>
    </View>
  );
}

const CELL = SW / 3;

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // 写真グリッド
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: SW,
    height: SW, // 3×3 正方形グリッド
    marginTop: (SH - SW) / 2, // 縦中央に配置
    position: 'absolute',
  },
  photoCell: {
    width: CELL,
    height: CELL,
  },

  // 霜オーバーレイ
  frost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E8D5B0',
  },

  // フラッシュ
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
  },

  // ヒント UI
  hint: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  albumTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: C.text,
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  openLabel: {
    fontSize: 12,
    color: C.muted,
    letterSpacing: 4,
  },

  // ドットインジケーター
  dots: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(245,237,216,0.4)',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: C.gold,
    borderColor: C.gold,
  },

  // 揺れるスマホ
  phoneIcon: {
    fontSize: 52,
    marginTop: 8,
  },
  shakeText: {
    fontSize: 14,
    color: C.muted,
    letterSpacing: 2,
  },
});
