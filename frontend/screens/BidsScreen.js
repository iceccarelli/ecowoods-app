/**
 * BidsScreen — v4.0
 * ─────────────────────────────────────────────────────────────────────
 * • TanStack Query as the source of truth for the bid list
 * • Live filter pills (All / Pending / Accepted / Rejected) with counts
 * • Pull-to-refresh + refetch on screen focus
 * • Haptic feedback on every tap
 * • Optimistic items rendered with reduced opacity until server confirms
 * • Robust error + empty states with retry
 *
 * File location: frontend/screens/BidsScreen.js  (replace existing)
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_STYLES = {
  submitted: { bg: '#D1ECF1', text: '#0C5460', label: 'Pending' },
  accepted: { bg: '#D4EDDA', text: '#155724', label: 'Accepted' },
  rejected: { bg: '#F8D7DA', text: '#721C24', label: 'Rejected' },
};

export default function BidsScreen({ navigation }) {
  const storeBids = useStore((s) => s.bids);
  const [filter, setFilter] = useState('all');

  /* ── Query: bids list ──────────────────────────────────────────── */
  const {
    data: bids = [],
    isLoading,
    isRefetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['bids'],
    queryFn: () => api.listBids(),
    initialData:
      Array.isArray(storeBids) && storeBids.length > 0 ? storeBids : undefined,
    placeholderData: (prev) => prev,
  });

  /* refetch on screen focus so the list is always fresh */
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await refetch();
  }, [refetch]);

  /* ── Derived: per-status counts ─────────────────────────────────── */
  const counts = useMemo(
    () => ({
      all: bids.length,
      submitted: bids.filter((b) => b.status === 'submitted').length,
      accepted: bids.filter((b) => b.status === 'accepted').length,
      rejected: bids.filter((b) => b.status === 'rejected').length,
    }),
    [bids]
  );

  /* ── Derived: filtered + sorted list ────────────────────────────── */
  const filteredBids = useMemo(() => {
    const subset =
      filter === 'all' ? bids : bids.filter((b) => b.status === filter);
    return [...subset].sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
    );
  }, [bids, filter]);

  /* ── Handlers ───────────────────────────────────────────────────── */
  const handlePress = useCallback(
    (item) => {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      navigation.navigate('BidDetail', { bidId: item.id });
    },
    [navigation]
  );

  const handleFilterChange = useCallback((key) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setFilter(key);
  }, []);

  /* ── Render helpers ─────────────────────────────────────────────── */
  const renderFilterPill = ({ item: f }) => {
    const isActive = f.key === filter;
    const count = counts[f.key] ?? 0;
    return (
      <TouchableOpacity
        style={[s.pill, isActive && s.pillActive]}
        onPress={() => handleFilterChange(f.key)}
        activeOpacity={0.85}
      >
        <Text style={[s.pillText, isActive && s.pillTextActive]}>
          {f.label}
          {count > 0 ? ` · ${count}` : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderItem = ({ item }) => {
    const status = STATUS_STYLES[item.status] || STATUS_STYLES.submitted;
    return (
      <TouchableOpacity
        style={[s.card, item.__optimistic && s.cardOptimistic]}
        onPress={() => handlePress(item)}
        activeOpacity={0.85}
      >
        <View style={s.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.amount}>
              ${parseFloat(item.amount || 0).toLocaleString()}
              <Text style={s.currency}> {item.currency || 'USD'}</Text>
            </Text>
            <Text style={s.jobRef}>Job Request #{item.job_request_id}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: status.bg }]}>
            <Text style={[s.badgeText, { color: status.text }]}>
              {status.label}
            </Text>
          </View>
        </View>

        {(item.timeframe || item.pickup_date) && (
          <View style={s.metaRow}>
            {item.timeframe ? (
              <View style={s.metaChip}>
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={COLORS.textLight}
                />
                <Text style={s.metaText}>{item.timeframe}</Text>
              </View>
            ) : null}
            {item.pickup_date ? (
              <View style={s.metaChip}>
                <Ionicons
                  name="calendar-outline"
                  size={13}
                  color={COLORS.textLight}
                />
                <Text style={s.metaText}>{item.pickup_date}</Text>
              </View>
            ) : null}
          </View>
        )}

        {item.notes ? (
          <Text style={s.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        ) : null}

        <View style={s.footer}>
          <Text style={s.footerLink}>View details</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
        </View>
      </TouchableOpacity>
    );
  };

  /* ── Loading / error states ─────────────────────────────────────── */
  if (isLoading && bids.length === 0) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={s.loadingText}>Loading your bids…</Text>
      </View>
    );
  }

  if (isError && bids.length === 0) {
    return (
      <View style={s.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={COLORS.red || '#DC3545'}
        />
        <Text style={s.errorTitle}>Couldn't load bids</Text>
        <Text style={s.errorSubtitle}>
          {error?.message || 'Please check your connection and try again.'}
        </Text>
        <TouchableOpacity style={s.retryBtn} onPress={refetch}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Filter bar */}
      <View style={s.filterBar}>
        <FlatList
          data={STATUS_FILTERS}
          keyExtractor={(f) => f.key}
          renderItem={renderFilterPill}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterContent}
        />
      </View>

      <FlatList
        data={filteredBids}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons
              name="pricetag-outline"
              size={72}
              color={COLORS.lightGray}
            />
            <Text style={s.emptyTitle}>
              {filter === 'all'
                ? 'No bids yet'
                : `No ${STATUS_FILTERS.find((f) => f.key === filter)?.label.toLowerCase()} bids`}
            </Text>
            <Text style={s.emptySubtitle}>
              {filter === 'all'
                ? 'Bids will appear here once installers respond to your job requests.'
                : 'Try a different filter to see other bids.'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    padding: 24,
  },
  loadingText: { marginTop: 12, color: COLORS.textLight, fontSize: 14 },

  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  errorSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  retryBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  /* Filter bar */
  filterBar: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  filterContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.offWhite,
    marginRight: 8,
  },
  pillActive: { backgroundColor: COLORS.accent },
  pillText: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  pillTextActive: { color: COLORS.white },

  /* List */
  list: { padding: 16, paddingBottom: 120 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardOptimistic: { opacity: 0.55 },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  amount: { fontSize: 22, fontWeight: '800', color: COLORS.accent },
  currency: { fontSize: 13, fontWeight: '600', color: COLORS.textLight },
  jobRef: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },

  badge: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

  metaRow: { flexDirection: 'row', gap: 14, marginBottom: 6, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: COLORS.textLight },

  notes: {
    fontSize: 13,
    color: COLORS.darkGray,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 18,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 10,
  },
  footerLink: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '600',
    marginRight: 4,
  },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
