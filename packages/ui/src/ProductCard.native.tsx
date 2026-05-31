import React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import type { Product } from '@ecowoods/types';

export const ProductCard = ({ product, onPress }: { product: Product; onPress?: () => void }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [s.card, pressed && s.pressed]}>
    <Image source={{ uri: product.image_url || 'https://picsum.photos/600/400' }} style={s.image} resizeMode="cover" />
    <View style={s.body}>
      <View style={s.badge}><Text style={s.badgeText}>{product.category}</Text></View>
      <Text style={s.name} numberOfLines={2}>{product.name}</Text>
      {product.description ? <Text style={s.desc} numberOfLines={2}>{product.description}</Text> : null}
      <View style={s.priceRow}>
        <Text style={s.price}>${Number(product.price).toFixed(2)}</Text>
        <Text style={s.unit}>CAD / sq ft</Text>
      </View>
    </View>
  </Pressable>
);
ProductCard.displayName = 'ProductCard';

const s = StyleSheet.create({
  card: { backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#ECE4D8' },
  pressed: { opacity: 0.95 },
  image: { width: '100%', height: 190, backgroundColor: '#F8F1E9' },
  body: { padding: 18 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#F8F1E9', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 10 },
  badgeText: { color: '#0A3D2E', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  name: { fontSize: 19, fontWeight: '700', color: '#0A3D2E', marginBottom: 6 },
  desc: { fontSize: 13, color: '#6B5B4F', marginBottom: 14, lineHeight: 19 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  price: { fontSize: 26, fontWeight: '800', color: '#0A3D2E' },
  unit: { fontSize: 13, color: '#6B5B4F', marginLeft: 6 },
});
