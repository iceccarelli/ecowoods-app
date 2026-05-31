import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable,
  TextInput, RefreshControl, Modal, Switch, Image, ScrollView
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@ecowoods/api-client';
import type { Product } from '@ecowoods/types';

// Mobile-safe ProductCard with compare support
function MobileProductCard({ product, onPress, onCompare, isComparing }: { 
  product: Product; 
  onPress: () => void; 
  onCompare: () => void;
  isComparing: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={cardStyles.card}>
      <Image source={{ uri: product.image_url || 'https://picsum.photos/id/1015/600/400' }} style={cardStyles.image} resizeMode="cover" />
      <View style={cardStyles.content}>
        <Text style={cardStyles.name} numberOfLines={2}>{product.name}</Text>
        <View style={cardStyles.metaRow}>
          <Text style={cardStyles.woodType}>{product.woodType || 'Premium'}</Text>
          <Text style={cardStyles.price}>${Number(product.price).toFixed(2)}</Text>
        </View>
      </View>
      <Pressable style={[cardStyles.compareBtn, isComparing && cardStyles.compareActive]} onPress={onCompare}>
        <Text style={cardStyles.compareText}>{isComparing ? '✓' : '⚖️'}</Text>
      </Pressable>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE4D8', marginBottom: 8, position: 'relative' },
  image: { width: '100%', height: 140, backgroundColor: '#F0E6D9' },
  content: { padding: 14 },
  name: { fontSize: 15, fontWeight: '700', color: '#0A3D2E', lineHeight: 20, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  woodType: { fontSize: 12, color: '#6B5B4F' },
  price: { fontSize: 16, fontWeight: '900', color: '#0A3D2E' },
  compareBtn: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, padding: 6, borderWidth: 1, borderColor: '#ECE4D8' },
  compareActive: { backgroundColor: '#0A3D2E' },
  compareText: { fontSize: 14, color: '#0A3D2E' },
});

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🌲' },
  { key: 'flooring', label: 'Flooring', icon: '🪵' },
  { key: 'solid', label: 'Solid Hardwood', icon: '🌳' },
  { key: 'engineered', label: 'Engineered', icon: '📐' },
  { key: 'services', label: 'Services', icon: '🔧' },
] as const;

const WOOD_SPECIES = ['All', 'White Oak', 'Walnut', 'Maple', 'Hickory', 'Ash'];

const FINISH_OPTIONS = [
  { label: 'Natural', priceMod: 0 },
  { label: 'Matte', priceMod: 1.5 },
  { label: 'Premium Oil', priceMod: 2.5 },
];

