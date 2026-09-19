import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Monitor, UserCheck, IndianRupee, StopCircle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { adminApi, revenueApi, sessionsApi, terminalsApi } from '../api';
import PageHeader from '../components/PageHeader';
import StatsCard from '../components/StatsCard';
import TerminalCard from '../components/TerminalCard';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SessionTimer from '../components/SessionTimer';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard = () => {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: adminApi.getStats,
    refetchInterval: 3000
  });

  const { data: terminals, isLoading: terminalsLoading } = useQuery({
    queryKey: ['terminals'],
    queryFn: terminalsApi.list,
    refetchInterval: 3000
  });

  const { data: activeSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: () => sessionsApi.list({ status: 'active' }),
    refetchInterval: 3000
  });

  const { data: dailyRevenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['dailyRevenue'],
    queryFn: () => revenueApi.daily(),
    refetchInterval: 10000
  });

  const endSessionMutation = useMutation({
    mutationFn: sessionsApi.endSession,
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: ['terminals'] });
      await queryClient.cancelQueries({ queryKey: ['activeSessions'] });

      // Find terminal id for session
      const targetSession = activeSessions?.find(s => s.id === sessionId);
      if (targetSession) {
        queryClient.setQueryData(['terminals'], (old) => {
          if (!old) return old;
          return old.map(t => t.id === targetSession.terminal_id ? { ...t, status: 'available', current_session: null } : t);
        });
        queryClient.setQueryData(['activeSessions'], (old) => {
          if (!old) return old;
          return old.filter(s => s.id !== sessionId);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dailyRevenue'] });
      queryClient.invalidateQueries({ queryKey: ['sessionHistorySummary'] });
    }
  });

  const isLoading = statsLoading || terminalsLoading || sessionsLoading;

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  // Construct chart breakdown from dailyRevenue
  const chartData = [
    { name: 'Browsing', value: dailyRevenue?.browsing_revenue || 0 },
    { name: 'Gaming', value: dailyRevenue?.gaming_revenue || 0 },
    { name: 'Academic', value: dailyRevenue?.academic_revenue || 0 },
    { name: 'Printing', value: (dailyRevenue?.plain_print_revenue || 0) + (dailyRevenue?.colour_print_revenue || 0) },
    { name: 'Xerox', value: dailyRevenue?.xerox_revenue || 0 }
  ].filter(item => item.value > 0);

  const sessionColumns = [
    { 
      header: 'Customer', 
      accessorKey: 'customer_name',
      cell: (row) => <span className="font-bold text-gray-900">{row.customer_name || row.customerName || 'Customer'}</span>
    },
    { 
      header: 'Terminal', 
      accessorKey: 'terminal_number',
      cell: (row) => (
        <span className="px-2 py-0.5 rounded text-xs font-black bg-red-100 text-red-800 border border-red-200">
          {row.terminal_number || row.terminalNumber || 'N/A'}
        </span>
      )
    },
    { 
      header: 'Type', 
      accessorKey: 'terminal_type_name',
      cell: (row) => <span className="capitalize font-semibold text-gray-700">{row.terminal_type_name || row.type || 'PC'}</span>
    },
    { 
      header: 'Time Remaining', 
      accessorKey: 'expected_end_time',
      cell: (row) => <SessionTimer endTime={row.expected_end_time || row.expectedEnd} />
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Action',
      cell: (row) => (
        <button
          onClick={() => {
            if (window.confirm(`Free Terminal ${row.terminal_number} and end session for ${row.customer_name}?`)) {
              endSessionMutation.mutate(row.id);
            }
          }}
          disabled={endSessionMutation.isPending}
          className="text-red-700 hover:text-red-900 font-bold text-xs flex items-center bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-md border border-red-300 transition-colors shadow-sm disabled:opacity-50"
          title="End session and revoke seat occupancy immediately"
        >
          <StopCircle className="w-3.5 h-3.5 mr-1" />
          Free Seat
        </button>
      )
    }
  ];

  const totalRev = Number(stats?.today_revenue ?? stats?.todayRevenue ?? dailyRevenue?.total_revenue ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Real-Time Dashboard" 
        subtitle="Live computer terminal grid, active sessions, and today's financial summary"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatsCard 
          title="Active Sessions" 
          value={stats?.active_sessions ?? stats?.activeSessions ?? activeSessions?.length ?? 0} 
          icon={Users} 
        />
        <StatsCard 
          title="Available Terminals" 
          value={stats?.available_terminals ?? stats?.availableTerminals ?? 0} 
          icon={Monitor} 
        />
        <StatsCard 
          title="Total Customers" 
          value={stats?.total_customers ?? stats?.totalCustomers ?? 0} 
          icon={UserCheck} 
        />
        <StatsCard 
          title="Today's Revenue" 
          value={`₹${totalRev.toFixed(2)}`} 
          icon={IndianRupee} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Terminal Grid & Live Active Sessions */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Terminal Availability Grid</h3>
              <span className="text-xs text-gray-500">Live Status (Available / Occupied / Maintenance)</span>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {terminals?.map(terminal => {
                const session = activeSessions?.find(s => s.terminal_id === terminal.id || s.terminalId === terminal.id);
                return (
                  <TerminalCard 
                    key={terminal.id} 
                    terminal={terminal} 
                    session={session} 
                  />
                );
              })}
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Live Active Sessions</h3>
            <DataTable 
              columns={sessionColumns} 
              data={activeSessions || []} 
              loading={sessionsLoading} 
            />
          </div>

        </div>

        {/* Right 1 Col: Today's Revenue Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Today's Revenue Breakdown</h3>
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
                  <span>No completed transactions today yet.</span>
                  <span className="text-xs mt-1">Complete a session or print job to view breakdown.</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick breakdown list */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Browsing Systems:</span>
              <span className="font-semibold text-gray-900">₹{(dailyRevenue?.browsing_revenue || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Gaming Systems:</span>
              <span className="font-semibold text-gray-900">₹{(dailyRevenue?.gaming_revenue || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Academic Systems:</span>
              <span className="font-semibold text-gray-900">₹{(dailyRevenue?.academic_revenue || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Printing & Xerox:</span>
              <span className="font-semibold text-gray-900">₹{((dailyRevenue?.plain_print_revenue || 0) + (dailyRevenue?.colour_print_revenue || 0) + (dailyRevenue?.xerox_revenue || 0)).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
