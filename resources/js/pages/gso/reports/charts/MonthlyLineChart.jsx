// src/pages/gso/reports/charts/MonthlyLineChart.jsx
import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { formatNumber } from '../_helpers';

const MonthlyLineChart = ({ data }) => {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => typeof value === 'number' ? formatNumber(value) : value} />
                <Legend />
                <Line type="monotone" dataKey="fuel" stroke="#3b82f6" name="Fuel (L)" strokeWidth={2} />
                <Line type="monotone" dataKey="trips" stroke="#10b981" name="Trips" strokeWidth={2} />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default MonthlyLineChart;