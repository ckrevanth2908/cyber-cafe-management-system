import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download, IndianRupee } from 'lucide-react';
import { revenueApi } from '../api';
import PageHeader from '../components/PageHeader';
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
    return <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  const totals = summary?.totals || {};
  const totalRevenue = Number(totals.total_revenue || summary?.total || 0);

  const breakdownData = [
    { name: 'Browsing', value: Number(totals.total_browsing || 0) },
    { name: 'Gaming', value: Number(totals.total_gaming || 0) },
    { name: 'Academic', value: Number(totals.total_academic || 0) },
    { name: 'Plain Print', value: Number(totals.total_plain_print || 0) },
    { name: 'Colour Print', value: Number(totals.total_colour_print || 0) },
    { name: 'Xerox Copy', value: Number(totals.total_xerox || 0) }
  ].filter(i => i.value > 0);

  const dailyRecords = (summary?.daily_records || summary?.daily || []).map(d => ({
    date: d.date,
    total: Number(d.total_revenue || d.total || 0),
    sessions: d.num_sessions || 0,
    prints: d.num_print_transactions || 0
  }));

  const handleExportCSV = () => {
    if (!dailyRecords.length) {
      alert('No records to export for selected dates.');
      return;
    }
    const headers = ['Date', 'Total Revenue (INR)', 'Sessions Completed', 'Print Jobs'];
    const rows = dailyRecords.map(r => [r.date, r.total, r.sessions, r.prints]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cybercafe_revenue_${dateRange.from}_to_${dateRange.to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Revenue & Financial Reports" 
        subtitle="Detailed service-wise breakdown, historical earnings, and downloadable CSV audits in ₹ (INR)"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2 bg-white p-1 rounded-md border border-gray-300 shadow-sm">
              <input 
                type="date" 
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="border-0 py-1 px-2 text-xs focus:ring-0 text-gray-700"
              />
              <span className="text-xs text-gray-400">to</span>
              <input 
                type="date" 
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="border-0 py-1 px-2 text-xs focus:ring-0 text-gray-700"
              />
            </div>
            <button 
              onClick={handleExportCSV}
              className="flex items-center px-3.5 py-2 border border-gray-300 bg-white text-gray-700 rounded-md hover:bg-gray-50 text-xs font-semibold shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-primary rounded-xl p-5 shadow-sm text-white flex flex-col justify-between">
          <p className="text-xs font-bold tracking-wider opacity-80 uppercase">Total Revenue ({dateRange.from} to {dateRange.to})</p>
          <h3 className="text-3xl font-black mt-2">₹{totalRevenue.toFixed(2)}</h3>
          <p className="text-xs opacity-75 mt-2">{totals.total_sessions || 0} sessions • {totals.total_print_transactions || 0} print jobs</p>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase">Computer Usage Earnings</p>
          <h3 className="text-2xl font-black text-gray-900 mt-2">
            ₹{((totals.total_browsing || 0) + (totals.total_gaming || 0) + (totals.total_academic || 0)).toFixed(2)}
          </h3>
          <div className="text-xs text-gray-500 mt-2 space-y-0.5">
            <div>Browsing: ₹{Number(totals.total_browsing || 0).toFixed(2)}</div>
            <div>Gaming: ₹{Number(totals.total_gaming || 0).toFixed(2)}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase">Printing & Xerox Earnings</p>
          <h3 className="text-2xl font-black text-gray-900 mt-2">
            ₹{((totals.total_plain_print || 0) + (totals.total_colour_print || 0) + (totals.total_xerox || 0)).toFixed(2)}
          </h3>
          <div className="text-xs text-gray-500 mt-2 space-y-0.5">
            <div>Printouts: ₹{((totals.total_plain_print || 0) + (totals.total_colour_print || 0)).toFixed(2)}</div>
            <div>Xerox Copies: ₹{Number(totals.total_xerox || 0).toFixed(2)}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-200">
          <p className="text-xs font-semibold text-gray-500 uppercase">Total Operations</p>
          <h3 className="text-2xl font-black text-gray-900 mt-2">
            {(totals.total_sessions || 0) + (totals.total_print_transactions || 0)}
          </h3>
          <p className="text-xs text-gray-500 mt-2">Completed customer transactions across period</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Breakdown Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Service-Wise Distribution</h3>
          <p className="text-xs text-gray-500 mb-4">Proportion of revenue generated by service category</p>
          <div className="h-64">
            {breakdownData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {breakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`₹${Number(value).toFixed(2)}`, 'Revenue']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                No breakdown data for selected dates.
              </div>
            )}
          </div>
        </div>

        {/* Daily Trend Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">Daily Revenue Trend</h3>
          <p className="text-xs text-gray-500 mb-4">Total ₹ collected per calendar day</p>
          <div className="h-64">
            {dailyRecords.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyRecords}>
                  <XAxis dataKey="date" tickFormatter={(d) => format(new Date(d), 'MMM dd')} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    labelFormatter={(d) => format(new Date(d), 'dd MMM yyyy')}
                    formatter={(val) => [`₹${Number(val).toFixed(2)}`, 'Revenue']}
                  />
                  <Bar dataKey="total" fill="#1e40af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-400 text-sm">
                No revenue recorded in this date range.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Revenue;
