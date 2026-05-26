/**
 * BidsScreen — v3.0 Premium UI/UX + Perfect Store Sync
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

const STATUS_COLORS = {
  submitted: { bg: '#D1ECF1', text: '#0C5460' },
  accepted: { bg: '#D4EDDA', text: '#155724' },
  rejected: { bg: '#F8D7DA', text: '#721C24' },
};

export default function BidsScreen({ navigation }) {
  const { bids = [], bidsLoading, fetchBids } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBids?.().catch(() => {});
  }, [fetchBids]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchBids?.(); } catch (e) {}
    setRefreshing(false);
  };

  const renderItem = ({ item }) => {
    const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.submitted;
    return (
      <TouchableOpacity
        style={s.card}
        onPress={() => navigation.navigate('BidDetail', { bidId: item.id })}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <View>
            <Text style={s.amount}>${parseFloat(item.amount).toLocaleString()} {item.currency}</Text>
            <Text style={s.jobRef}>Job #{item.job_request_id}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[s.badgeText, { color: statusStyle.text }]}>{item.status}</Text>
          </View>
        </View>

        <View style={s.metaRow}>
          {item.timeframe && (
            <View style={s.metaChip}>
              <Ionicons name="time-outline" size={13} color={COLORS.textLight} />
              <Text style={s.metaText}>{item.timeframe}</Text>
            </View>
          )}
          {item.pickup_date && (
            <View style={s.metaChip}>
              <Ionicons name="calendar-outline" size={13} color={COLORS.textLight} />
              <Text style={s.metaText}>{item.pickup_date}</Text>
            </View>
          )}
        </View>

        {item.notes && <Text style={s.notes} numberOfLines={2}>{item.notes}</Text>}
      </TouchableOpacity>
    );
  };

  if (bidsLoading && bids.length === 0) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <FlatList
        data={bids}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="pricetag-outline" size={72} color={COLORS.lightGray} />
            <Text style={s.emptyTitle}>No bids yet</Text>
            <Text style={s.emptySubtitle}>Bids will appear here once submitted for your job requests.</Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  amount: { fontSize: 21, fontWeight: '800', color: COLORS.accent },
  jobRef: { fontSize: 13, color: COLORS.textLight, marginTop: 3 },
  badge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  metaRow: { flexDirection: 'row', gap: 14, marginBottom: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: COLORS.textLight },
  notes: { fontSize: 13, color: COLORS.darkGray, fontStyle: 'italic', marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 100 },
  emptyTitle: { fontSize: 19, fontWeight: '700', color: COLORS.text, marginTop: 20 },
  emptySubtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 8, paddingHorizontal: 40 },
});
