/**
 * EcoWoods API Service (Production-Grade)
 * 
 * This is the SINGLE source of truth for all API calls from the React Native app.
 * It now perfectly integrates with the shared/ layer for maximum consistency
 * with the Next.js website and the FastAPI backend.
 * 
 * Features:
 * - Uses shared TypeScript types (Lead, Job, Bid, User, etc.)
 * - Centralized error handling
 * - Token management with AsyncStorage
 * - Full support for Job Requests, Bids, Calendar, Auth
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Import shared types for perfect consistency with website
import {
  Lead,
  Job,
  Bid,
  User,
  LeadResponse,
  JobCreateInput,
  BidCreateInput,
} from '../../shared';

// Change this to your production backend URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const TOKEN_KEY = 'ecowoods_auth_token';
const USER_KEY = 'ecowoods_user';

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL;
        this.token = null;
    }

    async init() {
        try {
            this.token = await AsyncStorage.getItem(TOKEN_KEY);
        } catch (e) {
            console.warn('Failed to load token from storage');
        }
    }

    async setToken(token) {
        this.token = token;
        if (token) {
            await AsyncStorage.setItem(TOKEN_KEY, token);
        } else {
            await AsyncStorage.removeItem(TOKEN_KEY);
        }
    }

    async setUser(user) {
        if (user) {
            await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        } else {
            await AsyncStorage.removeItem(USER_KEY);
        }
    }

    async getStoredUser() {
        try {
            const data = await AsyncStorage.getItem(USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(method, path, body = null) {
        const opts = {
            method,
            headers: this.getHeaders(),
        };
        if (body && method !== 'GET') {
            opts.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${this.baseUrl}${path}`, opts);

            if (response.status === 204) return null;

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || `Request failed (${response.status})`);
            }

            return data;
        } catch (error) {
            if (error.message === 'Network request failed') {
                throw new Error('Cannot connect to server. Please check your connection.');
            }
            throw error;
        }
    }

    // ===== AUTH =====
    async login(username, password) {
        const data = await this.request('POST', '/auth/login', { username, password });
        await this.setToken(data.access_token);
        await this.setUser(data.user);
        return data;
    }

    async register(username, password, email, fullName) {
        const body = { username, password };
        if (email) body.email = email;
        if (fullName) body.full_name = fullName;
        return this.request('POST', '/auth/register', body);
    }

    async logout() {
        await this.setToken(null);
        await this.setUser(null);
    }

    async getMe() {
        return this.request('GET', '/auth/me');
    }

    // ===== USERS =====
    async updateUser(userId, data) {
        return this.request('PUT', `/users/${userId}`, data);
    }

    // ===== JOB REQUESTS (using shared types) =====
    /**
     * Create a new job request (Lead → Job flow)
     * @param {JobCreateInput} data 
     */
    async createJobRequest(data) {
        return this.request('POST', '/job-requests/', data);
    }

    async listJobRequests(status = '') {
        const qs = status ? `?status=${status}` : '';
        return this.request('GET', `/job-requests/${qs}`);
    }

    async getJobRequest(id) {
        return this.request('GET', `/job-requests/${id}`);
    }

    async updateJobRequest(id, data) {
        return this.request('PUT', `/job-requests/${id}`, data);
    }

    async deleteJobRequest(id) {
        return this.request('DELETE', `/job-requests/${id}`);
    }

    // ===== BIDS (using shared types) =====
    /**
     * Create a bid on a job
     * @param {BidCreateInput} data 
     */
    async createBid(data) {
        return this.request('POST', '/bids/', data);
    }

    async listBids(jobRequestId = null) {
        const qs = jobRequestId ? `?job_request_id=${jobRequestId}` : '';
        return this.request('GET', `/bids/${qs}`);
    }

    async getBid(id) {
        return this.request('GET', `/bids/${id}`);
    }

    async updateBid(id, data) {
        return this.request('PUT', `/bids/${id}`, data);
    }

    // ===== CALENDAR EVENTS =====
    async createEvent(data) {
        return this.request('POST', '/calendar/', data);
    }

    async listEvents(startDate = '', endDate = '') {
        const params = [];
        if (startDate) params.push(`start_date=${startDate}`);
        if (endDate) params.push(`end_date=${endDate}`);
        const qs = params.length ? `?${params.join('&')}` : '';
        return this.request('GET', `/calendar/${qs}`);
    }

    async deleteEvent(id) {
        return this.request('DELETE', `/calendar/${id}`);
    }

    // ===== SHARED LAYER INTEGRATION (New - for perfect consistency with website) =====
    /**
     * Submit lead using shared types (used by both web and mobile)
     */
    async submitLeadShared(leadData) {
        // This calls the same endpoint the website uses
        return this.request('POST', '/leads/', leadData);
    }
}

const api = new ApiService();
export default api;
