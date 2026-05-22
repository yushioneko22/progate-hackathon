import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '@/lib/api';
import type { Todo } from '@/lib/types';

export function TodoScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await api.list();
      setTodos(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    const value = title.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const created = await api.create(value);
      setTodos((prev) => [created, ...prev]);
      setTitle('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (todo: Todo) => {
    try {
      const updated = await api.update(todo.id, { completed: !todo.completed });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (todo: Todo) => {
    try {
      await api.remove(todo.id);
      setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <Text style={styles.title}>Todo</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="新しいタスクを入力..."
            placeholderTextColor="#9aa3b8"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable
            style={[
              styles.addButton,
              (!title.trim() || submitting) && styles.addButtonDisabled,
            ]}
            onPress={handleAdd}
            disabled={!title.trim() || submitting}
          >
            <Text style={styles.addButtonText}>追加</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#6ea8ff" />
          </View>
        ) : todos.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>タスクはまだありません</Text>
          </View>
        ) : (
          <FlatList
            data={todos}
            keyExtractor={(t) => t.id}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Pressable
                  onPress={() => handleToggle(item)}
                  style={[styles.checkbox, item.completed && styles.checkboxChecked]}
                  accessibilityLabel={`${item.title} を完了`}
                >
                  {item.completed && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
                <Text style={[styles.rowTitle, item.completed && styles.rowTitleDone]}>
                  {item.title}
                </Text>
                <Pressable onPress={() => handleDelete(item)} accessibilityLabel="削除">
                  <Text style={styles.deleteButton}>削除</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b0d12' },
  container: { flex: 1, padding: 20, gap: 16 },
  title: { color: '#e7ebf3', fontSize: 28, fontWeight: '700' },
  form: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#161922',
    borderColor: '#2a2f40',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e7ebf3',
    fontSize: 15,
  },
  addButton: {
    backgroundColor: '#6ea8ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.5 },
  addButtonText: { color: '#0b0d12', fontWeight: '700', fontSize: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { color: '#9aa3b8' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161922',
    borderColor: '#2a2f40',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderColor: '#2a2f40',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#6ea8ff', borderColor: '#6ea8ff' },
  checkmark: { color: '#0b0d12', fontWeight: '700' },
  rowTitle: { flex: 1, color: '#e7ebf3' },
  rowTitleDone: { color: '#9aa3b8', textDecorationLine: 'line-through' },
  deleteButton: { color: '#ff6b6b' },
  errorBox: {
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { color: '#ff6b6b', fontSize: 14 },
});
