import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Monitor, UserCheck, IndianRupee, StopCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi, revenueApi, sessionsApi, terminalsApi } from '../api';
import PageHeader from '../components/PageHeader';
import StatsCard from '../components/StatsCard';
import TerminalCard from '../components/TerminalCard';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SessionTimer from '../components/SessionTimer';

const Dashboard = () => {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch } = useQuery({
    queryKey: ['adminStats'],
    queryFn: adminApi.getStats,
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const { data: terminals = [], isLoading: terminalsLoading, isError: terminalsError } = useQuery({
    queryKey: ['terminals'],
    queryFn: terminalsApi.list,
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const { data: activeSessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: () => sessionsApi.list({ status: 'active' }),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const { data: dailyRevenue } = useQuery({
    queryKey: ['dailyRevenue'],
    queryFn: () => revenueApi.daily(),
    refetchInterval: 60000,
    placeholderData: (prev) => prev,
  });

  const endSessionMutation = useMutation({
    mutationFn: sessionsApi.endSession,
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: ['terminals'] });
      await queryClient.cancelQueries({ queryKey: ['activeSessions'] });
      const target = activeSessions.find((s) => s.id === sessionId);
      if (target) {
        queryClient.setQueryData(['terminals'], (old = []) =>
          old.map((t) => t.id === target.terminal_id ? { ...t, status: 'available', current_session: null } : t)
        );
        queryClient.setQueryData(['activeSessions'], (old = []) =>
          old.filter((s) => s.id !== sessionId)
        );
      }
    },
    onSettled: () => {
      ['adminStats', 'terminals', 'activeSessions', 'sessions', 'customers', 'dailyRevenue', 'sessionHistorySummary']
        .forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });

  // Only show spinner on very first load (no cached data at all)
  const isFirstLoad =
    (statsLoading && !stats) ||
    (terminalsLoading && terminals.length === 0) ||
    (sessionsLoading && activeSessions.length === 0);

  const hasError = statsError || terminalsError;

  const chartData = [
    { name: 'Browsing', value: dailyRevenue?.browsing_revenue || 0 },
    { name: 'Gaming',   value: dailyRevenue?.gaming_revenue   || 0 },
    { name: 'Academic', value: dailyRevenue?.academic_revenue  || 0 },
    { name: 'Printing', value: (dailyRevenue?.plain_print_revenue || 0) + (dailyRevenue?.colour_print_revenue || 0) },
    { name: 'Xerox',    value: dailyRevenue?.xerox_revenue    || 0 },
  ].filter((d) => d.value > 0);

  const totalRev = Number(stats?.today_revenue ?? dailyRevenue?.total_revenue ?? 0);

  const sessionColumns = [
    {
      header: 'Customer',
      cell: (r) => <span className="font-bold text-gray-900">{r.customer_name || '—'}</span>,
    },
    {
      header: 'Terminal',
      cell: (r) => (
        <span className="px-2 py-0.5 rounded text-xs font-black bg-red-100 text-red-800 border border-red-200">
          {r.terminal_number || 'N/A'}
        </span>
      ),
    },
    {
      header: 'Type',
      cell: (r) => (
        <span className="capitalize font-semibold text-gray-700">{r.terminal_type_name || 'PC'}</span>
      ),
    },
    {
      header: 'Time Left',
      cell: (r) => <SessionTimer endTime={r.expected_end_time} />,
    },
    {
      header: 'Status',
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      header: 'Action',
      cell: (r) => (
        <button
          onClick={() =>
            window.confirm(`Checkout customer ${r.customer_name} from Terminal ${r.terminal_number}? Seat will become available.`) &&
            endSessionMutation.mutate(r.id)
          }
          disabled={endSessionMutation.isPending}
          className="flex items-center text-xs font-black text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 disabled:opacity-50"
        >
          <StopCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
          <span>Customer Exit (Free Seat)</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Real-Time Dashboard"
        subtitle="Live terminal grid, active sessions, and today's revenue"
      />

      {/* Banners */}
      {isFirstLoad && (
        <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
          <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Connecting to server… Render free tier may take up to 30 seconds to wake up.</span>
        </div>
      )}
      {!isFirstLoad && hasError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Connecting to backend... If this is the first visit, Render free tier takes ~30 seconds to wake up.</span>
          </div>
          <button onClick={() => refetch()} className="ml-4 text-xs font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard
          title="Active Sessions"
          value={stats?.active_sessions ?? activeSessions.length}
          icon={Users}
        />
        <StatsCard
          title="Available Terminals"
          value={stats?.available_terminals ?? terminals.filter((t) => t.status === 'available').length}
          icon={Monitor}
        />
        <StatsCard
          title="Total Customers"
          value={stats?.total_customers ?? 0}
          icon={UserCheck}
        />
        <StatsCard
          title="Today's Revenue"
          value={`₹${totalRev.toFixed(2)}`}
          icon={IndianRupee}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Terminal Grid + Active Sessions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Terminal Grid</h3>
              <span className="text-xs text-gray-500">Available / Occupied / Maintenance</span>
            </div>
            {terminals.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">
                {isFirstLoad ? 'Loading terminals…' : 'No terminals yet. Add them in the Terminals page.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {terminals.map((terminal) => {
                  const session = activeSessions.find((s) => Number(s.terminal_id) === Number(terminal.id)) || terminal.current_session;
                  return <TerminalCard key={terminal.id} terminal={terminal} session={session} />;
                })}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Live Active Sessions</h3>
            <DataTable
              columns={sessionColumns}
              data={activeSessions}
              loading={sessionsLoading && activeSessions.length === 0}
            />
          </div>
        </div>

        {/* Right: Revenue */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <h3 className="text-lg font-bold text-gray-800 mb-1">Today's Revenue</h3>
          <p className="text-xs text-gray-500 mb-4">Service-wise earnings in ₹ (INR)</p>
          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val) => [`₹${Number(val).toFixed(2)}`, 'Revenue']} />
                  <Bar dataKey="value" fill="#1e40af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center text-gray-400 text-sm">
                <span>No revenue yet today.</span>
                <span className="text-xs mt-1">Complete a session to see the breakdown.</span>
              </div>
            )}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5 text-xs">
            {[
              ['Browsing', dailyRevenue?.browsing_revenue],
              ['Gaming', dailyRevenue?.gaming_revenue],
              ['Academic', dailyRevenue?.academic_revenue],
              ['Printing & Xerox',
                (dailyRevenue?.plain_print_revenue || 0) +
                (dailyRevenue?.colour_print_revenue || 0) +
                (dailyRevenue?.xerox_revenue || 0)],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between text-gray-600">
                <span>{label}:</span>
                <span className="font-semibold text-gray-900">₹{Number(val || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
