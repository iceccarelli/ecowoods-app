import { View, Text, StyleSheet, Pressable } from 'react-native';
export default function ProfileScreen() {
  return (
    <View style={s.screen}>
      <View style={s.avatar}><Text style={s.avatarText}>EW</Text></View>
      <Text style={s.title}>Welcome to EcoWoods</Text>
      <Text style={s.sub}>Sign in to track quotes and orders</Text>
      <Pressable style={s.btn}><Text style={s.btnText}>Sign in</Text></Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9', alignItems: 'center', justifyContent: 'center', padding: 32 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#0A3D2E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  avatarText: { color: '#C5A26F', fontSize: 24, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: '#0A3D2E' },
  sub: { color: '#6B5B4F', marginTop: 6, marginBottom: 18 },
  btn: { backgroundColor: '#0A3D2E', paddingHorizontal: 32, paddingVertical: 13, borderRadius: 14 },
  btnText: { color: '#FFF', fontWeight: '700' },
});
