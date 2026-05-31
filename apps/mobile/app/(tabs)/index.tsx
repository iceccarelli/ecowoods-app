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
  { name: 'Priya & Raj Patel', location: 'Forest Hill', quote: 'The 5-year warranty gives real peace of mind.', project: '890 sq ft • Engineered Maple' },
];

const IMPACT_STATS = [
  { number: '47,892', label: 'sq ft installed', icon: '🪵' },
  { number: '1,248', label: 'trees planted', icon: '🌳' },
  { number: '98.4%', label: 'client retention', icon: '❤️' },
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
    alert('📅 Free In-Home Measure Booked!\n\nTechnician will visit within 48 hours.\n\n✅ Calendar invite sent to your email.');
  };

  const handleCategoryPress = (category: string) => {
    router.push(`/(tabs)/shop?category=${category}`);
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
        <Text style={s.heroSub}>Sustainable Canadian forests • 5-year warranty • 98% recommend us</Text>
        
        <View style={s.heroCtas}>
          <Pressable style={s.primaryBtn} onPress={() => router.push('/(tabs)/shop')}>
            <Text style={s.primaryBtnText}>Shop Collection</Text>
          </Pressable>
          <Pressable style={s.secondaryBtn} onPress={handleBookMeasure}>
            <Text style={s.secondaryBtnText}>📏 Book Free Measure</Text>
          </Pressable>
        </View>
      </View>

      {/* Quick Category Nav - Business Accelerator */}
      <View style={s.quickCategories}>
        <Text style={s.quickTitle}>Shop by Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.catRow}>
          {[
            { key: 'flooring', label: 'All Flooring', icon: '🪵' },
            { key: 'solid', label: 'Solid Hardwood', icon: '🌳' },
            { key: 'engineered', label: 'Engineered', icon: '📐' },
            { key: 'services', label: 'Installation', icon: '🔧' },
          ].map((cat, idx) => (
            <Pressable key={idx} style={s.catChip} onPress={() => handleCategoryPress(cat.key)}>
              <Text style={s.catIcon}>{cat.icon}</Text>
              <Text style={s.catLabel}>{cat.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Trust Bar */}
      <View style={s.trustBar}>
        <View style={s.trustItem}><Text style={s.trustNumber}>1,248</Text><Text style={s.trustLabel}>sq ft this month</Text></View>
        <View style={s.trustItem}><Text style={s.trustNumber}>98%</Text><Text style={s.trustLabel}>recommend us</Text></View>
        <View style={s.trustItem}><Text style={s.trustNumber}>4.98</Text><Text style={s.trustLabel}>avg rating</Text></View>
      </View>

      {/* Loyalty Banner - Retention Machine */}
      <Pressable style={s.loyaltyBanner} onPress={() => router.push('/(tabs)/profile')}>
        <View>
          <Text style={s.loyaltyTitle}>🌲 Your EcoPoints</Text>
          <Text style={s.loyaltyPoints}>{ecoPoints.toLocaleString()} pts • Gold Tier</Text>
          <Text style={s.loyaltySub}>49% to Platinum • Unlock priority installs</Text>
        </View>
        <View style={s.loyaltyBtn}><Text style={s.loyaltyBtnText}>Redeem →</Text></View>
      </Pressable>

      {/* Impact Stats - Trust Builder */}
      <View style={s.impactSection}>
        <Text style={s.sectionTitle}>Our Impact This Year</Text>
        <View style={s.impactRow}>
          {IMPACT_STATS.map((stat, i) => (
            <View key={i} style={s.impactCard}>
              <Text style={s.impactIcon}>{stat.icon}</Text>
              <Text style={s.impactNumber}>{stat.number}</Text>
              <Text style={s.impactLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
        <Text style={s.impactNote}>Every purchase plants trees in Ontario forests</Text>
      </View>

      {/* Featured */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Featured This Month</Text>
          <Pressable onPress={() => router.push('/(tabs)/shop')}><Text style={s.seeAll}>See all →</Text></Pressable>
        </View>
        
        {loading ? <ActivityIndicator color="#0A3D2E" size="large" /> : featured.length === 0 ? (
          <View style={s.emptyFeatured}>
            <Text style={s.emptyText}>New arrivals coming soon. Check back tomorrow!</Text>
          </View>
        ) : (
          <FlatList
            horizontal
            data={featured}
            keyExtractor={p => String(p.id)}
            contentContainerStyle={{ gap: 16 }}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable style={s.railCard} onPress={() => router.push(`/product/${item.slug || item.id}`)}>
                <Image source={{ uri: item.image_url || 'https://picsum.photos/id/1074/400/300' }} style={s.railImage} />
                <View style={s.railInfo}>
                  <Text style={s.railName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.railMeta}>${Number(item.price).toFixed(2)} / sq ft</Text>
                  <Pressable style={s.quickQuote} onPress={(e) => { e.stopPropagation(); router.push('/(tabs)/shop'); }}>
                    <Text style={s.quickQuoteText}>Get Quote</Text>
                  </Pressable>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>

      {/* How it Works - Conversion Funnel */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>How EcoWoods Works</Text>
        <View style={s.steps}>
          {[
            { num: '01', title: 'Free Measure & 3D Render', desc: 'We visit, measure & visualize your space' },
            { num: '02', title: 'Transparent Quote', desc: 'All-in pricing • No hidden fees • 7-day hold' },
            { num: '03', title: 'Expert Install', desc: '1-3 days • 5-year warranty • Eco-friendly finish' },
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
          {TESTIMONIALS.map((t, i) => (
            <View key={i} style={s.testimonialCard}>
              <Text style={s.stars}>★★★★★</Text>
              <Text style={s.testimonialQuote}>"{t.quote}"</Text>
              <Text style={s.testimonialMeta}>{t.name} • {t.location}</Text>
              <Text style={s.testimonialProject}>{t.project}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Final CTA - Money Printer Entry */}
      <View style={s.ctaBanner}>
        <Text style={s.ctaTitle}>Ready to transform your space?</Text>
        <Text style={s.ctaSub}>Join 1,248 happy homeowners this month</Text>
        <Pressable style={s.ctaBtn} onPress={handleBookMeasure}>
          <Text style={s.ctaBtnText}>Book Your Free Measure →</Text>
        </Pressable>
        <Text style={s.ctaFine}>No obligation • 48hr response</Text>
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
  quickCategories: { paddingHorizontal: 20, marginTop: 20 },
  quickTitle: { fontSize: 14, fontWeight: '700', color: '#6B5B4F', marginBottom: 10 },
  catRow: { gap: 10, paddingBottom: 8 },
  catChip: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE4D8', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  catIcon: { fontSize: 16 },
  catLabel: { fontSize: 13, fontWeight: '700', color: '#0A3D2E' },
  trustBar: { flexDirection: 'row', backgroundColor: '#FFFFFF', margin: 16, marginTop: -20, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#ECE4D8' },
  trustItem: { flex: 1, alignItems: 'center' },
  trustNumber: { fontSize: 22, fontWeight: '800', color: '#0A3D2E' },
  trustLabel: { fontSize: 11, color: '#6B5B4F', textAlign: 'center', marginTop: 2 },
  loyaltyBanner: { margin: 16, backgroundColor: '#0A3D2E', borderRadius: 20, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  loyaltyTitle: { color: '#C5A26F', fontSize: 13, fontWeight: '700' },
  loyaltyPoints: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 4 },
  loyaltySub: { color: '#D8E0DB', fontSize: 12, marginTop: 2 },
  loyaltyBtn: { backgroundColor: '#C5A26F', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  loyaltyBtnText: { color: '#0A3D2E', fontWeight: '800' },
  impactSection: { paddingHorizontal: 20, marginTop: 24 },
  impactRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  impactCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#ECE4D8' },
  impactIcon: { fontSize: 22, marginBottom: 6 },
  impactNumber: { fontSize: 18, fontWeight: '900', color: '#0A3D2E' },
  impactLabel: { fontSize: 10, color: '#6B5B4F', textAlign: 'center', marginTop: 2 },
  impactNote: { fontSize: 11, color: '#6B5B4F', textAlign: 'center', marginTop: 10, fontStyle: 'italic' },
  section: { paddingHorizontal: 20, marginTop: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 21, fontWeight: '800', color: '#0A3D2E' },
  seeAll: { color: '#C5A26F', fontWeight: '700' },
  emptyFeatured: { padding: 24, alignItems: 'center' },
  emptyText: { color: '#6B5B4F', fontSize: 14 },
  railCard: { width: 168, backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE4D8' },
  railImage: { width: '100%', height: 118 },
  railInfo: { padding: 12 },
  railName: { fontSize: 14, fontWeight: '700', color: '#0A3D2E' },
  railMeta: { fontSize: 12, color: '#6B5B4F', marginTop: 2 },
  quickQuote: { marginTop: 8, backgroundColor: '#0A3D2E', paddingVertical: 6, borderRadius: 8, alignItems: 'center' },
  quickQuoteText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
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
  testimonialProject: { color: '#C5A26F', fontSize: 11, fontWeight: '700', marginTop: 4 },
  ctaBanner: { margin: 20, marginTop: 36, backgroundColor: '#0A3D2E', borderRadius: 24, padding: 28, alignItems: 'center' },
  ctaTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  ctaSub: { color: '#D8E0DB', fontSize: 13, marginTop: 6 },
  ctaBtn: { marginTop: 20, backgroundColor: '#C5A26F', paddingHorizontal: 32, paddingVertical: 15, borderRadius: 16 },
  ctaBtnText: { color: '#0A3D2E', fontWeight: '900', fontSize: 15 },
  ctaFine: { color: '#D8E0DB', fontSize: 10, marginTop: 12 },
});
