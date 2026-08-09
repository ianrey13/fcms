// src/pages/mayor/budget/WeeklyTracking.jsx
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    RefreshCw,
    Loader2,
    RotateCcw,
    Calendar,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    CheckCircle,
} from "lucide-react";
import { mayorsOfficeAPI } from "../../../services/api";
import { toast } from "react-hot-toast";
import { format, addDays, startOfWeek, endOfWeek, subWeeks, addWeeks, getWeek } from "date-fns";

const WeeklyTracking = () => {
    const [trackingData, setTrackingData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentWeek, setCurrentWeek] = useState(() => {
        const today = new Date();
        return startOfWeek(today, { weekStartsOn: 1 });
    });
    const [departments, setDepartments] = useState([]);
    const [budgetData, setBudgetData] = useState([]);
    const [displayData, setDisplayData] = useState(null);

    useEffect(() => {
        const today = new Date();
        const monday = startOfWeek(today, { weekStartsOn: 1 });
        setCurrentWeek(monday);
        fetchDepartments();
        fetchBudgetData();
    }, []);

    useEffect(() => {
        if (budgetData.length > 0 || departments.length > 0) {
            fetchTrackingData();
        }
    }, [currentWeek, budgetData, departments]);

    const fetchDepartments = async () => {
        try {
            const response = await mayorsOfficeAPI.getAllDepartmentsForSelector();
            const data = response.data?.data || response.data || [];
            setDepartments(data);
        } catch (error) {
            console.error("Failed to fetch departments:", error);
        }
    };

    const fetchBudgetData = async () => {
        try {
            const response = await mayorsOfficeAPI.getAllDepartmentsWithBudget();
            let data = response.data?.data || response.data || [];
            if (data.data) data = data.data;
            setBudgetData(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch budget data:", error);
        }
    };

    const fetchTrackingData = async () => {
        setLoading(true);
        try {
            const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
            const weekStartStr = format(weekStart, 'yyyy-MM-dd');
            const weekNumber = getWeek(weekStart);
            const year = format(weekStart, 'yyyy');
            
            console.log(`📅 Fetching weekly usage for Week ${weekNumber}, ${year}`);
            
            // ✅ Get weekly usage for all departments
            const response = await mayorsOfficeAPI.getBudgetPeriods();
            console.log("📊 Budget Periods Response:", response);
            
            let data = response?.data?.data || response?.data || [];
            
            // ✅ Filter by week_start
            const filteredData = data.filter(item => item.week_start === weekStartStr);
            
            if (filteredData.length === 0) {
                console.log(`⚠️ No data for week ${weekStartStr}`);
                setDisplayData(null);
                setTrackingData([]);
                setLoading(false);
                return;
            }

            // ✅ Group and calculate per department
            const departmentUsage = filteredData.map((item) => {
                const deptInfo = budgetData.find(d => d.department_id === item.department_id);
                const allocated = parseFloat(item.allocated_amount || 0);
                const used = parseFloat(item.actual_used || 0);
                const remaining = allocated - used;
                const utilization = allocated > 0 ? (used / allocated) * 100 : 0;
                
                // Determine status
                let status = 'on_track';
                let statusLabel = 'On Track';
                let statusColor = 'bg-green-500';
                
                if (allocated === 0) {
                    status = 'no_budget';
                    statusLabel = 'No Budget';
                    statusColor = 'bg-slate-400';
                } else if (used >= allocated) {
                    status = 'exhausted';
                    statusLabel = 'Exhausted';
                    statusColor = 'bg-red-500';
                } else if (utilization >= 80) {
                    status = 'near_limit';
                    statusLabel = 'Near Limit';
                    statusColor = 'bg-orange-500';
                } else if (utilization >= 50) {
                    status = 'moderate';
                    statusLabel = 'Moderate';
                    statusColor = 'bg-yellow-500';
                }
                
                return {
                    department_id: item.department_id,
                    department_name: deptInfo?.department_name || item.department_name || `Department ${item.department_id}`,
                    department_code: deptInfo?.department_code || 'N/A',
                    allocated: allocated,
                    used: used,
                    remaining: remaining,
                    utilization: Math.round(utilization),
                    status: status,
                    status_label: statusLabel,
                    status_color: statusColor,
                    week_start: item.week_start,
                    week_end: item.week_end,
                };
            });

            // ✅ Calculate totals
            const totalAllocated = departmentUsage.reduce((sum, d) => sum + d.allocated, 0);
            const totalUsed = departmentUsage.reduce((sum, d) => sum + d.used, 0);
            const totalRemaining = totalAllocated - totalUsed;
            
            const weekData = {
                week_start: weekStartStr,
                week_end: format(endOfWeek(weekStart, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                week_number: weekNumber,
                year: year,
                departments: departmentUsage,
                total_allocated: totalAllocated,
                total_used: totalUsed,
                total_remaining: totalRemaining,
                is_active: departmentUsage.some(d => d.status === 'on_track' || d.status === 'moderate'),
                department_count: departmentUsage.length,
                departments_with_budget: departmentUsage.filter(d => d.allocated > 0).length,
            };

            console.log('✅ Week Data:', weekData);
            setDisplayData(weekData);
            setTrackingData([weekData]);
            
        } catch (error) {
            console.error("❌ Failed to fetch tracking data:", error);
            setDisplayData(null);
            setTrackingData([]);
            toast.error("Failed to load tracking data");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        Promise.all([fetchBudgetData(), fetchTrackingData()]);
        toast.success("Data refreshed");
    };

    const handlePrevWeek = () => {
        const newDate = subWeeks(currentWeek, 1);
        const monday = startOfWeek(newDate, { weekStartsOn: 1 });
        setCurrentWeek(monday);
    };

    const handleNextWeek = () => {
        const newDate = addWeeks(currentWeek, 1);
        const monday = startOfWeek(newDate, { weekStartsOn: 1 });
        setCurrentWeek(monday);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP",
            minimumFractionDigits: 2,
        }).format(amount || 0);
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        try {
            return format(new Date(dateString), "MMM dd, yyyy");
        } catch {
            return dateString;
        }
    };

    const getWeekNumber = (dateString) => {
        if (!dateString) return "N/A";
        try {
            return getWeek(new Date(dateString));
        } catch {
            return "N/A";
        }
    };

    const getWeekRange = (weekStart) => {
        if (!weekStart) return "N/A";
        try {
            const start = new Date(weekStart);
            const end = addDays(start, 6);
            return `${formatDate(start)} - ${formatDate(end)}`;
        } catch {
            return "N/A";
        }
    };

    // ✅ Get utilization badge
    const getUtilizationBadge = (percentage) => {
        if (percentage === 0) return <Badge className="bg-slate-400">No Usage</Badge>;
        if (percentage >= 100) return <Badge className="bg-red-500">Exhausted</Badge>;
        if (percentage >= 80) return <Badge className="bg-orange-500">Near Limit</Badge>;
        if (percentage >= 50) return <Badge className="bg-yellow-500">Moderate</Badge>;
        return <Badge className="bg-green-500">On Track</Badge>;
    };

    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    const currentWeekNumber = getWeek(weekStart);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const weekData = displayData || trackingData[0] || null;
    const departmentsList = weekData?.departments || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Weekly Budget Tracking
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Track weekly budget consumption per department
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="flex items-center gap-2"
                >
                    <RefreshCw
                        className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Refresh
                </Button>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
                <Button variant="outline" size="sm" onClick={handlePrevWeek}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                </Button>
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">
                        {formatDate(weekStart)} - {formatDate(weekEnd)}
                    </span>
                    <Badge variant="outline" className="ml-2">
                        Week {currentWeekNumber}
                    </Badge>
                    {weekData?.is_active && (
                        <Badge className="bg-green-100 text-green-700">
                            Active
                        </Badge>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={handleNextWeek}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-slate-500">Total Departments</p>
                        <p className="text-2xl font-bold">
                            {weekData?.department_count || 0}
                        </p>
                        <p className="text-xs text-slate-400">
                            {weekData?.departments_with_budget || 0} with budget
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-slate-500">Total Allocated</p>
                        <p className="text-2xl font-bold text-blue-600">
                            {formatCurrency(weekData?.total_allocated || 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-slate-500">Total Used</p>
                        <p className="text-2xl font-bold text-yellow-600">
                            {formatCurrency(weekData?.total_used || 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-slate-500">Total Remaining</p>
                        <p className={`text-2xl font-bold ${
                            (weekData?.total_remaining || 0) > 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                        }`}>
                            {formatCurrency(weekData?.total_remaining || 0)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Data Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-purple-500" />
                        Department-wise Weekly Usage
                        <span className="ml-2 text-sm font-normal text-slate-500">
                            Week {currentWeekNumber}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {!weekData || departmentsList.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <RotateCcw className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="text-slate-500 font-medium">No budget allocation for this week</p>
                            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                                This week has not been set up yet. Please go to <strong>Budget Allocation</strong> to set a weekly budget.
                            </p>
                            <Button 
                                variant="outline" 
                                className="mt-4"
                                onClick={() => window.location.href = '/mo/budget-allocation'}
                            >
                                Go to Budget Allocation
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-slate-50 dark:bg-slate-800">
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Department</th>
                                        <th className="text-left py-3 px-4 font-semibold text-slate-600">Code</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600">Allocated</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600">Used</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600">Remaining</th>
                                        <th className="text-right py-3 px-4 font-semibold text-slate-600">Utilization</th>
                                        <th className="text-center py-3 px-4 font-semibold text-slate-600">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departmentsList.map((dept, idx) => (
                                        <tr 
                                            key={dept.department_id || idx} 
                                            className={`border-b hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                                                dept.status === 'exhausted' ? 'bg-red-50/50 dark:bg-red-950/20' :
                                                dept.status === 'near_limit' ? 'bg-orange-50/50 dark:bg-orange-950/20' :
                                                dept.status === 'moderate' ? 'bg-yellow-50/50 dark:bg-yellow-950/20' :
                                                ''
                                            }`}
                                        >
                                            <td className="py-3 px-4 font-medium">
                                                {dept.department_name}
                                                {dept.allocated === 0 && (
                                                    <span className="text-xs text-slate-400 ml-2">(No Budget)</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">
                                                {dept.department_code}
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium text-blue-600">
                                                {formatCurrency(dept.allocated)}
                                            </td>
                                            <td className="py-3 px-4 text-right font-medium text-yellow-600">
                                                {formatCurrency(dept.used)}
                                            </td>
                                            <td className={`py-3 px-4 text-right font-medium ${
                                                dept.remaining > 0 ? 'text-green-600' : 
                                                dept.remaining < 0 ? 'text-red-600' : 'text-slate-400'
                                            }`}>
                                                {formatCurrency(dept.remaining)}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="font-medium">
                                                        {dept.utilization}%
                                                    </span>
                                                    <div className="w-16 bg-slate-200 rounded-full h-1.5">
                                                        <div 
                                                            className={`h-1.5 rounded-full ${
                                                                dept.utilization >= 100 ? 'bg-red-500' :
                                                                dept.utilization >= 80 ? 'bg-orange-500' :
                                                                dept.utilization >= 50 ? 'bg-yellow-500' :
                                                                dept.utilization > 0 ? 'bg-green-500' :
                                                                'bg-slate-300'
                                                            }`}
                                                            style={{ width: `${Math.min(dept.utilization, 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <Badge className={dept.status_color}>
                                                    {dept.status_label}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {/* Footer with Totals */}
                                <tfoot>
                                    <tr className="border-t-2 bg-slate-50 dark:bg-slate-800 font-semibold">
                                        <td className="py-3 px-4" colSpan="2">TOTAL</td>
                                        <td className="py-3 px-4 text-right text-blue-600">
                                            {formatCurrency(weekData?.total_allocated || 0)}
                                        </td>
                                        <td className="py-3 px-4 text-right text-yellow-600">
                                            {formatCurrency(weekData?.total_used || 0)}
                                        </td>
                                        <td className={`py-3 px-4 text-right ${
                                            (weekData?.total_remaining || 0) > 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {formatCurrency(weekData?.total_remaining || 0)}
                                        </td>
                                        <td className="py-3 px-4 text-right" colSpan="2"></td>
                                    </tr>
                                </tfoot>
                            </table>

                            {/* Overall Status Bar */}
                            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-500">Overall Weekly Utilization</span>
                                    <span className="font-semibold">
                                        {weekData?.total_allocated > 0 
                                            ? `${Math.round((weekData.total_used / weekData.total_allocated) * 100)}%`
                                            : '0%'}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                                    <div 
                                        className={`h-2 rounded-full ${
                                            (weekData?.total_used / weekData?.total_allocated) >= 0.8 ? 'bg-red-500' :
                                            (weekData?.total_used / weekData?.total_allocated) >= 0.5 ? 'bg-yellow-500' :
                                            'bg-green-500'
                                        }`}
                                        style={{ 
                                            width: `${Math.min((weekData?.total_used / weekData?.total_allocated) * 100, 100)}%` 
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 mt-1">
                                    <span>Used: {formatCurrency(weekData?.total_used || 0)}</span>
                                    <span>Remaining: {formatCurrency(weekData?.total_remaining || 0)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default WeeklyTracking;