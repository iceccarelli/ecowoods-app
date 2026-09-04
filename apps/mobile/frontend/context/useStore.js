/**
 * Ecowoods Global State Store (Zustand) — v4.0 Production
 * ─────────────────────────────────────────────────────────────────────
 * Single source of truth for the React Native app. Designed to stay
 * in lock-step with the Next.js website via the /shared folder
 * (types + API contract).
 *
 * What's new in v4.0:
 *  ✓ Real-time sync over Socket.io (job:updated, bid:created/updated, event:created)
 *  ✓ Expo Push Notifications token registration & backend handshake
 *  ✓ Optimistic updates for createJobRequest / createBid / createEvent
 *  ✓ Per-resource loading + error flags (jobRequestsLoading, bidsError, …)
 *  ✓ acceptBid action — kicks off the Stripe / Calendar flow
 *  ✓ refreshAll() for AppState foreground refresh + pull-to-refresh
 *  ✓ Storage migration scaffolding (version 2)
 *  ✓ Defensive logout — never strands the user in a broken state
 *
 * File location: frontend/context/useStore.js  (replace existing)
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { io } from 'socket.io-client';
import api from '../services/api';

// Shared types (single source of truth across web + mobile).
// These imports are runtime no-ops in JS; TS picks them up.
import { Job, Bid, User, Lead } from '../../shared';

/* ──────────────────────────────────────────────────────────────────────
   Socket.io singleton — lives outside zustand state so we don't try to
   serialize it. Re-created lazily after logout.
   ────────────────────────────────────────────────────────────────────── */
let socket = null;

function resolveWsUrl() {
  // Priority: env var → Expo config extra → API base → fallback
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL;
  }
  try {
    // Lazy require so this file works in test environments without Expo
    const Constants = require('expo-constants').default;
    const fromExtra = Constants?.expoConfig?.extra?.wsUrl;
    if (fromExtra) return fromExtra;
  } catch (e) {}
  if (api?.baseUrl) return api.baseUrl;
  return 'https://api.ecowoods.ca';
}

function getSocket(token) {
  if (socket) return socket;
  socket = io(resolveWsUrl(), {
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 10000,
    timeout: 20000,
  });
  return socket;
}

/* ──────────────────────────────────────────────────────────────────────
   Store
   ────────────────────────────────────────────────────────────────────── */
