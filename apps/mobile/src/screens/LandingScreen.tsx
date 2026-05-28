import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import type { Screen } from '../types/navigation';

const C = {
  bg: '#E8D5B0', card: '#F8F0DC', dark: '#1C1208',
  muted: '#8A7A64', red: '#B8291C', green: '#2D5A3D',
};

function PolaroidIllustration() {
  return (
    <View style={s.polaroid}>
      <View style={s.tapeL} /><View style={s.tapeR} />
      <View style={s.photo}>
        {/* 背景グラデ代替 */}
        <View style={s.photoInner}>
          {/* 月 */}
          <View style={s.moon} />
          {/* 人物 3人 */}
          <View style={[s.person, { left: 36 }]}><View style={s.personHead} /><View style={s.personBody} /></View>
          <View style={[s.person, { left: 80 }]}><View style={[s.personHead, { width: 28, height: 28 }]} /><View style={[s.personBody, { width: 56 }]} /></View>
          <View style={[s.person, { left: 128 }]}><View style={s.personHead} /><View style={s.personBody} /></View>
        </View>
      </View>
      {/* 変スタンプ */}
      <View style={s.stamp}>
        <Text style={s.stampText}>変</Text>
      </View>
    </View>
  );
}

export function LandingScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <PolaroidIllustration />

        <Text style={s.tagline}>使 い 切 り ・ 即 席 ア ル バ ム</Text>
        <Text style={s.title}>変ルンです</Text>

        <View style={s.badges}>
          <View style={[s.badge, s.badgeGreen]}><Text style={[s.badgeText, { color: C.green }]}>27 EXP</Text></View>
          <View style={[s.badge, s.badgeRed]}><Text style={[s.badgeText, { color: C.red }]}>SEALED</Text></View>
        </View>

        <Text style={s.desc}>
          撮ったその場では見られない。{'\n'}指定日が来ると、写真が現像される。
        </Text>

        <TouchableOpacity style={s.btnPrimary} onPress={() => onNavigate('signin')} activeOpacity={0.8}>
          <Text style={s.btnPrimaryText}>は じ め る</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onNavigate('signin')}>
          <Text style={s.signinLink}>すでにアカウントがある・<Text style={s.signinLinkU}>ログイン</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { alignItems: 'center', padding: 24, paddingBottom: 48 },

  // Polaroid
  polaroid: { width: '100%', marginBottom: 28, position: 'relative', alignItems: 'center' },
  tapeL: { position: 'absolute', top: -6, left: 24, width: 56, height: 16, backgroundColor: 'rgba(200,180,130,0.55)', borderRadius: 2, transform: [{ rotate: '-3deg' }], zIndex: 2 },
  tapeR: { position: 'absolute', top: -6, right: 40, width: 56, height: 16, backgroundColor: 'rgba(200,180,130,0.55)', borderRadius: 2, transform: [{ rotate: '2deg' }], zIndex: 2 },
  photo: { width: '100%', aspectRatio: 4/3, backgroundColor: C.card, padding: 12, paddingBottom: 36, shadowColor: '#2C1F0A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 5 },
  photoInner: { flex: 1, backgroundColor: '#C8843A', borderRadius: 2, overflow: 'hidden', alignItems: 'center', position: 'relative' },
  moon: { position: 'absolute', top: 20, alignSelf: 'center', width: 60, height: 60, borderRadius: 30, backgroundColor: '#E8C870', opacity: 0.85 },
  person: { position: 'absolute', bottom: 0, alignItems: 'center' },
  personHead: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#3A2510' },
  personBody: { width: 48, height: 50, backgroundColor: '#3A2510', borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: 2 },
  stamp: { position: 'absolute', top: -10, right: -10, width: 60, height: 60, borderRadius: 30, borderWidth: 2.5, borderColor: C.red, backgroundColor: 'rgba(248,240,220,0.9)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  stampText: { fontSize: 26, fontWeight: '900', color: C.red },

  tagline: { fontSize: 11, letterSpacing: 4, color: C.muted, marginBottom: 8, textAlign: 'center' },
  title: { fontSize: 40, fontWeight: '900', color: C.dark, textAlign: 'center', marginBottom: 16 },

  badges: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  badge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 2, borderWidth: 2 },
  badgeGreen: { borderColor: C.green },
  badgeRed: { borderColor: C.red },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },

  desc: { textAlign: 'center', color: C.muted, fontSize: 14, lineHeight: 28, marginBottom: 32 },

  btnPrimary: { width: '100%', backgroundColor: C.dark, paddingVertical: 18, alignItems: 'center', marginBottom: 20 },
  btnPrimaryText: { color: '#F5EDD8', fontSize: 15, fontWeight: '500', letterSpacing: 8 },

  signinLink: { fontSize: 13, color: C.muted },
  signinLinkU: { color: C.dark, textDecorationLine: 'underline' },
});
