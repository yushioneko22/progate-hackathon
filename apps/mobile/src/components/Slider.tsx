import { useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';

const THUMB = 22;

/**
 * 依存なしの軽量スライダー(0..1)。指の位置からトラック幅で値を算出する。
 * リアルタイムプレビューが無いPhase Aでも、強度・混合比の調整に使う。
 */
export function Slider({
  value,
  onChange,
  color = '#1C1208',
}: {
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange; // 常に最新のコールバックを参照(クロージャ古化を回避)

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
    }),
  ).current;

  function emit(x: number) {
    const w = widthRef.current;
    if (!w) return;
    onChangeRef.current(Math.max(0, Math.min(1, x / w)));
  }

  return (
    <View
      style={s.wrap}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      {...responder.panHandlers}
    >
      <View style={s.track} />
      <View style={[s.fill, { width: Math.max(0, width * value), backgroundColor: color }]} />
      <View
        style={[s.thumb, { left: Math.max(0, width * value - THUMB / 2), borderColor: color }]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { height: THUMB, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#D4C4A0' },
  fill: { position: 'absolute', left: 0, height: 4, borderRadius: 2 },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: '#F8F0DC', borderWidth: 2,
  },
});
