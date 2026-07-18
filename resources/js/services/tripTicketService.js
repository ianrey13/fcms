// src/services/tripTicketService.js
import api from './api';

const tripTicketService = {
  // Create draft ticket
  createDraft: async (data) => {
    const response = await api.post('/trip-tickets/draft', data);
    return response.data;
  },
  
  // Submit ticket for review
  submitTicket: async (data) => {
    const response = await api.post('/trip-tickets/submit', data);
    return response.data;
  },
  
  // Get user's tickets
  getMyTickets: async (params) => {
    const response = await api.get('/trip-tickets/my-requests', { params });
    return response.data;
  },
  
  // Get single ticket
  getTicketById: async (id) => {
    const response = await api.get(`/trip-tickets/${id}`);
    return response.data;
  },
  
  // Update draft
  updateDraft: async (id, data) => {
    const response = await api.put(`/trip-tickets/${id}/draft`, data);
    return response.data;
  },
  
  // Cancel ticket
  cancelTicket: async (id, reason) => {
    const response = await api.post(`/trip-tickets/${id}/cancel`, { reason });
    return response.data;
  },
  
  // Get available vehicles
  getAvailableVehicles: async (params) => {
    const response = await api.get('/vehicles/available', { params });
    return response.data;
  },
  
  // Get active drivers
  getActiveDrivers: async (params) => {
    const response = await api.get('/drivers/active', { params });
    return response.data;
  }
};

export default tripTicketService;