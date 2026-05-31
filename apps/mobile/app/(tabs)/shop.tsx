import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '@ecowoods/api-client';
import { ProductCard } from '@ecowoods/ui';
import type { Product } from '@ecowoods/types';
export default function ShopScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { api.getProducts().then(setProducts).catch(e=>setError(String(e))).finally(()=>setLoading(false)); }, []);
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#0A3D2E" /></View>;
  if (error) return <View style={s.center}><Text style={s.err}>Couldn't load products</Text><Text style={s.muted}>{error}</Text></View>;
  return (
    <FlatList style={s.screen} contentContainerStyle={s.content} data={products}
      keyExtractor={p => String(p.id)}
      ListHeaderComponent={<Text style={s.title}>Shop Hardwood</Text>}
      renderItem={({ item }) => <ProductCard product={item} />} />
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9' }, content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#0A3D2E', marginBottom: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F1E9', padding: 24 },
  err: { color: '#0A3D2E', fontWeight: '700', fontSize: 18, marginBottom: 8 }, muted: { color: '#6B5B4F', textAlign: 'center' },
});
