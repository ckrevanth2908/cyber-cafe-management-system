import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { 
  PlayCircle, 
  StopCircle, 
  Receipt, 
  Search, 
  History, 
  Clock, 
  CheckCircle, 
  IndianRupee, 
  Download, 
  Filter 
} from 'lucide-react';
import { sessionsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SessionTimer from '../components/SessionTimer';
import ConfirmDialog from '../components/ConfirmDialog';
import LoadingSpinner from '../components/LoadingSpinner';

const Sessions = () => {
  const [tab, setTab] = useState('active'); // active, history, completed, all
  const [searchTerm, setSearchTerm] = useState('');
  const [sessionToCancel, setSessionToCancel] = useState(null);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: sessions = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sessions', tab, searchTerm],
    queryFn: () => sessionsApi.list({ 
      status: tab === 'history' || tab === 'all' ? undefined : tab,
      search: searchTerm || undefined 
    }),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const { data: summaryStats = {} } = useQuery({
    queryKey: ['sessionHistorySummary'],
    queryFn: sessionsApi.historySummary,
    refetchInterval: 60000,
    placeholderData: (prev) => prev,
  });

  const endSessionMutation = useMutation({
    mutationFn: sessionsApi.endSession,
    onMutate: async (sessionId) => {
      await queryClient.cancelQueries({ queryKey: ['sessions'] });
      await queryClient.cancelQueries({ queryKey: ['terminals'] });
      // Optimistically update sessions list
      queryClient.setQueryData(['sessions', tab, searchTerm], (old) => {
        if (!old) return old;
        return old.map(s => s.id === sessionId ? { ...s, status: 'completed' } : s);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['dailyRevenue'] });
      queryClient.invalidateQueries({ queryKey: ['sessionHistorySummary'] });
      setSessionToCancel(null);
    }
  });

  const handleExportCSV = () => {
    if (!sessions || sessions.length === 0) {
      alert('No session records to export.');
      return;
    }
    const headers = ['Session ID', 'Customer Name', 'Phone', 'Terminal No', 'Type', 'Start Time', 'End Time', 'Duration (Mins)', 'Charge (INR)', 'Status', 'Payment Status', 'Receipt Number'];
    const rows = sessions.map(s => [
      `#${s.id}`,
      `"${s.customer_name || s.customerName || 'Customer'}"`,
      `"${s.customer_phone || ''}"`,
      s.terminal_number || s.terminalNumber || 'PC',
      s.terminal_type_name || s.type || 'Standard',
      s.start_time || '',
      s.actual_end_time || s.expected_end_time || '',
      s.actual_duration_minutes || s.expected_duration_minutes || 0,
      Number(s.session_charge || s.sessionCharge || 0).toFixed(2),
      s.status || '',
      s.payment_status || (s.status === 'completed' ? 'paid' : 'pending'),
      s.receipt_number || 'N/A'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cybercafe_session_history_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columns = [
    { 
      header: 'ID', 
      accessorKey: 'id', 
      cell: (row) => <span className="font-mono text-xs font-bold text-gray-600">#{row.id}</span>
    },
    { 
      header: 'Customer', 
      accessorKey: 'customer_name',
      cell: (row) => (
        <div>
          <span className={`font-bold block text-sm ${row.status === 'active' ? 'text-red-700' : 'text-gray-900'}`}>
            {row.customer_name || row.customerName || 'Customer'}
          </span>
          <span className="text-xs text-gray-500">{row.customer_phone || row.phone || ''}</span>
        </div>
      )
    },
    { 
      header: 'Terminal', 
      accessorKey: 'terminal_number',
      cell: (row) => (
        <span className={`px-2 py-0.5 rounded text-xs font-black ${
          row.status === 'active' ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-gray-100 text-gray-800'
        }`}>
          {row.terminal_number || row.terminalNumber || 'PC'}
        </span>
      )
    },
    { 
      header: 'Category', 
      accessorKey: 'terminal_type_name', 
      cell: (row) => <span className="capitalize text-xs font-semibold text-gray-700">{row.terminal_type_name || row.type || 'Standard'}</span> 
    },
    { 
      header: 'Start Date & Time', 
      accessorKey: 'start_time',
      cell: (row) => (
        <div className="text-xs text-gray-700">
          <span className="font-medium block">{format(new Date(row.start_time || Date.now()), 'dd MMM yyyy')}</span>
          <span className="text-gray-500">{format(new Date(row.start_time || Date.now()), 'hh:mm a')}</span>
        </div>
      )
    },
    { 
      header: 'Duration / Timer', 
      accessorKey: 'expected_end_time',
      cell: (row) => row.status === 'active' ? (
        <SessionTimer endTime={row.expected_end_time || row.expectedEnd} />
      ) : (
        <span className="text-xs font-semibold text-gray-700 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
          {row.actual_duration_minutes || row.expected_duration_minutes || 0} mins
        </span>
      )
    },
    { 
      header: 'Charge (₹)', 
      accessorKey: 'session_charge',
      cell: (row) => <span className="font-black text-primary text-sm">₹{Number(row.session_charge || row.sessionCharge || 0).toFixed(2)}</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    { 
      header: 'Billing Status', 
      cell: (row) => {
        if (row.payment_status === 'paid' || row.receipt_number) {
          return (
            <span className="inline-flex items-center text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">
              <CheckCircle className="w-3 h-3 mr-1 flex-shrink-0" /> Paid ({row.receipt_number || 'Cash'})
            </span>
          );
        }
        if (row.status === 'active') {
          return (
            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
              ⚡ Running
            </span>
          );
        }
        return (
          <button
            onClick={() => navigate(`/billing?sessionId=${row.id}`)}
            className="text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded underline cursor-pointer"
          >
            🟡 Unbilled (Pay Now)
          </button>
        );
      }
    },
    { 
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          {row.status === 'active' ? (
            <button
              onClick={() => setSessionToCancel(row)}
              className="text-white bg-red-600 hover:bg-red-700 font-bold text-xs flex items-center px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 whitespace-nowrap"
              title="Click when customer leaves to free this seat"
            >
              <StopCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
              Customer Exit (Free Seat)
            </button>
          ) : (
            <button
              onClick={() => navigate(`/billing?sessionId=${row.id}`)}
              className="text-primary hover:text-primary-dark font-bold text-xs flex items-center bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200 transition-colors whitespace-nowrap"
            >
              <Receipt className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
              Bill & Receipt
            </button>
          )}
        </div>
      )
    }
  ];

  // Filter occupied sessions for live monitor
  const activeOccupiedSessions = (sessions || []).filter(s => s.status === 'active');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Session Tracking & History Logs" 
        subtitle="Live tracking of running computer sessions, currently occupied seats, and comprehensive historical logs in ₹"
        action={
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center px-3.5 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 text-xs font-bold shadow-sm"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export History CSV
            </button>
            <button
              onClick={() => navigate('/allocate')}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-sm hover:bg-primary-dark"
            >
              <PlayCircle className="w-4 h-4 mr-1.5" />
              + New Allocation
            </button>
          </div>
        }
      />

      {/* Historical Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 text-xs font-bold uppercase">
            <History className="w-4 h-4 text-primary" />
            <span>Total Sessions</span>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">{summaryStats?.total_sessions || sessions?.length || 0}</p>
          <span className="text-xs text-gray-400">All-time lifetime records</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 text-xs font-bold uppercase">
            <PlayCircle className="w-4 h-4 text-red-600" />
            <span>Currently Occupied</span>
          </div>
          <p className="text-2xl font-black text-red-700 mt-2">{summaryStats?.active_sessions ?? activeOccupiedSessions.length}</p>
          <span className="text-xs text-red-600 font-semibold">Live in-use terminals</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 text-xs font-bold uppercase">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Total Hours Logged</span>
          </div>
          <p className="text-2xl font-black text-gray-900 mt-2">
            {((summaryStats?.total_duration_minutes || 0) / 60).toFixed(1)} hrs
          </p>
          <span className="text-xs text-gray-400">{summaryStats?.total_duration_minutes || 0} total minutes</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 text-xs font-bold uppercase">
            <IndianRupee className="w-4 h-4 text-primary" />
            <span>Session Revenue</span>
          </div>
          <p className="text-2xl font-black text-primary mt-2">
            ₹{Number(summaryStats?.total_charges || 0).toFixed(2)}
          </p>
          <span className="text-xs text-gray-400">Total computer tariffs</span>
        </div>
      </div>

      {/* Currently Occupied Seats Live Grid */}
      {activeOccupiedSessions.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 via-white to-red-50 p-5 rounded-xl border-2 border-red-300 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-600 animate-ping" />
              <h3 className="font-black text-red-900 text-base uppercase tracking-wide">
                Live Occupied Seats ({activeOccupiedSessions.length})
              </h3>
            </div>
            <span className="text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full border border-red-200">
              Click "Customer Left" when session finishes to free seat
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeOccupiedSessions.map(sess => (
              <div 
                key={sess.id}
                className="bg-white p-4 rounded-xl border-2 border-red-400 shadow-md space-y-3 relative overflow-hidden"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-black bg-red-600 text-white shadow-sm">
                        {sess.terminal_number || sess.terminalNumber || 'PC'}
                      </span>
                      <span className="text-xs font-bold uppercase text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {sess.terminal_type_name || sess.type || 'Standard'}
                      </span>
                    </div>
                    <h4 className="font-black text-gray-900 text-sm mt-1.5">
                      {sess.customer_name || sess.customerName || 'Customer'}
                    </h4>
                    <p className="text-xs text-gray-500">{sess.customer_phone || sess.phone || 'No phone recorded'}</p>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-semibold text-gray-500 block">Remaining</span>
                    <SessionTimer endTime={sess.expected_end_time || sess.expectedEnd} />
                  </div>
                </div>

                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-600">
                  <span>Started: <strong>{sess.start_time ? format(new Date(sess.start_time), 'hh:mm a') : 'Now'}</strong></span>
                  <span>Duration: <strong>{sess.expected_duration_minutes || 60}m</strong></span>
                </div>

                <button
                  type="button"
                  onClick={() => setSessionToCancel(sess)}
                  disabled={endSessionMutation.isPending}
                  className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black shadow transition-all active:scale-95 flex items-center justify-center space-x-1.5"
                >
                  <StopCircle className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span>Customer Exit (Free Seat)</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-bold">
            {[
              { id: 'active', label: `⚡ Active Live (${activeOccupiedSessions.length})` },
              { id: 'history', label: '📜 Session History & Logs' },
              { id: 'completed', label: '✅ Completed Sessions' },
              { id: 'all', label: '🌐 All Records' }
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`py-1.5 px-3.5 rounded-md transition-all ${
                  tab === t.id
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by customer, phone, terminal..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
            />
          </div>
        </div>

        {/* Sessions Table */}
        <DataTable 
          columns={columns} 
          data={sessions} 
          loading={isLoading && sessions.length === 0} 
        />
      </div>

      <ConfirmDialog
        isOpen={!!sessionToCancel}
        title="Early Session Termination"
        message={`Are you sure you want to end the session early for ${sessionToCancel?.customer_name || sessionToCancel?.customerName || 'Customer'} at Terminal ${sessionToCancel?.terminal_number || sessionToCancel?.terminalNumber}? The computer will be freed immediately and billed for actual duration used.`}
        confirmText="Yes, End Session"
        isDestructive={true}
        onConfirm={() => endSessionMutation.mutate(sessionToCancel.id)}
        onCancel={() => setSessionToCancel(null)}
      />
    </div>
  );
};

export default Sessions;
