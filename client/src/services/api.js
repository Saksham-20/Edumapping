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

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
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

    // Don't show toast for certain errors
    const silentErrors = [401, 403];
    if (!silentErrors.includes(error.response?.status)) {
      toast.error(errorMessage);
    }

    return Promise.reject({
      message: errorMessage,
      status: error.response?.status,
      data: error.response?.data
    });
  }
);

export default api;