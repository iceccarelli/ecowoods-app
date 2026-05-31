import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@ecowoods/api-client';
import type { Product } from '@ecowoods/types';
export default function FeedScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getProducts().then(setProducts).catch(()=>{}).finally(()=>setLoading(false)); }, []);
  const featured = products.filter(p => p.category === 'flooring').slice(0, 6);
  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}>
      <View style={s.hero}>
        <Text style={s.eyebrow}>ECOWOODS · TORONTO</Text>
        <Text style={s.heroTitle}>Premium hardwood,{'\n'}expertly installed.</Text>
        <Pressable style={s.heroBtn} onPress={() => router.push('/(tabs)/shop')}><Text style={s.heroBtnText}>Shop the collection</Text></Pressable>
      </View>
      <Text style={s.section}>Featured Flooring</Text>
      {loading ? <ActivityIndicator color="#0A3D2E" /> : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {featured.map(p => (
            <Pressable key={p.id} style={s.rail} onPress={() => router.push('/(tabs)/shop')}>
              <Image source={{ uri: p.image_url || 'https://picsum.photos/400' }} style={s.railImg} />
              <Text style={s.railName} numberOfLines={1}>{p.name}</Text>
              <Text style={s.railPrice}>${Number(p.price).toFixed(2)} / sq ft</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9' }, content: { padding: 20 },
  hero: { backgroundColor: '#0A3D2E', borderRadius: 24, padding: 26, marginBottom: 26 },
  eyebrow: { color: '#C5A26F', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  heroTitle: { color: '#FFF', fontSize: 28, fontWeight: '800', lineHeight: 34, marginBottom: 18 },
  heroBtn: { backgroundColor: '#C5A26F', alignSelf: 'flex-start', paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  heroBtnText: { color: '#0A3D2E', fontWeight: '800' },
  section: { fontSize: 20, fontWeight: '800', color: '#0A3D2E', marginBottom: 14 },
  rail: { width: 160 }, railImg: { width: 160, height: 120, borderRadius: 16, marginBottom: 8, backgroundColor: '#FFF' },
  railName: { fontWeight: '700', color: '#0A3D2E', fontSize: 14 }, railPrice: { color: '#6B5B4F', fontSize: 13, marginTop: 2 },
});
