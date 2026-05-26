/**
 * HomeScreen — Dashboard for the bottom-tab architecture
 * ─────────────────────────────────────────────────────────
 * • Time-aware greeting ("Good morning, Alex")
 * • Live stat cards (Requests, Pending, Bids, Active) backed by global store
 * • Hero CTA card → New Job Request (high-conversion focal point)
 * • Quick Actions — each navigates to a sibling tab + nested screen
 *   using `navigation.navigate('TabName', { screen: 'ScreenName' })`
 * • Recent Activity feed — merges latest jobs + bids, tap to deep-link
 * • Pull-to-refresh with Haptics.Light + parallel fetches
 * • SafeArea-aware paddings; no hardcoded notch math
 *
 * File location: frontend/screens/HomeScreen.js  (replace existing)
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useStore from '../context/useStore';
import { COLORS } from '../styles';

/* ──────────────────────────────────────────────────────────────────────
   Quick action grid configuration.
   Each item declares the TARGET TAB and the nested SCREEN inside it.
   ────────────────────────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  {
    key: 'new-request',
    title: 'New Job Request',
    subtitle: 'Get an instant estimate',
    icon: 'add-circle',
    color: COLORS.accent,
    tab: 'HomeTab',
    screen: 'JobRequest',
  },
  {
    key: 'my-jobs',
    title: 'My Job Requests',
    subtitle: 'Track status and progress',
    icon: 'clipboard',
    color: COLORS.blue || '#3498DB',
    tab: 'JobsTab',
    screen: 'PlacedOrders',
  },
  {
    key: 'my-bids',
    title: 'My Bids',
    subtitle: 'Compare offers from installers',
    icon: 'pricetag',
    color: COLORS.orange || '#E67E22',
    tab: 'BidsTab',
    screen: 'Bids',
  },
  {
    key: 'calendar',
    title: 'Calendar',
    subtitle: 'Scheduled jobs & events',
    icon: 'calendar',
    color: '#8E44AD',
    tab: 'CalendarTab',
    screen: 'Calendar',
  },
  {
    key: 'account',
    title: 'My Account',
    subtitle: 'Profile, settings & support',
    icon: 'person-circle',
    color: COLORS.primaryLight || '#16A085',
    tab: 'AccountTab',
    screen: 'Account',
  },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    user,
    jobRequests,
    bids,
    events,
    fetchJobRequests,
    fetchBids,
    fetchEvents,
  } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  /* Initial load — fire and forget; the store handles its own loading flags */
  useEffect(() => {
    fetchJobRequests().catch(() => {});
    fetchBids().catch(() => {});
    fetchEvents().catch(() => {});
  }, []);

  /* Pull-to-refresh: parallel fetches + light haptic */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    try {
      await Promise.all([fetchJobRequests(), fetchBids(), fetchEvents()]);
    } catch (e) {
      /* errors surface in screens that own those slices */
    }
    setRefreshing(false);
  }, [fetchJobRequests, fetchBids, fetchEvents]);

  /* Derived stats — recomputed only when source arrays change */
  const stats = useMemo(() => {
    const pendingJobs = jobRequests.filter((j) => j.status === 'pending').length;
    const activeBids = bids.filter((b) => b.status === 'submitted').length;
    return { pendingJobs, activeBids };
  }, [jobRequests, bids]);

  /* Time-aware greeting */
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  /* Merged recent activity feed — latest 5 jobs + bids by created_at */
  const recentActivity = useMemo(() => {
    const items = [
      ...jobRequests.slice(0, 5).map((j) => ({
        id: `job-${j.id}`,
        type: 'job',
        title: `Job Request #${j.id}`,
        subtitle: `${
          Array.isArray(j.services) && j.services.length
            ? j.services.join(', ')
            : 'Hardwood services'
        } · ${j.status || 'pending'}`,
        icon: 'clipboard-outline',
        color: COLORS.accent,
        tab: 'JobsTab',
        screen: 'RequestEstimate',
        params: { jobId: j.id },
        date: j.created_at,
      })),
      ...bids.slice(0, 5).map((b) => ({
        id: `bid-${b.id}`,
        type: 'bid',
        title: `Bid $${parseFloat(b.amount || 0).toLocaleString()}`,
        subtitle: `Job #${b.job_request_id} · ${b.status || 'submitted'}`,
        icon: 'pricetag-outline',
        color: COLORS.orange || '#E67E22',
        tab: 'BidsTab',
        screen: 'BidDetail',
        params: { bidId: b.id },
        date: b.created_at,
      })),
    ];
    return items
      .filter((i) => i.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [jobRequests, bids]);

  /* Centralized navigation helper — keeps haptic feedback consistent */
  const goTo = useCallback(
    (tab, screen, params) => {
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      navigation.navigate(tab, screen ? { screen, params } : undefined);
    },
    [navigation]
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View style={{ flexShrink: 1 }}>
            <Text style={s.greeting}>{greeting},</Text>
            <Text style={s.userName} numberOfLines={1}>
              {user?.full_name || user?.username || 'Welcome'}
            </Text>
          </View>
          <TouchableOpacity
            style={s.avatarBtn}
            onPress={() => goTo('AccountTab')}
            activeOpacity={0.7}
          >
            <View style={s.avatarRing}>
              <Ionicons name="person-circle" size={40} color={COLORS.white} />
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.statsRow}>
          <Stat label="Requests" value={jobRequests.length} />
          <Stat label="Pending" value={stats.pendingJobs} highlight />
          <Stat label="Bids" value={bids.length} />
          <Stat label="Active" value={stats.activeBids} highlight />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
            colors={[COLORS.accent]}
          />
        }
      >
        {/* ── Hero CTA ── */}
        <TouchableOpacity
          style={s.ctaCard}
          activeOpacity={0.9}
          onPress={() => goTo('HomeTab', 'JobRequest')}
        >
          <View style={s.ctaTextWrap}>
            <Text style={s.ctaEyebrow}>FREE ESTIMATE</Text>
            <Text style={s.ctaTitle}>Start a new project today</Text>
            <Text style={s.ctaSubtitle}>
              Tell us about your floors — get bids within 24 hours.
            </Text>
            <View style={s.ctaButton}>
              <Text style={s.ctaButtonText}>Begin  →</Text>
            </View>
          </View>
          <View style={s.ctaArt} pointerEvents="none">
            <Ionicons name="leaf" size={84} color="rgba(255,255,255,0.16)" />
          </View>
        </TouchableOpacity>

        {/* ── Quick Actions ── */}
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.actionsGrid}>
          {QUICK_ACTIONS.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={s.actionCard}
              onPress={() => goTo(item.tab, item.screen)}
              activeOpacity={0.7}
            >
              <View
                style={[s.actionIcon, { backgroundColor: item.color + '15' }]}
              >
                <Ionicons name={item.icon} size={26} color={item.color} />
              </View>
              <View style={s.actionTextWrap}>
                <Text style={s.actionTitle}>{item.title}</Text>
                <Text style={s.actionSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.lightGray}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Activity ── */}
        {recentActivity.length > 0 && (
          <>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => goTo('JobsTab', 'PlacedOrders')}>
                <Text style={s.sectionLink}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={s.activityList}>
              {recentActivity.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={s.activityCard}
                  activeOpacity={0.7}
                  onPress={() => goTo(a.tab, a.screen, a.params)}
                >
                  <View
                    style={[
                      s.activityIcon,
                      { backgroundColor: a.color + '15' },
                    ]}
                  >
                    <Ionicons name={a.icon} size={20} color={a.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.activityTitle} numberOfLines={1}>
                      {a.title}
                    </Text>
                    <Text style={s.activitySubtitle} numberOfLines={1}>
                      {a.subtitle}
                    </Text>
                  </View>
                  <Text style={s.activityDate}>
                    {new Date(a.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* ── Upcoming Events teaser (if any) ── */}
        {events.length > 0 && (
          <>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionTitle}>Upcoming on Calendar</Text>
              <TouchableOpacity onPress={() => goTo('CalendarTab', 'Calendar')}>
                <Text style={s.sectionLink}>Open</Text>
              </TouchableOpacity>
            </View>
            <View style={s.activityList}>
              {events
                .filter((e) => e.start_date)
                .sort((a, b) => a.start_date.localeCompare(b.start_date))
                .slice(0, 3)
                .map((e) => (
                  <TouchableOpacity
                    key={`event-${e.id}`}
                    style={s.activityCard}
                    activeOpacity={0.7}
                    onPress={() => goTo('CalendarTab', 'Calendar')}
                  >
                    <View
                      style={[
                        s.activityIcon,
                        { backgroundColor: '#8E44AD15' },
                      ]}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color="#8E44AD"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.activityTitle} numberOfLines={1}>
                        {e.title || 'Event'}
                      </Text>
                      <Text style={s.activitySubtitle} numberOfLines={1}>
                        {e.event_type || 'event'} · {e.start_date}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <View style={[s.statCard, highlight && s.statCardHighlight]}>
      <Text style={[s.statNumber, highlight && { color: COLORS.white }]}>
        {value ?? 0}
      </Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.offWhite },

  /* Header */
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.65)' },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.white,
    maxWidth: 240,
    marginTop: 2,
  },
  avatarBtn: { padding: 2 },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Stats */
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statCardHighlight: { backgroundColor: 'rgba(255,255,255,0.22)' },
  statNumber: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  /* Scroll body */
  scrollContent: { padding: 20 },

  /* CTA */
  ctaCard: {
    backgroundColor: COLORS.accent,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  ctaTextWrap: { flex: 1, zIndex: 2 },
  ctaEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 6,
  },
  ctaSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 14,
    lineHeight: 18,
  },
  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  ctaButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  ctaArt: { position: 'absolute', right: -8, bottom: -8 },

  /* Section headers */
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionLink: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.accent,
  },

  /* Quick actions */
  actionsGrid: { marginBottom: 24 },
  actionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionTextWrap: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  actionSubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },

  /* Activity list */
  activityList: { marginBottom: 24 },
  activityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  activitySubtitle: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  activityDate: {
    fontSize: 11,
    color: COLORS.textLight,
    marginLeft: 8,
    fontWeight: '600',
  },
});
