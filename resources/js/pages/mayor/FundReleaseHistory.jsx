// src/pages/mayor/FundReleaseHistory.jsx

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsAPI, mayorsOfficeAPI } from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  DollarSign,
  Building2,
  RefreshCw,
  Loader2,
  TrendingUp,
  FileSpreadsheet,
  Printer,
  ArrowLeft,
  Zap,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  Truck,
  User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

const FundReleaseHistory = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    department_id: 'all',
    fiscal_year: new Date().getFullYear(),
    week_number: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);

  // ✅ Fetch all departments for filter using Mayor's Office API
  useEffect(() => {
    const fetchDepartments = async () => {
      setLoadingDepartments(true);
      try {
        const response = await mayorsOfficeAPI.getAllDepartmentsForSelector();
        const data = response.data?.data || [];
        
        if (data.length > 0) {
          setDepartments(data);
        } else {
          // ✅ Fallback: Hardcoded departments
          setDepartments([
            { department_id: 11, department_name: 'Engineering Office', department_code: 'ENGR' },
            { department_id: 13, department_name: 'Municipal Environment and Natural Resources Office', department_code: 'MENRO' },
            { department_id: 14, department_name: 'Department of Social Welfare and Development', department_code: 'DSWD' },
            { department_id: 15, department_name: 'Municipal Disaster Risk Reduction and Management Office', department_code: 'MDRRMO' },
            { department_id: 16, department_name: 'Rural Health Unit', department_code: 'RHU' },
            { department_id: 17, department_name: 'SANGUNIANG BAYAN', department_code: 'SB' },
          ]);
        }
      } catch (error) {
        console.error('Failed to fetch departments:', error);
        // ✅ Fallback: Hardcoded departments
        setDepartments([
          { department_id: 11, department_name: 'Engineering Office', department_code: 'ENGR' },
          { department_id: 13, department_name: 'Municipal Environment and Natural Resources Office', department_code: 'MENRO' },
          { department_id: 14, department_name: 'Department of Social Welfare and Development', department_code: 'DSWD' },
          { department_id: 15, department_name: 'Municipal Disaster Risk Reduction and Management Office', department_code: 'MDRRMO' },
          { department_id: 16, department_name: 'Rural Health Unit', department_code: 'RHU' },
          { department_id: 17, department_name: 'SANGUNIANG BAYAN', department_code: 'SB' },
        ]);
        toast.error('Failed to load departments - using fallback list');
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDepartments();
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['fund-release-history', filters],
    queryFn: async () => {
      const params = {
        department_id: filters.department_id !== 'all' ? filters.department_id : undefined,
        fiscal_year: filters.fiscal_year,
        week_number: filters.week_number || undefined,
      };
      const response = await reportsAPI.getFundReleaseHistory(params);
      return response.data;
    },
  });

  const history = data?.data || [];
  const summary = data?.summary || {};

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount) => {
    if (!amount || amount === 0) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const clearFilters = () => {
    setFilters({
      department_id: 'all',
      fiscal_year: new Date().getFullYear(),
      week_number: '',
    });
  };

  const hasActiveFilters = filters.department_id !== 'all' || filters.week_number !== '';

  // ✅ Get week options (1-52)
  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Loading fund release history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-6">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/mo/dashboard')}
              className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                  <DollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                    Fund Release History
                  </h1>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Track all fund releases by week and department
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="dark:border-slate-700 dark:text-slate-300"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total Released</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(summary.total_released)}
              </p>
              <p className="text-xs text-slate-400">{summary.total_count || 0} transactions</p>
            </CardContent>
          </Card>
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-500 dark:text-slate-400">Cross-Department</p>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {summary.cross_department_count || 0}
              </p>
              <p className="text-xs text-slate-400">
                {summary.total_count > 0 
                  ? Math.round((summary.cross_department_count / summary.total_count) * 100) 
                  : 0}% of total
              </p>
            </CardContent>
          </Card>
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-500 dark:text-slate-400">Fiscal Year</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {filters.fiscal_year}
              </p>
              <p className="text-xs text-slate-400">Active year</p>
            </CardContent>
          </Card>
          <Card className="dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="pt-6">
              <p className="text-xs text-slate-500 dark:text-slate-400">Average Release</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary.total_count > 0 
                  ? formatCurrency(summary.total_released / summary.total_count)
                  : '₱0.00'}
              </p>
              <p className="text-xs text-slate-400">Per transaction</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700">
          <div
            className="px-6 py-4 border-b dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-t-2xl"
            onClick={() => setShowFilters(!showFilters)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-700 dark:text-slate-300">Filters</span>
                {hasActiveFilters && (
                  <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                    Active
                  </Badge>
                )}
              </div>
              {showFilters ? (
                <ChevronUp className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              )}
            </div>
          </div>

          {showFilters && (
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Department Filter */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Department</label>
                  <select
                    value={filters.department_id}
                    onChange={(e) => setFilters(prev => ({ ...prev, department_id: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                    disabled={loadingDepartments}
                  >
                    <option value="all">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.department_name} ({dept.department_code || 'N/A'})
                      </option>
                    ))}
                  </select>
                  {loadingDepartments && (
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading departments...
                    </p>
                  )}
                </div>

                {/* Fiscal Year */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Fiscal Year</label>
                  <select
                    value={filters.fiscal_year}
                    onChange={(e) => setFilters(prev => ({ ...prev, fiscal_year: parseInt(e.target.value) }))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                </div>

                {/* Week Number */}
                <div>
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Week Number</label>
                  <select
                    value={filters.week_number}
                    onChange={(e) => setFilters(prev => ({ ...prev, week_number: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                  >
                    <option value="">All Weeks</option>
                    {weekOptions.map((week) => (
                      <option key={week} value={week}>Week {week}</option>
                    ))}
                  </select>
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 w-full"
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* History Table with Scrollable Header */}
        <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
          <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  Fund Release Records
                </CardTitle>
                <CardDescription className="dark:text-slate-400">
                  {history.length} record{history.length !== 1 ? 's' : ''} found
                </CardDescription>
              </div>
              {history.length > 0 && (
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  <Zap className="h-3 w-3 mr-1" />
                  {history.length} records
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6 p-0">
            {history.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No fund releases found</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Fund releases will appear here when approved
                </p>
                {hasActiveFilters && (
                  <Button variant="link" onClick={clearFilters} className="mt-2">
                    Clear filters
                  </Button>
                )}
              </div>
            ) : (
              // ✅ Scrollable container with sticky header
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
                <Table>
                  {/* ✅ Sticky Header - Fixed */}
                  <TableHeader className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-sm">
                    <TableRow className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider min-w-[140px] sticky top-0 bg-slate-100 dark:bg-slate-800">
                        Date
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider min-w-[80px] sticky top-0 bg-slate-100 dark:bg-slate-800">
                        Week
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider min-w-[120px] sticky top-0 bg-slate-100 dark:bg-slate-800">
                        Trip #
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider min-w-[150px] sticky top-0 bg-slate-100 dark:bg-slate-800">
                        Department
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider min-w-[150px] sticky top-0 bg-slate-100 dark:bg-slate-800">
                        Charged To
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider text-right min-w-[100px] sticky top-0 bg-slate-100 dark:bg-slate-800">
                        Amount
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider min-w-[100px] sticky top-0 bg-slate-100 dark:bg-slate-800">
                        Status
                      </TableHead>
                      <TableHead className="font-semibold text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider text-right min-w-[120px] sticky top-0 bg-slate-100 dark:bg-slate-800">
                        Released By
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((record, index) => (
                      <TableRow 
                        key={index} 
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                      >
                        <TableCell className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {formatDate(record.released_at)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono bg-blue-50 dark:bg-blue-900/20 whitespace-nowrap">
                            Week {record.week_number}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm font-semibold text-slate-800 dark:text-white whitespace-nowrap">
                          {record.trip_ticket_number || 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                              {record.department?.department_name || 'N/A'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[120px]">
                              {record.charged_to_department?.department_name || record.department?.department_name || 'N/A'}
                            </span>
                            {record.is_cross_department && (
                              <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 text-[10px] flex-shrink-0">
                                Cross
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(record.amount_released)}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            record.reconciliation_status === 'verified' 
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                              : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30',
                            'whitespace-nowrap'
                          )}>
                            {record.reconciliation_status === 'verified' ? 'Completed' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {record.released_by?.full_name || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
          <p>FCMS - Fund Release History</p>
          <p className="mt-0.5">{history.length} total releases • {formatCurrency(summary.total_released)} total amount</p>
        </div>
      </div>
    </div>
  );
};

export default FundReleaseHistory;