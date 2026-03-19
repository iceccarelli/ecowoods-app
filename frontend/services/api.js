/**
 * EcoWoods API Service
 * Centralized API client for the React Native frontend.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your backend URL
const API_BASE_URL = 'http://localhost:8000/api/v1';

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

    // ===== Auth =====
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

    // ===== Users =====
    async updateUser(userId, data) {
        return this.request('PUT', `/users/${userId}`, data);
    }

    // ===== Job Requests =====
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

    // ===== Bids =====
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

    // ===== Calendar Events =====
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
}

const api = new ApiService();
export default api;
