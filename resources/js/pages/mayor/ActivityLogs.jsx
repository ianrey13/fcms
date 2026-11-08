// src/pages/mo/ActivityLogs.jsx
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Activity, Loader2 } from 'lucide-react';
import { cachedApi } from '../../services/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

    // ✅ Filter to ONLY show audit logs
    const auditLogs = useMemo(() => {
        const allLogs = data?.logs || [];
        return allLogs.filter(l => l.source === 'audit');
    }, [data]);

    const formatLogText = (log) => {
        const userName = log.user_name || 'Unknown User';
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
                                System actions performed by Mayor's Office users
                            </p>
                        </div>
                    </div>
                </div>

                <Card className="dark:bg-slate-800/80 dark:border-slate-700">
                    <CardHeader className="border-b border-slate-200/60 dark:border-slate-700/60">
                        <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-white text-base">
                            <Activity className="h-4 w-4 text-emerald-500" />
                            Recent Activity
                            <Badge variant="secondary" className="ml-2 text-xs">
                                {auditLogs.length} entries
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {isLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                            </div>
                        ) : auditLogs.length === 0 ? (
                            <div className="text-center py-12">
                                <Activity className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-500 dark:text-slate-400">
                                    No activity log entries found
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                                {auditLogs.map((log, i) => (
                                    <div
                                        key={log.id || i}
                                        className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                                    >
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                {formatLogText(log)}
                                            </p>
                                        </div>
                                        <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                                            {log.created_at
                                                ? format(new Date(log.created_at), 'dd/MM/yyyy, h:mm a')
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