'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/');
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
          onClick={() => setTab('login')}
        >
          ログイン
        </button>
        <button
          className={`tab-btn${tab === 'register' ? ' active' : ''}`}
          onClick={() => setTab('register')}
        >
          新規登録
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
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
          />
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span className="checkbox-label">このデバイスを記憶する</span>
        </label>

        <button type="submit" className="btn-primary">
          受 付 す る
        </button>
      </form>

      <div className="divider">または</div>

      <button type="button" className="btn-outline">A p p l e　で 続 け る</button>
      <button type="button" className="btn-outline">G o o g l e　で 続 け る</button>
    </div>
  );
}
