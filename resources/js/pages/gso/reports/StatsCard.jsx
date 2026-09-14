// src/pages/gso/reports/StatsCard.jsx
import React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

const StatsCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
    <div className="bg-white dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200/60 dark:border-slate-700/60 hover:shadow-lg transition-all duration-300">
        <div className="flex items-center justify-between">
            <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {title}
                </p>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
                {subtitle && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>
                )}
            </div>
            <div className={`p-2.5 rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                <Icon className="h-5 w-5 text-white" />
            </div>
        </div>
        {trend !== undefined && trend !== null && (
            <div className="flex items-center gap-1 mt-2 text-[10px]">
                {trend > 0 ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500" />
                ) : trend < 0 ? (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                ) : (
                    <Activity className="h-3 w-3 text-slate-400" />
                )}
                <span className={trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-slate-400'}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
            </div>
        )}
    </div>
);

export default StatsCard;