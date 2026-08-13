// src/pages/mayor/budget/BudgetHistory.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2, History, Filter, X,Plus,Edit, Calendar,Search, TrendingUp, TrendingDown, DollarSign, Clock, RotateCcw, ArrowLeft, Zap, Shield, Activity, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mayorsOfficeAPI } from '../../../services/api';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ============================================
// STATS CARD COMPONENT
// ============================================

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <Card className="dark:bg-slate-800/80 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{title}</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
                    {subtitle && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
                    )}
                    {trend !== undefined && (
                        <div className="flex items-center gap-1 mt-1 text-[10px]">
                            {trend > 0 ? (
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                            ) : trend < 0 ? (
                                <TrendingDown className="h-3 w-3 text-red-500" />
                            ) : (
                                <Activity className="h-3 w-3 text-slate-400" />
                            )}
                            <span className={trend > 0 ? 'text-emerald-600 dark:text-emerald-400' : trend < 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </span>
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                </div>
            </div>
        </CardContent>
    </Card>
);

// ============================================
// ACTION BADGE CONFIG
// ============================================

const getActionConfig = (action) => {
    const configs = {
        // Weekly actions
        'weekly_allocated': { 
            color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
            icon: Clock,
            label: 'Weekly Allocated',
            category: 'weekly'
        },
        'weekly_updated': { 
            color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
            icon: Clock,
            label: 'Weekly Updated',
            category: 'weekly'
        },
        'weekly_reset': { 
            color: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
            icon: RotateCcw,
            label: 'Weekly Reset',
            category: 'weekly'
        },
        'weekly_used': { 
            color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
            icon: TrendingDown,
            label: 'Weekly Used',
            category: 'weekly'
        },
        // Annual actions
        'annual_created': { 
            color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
            icon: DollarSign,
            label: 'Annual Created',
            category: 'annual'
        },
        'annual_added': { 
            color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
            icon: TrendingUp,
            label: 'Annual Added',
            category: 'annual'
        },
        'annual_updated': { 
            color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
            icon: DollarSign,
            label: 'Annual Updated',
            category: 'annual'
        },
        'surplus_returned': { 
            color: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
            icon: TrendingUp,
            label: 'Surplus Returned',
            category: 'other'
        },
        'activated': { 
            color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
            icon: CheckCircle,
            label: 'Activated',
            category: 'other'
        },
        'created': { 
            color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
            icon: CheckCircle,
            label: 'Created',
            category: 'other'
        },
        'added': { 
            color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
            icon: Plus,
            label: 'Added',
            category: 'other'
        },
        'updated': { 
            color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
            icon: Edit,
            label: 'Updated',
            category: 'other'
        },
        'deleted': { 
            color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
            icon: X,
            label: 'Deleted',
            category: 'other'
        },
    };
    return configs[action] || { 
        color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        icon: Activity,
        label: action?.replace(/_/g, ' ') || 'Updated',
        category: 'other'
    };
};

// ============================================
// ACTION BADGE COMPONENT
// ============================================

const ActionBadge = ({ action }) => {
    const config = getActionConfig(action);
    const Icon = config.icon;
    return (
        <Badge className={`${config.color} flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium`}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
};

// ============================================
// CATEGORY BADGE COMPONENT
// ============================================

const CategoryBadge = ({ category }) => {
    const configs = {
        weekly: { color: 'border-purple-300 text-purple-600 dark:border-purple-700 dark:text-purple-400', label: 'Weekly' },
        annual: { color: 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400', label: 'Annual' },
        other: { color: 'border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400', label: 'Other' },
    };
    const config = configs[category] || configs.other;
    return (
        <Badge variant="outline" className={`${config.color} text-[10px] font-medium`}>
            {config.label}
        </Badge>
    );
};

// ============================================
// LOADING SKELETON
// ============================================

const LoadingSkeleton = () => (
    <div className="space-y-6 p-4 md:p-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="h-12 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            ))}
        </div>
        <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

const BudgetHistory = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('');
    const [departments, setDepartments] = useState([]);
    const [actionFilter, setActionFilter] = useState('all');

    useEffect(() => {
        fetchHistory();
        fetchDepartments();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await mayorsOfficeAPI.getBudgetHistory();
            let data = response.data?.data || response.data || [];
            if (!Array.isArray(data)) data = [];
            setHistory(data);
        } catch (error) {
            console.error('Failed to fetch budget history:', error);
            toast.error('Failed to load budget history');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const fetchDepartments = async () => {
        try {
            const response = await mayorsOfficeAPI.getAllDepartmentsForSelector();
            const data = response.data?.data || response.data || [];
            setDepartments(data);
        } catch (error) {
            console.error('Failed to fetch departments:', error);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchHistory();
        toast.success('History refreshed');
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP',
            minimumFractionDigits: 2,
        }).format(amount || 0);
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), 'MMM dd, yyyy hh:mm a');
        } catch {
            return dateString;
        }
    };

    const isWeeklyAction = (action) => {
        return action === 'weekly_allocated' || 
               action === 'weekly_updated' || 
               action === 'weekly_reset' || 
               action === 'weekly_used';
    };

    const isAnnualAction = (action) => {
        return action === 'annual_created' || 
               action === 'annual_added' || 
               action === 'annual_updated';
    };

    const filteredHistory = history.filter(item => {
        const matchesSearch = filter === '' ||
            item.department_name?.toLowerCase().includes(filter.toLowerCase()) ||
            item.action?.toLowerCase().includes(filter.toLowerCase()) ||
            item.reason?.toLowerCase().includes(filter.toLowerCase());
        
        const matchesAction = actionFilter === 'all' || item.action === actionFilter;
        
        return matchesSearch && matchesAction;
    });

    // Stats
    const totalEntries = history.length;
    const weeklyAllocations = history.filter(h => isWeeklyAction(h.action)).length;
    const annualChanges = history.filter(h => isAnnualAction(h.action)).length;
    const otherActions = history.filter(h => !isWeeklyAction(h.action) && !isAnnualAction(h.action)).length;
    const weeklyResetCount = history.filter(h => h.action === 'weekly_reset').length;
    const annualCreateCount = history.filter(h => h.action === 'annual_created').length;

    const stats = [
        {
            title: "Total Entries",
            value: totalEntries,
            icon: History,
            color: "from-blue-500 to-blue-600",
            subtitle: "All budget changes",
            trend: totalEntries > 0 ? 5 : 0,
        },
        {
            title: "Weekly Changes",
            value: weeklyAllocations,
            icon: Clock,
            color: "from-purple-500 to-purple-600",
            subtitle: `${weeklyResetCount} resets`,
            trend: weeklyAllocations > 0 ? 8 : 0,
        },
        {
            title: "Annual Changes",
            value: annualChanges,
            icon: DollarSign,
            color: "from-emerald-500 to-emerald-600",
            subtitle: `${annualCreateCount} created`,
            trend: annualChanges > 0 ? 3 : 0,
        },
        {
            title: "Other Actions",
            value: otherActions,
            icon: Activity,
            color: "from-slate-500 to-slate-600",
            subtitle: "Additional changes",
            trend: otherActions > 0 ? 2 : 0,
        },
    ];

    // Get unique actions for filter
    const uniqueActions = [...new Set(history.map(item => item.action))].filter(Boolean);

    if (loading) {
        return <LoadingSkeleton />;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="space-y-6 p-4 md:p-6 animate-fade-in-up">
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
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20">
                                    <History className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                                        Budget History
                                    </h1>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        Track all budget changes across departments
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <Button 
                        variant="outline" 
                        onClick={handleRefresh} 
                        disabled={refreshing} 
                        className="dark:border-slate-700 dark:text-slate-300"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, index) => (
                        <StatsCard key={index} {...stat} />
                    ))}
                </div>

                {/* Filters */}
                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <div className="p-4 space-y-4">
                        <div className="flex flex-wrap gap-4">
                            {/* Search Filter */}
                            <div className="flex-1 min-w-[200px] relative">
                                <Input
                                    placeholder="Search by department, action, or reason..."
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                    className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                />
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            </div>
                            
                            {/* Action Filter */}
                            <div className="min-w-[180px]">
                                <select
                                    value={actionFilter}
                                    onChange={(e) => setActionFilter(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-900 dark:text-white dark:placeholder-slate-400"
                                >
                                    <option value="all">All Actions</option>
                                    <option value="weekly_allocated">📊 Weekly Allocated</option>
                                    <option value="weekly_updated">📊 Weekly Updated</option>
                                    <option value="weekly_reset">🔄 Weekly Reset</option>
                                    <option value="weekly_used">📉 Weekly Used</option>
                                    <option value="annual_created">💰 Annual Created</option>
                                    <option value="annual_added">💰 Annual Added</option>
                                    <option value="annual_updated">💰 Annual Updated</option>
                                    <option value="surplus_returned">↩️ Surplus Returned</option>
                                </select>
                            </div>

                            {/* Clear Filters */}
                            {(filter || actionFilter !== 'all') && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setFilter('');
                                        setActionFilter('all');
                                    }} 
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                    <X className="h-4 w-4 mr-2" />
                                    Clear Filters
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>

                {/* History List */}
                <Card className="dark:bg-slate-800/80 dark:border-slate-700 shadow-xl shadow-black/5">
                    <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white">
                                    <History className="h-5 w-5 text-purple-500" />
                                    All Budget Changes
                                </CardTitle>
                                <CardDescription className="dark:text-slate-400">
                                    {filteredHistory.length} entry{filteredHistory.length !== 1 ? 's' : ''} found
                                    {filteredHistory.length !== history.length && ` (filtered from ${history.length} total)`}
                                </CardDescription>
                            </div>
                            {filteredHistory.length > 0 && (
                                <Badge className="bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30">
                                    <Zap className="h-3 w-3 mr-1" />
                                    {filteredHistory.length} records
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {filteredHistory.length === 0 ? (
                            <div className="text-center py-16">
                                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                                    <History className="h-10 w-10 text-slate-400 dark:text-slate-500" />
                                </div>
                                <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">No budget history found</p>
                                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                                    {history.length === 0 
                                        ? 'Budget changes will appear here'
                                        : 'Try adjusting your filters'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredHistory.map((entry, index) => {
                                    const isWeekly = isWeeklyAction(entry.action);
                                    const isAnnual = isAnnualAction(entry.action);
                                    const config = getActionConfig(entry.action);
                                    const category = config.category;
                                    const diffAmount = (entry.added_amount || entry.amount || 0) - (entry.previous_amount || 0);
                                    const isIncrease = diffAmount > 0;
                                    
                                    return (
                                        <div 
                                            key={entry.id || index} 
                                            className={cn(
                                                "border rounded-xl p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors",
                                                isWeekly ? "border-l-4 border-l-purple-400 dark:border-l-purple-500" : 
                                                isAnnual ? "border-l-4 border-l-emerald-400 dark:border-l-emerald-500" : 
                                                "border-l-4 border-l-slate-300 dark:border-l-slate-600",
                                                "border border-slate-200 dark:border-slate-700"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                        <ActionBadge action={entry.action} />
                                                        <h4 className="font-semibold text-slate-900 dark:text-white">
                                                            {entry.department_name || 'Unknown'}
                                                        </h4>
                                                        {category !== 'other' && (
                                                            <CategoryBadge category={category} />
                                                        )}
                                                    </div>
                                                    
                                                    {/* Weekly Actions */}
                                                    {isWeekly && (
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">Weekly Allocation:</span>
                                                                <span className="font-medium ml-1 text-purple-600 dark:text-purple-400">
                                                                    {formatCurrency(entry.new_amount || entry.amount || 0)}
                                                                </span>
                                                            </div>
                                                            {entry.previous_amount > 0 && (
                                                                <div>
                                                                    <span className="text-slate-500 dark:text-slate-400">Previous:</span>
                                                                    <span className="font-medium ml-1 text-slate-600 dark:text-slate-300">
                                                                        {formatCurrency(entry.previous_amount)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">By:</span>
                                                                <span className="font-medium ml-1 text-slate-700 dark:text-slate-300">
                                                                    {entry.user_name || 'System'}
                                                                </span>
                                                            </div>
                                                            {entry.reason && (
                                                                <div className="col-span-2 md:col-span-3">
                                                                    <span className="text-slate-400 dark:text-slate-500">Reason:</span>
                                                                    <span className="text-sm text-slate-600 dark:text-slate-300 ml-1">
                                                                        {entry.reason}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Annual Actions */}
                                                    {isAnnual && (
                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">Before:</span>
                                                                <span className="font-medium ml-1 text-slate-600 dark:text-slate-300">
                                                                    {formatCurrency(entry.previous_amount || 0)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className={isIncrease ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                                                    {isIncrease ? '+ Added:' : 'Change:'}
                                                                </span>
                                                                <span className={`font-medium ml-1 ${isIncrease ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                    {formatCurrency(entry.added_amount || entry.amount || 0)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">After:</span>
                                                                <span className="font-medium text-blue-600 dark:text-blue-400 ml-1">
                                                                    {formatCurrency(entry.new_amount || 0)}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">By:</span>
                                                                <span className="font-medium ml-1 text-slate-700 dark:text-slate-300">
                                                                    {entry.user_name || 'System'}
                                                                </span>
                                                            </div>
                                                            {entry.reason && (
                                                                <div className="col-span-2 md:col-span-4">
                                                                    <span className="text-slate-400 dark:text-slate-500">Reason:</span>
                                                                    <span className="text-sm text-slate-600 dark:text-slate-300 ml-1">
                                                                        {entry.reason}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Other Actions */}
                                                    {!isWeekly && !isAnnual && (
                                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                                            {entry.previous_amount !== undefined && (
                                                                <div>
                                                                    <span className="text-slate-500 dark:text-slate-400">Before:</span>
                                                                    <span className="font-medium ml-1 text-slate-600 dark:text-slate-300">
                                                                        {formatCurrency(entry.previous_amount)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {entry.new_amount !== undefined && (
                                                                <div>
                                                                    <span className="text-slate-500 dark:text-slate-400">After:</span>
                                                                    <span className="font-medium ml-1 text-blue-600 dark:text-blue-400">
                                                                        {formatCurrency(entry.new_amount)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <span className="text-slate-500 dark:text-slate-400">By:</span>
                                                                <span className="font-medium ml-1 text-slate-700 dark:text-slate-300">
                                                                    {entry.user_name || 'System'}
                                                                </span>
                                                            </div>
                                                            {entry.reason && (
                                                                <div className="col-span-2 md:col-span-3">
                                                                    <span className="text-slate-400 dark:text-slate-500">Reason:</span>
                                                                    <span className="text-sm text-slate-600 dark:text-slate-300 ml-1">
                                                                        {entry.reason}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {formatDateTime(entry.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p>FCMS - Mayor's Office • Budget History</p>
                    <p className="mt-0.5">{history.length} total entries • {weeklyAllocations} weekly • {annualChanges} annual</p>
                </div>
            </div>
        </div>
    );
};

export default BudgetHistory;