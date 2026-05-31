import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { api } from '../lib/api';
import type { Photo } from '../lib/types';

type Phase = 'input' | 'loading' | 'result';

type Props = {
  visible: boolean;
  photo: Photo;
  onClose: () => void;
  onSaved: (newPhoto: Photo) => void;
};

export function AiTransformModal({ visible, photo, onClose, onSaved }: Props) {
  const [phase, setPhase]     = useState<Phase>('input');
  const [prompt, setPrompt]   = useState('');
  const [result, setResult]   = useState<Photo | null>(null);
  const [error, setError]     = useState('');

  async function handleTransform() {
    if (!prompt.trim()) return;
    setPhase('loading');
    setError('');
    try {
      const newPhoto = await api.aiTransformPhoto(photo.album_id, photo.id, prompt.trim());
      setResult(newPhoto);
      setPhase('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
      setPhase('input');
    }
  }

  function handleClose() {
    setPhase('input');
    setPrompt('');
    setResult(null);
    setError('');
    onClose();
  }

  function handleSave() {
    if (result) onSaved(result);
    handleClose();
  }

  function handleRetry() {
    setPhase('input');
    setResult(null);
    setError('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.sheet}>

          {/* ヘッダー */}
          <View style={s.header}>
            <Text style={s.title}>AI写真加工</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={s.closeX}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 元写真サムネイル */}
          <Image source={{ uri: photo.url }} style={s.thumb} resizeMode="cover" />

          {phase === 'input' && (
            <>
              <Text style={s.label}>どんな加工をしますか？</Text>
              <TextInput
                style={s.input}
                placeholder="例：油絵風にして、夕焼けの空にして、など"
                placeholderTextColor="#aaa"
                value={prompt}
                onChangeText={setPrompt}
                multiline
                autoFocus
              />
              {!!error && <Text style={s.error}>{error}</Text>}
              <TouchableOpacity
                style={[s.btn, s.btnPrimary, !prompt.trim() && s.btnDisabled]}
                onPress={handleTransform}
                disabled={!prompt.trim()}
              >
                <Text style={s.btnPrimaryText}>提出</Text>
              </TouchableOpacity>
            </>
          )}

          {phase === 'loading' && (
            <View style={s.loadingArea}>
              <ActivityIndicator size="large" color="#1C1208" />
              <Text style={s.loadingText}>Geminiが加工中…</Text>
            </View>
          )}

          {phase === 'result' && result && (
            <>
              <Text style={s.label}>加工結果</Text>
              <Image source={{ uri: result.url }} style={s.resultImg} resizeMode="cover" />
              <View style={s.resultBtns}>
                <TouchableOpacity style={[s.btn, s.btnSecondary]} onPress={handleRetry}>
                  <Text style={s.btnSecondaryText}>やり直す</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={handleSave}>
                  <Text style={s.btnPrimaryText}>アルバムに保存</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const C = {
  dark: '#1C1208',
  bg:   '#F8F4EE',
  border: '#E0D8CC',
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title:  { fontSize: 16, fontWeight: '800', color: C.dark },
  closeX: { fontSize: 14, fontWeight: '700', color: C.dark },

  thumb: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },

  label: { fontSize: 13, fontWeight: '700', color: C.dark },
  input: {
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: C.dark,
    minHeight: 48,
    textAlignVertical: 'top',
    backgroundColor: '#fff',
  },
  error: { fontSize: 12, color: '#c0392b' },

  btn: {
    flex: 1,
    minHeight: 56,
    justifyContent: 'center',
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimary:     { backgroundColor: C.dark },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  btnSecondary:     { backgroundColor: C.border },
  btnSecondaryText: { color: C.dark, fontSize: 14, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  loadingArea: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  loadingText: { fontSize: 14, color: '#666' },

  resultImg: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#ddd',
  },
  resultBtns: { flexDirection: 'row', gap: 10 },
});
