/**
 * RequestEstimateScreen — v3.0 Massive UI/UX Upgrade
 * Perfect data sync with store + beautiful customer experience
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity, RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

export default function RequestEstimateScreen({ route, navigation }) {
  const { jobId } = route.params || {};
  const { getJobRequest, fetchBids } = useStore();

  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const jobData = await getJobRequest(jobId);
      setJob(jobData);

      const bidsData = await fetchBids(jobId);
      setBids(Array.isArray(bidsData) ? bidsData : []);
    } catch (e) {
      console.warn('Failed to load estimate:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [jobId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading && !refreshing) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={s.loadingText}>Loading your estimate...</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={s.centered}>
        <Ionicons name="document-text-outline" size={72} color={COLORS.lightGray} />
        <Text style={s.emptyTitle}>Estimate not found</Text>
        <Text style={s.emptySubtitle}>This job request may have been removed.</Text>
      </View>
    );
  }

  const statusColor = job.status === 'completed' ? COLORS.success : 
                      job.status === 'in_progress' ? COLORS.accent : COLORS.warning;

  return (
    <ScrollView 
      contentContainerStyle={s.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Hero Status Card */}
      <View style={[s.heroCard, { backgroundColor: statusColor + '15' }]}>
        <View style={s.heroHeader}>
          <Ionicons name="clipboard" size={28} color={statusColor} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.heroTitle}>Job Request #{job.id}</Text>
            <Text style={[s.heroStatus, { color: statusColor }]}>{job.status?.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Job Details */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Project Details</Text>
        <View style={s.divider} />

        {job.services?.length > 0 && (
          <DetailRow icon="construct" label="Services" value={job.services.join(', ')} />
        )}
        {job.wood_type && <DetailRow icon="leaf" label="Wood Type" value={job.wood_type} />}
        {job.size && <DetailRow icon="resize" label="Size" value={`${job.size} sq ft`} />}
        {job.property_type && <DetailRow icon="home" label="Property" value={job.property_type} />}
        {job.timeframe && <DetailRow icon="time" label="Timeframe" value={job.timeframe} />}
        {job.address && <DetailRow icon="location" label="Address" value={job.address} />}
      </View>

      {/* Bids / Estimates Section */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Estimates Received</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{bids.length}</Text>
        </View>
      </View>

      {bids.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons name="pricetag-outline" size={48} color={COLORS.lightGray} />
          <Text style={s.emptyTitle}>No estimates yet</Text>
          <Text style={s.emptySubtitle}>Our team will send you competitive bids soon.</Text>
        </View>
      ) : (
        bids.map((bid, index) => (
          <TouchableOpacity
            key={bid.id}
            style={[s.bidCard, index === 0 && s.bestBid]}
            onPress={() => navigation.navigate('BidDetail', { bidId: bid.id })}
            activeOpacity={0.9}
          >
            {index === 0 && (
              <View style={s.bestBadge}>
                <Text style={s.bestBadgeText}>BEST MATCH</Text>
              </View>
            )}

            <View style={s.bidHeader}>
              <Text style={s.bidAmount}>
                ${parseFloat(bid.amount).toLocaleString()} {bid.currency}
              </Text>
              <View style={[s.statusBadge, { backgroundColor: bid.status === 'accepted' ? '#D4EDDA' : '#FFF3CD' }]}>
                <Text style={s.statusText}>{bid.status}</Text>
              </View>
            </View>

            <View style={s.bidMeta}>
              {bid.timeframe && (
                <View style={s.metaItem}>
                  <Ionicons name="time-outline" size={14} color={COLORS.textLight} />
                  <Text style={s.metaText}>{bid.timeframe}</Text>
                </View>
              )}
              {bid.pickup_date && (
                <View style={s.metaItem}>
                  <Ionicons name="calendar-outline" size={14} color={COLORS.textLight} />
                  <Text style={s.metaText}>{bid.pickup_date}</Text>
                </View>
              )}
            </View>

            {bid.notes && (
              <Text style={s.bidNotes} numberOfLines={2}>{bid.notes}</Text>
            )}

            <View style={s.viewDetails}>
              <Text style={s.viewDetailsText}>View full details</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={s.detailRow}>
      <View style={s.detailLeft}>
        <Ionicons name={icon} size={16} color={COLORS.accent} />
        <Text style={s.detailLabel}>{label}</Text>
      </View>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.offWhite },
  loadingText: { marginTop: 12, color: COLORS.textLight, fontSize: 14 },
  scroll: { padding: 20, paddingBottom: 40 },
  heroCard: { borderRadius: 20, padding: 20, marginBottom: 20 },
  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  heroTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },
  heroStatus: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailLabel: { fontSize: 14, color: COLORS.textLight, marginLeft: 4 },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text, flex: 1, textAlign: 'right' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  countBadge: { backgroundColor: COLORS.accent + '15', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 10 },
  countText: { color: COLORS.accent, fontWeight: '700', fontSize: 13 },
  emptyCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: COLORS.lightGray, borderStyle: 'dashed' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', marginTop: 6 },
  bidCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  bestBid: { borderWidth: 2, borderColor: COLORS.accent },
  bestBadge: { position: 'absolute', top: -8, right: 16, backgroundColor: COLORS.accent, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  bestBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '800' },
  bidHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  bidAmount: { fontSize: 22, fontWeight: '800', color: COLORS.accent },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  bidMeta: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: COLORS.textLight },
  bidNotes: { fontSize: 13, color: COLORS.darkGray, fontStyle: 'italic', marginTop: 6 },
  viewDetails: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12 },
  viewDetailsText: { color: COLORS.accent, fontWeight: '600', fontSize: 13, marginRight: 4 },
});
