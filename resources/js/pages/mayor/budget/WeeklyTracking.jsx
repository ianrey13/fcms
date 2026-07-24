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
} from "lucide-react";
import { mayorsOfficeAPI } from "../../../services/api";
import { toast } from "react-hot-toast";
import { format, addDays as addDaysFn, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";

const WeeklyTracking = () => {
    const [trackingData, setTrackingData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    // ✅ FIXED: Start with Monday
    const [currentWeek, setCurrentWeek] = useState(() => {
        const today = new Date();
        return startOfWeek(today, { weekStartsOn: 1 });
    });
    const [departments, setDepartments] = useState([]);
    const [budgetData, setBudgetData] = useState([]);
    const [displayData, setDisplayData] = useState(null);

    // ✅ Fetch departments and budget data on mount
    useEffect(() => {
    const today = new Date();
    const monday = startOfWeek(today, { weekStartsOn: 1 });
    console.log("📅 Setting currentWeek to Monday:", monday);
    setCurrentWeek(monday);
    
    fetchDepartments();
    fetchBudgetData();
}, []);

    // ✅ Fetch tracking data when currentWeek, budgetData, or departments change
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
            console.log("📊 Budget Data for Weekly Tracking:", response);
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
        // ✅ FIXED: Gamiton ang format imbes toISOString()
        const weekStartStr = format(weekStart, 'yyyy-MM-dd');
        
        console.log(`📅 CurrentWeek:`, currentWeek);
        console.log(`📅 WeekStart (Monday):`, weekStart);
        console.log(`📅 Fetching data for week: ${weekStartStr}`);
        
        const response = await mayorsOfficeAPI.getBudgetPeriods();
        console.log("📊 Budget Periods Response:", response);
        
        let data = response?.data?.data || response?.data || [];
        
        let weekData = null;
        
        if (Array.isArray(data) && data.length > 0) {
            const foundWeek = data.filter(item => item.week_start === weekStartStr);
            console.log(`🔍 Found ${foundWeek.length} records for week ${weekStartStr}`);
            
            if (foundWeek.length > 0) {
                const grouped = {};
                foundWeek.forEach((item) => {
                    const weekKey = item.week_start;
                    if (!grouped[weekKey]) {
                        grouped[weekKey] = {
                            week_start: item.week_start,
                            week_end: item.week_end || addDaysFn(new Date(item.week_start), 6).toISOString().split("T")[0],
                            departments: [],
                            total_allocated: 0,
                            status: item.status || "inactive",
                            closed_at: item.closed_at,
                        };
                    }
                    
                    const deptInfo = budgetData.find(d => d.department_id === item.department_id);
                    
                    grouped[weekKey].departments.push({
                        department_id: item.department_id,
                        department_name: deptInfo?.department_name || item.department_name || `Department ${item.department_id}`,
                        allocated_amount: parseFloat(item.allocated_amount || 0),
                        actual_used: parseFloat(item.actual_used || 0),
                    });
                    grouped[weekKey].total_allocated += parseFloat(item.allocated_amount || 0);
                });
                
                const groupedData = Object.values(grouped);
                weekData = groupedData.length > 0 ? groupedData[0] : null;
                console.log(`✅ Found data for week ${weekStartStr}:`, weekData);
            }
        }
        
        if (!weekData) {
            console.log(`⚠️ No data for week ${weekStartStr}, showing empty state`);
            setDisplayData(null);
            setTrackingData([]);
            setLoading(false);
            return;
        }
        
        setDisplayData(weekData);
        setTrackingData(weekData ? [weekData] : []);
        
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
        console.log(`⬅️ Moving to previous week: ${monday}`);
        setCurrentWeek(monday);
    };

    const handleNextWeek = () => {
        const newDate = addWeeks(currentWeek, 1);
        const monday = startOfWeek(newDate, { weekStartsOn: 1 });
        console.log(`➡️ Moving to next week: ${monday}`);
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
            const date = new Date(dateString);
            const startOfYear = new Date(date.getFullYear(), 0, 1);
            const diff = date - startOfYear;
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            return Math.ceil((days + startOfYear.getDay() + 1) / 7);
        } catch {
            return "N/A";
        }
    };

    const getWeekRange = (weekStart) => {
        if (!weekStart) return "N/A";
        try {
            const start = new Date(weekStart);
            const end = addDaysFn(start, 6);
            return `${formatDate(start)} - ${formatDate(end)}`;
        } catch {
            return "N/A";
        }
    };

    // ✅ Get current week info for display
    const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
    const currentWeekNumber = getWeekNumber(weekStart);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    const weekData = displayData || trackingData[0] || null;
    const departmentsList = weekData?.departments || [];
    const isCurrentWeek = weekData?.status === "active";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                        Weekly Budget Tracking
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Track weekly budget allocations across all departments
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
                    {isCurrentWeek && (
                        <Badge className="bg-green-100 text-green-700">
                            Current Week
                        </Badge>
                    )}
                </div>
                <Button variant="outline" size="sm" onClick={handleNextWeek}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-slate-500">
                            Total Departments
                        </p>
                        <p className="text-2xl font-bold">
                            {departmentsList.length}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-slate-500">
                            Total Weekly Allocation
                        </p>
                        <p className="text-2xl font-bold text-purple-600">
                            {formatCurrency(weekData?.total_allocated || 0)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-sm text-slate-500">Status</p>
                        <div className="text-2xl font-bold mt-1">
                            {isCurrentWeek ? (
                                <Badge className="bg-green-500">Active</Badge>
                            ) : (
                                <Badge className="bg-gray-500">Inactive</Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Weekly Data */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-purple-500" />
                        Weekly Allocations
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
                        <div className="space-y-4">
                            <div className={`border rounded-lg p-4 ${isCurrentWeek ? "bg-green-50 border-green-200" : "bg-white"}`}>
                                <div className="flex items-start gap-3">
                                    <div className={`p-2 rounded-full ${isCurrentWeek ? "bg-green-100" : "bg-gray-100"}`}>
                                        <Calendar className={`h-5 w-5 ${isCurrentWeek ? "text-green-600" : "text-gray-500"}`} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="font-semibold text-lg">
                                                Week {getWeekNumber(weekData.week_start)}
                                            </h4>
                                            {isCurrentWeek ? (
                                                <Badge className="bg-green-100 text-green-700">Current Week</Badge>
                                            ) : (
                                                <Badge className="bg-gray-100 text-gray-700">Past</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-600">
                                            {getWeekRange(weekData.week_start)}
                                        </p>
                                        <div className="flex flex-wrap gap-3 mt-1 text-sm">
                                            <span className="text-slate-500">
                                                <strong>{departmentsList.length}</strong> departments
                                            </span>
                                            <span className="text-slate-500">
                                                Total: <strong className="text-purple-600">{formatCurrency(weekData.total_allocated)}</strong>
                                            </span>
                                            {weekData.closed_at && (
                                                <span className="text-slate-400">
                                                    Closed: {formatDate(weekData.closed_at)}
                                                </span>
                                            )}
                                        </div>

                                        {/* Department breakdown */}
                                        {departmentsList.length > 0 && (
                                            <div className="mt-3 pt-3 border-t">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="text-left text-xs text-slate-500">
                                                            <th className="pb-1">Department</th>
                                                            <th className="pb-1 text-right">Allocated</th>
                                                            <th className="pb-1 text-right">Used</th>
                                                            <th className="pb-1 text-right">Surplus</th>
                                                            <th className="pb-1 text-center">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {departmentsList.map((dept, idx) => {
                                                            const surplus = dept.allocated_amount - (dept.actual_used || 0);
                                                            const hasSurplus = surplus > 0;
                                                            const isZero = dept.allocated_amount === 0;

                                                            return (
                                                                <tr key={idx} className="border-t border-slate-100">
                                                                    <td className="py-1">
                                                                        {dept.department_name}
                                                                        {isZero && (
                                                                            <span className="text-xs text-slate-400 ml-1">(No Budget)</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="py-1 text-right">
                                                                        {formatCurrency(dept.allocated_amount)}
                                                                    </td>
                                                                    <td className="py-1 text-right">
                                                                        {formatCurrency(dept.actual_used || 0)}
                                                                    </td>
                                                                    <td className={`py-1 text-right font-medium ${hasSurplus ? "text-green-600" : "text-slate-400"}`}>
                                                                        {hasSurplus ? `+${formatCurrency(surplus)}` : formatCurrency(0)}
                                                                    </td>
                                                                    <td className="py-1 text-center">
                                                                        {hasSurplus ? (
                                                                            <Badge className="bg-green-100 text-green-700 text-xs">
                                                                                ✅ Returned
                                                                            </Badge>
                                                                        ) : (
                                                                            <Badge className="bg-gray-100 text-gray-500 text-xs">
                                                                                Used
                                                                            </Badge>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
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