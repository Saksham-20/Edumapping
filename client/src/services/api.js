// client/src/services/api.js
import axios from 'axios';
import authService from './auth';
import toast from 'react-hot-toast';

// Use environment variable for API URL. In dev with proxy, use relative /api so proxy forwards to backend.
const API_BASE_URL = process.env.REACT_APP_API_URL 
  || (process.env.NODE_ENV === 'development' ? '/api' : '/api');

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = authService.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh and error handling
api.interceptors.response.use(
  (response) => {
    // Return the data directly for easier consumption
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Endpoints where a 401 is the answer, not an expired session.
    //
    // A failed sign-in returns 401, and so does a refresh with a dead refresh
    // token. Treating those as "the access token expired" sent the interceptor
    // off to refresh, fail, clear the tokens and hard-redirect to /login —
    // which discarded the error before the login form's own catch could read
    // it. The user typed a wrong password and got a silently reloaded, blank
    // login page with no message at all.
    const url = originalRequest?.url || '';
    const isAuthChallenge = /\/auth\/(login|register|refresh)\b/.test(url);

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthChallenge) {
      originalRequest._retry = true;

      try {
        const newTokens = await authService.refreshTokens();
        originalRequest.headers.Authorization = `Bearer ${newTokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        authService.clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle other errors
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        'An unexpected error occurred';

    // Don't show toast for certain errors.
    // A caller can also opt out per request with `{ silent: true }` — the
    // public landing page handles its own failures and must never throw an
    // error toast at a logged-out visitor who is just reading the page.
    const silentErrors = [401, 403];
    if (!silentErrors.includes(error.response?.status) && !error.config?.silent) {
      toast.error(errorMessage);
    }

    // Reject with a real Error that carries BOTH shapes.
    //
    // This used to be a bare object with only `message`/`status`/`data`, so
    // every `err.response?.data?.message` in the app — the idiomatic axios
    // read, used in a dozen places — silently evaluated to undefined and the
    // caller fell back to a generic string. Attaching the original `response`
    // makes those work without having to rewrite each call site, and an Error
    // subclass keeps a stack for anything that logs it.
    const wrapped = new Error(errorMessage);
    wrapped.status = error.response?.status;
    wrapped.data = error.response?.data;
    wrapped.response = error.response;
    wrapped.config = error.config;
    return Promise.reject(wrapped);
  }
);

export default api;