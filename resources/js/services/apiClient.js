// src/services/apiClient.js
import axios from "axios";

const apiUrl = document.querySelector('meta[name="api-url"]')?.content || '/api';

const api = axios.create({
  baseURL: apiUrl,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

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

// Both "cached" and "uncached" are the same now — React Query handles caching
const cachedApi = api;
const uncachedApi = api;

export { cachedApi, uncachedApi };
export default cachedApi;