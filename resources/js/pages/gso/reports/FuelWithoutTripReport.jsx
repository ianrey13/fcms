// src/pages/gso/reports/FuelWithoutTripReport.jsx
import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FuelWithoutTripReportComponent from '../../../components/reports/FuelWithoutTripReport';
import { departmentAPI } from '../../../services/api';

const FuelWithoutTripReport = () => {
  const [departmentId, setDepartmentId] = useState('all');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      setDepartments(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fuel Without Trip Report</h1>
          <p className="text-gray-500 dark:text-gray-400">Track fuel issued without vehicle movement</p>
        </div>
        <div className="w-64">
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.department_id} value={dept.department_id.toString()}>
                  {dept.department_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <FuelWithoutTripReportComponent departmentId={departmentId} />
    </div>
  );
};

export default FuelWithoutTripReport;