// src/services/api.js - FULLY FIXED
import { cachedApi, uncachedApi } from "./apiClient";

// ============ AUTH API ============
export const authAPI = {
  login: (email, password, deviceName = "web") =>
    uncachedApi.post("/auth/login", { email, password, device_name: deviceName }),

  logout: () => uncachedApi.post("/auth/logout"),

  getMe: () => cachedApi.get("/auth/me"),

  changePassword: (currentPassword, newPassword) =>
    uncachedApi.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPassword,
    }),

  forgotPassword: (email) => uncachedApi.post("/auth/forgot-password", { email }),

  resetPassword: (email, token, password) =>
    uncachedApi.post("/auth/reset-password", {
      email,
      token,
      password,
      password_confirmation: password,
    }),

  updateProfile: (data) => uncachedApi.post("/auth/update-profile", data),
};

// ============ TRIP TICKET API ============
export const tripTicketAPI = {
  getAll: (params) => cachedApi.get("/trip-tickets", { params }),
  getById: (id) => cachedApi.get(`/trip-tickets/${id}`),
  create: (data) => uncachedApi.post("/trip-tickets", data),
  update: (id, data) => uncachedApi.put(`/trip-tickets/${id}`, data),
  delete: (id) => uncachedApi.delete(`/trip-tickets/${id}`),
  cancel: (id, reason) => uncachedApi.post(`/trip-tickets/${id}/cancel`, { reason }),
  getMyRequests: (params) => cachedApi.get("/trip-tickets/my-requests", { params }),
  checkBudgetBeforeSubmit: (data) => uncachedApi.post("/trip-tickets/check-budget", data),
};

