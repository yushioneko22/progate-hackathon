import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native';
import { api } from '../lib/api';
import { token } from '../lib/token';
import type { Screen } from '../types/navigation';

const C = {
  bg: '#E8D5B0', card: '#F8F0DC', dark: '#1C1208',
  muted: '#8A7A64', red: '#B8291C', border: '#D4C4A0',
};

type Tab = 'login' | 'register';

export function SignInScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      const res = tab === 'login'
        ? await api.login(email, password)
        : await api.register(email, password, displayName);
      token.set(res.token);
      onNavigate('albums');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={s.back} onPress={() => onNavigate('landing')}>
          <Text style={s.backText}>← 戻る</Text>
        </TouchableOpacity>

        <Text style={s.tagline}>変 ル ン で す</Text>
        <Text style={s.title}>{tab === 'login' ? 'ログイン' : 'アカウント作成'}</Text>

        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, tab === 'login' && s.tabActive]}
            onPress={() => { setTab('login'); setError(''); }}
          >
            <Text style={[s.tabText, tab === 'login' && s.tabTextActive]}>ログイン</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.tab, tab === 'register' && s.tabActive]}
            onPress={() => { setTab('register'); setError(''); }}
          >
            <Text style={[s.tabText, tab === 'register' && s.tabTextActive]}>新規登録</Text>
          </TouchableOpacity>
        </View>

        <View style={s.form}>
          {tab === 'register' && (
            <View style={s.field}>
              <Text style={s.label}>表示名</Text>
              <TextInput
                style={s.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="例: 田中花子"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
              />
            </View>
          )}

          <View style={s.field}>
            <Text style={s.label}>メールアドレス</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor={C.muted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={s.field}>
            <Text style={s.label}>パスワード</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={C.muted}
              secureTextEntry
            />
          </View>

          {error !== '' && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity
            style={[s.btn, loading && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#F5EDD8" />
              : <Text style={s.btnText}>{tab === 'login' ? 'ログ イ ン' : '登　録'}</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { padding: 24, paddingBottom: 48 },

  back: { marginBottom: 24 },
  backText: { color: C.muted, fontSize: 14 },

  tagline: { fontSize: 11, letterSpacing: 4, color: C.muted, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '900', color: C.dark, marginBottom: 24 },

  tabs: { flexDirection: 'row', borderWidth: 1.5, borderColor: C.dark, marginBottom: 28 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { backgroundColor: C.dark },
  tabText: { fontSize: 14, color: C.dark, fontWeight: '600' },
  tabTextActive: { color: '#F5EDD8' },

  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 12, letterSpacing: 2, color: C.muted, fontWeight: '600' },
  input: {
    borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: C.dark,
  },

  error: { color: C.red, fontSize: 13, textAlign: 'center' },

  btn: { backgroundColor: C.dark, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#F5EDD8', fontSize: 15, fontWeight: '500', letterSpacing: 6 },
});
