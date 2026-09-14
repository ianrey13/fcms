// resources/js/components/charts/TripTrendsChart.jsx
// ============================================
// ✅ Single lazy-loaded chart component
// Keeps Recharts context intact when lazy-loaded
// ============================================

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

const TripTrendsChart = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-slate-200 dark:stroke-slate-700"
                />
                <XAxis
                    dataKey="month"
                    className="text-slate-600 dark:text-slate-400 text-xs"
                />
                <YAxis className="text-slate-600 dark:text-slate-400 text-xs" />
                <Tooltip
                    contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)",
                    }}
                    labelClassName="text-slate-600 dark:text-slate-400"
                />
                <Area
                    type="monotone"
                    dataKey="trips"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="url(#colorTrips)"
                    className="transition-all duration-300"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
};

export default TripTrendsChart;