/**
 * BidDetailScreen — v4.0
 * ─────────────────────────────────────────────────────────────────────
 * • useQuery for the single bid (refetch on pull)
 * • useMutation for accept / reject — optimistic with rollback
 * • Stripe PaymentSheet (Apple Pay, Google Pay, Card) wired to accept
 *     - Tries to init from backend PaymentIntent on mount
 *     - Falls back to a direct accept if Stripe isn't configured / available
 * • Sticky bottom action bar (Decline | Accept & Pay)
 * • Success / failure haptics
 * • Beautiful hero amount card + status pill
 *
 * File location: frontend/screens/BidDetailScreen.js  (replace existing)
 *
 * Backend endpoints expected (graceful degradation if absent):
 *   api.getBid(id)                                → returns bid object
 *   api.acceptBid(id)                             → accepts the bid
 *   api.rejectBid(id)                             → rejects the bid
 *   api.createPaymentIntent({ bidId, amount, currency })
 *        → { paymentIntent: clientSecret, ephemeralKey, customer }
 *
 * Stripe publishable key resolution order:
 *   1) Constants.expoConfig.extra.stripePublishableKey  (app.json `extra`)
 *   2) process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY   (Expo env)
 *   3) hard-coded placeholder (test key) — REPLACE BEFORE LAUNCH
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StripeProvider, useStripe } from '@stripe/stripe-react-native';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import api from '../services/api';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

const STRIPE_PUBLISHABLE_KEY =
  Constants?.expoConfig?.extra?.stripePublishableKey ||
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
  'pk_test_REPLACE_ME';

const MERCHANT_ID = 'merchant.com.ecowoods.hardwood';

const STATUS_PILL_BG = {
  submitted: '#FFF3CD',
  accepted: '#D4EDDA',
  rejected: '#F8D7DA',
};
const STATUS_PILL_TEXT = {
  submitted: '#856404',
  accepted: '#155724',
  rejected: '#721C24',
};

/* ============================================================
   Outer wrapper — provides Stripe context to the screen.
   ============================================================ */
export default function BidDetailScreen({ route, navigation }) {
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={MERCHANT_ID}
      urlScheme="ecowoods"
    >
      <BidDetailContent route={route} navigation={navigation} />
    </StripeProvider>
  );
}

/* ============================================================
   Inner content — does all the work, has access to useStripe()
   ============================================================ */
