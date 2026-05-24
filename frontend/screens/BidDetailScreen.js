/**
 * BidDetailScreen — v3.0 Premium Detail View + Safe Data Handling
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

export default function BidDetailScreen({ route }) {
  const { bidId } = route.params || {};
  const { getBid } = useStore();

  const [bid, setBid] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!bidId) return;
      try {
        const data = await getBid(bidId);
        setBid(data);
      } catch (e) {
        console.warn('Failed to load bid detail:', e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [bidId, getBid]);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!bid) {
    return (
      <View style={s.centered}>
        <Ionicons name="pricetag-outline" size={72} color={COLORS.lightGray} />
        <Text style={s.emptyTitle}>Bid not found</Text>
        <Text style={s.emptySubtitle}>This bid may have been removed or is no longer available.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      {/* Amount Hero */}
      <View style={s.amountHero}>
        <Text style={s.amountLabel}>BID AMOUNT</Text>
        <Text style={s.amountValue}>
          ${parseFloat(bid.amount).toLocaleString()} {bid.currency}
        </Text>
        <View style={[s.statusPill, { backgroundColor: bid.status === 'accepted' ? '#D4EDDA' : '#FFF3CD' }]}>
          <Text style={s.statusPillText}>{bid.status?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Details Card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Bid Information</Text>
        <View style={s.divider} />

        <DetailRow label="Bid ID" value={`#${bid.id}`} />
        <DetailRow label="Job Request" value={`#${bid.job_request_id}`} />
        <DetailRow label="Status" value={bid.status} capitalize />
        {bid.timeframe && <DetailRow label="Timeframe" value={bid.timeframe} />}
        {bid.pickup_date && <DetailRow label="Pickup Date" value={bid.pickup_date} />}
        {bid.created_at && (
          <DetailRow 
            label="Submitted" 
            value={new Date(bid.created_at).toLocaleDateString('en-US', { 
              month: 'long', day: 'numeric', year: 'numeric' 
            })} 
          />
        )}
      </View>

      {/* Notes */}
      {bid.notes && (
        <View style={s.card}>
          <Text style={s.cardTitle}>Notes from Contractor</Text>
          <View style={s.divider} />
          <Text style={s.notesText}>{bid.notes}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value, capitalize }) {
  return (
    <View style={s.detailRow}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={[s.detailValue, capitalize && { textTransform: 'capitalize' }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite },
  scroll: { padding: 20, paddingBottom: 40 },
  amountHero: { backgroundColor: COLORS.accent, borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 24 },
  amountLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '700', letterSpacing: 1 },
  amountValue: { fontSize: 42, fontWeight: '800', color: COLORS.white, marginTop: 4 },
  statusPill: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  statusPillText: { color: '#856404', fontWeight: '800', fontSize: 12 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  detailLabel: { fontSize: 14, color: COLORS.textLight },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  notesText: { fontSize: 14.5, color: COLORS.darkGray, lineHeight: 22 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 6, paddingHorizontal: 30 },
});
