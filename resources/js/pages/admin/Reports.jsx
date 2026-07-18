import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileBarChart,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  Fuel,
  DollarSign,
  Truck,
  Users,
  Printer,
  Mail,
  Filter
} from 'lucide-react';
import { departmentAPI, vehicleAPI, tripTicketAPI, budgetPolicyAPI } from '../../services/api';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('fuel');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [fuelReport, setFuelReport] = useState([]);
  const [tripReport, setTripReport] = useState([]);
  const [budgetReport, setBudgetReport] = useState([]);
  const [vehicleReport, setVehicleReport] = useState([]);

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Fetch data for reports
      const [vehiclesRes, budgetStatusRes] = await Promise.all([
        vehicleAPI.getAll(),
        budgetPolicyAPI.getBudgetStatus()
      ]);

      // Process vehicle report
      const vehicles = vehiclesRes.data?.data || vehiclesRes.data || [];
      setVehicleReport(vehicles);

      // Process budget report
      const budgetData = budgetStatusRes.data?.data || budgetStatusRes.data || [];
      setBudgetReport(budgetData);

      // TODO: Fetch fuel and trip reports when APIs are ready
      
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format) => {
    console.log(`Exporting as ${format}...`);
    // Implement export functionality
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    console.log('Sending email...');
    // Implement email functionality
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Generate and export system reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handlePrint()} className="flex items-center gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>
          <Button variant="outline" onClick={() => handleEmail()} className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email
          </Button>
          <Button onClick={() => handleExport('pdf')} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
              />
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Apply Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fuel" className="flex items-center gap-2">
            <Fuel className="h-4 w-4" />
            Fuel Reports
          </TabsTrigger>
          <TabsTrigger value="trip" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Trip Reports
          </TabsTrigger>
          <TabsTrigger value="budget" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Budget Reports
          </TabsTrigger>
          <TabsTrigger value="vehicle" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Vehicle Reports
          </TabsTrigger>
        </TabsList>

        {/* Fuel Reports Tab */}
        <TabsContent value="fuel" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fuel className="h-5 w-5" />
                Fuel Consumption Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <Fuel className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Fuel consumption data will appear here</p>
                  <p className="text-sm mt-1">Once trip data is available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trip Reports Tab */}
        <TabsContent value="trip" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Trip Summary Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-gray-500">
                <Truck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Trip summary data will appear here</p>
                <p className="text-sm mt-1">Once trip data is available</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Budget Reports Tab */}
        <TabsContent value="budget" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Budget Utilization Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : budgetReport.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No budget data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Allocated</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Spent</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Remaining</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Utilization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {budgetReport.map((item, index) => {
                        const percentage = (item.spent_amount / item.allocated_amount) * 100;
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{item.department_name}</td>
                            <td className="px-4 py-3">₱{parseFloat(item.allocated_amount).toLocaleString()}</td>
                            <td className="px-4 py-3">₱{parseFloat(item.spent_amount).toLocaleString()}</td>
                            <td className="px-4 py-3">₱{parseFloat(item.remaining_amount).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-24 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className={`h-2 rounded-full ${percentage > 80 ? 'bg-red-600' : percentage > 50 ? 'bg-yellow-500' : 'bg-green-600'}`}
                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm">{percentage.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vehicle Reports Tab */}
        <TabsContent value="vehicle" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Vehicle Inventory Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : vehicleReport.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Truck className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No vehicle data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vehicle</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Plate #</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Fuel Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Maintenance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {vehicleReport.map((vehicle) => (
                        <tr key={vehicle.vehicle_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{vehicle.vehicle_model}</td>
                          <td className="px-4 py-3 font-mono">{vehicle.plate_number}</td>
                          <td className="px-4 py-3">{vehicle.department_name || 'N/A'}</td>
                          <td className="px-4 py-3 capitalize">{vehicle.fuel_type}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              vehicle.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {vehicle.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {vehicle.maintenance_flag ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Under Maintenance</span>
                            ) : (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Operational</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;