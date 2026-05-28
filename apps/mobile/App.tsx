import { useState } from 'react';
import { token } from '@/lib/token';
import { LandingScreen } from '@/screens/LandingScreen';
import { SignInScreen } from '@/screens/SignInScreen';
import { AlbumsScreen } from '@/screens/AlbumsScreen';
import { AlbumDetailScreen } from '@/screens/AlbumDetailScreen';
import type { Screen } from '@/types/navigation';
import type { Album } from '@/lib/types';

function initialScreen(): Screen {
  return token.get() ? 'albums' : 'landing';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

  function handleNavigateToAlbum(album: Album) {
    setSelectedAlbum(album);
    setScreen('album-detail');
  }

  switch (screen) {
    case 'landing':      return <LandingScreen onNavigate={setScreen} />;
    case 'signin':       return <SignInScreen   onNavigate={setScreen} />;
    case 'albums':       return <AlbumsScreen   onNavigate={setScreen} onNavigateToAlbum={handleNavigateToAlbum} />;
    case 'album-detail': return <AlbumDetailScreen album={selectedAlbum!} onBack={() => setScreen('albums')} />;
  }
}
