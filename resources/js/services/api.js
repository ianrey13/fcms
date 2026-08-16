import axios from "axios";

// Get API URL from Laravel meta tag (no more VITE env needed!)
const apiUrl = document.querySelector('meta[name="api-url"]')?.content || '/api';

const api = axios.create({
  baseURL: apiUrl,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("fcms_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("fcms_token");
      localStorage.removeItem("fcms_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// ============ AUTH API ============
export const authAPI = {
  login: (email, password, deviceName = "web") =>
    api.post("/auth/login", { email, password, device_name: deviceName }),

  logout: () => api.post("/auth/logout"),

  getMe: () => api.get("/auth/me"),

  changePassword: (currentPassword, newPassword) =>
    api.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPassword,
    }),

  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),

  resetPassword: (email, token, password) =>
    api.post("/auth/reset-password", {
      email,
      token,
      password,
      password_confirmation: password,
    }),
    
  updateProfile: (data) => api.post("/auth/update-profile", data),
};

// ============ TRIP TICKET API ============
export const tripTicketAPI = {
  getAll: (params) => api.get("/trip-tickets", { params }),
  getById: (id) => api.get(`/trip-tickets/${id}`),
  create: (data) => api.post("/trip-tickets", data),
  update: (id, data) => api.put(`/trip-tickets/${id}`, data),
  delete: (id) => api.delete(`/trip-tickets/${id}`),
  cancel: (id, reason) => api.post(`/trip-tickets/${id}/cancel`, { reason }),
  getMyRequests: (params) => api.get("/trip-tickets/my-requests", { params }),
  checkBudgetBeforeSubmit: (data) =>
    api.post("/trip-tickets/check-budget", data),
};

// ============ GSO API ============
export const gsoAPI = {
  // Dashboard
  getDashboard: () => api.get("/gso/dashboard"),

  // Trip Management
  getPendingMO: (params) => api.get("/gso/pending", { params }),
  getReturnedTickets: (params) => api.get("/gso/returned", { params }),
  getAllTrips: (params) => api.get("/gso/all-trips", { params }),
  getTicketById: (id) => api.get(`/gso/tickets/${id}`),

  // GSO Creates Trip Directly
  createTrip: (data) => api.post("/gso/create-trip", data),

  // Reconciliation
  getPendingReconciliation: (params) =>
    api.get("/gso/pending-reconciliation", { params }),
  reconcileTrip: (id, data) =>
    api.post(`/gso/tickets/${id}/reconcile`, data),

  // Reports
  getReports: (params) => api.get("/gso/reports", { params }),
  exportReport: (type, params) =>
    api.get(`/gso/reports/export/${type}`, { params, responseType: "blob" }),
    
  // Signature for GSO
  getSignature: (id) => api.get(`/gso/users/${id}/signature`),

  // Fuel Receipts
  getFuelReceipts: (params) => api.get("/admin/fuel-receipts", { params }),
  getFuelReceipt: (id) => api.get(`/admin/fuel-receipts/${id}`),
  recordReceipt: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach(key => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return api.post("/admin/fuel-receipts/record", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  // Completed Trips
  getCompletedTrips: (params) => api.get("/admin/completed-trips", { params }),

  // GPS
  getTripsWithGPS: (params) => api.get("/gso/trips/with-gps", { params }),

  // Budget Overview
  getBudgetOverview: (params) => 
    api.get("/gso/budget-overview", { params }),
  getCrossDepartmentUsage: (params) => 
    api.get("/gso/cross-department-usage", { params }),

  // ============================================================
  // ✅ FISCAL YEAR MANAGEMENT (GSO)
  // ============================================================
  getFiscalYears: () => api.get("/admin/fiscal-years"),
  addFiscalYear: (data) => api.post("/admin/fiscal-years", data),
  toggleFiscalYear: (id) => api.patch(`/admin/fiscal-years/${id}/toggle`),
  deleteFiscalYear: (id) => api.delete(`/admin/fiscal-years/${id}`),

  // ============================================================
  // ✅ ANNUAL BUDGET (GSO - View/Delete only)
  // ============================================================
  getAnnualBudgets: (params) => api.get("/admin/annual-budgets", { params }),
  getBudgetYears: () => api.get("/admin/annual-budgets/years"),
  getBudgetSummary: (params) => api.get("/admin/annual-budgets/summary", { params }),
  deleteAnnualBudget: (id) => api.delete(`/admin/annual-budgets/${id}`),
  getDepartmentsWithoutBudget: (params) => 
    api.get("/admin/annual-budgets/departments-without-budget", { params }),


   getAvailableVehicles: (params = {}) => 
    api.get("/gso/vehicles/available", { params }),


    getPendingValidation: (params) => 
        api.get("/gso/pending-validation", { params }),
    validateTrip: (id, data) => 
        api.post(`/gso/tickets/${id}/validate`, data),
};

// ============ MAYOR'S OFFICE API ============
export const mayorsOfficeAPI = {
  // Dashboard
  getDashboard: () => api.get("/mayors-office/dashboard"),

  // Ticket Management
  getPendingTickets: (params) => api.get("/mayors-office/pending", { params }),
  getApprovedTickets: (params) => api.get("/mayors-office/approved", { params }),
  getTicketById: (id) => api.get(`/mayors-office/tickets/${id}`),

  // Review Actions
  approveTicket: (id, data) => api.post(`/mayors-office/tickets/${id}/approve`, data),
  rejectTicket: (id, note) =>
    api.post(`/mayors-office/tickets/${id}/reject`, { review_note: note }),

  // Budget
  getBudgetOverview: () => api.get("/mayors-office/budget-overview"),
  getDepartmentBudget: (departmentId) =>
    api.get(`/mayors-office/departments/${departmentId}/budget`),
  getAllDepartmentsWithBudget: () =>
    api.get("/mayors-office/departments/all-with-budget"),
  getAllDepartmentsForSelector: () =>
    api.get("/mayors-office/departments/selector"),

  // Budget Assistance
  getBudgetAssistanceRequests: () =>
    api.get("/mayors-office/budget-assistance/requests"),
  getBudgetAssistanceRequest: (requestId) =>
    api.get(`/mayors-office/budget-assistance/request/${requestId}`),
  createMoFundedTicket: (data) =>
    api.post("/mayors-office/budget-assistance/create-ticket", data),
  removeMORequest: (requestId) =>
    api.delete(`/mayors-office/budget-assistance/request/${requestId}`),

  // Budget Policies
  getBudgetPolicies: (params) => api.get('/mayors-office/budget-policies', { params }),
  getBudgetPolicy: (departmentId) => api.get(`/mayors-office/budget-policies/${departmentId}`),
  createBudgetPolicy: (data) => api.post('/mayors-office/budget-policies', data),
  updateBudgetPolicy: (departmentId, data) => api.put(`/mayors-office/budget-policies/${departmentId}`, data),
  deleteBudgetPolicy: (departmentId) => api.delete(`/mayors-office/budget-policies/${departmentId}`),
  forceActivateBudget: (data) => api.post('/mayors-office/budget-periods/force-activate', data),

  // Receipt Verification
  getReceiptsForVerification: (params) => 
    api.get("/mayors-office/receipts/for-verification", { params }),
  verifyReceipt: (receiptId, data) => 
    api.post(`/mayors-office/receipts/${receiptId}/verify`, data),

  // Budget History
  getBudgetHistory: (params) => 
    api.get('/mayors-office/budget-history', { params }),
  getBudgetSummary: () => 
    api.get('/mayors-office/budget-summary'),

  // ============================================================
  // ✅ FISCAL YEARS (MO - View only)
  // ============================================================
  getFiscalYears: () => api.get("/mayors-office/fiscal-years"),
  getActiveFiscalYears: () => api.get("/mayors-office/fiscal-years/active"),

  // ============================================================
  // ✅ ANNUAL BUDGET (MO - Set budgets) - FIXED
  // ============================================================
  
  // ✅ Create/Update annual budget (POST without /set)
  setAnnualBudget: (data) => 
    api.post('/mayors-office/annual-budgets', data),
  
  // ✅ Add additional budget (Mayor's Memo)
  addAnnualBudget: (data) => 
    api.post('/mayors-office/annual-budgets/add', data),
  
  // Get budgets by year
  getAnnualBudgetsByYear: (year) => 
    api.get(`/mayors-office/annual-budgets/year/${year}`),
  
  // Bulk update
  bulkUpdateAnnualBudgets: (data) => 
    api.post('/mayors-office/annual-budgets/bulk', data),
  
  // Update single budget
  updateAnnualBudget: (id, data) => 
    api.put(`/mayors-office/annual-budgets/${id}`, data),
  
  // Get department budget
  getDepartmentAnnualBudget: (departmentId) => 
    api.get(`/mayors-office/annual-budgets/${departmentId}`),

  // ============================================================
  // ✅ WEEKLY BUDGET MANAGEMENT (MO)
  // ============================================================
  updateWeeklyAllocation: (departmentId, data) => 
    api.put(`/mayors-office/budget/weekly/${departmentId}`, data),
  processSurplus: (departmentId) => 
    api.post(`/mayors-office/budget/process-surplus/${departmentId}`),
  getSurplusHistory: (params) => 
    api.get('/mayors-office/budget/surplus-history', { params }),
  getBudgetPeriods: (params) => 
    api.get('/mayors-office/budget-periods', { params }),
};

// ============ DRIVER API ============
export const driverAPI = {
  // Trip Management
  getTrips: (params) => api.get("/driver/trips", { params }),
  getActiveTrip: () => api.get("/driver/trips/active"),
  getGasSlip: (id) => api.get(`/driver/trips/${id}/gas-slip`),

  // Trip Actions
  acknowledgeFunds: (id) => api.post(`/driver/trips/${id}/acknowledge`),
  startTrip: (id, data) => api.post(`/driver/trips/${id}/start`, data),
  completeTrip: (id, data) => api.post(`/driver/trips/${id}/complete`, data),
  uploadReceipt: (id, formData) =>
    api.post(`/driver/trips/${id}/receipt`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateOdometer: (id, data) =>
    api.post(`/driver/trips/${id}/odometer`, data),

  // Dashboard
  getDashboard: () => api.get("/driver/dashboard"),

  // Staff functionality
  getMyRequests: (params) => api.get("/driver/trips/my-requests", { params }),
  getTripById: (id) => api.get(`/driver/tickets/${id}`),
  checkBudget: (data) => api.post("/driver/tickets/check-budget", data),
  
  // Resources
  getAvailableVehicles: (params = {}) =>
    api.get("/driver/vehicles/available", { params }),
  getActiveDrivers: (params = {}) =>
    api.get("/driver/drivers/active", { params }),
  
  // Budget
  getDepartmentBudget: () => api.get("/driver/departments/budget/current"),
  
  // Reports
  getTripReport: (params) => api.get("/driver/reports/trips", { params }),
  getFuelReport: (params) => api.get("/driver/reports/fuel", { params }),
  getReportSummary: (params) => api.get("/driver/reports/summary", { params }),

  getTripHistory: (tripId) => 
    api.get(`/driver/trips/${tripId}/history`),
};

// ============ DEPARTMENT API ============
export const departmentAPI = {
  getAll: (params) => api.get("/admin/departments", { params }),
  getById: (id) => api.get(`/admin/departments/${id}`),
  create: (data) => api.post("/admin/departments", data),
  update: (id, data) => api.put(`/admin/departments/${id}`, data),
  delete: (id) => api.delete(`/admin/departments/${id}`),
  toggleStatus: (id, isActive) => 
    api.patch(`/admin/departments/${id}/toggle-status`, { is_active: isActive }),
};

// ============ ADMIN API (GSO Only) ============
// User Management
export const userAPI = {
  getAll: (params) => api.get("/admin/users", { params }),
  getById: (id) => api.get(`/admin/users/${id}`),
  create: (data) => api.post("/admin/users", data),
  update: (id, data) => api.put(`/admin/users/${id}`, data),
  delete: (id) => api.delete(`/admin/users/${id}`),
  updateStatus: (id, status, reason = null) =>
    api.patch(`/admin/users/${id}/status`, {
      status,
      deactivation_reason: reason,
    }),
  resetPassword: (id) => api.post(`/admin/users/${id}/reset-password`),
  updateDepartment: (id, departmentId) =>
    api.patch(`/admin/users/${id}/department`, { department_id: departmentId }),
  updateRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),

  // Signature Management
  uploadSignature: (id, formData) =>
    api.post(`/admin/users/${id}/signature`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getSignature: (id) => api.get(`/admin/users/${id}/signature`),
  deleteSignature: (id) => api.delete(`/admin/users/${id}/signature`),
};

// Vehicle Management
export const vehicleAPI = {
  getAll: (params) => api.get("/admin/vehicles", { params }),
  getById: (id) => api.get(`/admin/vehicles/${id}`),
  create: (data) => api.post("/admin/vehicles", data),
  update: (id, data) => api.put(`/admin/vehicles/${id}`, data),
  delete: (id) => api.delete(`/admin/vehicles/${id}`),
  updateStatus: (id, status, reason = null) =>
    api.patch(`/admin/vehicles/${id}/status`, { status, deactivation_reason: reason }),
  updateMaintenance: (id, maintenanceFlag) =>
    api.patch(`/admin/vehicles/${id}/maintenance`, { maintenance_flag: maintenanceFlag }),
  updateOdometerStatus: (id, status) =>
    api.patch(`/admin/vehicles/${id}/odometer-status`, { odometer_status: status }),
  getAvailableVehicles: (params = {}) =>
    api.get("/admin/vehicles/available", { params }),
};

// Driver Management (Admin)
export const driverManagementAPI = {
  getAll: (params) => api.get("/admin/drivers", { params }),
  getById: (id) => api.get(`/admin/drivers/${id}`),
  registerDriver: (userId, departmentId) =>
    api.post("/admin/drivers", { user_id: userId, department_id: departmentId }),
  updateStatus: (id, status, reason = null) =>
    api.patch(`/admin/drivers/${id}/status`, { status, deactivation_reason: reason }),
  delete: (id) => api.delete(`/admin/drivers/${id}`),
  getActiveDrivers: (params = {}) => api.get("/admin/drivers", { params }),
};

// Budget Policy Management
export const budgetPolicyAPI = {
  getAll: (params) => api.get("/admin/budget-policies", { params }),
  getByDepartment: (departmentId) =>
    api.get(`/admin/budget-policies/${departmentId}`),
  create: (data) => api.post("/admin/budget-policies", data),
  update: (departmentId, data) =>
    api.put(`/admin/budget-policies/${departmentId}`, data),
  delete: (departmentId) =>
    api.delete(`/admin/budget-policies/${departmentId}`),

  getPeriods: (params) => api.get("/admin/budget-periods", { params }),
  getPeriodById: (id) => api.get(`/admin/budget-periods/${id}`),
  closePeriod: (id) => api.post(`/admin/budget-periods/${id}/close`),
  createPeriods: (data) => api.post("/admin/budget-periods/create", data),

  getBudgetStatus: (params) => api.get("/admin/budget-status", { params }),
  getEventLogs: (params) => api.get("/admin/budget-event-logs", { params }),
  forceActivate: (data) => api.post("/admin/budget-policies/force-activate", data),
  runWeeklyReset: () => api.post("/admin/budget-policies/run-weekly-reset"),
};

// System Settings
export const settingsAPI = {
  getAll: () => api.get("/admin/settings"),
  getByKey: (key) => api.get(`/admin/settings/${key}`),
  update: (key, value) =>
    api.put(`/admin/settings/${key}`, { setting_value: value }),
  updateMultiple: (settings) => api.post("/admin/settings/bulk", { settings }),
};

// ============ NOTIFICATIONS API ============
export const notificationAPI = {
  getAll: (params) => api.get("/notifications", { params }),
  getUnreadCount: () => api.get("/notifications/unread-count"),
  markAsRead: (id) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post("/notifications/mark-all-read"),
  getPreferences: () => api.get("/notifications/preferences"),
  updatePreferences: (preferences) =>
    api.put("/notifications/preferences", preferences),
  
  send: (data) => api.post("/notifications/send", data),
  testBroadcast: () => api.post("/notifications/test"),
};

// ============ REPORTS API ============
export const reportsAPI = {
  getTripReport: (params) => api.get("/reports/trips", { params }),
  exportTripReport: (format, params) =>
    api.get(`/reports/trips/export/${format}`, { params, responseType: "blob" }),
  
  getFuelReport: (params) => api.get("/reports/fuel", { params }),
  exportFuelReport: (format, params) =>
    api.get(`/reports/fuel/export/${format}`, { params, responseType: "blob" }),
  
  getBudgetReport: (params) => api.get("/reports/budget", { params }),
  exportBudgetReport: (format, params) =>
    api.get(`/reports/budget/export/${format}`, { params, responseType: "blob" }),
  
  getVehicleReport: (params) => api.get("/reports/vehicles", { params }),
  getReportSummary: (params) => api.get("/reports/summary", { params }),
  
  getFuelConsumptionReport: (params) => 
    api.get("/reports/fuel-consumption", { params }),
  exportFuelConsumptionReport: (format, params) =>
    api.get(`/reports/fuel-consumption/export/${format}`, { 
      params, 
      responseType: "blob" 
    }),

  getFuelReceiptReport: (params) => 
    api.get("/reports/fuel-receipts", { params }),
  exportFuelReceiptReport: (format, params) =>
    api.get(`/reports/fuel-receipts/export/${format}`, { 
      params, 
      responseType: "blob" 
    }),

  getWeeklyMonitoring: (params) => 
    api.get("/reports/weekly-monitoring", { params }),
  exportWeeklyMonitoring: (format, params) =>
    api.get(`/reports/weekly-monitoring/export/${format}`, { 
      params, 
      responseType: "blob" 
    }),

  getFuelWithoutTrip: (params) => 
    api.get("/reports/fuel-without-trip", { params }),
  exportFuelWithoutTrip: (format, params) =>
    api.get(`/reports/fuel-without-trip/export/${format}`, { 
      params, 
      responseType: "blob" 
    }),
};

// ============ ADMIN DEPARTMENT API ============
export const adminDepartmentAPI = {
  getAll: (params) => api.get("/admin/departments", { params }),
  getActive: (params) => api.get("/admin/departments/active", { params }),
  getSelector: () => api.get("/admin/departments/selector"),
  getById: (id) => api.get(`/admin/departments/${id}`),
  create: (data) => api.post("/admin/departments", data),
  update: (id, data) => api.put(`/admin/departments/${id}`, data),
  delete: (id) => api.delete(`/admin/departments/${id}`),
  toggleStatus: (id) => api.patch(`/admin/departments/${id}/toggle-status`),
};

// ============ LOOKUP TABLES ============
export const lookupAPI = {
  getTripStatuses: () => api.get("/lookup/trip-statuses"),
  getUserRoles: () => api.get("/lookup/user-roles"),
  getRequestTypes: (category) =>
    api.get(`/lookup/request-types${category ? `?category=${category}` : ""}`),
  getFuelTypes: () => api.get("/lookup/fuel-types"),
};

// ============ FILE MANAGEMENT ============
export const fileAPI = {
  upload: (file, type) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    return api.post("/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  download: (uuid) =>
    api.get(`/files/download/${uuid}`, { responseType: "blob" }),
  delete: (uuid) => api.delete(`/files/${uuid}`),
};

// ============ AUDIT LOGS ============
export const auditAPI = {
  getLogs: (params) => api.get("/admin/audit-logs", { params }),
  getEntityLogs: (type, id) =>
    api.get(`/admin/audit-logs/entity/${type}/${id}`),
  getUserLogs: (userId) => api.get(`/admin/audit-logs/user/${userId}`),
};

// ============ GPS API ============
export const gpsAPI = {
  getActiveTrips: () => api.get("/gps/active-trips"),
  getTripRoute: (tripId) => api.get(`/gps/trips/${tripId}/route`),
  getTrack: (tripId) => api.get(`/gps/trips/${tripId}/track`),
  getPings: (tripId, params = {}) => 
    api.get(`/gps/trips/${tripId}/pings`, { params }),
  getLatestPing: (tripId) => api.get(`/gps/trips/${tripId}/latest`),
  getTripSummary: (tripId) => api.get(`/gps/trips/${tripId}/summary`),
  deletePings: (tripId) => api.delete(`/gps/trips/${tripId}/pings`),
};

// ============ LOCATION API ============
export const locationAPI = {
  searchPlaces: (query) => api.get('/location/search', { 
    params: { query } 
  }),
  calculateDistance: (params) => api.get('/location/distance', { 
    params 
  }),
  geocode: (address) => api.get('/location/geocode', { 
    params: { address } 
  }),
};

// ============ EXPORT ============
export default api;