import { useState } from 'react';
import { token } from '@/lib/token';
import { LandingScreen } from '@/screens/LandingScreen';
import { SignInScreen } from '@/screens/SignInScreen';
import { AlbumsScreen } from '@/screens/AlbumsScreen';
import type { Screen } from '@/types/navigation';

function initialScreen(): Screen {
  return token.get() ? 'albums' : 'landing';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(initialScreen);

  switch (screen) {
    case 'landing': return <LandingScreen onNavigate={setScreen} />;
    case 'signin':  return <SignInScreen  onNavigate={setScreen} />;
    case 'albums':  return <AlbumsScreen  onNavigate={setScreen} />;
  }
}
