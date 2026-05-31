import { useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable,
  TextInput, RefreshControl, Modal, Switch, Image
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@ecowoods/api-client';
import type { Product } from '@ecowoods/types';

// Mobile-safe ProductCard
function MobileProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
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
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE4D8', marginBottom: 8 },
  image: { width: '100%', height: 140, backgroundColor: '#F0E6D9' },
  content: { padding: 14 },
  name: { fontSize: 15, fontWeight: '700', color: '#0A3D2E', lineHeight: 20, marginBottom: 8 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  woodType: { fontSize: 12, color: '#6B5B4F' },
  price: { fontSize: 16, fontWeight: '900', color: '#0A3D2E' },
});

const CATEGORIES = [
  { key: 'all', label: 'All', icon: '🌲' },
  { key: 'flooring', label: 'Flooring', icon: '🪵' },
  { key: 'solid', label: 'Solid Hardwood', icon: '🌳' },
  { key: 'engineered', label: 'Engineered', icon: '📐' },
  { key: 'services', label: 'Services', icon: '🔧' },
] as const;

export default function ShopScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(params.category || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'popular'>('featured');
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [selectedProductForQuote, setSelectedProductForQuote] = useState<Product | null>(null);
  const [sqft, setSqft] = useState('500');
  const [includeInstall, setIncludeInstall] = useState(false);
  const [wishlist, setWishlist] = useState<number[]>([]);

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
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || (p.woodType || '').toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'price-low': result.sort((a, b) => Number(a.price) - Number(b.price)); break;
      case 'price-high': result.sort((a, b) => Number(b.price) - Number(a.price)); break;
      default: result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); break;
    }
    return result;
  }, [products, activeCategory, searchQuery, sortBy]);

  const handleRequestQuote = (product: Product) => {
    setSelectedProductForQuote(product);
    setShowQuoteModal(true);
  };

  const submitQuote = () => {
    const product = selectedProductForQuote;
    if (!product) return;
    const total = (Number(product.price) * parseFloat(sqft || '0') + (includeInstall ? parseFloat(sqft || '0') * 8.5 : 0)).toFixed(2);
    setShowQuoteModal(false);
    alert(`✅ Quote sent!\n\n${product.name}\n${sqft} sq ft\nEstimated: $${total}`);
  };

  const onRefresh = () => loadProducts(true);
  const toggleWishlist = (id: number) => setWishlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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
              <TextInput style={s.searchInput} placeholder="Search oak, walnut..." value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <View style={s.filters}>
              {CATEGORIES.map(cat => (
                <Pressable key={cat.key} onPress={() => setActiveCategory(cat.key)} style={[s.chip, activeCategory === cat.key && s.chipActive]}>
                  <Text style={[s.chipText, activeCategory === cat.key && s.chipTextActive]}>{cat.icon} {cat.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.cardWrap}>
            <MobileProductCard product={item} onPress={() => router.push(`/product/${item.slug || item.id}`)} />
            <View style={s.quickActions}>
              <Pressable style={s.actionBtn} onPress={() => alert(`🛒 Added ${item.name}`)}><Text style={s.actionText}>🛒 Add</Text></Pressable>
              <Pressable style={[s.actionBtn, s.quoteBtn]} onPress={() => handleRequestQuote(item)}><Text style={s.actionText}>📋 Quote</Text></Pressable>
              <Pressable style={s.actionBtn} onPress={() => toggleWishlist(item.id)}><Text style={s.actionText}>{wishlist.includes(item.id) ? '❤️' : '♡'}</Text></Pressable>
            </View>
          </View>
        )}
      />

      <Pressable style={s.fab} onPress={() => router.push('/(tabs)/shop?intent=measure')}>
        <Text style={s.fabText}>📏 FREE MEASURE</Text>
      </Pressable>

      <Modal visible={showQuoteModal} transparent animationType="slide" onRequestClose={() => setShowQuoteModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Request Quote</Text>
            {selectedProductForQuote && (
              <>
                <Text style={s.modalProduct}>{selectedProductForQuote.name}</Text>
                <TextInput style={s.sqftInput} value={sqft} onChangeText={setSqft} keyboardType="numeric" />
                <View style={s.toggleRow}>
                  <Text>Include Installation (+$8.50/sq ft)</Text>
                  <Switch value={includeInstall} onValueChange={setIncludeInstall} />
                </View>
                <Text style={s.estimate}>Estimated: ${(Number(selectedProductForQuote.price) * parseFloat(sqft || '0') + (includeInstall ? parseFloat(sqft || '0') * 8.5 : 0)).toFixed(2)}</Text>
                <Pressable style={s.modalSubmit} onPress={submitQuote}><Text style={s.modalSubmitText}>Send Request</Text></Pressable>
              </>
            )}
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
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#ECE4D8' },
  chipActive: { backgroundColor: '#0A3D2E' },
  chipText: { color: '#0A3D2E', fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  row: { gap: 12, paddingHorizontal: 16 },
  cardWrap: { flex: 1 },
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0A3D2E', borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  quoteBtn: { backgroundColor: '#0A3D2E' },
  actionText: { color: '#0A3D2E', fontWeight: '700', fontSize: 13 },
  fab: { position: 'absolute', bottom: 28, right: 20, backgroundColor: '#C5A26F', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 999 },
  fabText: { color: '#0A3D2E', fontWeight: '900' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(10,61,46,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0A3D2E', textAlign: 'center' },
  modalProduct: { fontSize: 18, fontWeight: '700', color: '#0A3D2E', textAlign: 'center', marginVertical: 12 },
  sqftInput: { backgroundColor: '#F8F1E9', borderWidth: 1, borderColor: '#ECE4D8', borderRadius: 14, padding: 16, fontSize: 20, textAlign: 'center', marginBottom: 16 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  estimate: { fontSize: 28, fontWeight: '900', color: '#0A3D2E', textAlign: 'center', marginBottom: 24 },
  modalSubmit: { backgroundColor: '#0A3D2E', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  modalSubmitText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
