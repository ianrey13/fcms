// src/pages/mayor/MayorFundIssuance.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DollarSign,
  Clock,
  CheckCircle,
  RefreshCw,
  Loader2,
  Search,
  Calendar,
  MapPin,
  Truck,
  User,
  Building2,
  FileText,
  TrendingUp,
  Printer,
  Download,
  Eye,
  ArrowUpDown,
  Fuel,
  CreditCard
} from 'lucide-react';
import { mayorsOfficeAPI } from '../../services/api';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Helper function to safely convert amount to number
const safeAmount = (amount) => {
  if (typeof amount === 'number') return amount;
  if (typeof amount === 'string') return parseFloat(amount) || 0;
  return 0;
};

const MayorFundIssuance = () => {
  const [issuances, setIssuances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIssuance, setSelectedIssuance] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [sortField, setSortField] = useState('trip_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [statistics, setStatistics] = useState({
    totalAmount: 0,
    totalCount: 0,
    averageAmount: 0,
    thisMonthAmount: 0,
    thisMonthCount: 0
  });

  useEffect(() => {
    fetchIssuances();
  }, []);

  const fetchIssuances = async () => {
    setLoading(true);
    try {
      const response = await mayorsOfficeAPI.getApprovedTickets();
      const ticketsData = response.data?.data || response.data || [];
      const processedData = Array.isArray(ticketsData) ? ticketsData : [];
      setIssuances(processedData);
      calculateStatistics(processedData);
    } catch (error) {
      console.error('Failed to fetch issuances:', error);
      toast.error('Failed to load fund issuance records');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIssuances();
    toast.success('Fund issuance records refreshed');
  };

  const calculateStatistics = (data) => {
    // ✅ FIXED: Safe amount conversion
    const totalAmount = data.reduce((sum, item) => sum + safeAmount(item.amount_released), 0);
    const totalCount = data.length;
    const averageAmount = totalCount > 0 ? totalAmount / totalCount : 0;
    
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    const thisMonthData = data.filter(item => {
      const itemDate = new Date(item.trip_date);
      return itemDate.getMonth() === thisMonth && itemDate.getFullYear() === thisYear;
    });
    
    const thisMonthAmount = thisMonthData.reduce((sum, item) => sum + safeAmount(item.amount_released), 0);
    const thisMonthCount = thisMonthData.length;
    
    setStatistics({
      totalAmount,
      totalCount,
      averageAmount,
      thisMonthAmount,
      thisMonthCount
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredIssuances = issuances
    .filter(issuance => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          (issuance.ticket_number && issuance.ticket_number.toLowerCase().includes(searchLower)) ||
          (issuance.destination && issuance.destination.toLowerCase().includes(searchLower)) ||
          (issuance.department_name && issuance.department_name.toLowerCase().includes(searchLower))
        );
      }
      if (activeTab === 'this-month') {
        const now = new Date();
        const itemDate = new Date(issuance.trip_date);
        return itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear();
      }
      return true;
    })
    .sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'amount_released') {
        aVal = safeAmount(aVal);
        bVal = safeAmount(bVal);
      } else if (sortField === 'trip_date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const formatCurrency = (amount) => {
    const numAmount = safeAmount(amount);
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(numAmount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const viewDetails = (issuance) => {
    setSelectedIssuance(issuance);
    setShowDetailModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Ticket #', 'Date', 'Department', 'Destination', 'Amount', 'Status', 'Vehicle', 'Driver'];
    const rows = filteredIssuances.map(item => [
      item.ticket_number || item.trip_ticket_number,
      formatDate(item.trip_date),
      item.department_name,
      item.destination,
      safeAmount(item.amount_released),
      item.status,
      item.vehicle?.plate_number || 'N/A',
      item.driver?.full_name || 'N/A'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fund_issuance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export started');
  };

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Loading fund issuance records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 rounded-2xl p-6 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <CreditCard className="h-3 w-3 mr-1" />
                  Fund Issuance
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                  Mayor's Office
                </Badge>
              </div>
              <h1 className="text-3xl font-bold">Fund Issuance Records</h1>
              <p className="text-slate-300 mt-1">Track and monitor released funds for trip tickets</p>
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={handleRefresh} 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button 
                onClick={handleExportCSV} 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button 
                onClick={handlePrint} 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="hover:shadow-lg transition-all duration-300 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-emerald-500/10">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <Badge variant="outline" className="dark:border-slate-600 dark:text-slate-400">Total</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(statistics.totalAmount)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Amount Released</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{statistics.totalCount} transactions</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <Badge variant="outline" className="dark:border-slate-600 dark:text-slate-400">Average</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(statistics.averageAmount)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Average per Transaction</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <Badge variant="outline" className="dark:border-slate-600 dark:text-slate-400">This Month</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(statistics.thisMonthAmount)}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Released This Month</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{statistics.thisMonthCount} transactions</p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-lg transition-all duration-300 dark:bg-slate-800/80 dark:border-slate-700">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-xl bg-orange-500/10">
                  <FileText className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <Badge variant="outline" className="dark:border-slate-600 dark:text-slate-400">Transactions</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{statistics.totalCount}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Total Fund Releases</p>
            </CardContent>
          </Card>
        </div>

        {/* Fund Issuance Table */}
        <Card className="shadow-xl border-0 dark:bg-slate-800/80 dark:border-slate-700 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/50 border-b dark:border-slate-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <CreditCard className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Released Funds
                <Badge variant="secondary" className="ml-2 dark:bg-slate-700 dark:text-slate-300">
                  {filteredIssuances.length} records
                </Badge>
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by ticket #, destination, department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-80 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4 bg-slate-100 dark:bg-slate-800 p-1">
                <TabsTrigger value="all" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  All ({filteredIssuances.length})
                </TabsTrigger>
                <TabsTrigger value="this-month" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700">
                  This Month ({statistics.thisMonthCount})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab} className="mt-0">
                {filteredIssuances.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                      <CreditCard className="h-10 w-10 text-slate-400" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No fund issuance records found</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                      {searchTerm ? 'Try a different search term' : 'Funds released will appear here'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-900/50">
                          <TableHead 
                            className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 font-semibold"
                            onClick={() => handleSort('ticket_number')}
                          >
                            Ticket # <ArrowUpDown className="h-3 w-3 inline ml-1" />
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 font-semibold"
                            onClick={() => handleSort('trip_date')}
                          >
                            Date <ArrowUpDown className="h-3 w-3 inline ml-1" />
                          </TableHead>
                          <TableHead className="font-semibold">Department</TableHead>
                          <TableHead className="font-semibold">Destination</TableHead>
                          <TableHead 
                            className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 text-right font-semibold"
                            onClick={() => handleSort('amount_released')}
                          >
                            Amount <ArrowUpDown className="h-3 w-3 inline ml-1" />
                          </TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="text-center font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredIssuances.map((issuance, index) => (
                          <TableRow 
                            key={issuance.id || issuance.trip_ticket_id} 
                            className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                          >
                            <TableCell className="font-mono font-medium text-slate-900 dark:text-white">
                              {issuance.ticket_number || issuance.trip_ticket_number}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                <Calendar className="h-3 w-3" />
                                {formatDate(issuance.trip_date)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                <Building2 className="h-3 w-3" />
                                {issuance.department_name}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">{issuance.destination}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(issuance.amount_released)}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1 w-fit">
                                <CheckCircle className="h-3 w-3" />
                                Released
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => viewDetails(issuance)}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400 dark:text-slate-500">
          <p>Data as of {new Date().toLocaleString()}</p>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Fund Issuance Details
            </DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Detailed information about the fund release
            </DialogDescription>
          </DialogHeader>
          
          {selectedIssuance && (
            <div className="space-y-4">
              {/* Ticket Info */}
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ticket Number</p>
                    <p className="font-mono font-semibold text-slate-900 dark:text-white">{selectedIssuance.ticket_number || selectedIssuance.trip_ticket_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Release Date</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{formatDateTime(selectedIssuance.submitted_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Trip Date</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{formatDate(selectedIssuance.trip_date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Released</Badge>
                  </div>
                </div>
              </div>
              
              {/* Department & Destination */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Department</p>
                  <p className="font-semibold flex items-center gap-1 mt-1 text-slate-900 dark:text-white">
                    <Building2 className="h-3 w-3" />
                    {selectedIssuance.department_name}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Destination</p>
                  <p className="font-semibold flex items-center gap-1 mt-1 text-slate-900 dark:text-white">
                    <MapPin className="h-3 w-3" />
                    {selectedIssuance.destination}
                  </p>
                </div>
              </div>
              
              {/* Vehicle & Driver */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Vehicle</p>
                  <p className="font-semibold flex items-center gap-1 mt-1 text-slate-900 dark:text-white">
                    <Truck className="h-3 w-3" />
                    {selectedIssuance.vehicle?.plate_number || 'N/A'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Driver</p>
                  <p className="font-semibold flex items-center gap-1 mt-1 text-slate-900 dark:text-white">
                    <User className="h-3 w-3" />
                    {selectedIssuance.driver?.full_name || 'N/A'}
                  </p>
                </div>
              </div>
              
              {/* Fuel Type */}
              {selectedIssuance.vehicle?.fuel_type && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fuel Type</p>
                  <p className="font-semibold flex items-center gap-1 mt-1 text-slate-900 dark:text-white">
                    <Fuel className="h-3 w-3" />
                    {selectedIssuance.vehicle.fuel_type?.toUpperCase()}
                  </p>
                </div>
              )}
              
              {/* Amount */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Amount Released</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(selectedIssuance.amount_released)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">Funding Source</p>
                    <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {selectedIssuance.is_mo_funded ? 'MO Funded' : 'Department Budget'}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Purpose */}
              {selectedIssuance.purpose && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Purpose</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">{selectedIssuance.purpose}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)} className="dark:border-slate-700 dark:text-slate-300">
              Close
            </Button>
            <Button 
              onClick={handlePrint}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MayorFundIssuance;