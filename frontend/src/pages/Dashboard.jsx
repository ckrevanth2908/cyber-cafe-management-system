import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Monitor, ListOrdered, DollarSign } from 'lucide-react';
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
  // Fetch data
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['adminStats'],
    queryFn: adminApi.getStats,
    refetchInterval: 30000 // refresh every 30s
  });

  const { data: terminals, isLoading: terminalsLoading } = useQuery({
    queryKey: ['terminals'],
    queryFn: terminalsApi.list,
    refetchInterval: 30000
  });

  const { data: activeSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: () => sessionsApi.list({ status: 'active' }),
    refetchInterval: 30000
  });

  const { data: dailyRevenue, isLoading: revenueLoading } = useQuery({
    queryKey: ['dailyRevenue'],
    queryFn: () => revenueApi.daily(),
    refetchInterval: 60000
  });

  const isLoading = statsLoading || terminalsLoading || sessionsLoading || revenueLoading;

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  const chartData = dailyRevenue?.breakdown || [];

  const sessionColumns = [
    { header: 'Customer', accessorKey: 'customerName' },
    { header: 'Terminal', accessorKey: 'terminalNumber' },
    { header: 'Type', accessorKey: 'type' },
    { 
      header: 'Time Remaining', 
      accessorKey: 'expectedEnd',
      cell: (row) => <SessionTimer endTime={row.expectedEnd} />
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Active Sessions" 
          value={stats?.activeSessions || 0} 
          icon={Users} 
        />
        <StatsCard 
          title="Available Terminals" 
          value={stats?.availableTerminals || 0} 
          icon={Monitor} 
        />
        <StatsCard 
          title="Queue Length" 
          value={stats?.queueLength || 0} 
          icon={ListOrdered} 
        />
        <StatsCard 
          title="Today's Revenue" 
          value={`$${(stats?.todayRevenue || 0).toFixed(2)}`} 
          icon={DollarSign} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Terminals & Sessions */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Terminal Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {terminals?.map(terminal => {
                const session = activeSessions?.find(s => s.terminalId === terminal.id);
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
            <h3 className="text-lg font-bold text-gray-800 mb-4">Active Sessions</h3>
            <DataTable 
              columns={sessionColumns} 
              data={activeSessions || []} 
              loading={sessionsLoading} 
            />
          </div>

        </div>

        {/* Right Column: Revenue Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Revenue Breakdown</h3>
          <div className="h-80 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#1e40af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-gray-500">
                No revenue data for today.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
