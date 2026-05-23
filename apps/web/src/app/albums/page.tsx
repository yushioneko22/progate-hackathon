'use client';

import { useState } from 'react';

type AlbumStatus = 'sealed' | 'opened';
type FilterTab = 'all' | 'sealed' | 'opened';

interface Album {
  id: number;
  title: string;
  date: string;
  exp: number;
  members: number;
  status: AlbumStatus;
  daysLeft?: number;
  thumbColor?: string;
}

const ALBUMS: Album[] = [
  { id: 1, title: '2026 夏フェス', date: '7/12 – 7/14', exp: 24, members: 6, status: 'sealed', daysLeft: 142 },
  { id: 2, title: '京都・卒業旅行', date: '3/20 – 3/24', exp: 19, members: 4, status: 'sealed', daysLeft: 365 },
  { id: 3, title: '研究室飲み会', date: '5/02', exp: 12, members: 8, status: 'opened', thumbColor: 'amber' },
  { id: 4, title: '海・8月', date: '8/03 – 8/05', exp: 27, members: 5, status: 'opened', thumbColor: 'ocean' },
  { id: 5, title: '冬の信州', date: '12/28 – 1/03', exp: 21, members: 3, status: 'sealed', daysLeft: 89 },
];

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

function OceanThumb() {
  return (
    <svg viewBox="0 0 120 120" width="120" height="120" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="oc-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5BA3C9" />
          <stop offset="60%" stopColor="#87CEEB" />
          <stop offset="100%" stopColor="#A8D8EA" />
        </linearGradient>
        <radialGradient id="oc-sun" cx="70%" cy="25%" r="30%">
          <stop offset="0%" stopColor="#FFF4CC" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#87CEEB" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="120" height="120" fill="url(#oc-sky)" />
      <circle cx="84" cy="28" r="22" fill="url(#oc-sun)" />
      <circle cx="84" cy="28" r="11" fill="#FFF4CC" opacity="0.9" />
      <rect x="0" y="72" width="120" height="48" fill="#2E86AB" opacity="0.6" />
      <path d="M0 76 Q15 70 30 76 Q45 82 60 76 Q75 70 90 76 Q105 82 120 76 L120 120 H0 Z"
            fill="#1A6B8A" opacity="0.7" />
      <path d="M0 85 Q20 79 40 85 Q60 91 80 85 Q100 79 120 85 L120 120 H0 Z"
            fill="#0D4F6B" opacity="0.5" />
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

function AlbumThumbnail({ album }: { album: Album }) {
  if (album.status === 'sealed') {
    return <SealedThumb days={album.daysLeft!} />;
  }
  if (album.thumbColor === 'amber') return <AmberThumb />;
  if (album.thumbColor === 'ocean') return <OceanThumb />;
  return <div className="sealed-thumb" />;
}

function AlbumCard({ album }: { album: Album }) {
  return (
    <div className="album-card">
      <div className="album-tape" />
      <div className="album-thumbnail">
        <AlbumThumbnail album={album} />
      </div>
      <div className="album-info">
        <p className="album-name">{album.title}</p>
        <p className="album-date">{album.date}</p>
        <div className="album-badges">
          <span className="badge-exp">{album.exp} EXP</span>
          <span className="badge-members">{album.members}名</span>
        </div>
        {album.status === 'sealed' ? (
          <p className="album-status-pending">あと {album.daysLeft} 日でひらく</p>
        ) : (
          <p className="album-status-opened">ひらき済・タップして見る</p>
        )}
      </div>
    </div>
  );
}

export default function AlbumsPage() {
  const [filter, setFilter] = useState<FilterTab>('all');

  const filtered = ALBUMS.filter((a) => {
    if (filter === 'sealed') return a.status === 'sealed';
    if (filter === 'opened') return a.status === 'opened';
    return true;
  });

  const sealedCount = ALBUMS.filter((a) => a.status === 'sealed').length;
  const total = ALBUMS.length;

  return (
    <div className="albums-page">
      {/* Header */}
      <div className="albums-header">
        <span className="albums-username">林　健太</span>
        <span className="albums-title">現像所</span>
        <button className="albums-add-btn" aria-label="アルバムを追加">＋</button>
      </div>

      {/* Summary */}
      <div className="albums-summary">
        <p className="albums-count">
          {total}<span>巻 のフィルム</span>
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

      {/* Album list */}
      <div className="albums-list">
        {filtered.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>

      {/* FAB */}
      <button className="fab" aria-label="新しいアルバムを作成">
        <span className="fab-icon">＋</span>
      </button>
    </div>
  );
}
