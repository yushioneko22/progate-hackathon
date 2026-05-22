'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Todo } from '@/lib/types';

export default function HomePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .list()
      .then(setTodos)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    try {
      const created = await api.create(value);
      setTodos((prev) => [created, ...prev]);
      setTitle('');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onToggle = async (todo: Todo) => {
    try {
      const updated = await api.update(todo.id, { completed: !todo.completed });
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const onDelete = async (todo: Todo) => {
    try {
      await api.remove(todo.id);
      setTodos((prev) => prev.filter((t) => t.id !== todo.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main>
      <h1>Todo</h1>
      {error && <div className="error">{error}</div>}
      <form onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="新しいタスクを入力..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
        />
        <button type="submit" disabled={!title.trim()}>
          追加
        </button>
      </form>
      {loading ? (
        <div className="empty">読み込み中...</div>
      ) : todos.length === 0 ? (
        <div className="empty">タスクはまだありません</div>
      ) : (
        <ul>
          {todos.map((todo) => (
            <li key={todo.id} className={todo.completed ? 'completed' : ''}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => onToggle(todo)}
                aria-label={`${todo.title} を完了`}
              />
              <span className="title">{todo.title}</span>
              <button className="danger" onClick={() => onDelete(todo)} aria-label="削除">
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
