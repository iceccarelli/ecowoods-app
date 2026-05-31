import { View, Text, StyleSheet } from 'react-native';
export function DemoBanner({ label = 'Demo data — not yet connected to live backend' }: { label?: string }) {
  return (
    <View style={s.banner}><Text style={s.text}>⚠︎ {label}</Text></View>
  );
}
const s = StyleSheet.create({
  banner: { backgroundColor: '#C5A26F', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, marginBottom: 16 },
  text: { color: '#0A3D2E', fontWeight: '700', fontSize: 12, textAlign: 'center' },
});
