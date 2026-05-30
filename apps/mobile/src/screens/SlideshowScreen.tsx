import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Dimensions, Image, Animated, Modal, Platform,
} from 'react-native';
import { Audio } from 'expo-av';
import type { Photo } from '../lib/types';

const DEFAULT_BGM = require('../../assets/bgm.mp3');

const { width: SW, height: SH } = Dimensions.get('window');
const PHOTO_MS = 3500;   // how long each photo stays
const FADE_MS = 900;     // crossfade duration
const TITLE_MS = 2400;   // how long title card stays visible
const TITLE_FADE_MS = 700;

const C = {
  bg: '#0A0806',
  text: '#F5EDD8',
  muted: 'rgba(245,237,216,0.55)',
  dim: 'rgba(245,237,216,0.3)',
};

type Props = {
  photos: Photo[];
  albumTitle: string;
  bgmUrl?: string | null;
  visible: boolean;
  onClose: () => void;
};

export function SlideshowScreen({ photos, albumTitle, bgmUrl, visible, onClose }: Props) {
  // Which photo index is loaded in each layer
  const [layer0Photo, setLayer0Photo] = useState(0);
  const [layer1Photo, setLayer1Photo] = useState(photos.length > 1 ? 1 : 0);
  const [phase, setPhase] = useState<'idle' | 'title' | 'photos'>('idle');

  // Animated values
  const op0 = useRef(new Animated.Value(1)).current;
  const op1 = useRef(new Animated.Value(0)).current;
  const sc0 = useRef(new Animated.Value(1)).current;
  const sc1 = useRef(new Animated.Value(1)).current;
  const titleOp = useRef(new Animated.Value(0)).current;

  // Mutable refs (don't trigger re-renders)
  const topLayerRef = useRef<0 | 1>(0); // which layer is on top (visible)
  const layer0IdxRef = useRef(0);
  const layer1IdxRef = useRef(photos.length > 1 ? 1 : 0);
  const isRunningRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Reset + start when modal opens
  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      isRunningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Reset everything
    topLayerRef.current = 0;
    layer0IdxRef.current = 0;
    layer1IdxRef.current = photos.length > 1 ? 1 : 0;
    setLayer0Photo(0);
    setLayer1Photo(photos.length > 1 ? 1 : 0);
    op0.setValue(1);
    op1.setValue(0);
    sc0.setValue(1);
    sc1.setValue(1);
    titleOp.setValue(0);
    setPhase('title');
  }, [visible]);

  // BGM
  useEffect(() => {
    if (!visible) {
      soundRef.current?.stopAsync().then(() => soundRef.current?.unloadAsync());
      soundRef.current = null;
      return;
    }

    const source = bgmUrl ? { uri: bgmUrl } : DEFAULT_BGM;

    let sound: Audio.Sound | null = null;
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true })
      .then(() => Audio.Sound.createAsync(source, { isLooping: true, volume: 0.65 }))
      .then(({ sound: s }) => {
        sound = s;
        soundRef.current = s;
        return s.playAsync();
      })
      .catch(() => {}); // silently ignore BGM errors

    return () => {
      sound?.stopAsync().then(() => sound?.unloadAsync());
    };
  }, [visible]);

  // Title card animation, then switch to photos
  useEffect(() => {
    if (phase !== 'title') return;

    const anim = Animated.sequence([
      Animated.timing(titleOp, { toValue: 1, duration: TITLE_FADE_MS, useNativeDriver: true }),
      Animated.delay(TITLE_MS),
      Animated.timing(titleOp, { toValue: 0, duration: TITLE_FADE_MS, useNativeDriver: true }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setPhase('photos');
    });
    return () => anim.stop();
  }, [phase]);

  // Photo slideshow loop
  useEffect(() => {
    if (phase !== 'photos' || !visible || photos.length === 0) return;

    isRunningRef.current = true;

    function runCycle() {
      if (!isRunningRef.current) return;

      const top = topLayerRef.current;
      const topOp = top === 0 ? op0 : op1;
      const botOp = top === 0 ? op1 : op0;
      const topSc = top === 0 ? sc0 : sc1;
      const botSc = top === 0 ? sc1 : sc0;

      // Ken Burns on current photo
      topSc.setValue(1);
      const kbAnim = Animated.timing(topSc, {
        toValue: 1.18,
        duration: PHOTO_MS + FADE_MS,
        useNativeDriver: true,
      });
      kbAnim.start();

      timerRef.current = setTimeout(() => {
        if (!isRunningRef.current) return;

        const curTopIdx = top === 0 ? layer0IdxRef.current : layer1IdxRef.current;
        const nextPhotoIdx = (curTopIdx + 1) % photos.length;

        // Load next photo into bottom layer
        botSc.setValue(1.0);
        if (top === 0) {
          layer1IdxRef.current = nextPhotoIdx;
          setLayer1Photo(nextPhotoIdx);
        } else {
          layer0IdxRef.current = nextPhotoIdx;
          setLayer0Photo(nextPhotoIdx);
        }

        // Crossfade top→bottom
        Animated.parallel([
          Animated.timing(topOp, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
          Animated.timing(botOp, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
        ]).start(({ finished }) => {
          if (!isRunningRef.current || !finished) return;
          topLayerRef.current = top === 0 ? 1 : 0;
          runCycle();
        });
      }, PHOTO_MS);
    }

    runCycle();

    return () => {
      isRunningRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, visible, photos.length]);

  if (!visible) return null;

  const photo0 = photos[layer0Photo];
  const photo1 = photos[layer1Photo];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={s.container}>
        {/* Layer 0 */}
        <Animated.View style={[s.layer, { opacity: op0 }]}>
          <Animated.View style={[s.layerInner, { transform: [{ scale: sc0 }] }]}>
            {photo0 && (
              <Image source={{ uri: photo0.url }} style={s.photo} resizeMode="cover" />
            )}
          </Animated.View>
        </Animated.View>

        {/* Layer 1 */}
        <Animated.View style={[s.layer, { opacity: op1 }]}>
          <Animated.View style={[s.layerInner, { transform: [{ scale: sc1 }] }]}>
            {photo1 && (
              <Image source={{ uri: photo1.url }} style={s.photo} resizeMode="cover" />
            )}
          </Animated.View>
        </Animated.View>

        {/* Gradient overlay (darkens edges slightly for cinematic feel) */}
        <View style={s.vignette} pointerEvents="none" />

        {/* Title card */}
        {phase === 'title' && (
          <Animated.View style={[s.titleCard, { opacity: titleOp }]} pointerEvents="none">
            <Text style={s.titleLabel}>PHOTO MOVIE</Text>
            <Text style={s.titleAlbum}>{albumTitle}</Text>
            <View style={s.titleLine} />
            <Text style={s.titleCount}>{photos.length} 枚の思い出</Text>
          </Animated.View>
        )}

        {/* Close button */}
        <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.75}>
          <View style={s.closeBtnInner}>
            <Text style={s.closeBtnText}>✕</Text>
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  layerInner: {
    width: '100%',
    height: '100%',
  },
  photo: {
    width: SW,
    height: SH,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    // Subtle dark vignette to add cinematic depth
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  titleCard: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  titleLabel: {
    fontSize: 11,
    letterSpacing: 7,
    color: C.muted,
    fontWeight: '500',
  },
  titleAlbum: {
    fontSize: 30,
    fontWeight: '800',
    color: C.text,
    textAlign: 'center',
    paddingHorizontal: 36,
    letterSpacing: 2,
    lineHeight: 40,
  },
  titleLine: {
    width: 56,
    height: 1,
    backgroundColor: C.dim,
    marginVertical: 2,
  },
  titleCount: {
    fontSize: 13,
    color: C.muted,
    letterSpacing: 3,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 28,
    right: 20,
  },
  closeBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: C.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
