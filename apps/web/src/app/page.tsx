'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { token } from '@/lib/token';

function PolaroidPhoto() {
  return (
    <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
      <defs>
        <radialGradient id="bg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#C8843A" />
          <stop offset="100%" stopColor="#7A4A20" />
        </radialGradient>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F0D890" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#E8C870" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#C8843A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#bg)" />
      <circle cx="200" cy="100" r="70" fill="url(#glow)" />
      <circle cx="200" cy="100" r="44" fill="#E8C870" opacity="0.85" />
      {/* Left person */}
      <ellipse cx="130" cy="290" rx="30" ry="18" fill="#3A2510" opacity="0.5" />
      <circle cx="130" cy="210" r="22" fill="#3A2510" />
      <path d="M100 240 Q130 228 160 240 L162 300 H98 Z" fill="#3A2510" />
      {/* Center person */}
      <ellipse cx="200" cy="290" rx="30" ry="18" fill="#3A2510" opacity="0.5" />
      <circle cx="200" cy="204" r="24" fill="#3A2510" />
      <path d="M168 236 Q200 222 232 236 L234 300 H166 Z" fill="#3A2510" />
      {/* Right person */}
      <ellipse cx="270" cy="290" rx="30" ry="18" fill="#3A2510" opacity="0.5" />
      <circle cx="270" cy="212" r="21" fill="#3A2510" />
      <path d="M242 242 Q270 230 298 242 L300 300 H240 Z" fill="#3A2510" />
      <rect x="0" y="270" width="400" height="30" fill="#7A4A20" opacity="0.3" />
    </svg>
  );
}

export default function LandingPage() {
  const router = useRouter();
  useEffect(() => {
    if (token.get()) router.replace('/albums');
  }, [router]);

  return (
    <div className="landing">
      {/* Polaroid card */}
      <div className="polaroid-wrapper">
        <div className="tape tape-tl" />
        <div className="tape tape-tr" />
        <div className="polaroid">
          <div className="polaroid-photo">
            <PolaroidPhoto />
          </div>
        </div>
        <div className="stamp-badge">変</div>
      </div>

      {/* App info */}
      <p className="app-tagline">使 い 切 り ・ 即 席 ア ル バ ム</p>
      <h1 className="app-title">変ルンです</h1>

      <div className="badges">
        <span className="badge badge-green">27 EXP</span>
        <span className="badge badge-red">SEALED</span>
      </div>

      <p className="app-description">
        撮ったその場では見られない。<br />
        指定日が来ると、写真が現像される。
      </p>

      <Link href="/signin" className="btn-primary">
        は じ め る
      </Link>

      <p className="signin-link">
        すでにアカウントがある・<Link href="/signin">ログイン</Link>
      </p>
    </div>
  );
}
