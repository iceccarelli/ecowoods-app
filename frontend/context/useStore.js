/**
 * EcoWoods Global State Store (Zustand)
 * 
 * This store is now fully integrated with the shared/ layer for perfect
 * consistency between the React Native app and the Next.js website.
 * 
 * All types (Job, Bid, User, Lead) come from the shared folder.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

// Import shared types for maximum consistency
import {
  Job,
  Bid,
  User,
  Lead,
} from '../../shared';

const useStore = create(
  persist(
    (set, get) => ({
      // ===== AUTH STATE =====
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      initAuth: async () => {
        try {
          await api.init();
          if (api.token) {
            const user = await api.getMe();
            set({ 
              user, 
              token: api.token, 
              isAuthenticated: true, 
              isLoading: false 
            });
          } else {
            set({ isLoading: false });
          }
        } catch (e) {
          await api.logout();
          set({ 
            user: null, 
            token: null, 
            isAuthenticated: false, 
            isLoading: false,
            jobRequests: [],
            bids: [],
            events: []
          });
        }
      },

      login: async (username, password) => {
        const data = await api.login(username, password);
        set({ 
          user: data.user, 
          token: data.access_token, 
          isAuthenticated: true 
        });
        return data;
      },

      register: async (username, password, email, fullName) => {
        return api.register(username, password, email, fullName);
      },

      logout: async () => {
        await api.logout();
        set({ 
          user: null, 
          token: null, 
          isAuthenticated: false, 
          jobRequests: [], 
          bids: [], 
          events: [] 
        });
      },

      // ===== JOB REQUESTS (typed with shared Job type) =====
      jobRequests: [],
      jobRequestsLoading: false,

      fetchJobRequests: async () => {
        set({ jobRequestsLoading: true });
        try {
          const data = await api.listJobRequests();
          set({ jobRequests: data, jobRequestsLoading: false });
        } catch (e) {
          set({ jobRequestsLoading: false });
          throw e;
        }
      },

      createJobRequest: async (requestData) => {
        const result = await api.createJobRequest(requestData);
        const { jobRequests } = get();
        set({ jobRequests: [result, ...jobRequests] });
        return result;
      },

      // ===== BIDS (typed with shared Bid type) =====
      bids: [],
      bidsLoading: false,

      fetchBids: async (jobRequestId = null) => {
        set({ bidsLoading: true });
        try {
          const data = await api.listBids(jobRequestId);
          set({ bids: data, bidsLoading: false });
        } catch (e) {
          set({ bidsLoading: false });
          throw e;
        }
      },

      createBid: async (bidData) => {
        const result = await api.createBid(bidData);
        const { bids } = get();
        set({ bids: [result, ...bids] });
        return result;
      },

      // ===== CALENDAR EVENTS =====
      events: [],
      eventsLoading: false,

      fetchEvents: async () => {
        set({ eventsLoading: true });
        try {
          const data = await api.listEvents();
          set({ events: data, eventsLoading: false });
        } catch (e) {
          set({ eventsLoading: false });
          throw e;
        }
      },

      createEvent: async (eventData) => {
        const result = await api.createEvent(eventData);
        const { events } = get();
        set({ events: [result, ...events] });
        return result;
      },

      // ===== SHARED LEAD SUBMISSION (New - for website consistency) =====
      submitLead: async (leadData) => {
        return api.submitLeadShared(leadData);
      },
    }),
    {
      name: 'ecowoods-storage',
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
