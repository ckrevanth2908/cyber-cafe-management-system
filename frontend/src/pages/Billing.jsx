import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { billingApi, sessionsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import ReceiptModal from '../components/ReceiptModal';

const Billing = () => {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptData, setReceiptData] = useState(null);

  // Get active sessions for the dropdown
  const { data: activeSessions } = useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: () => sessionsApi.list({ status: 'active' })
  });

  // Get unbilled completed sessions
  const { data: completedSessions } = useQuery({
    queryKey: ['sessions', 'completed'],
    queryFn: () => sessionsApi.list({ status: 'completed' })
  });

  const billableSessions = [...(activeSessions || []), ...(completedSessions || [])];

  // Get bill preview for selected session
  const { data: billPreview, isLoading: previewLoading } = useQuery({
    queryKey: ['billPreview', selectedSessionId],
    queryFn: () => billingApi.preview(selectedSessionId),
    enabled: !!selectedSessionId
  });

  const finalizeMutation = useMutation({
    mutationFn: (data) => billingApi.finalize(data.sessionId, data.method),
    onSuccess: (data) => {
      setReceiptData(data.receipt);
      setSelectedSessionId('');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
    }
  });

  const handleFinalize = () => {
    if (selectedSessionId) {
      finalizeMutation.mutate({ sessionId: selectedSessionId, method: paymentMethod });
    }
  };

  const columns = [
    { header: 'Session ID', accessorKey: 'id' },
    { header: 'Customer', accessorKey: 'customerName' },
    { header: 'Terminal', accessorKey: 'terminalNumber' },
    { 
      header: 'Start', 
      accessorKey: 'startTime',
      cell: (row) => format(new Date(row.startTime), 'HH:mm')
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => <span className={`capitalize ${row.status === 'active' ? 'text-green-600' : 'text-blue-600'}`}>{row.status}</span>
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="lg:col-span-2">
        <PageHeader title="Billing & Payments" />
      </div>

      {/* Select Session */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Session to Bill</h3>
        
        <DataTable 
          columns={columns} 
          data={billableSessions} 
          loading={!activeSessions} 
          onRowClick={(row) => setSelectedSessionId(row.id)}
        />
      </div>

      {/* Bill Preview */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Bill Preview</h3>
        
        {!selectedSessionId ? (
          <div className="text-center text-gray-500 py-8">
            Select a session from the left to view the bill.
          </div>
        ) : previewLoading ? (
          <div className="text-center py-8">Loading bill...</div>
        ) : billPreview ? (
          <div className="space-y-6">
            <div className="border-b pb-4">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{billPreview.customerName}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-600">Terminal:</span>
                <span className="font-medium">{billPreview.terminal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Duration:</span>
                <span className="font-medium">{billPreview.durationMinutes} minutes</span>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">Charges</h4>
              {billPreview.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span>{item.description}</span>
                  <span>${item.amount.toFixed(2)}</span>
                </div>
              ))}
              
              <div className="flex justify-between font-bold text-lg mt-4 pt-4 border-t">
                <span>Total Due:</span>
                <span>${billPreview.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="payment" 
                      value="cash" 
                      checked={paymentMethod === 'cash'} 
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-sm text-gray-700">Cash</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="payment" 
                      value="card" 
                      checked={paymentMethod === 'card'} 
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-sm text-gray-700">Card / UPI</span>
                  </label>
                </div>
              </div>

              <button
                onClick={handleFinalize}
                disabled={finalizeMutation.isPending}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
              >
                {finalizeMutation.isPending ? 'Processing...' : 'Complete Payment & Print Receipt'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center text-red-500 py-8">Failed to load bill.</div>
        )}
      </div>

      <ReceiptModal 
        isOpen={!!receiptData} 
        onClose={() => setReceiptData(null)} 
        receiptData={receiptData} 
      />
    </div>
  );
};

export default Billing;
