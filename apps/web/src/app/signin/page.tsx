'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { token } from '@/lib/token';

export default function SignInPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = tab === 'login'
        ? await api.login(email, password)
        : await api.register(email, password, displayName);
      token.set(res.token);
      router.push('/albums');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page">
      {/* Header */}
      <div className="signin-header">
        <Link href="/" className="back-btn" aria-label="戻る">‹</Link>
        <span className="header-title">ログイン</span>
      </div>

      {/* Receipt heading */}
      <div className="receipt-section">
        <p className="receipt-no">受付票　No. 0027</p>
        <h1 className="receipt-heading">おかえりなさい。</h1>
        <h2 className="receipt-heading-red">続きを現像します</h2>
        <div className="stamp-badge-sm">受</div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab-btn${tab === 'login' ? ' active' : ''}`}
          onClick={() => { setTab('login'); setError(null); }}
        >
          ログイン
        </button>
        <button
          className={`tab-btn${tab === 'register' ? ' active' : ''}`}
          onClick={() => { setTab('register'); setError(null); }}
        >
          新規登録
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {tab === 'register' && (
          <div className="field">
            <div className="field-header">
              <label className="field-label" htmlFor="display_name">表示名</label>
            </div>
            <input
              id="display_name"
              type="text"
              className="field-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="林 健太"
              required
            />
          </div>
        )}

        <div className="field">
          <div className="field-header">
            <label className="field-label" htmlFor="email">メールアドレス</label>
            <span className="field-hint">アカウントの控えに記入</span>
          </div>
          <input
            id="email"
            type="email"
            className="field-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <div className="field-header">
            <label className="field-label" htmlFor="password">パスワード</label>
            <span className="field-hint">忘れた方は問い合わせ票へ</span>
          </div>
          <input
            id="password"
            type="password"
            className="field-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? '処 理 中 …' : '受 付 す る'}
        </button>
      </form>
    </div>
  );
}
