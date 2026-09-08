// src/services/apiClient.js
import axios from "axios";
import { setupCache } from "axios-cache-interceptor";

const apiUrl = document.querySelector('meta[name="api-url"]')?.content || '/api';

// Create base axios instance
const api = axios.create({
  baseURL: apiUrl,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("fcms_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("fcms_token");
      localStorage.removeItem("fcms_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ✅ Add cache interceptor for GET requests
const cachedApi = setupCache(api, {
  ttl: 5 * 60 * 1000, // 5 minutes cache
  methods: ["get"],
  cachePredicate: {
    statusCheck: (status) => status >= 200 && status < 300,
  },
});

// ✅ Create a separate instance for POST/PUT/DELETE (no cache)
const uncachedApi = api;

export { cachedApi, uncachedApi };
export default cachedApi;