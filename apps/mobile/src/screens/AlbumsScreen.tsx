import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Modal, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { api } from '../lib/api';
import { token } from '../lib/token';
import type { Album } from '../lib/types';
import type { Screen } from '../types/navigation';

const C = {
  bg: '#E8D5B0', card: '#F8F0DC', dark: '#1C1208',
  muted: '#8A7A64', red: '#B8291C', green: '#2D5A3D',
  border: '#D4C4A0',
};

const EXP_OPTIONS = [8, 12, 18, 24, 27, 36];

function AlbumCard({ album }: { album: Album }) {
  const isSealed = album.status === 'sealed';
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={[s.statusBadge, isSealed ? s.statusSealed : s.statusOpened]}>
          <Text style={[s.statusText, { color: isSealed ? C.red : C.green }]}>
            {isSealed ? 'SEALED' : 'OPENED'}
          </Text>
        </View>
        <Text style={s.memberCount}>{album.member_count}人</Text>
      </View>

      <View style={s.cardFilm}>
        <View style={s.filmHoles}>
          {[...Array(4)].map((_, i) => <View key={i} style={s.filmHole} />)}
        </View>
        <View style={s.filmMain}>
          <Text style={s.albumTitle}>{album.title}</Text>
          {isSealed && album.days_left !== null && (
            <Text style={s.daysLeft}>{album.days_left}日後に現像</Text>
          )}
        </View>
        <View style={s.filmHoles}>
          {[...Array(4)].map((_, i) => <View key={i} style={s.filmHole} />)}
        </View>
      </View>

      <View style={s.cardBottom}>
        <Text style={s.cardMeta}>{album.photo_count} / {album.max_exposures} EXP</Text>
        <Text style={s.cardDate}>{album.reveal_date.slice(0, 10)}</Text>
      </View>
    </View>
  );
}

function CreateModal({
  visible, onClose, onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (a: Album) => void;
}) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [expIdx, setExpIdx] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function reset() {
    setTitle(''); setDate(''); setExpIdx(2); setError('');
  }

  async function handleCreate() {
    if (!title.trim()) { setError('タイトルを入力してください'); return; }
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) { setError('日付は YYYY-MM-DD 形式で入力してください'); return; }
    setError('');
    setLoading(true);
    try {
      const album = await api.createAlbum({
        title: title.trim(),
        reveal_date: date,
        max_exposures: EXP_OPTIONS[expIdx],
      });
      onCreated(album);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <TouchableOpacity style={s.modalBackdrop} onPress={onClose} activeOpacity={1} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>新しいアルバムを作成</Text>

          <View style={s.field}>
            <Text style={s.label}>タイトル</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="夏合宿 2025"
              placeholderTextColor={C.muted}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>現像日 (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              value={date}
              onChangeText={setDate}
              placeholder="2025-08-31"
              placeholderTextColor={C.muted}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>枚数制限 — {EXP_OPTIONS[expIdx]} EXP</Text>
            <View style={s.expOptions}>
              {EXP_OPTIONS.map((v, i) => (
                <TouchableOpacity
                  key={v}
                  style={[s.expChip, i === expIdx && s.expChipActive]}
                  onPress={() => setExpIdx(i)}
                >
                  <Text style={[s.expChipText, i === expIdx && s.expChipTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {error !== '' && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleCreate}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#F5EDD8" />
              : <Text style={s.btnText}>作　成</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function AlbumsScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listAlbums();
      setAlbums(data);
    } catch {
      Alert.alert('エラー', 'アルバムの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleSignOut() {
    token.remove();
    onNavigate('landing');
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.headerTitle}>現 像 所</Text>
        <TouchableOpacity onPress={handleSignOut}>
          <Text style={s.signout}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.dark} />
        </View>
      ) : albums.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyIcon}>📷</Text>
          <Text style={s.emptyTitle}>アルバムがまだありません</Text>
          <Text style={s.emptyDesc}>最初のアルバムを作ってみましょう</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setShowCreate(true)}>
            <Text style={s.emptyBtnText}>アルバムを作成</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {albums.map(a => <AlbumCard key={a.id} album={a} />)}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      <CreateModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={a => setAlbums(prev => [a, ...prev])}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1.5, borderBottomColor: C.dark,
  },
  headerTitle: { fontSize: 16, fontWeight: '900', color: C.dark, letterSpacing: 6 },
  signout: { fontSize: 13, color: C.muted },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.dark, marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: C.muted, marginBottom: 24, textAlign: 'center' },
  emptyBtn: { backgroundColor: C.dark, paddingHorizontal: 32, paddingVertical: 14 },
  emptyBtnText: { color: '#F5EDD8', fontSize: 14, fontWeight: '600', letterSpacing: 3 },

  list: { padding: 16, gap: 16 },

  card: { backgroundColor: C.card, padding: 16, shadowColor: C.dark, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1.5 },
  statusSealed: { borderColor: C.red },
  statusOpened: { borderColor: C.green },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  memberCount: { fontSize: 12, color: C.muted },

  cardFilm: { flexDirection: 'row', backgroundColor: C.dark, borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  filmHoles: { width: 14, justifyContent: 'space-around', paddingVertical: 8 },
  filmHole: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.bg, alignSelf: 'center' },
  filmMain: { flex: 1, padding: 12 },
  albumTitle: { fontSize: 16, fontWeight: '700', color: '#F5EDD8', marginBottom: 4 },
  daysLeft: { fontSize: 12, color: 'rgba(245,237,216,0.6)' },

  cardBottom: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta: { fontSize: 12, color: C.muted },
  cardDate: { fontSize: 12, color: C.muted },

  fab: {
    position: 'absolute', bottom: 32, right: 24,
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.dark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  fabText: { color: '#F5EDD8', fontSize: 28, lineHeight: 32, fontWeight: '300' },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,18,8,0.5)' },
  modalSheet: { backgroundColor: C.card, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 24, paddingBottom: 40 },
  modalHandle: { width: 40, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: C.dark, marginBottom: 20 },

  field: { marginBottom: 16 },
  label: { fontSize: 11, letterSpacing: 2, color: C.muted, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: C.border, backgroundColor: '#fff',
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.dark,
  },

  expOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  expChip: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1.5, borderColor: C.border },
  expChipActive: { backgroundColor: C.dark, borderColor: C.dark },
  expChipText: { fontSize: 14, color: C.dark, fontWeight: '600' },
  expChipTextActive: { color: '#F5EDD8' },

  error: { color: C.red, fontSize: 13, marginBottom: 8 },

  btn: { backgroundColor: C.dark, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#F5EDD8', fontSize: 15, fontWeight: '500', letterSpacing: 6 },
});
