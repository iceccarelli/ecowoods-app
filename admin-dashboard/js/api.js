/**
 * EcoWoods Admin Dashboard - API Client
 * Handles all communication with the backend REST API.
 */

const API = (() => {
    // Base URL is relative so it works when served by FastAPI
    const BASE = '/api/v1';
    let token = localStorage.getItem('ecowoods_token') || null;

    function setToken(t) {
        token = t;
        if (t) {
            localStorage.setItem('ecowoods_token', t);
        } else {
            localStorage.removeItem('ecowoods_token');
        }
    }

    function getToken() {
        return token;
    }

    async function request(method, path, body = null) {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const opts = { method, headers };
        if (body && method !== 'GET') {
            opts.body = JSON.stringify(body);
        }

        const res = await fetch(`${BASE}${path}`, opts);

        if (res.status === 204) return null;

        const data = await res.json().catch(() => null);

        if (!res.ok) {
            const msg = data?.detail || `Request failed (${res.status})`;
            throw new Error(msg);
        }
        return data;
    }

    // Auth
    async function login(username, password) {
        const data = await request('POST', '/auth/login', { username, password });
        setToken(data.access_token);
        return data;
    }

    function logout() {
        setToken(null);
    }

    async function getMe() {
        return request('GET', '/auth/me');
    }

    // Users
    async function listUsers() {
        return request('GET', '/users/');
    }

    async function getUser(id) {
        return request('GET', `/users/${id}`);
    }

    async function updateUser(id, data) {
        return request('PUT', `/users/${id}`, data);
    }

    async function deleteUser(id) {
        return request('DELETE', `/users/${id}`);
    }

    // Job Requests
    async function listJobRequests(statusFilter = '') {
        const qs = statusFilter ? `?status=${statusFilter}` : '';
        return request('GET', `/job-requests/${qs}`);
    }

    async function getJobRequest(id) {
        return request('GET', `/job-requests/${id}`);
    }

    async function updateJobRequest(id, data) {
        return request('PUT', `/job-requests/${id}`, data);
    }

    async function deleteJobRequest(id) {
        return request('DELETE', `/job-requests/${id}`);
    }

    // Bids
    async function listBids(jobRequestId = null) {
        const qs = jobRequestId ? `?job_request_id=${jobRequestId}` : '';
        return request('GET', `/bids/${qs}`);
    }

    async function createBid(data) {
        return request('POST', '/bids/', data);
    }

    async function updateBid(id, data) {
        return request('PUT', `/bids/${id}`, data);
    }

    async function deleteBid(id) {
        return request('DELETE', `/bids/${id}`);
    }

    // Calendar Events
    async function listEvents(startDate = '', endDate = '') {
        let qs = '';
        const params = [];
        if (startDate) params.push(`start_date=${startDate}`);
        if (endDate) params.push(`end_date=${endDate}`);
        if (params.length) qs = '?' + params.join('&');
        return request('GET', `/calendar/${qs}`);
    }

    async function createEvent(data) {
        return request('POST', '/calendar/', data);
    }

    async function updateEvent(id, data) {
        return request('PUT', `/calendar/${id}`, data);
    }

    async function deleteEvent(id) {
        return request('DELETE', `/calendar/${id}`);
    }

    return {
        setToken, getToken, login, logout, getMe,
        listUsers, getUser, updateUser, deleteUser,
        listJobRequests, getJobRequest, updateJobRequest, deleteJobRequest,
        listBids, createBid, updateBid, deleteBid,
        listEvents, createEvent, updateEvent, deleteEvent,
    };
})();
