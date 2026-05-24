'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { token } from '@/lib/token';
import type { Album } from '@/lib/types';

type FilterTab = 'all' | 'sealed' | 'opened';

function AmberThumb() {
  return (
    <svg viewBox="0 0 120 120" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="at-bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#C8843A" />
          <stop offset="100%" stopColor="#7A4A20" />
        </radialGradient>
        <radialGradient id="at-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F0D890" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#C8843A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#at-bg)" />
      <circle cx="60" cy="38" r="28" fill="url(#at-glow)" />
      <circle cx="60" cy="38" r="16" fill="#E8C870" opacity="0.85" />
      <circle cx="38" cy="78" r="9" fill="#3A2510" />
      <path d="M22 92 Q38 85 54 92 L55 120 H21 Z" fill="#3A2510" />
      <circle cx="60" cy="76" r="10" fill="#3A2510" />
      <path d="M44 92 Q60 84 76 92 L77 120 H43 Z" fill="#3A2510" />
      <circle cx="82" cy="79" r="9" fill="#3A2510" />
      <path d="M66 93 Q82 86 98 93 L99 120 H65 Z" fill="#3A2510" />
    </svg>
  );
}

function SealedThumb({ days }: { days: number }) {
  return (
    <div className="sealed-thumb">
      <span className="sealed-thumb-label">おひらきまで</span>
      <span className="sealed-thumb-days">{days}</span>
      <span className="sealed-thumb-unit">日</span>
    </div>
  );
}

function AlbumCard({ album }: { album: Album }) {
  return (
    <div className="album-card">
      <div className="album-tape" />
      <div className="album-thumbnail">
        {album.status === 'sealed'
          ? <SealedThumb days={album.days_left ?? 0} />
          : <AmberThumb />
        }
      </div>
      <div className="album-info">
        <p className="album-name">{album.title}</p>
        <p className="album-date">
          {new Date(album.reveal_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
        </p>
        <div className="album-badges">
          <span className="badge-exp">{album.photo_count} / {album.max_exposures} EXP</span>
          <span className="badge-members">{album.member_count}名</span>
        </div>
        {album.status === 'sealed' ? (
          <p className="album-status-pending">あと {album.days_left} 日でひらく</p>
        ) : (
          <p className="album-status-opened">ひらき済・タップして見る</p>
        )}
      </div>
    </div>
  );
}

function CreateAlbumModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (album: Album) => void;
}) {
  const [title, setTitle] = useState('');
  const [revealDate, setRevealDate] = useState('');
  const [maxExp, setMaxExp] = useState(27);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const album = await api.createAlbum({
        title,
        reveal_date: revealDate,
        max_exposures: maxExp,
      });
      onCreated(album);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <p className="modal-title">新しいフィルムを装填</p>

        {error && (
          <p style={{ color: 'var(--red)', fontSize: 13, textAlign: 'center', marginTop: -8 }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="field">
            <div className="field-header">
              <label className="field-label" htmlFor="c-title">アルバム名</label>
            </div>
            <input
              id="c-title"
              type="text"
              className="field-input"
              placeholder="夏フェス 2026"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          <div className="field">
            <div className="field-header">
              <label className="field-label" htmlFor="c-date">現像日（ひらく日）</label>
            </div>
            <input
              id="c-date"
              type="date"
              className="field-input"
              value={revealDate}
              onChange={(e) => setRevealDate(e.target.value)}
              required
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="field">
            <div className="field-header">
              <label className="field-label" htmlFor="c-exp">枚数（EXP）</label>
              <span className="field-hint">{maxExp} 枚</span>
            </div>
            <input
              id="c-exp"
              type="range"
              min={1}
              max={99}
              value={maxExp}
              onChange={(e) => setMaxExp(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--dark)', margin: '12px 0 0' }}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? '装 填 中 …' : 'フ ィ ル ム を 装 填 す る'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AlbumsPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!token.get()) {
      router.replace('/signin');
      return;
    }
    api.listAlbums()
      .then(setAlbums)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = albums.filter((a) => {
    if (filter === 'sealed') return a.status === 'sealed';
    if (filter === 'opened') return a.status === 'opened';
    return true;
  });

  const sealedCount = albums.filter((a) => a.status === 'sealed').length;

  return (
    <div className="albums-page">
      {/* Header */}
      <div className="albums-header">
        <span className="albums-username">現像所</span>
        <span className="albums-title">変ルンです</span>
        <button className="albums-add-btn" aria-label="アルバムを追加" onClick={() => setShowCreate(true)}>＋</button>
      </div>

      {/* Summary */}
      <div className="albums-summary">
        <p className="albums-count">
          {albums.length}<span>巻 のフィルム</span>
        </p>
        <p className="albums-pending">うち {sealedCount} 巻がおたのしみ中</p>
      </div>

      {/* Filter tabs */}
      <div className="filter-tabs">
        {([
          { key: 'all', label: 'すべて' },
          { key: 'sealed', label: 'おたのしみ' },
          { key: 'opened', label: 'おひらき済' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            className={`filter-tab ${filter === key ? 'filter-tab-active' : 'filter-tab-inactive'}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="albums-list">
        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            現像中…
          </p>
        )}
        {error && (
          <p style={{ textAlign: 'center', color: 'var(--red)', padding: '40px 0' }}>
            {error}
          </p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
            フィルムがありません
          </p>
        )}
        {filtered.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>

      {/* FAB */}
      <button className="fab" aria-label="新しいアルバムを作成" onClick={() => setShowCreate(true)}>
        <span className="fab-icon">＋</span>
      </button>

      {/* Create modal */}
      {showCreate && (
        <CreateAlbumModal
          onClose={() => setShowCreate(false)}
          onCreated={(album) => setAlbums((prev) => [...prev, album])}
        />
      )}
    </div>
  );
}
