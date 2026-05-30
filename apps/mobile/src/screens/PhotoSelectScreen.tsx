import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Image, Dimensions,
} from 'react-native';
import type { Photo } from '../lib/types';

const { width: SW } = Dimensions.get('window');
const COLS = 3;
const CELL = (SW - 2) / COLS; // 2px for gaps

const C = {
  bg: '#E8D5B0', card: '#F8F0DC', dark: '#1C1208',
  muted: '#8A7A64', border: '#D4C4A0', green: '#2D5A3D',
};

type Props = {
  photos: Photo[];
  onBack: () => void;
  onPlay: (selected: Photo[]) => void;
};

export function PhotoSelectScreen({ photos, onBack, onPlay }: Props) {
  // 撮影日時順にソート（null は末尾）
  const sorted = useMemo(() => [...photos].sort((a, b) => {
    const ta = a.taken_at ?? a.created_at;
    const tb = b.taken_at ?? b.created_at;
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  }), [photos]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(sorted.map(p => p.id)) // デフォルト全選択
  );

  const allSelected = selectedIds.size === sorted.length;

  function toggle(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(
      allSelected ? new Set() : new Set(sorted.map(p => p.id))
    );
  }

  function handlePlay() {
    const selected = sorted.filter(p => selectedIds.has(p.id));
    onPlay(selected);
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* ヘッダー */}
      <View style={s.header}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}>
          <Text style={s.backText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{selectedIds.size} 枚選択中</Text>
        <TouchableOpacity onPress={toggleAll} style={s.toggleAllBtn}>
          <Text style={s.toggleAllText}>{allSelected ? '全て解除' : '全て選択'}</Text>
        </TouchableOpacity>
      </View>

      {/* 写真グリッド */}
      <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
        {sorted.map(photo => {
          const selected = selectedIds.has(photo.id);
          return (
            <TouchableOpacity
              key={photo.id}
              onPress={() => toggle(photo.id)}
              activeOpacity={0.85}
            >
              <View style={s.cell}>
                <Image source={{ uri: photo.url }} style={s.img} resizeMode="cover" />

                {/* 選択時のオーバーレイ */}
                {selected && <View style={s.selectedOverlay} />}

                {/* チェックマーク */}
                <View style={[s.checkCircle, selected && s.checkCircleSelected]}>
                  {selected && <Text style={s.checkMark}>✓</Text>}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 再生ボタン */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.playBtn, selectedIds.size === 0 && s.playBtnDisabled]}
          onPress={handlePlay}
          disabled={selectedIds.size === 0}
          activeOpacity={0.85}
        >
          <Text style={s.playBtnText}>
            ▶  フォトムービーを再生（{selectedIds.size} 枚）
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1.5, borderBottomColor: C.dark,
    gap: 8,
  },
  backBtn: { paddingRight: 4 },
  backText: { fontSize: 14, color: C.muted },
  headerTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: C.dark, textAlign: 'center' },
  toggleAllBtn: {},
  toggleAllText: { fontSize: 12, color: C.muted, fontWeight: '600' },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    paddingBottom: 100,
  },

  cell: {
    width: CELL,
    height: CELL,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(45,90,61,0.35)', // 緑がかった選択色
  },
  checkCircle: {
    position: 'absolute',
    top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#fff',
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: C.green,
    borderColor: C.green,
  },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '800' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg,
    borderTopWidth: 1.5, borderTopColor: C.dark,
    padding: 16, paddingBottom: 32,
  },
  playBtn: {
    backgroundColor: C.dark,
    paddingVertical: 16,
    alignItems: 'center',
  },
  playBtnDisabled: { opacity: 0.4 },
  playBtnText: { color: '#F5EDD8', fontSize: 14, fontWeight: '700', letterSpacing: 1.5 },
});
