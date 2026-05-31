import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable, Image, RefreshControl, FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@ecowoods/api-client';
import type { Product } from '@ecowoods/types';

const TESTIMONIALS = [
  { name: 'Sarah & Michael T.', location: 'Leaside', quote: 'Transformed our home. Flawless finish.', project: '1,120 sq ft • White Oak' },
  { name: 'David Chen', location: 'The Annex', quote: 'Handled condo restrictions perfectly.', project: '680 sq ft • Walnut' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ecoPoints] = useState(2450);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { loadData(); }, []);

  const featured = products.filter(p => p.category === 'flooring' && p.featured).slice(0, 6);

  const onRefresh = () => loadData(true);

  const handleBookMeasure = () => {
    alert('📅 Free In-Home Measure Booked!\n\nTechnician will visit within 48 hours.');
  };

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A3D2E" />}
    >
      {/* Hero */}
      <View style={s.hero}>
        <Text style={s.eyebrow}>EST. 2014 • TORONTO</Text>
        <Text style={s.heroTitle}>Premium hardwood.{'\n'}Expertly installed.</Text>
        <Text style={s.heroSub}>Sustainable Canadian forests • 5-year warranty</Text>
        
        <View style={s.heroCtas}>
          <Pressable style={s.primaryBtn} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={s.primaryBtnText}>Shop Collection</Text>
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={handleBookMeasure}>
            <Text style={s.secondaryBtnText}>📏 Book Free Measure</Text>
          </Pressable>
        </View>
      </View>

      {/* Trust Bar */}
      <View style={s.trustBar}>
        <View style={s.trustItem}><Text style={s.trustNumber}>1,248</Text><Text style={s.trustLabel}>sq ft this month</Text></View>
        <View style={s.trustItem}><Text style={s.trustNumber}>98%</Text><Text style={s.trustLabel}>recommend us</Text></View>
        <View style={s.trustItem}><Text style={s.trustNumber}>4.98</Text><Text style={s.trustLabel}>avg rating</Text></View>
      </View>

      {/* Loyalty Banner */}
      <View style={s.loyaltyBanner}>
        <View>
          <Text style={s.loyaltyTitle}>🌲 Your EcoPoints</Text>
          <Text style={s.loyaltyPoints}>{ecoPoints.toLocaleString()} pts • Gold Tier</Text>
        </View>
        <Pressable style={s.loyaltyBtn} onPress={() => alert('🎁 Redeem options coming soon!')}>
          <Text style={s.loyaltyBtnText}>Redeem</Text>
        </Pressable>
      </View>

      {/* Featured */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Featured This Month</Text>
          <Pressable onPress={() => router.push('/(tabs)/shop')}><Text style={s.seeAll}>See all →</Text></Pressable>
        </View>
        
        {loading ? <ActivityIndicator color="#0A3D2E" /> : (
          <FlatList
            horizontal
            data={featured}
            keyExtractor={p => String(p.id)}
            contentContainerStyle={{ gap: 16 }}
            renderItem={({ item }) => (
              <Pressable style={s.railCard} onPress={() => router.push(`/product/${item.slug || item.id}`)}>
                <Image source={{ uri: item.image_url || 'https://picsum.photos/id/1074/400/300' }} style={s.railImage} />
                <View style={s.railInfo}>
                  <Text style={s.railName}>{item.name}</Text>
                  <Text style={s.railMeta}>${Number(item.price).toFixed(2)} / sq ft</Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* How it Works */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>How EcoWoods Works</Text>
        <View style={s.steps}>
          {[
            { num: '01', title: 'Free Measure', desc: 'We visit & create 3D render' },
            { num: '02', title: 'Choose & Quote', desc: 'Transparent all-in pricing' },
            { num: '03', title: 'Expert Install', desc: '1-3 days • 5-year warranty' },
          ].map((step, i) => (
            <View key={i} style={s.step}>
              <View style={s.stepNum}><Text style={s.stepNumText}>{step.num}</Text></View>
              <View style={s.stepContent}>
                <Text style={s.stepTitle}>{step.title}</Text>
                <Text style={s.stepDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Testimonials */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Real Homes, Real Stories</Text>
        <ScrollView horizontal contentContainerStyle={{ gap: 16 }}>
          {TESTIMONIALS.map((t, i) => (
            <View key={i} style={s.testimonialCard}>
              <Text style={s.stars}>★★★★★</Text>
              <Text style={s.testimonialQuote}>"{t.quote}"</Text>
              <Text style={s.testimonialMeta}>{t.name} • {t.location}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Final CTA */}
      <View style={s.ctaBanner}>
        <Text style={s.ctaTitle}>Ready to transform your space?</Text>
        <Pressable style={s.ctaBtn} onPress={handleBookMeasure}>
          <Text style={s.ctaBtnText}>Book Your Free Measure →</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9' },
  content: { paddingBottom: 40 },
  hero: { backgroundColor: '#0A3D2E', padding: 24, paddingTop: 60, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  eyebrow: { color: '#C5A26F', fontSize: 11, fontWeight: '800', letterSpacing: 2.5 },
  heroTitle: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', lineHeight: 42, marginTop: 8 },
  heroSub: { color: '#D8E0DB', fontSize: 15, marginTop: 8 },
  heroCtas: { flexDirection: 'row', gap: 12, marginTop: 28 },
  primaryBtn: { backgroundColor: '#C5A26F', paddingHorizontal: 26, paddingVertical: 15, borderRadius: 16 },
  primaryBtnText: { color: '#0A3D2E', fontWeight: '900', fontSize: 15 },
  secondaryBtn: { borderWidth: 2, borderColor: '#C5A26F', paddingHorizontal: 22, paddingVertical: 15, borderRadius: 16 },
  secondaryBtnText: { color: '#C5A26F', fontWeight: '800', fontSize: 15 },
  trustBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', margin: 16, marginTop: -20, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#ECE4D8' },
  trustItem: { flex: 1, alignItems: 'center' },
  trustNumber: { fontSize: 22, fontWeight: '800', color: '#0A3D2E' },
  trustLabel: { fontSize: 11, color: '#6B5B4F', textAlign: 'center', marginTop: 2 },
  loyaltyBanner: { margin: 16, backgroundColor: '#0A3D2E', borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loyaltyTitle: { color: '#C5A26F', fontSize: 13, fontWeight: '700' },
  loyaltyPoints: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 },
  loyaltyBtn: { backgroundColor: '#C5A26F', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  loyaltyBtnText: { color: '#0A3D2E', fontWeight: '800' },
  section: { paddingHorizontal: 20, marginTop: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: '#0A3D2E' },
  seeAll: { color: '#C5A26F', fontWeight: '700' },
  railCard: { width: 168, backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE4D8' },
  railImage: { width: '100%', height: 118 },
  railInfo: { padding: 12 },
  railName: { fontSize: 14, fontWeight: '700', color: '#0A3D2E' },
  railMeta: { fontSize: 12, color: '#6B5B4F', marginTop: 2 },
  steps: { gap: 16, marginTop: 12 },
  step: { flexDirection: 'row', gap: 16 },
  stepNum: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0A3D2E', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#C5A26F', fontSize: 16, fontWeight: '900' },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: '800', color: '#0A3D2E' },
  stepDesc: { color: '#6B5B4F', fontSize: 14, marginTop: 2 },
  testimonialCard: { width: 260, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#ECE4D8' },
  stars: { color: '#C5A26F', fontSize: 18, marginBottom: 10 },
  testimonialQuote: { fontSize: 14, lineHeight: 21, color: '#0A3D2E', fontStyle: 'italic' },
  testimonialMeta: { color: '#6B5B4F', fontSize: 12, marginTop: 12 },
  ctaBanner: { margin: 20, marginTop: 36, backgroundColor: '#0A3D2E', borderRadius: 24, padding: 28, alignItems: 'center' },
  ctaTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  ctaBtn: { marginTop: 20, backgroundColor: '#C5A26F', paddingHorizontal: 32, paddingVertical: 15, borderRadius: 16 },
  ctaBtnText: { color: '#0A3D2E', fontWeight: '900', fontSize: 15 },
});
