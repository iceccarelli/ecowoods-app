/**
 * RequestEstimateScreen — v4.0
 * ─────────────────────────────────────────────────────────────────────
 * • Parallel useQuery for job + bids (refetches both on pull)
 * • Sorted bids: accepted first, then by amount ascending
 * • "BEST MATCH" indicator on the cheapest submitted bid
 * • Bid range stats card (min / avg / max) when >1 bid
 * • Accepted bid banner — surfaces the accepted bid prominently
 * • Tap a bid → BidDetail (with accept/reject + Stripe)
 *
 * File location: frontend/screens/RequestEstimateScreen.js  (replace existing)
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import api from '../services/api';
import { COLORS } from '../styles';

const STATUS_PILL_BG = {
  pending: '#FFF3CD',
  in_progress: '#D1ECF1',
  completed: '#D4EDDA',
  cancelled: '#F8D7DA',
};
const STATUS_PILL_TEXT = {
  pending: '#856404',
  in_progress: '#0C5460',
  completed: '#155724',
  cancelled: '#721C24',
};

export default function RequestEstimateScreen({ route, navigation }) {
  const { jobId } = route.params || {};

  /* ── Parallel queries ────────────────────────────────── */
  const {
    data: job,
    isLoading: jobLoading,
    isRefetching: jobRefetching,
    refetch: refetchJob,
  } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => api.getJobRequest(jobId),
    enabled: !!jobId,
  });

  const {
    data: bids = [],
    isLoading: bidsLoading,
    isRefetching: bidsRefetching,
    refetch: refetchBids,
  } = useQuery({
    queryKey: ['bids', jobId],
    queryFn: () => api.listBids(jobId),
    enabled: !!jobId,
  });

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    await Promise.all([refetchJob(), refetchBids()]);
  }, [refetchJob, refetchBids]);

  /* ── Sort: accepted first, then cheapest, then by date ── */
  const sortedBids = useMemo(() => {
    return [...bids].sort((a, b) => {
      if (a.status === 'accepted' && b.status !== 'accepted') return -1;
      if (b.status === 'accepted' && a.status !== 'accepted') return 1;
      const amtA = parseFloat(a.amount || 0);
      const amtB = parseFloat(b.amount || 0);
      if (amtA !== amtB) return amtA - amtB;
      return (
        new Date(b.created_at || 0).getTime() -
        new Date(a.created_at || 0).getTime()
      );
    });
  }, [bids]);

  const bestBid = useMemo(() => {
    const submitted = bids.filter((b) => b.status === 'submitted');
    if (submitted.length === 0) return null;
    return submitted.reduce((min, b) =>
      parseFloat(b.amount || 0) < parseFloat(min.amount || 0) ? b : min
    );
  }, [bids]);

  const acceptedBid = useMemo(
    () => bids.find((b) => b.status === 'accepted'),
    [bids]
  );

  const stats = useMemo(() => {
    if (bids.length === 0) return null;
    const amounts = bids
      .map((b) => parseFloat(b.amount || 0))
      .filter((n) => n > 0);
    if (amounts.length === 0) return null;
    return {
      min: Math.min(...amounts),
      max: Math.max(...amounts),
      avg: amounts.reduce((a, b) => a + b, 0) / amounts.length,
      count: bids.length,
    };
  }, [bids]);

  /* ── States ────────────────────────────────────────────── */
  if (jobLoading && !job) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={s.loadingText}>Loading your estimate…</Text>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={s.centered}>
        <Ionicons
          name="document-text-outline"
          size={72}
          color={COLORS.lightGray}
        />
        <Text style={s.errorTitle}>Estimate not found</Text>
        <Text style={s.errorSubtitle}>
          This job request may have been removed.
        </Text>
      </View>
    );
  }

  const statusBg = STATUS_PILL_BG[job.status] || STATUS_PILL_BG.pending;
  const statusText = STATUS_PILL_TEXT[job.status] || STATUS_PILL_TEXT.pending;

  /* ── Render ────────────────────────────────────────────── */
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: COLORS.offWhite }}
      contentContainerStyle={s.scroll}
      refreshControl={
        <RefreshControl
          refreshing={jobRefetching || bidsRefetching}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroHeader}>
          <View style={s.heroIcon}>
            <Ionicons name="clipboard" size={26} color={COLORS.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>Job Request #{job.id}</Text>
            <Text style={s.heroSubtitle}>
              Submitted{' '}
              {job.created_at
                ? new Date(job.created_at).toLocaleDateString()
                : 'recently'}
            </Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: statusBg }]}>
            <Text style={[s.statusPillText, { color: statusText }]}>
              {(job.status || 'pending').replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      {/* Project details */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Project Details</Text>
        <View style={s.divider} />
        {Array.isArray(job.services) && job.services.length > 0 ? (
          <DetailRow
            icon="construct"
            label="Services"
            value={job.services.join(', ')}
          />
        ) : null}
        {job.wood_type ? (
          <DetailRow
            icon="leaf"
            label="Wood Type"
            value={job.wood_type}
            capitalize
          />
        ) : null}
        {job.size ? (
          <DetailRow
            icon="resize"
            label="Size"
            value={`${job.size} sq ft`}
          />
        ) : null}
        {job.property_type ? (
          <DetailRow
            icon="home"
            label="Property"
            value={job.property_type}
            capitalize
          />
        ) : null}
        {job.timeframe ? (
          <DetailRow
            icon="time"
            label="Timeframe"
            value={job.timeframe.replace(/_/g, ' ')}
          />
        ) : null}
        {job.address ? (
          <DetailRow icon="location" label="Address" value={job.address} />
        ) : null}
        {job.notes ? (
          <DetailRow
            icon="document-text"
            label="Notes"
            value={job.notes}
            multiline
          />
        ) : null}
      </View>

      {/* Stats */}
      {stats && bids.length > 1 ? (
        <View style={s.statsCard}>
          <Text style={s.cardTitle}>Bid Range</Text>
          <View style={s.divider} />
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statLabel}>Lowest</Text>
              <Text style={[s.statValue, { color: '#28A745' }]}>
                ${stats.min.toLocaleString()}
              </Text>
            </View>
            <View style={s.statBoxDivider} />
            <View style={s.statBox}>
              <Text style={s.statLabel}>Average</Text>
              <Text style={s.statValue}>
                ${Math.round(stats.avg).toLocaleString()}
              </Text>
            </View>
            <View style={s.statBoxDivider} />
            <View style={s.statBox}>
              <Text style={s.statLabel}>Highest</Text>
              <Text style={[s.statValue, { color: COLORS.textLight }]}>
                ${stats.max.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Accepted banner */}
      {acceptedBid ? (
        <TouchableOpacity
          style={s.acceptedBanner}
          onPress={() =>
            navigation.navigate('BidDetail', { bidId: acceptedBid.id })
          }
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.acceptedLabel}>YOU'VE ACCEPTED THIS BID</Text>
            <Text style={s.acceptedAmount}>
              ${parseFloat(acceptedBid.amount || 0).toLocaleString()}{' '}
              {acceptedBid.currency || 'USD'}
            </Text>
            <Text style={s.acceptedSubtitle}>
              Check your Calendar for scheduled work
            </Text>
          </View>
          <Ionicons name="checkmark-circle" size={36} color="#155724" />
        </TouchableOpacity>
      ) : null}

      {/* Bids section header */}
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Bids Received</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{bids.length}</Text>
        </View>
      </View>

      {/* Bids list */}
      {bidsLoading && bids.length === 0 ? (
        <View style={s.bidsLoading}>
          <ActivityIndicator size="small" color={COLORS.accent} />
          <Text style={s.bidsLoadingText}>Loading bids…</Text>
        </View>
      ) : bids.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons
            name="pricetag-outline"
            size={48}
            color={COLORS.lightGray}
          />
          <Text style={s.emptyTitle}>No bids yet</Text>
          <Text style={s.emptySubtitle}>
            Installers in our network typically respond within 24 hours.
            You'll get a push notification when a bid arrives.
          </Text>
        </View>
      ) : (
        sortedBids.map((bid) => {
          const isBest =
            bestBid && bid.id === bestBid.id && bid.status === 'submitted';
          const isAccepted = bid.status === 'accepted';
          return (
            <TouchableOpacity
              key={bid.id}
              style={[
                s.bidCard,
                isBest && s.bidCardBest,
                isAccepted && s.bidCardAccepted,
              ]}
              onPress={() => {
                if (Platform.OS !== 'web')
                  Haptics.selectionAsync().catch(() => {});
                navigation.navigate('BidDetail', { bidId: bid.id });
              }}
              activeOpacity={0.85}
            >
              {isBest ? (
                <View style={s.bestBadge}>
                  <Ionicons name="star" size={11} color={COLORS.white} />
                  <Text style={s.bestBadgeText}>BEST MATCH</Text>
                </View>
              ) : null}
              {isAccepted ? (
                <View style={[s.bestBadge, { backgroundColor: '#28A745' }]}>
                  <Ionicons
                    name="checkmark-circle"
                    size={11}
                    color={COLORS.white}
                  />
                  <Text style={s.bestBadgeText}>ACCEPTED</Text>
                </View>
              ) : null}

              <View style={s.bidHeader}>
                <View>
                  <Text style={s.bidAmount}>
                    ${parseFloat(bid.amount || 0).toLocaleString()}
                  </Text>
                  <Text style={s.bidCurrency}>{bid.currency || 'USD'}</Text>
                </View>
                <View
                  style={[
                    s.miniStatusBadge,
                    {
                      backgroundColor:
                        bid.status === 'accepted'
                          ? '#D4EDDA'
                          : bid.status === 'rejected'
                            ? '#F8D7DA'
                            : '#FFF3CD',
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.miniStatusText,
                      {
                        color:
                          bid.status === 'accepted'
                            ? '#155724'
                            : bid.status === 'rejected'
                              ? '#721C24'
                              : '#856404',
                      },
                    ]}
                  >
                    {bid.status}
                  </Text>
                </View>
              </View>

              {(bid.timeframe || bid.pickup_date) ? (
                <View style={s.bidMeta}>
                  {bid.timeframe ? (
                    <View style={s.metaChip}>
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color={COLORS.textLight}
                      />
                      <Text style={s.metaText}>{bid.timeframe}</Text>
                    </View>
                  ) : null}
                  {bid.pickup_date ? (
                    <View style={s.metaChip}>
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={COLORS.textLight}
                      />
                      <Text style={s.metaText}>{bid.pickup_date}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}

              {bid.notes ? (
                <Text style={s.bidNotes} numberOfLines={2}>
                  {bid.notes}
                </Text>
              ) : null}

              <View style={s.bidFooter}>
                <Text style={s.bidFooterText}>
                  {isAccepted
                    ? 'View confirmation'
                    : bid.status === 'submitted'
                      ? 'Review & accept'
                      : 'View details'}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={COLORS.accent}
                />
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function DetailRow({ icon, label, value, capitalize, multiline }) {
  return (
    <View style={[s.detailRow, multiline && { alignItems: 'flex-start' }]}>
      <View style={s.detailLeft}>
        {icon ? <Ionicons name={icon} size={16} color={COLORS.accent} /> : null}
        <Text style={s.detailLabel}>{label}</Text>
      </View>
      <Text
        style={[
          s.detailValue,
          capitalize && { textTransform: 'capitalize' },
          multiline && { textAlign: 'right' },
        ]}
        numberOfLines={multiline ? 4 : 2}
      >
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
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
  },

  scroll: { padding: 20 },

  hero: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center' },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text },
  heroSubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusPillText: { fontSize: 10, fontWeight: '800' },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 12 },

  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  detailLabel: { fontSize: 13, color: COLORS.textLight, marginLeft: 4 },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },

  statsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center' },
  statBoxDivider: { width: 1, height: 32, backgroundColor: COLORS.lightGray },
  statLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 4,
  },

  acceptedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8EC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#A3D9B1',
  },
  acceptedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#155724',
    letterSpacing: 1,
  },
  acceptedAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: '#155724',
    marginTop: 4,
  },
  acceptedSubtitle: { fontSize: 12, color: '#155724', marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  countBadge: {
    backgroundColor: COLORS.accent + '15',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 10,
  },
  countText: { color: COLORS.accent, fontWeight: '700', fontSize: 13 },

  bidsLoading: { padding: 24, alignItems: 'center', gap: 8 },
  bidsLoadingText: { fontSize: 13, color: COLORS.textLight },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  bidCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  bidCardBest: { borderWidth: 2, borderColor: COLORS.accent },
  bidCardAccepted: { borderWidth: 2, borderColor: '#28A745' },
  bestBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  bestBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bidAmount: { fontSize: 24, fontWeight: '800', color: COLORS.accent },
  bidCurrency: {
    fontSize: 12,
    color: COLORS.textLight,
    fontWeight: '600',
    marginTop: -2,
  },
  miniStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  miniStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  bidMeta: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textLight },

  bidNotes: {
    fontSize: 13,
    color: COLORS.darkGray,
    fontStyle: 'italic',
    marginTop: 4,
  },

  bidFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  bidFooterText: {
    color: COLORS.accent,
    fontWeight: '600',
    fontSize: 13,
    marginRight: 4,
  },
});
