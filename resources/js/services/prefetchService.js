// src/services/prefetchService.js
import { queryClient } from '../App';

export const prefetchService = {
  // ✅ Prefetch dashboard data
  prefetchDashboard: async (role) => {
    const endpoints = [];
    
    if (role === 'gso_office') {
      endpoints.push(
        { key: ['gso-dashboard'], fn: () => gsoAPI.getDashboard() },
        { key: ['gso-pending'], fn: () => gsoAPI.getPendingMO() },
        { key: ['gso-all-trips'], fn: () => gsoAPI.getAllTrips() },
      );
    } else if (role === 'mayors_office') {
      endpoints.push(
        { key: ['mayor-dashboard'], fn: () => mayorsOfficeAPI.getDashboard() },
        { key: ['mayor-pending'], fn: () => mayorsOfficeAPI.getPendingTickets() },
        { key: ['mayor-budget'], fn: () => mayorsOfficeAPI.getBudgetOverview() },
      );
    }

    // ✅ Prefetch all in parallel
    await Promise.all(
      endpoints.map(({ key, fn }) =>
        queryClient.prefetchQuery({
          queryKey: key,
          queryFn: fn,
          staleTime: 5 * 60 * 1000,
        })
      )
    );
  },

  // ✅ Prefetch reports
  prefetchReports: async (params) => {
    const { startDate, endDate, departmentId } = params;
    
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['fuel-consumption', { startDate, endDate }],
        queryFn: () => reportsAPI.getFuelConsumptionReport({ start_date: startDate, end_date: endDate }),
        staleTime: 5 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: ['vehicle-summary', { startDate, endDate }],
        queryFn: () => reportsAPI.getVehicleReport({ start_date: startDate, end_date: endDate }),
        staleTime: 5 * 60 * 1000,
      }),
    ]);
  },
};