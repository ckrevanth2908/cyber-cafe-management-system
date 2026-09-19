import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { queueApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';

const Queue = () => {
  const [queueToCancel, setQueueToCancel] = useState(null);
  const queryClient = useQueryClient();

  const { data: queueItems, isLoading } = useQuery({
    queryKey: ['queue'],
    queryFn: queueApi.list,
    refetchInterval: 15000 // Real-time updates every 15s
  });

  const cancelMutation = useMutation({
    mutationFn: queueApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      setQueueToCancel(null);
    }
  });

  const columns = [
    { header: 'Pos', accessorKey: 'position', cell: (row) => <span className="font-bold">{row.position}</span> },
    { header: 'Customer', accessorKey: 'customerName' },
    { header: 'System Type', accessorKey: 'systemType', cell: (row) => <span className="capitalize">{row.systemType}</span> },
    { header: 'Duration', accessorKey: 'expectedDuration', cell: (row) => `${row.expectedDuration} min` },
    { 
      header: 'Added At', 
      accessorKey: 'createdAt',
      cell: (row) => format(new Date(row.createdAt), 'HH:mm')
    },
    { 
      header: 'ETA', 
      accessorKey: 'estimatedWaitTime',
      cell: (row) => <span className="font-medium text-orange-600">~{row.estimatedWaitTime} min</span>
    },
    { 
      header: 'Actions',
      cell: (row) => (
        <button
          onClick={() => setQueueToCancel(row)}
          className="text-red-600 hover:text-red-800 text-sm font-medium"
        >
          Remove
        </button>
      )
    }
  ];

  return (
    <div>
      <PageHeader title="Waiting Queue" />
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
        <DataTable 
          columns={columns} 
          data={queueItems || []} 
          loading={isLoading} 
        />
      </div>

      <ConfirmDialog
        isOpen={!!queueToCancel}
        title="Remove from Queue"
        message={`Remove ${queueToCancel?.customerName} from the waiting list?`}
        confirmText="Remove"
        isDestructive={true}
        onConfirm={() => cancelMutation.mutate(queueToCancel.id)}
        onCancel={() => setQueueToCancel(null)}
      />
    </div>
  );
};

export default Queue;
