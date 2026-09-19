import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { sessionsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

const Sessions = () => {
  const [tab, setTab] = useState('active'); // active, completed, all
  const [sessionToCancel, setSessionToCancel] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['sessions', tab],
    queryFn: () => sessionsApi.list(tab !== 'all' ? { status: tab } : {})
  });

  const endSessionMutation = useMutation({
    mutationFn: sessionsApi.endSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      setSessionToCancel(null);
    }
  });

  const columns = [
    { header: 'ID', accessorKey: 'id', cell: (row) => `#${row.id}` },
    { header: 'Customer', accessorKey: 'customerName' },
    { header: 'Terminal', accessorKey: 'terminalNumber' },
    { header: 'Type', accessorKey: 'type', cell: (row) => <span className="capitalize">{row.type}</span> },
    { 
      header: 'Start Time', 
      accessorKey: 'startTime',
      cell: (row) => format(new Date(row.startTime), 'HH:mm')
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    { 
      header: 'Actions',
      cell: (row) => row.status === 'active' ? (
        <button
          onClick={() => setSessionToCancel(row)}
          className="text-red-600 hover:text-red-800 font-medium text-sm"
        >
          End Session
        </button>
      ) : (
        <span className="text-gray-400 text-sm">Ended</span>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Sessions" />

      <div className="mb-6 flex space-x-4 border-b border-gray-200">
        {['active', 'completed', 'all'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 px-4 border-b-2 font-medium text-sm capitalize ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <DataTable 
        columns={columns} 
        data={sessions || []} 
        loading={isLoading} 
      />

      <ConfirmDialog
        isOpen={!!sessionToCancel}
        title="End Session"
        message={`Are you sure you want to manually end the session for ${sessionToCancel?.customerName} at Terminal ${sessionToCancel?.terminalNumber}?`}
        confirmText="End Session"
        isDestructive={true}
        onConfirm={() => endSessionMutation.mutate(sessionToCancel.id)}
        onCancel={() => setSessionToCancel(null)}
      />
    </div>
  );
};

export default Sessions;
