// src/services/prefetchService.js
import { queryClient } from './queryClient';  // ✅ Fixed import path!
import { gsoAPI, mayorsOfficeAPI, reportsAPI } from './api';  // ✅ Add API imports

// ============================================
// PREFETCH SERVICE
// Preloads data before user navigates to page
// ============================================

export const prefetchService = {

    // ============================================
    // ✅ PREFETCH DASHBOARD DATA
    // ============================================
    prefetchDashboard: async (role) => {
        const endpoints = [];

        if (role === 'gso_office') {
            endpoints.push(
                { key: ['gso-pending-mo'], fn: () => gsoAPI.getPendingMO() },
                { key: ['gso-pending-validation'], fn: () => gsoAPI.getPendingValidation() },
                { key: ['gso-all-trips'], fn: () => gsoAPI.getAllTrips() },
                { 
    key: ['gps-active-trips'], 
    fn: async () => {
        try {
            const res = await gsoAPI.getActiveTrips?.();
            if (!res) return [];
            if (Array.isArray(res)) return res;
            if (Array.isArray(res.data)) return res.data;
            if (Array.isArray(res.data?.data)) return res.data.data;
            return [];
        } catch (err) {
            console.warn('prefetch gps-active-trips failed:', err);
            return [];
        }
    }
},
            );
        } else if (role === 'mayors_office') {
            endpoints.push(
                { key: ['mayor-pending-tickets'], fn: () => mayorsOfficeAPI.getPendingTickets() },
                { key: ['mayor-approved-tickets'], fn: () => mayorsOfficeAPI.getApprovedTickets() },
                { key: ['mayor-department-budgets'], fn: () => mayorsOfficeAPI.getAllDepartmentsWithBudget() },
            );
        }

        await Promise.all(
            endpoints.map(({ key, fn }) =>
                queryClient.prefetchQuery({
                    queryKey: key,
                    queryFn: fn,
                    staleTime: 5 * 60 * 1000,
                }).catch(err => {
                    // Silently fail prefetch — don't block user
                    console.warn(`Prefetch failed for ${key}:`, err.message);
                })
            )
        );
    },

    // ============================================
    // ✅ PREFETCH ALL REPORTS (GSO Reports page)
    // ============================================
    prefetchReports: async (params = {}) => {
        const { startDate, endDate, departmentId, vehicleId } = params;

        const dateParams = {
            start_date: startDate,
            end_date: endDate,
            department_id: departmentId && departmentId !== 'all' ? departmentId : undefined,
            vehicle_id: vehicleId && vehicleId !== 'all' ? vehicleId : undefined,
        };

        const endpoints = [
            { key: ['fuel-consumption', dateParams], fn: () => reportsAPI.getFuelConsumptionReport(dateParams) },
            { key: ['vehicle-summary', dateParams], fn: () => reportsAPI.getVehicleReport(dateParams) },
            { key: ['department-summary', dateParams], fn: () => reportsAPI.getDepartmentFuelConsumption(dateParams) },
            { key: ['trip-ticket-report', dateParams], fn: () => reportsAPI.getTripTicketReport(dateParams) },
            { key: ['fuel-receipt', dateParams], fn: () => reportsAPI.getFuelReceiptReport(dateParams) },
        ];

        await Promise.all(
            endpoints.map(({ key, fn }) =>
                queryClient.prefetchQuery({
                    queryKey: key,
                    queryFn: fn,
                    staleTime: 5 * 60 * 1000,
                }).catch(err => {
                    console.warn(`Prefetch failed for ${key}:`, err.message);
                })
            )
        );
    },

    // ============================================
    // ✅ PREFETCH SINGLE REPORT BY NAME
    // ============================================
    prefetchReport: (reportName, params = {}) => {
        const reportMap = {
            'fuel-consumption': () => reportsAPI.getFuelConsumptionReport(params),
            'vehicle-summary': () => reportsAPI.getVehicleReport(params),
            'department-summary': () => reportsAPI.getDepartmentFuelConsumption(params),
            'trip-ticket': () => reportsAPI.getTripTicketReport(params),
            'fuel-receipt': () => reportsAPI.getFuelReceiptReport(params),
            'reconciliation': () => reportsAPI.getReconciliation(params),
            'driver-efficiency': () => reportsAPI.getDriverEfficiency(params),
            'audit-trail': () => reportsAPI.getAuditTrail(params),
            'gps-activity': () => reportsAPI.getGPSVehicleActivity(params),
            'monthly-summary': () => reportsAPI.getMonthlyFuelConsumption(params),
        };

        const fn = reportMap[reportName];
        if (!fn) {
            console.warn(`Unknown report name: ${reportName}`);
            return;
        }

        queryClient.prefetchQuery({
            queryKey: [reportName, params],
            queryFn: fn,
            staleTime: 5 * 60 * 1000,
        }).catch(err => {
            console.warn(`Prefetch failed for ${reportName}:`, err.message);
        });
    },

    // ============================================
    // ✅ PREFETCH DEPARTMENT LIST (for dropdowns)
    // ============================================
    prefetchDepartments: async () => {
        queryClient.prefetchQuery({
            queryKey: ['departments-selector'],
            queryFn: () => mayorsOfficeAPI.getAllDepartmentsForSelector(),
            staleTime: 10 * 60 * 1000, // Departments rarely change — cache for 10 min
        }).catch(() => {});
    },

    // ============================================
    // ✅ PREFETCH VEHICLES (for dropdowns)
    // ============================================
    prefetchVehicles: async () => {
        queryClient.prefetchQuery({
            queryKey: ['vehicles-list'],
            queryFn: () => mayorsOfficeAPI.getAllDepartmentsWithBudget(), // Adjust based on your API
            staleTime: 10 * 60 * 1000,
        }).catch(() => {});
    },

    // ============================================
    // ✅ PREFETCH FUEL RECEIPTS
    // ============================================
    prefetchFuelReceipts: async () => {
        queryClient.prefetchQuery({
            queryKey: ['gso-fuel-receipts'],
            queryFn: () => gsoAPI.getFuelReceipts(),
            staleTime: 5 * 60 * 1000,
        }).catch(() => {});
    },

    // ============================================
    // ✅ PREFETCH BUDGET DATA
    // ============================================
    prefetchBudget: async (year) => {
        queryClient.prefetchQuery({
            queryKey: ['annual-budgets', year],
            queryFn: () => mayorsOfficeAPI.getAnnualBudgetsByYear(year),
            staleTime: 5 * 60 * 1000,
        }).catch(() => {});
    },

    // ============================================
    // ✅ CLEAR SPECIFIC CACHE
    // ============================================
    invalidateQueries: (queryKey) => {
        queryClient.invalidateQueries({ queryKey });
    },
};

export default prefetchService;