const useStore = create(
  persist(
    (set, get) => ({
      /* =================================================================
         AUTH
         ================================================================= */
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      pushToken: null,

      initAuth: async () => {
        try {
          await api.init();
          if (api.token) {
            const user = await api.getMe();
            set({
              user,
              token: api.token,
              isAuthenticated: true,
              isLoading: false,
            });
            get().connectRealtime();
          } else {
            set({ isLoading: false });
          }
        } catch (e) {
          try {
            await api.logout();
          } catch (_) {}
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            jobRequests: [],
            bids: [],
            events: [],
            pushToken: null,
          });
        }
      },

      login: async (username, password) => {
        const data = await api.login(username, password);
        set({
          user: data.user,
          token: data.access_token,
          isAuthenticated: true,
        });
        // Kick off side-effects but don't block the navigation
        get().connectRealtime();
        get().registerPushToken().catch(() => {});
        get().refreshAll().catch(() => {});
        return data;
      },

      register: async (username, password, email, fullName) => {
        return api.register(username, password, email, fullName);
      },

      logout: async () => {
        try {
          await api.logout();
        } catch (e) {}
        get().disconnectRealtime();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          jobRequests: [],
          bids: [],
          events: [],
          pushToken: null,
        });
      },

      /* =================================================================
         PUSH NOTIFICATIONS (Expo)
         ================================================================= */
      registerPushToken: async () => {
        try {
          if (Platform.OS === 'web') return null;

          const { status: existing } = await Notifications.getPermissionsAsync();
          let finalStatus = existing;
          if (existing !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus !== 'granted') return null;

          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
              name: 'Ecowoods',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#0A3D2E',
              sound: 'default',
            });
          }

          const tokenResult = await Notifications.getExpoPushTokenAsync();
          const token = tokenResult?.data;
          if (!token) return null;

          set({ pushToken: token });

          // Best-effort: tell the backend so it can target this device
          try {
            if (api.registerPushToken) {
              await api.registerPushToken(token);
            }
          } catch (e) {}

          return token;
        } catch (e) {
          return null;
        }
      },

      /* =================================================================
         REAL-TIME (Socket.io)
         ================================================================= */
      connectRealtime: () => {
        const { token } = get();
        if (!token) return;
        const s = getSocket(token);

        // Reset listeners so we don't double-subscribe across reconnects
        s.off('connect');
        s.off('disconnect');
        s.off('job:updated');
        s.off('bid:created');
        s.off('bid:updated');
        s.off('event:created');

        s.on('job:updated', (job) => {
          if (!job?.id) return;
          const { jobRequests } = get();
          set({
            jobRequests: jobRequests.map((j) =>
              j.id === job.id ? { ...j, ...job } : j
            ),
          });
        });

        s.on('bid:created', (bid) => {
          if (!bid?.id) return;
          const { bids } = get();
          if (!bids.find((b) => b.id === bid.id)) {
            set({ bids: [bid, ...bids] });
          }
        });

        s.on('bid:updated', (bid) => {
          if (!bid?.id) return;
          const { bids } = get();
          set({
            bids: bids.map((b) => (b.id === bid.id ? { ...b, ...bid } : b)),
          });
        });

        s.on('event:created', (ev) => {
          if (!ev?.id) return;
          const { events } = get();
          if (!events.find((e) => e.id === ev.id)) {
            set({ events: [ev, ...events] });
          }
        });

        if (!s.connected) s.connect();
      },

      disconnectRealtime: () => {
        if (!socket) return;
        try {
          socket.removeAllListeners();
          socket.disconnect();
        } catch (e) {}
        socket = null;
      },

      /* =================================================================
         JOB REQUESTS
         ================================================================= */
      jobRequests: [],
      jobRequestsLoading: false,
      jobRequestsError: null,

      fetchJobRequests: async () => {
        set({ jobRequestsLoading: true, jobRequestsError: null });
        try {
          const data = await api.listJobRequests();
          set({
            jobRequests: Array.isArray(data) ? data : [],
            jobRequestsLoading: false,
          });
        } catch (e) {
          set({
            jobRequestsLoading: false,
            jobRequestsError: e?.message || 'Failed to load job requests',
          });
          throw e;
        }
      },

      createJobRequest: async (requestData) => {
        // Optimistic insert
        const tempId = `tmp-${Date.now()}`;
        const optimistic = {
          id: tempId,
          status: 'pending',
          created_at: new Date().toISOString(),
          ...requestData,
          __optimistic: true,
        };
        set({ jobRequests: [optimistic, ...get().jobRequests] });
        try {
          const result = await api.createJobRequest(requestData);
          set({
            jobRequests: [
              result,
              ...get().jobRequests.filter((j) => j.id !== tempId),
            ],
          });
          return result;
        } catch (e) {
          // Roll back
          set({
            jobRequests: get().jobRequests.filter((j) => j.id !== tempId),
          });
          throw e;
        }
      },

      /* =================================================================
         BIDS
         ================================================================= */
      bids: [],
      bidsLoading: false,
      bidsError: null,

      fetchBids: async (jobRequestId = null) => {
        set({ bidsLoading: true, bidsError: null });
        try {
          const data = await api.listBids(jobRequestId);
          set({
            bids: Array.isArray(data) ? data : [],
            bidsLoading: false,
          });
        } catch (e) {
          set({
            bidsLoading: false,
            bidsError: e?.message || 'Failed to load bids',
          });
          throw e;
        }
      },

      createBid: async (bidData) => {
        const tempId = `tmp-${Date.now()}`;
        const optimistic = {
          id: tempId,
          status: 'submitted',
          created_at: new Date().toISOString(),
          ...bidData,
          __optimistic: true,
        };
        set({ bids: [optimistic, ...get().bids] });
        try {
          const result = await api.createBid(bidData);
          set({
            bids: [result, ...get().bids.filter((b) => b.id !== tempId)],
          });
          return result;
        } catch (e) {
          set({ bids: get().bids.filter((b) => b.id !== tempId) });
          throw e;
        }
      },

      acceptBid: async (bidId) => {
        if (!api.acceptBid) return null;
        // Optimistic status flip
        const previous = get().bids;
        set({
          bids: previous.map((b) =>
            b.id === bidId ? { ...b, status: 'accepted' } : b
          ),
        });
        try {
          const result = await api.acceptBid(bidId);
          if (result) {
            set({
              bids: get().bids.map((b) =>
                b.id === bidId ? { ...b, ...result } : b
              ),
            });
          }
          return result;
        } catch (e) {
          // Rollback
          set({ bids: previous });
          throw e;
        }
      },

      rejectBid: async (bidId) => {
        if (!api.rejectBid) return null;
        const previous = get().bids;
        set({
          bids: previous.map((b) =>
            b.id === bidId ? { ...b, status: 'rejected' } : b
          ),
        });
        try {
          const result = await api.rejectBid(bidId);
          if (result) {
            set({
              bids: get().bids.map((b) =>
                b.id === bidId ? { ...b, ...result } : b
              ),
            });
          }
          return result;
        } catch (e) {
          set({ bids: previous });
          throw e;
        }
      },

      /* =================================================================
         CALENDAR EVENTS
         ================================================================= */
      events: [],
      eventsLoading: false,
      eventsError: null,

      fetchEvents: async () => {
        set({ eventsLoading: true, eventsError: null });
        try {
          const data = await api.listEvents();
          set({
            events: Array.isArray(data) ? data : [],
            eventsLoading: false,
          });
        } catch (e) {
          set({
            eventsLoading: false,
            eventsError: e?.message || 'Failed to load events',
          });
          throw e;
        }
      },

      createEvent: async (eventData) => {
        const tempId = `tmp-${Date.now()}`;
        const optimistic = {
          id: tempId,
          created_at: new Date().toISOString(),
          ...eventData,
          __optimistic: true,
        };
        set({ events: [optimistic, ...get().events] });
        try {
          const result = await api.createEvent(eventData);
          set({
            events: [result, ...get().events.filter((e) => e.id !== tempId)],
          });
          return result;
        } catch (e) {
          set({ events: get().events.filter((ev) => ev.id !== tempId) });
          throw e;
        }
      },

      /* =================================================================
         WEBSITE PARITY — Shared lead submission endpoint
         ================================================================= */
      submitLead: async (leadData) => {
        if (!api.submitLeadShared) return null;
        return api.submitLeadShared(leadData);
      },

      /* =================================================================
         REFRESH ALL — used by pull-to-refresh + AppState foreground
         ================================================================= */
      refreshAll: async () => {
        await Promise.allSettled([
          get().fetchJobRequests(),
          get().fetchBids(),
          get().fetchEvents(),
        ]);
      },
    }),
    {
      name: 'ecowoods-storage',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist auth + push token; everything else hydrates on launch
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        pushToken: state.pushToken,
      }),
      migrate: (persistedState, version) => {
        // Future-proofing — add migrations here as schemas evolve
        if (!persistedState) return persistedState;
        if (version < 2) {
          return {
            ...persistedState,
            pushToken: persistedState.pushToken ?? null,
          };
        }
        return persistedState;
      },
    }
  )
);

export default useStore;