function BidDetailContent({ route, navigation }) {
  const { bidId } = route.params || {};
  const queryClient = useQueryClient();
  const user = useStore((s) => s.user);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [paymentReady, setPaymentReady] = useState(false);
  const [paying, setPaying] = useState(false);

  /* ── Query: bid detail ─────────────────────────────────── */
  const {
    data: bid,
    isLoading,
    isRefetching,
    refetch,
    isError,
    error,
  } = useQuery({
    queryKey: ['bid', bidId],
    queryFn: () => api.getBid(bidId),
    enabled: !!bidId,
  });

  /* ── Stripe: initialise PaymentSheet when bid is loaded and submitted ── */
  const initializePayment = useCallback(async () => {
    if (!bid || bid.status !== 'submitted') return;
    if (!api.createPaymentIntent) return; // backend not ready — skip silently
    if (!STRIPE_PUBLISHABLE_KEY || STRIPE_PUBLISHABLE_KEY === 'pk_test_REPLACE_ME') return;

    try {
      const payment = await api.createPaymentIntent({
        bidId: bid.id,
        amount: bid.amount,
        currency: (bid.currency || 'USD').toLowerCase(),
      });
      if (!payment?.paymentIntent) return;

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'EcoWoods Hardwood',
        customerId: payment.customer,
        customerEphemeralKeySecret: payment.ephemeralKey,
        paymentIntentClientSecret: payment.paymentIntent,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: user?.full_name || user?.username || undefined,
          email: user?.email || undefined,
        },
        returnURL: 'ecowoods://stripe-redirect',
        appearance: {
          colors: { primary: COLORS.accent },
          shapes: { borderRadius: 12 },
        },
        applePay: { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: true, currencyCode: (bid.currency || 'USD').toUpperCase() },
      });

      if (!initError) setPaymentReady(true);
    } catch (e) {
      // Payment is optional — user can still accept without paying
      console.warn('Stripe init failed:', e?.message);
    }
  }, [bid, initPaymentSheet, user]);

  useEffect(() => {
    initializePayment();
  }, [initializePayment]);

  /* ── Mutation: accept ──────────────────────────────────── */
  const acceptMutation = useMutation({
    mutationFn: (id) => api.acceptBid(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bid', id] });
      const previous = queryClient.getQueryData(['bid', id]);
      queryClient.setQueryData(['bid', id], (old) => ({
        ...(old || {}),
        status: 'accepted',
      }));
      queryClient.setQueryData(['bids'], (old) =>
        Array.isArray(old)
          ? old.map((b) => (b.id === id ? { ...b, status: 'accepted' } : b))
          : old
      );
      return { previous };
    },
    onError: (err, id, ctx) => {
      queryClient.setQueryData(['bid', id], ctx?.previous);
      Alert.alert(
        "Couldn't accept bid",
        err?.message || 'Please try again in a moment.'
      );
    },
    onSuccess: () => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', bidId] });
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['jobRequests'] });
    },
  });

  /* ── Mutation: reject ──────────────────────────────────── */
  const rejectMutation = useMutation({
    mutationFn: (id) => api.rejectBid(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bid', id] });
      const previous = queryClient.getQueryData(['bid', id]);
      queryClient.setQueryData(['bid', id], (old) => ({
        ...(old || {}),
        status: 'rejected',
      }));
      queryClient.setQueryData(['bids'], (old) =>
        Array.isArray(old)
          ? old.map((b) => (b.id === id ? { ...b, status: 'rejected' } : b))
          : old
      );
      return { previous };
    },
    onError: (err, id, ctx) => {
      queryClient.setQueryData(['bid', id], ctx?.previous);
      Alert.alert(
        "Couldn't decline bid",
        err?.message || 'Please try again in a moment.'
      );
    },
    onSuccess: () => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning
        ).catch(() => {});
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['bid', bidId] });
      queryClient.invalidateQueries({ queryKey: ['bids'] });
    },
  });

  /* ── Action handlers ───────────────────────────────────── */
  const handleAcceptWithPayment = async () => {
    if (!paymentReady) {
      handleAcceptDirect();
      return;
    }
    setPaying(true);
    const { error: presentError } = await presentPaymentSheet();
    setPaying(false);

    if (presentError) {
      if (presentError.code !== 'Canceled') {
        Alert.alert(
          'Payment failed',
          presentError.message || 'Please try again.'
        );
      }
      return;
    }

    // Payment succeeded — confirm acceptance on the backend
    acceptMutation.mutate(bidId);
  };

  const handleAcceptDirect = () => {
    Alert.alert(
      'Accept this bid?',
      `Confirm $${parseFloat(bid?.amount || 0).toLocaleString()} ${bid?.currency || 'USD'} for Job Request #${bid?.job_request_id}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => acceptMutation.mutate(bidId),
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Decline this bid?',
      "You can still accept another bid for this project. This action can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => rejectMutation.mutate(bidId),
        },
      ]
    );
  };

  /* ── States ────────────────────────────────────────────── */
  if (isLoading && !bid) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (isError && !bid) {
    return (
      <View style={s.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={64}
          color={COLORS.red || '#DC3545'}
        />
        <Text style={s.errorTitle}>Couldn't load bid</Text>
        <Text style={s.errorSubtitle}>
          {error?.message || 'Please try again.'}
        </Text>
        <TouchableOpacity style={s.retryBtn} onPress={refetch}>
          <Text style={s.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!bid) {
    return (
      <View style={s.centered}>
        <Ionicons
          name="pricetag-outline"
          size={72}
          color={COLORS.lightGray}
        />
        <Text style={s.errorTitle}>Bid not found</Text>
      </View>
    );
  }

  const isActionable = bid.status === 'submitted';
  const isAccepting = acceptMutation.isPending || paying;
  const isRejecting = rejectMutation.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.offWhite }}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        {/* Hero amount */}
        <View style={s.amountHero}>
          <Text style={s.amountLabel}>BID AMOUNT</Text>
          <Text style={s.amountValue}>
            ${parseFloat(bid.amount || 0).toLocaleString()}
            <Text style={s.amountCurrency}> {bid.currency || 'USD'}</Text>
          </Text>
          <View
            style={[
              s.statusPill,
              {
                backgroundColor:
                  STATUS_PILL_BG[bid.status] || STATUS_PILL_BG.submitted,
              },
            ]}
          >
            <Text
              style={[
                s.statusPillText,
                {
                  color:
                    STATUS_PILL_TEXT[bid.status] || STATUS_PILL_TEXT.submitted,
                },
              ]}
            >
              {(bid.status || 'submitted').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Bid Information</Text>
          <View style={s.divider} />
          <DetailRow icon="finger-print" label="Bid ID" value={`#${bid.id}`} />
          <DetailRow
            icon="clipboard"
            label="Job Request"
            value={`#${bid.job_request_id}`}
            onPress={() =>
              navigation.navigate('RequestEstimate', {
                jobId: bid.job_request_id,
              })
            }
          />
          <DetailRow
            icon="checkmark-circle"
            label="Status"
            value={bid.status}
            capitalize
          />
          {bid.timeframe ? (
            <DetailRow icon="time" label="Timeframe" value={bid.timeframe} />
          ) : null}
          {bid.pickup_date ? (
            <DetailRow
              icon="calendar"
              label="Pickup Date"
              value={bid.pickup_date}
            />
          ) : null}
          {bid.created_at ? (
            <DetailRow
              icon="calendar-outline"
              label="Submitted"
              value={new Date(bid.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            />
          ) : null}
        </View>

        {/* Notes */}
        {bid.notes ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>Notes from Contractor</Text>
            <View style={s.divider} />
            <Text style={s.notesText}>{bid.notes}</Text>
          </View>
        ) : null}

        {/* Status confirmations */}
        {bid.status === 'accepted' ? (
          <View
            style={[
              s.statusCard,
              { borderColor: '#A3D9B1', backgroundColor: '#E8F8EC' },
            ]}
          >
            <Ionicons name="checkmark-circle" size={28} color="#155724" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.statusCardTitle, { color: '#155724' }]}>
                Bid Accepted
              </Text>
              <Text style={[s.statusCardSubtitle, { color: '#155724' }]}>
                We'll be in touch to schedule your project. Check the Calendar
                tab for upcoming work.
              </Text>
            </View>
          </View>
        ) : null}

        {bid.status === 'rejected' ? (
          <View
            style={[
              s.statusCard,
              { borderColor: '#F5C6CB', backgroundColor: '#FDECEE' },
            ]}
          >
            <Ionicons name="close-circle" size={28} color="#721C24" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[s.statusCardTitle, { color: '#721C24' }]}>
                Bid Declined
              </Text>
              <Text style={[s.statusCardSubtitle, { color: '#721C24' }]}>
                This bid is no longer active. Check your other bids for this
                project.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Payment note when stripe is wired */}
        {isActionable && paymentReady ? (
          <View style={s.payNote}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.accent} />
            <Text style={s.payNoteText}>
              Payment processed securely by Stripe — Apple Pay, Google Pay &
              cards.
            </Text>
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky action bar */}
      {isActionable ? (
        <View style={s.actionBar}>
          <TouchableOpacity
            style={[s.declineBtn, isRejecting && s.btnDisabled]}
            onPress={handleReject}
            disabled={isAccepting || isRejecting}
            activeOpacity={0.85}
          >
            {isRejecting ? (
              <ActivityIndicator color={COLORS.red || '#DC3545'} />
            ) : (
              <Text style={s.declineBtnText}>Decline</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.acceptBtn, isAccepting && s.btnDisabled]}
            onPress={
              paymentReady ? handleAcceptWithPayment : handleAcceptDirect
            }
            disabled={isAccepting || isRejecting}
            activeOpacity={0.85}
          >
            {isAccepting ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons
                  name={paymentReady ? 'card' : 'checkmark'}
                  size={18}
                  color={COLORS.white}
                />
                <Text style={s.acceptBtnText}>
                  {paymentReady ? 'Accept & Pay' : 'Accept Bid'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function DetailRow({ icon, label, value, capitalize, onPress }) {
  const inner = (
    <View style={s.detailRow}>
      <View style={s.detailLeft}>
        {icon ? <Ionicons name={icon} size={16} color={COLORS.accent} /> : null}
        <Text style={s.detailLabel}>{label}</Text>
      </View>
      <View style={s.detailRight}>
        <Text
          style={[s.detailValue, capitalize && { textTransform: 'capitalize' }]}
        >
          {value}
        </Text>
        {onPress ? (
          <Ionicons
            name="chevron-forward"
            size={14}
            color={COLORS.lightGray}
            style={{ marginLeft: 4 }}
          />
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return inner;
}

const s = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.offWhite,
    padding: 24,
  },
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
  retryBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  retryBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  scroll: { padding: 20 },

  amountHero: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  amountLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  amountValue: {
    fontSize: 42,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 4,
  },
  amountCurrency: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  statusPill: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPillText: { fontWeight: '800', fontSize: 12 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
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
    marginBottom: 12,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  detailRight: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { fontSize: 14, color: COLORS.textLight, marginLeft: 4 },
  detailValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  notesText: { fontSize: 14.5, color: COLORS.darkGray, lineHeight: 22 },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  statusCardTitle: { fontWeight: '700', fontSize: 15 },
  statusCardSubtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },

  payNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.accent + '10',
    borderRadius: 10,
    marginBottom: 12,
  },
  payNoteText: { fontSize: 12, color: COLORS.text, flex: 1 },

  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.red || '#DC3545',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineBtnText: {
    color: COLORS.red || '#DC3545',
    fontWeight: '700',
    fontSize: 15,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },
});
