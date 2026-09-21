// src/pages/mo/ActivityLogs.jsx
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Activity, Loader2, DollarSign } from 'lucide-react';
import { cachedApi } from '../../services/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const FILTERS = [
    { key: 'all', label: 'All', icon: null },
    { key: 'audit', label: 'Activity Log', icon: null },
    { key: 'budget', label: 'Budget History', icon: DollarSign },
];

const ActivityLogs = () => {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('all');

    const { data, isLoading } = useQuery({
        queryKey: ['activity-logs', 'mayors_office'],
        queryFn: async () => {
            const res = await cachedApi.get('/mayors-office/activity-logs');
            return res.data?.data || { logs: [], summary: {} };
        },
        staleTime: 0,
        refetchOnMount: 'always',
    });

    const allLogs = data?.logs || [];

    // ✅ Counts per filter
    const counts = useMemo(() => ({
        all: allLogs.length,
        audit: allLogs.filter(l => l.source === 'audit').length,
        budget: allLogs.filter(l => l.source === 'budget').length,
    }), [allLogs]);

    // ✅ Filtered list
    const logs = useMemo(() => {
        if (filter === 'all') return allLogs;
        return allLogs.filter(l => l.source === filter);
    }, [allLogs, filter]);

    const formatLogText = (log) => {
        const userName = log.user_name || 'Unknown User';

        // ── Budget history branch ──
        if (log.source === 'budget') {
            const dept = log.department_name || 'a department';
            const action = (log.action || '').toLowerCase();
            const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            switch (action) {
                case 'annual_created':
                    return `${userName} created annual budget ${fmt(log.new_amount)} for ${dept}`;
                case 'annual_updated':
                    return `${userName} updated annual budget for ${dept} (${fmt(log.previous_amount)} → ${fmt(log.new_amount)})`;
                case 'annual_added':
                    return `${userName} added ${fmt(log.added_amount)} to ${dept} (new total: ${fmt(log.new_amount)})`;
                case 'weekly_allocated':
                    return `${userName} set weekly ceiling for ${dept} to ${fmt(log.new_amount)}`;
                case 'weekly_reset':
                    return `${userName} triggered weekly budget reset`;
                default:
                    return `${userName} ${action.replace(/_/g, ' ')} for ${dept}`;
            }
        }

        // ── Audit log branch ──
        const action = (log.action || '').toLowerCase();
        const module = (log.module || '').replace(/_/g, ' ');
        const details = log.details || '';
        const match = details.match(/(?:Created|Updated|Deleted)\s+(.+)/i);
        const target = match ? match[1] : module;
        return `${userName} ${action} ${module} ${target}`.trim();
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="max-w-4xl mx-auto p-4 md:p-6">
                <div className="flex items-center gap-3 mb-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/mo/dashboard')}
                        className="rounded-xl h-10 w-10"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg">
                            <Activity className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                                Activity Logs
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Actions performed by Mayor's Office users
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {FILTERS.map(({ key, label, icon: Icon }) => {
                        const active = filter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setFilter(key)}
                                className={cn(
                                    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border",
                                    active
                                        ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20"
                                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                )}
                            >
                                {Icon && <Icon className="h-4 w-4" />}
                                {label}
                                <span
                                    className={cn(
                                        "ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                                        active
                                            ? "bg-white/20 text-white"
                                            : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                                    )}
                                >
                                    {counts[key]}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white text-base">
                            <Activity className="h-4 w-4 text-emerald-500" />
                            Recent Activity
                            <Badge variant="secondary" className="ml-2 text-xs">
                                {logs.length} entries
                            </Badge>
                        </CardTitle>
                        <CardDescription className="dark:text-slate-400">
                            Latest actions from your office
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            </div>
                        ) : logs.length === 0 ? (
                            <div className="text-center py-12">
                                <Activity className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">
                                    {filter === 'all'
                                        ? 'No activity yet'
                                        : filter === 'audit'
                                        ? 'No activity log entries'
                                        : 'No budget history entries'}
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {logs.map((log, i) => (
                                    <div
                                        key={log.id || i}
                                        className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            {log.source === 'budget' && (
                                                <DollarSign className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                            )}
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                {formatLogText(log)}
                                            </p>
                                        </div>
                                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                                            {log.created_at
                                                ? format(
    new Date(
        log.created_at.endsWith('Z') || log.created_at.includes('+')
            ? log.created_at
            : log.created_at.replace(' ', 'T') + 'Z'
    ),
    'dd/MM/yyyy, h:mm a'
)
                                                : 'N/A'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ActivityLogs;