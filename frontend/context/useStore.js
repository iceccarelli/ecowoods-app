/**
 * EcoWoods Global State Store (Zustand)
 * Manages auth state, job requests, bids, and calendar events.
 */

import { create } from 'zustand';
import api from '../services/api';

const useStore = create((set, get) => ({
    // ===== Auth State =====
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
            set({ user: null, token: null, isAuthenticated: false, isLoading: false });
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
        set({ user: null, token: null, isAuthenticated: false, jobRequests: [], bids: [], events: [] });
    },

    // ===== Job Requests =====
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

    // ===== Bids =====
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

    // ===== Calendar Events =====
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
}));

export default useStore;
