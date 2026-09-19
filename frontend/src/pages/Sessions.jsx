import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { PlayCircle, StopCircle, Receipt } from 'lucide-react';
import { sessionsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import SessionTimer from '../components/SessionTimer';
import ConfirmDialog from '../components/ConfirmDialog';

const Sessions = () => {
  const [tab, setTab] = useState('active'); // active, completed, all
  const [sessionToCancel, setSessionToCancel] = useState(null);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', tab],
    queryFn: () => sessionsApi.list(tab !== 'all' ? { status: tab } : {}),
    refetchInterval: tab === 'active' ? 10000 : false
  });

  const endSessionMutation = useMutation({
    mutationFn: sessionsApi.endSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['dailyRevenue'] });
      setSessionToCancel(null);
    }
  });

  const columns = [
    { 
      header: 'ID', 
      accessorKey: 'id', 
      cell: (row) => <span className="font-mono text-xs font-bold text-gray-500">#{row.id}</span>
    },
    { 
      header: 'Customer', 
      accessorKey: 'customer_name',
      cell: (row) => (
        <div>
          <span className="font-semibold text-gray-900 block">{row.customer_name || row.customerName || 'Customer'}</span>
          <span className="text-xs text-gray-500">{row.customer_phone || row.phone || ''}</span>
        </div>
      )
    },
    { 
      header: 'Terminal', 
      accessorKey: 'terminal_number',
      cell: (row) => <span className="font-bold text-primary">{row.terminal_number || row.terminalNumber || 'PC'}</span>
    },
    { 
      header: 'System Type', 
      accessorKey: 'terminal_type_name', 
      cell: (row) => <span className="capitalize px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold">{row.terminal_type_name || row.type || 'Standard'}</span> 
    },
    { 
      header: 'Start Time', 
      accessorKey: 'start_time',
      cell: (row) => format(new Date(row.start_time || row.startTime || Date.now()), 'hh:mm a')
    },
    { 
      header: 'Time Remaining', 
      accessorKey: 'expected_end_time',
      cell: (row) => row.status === 'active' ? (
        <SessionTimer endTime={row.expected_end_time || row.expectedEnd} />
      ) : (
        <span className="text-xs text-gray-500">{row.actual_duration_minutes || row.expected_duration_minutes || 0} mins</span>
      )
    },
    { 
      header: 'Charge', 
      accessorKey: 'session_charge',
      cell: (row) => <span className="font-bold text-gray-900">₹{Number(row.session_charge || row.sessionCharge || 0).toFixed(2)}</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    { 
      header: 'Actions',
      cell: (row) => (
        <div className="flex items-center space-x-2">
          {row.status === 'active' ? (
            <button
              onClick={() => setSessionToCancel(row)}
              className="text-red-600 hover:text-red-800 font-semibold text-xs flex items-center bg-red-50 px-2 py-1 rounded border border-red-200"
            >
              <StopCircle className="w-3.5 h-3.5 mr-1" />
              End Early
            </button>
          ) : (
            <button
              onClick={() => navigate('/billing')}
              className="text-primary hover:text-primary-dark font-semibold text-xs flex items-center bg-blue-50 px-2 py-1 rounded border border-blue-200"
            >
              <Receipt className="w-3.5 h-3.5 mr-1" />
              Bill
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Active & Historical Sessions" 
        subtitle="Live tracking of allocated computer terminals, live countdown timers, and early session release"
        action={
          <button
            onClick={() => navigate('/allocate')}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold shadow-sm hover:bg-primary-dark"
          >
            <PlayCircle className="w-4 h-4 mr-2" />
            New Allocation
          </button>
        }
      />

      <div className="flex space-x-2 border-b border-gray-200">
        {[
          { id: 'active', label: 'Active Running Sessions' },
          { id: 'completed', label: 'Completed Sessions' },
          { id: 'all', label: 'All Session History' }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2.5 px-4 font-bold text-sm transition-all border-b-2 ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <DataTable 
          columns={columns} 
          data={sessions || []} 
          loading={isLoading} 
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
