import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download } from 'lucide-react';
import { revenueApi } from '../api';
import PageHeader from '../components/PageHeader';
import StatsCard from '../components/StatsCard';
import LoadingSpinner from '../components/LoadingSpinner';

const COLORS = ['#1e40af', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const Revenue = () => {
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    to: format(new Date(), 'yyyy-MM-dd')
  });

  const { data: summary, isLoading } = useQuery({
    queryKey: ['revenueSummary', dateRange],
    queryFn: () => revenueApi.summary(dateRange.from, dateRange.to)
  });

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  const breakdownData = summary?.breakdown || [];
  const dailyData = summary?.daily || [];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Revenue Reports" 
        action={
          <div className="flex space-x-2">
            <input 
              type="date" 
              value={dateRange.from}
              onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
              className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-primary focus:border-primary"
            />
            <span className="self-center text-gray-500">to</span>
            <input 
              type="date" 
              value={dateRange.to}
              onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-primary focus:border-primary"
            />
            <button className="ml-4 flex items-center px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 text-sm font-medium">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-primary rounded-lg p-6 shadow-sm text-white">
          <p className="text-sm font-medium opacity-80 uppercase tracking-wider">Total Revenue</p>
          <h3 className="text-3xl font-bold mt-1">${summary?.total?.toFixed(2) || '0.00'}</h3>
        </div>
        {breakdownData.slice(0, 3).map((item, idx) => (
          <div key={item.name} className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
            <p className="text-sm font-medium text-gray-500 uppercase tracking-wider capitalize">{item.name.replace('_', ' ')}</p>
            <h3 className="text-2xl font-bold text-gray-900 mt-1">${item.value.toFixed(2)}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Breakdown Pie Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue by Service</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdownData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {breakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Daily Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <XAxis dataKey="date" tickFormatter={(date) => format(new Date(date), 'MMM dd')} />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'MMM dd, yyyy')}
                  formatter={(value) => [`$${value.toFixed(2)}`, 'Revenue']}
                />
                <Bar dataKey="total" fill="#1e40af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Revenue;
