// src/hooks/useMayorBudget.js
import { useQuery } from '@tanstack/react-query';
import { mayorsOfficeAPI } from '../services/api';

export const useMayorBudgetData = () => {
  return useQuery({
    queryKey: ['mayor-budget-data'],
    queryFn: async () => {
      const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
      return response.data?.data || [];
    },
  });
};