// ============ GSO API ============
export const gsoAPI = {
  // Dashboard - CACHED
  getDashboard: () => cachedApi.get("/gso/dashboard"),

  // Trip Management - CACHED
  getPendingMO: (params) => cachedApi.get("/gso/pending", { params }),
  getReturnedTickets: (params) => cachedApi.get("/gso/returned", { params }),
  getAllTrips: (params) => cachedApi.get("/gso/all-trips", { params }),
  getTicketById: (id) => cachedApi.get(`/gso/tickets/${id}`),

  // GSO Creates Trip Directly - UNCACHED (write operation)
  createTrip: (data) => uncachedApi.post("/gso/create-trip", data),

  // Reconciliation
  getPendingReconciliation: (params) => cachedApi.get("/gso/pending-reconciliation", { params }),
  reconcileTrip: (id, data) => uncachedApi.post(`/gso/tickets/${id}/reconcile`, data),

  // Reports - CACHED
  getReports: (params) => cachedApi.get("/gso/reports", { params }),
  exportReport: (type, params) =>
    cachedApi.get(`/gso/reports/export/${type}`, { params, responseType: "blob" }),

 
  getVerifiedReceipts: (params) => cachedApi.get("/gso/verified-receipts", { params }),

  // Fuel Receipts
  getFuelReceipts: (params) => cachedApi.get("/admin/fuel-receipts", { params }),
  getFuelReceipt: (id) => cachedApi.get(`/admin/fuel-receipts/${id}`),
  recordReceipt: (data) => {
    const formData = new FormData();
    Object.keys(data).forEach((key) => {
      if (data[key] !== null && data[key] !== undefined) {
        formData.append(key, data[key]);
      }
    });
    return uncachedApi.post("/admin/fuel-receipts/record", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    
  },

  // Completed Trips
  getCompletedTrips: (params) => cachedApi.get("/admin/completed-trips", { params }),

  // GPS
  getTripsWithGPS: (params) => cachedApi.get("/gso/trips/with-gps", { params }),

  // Budget Overview
  getBudgetOverview: (params) => cachedApi.get("/gso/budget-overview", { params }),
  getCrossDepartmentUsage: (params) => cachedApi.get("/gso/cross-department-usage", { params }),

  // Fiscal Year Management
  getFiscalYears: () => cachedApi.get("/admin/fiscal-years"),
  addFiscalYear: (data) => uncachedApi.post("/admin/fiscal-years", data),
  toggleFiscalYear: (id) => uncachedApi.patch(`/admin/fiscal-years/${id}/toggle`),
  deleteFiscalYear: (id) => uncachedApi.delete(`/admin/fiscal-years/${id}`),

  // Annual Budget
  getAnnualBudgets: (params) => cachedApi.get("/admin/annual-budgets", { params }),
  getBudgetYears: () => cachedApi.get("/admin/annual-budgets/years"),
  getBudgetSummary: (params) => cachedApi.get("/admin/annual-budgets/summary", { params }),
  deleteAnnualBudget: (id) => uncachedApi.delete(`/admin/annual-budgets/${id}`),
  getDepartmentsWithoutBudget: (params) =>
    cachedApi.get("/admin/annual-budgets/departments-without-budget", { params }),

  getAvailableVehicles: (params = {}) => cachedApi.get("/gso/vehicles/available", { params }),

  getPendingValidation: (params) => cachedApi.get("/gso/pending-validation", { params }),
  validateTrip: (id, data) => uncachedApi.post(`/gso/tickets/${id}/validate`, data),
  getTripHistory: (tripId) => cachedApi.get(`/gso/tickets/${tripId}/history`),

   getCancelledTrips: (params) => cachedApi.get("/gso/cancelled-trips", { params }),
  cancelTrip: (tripId, data) => uncachedApi.post(`/gso/trips/${tripId}/cancel`, data),
};

// ============ MAYOR'S OFFICE API ============
export const mayorsOfficeAPI = {
  // Dashboard - CACHED
  getDashboard: () => cachedApi.get("/mayors-office/dashboard"),

  // Ticket Management - CACHED
  getPendingTickets: (params) => cachedApi.get("/mayors-office/pending", { params }),
  getApprovedTickets: (params) => cachedApi.get("/mayors-office/approved", { params }),
  getTicketById: (id) => cachedApi.get(`/mayors-office/tickets/${id}`),

  // Review Actions - UNCACHED (write operations)
  approveTicket: (id, data) => uncachedApi.post(`/mayors-office/tickets/${id}/approve`, data),
  rejectTicket: (id, note) =>
    uncachedApi.post(`/mayors-office/tickets/${id}/reject`, { review_note: note }),

  // Budget - CACHED
  getBudgetOverview: () => cachedApi.get("/mayors-office/budget-overview"),
  getDepartmentBudget: (departmentId) =>
    cachedApi.get(`/mayors-office/departments/${departmentId}/budget`),
  getAllDepartmentsWithBudget: () =>
    cachedApi.get("/mayors-office/departments/all-with-budget"),
  getAllDepartmentsForSelector: () =>
    cachedApi.get("/mayors-office/departments/selector"),

  // Budget Assistance
  getBudgetAssistanceRequests: () =>
    cachedApi.get("/mayors-office/budget-assistance/requests"),
  getBudgetAssistanceRequest: (requestId) =>
    cachedApi.get(`/mayors-office/budget-assistance/request/${requestId}`),
  createMoFundedTicket: (data) =>
    uncachedApi.post("/mayors-office/budget-assistance/create-ticket", data),
  removeMORequest: (requestId) =>
    uncachedApi.delete(`/mayors-office/budget-assistance/request/${requestId}`),

  // Budget Policies
  getBudgetPolicies: (params) => cachedApi.get('/mayors-office/budget-policies', { params }),
  getBudgetPolicy: (departmentId) => cachedApi.get(`/mayors-office/budget-policies/${departmentId}`),
  createBudgetPolicy: (data) => uncachedApi.post('/mayors-office/budget-policies', data),
  updateBudgetPolicy: (departmentId, data) => uncachedApi.put(`/mayors-office/budget-policies/${departmentId}`, data),
  deleteBudgetPolicy: (departmentId) => uncachedApi.delete(`/mayors-office/budget-policies/${departmentId}`),
  forceActivateBudget: (data) => uncachedApi.post('/mayors-office/budget-periods/force-activate', data),

  // Receipt Verification
  getReceiptsForVerification: (params) =>
    cachedApi.get("/mayors-office/receipts/for-verification", { params }),
  verifyReceipt: (receiptId, data) =>
    uncachedApi.post(`/mayors-office/receipts/${receiptId}/verify`, data),

  getVerifiedReceipts: (params) =>
  cachedApi.get("/mayors-office/receipts/verified", { params }),

  // Budget History
  getBudgetHistory: (params) =>
    cachedApi.get('/mayors-office/budget-history', { params }),
  getBudgetSummary: () =>
    cachedApi.get('/mayors-office/budget-summary'),

  // Fiscal Years (MO - View only)
  getFiscalYears: () => cachedApi.get("/mayors-office/fiscal-years"),
  getActiveFiscalYears: () => cachedApi.get("/mayors-office/fiscal-years/active"),

  // Annual Budget (MO - Set budgets)
  setAnnualBudget: (data) =>
    uncachedApi.post('/mayors-office/annual-budgets', data),
  addAnnualBudget: (data) =>
    uncachedApi.post('/mayors-office/annual-budgets/add', data),
  getAnnualBudgetsByYear: (year) =>
    cachedApi.get(`/mayors-office/annual-budgets/year/${year}`),
  bulkUpdateAnnualBudgets: (data) =>
    uncachedApi.post('/mayors-office/annual-budgets/bulk', data),
  updateAnnualBudget: (id, data) =>
    uncachedApi.put(`/mayors-office/annual-budgets/${id}`, data),
  getDepartmentAnnualBudget: (departmentId) =>
    cachedApi.get(`/mayors-office/annual-budgets/${departmentId}`),

  // Weekly Budget Management (MO)
  updateWeeklyAllocation: (departmentId, data) =>
    uncachedApi.put(`/mayors-office/budget/weekly/${departmentId}`, data),
  processSurplus: (departmentId) =>
    uncachedApi.post(`/mayors-office/budget/process-surplus/${departmentId}`),
  getSurplusHistory: (params) =>
    cachedApi.get('/mayors-office/budget/surplus-history', { params }),
  getBudgetPeriods: (params) =>
    cachedApi.get('/mayors-office/budget-periods', { params }),


  // cancel
  cancelTrip: (tripId, data) => 
    uncachedApi.post(`/mayors-office/tickets/${tripId}/cancel`, data),
  
  getCancelledTrips: (params) => 
    cachedApi.get("/mayors-office/cancelled-trips", { params }),
};

// ============ DRIVER API ============
export const driverAPI = {
  // Trip Management - CACHED
  getTrips: (params) => cachedApi.get("/driver/trips", { params }),
  getActiveTrip: () => cachedApi.get("/driver/trips/active"),
  getGasSlip: (id) => cachedApi.get(`/driver/trips/${id}/gas-slip`),

  // Trip Actions - UNCACHED
  acknowledgeFunds: (id) => uncachedApi.post(`/driver/trips/${id}/acknowledge`),
  startTrip: (id, data) => uncachedApi.post(`/driver/trips/${id}/start`, data || {}),
  completeTrip: (id, data) => uncachedApi.post(`/driver/trips/${id}/complete`, data || {}),
  uploadReceipt: (id, formData) =>
    uncachedApi.post(`/driver/trips/${id}/receipt`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  updateOdometer: (id, data) =>
    uncachedApi.post(`/driver/trips/${id}/odometer`, data),

  // Dashboard - CACHED
  getDashboard: () => cachedApi.get("/driver/dashboard"),

  // Staff functionality
  getMyRequests: (params) => cachedApi.get("/driver/trips/my-requests", { params }),
  getTripById: (id) => cachedApi.get(`/driver/tickets/${id}`),
  checkBudget: (data) => uncachedApi.post("/driver/tickets/check-budget", data),

  // Resources - CACHED
  getAvailableVehicles: (params = {}) =>
    cachedApi.get("/driver/vehicles/available", { params }),
  getActiveDrivers: (params = {}) =>
    cachedApi.get("/driver/drivers/active", { params }),

  // Budget - CACHED
  getDepartmentBudget: () => cachedApi.get("/driver/departments/budget/current"),

  // Reports - CACHED
  getTripReport: (params) => cachedApi.get("/driver/reports/trips", { params }),
  getFuelReport: (params) => cachedApi.get("/driver/reports/fuel", { params }),
  getReportSummary: (params) => cachedApi.get("/driver/reports/summary", { params }),

  getTripHistory: (tripId) =>
    cachedApi.get(`/gso/tickets/${tripId}/history`),

  getReceiptStatus: (id) => cachedApi.get(`/driver/trips/${id}/receipt`),
};

// ============ DEPARTMENT API ============
export const departmentAPI = {
  getAll: (params) => cachedApi.get("/admin/departments", { params }),
  getById: (id) => cachedApi.get(`/admin/departments/${id}`),
  create: (data) => uncachedApi.post("/admin/departments", data),
  update: (id, data) => uncachedApi.put(`/admin/departments/${id}`, data),
  delete: (id) => uncachedApi.delete(`/admin/departments/${id}`),
  toggleStatus: (id, isActive) =>
    uncachedApi.patch(`/admin/departments/${id}/toggle-status`, { is_active: isActive }),
};

// ============ ADMIN API (GSO Only) ============
// User Management
export const userAPI = {
  getAll: (params) => cachedApi.get("/admin/users", { params }),
  getById: (id) => cachedApi.get(`/admin/users/${id}`),
  create: (data) => uncachedApi.post("/admin/users", data),
  update: (id, data) => uncachedApi.put(`/admin/users/${id}`, data),
  delete: (id) => uncachedApi.delete(`/admin/users/${id}`),
  updateStatus: (id, status, reason = null) =>
    uncachedApi.patch(`/admin/users/${id}/status`, {
      status,
      deactivation_reason: reason,
    }),
  resetPassword: (id) => uncachedApi.post(`/admin/users/${id}/reset-password`),
  updateDepartment: (id, departmentId) =>
    uncachedApi.patch(`/admin/users/${id}/department`, { department_id: departmentId }),
  updateRole: (id, role) => uncachedApi.patch(`/admin/users/${id}/role`, { role }),

  getUsersSince: (timestamp) => 
    cachedApi.get("/admin/users/since", { params: { since: timestamp } }),

  // Signature Management
  uploadSignature: (id, formData) =>
    uncachedApi.post(`/admin/users/${id}/signature`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  getSignature: (id) => cachedApi.get(`/admin/users/${id}/signature`),
  deleteSignature: (id) => uncachedApi.delete(`/admin/users/${id}/signature`),
};

// Vehicle Management
export const vehicleAPI = {
  getAll: (params) => cachedApi.get("/admin/vehicles", { params }),
  getById: (id) => cachedApi.get(`/admin/vehicles/${id}`),
  create: (data) => uncachedApi.post("/admin/vehicles", data),
  update: (id, data) => uncachedApi.put(`/admin/vehicles/${id}`, data),
  delete: (id) => uncachedApi.delete(`/admin/vehicles/${id}`),
  updateStatus: (id, status, reason = null) =>
    uncachedApi.patch(`/admin/vehicles/${id}/status`, { status, deactivation_reason: reason }),
  updateMaintenance: (id, maintenanceFlag) =>
    uncachedApi.patch(`/admin/vehicles/${id}/maintenance`, { maintenance_flag: maintenanceFlag }),
  updateOdometerStatus: (id, status) =>
    uncachedApi.patch(`/admin/vehicles/${id}/odometer-status`, { odometer_status: status }),
  getAvailableVehicles: (params = {}) =>
    cachedApi.get("/admin/vehicles/available", { params }),
};

// Driver Management (Admin)
export const driverManagementAPI = {
  getAll: (params) => cachedApi.get("/admin/drivers", { params }),
  getById: (id) => cachedApi.get(`/admin/drivers/${id}`),
  registerDriver: (userId, departmentId) =>
    uncachedApi.post("/admin/drivers", { user_id: userId, department_id: departmentId }),
  updateStatus: (id, status, reason = null) =>
    uncachedApi.patch(`/admin/drivers/${id}/status`, { status, deactivation_reason: reason }),
  delete: (id) => uncachedApi.delete(`/admin/drivers/${id}`),
  getActiveDrivers: (params = {}) => cachedApi.get("/admin/drivers", { params }),
};

// Budget Policy Management
export const budgetPolicyAPI = {
  getAll: (params) => cachedApi.get("/admin/budget-policies", { params }),
  getByDepartment: (departmentId) =>
    cachedApi.get(`/admin/budget-policies/${departmentId}`),
  create: (data) => uncachedApi.post("/admin/budget-policies", data),
  update: (departmentId, data) =>
    uncachedApi.put(`/admin/budget-policies/${departmentId}`, data),
  delete: (departmentId) =>
    uncachedApi.delete(`/admin/budget-policies/${departmentId}`),

  getPeriods: (params) => cachedApi.get("/admin/budget-periods", { params }),
  getPeriodById: (id) => cachedApi.get(`/admin/budget-periods/${id}`),
  closePeriod: (id) => uncachedApi.post(`/admin/budget-periods/${id}/close`),
  createPeriods: (data) => uncachedApi.post("/admin/budget-periods/create", data),

  getBudgetStatus: (params) => cachedApi.get("/admin/budget-status", { params }),
  getEventLogs: (params) => cachedApi.get("/admin/budget-event-logs", { params }),
  forceActivate: (data) => uncachedApi.post("/admin/budget-policies/force-activate", data),
  runWeeklyReset: () => uncachedApi.post("/admin/budget-policies/run-weekly-reset"),
};

// System Settings
export const settingsAPI = {
  getAll: () => cachedApi.get("/admin/settings"),
  getByKey: (key) => cachedApi.get(`/admin/settings/${key}`),
  update: (key, value) =>
    uncachedApi.put(`/admin/settings/${key}`, { setting_value: value }),
  updateMultiple: (settings) => uncachedApi.post("/admin/settings/bulk", { settings }),
};

// ============ NOTIFICATIONS API ============
export const notificationAPI = {
  getAll: (params) => cachedApi.get("/notifications", { params }),
  getUnreadCount: () => cachedApi.get("/notifications/unread-count"),
  markAsRead: (id) => uncachedApi.post(`/notifications/${id}/read`),
  markAllAsRead: () => uncachedApi.post("/notifications/mark-all-read"),
  getPreferences: () => cachedApi.get("/notifications/preferences"),
  updatePreferences: (preferences) =>
    uncachedApi.put("/notifications/preferences", preferences),

  send: (data) => uncachedApi.post("/notifications/send", data),
  testBroadcast: () => uncachedApi.post("/notifications/test"),
};

// ============ REPORTS API ============
export const reportsAPI = {
  // EXISTING REPORTS - CACHED
  getTripReport: (params) => cachedApi.get("/reports/trips", { params }),
  exportTripReport: (format, params) =>
    cachedApi.get(`/reports/trips/export/${format}`, { params, responseType: "blob" }),

  getFuelReport: (params) => cachedApi.get("/reports/fuel", { params }),
  exportFuelReport: (format, params) =>
    cachedApi.get(`/reports/fuel/export/${format}`, { params, responseType: "blob" }),

  getBudgetReport: (params) => cachedApi.get("/reports/budget", { params }),
  exportBudgetReport: (format, params) =>
    cachedApi.get(`/reports/budget/export/${format}`, { params, responseType: "blob" }),

  getVehicleReport: (params) => cachedApi.get("/reports/vehicles", { params }),
  getReportSummary: (params) => cachedApi.get("/reports/summary", { params }),

  getFuelConsumptionReport: (params) =>
    cachedApi.get("/reports/fuel-consumption", { params }),
  exportFuelConsumptionReport: (format, params) =>
    cachedApi.get(`/reports/fuel-consumption/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getFuelReceiptReport: (params) =>
    cachedApi.get("/reports/fuel-receipts", { params }),
  exportFuelReceiptReport: (format, params) =>
    cachedApi.get(`/reports/fuel-receipts/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getWeeklyMonitoring: (params) =>
    cachedApi.get("/reports/weekly-monitoring", { params }),
  exportWeeklyMonitoring: (format, params) =>
    cachedApi.get(`/reports/weekly-monitoring/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getFuelWithoutTrip: (params) =>
    cachedApi.get("/reports/fuel-without-trip", { params }),
  exportFuelWithoutTrip: (format, params) =>
    cachedApi.get(`/reports/fuel-without-trip/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getFundReleaseHistory: (params) =>
    cachedApi.get('/reports/fund-release-history', { params }),
  exportFundReleaseHistory: (format, params) =>
    cachedApi.get(`/reports/fund-release-history/export/${format}`, {
      params,
      responseType: 'blob',
    }),

  // NEW REPORTS - CACHED
  getDepartmentFuelConsumption: (params) =>
    cachedApi.get("/reports/department-fuel-consumption", { params }),
  exportDepartmentFuelConsumption: (format, params) =>
    cachedApi.get(`/reports/department-fuel-consumption/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getMonthlyFuelConsumption: (params) =>
    cachedApi.get("/reports/monthly-fuel-consumption", { params }),
  exportMonthlyFuelConsumption: (format, params) =>
    cachedApi.get(`/reports/monthly-fuel-consumption/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getTripTicketReport: (params) =>
    cachedApi.get("/reports/trip-tickets", { params }),
  exportTripTicketReport: (format, params) =>
    cachedApi.get(`/reports/trip-tickets/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getGPSVehicleActivity: (params) =>
    cachedApi.get("/reports/gps-vehicle-activity", { params }),
  exportGPSVehicleActivity: (format, params) =>
    cachedApi.get(`/reports/gps-vehicle-activity/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getReconciliation: (params) =>
    cachedApi.get("/reports/reconciliation", { params }),
  exportReconciliation: (format, params) =>
    cachedApi.get(`/reports/reconciliation/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getDriverEfficiency: (params) =>
    cachedApi.get("/reports/driver-efficiency", { params }),
  exportDriverEfficiency: (format, params) =>
    cachedApi.get(`/reports/driver-efficiency/export/${format}`, {
      params,
      responseType: "blob",
    }),

  getAuditTrail: (params) =>
    cachedApi.get("/reports/audit-trail", { params }),
  exportAuditTrail: (format, params) =>
    cachedApi.get(`/reports/audit-trail/export/${format}`, {
      params,
      responseType: "blob",
    }),


    exportVehicleReport: (format, params) =>
  cachedApi.get(`/reports/vehicles/export/${format}`, {
    params,
    responseType: "blob",
  }),
};

// ============ ADMIN DEPARTMENT API ============
export const adminDepartmentAPI = {
  getAll: (params) => cachedApi.get("/admin/departments", { params }),
  getActive: (params) => cachedApi.get("/admin/departments/active", { params }),
  getSelector: () => cachedApi.get("/admin/departments/selector"),
  getById: (id) => cachedApi.get(`/admin/departments/${id}`),
  create: (data) => uncachedApi.post("/admin/departments", data),
  update: (id, data) => uncachedApi.put(`/admin/departments/${id}`, data),
  delete: (id) => uncachedApi.delete(`/admin/departments/${id}`),
  toggleStatus: (id) => uncachedApi.patch(`/admin/departments/${id}/toggle-status`),
};

// ============ LOOKUP TABLES ============
export const lookupAPI = {
  getTripStatuses: () => cachedApi.get("/lookup/trip-statuses"),
  getUserRoles: () => cachedApi.get("/lookup/user-roles"),
  getRequestTypes: (category) =>
    cachedApi.get(`/lookup/request-types${category ? `?category=${category}` : ""}`),
  getFuelTypes: () => cachedApi.get("/lookup/fuel-types"),
};

// ============ FILE MANAGEMENT ============
export const fileAPI = {
  upload: (file, type) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    return uncachedApi.post("/files/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  download: (uuid) =>
    cachedApi.get(`/files/download/${uuid}`, { responseType: "blob" }),
  delete: (uuid) => uncachedApi.delete(`/files/${uuid}`),
};

// ============ AUDIT LOGS ============
export const auditAPI = {
  getLogs: (params) => cachedApi.get("/admin/audit-logs", { params }),
  getEntityLogs: (type, id) =>
    cachedApi.get(`/admin/audit-logs/entity/${type}/${id}`),
  getUserLogs: (userId) => cachedApi.get(`/admin/audit-logs/user/${userId}`),
};

// ============ GPS API ============
export const gpsAPI = {
  // GET requests - CACHED
  getActiveTrips: () => cachedApi.get("/gps/active-trips"),
  getTripRoute: (tripId) => cachedApi.get(`/gps/trips/${tripId}/route`),
  getTrack: (tripId) => cachedApi.get(`/gps/trips/${tripId}/track`),
  getPings: (tripId, params = {}) =>
    cachedApi.get(`/gps/trips/${tripId}/pings`, { params }),
  getLatestPing: (tripId) => cachedApi.get(`/gps/trips/${tripId}/latest`),
  getTripSummary: (tripId) => cachedApi.get(`/gps/trips/${tripId}/summary`),
  getTripWithLocations: (tripId) =>
    cachedApi.get(`/gps/trips/${tripId}/locations`),
  calculateDistance: (tripId) =>
    cachedApi.get(`/gps/trips/${tripId}/distance`),
  getTripStats: (tripId) =>
    cachedApi.get(`/gps/trips/${tripId}/stats`),

  // POST/DELETE requests - UNCACHED
  deletePings: (tripId) => uncachedApi.delete(`/gps/trips/${tripId}/pings`),
  checkDeviation: (data) => uncachedApi.post('/gps/check-deviation', data),
  storeBatch: (data) => uncachedApi.post('/gps/pings/batch', data),
};

// ============ LOCATION API ============
export const locationAPI = {
  searchPlaces: (query) => cachedApi.get('/location/search', {
    params: { query },
  }),
  
  calculateDistance: (params) => cachedApi.get('/location/distance', {
    params,
  }),
  
  geocode: (address) => cachedApi.get('/location/geocode', {
    params: { address },
  }),
  
  // ✅ Reverse geocode (if needed)
  reverseGeocode: (params) => cachedApi.get('/location/reverse', {
    params,
  }),
  
  // ✅ Trip estimate (combines distance + fuel calculation)
  calculateTripEstimate: (params) => cachedApi.get('/location/trip-estimate', {
    params,
  }),
};

// ============ EXPORT ============
export default cachedApi;