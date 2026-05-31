import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
export default function OrdersScreen() {
  const router = useRouter();
  return (
    <View style={s.screen}>
      <Text style={s.title}>No orders yet</Text>
      <Text style={s.sub}>Order flooring or book a service and it'll show up here.</Text>
      <Pressable style={s.btn} onPress={() => router.push('/(tabs)/shop')}><Text style={s.btnText}>Browse the shop</Text></Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#0A3D2E', marginBottom: 8 },
  sub: { color: '#6B5B4F', textAlign: 'center', marginBottom: 24, lineHeight: 21 },
  btn: { backgroundColor: '#0A3D2E', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  btnText: { color: '#FFF', fontWeight: '700' },
});
