import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { api } from '@ecowoods/api-client';
import type { Product } from '@ecowoods/types';

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getProduct(Number(id))
      .then(setProduct)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#0A3D2E" /></View>;
  }
  if (error || !product) {
    return (
      <View style={s.center}>
        <Text style={s.errTitle}>Product not found</Text>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isService = product.category === 'tools';

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '', headerBackTitle: 'Shop', headerStyle: { backgroundColor: '#F8F1E9' }, headerTintColor: '#0A3D2E' }} />
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <Image source={{ uri: product.image_url || 'https://picsum.photos/800/600' }} style={s.hero} resizeMode="cover" />

        <View style={s.body}>
          <View style={s.badge}><Text style={s.badgeText}>{isService ? 'Service' : product.category}</Text></View>
          <Text style={s.name}>{product.name}</Text>

          <View style={s.priceRow}>
            <Text style={s.price}>${Number(product.price).toFixed(2)}</Text>
            <Text style={s.unit}>CAD / sq ft</Text>
          </View>

          {product.description ? <Text style={s.desc}>{product.description}</Text> : null}

          {/* Trust signals — honest, not fabricated */}
          <View style={s.trust}>
            <View style={s.trustRow}><Text style={s.trustIcon}>✓</Text><Text style={s.trustText}>Free in-home measure across the GTA</Text></View>
            <View style={s.trustRow}><Text style={s.trustIcon}>✓</Text><Text style={s.trustText}>Professional installation available</Text></View>
            <View style={s.trustRow}><Text style={s.trustIcon}>✓</Text><Text style={s.trustText}>5-year installation warranty</Text></View>
          </View>

          <Pressable style={s.cta} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={s.ctaText}>Request a quote</Text>
          </Pressable>
          <Text style={s.ctaHint}>No obligation · our team replies within 1 business day</Text>
        </View>
      </ScrollView>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9' },
  content: { paddingBottom: 40 },
  hero: { width: '100%', height: 320, backgroundColor: '#FFF' },
  body: { padding: 24 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 14, borderWidth: 1, borderColor: '#ECE4D8' },
  badgeText: { color: '#0A3D2E', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  name: { fontSize: 28, fontWeight: '800', color: '#0A3D2E', marginBottom: 12, letterSpacing: -0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 },
  price: { fontSize: 36, fontWeight: '800', color: '#0A3D2E' },
  unit: { fontSize: 15, color: '#6B5B4F', marginLeft: 8 },
  desc: { fontSize: 16, color: '#4A4036', lineHeight: 24, marginBottom: 24 },
  trust: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, marginBottom: 28, borderWidth: 1, borderColor: '#ECE4D8', gap: 12 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trustIcon: { color: '#2E7D32', fontSize: 16, fontWeight: '900' },
  trustText: { color: '#0A3D2E', fontSize: 14, flex: 1 },
  cta: { backgroundColor: '#0A3D2E', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  ctaText: { color: '#FFF', fontWeight: '800', fontSize: 17 },
  ctaHint: { color: '#6B5B4F', fontSize: 12, textAlign: 'center', marginTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8F1E9', padding: 24 },
  errTitle: { color: '#0A3D2E', fontWeight: '700', fontSize: 18, marginBottom: 16 },
  backBtn: { backgroundColor: '#0A3D2E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  backText: { color: '#FFF', fontWeight: '700' },
});