export default function ShopScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(params.category || 'all');
  const [activeSpecies, setActiveSpecies] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'popular'>('featured');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedProductForQuote, setSelectedProductForQuote] = useState<Product | null>(null);
  const [sqft, setSqft] = useState('500');
  const [includeInstall, setIncludeInstall] = useState(false);
  const [selectedFinish, setSelectedFinish] = useState(0);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [compareList, setCompareList] = useState<Product[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const loadProducts = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await api.getProducts();
      setProducts(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { if (params.category) setActiveCategory(params.category); }, [params.category]);

  const filteredAndSorted = useMemo(() => {
    let result = [...products];
    if (activeCategory !== 'all') {
      result = result.filter(p => p.category === activeCategory || (activeCategory === 'solid' && p.subcategory?.includes('solid')));
    }
    if (activeSpecies !== 'All') {
      result = result.filter(p => (p.woodType || '').toLowerCase().includes(activeSpecies.toLowerCase()));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || (p.woodType || '').toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'price-low': result.sort((a, b) => Number(a.price) - Number(b.price)); break;
      case 'price-high': result.sort((a, b) => Number(b.price) - Number(a.price)); break;
      case 'popular': result.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)); break;
      default: result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
    }
    return result;
  }, [products, activeCategory, activeSpecies, searchQuery, sortBy]);

  const handleRequestQuote = (product: Product) => {
    setSelectedProductForQuote(product);
    setSelectedFinish(0);
    setShowQuoteModal(true);
  };

  const submitQuote = () => {
    const product = selectedProductForQuote;
    if (!product) return;
    const finishMod = FINISH_OPTIONS[selectedFinish].priceMod;
    const base = Number(product.price) * parseFloat(sqft || '0');
    const install = includeInstall ? parseFloat(sqft || '0') * 8.5 : 0;
    const finishCost = parseFloat(sqft || '0') * finishMod;
    const total = (base + install + finishCost).toFixed(2);
    
    setShowQuoteModal(false);
    
    // Business magic: auto-add to orders simulation
    alert(`✅ Quote Request Sent!\n\n${product.name}\n${sqft} sq ft • ${FINISH_OPTIONS[selectedFinish].label} finish\nEstimated: $${total}\n\n📋 Saved to My Quotes • Expires in 7 days`);
    
    // In real app: router.push('/(tabs)/orders') or create quote record
  };

  const onRefresh = () => loadProducts(true);
  const toggleWishlist = (id: number) => setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleCompare = (product: Product) => {
    if (compareList.find(p => p.id === product.id)) {
      setCompareList(prev => prev.filter(p => p.id !== product.id));
    } else if (compareList.length < 2) {
      setCompareList(prev => [...prev, product]);
      if (compareList.length === 1) {
        setTimeout(() => setShowCompareModal(true), 300);
      }
    } else {
      alert('Compare up to 2 products at a time');
    }
  };

  const estimate = useMemo(() => {
    if (!selectedProductForQuote) return '0.00';
    const finishMod = FINISH_OPTIONS[selectedFinish].priceMod;
    const base = Number(selectedProductForQuote.price) * parseFloat(sqft || '0');
    const install = includeInstall ? parseFloat(sqft || '0') * 8.5 : 0;
    const finishCost = parseFloat(sqft || '0') * finishMod;
    return (base + install + finishCost).toFixed(2);
  }, [selectedProductForQuote, sqft, includeInstall, selectedFinish]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#0A3D2E" /></View>;

  return (
    <View style={s.screen}>
      <FlatList
        data={filteredAndSorted}
        numColumns={2}
        columnWrapperStyle={s.row}
        keyExtractor={p => String(p.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0A3D2E" />}
        ListHeaderComponent={
          <View>
            <View style={s.header}><Text style={s.title}>Shop Hardwood</Text></View>
            
            <View style={s.searchContainer}>
              <TextInput 
                style={s.searchInput} 
                placeholder="Search oak, walnut, maple..." 
                value={searchQuery} 
                onChangeText={setSearchQuery} 
              />
            </View>

            {/* Category Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filters}>
              {CATEGORIES.map(cat => (
                <Pressable 
                  key={cat.key} 
                  onPress={() => setActiveCategory(cat.key)} 
                  style={[s.chip, activeCategory === cat.key && s.chipActive]}
                >
                  <Text style={[s.chipText, activeCategory === cat.key && s.chipTextActive]}>{cat.icon} {cat.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Wood Species Filter - Smart Filter */}
            <View style={s.speciesRow}>
              <Text style={s.speciesLabel}>Wood Species</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {WOOD_SPECIES.map((sp, i) => (
                  <Pressable 
                    key={i} 
                    onPress={() => setActiveSpecies(sp)} 
                    style={[s.speciesChip, activeSpecies === sp && s.speciesChipActive]}
                  >
                    <Text style={[s.speciesText, activeSpecies === sp && s.speciesTextActive]}>{sp}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Sort + Price Quick Filter */}
            <View style={s.sortRow}>
              <Text style={s.sortLabel}>Sort:</Text>
              {(['featured', 'price-low', 'price-high', 'popular'] as const).map(opt => (
                <Pressable key={opt} onPress={() => setSortBy(opt)} style={[s.sortBtn, sortBy === opt && s.sortBtnActive]}>
                  <Text style={[s.sortText, sortBy === opt && s.sortTextActive]}>
                    {opt === 'featured' ? '⭐' : opt === 'price-low' ? '💰' : opt === 'price-high' ? '💎' : '🔥'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.cardWrap}>
            <MobileProductCard 
              product={item} 
              onPress={() => router.push(`/product/${item.slug || item.id}`)} 
              onCompare={() => toggleCompare(item)}
              isComparing={compareList.some(p => p.id === item.id)}
            />
            <View style={s.quickActions}>
              <Pressable style={s.actionBtn} onPress={() => alert(`🛒 Added ${item.name} to cart`)}>
                <Text style={s.actionText}>🛒</Text>
              </Pressable>
              <Pressable style={[s.actionBtn, s.quoteBtn]} onPress={() => handleRequestQuote(item)}>
                <Text style={s.actionText}>📋 Quote</Text>
              </Pressable>
              <Pressable style={s.actionBtn} onPress={() => toggleWishlist(item.id)}>
                <Text style={s.actionText}>{wishlist.includes(item.id) ? '❤️' : '♡'}</Text>
              </Pressable>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No products match your filters</Text>
            <Pressable style={s.emptyBtn} onPress={() => { setActiveCategory('all'); setActiveSpecies('All'); setSearchQuery(''); }}>
              <Text style={s.emptyBtnText}>Clear Filters</Text>
            </Pressable>
          </View>
        }
      />

      {/* Floating Measure CTA - Always Visible Money Printer */}
      <Pressable style={s.fab} onPress={() => router.push('/(tabs)/shop?intent=measure')}>
        <Text style={s.fabText}>📏 FREE MEASURE</Text>
      </Pressable>

      {/* Quote Modal - The Money Printer */}
      <Modal visible={showQuoteModal} transparent animationType="slide" onRequestClose={() => setShowQuoteModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Instant Quote</Text>
            {selectedProductForQuote && (
              <>
                <Text style={s.modalProduct}>{selectedProductForQuote.name}</Text>
                
                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>Square Footage</Text>
                  <TextInput 
                    style={s.sqftInput} 
                    value={sqft} 
                    onChangeText={setSqft} 
                    keyboardType="numeric" 
                    placeholder="500"
                  />
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.inputLabel}>Finish</Text>
                  <View style={s.finishRow}>
                    {FINISH_OPTIONS.map((f, idx) => (
                      <Pressable 
                        key={idx} 
                        style={[s.finishChip, selectedFinish === idx && s.finishChipActive]} 
                        onPress={() => setSelectedFinish(idx)}
                      >
                        <Text style={[s.finishText, selectedFinish === idx && s.finishTextActive]}>{f.label}</Text>
                        {f.priceMod > 0 && <Text style={s.finishMod}>+${f.priceMod}/sqft</Text>}
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={s.toggleRow}>
                  <Text style={s.toggleLabel}>Include Professional Installation (+$8.50/sq ft)</Text>
                  <Switch value={includeInstall} onValueChange={setIncludeInstall} trackColor={{ false: '#ECE4D8', true: '#0A3D2E' }} />
                </View>

                <View style={s.estimateBox}>
                  <Text style={s.estimateLabel}>ESTIMATED TOTAL</Text>
                  <Text style={s.estimate}>${estimate}</Text>
                  <Text style={s.estimateNote}>7-day price hold • 5-year warranty included</Text>
                </View>

                <Pressable style={s.modalSubmit} onPress={submitQuote}>
                  <Text style={s.modalSubmitText}>Send Quote Request →</Text>
                </Pressable>
                
                <Pressable onPress={() => setShowQuoteModal(false)} style={{ marginTop: 12 }}>
                  <Text style={{ color: '#6B5B4F', textAlign: 'center', fontWeight: '600' }}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Compare Modal */}
      <Modal visible={showCompareModal} transparent animationType="fade" onRequestClose={() => setShowCompareModal(false)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { maxHeight: '80%' }]}>
            <Text style={s.modalTitle}>Compare Products</Text>
            <ScrollView>
              {compareList.map((p, i) => (
                <View key={i} style={s.compareItem}>
                  <Image source={{ uri: p.image_url || 'https://picsum.photos/id/1015/600/400' }} style={s.compareImage} />
                  <View style={s.compareInfo}>
                    <Text style={s.compareName}>{p.name}</Text>
                    <Text style={s.comparePrice}>${Number(p.price).toFixed(2)} / sq ft</Text>
                    <Text style={s.compareWood}>{p.woodType}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable style={s.modalSubmit} onPress={() => { setShowCompareModal(false); setCompareList([]); }}>
              <Text style={s.modalSubmitText}>Close Comparison</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8F1E9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16 },
  title: { fontSize: 32, fontWeight: '800', color: '#0A3D2E' },
  searchContainer: { paddingHorizontal: 16, marginBottom: 12 },
  searchInput: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE4D8', borderRadius: 16, padding: 14, fontSize: 16 },
  filters: { paddingHorizontal: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE4D8', marginRight: 8 },
  chipActive: { backgroundColor: '#0A3D2E' },
  chipText: { color: '#0A3D2E', fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  speciesRow: { paddingHorizontal: 16, marginBottom: 12 },
  speciesLabel: { fontSize: 12, fontWeight: '700', color: '#6B5B4F', marginBottom: 6 },
  speciesChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE4D8', marginRight: 8 },
  speciesChipActive: { backgroundColor: '#C5A26F' },
  speciesText: { color: '#0A3D2E', fontSize: 12, fontWeight: '600' },
  speciesTextActive: { color: '#FFFFFF' },
  sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
  sortLabel: { fontSize: 12, fontWeight: '700', color: '#6B5B4F' },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE4D8' },
  sortBtnActive: { backgroundColor: '#0A3D2E' },
  sortText: { color: '#0A3D2E', fontSize: 13 },
  sortTextActive: { color: '#FFFFFF' },
  row: { gap: 12, paddingHorizontal: 16 },
  cardWrap: { flex: 1 },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0A3D2E', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  quoteBtn: { backgroundColor: '#0A3D2E' },
  actionText: { color: '#0A3D2E', fontWeight: '700', fontSize: 13 },
  fab: { position: 'absolute', bottom: 28, right: 20, backgroundColor: '#C5A26F', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 999, elevation: 8 },
  fabText: { color: '#0A3D2E', fontWeight: '900' },
  empty: { padding: 40, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0A3D2E', marginBottom: 16 },
  emptyBtn: { backgroundColor: '#0A3D2E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,61,46,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0A3D2E', textAlign: 'center' },
  modalProduct: { fontSize: 18, fontWeight: '700', color: '#0A3D2E', textAlign: 'center', marginVertical: 12 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#6B5B4F', marginBottom: 6 },
  sqftInput: { backgroundColor: '#F8F1E9', borderWidth: 1, borderColor: '#ECE4D8', borderRadius: 14, padding: 16, fontSize: 20, textAlign: 'center' },
  finishRow: { flexDirection: 'row', gap: 8 },
  finishChip: { flex: 1, backgroundColor: '#F8F1E9', borderWidth: 1, borderColor: '#ECE4D8', borderRadius: 12, padding: 10, alignItems: 'center' },
  finishChipActive: { backgroundColor: '#0A3D2E', borderColor: '#0A3D2E' },
  finishText: { color: '#0A3D2E', fontWeight: '700', fontSize: 13 },
  finishTextActive: { color: '#FFFFFF' },
  finishMod: { fontSize: 10, color: '#C5A26F', marginTop: 2 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  toggleLabel: { flex: 1, fontSize: 14, color: '#0A3D2E', fontWeight: '600', paddingRight: 12 },
  estimateBox: { backgroundColor: '#F8F1E9', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24 },
  estimateLabel: { fontSize: 12, color: '#6B5B4F', fontWeight: '700' },
  estimate: { fontSize: 32, fontWeight: '900', color: '#0A3D2E', marginVertical: 4 },
  estimateNote: { fontSize: 11, color: '#6B5B4F', textAlign: 'center' },
  modalSubmit: { backgroundColor: '#0A3D2E', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  compareItem: { flexDirection: 'row', backgroundColor: '#F8F1E9', borderRadius: 14, padding: 12, marginBottom: 12 },
  compareImage: { width: 80, height: 80, borderRadius: 10 },
  compareInfo: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  compareName: { fontSize: 15, fontWeight: '700', color: '#0A3D2E' },
  comparePrice: { fontSize: 16, fontWeight: '900', color: '#C5A26F', marginTop: 4 },
  compareWood: { fontSize: 12, color: '#6B5B4F', marginTop: 2 },
});
