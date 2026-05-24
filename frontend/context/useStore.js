/**
 * EcoWoods Global State Store (Zustand) — v3.0 Production Ready
 * Perfect sync between React Native app and Next.js website
 * All shared types imported from /shared for zero drift
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

// Shared types for maximum consistency
import { Job, Bid, User, Lead, Event } from '../../shared';

const useStore = create(
  persist(
    (set, get) => ({
      // ==================== AUTH ====================
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      initAuth: async () => {
        try {
          await api.init();
          if (api.token) {
            const user = await api.getMe();
            set({ user, token: api.token, isAuthenticated: true, isLoading: false });
          } else {
            set({ isLoading: false });
          }
        } catch (e) {
          await api.logout();
          set({ 
            user: null, token: null, isAuthenticated: false, isLoading: false,
            jobRequests: [], bids: [], events: []
          });
        }
      },

      login: async (username, password) => {
        const data = await api.login(username, password);
        set({ user: data.user, token: data.access_token, isAuthenticated: true });
        return data;
      },

      register: async (username, password, email, fullName) => {
        return api.register(username, password, email, fullName);
      },

      logout: async () => {
        await api.logout();
        set({ 
          user: null, token: null, isAuthenticated: false, 
          jobRequests: [], bids: [], events: [] 
        });
      },

      // ==================== JOB REQUESTS ====================
      jobRequests: [],
      jobRequestsLoading: false,

      fetchJobRequests: async () => {
        set({ jobRequestsLoading: true });
        try {
          const data = await api.listJobRequests();
          set({ jobRequests: Array.isArray(data) ? data : [], jobRequestsLoading: false });
        } catch (e) {
          set({ jobRequestsLoading: false });
          throw e;
        }
      },

      createJobRequest: async (requestData) => {
        const result = await api.createJobRequest(requestData);
        const { jobRequests } = get();
        set({ jobRequests: [result, ...(jobRequests || [])] });
        return result;
      },

      // ==================== BIDS ====================
      bids: [],
      bidsLoading: false,

      fetchBids: async (jobRequestId = null) => {
        set({ bidsLoading: true });
        try {
          const data = await api.listBids(jobRequestId);
          set({ bids: Array.isArray(data) ? data : [], bidsLoading: false });
        } catch (e) {
          set({ bidsLoading: false });
          throw e;
        }
      },

      createBid: async (bidData) => {
        const result = await api.createBid(bidData);
        const { bids } = get();
        set({ bids: [result, ...(bids || [])] });
        return result;
      },

      // ==================== CALENDAR EVENTS ====================
      events: [],
      eventsLoading: false,

      fetchEvents: async () => {
        set({ eventsLoading: true });
        try {
          const data = await api.listEvents();
          set({ events: Array.isArray(data) ? data : [], eventsLoading: false });
        } catch (e) {
          set({ eventsLoading: false });
          throw e;
        }
      },

      createEvent: async (eventData) => {
        const result = await api.createEvent(eventData);
        const { events } = get();
        set({ events: [result, ...(events || [])] });
        return result;
      },

      // ==================== SHARED API METHODS (FIXES ALL "undefined" ERRORS) ====================
      getJobRequest: async (id) => {
        try {
          if (!id) return null;
          const data = await api.getJobRequest(id);
          return data;
        } catch (e) {
          console.warn('getJobRequest failed:', e.message);
          return null;
        }
      },

      getBid: async (id) => {
        try {
          if (!id) return null;
          const data = await api.getBid(id);
          return data;
        } catch (e) {
          console.warn('getBid failed:', e.message);
          return null;
        }
      },

      // ==================== LEAD SUBMISSION (Website Sync) ====================
      submitLead: async (leadData) => {
        return api.submitLeadShared(leadData);
      },
    }),
    {
      name: 'ecowoods-storage-v3',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useStore;
