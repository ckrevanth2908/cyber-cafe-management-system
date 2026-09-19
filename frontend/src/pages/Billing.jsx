import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Receipt, CheckCircle, CreditCard, Banknote, AlertCircle } from 'lucide-react';
import { billingApi, sessionsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import ReceiptModal from '../components/ReceiptModal';
import LoadingSpinner from '../components/LoadingSpinner';

const Billing = () => {
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptData, setReceiptData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Get active sessions
  const { data: activeSessions, isLoading: activeLoading } = useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: () => sessionsApi.list({ status: 'active' })
  });

  // Get completed unbilled/all sessions
  const { data: completedSessions, isLoading: completedLoading } = useQuery({
    queryKey: ['sessions', 'completed'],
    queryFn: () => sessionsApi.list({ status: 'completed' })
  });

  const allSessions = [
    ...(activeSessions || []),
    ...(completedSessions || [])
  ];

  // Get bill preview for selected session
  const { data: billPreview, isLoading: previewLoading } = useQuery({
    queryKey: ['billPreview', selectedSessionId],
    queryFn: () => billingApi.preview(selectedSessionId),
    enabled: !!selectedSessionId
  });

  const finalizeMutation = useMutation({
    mutationFn: (data) => billingApi.finalize(data.sessionId, data.method),
    onSuccess: (data) => {
      setReceiptData(data.receipt || data);
      setSelectedSessionId('');
      setErrorMsg('');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['revenue'] });
      queryClient.invalidateQueries({ queryKey: ['dailyRevenue'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to finalize bill';
      setErrorMsg(msg);
    }
  });

  const handleFinalize = () => {
    if (selectedSessionId) {
      setErrorMsg('');
      finalizeMutation.mutate({ sessionId: selectedSessionId, method: paymentMethod });
    }
  };

  const columns = [
    { 
      header: 'ID', 
      accessorKey: 'id',
      cell: (row) => `#${row.id}`
    },
    { 
      header: 'Customer', 
      accessorKey: 'customer_name',
      cell: (row) => row.customer_name || row.customerName || 'Customer'
    },
    { 
      header: 'Terminal', 
      accessorKey: 'terminal_number',
      cell: (row) => row.terminal_number || row.terminalNumber || 'N/A'
    },
    { 
      header: 'Type', 
      accessorKey: 'terminal_type_name',
      cell: (row) => <span className="capitalize text-xs font-semibold px-2 py-0.5 bg-gray-100 rounded">{row.terminal_type_name || row.typeName || 'PC'}</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => (
        <span className={`capitalize text-xs font-bold px-2 py-0.5 rounded ${
          row.status === 'active' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-blue-100 text-blue-700'
        }`}>
          {row.status}
        </span>
      )
    },
    {
      header: 'Action',
      accessorKey: 'actions',
      cell: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSessionId(row.id);
          }}
          className={`text-xs px-2.5 py-1 rounded font-medium ${
            selectedSessionId === row.id
              ? 'bg-primary text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {selectedSessionId === row.id ? 'Selected' : 'Bill'}
        </button>
      )
    }
  ];

  const previewCustomer = billPreview?.customer_name || billPreview?.customerName || 'Customer';
  const previewTerminal = billPreview?.terminal_number || billPreview?.terminal || 'Terminal';
  const previewType = billPreview?.terminal_type_name || 'System';
  const previewDuration = billPreview?.duration_minutes || billPreview?.durationMinutes || 0;
  const previewSessionCharge = billPreview?.session_charge || billPreview?.sessionCharge || 0;
  const previewPrintCharge = billPreview?.print_charge || billPreview?.printCharge || 0;
  const previewTotal = billPreview?.total_amount || billPreview?.total || (previewSessionCharge + previewPrintCharge);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Billing & Payment Invoicing" 
        subtitle="Calculate usage duration charges, itemize print services, and print official receipts in ₹ (INR)"
      />

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center text-sm">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Sessions List */}
        <div className="lg:col-span-7 bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-gray-900">Select Session to Bill</h3>
            <span className="text-xs text-gray-500">Showing Active & Completed Sessions</span>
          </div>
          
          <DataTable 
            columns={columns} 
            data={allSessions} 
            loading={activeLoading || completedLoading} 
            onRowClick={(row) => setSelectedSessionId(row.id)}
          />
        </div>

        {/* Right: Bill Preview & Payment */}
        <div className="lg:col-span-5 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-primary" />
            Invoice & Bill Preview
          </h3>
          
          {!selectedSessionId ? (
            <div className="text-center text-gray-400 py-16">
              <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-gray-600">No session selected</p>
              <p className="text-xs mt-1">Click any session from the left table to generate the bill.</p>
            </div>
          ) : previewLoading ? (
            <div className="text-center py-12">
              <LoadingSpinner size="md" />
              <p className="text-sm text-gray-500 mt-2">Computing usage charges...</p>
            </div>
          ) : billPreview ? (
            <div className="space-y-5">
              {/* Customer & Session Info */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer Name:</span>
                  <span className="font-bold text-gray-900">{previewCustomer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Allocated PC:</span>
                  <span className="font-semibold text-gray-900">{previewTerminal} ({previewType})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Usage Duration:</span>
                  <span className="font-medium text-gray-900">{previewDuration} mins</span>
                </div>
              </div>

              {/* Itemized Charges */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 text-xs uppercase tracking-wider text-gray-400">Charge Breakdown</h4>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                  <span className="text-gray-700">{previewType} Terminal Usage ({previewDuration} mins)</span>
                  <span className="font-semibold text-gray-900">₹{previewSessionCharge.toFixed(2)}</span>
                </div>

                {previewPrintCharge > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 text-sm">
                    <span className="text-gray-700">Printing / Xerox Jobs</span>
                    <span className="font-semibold text-gray-900">₹{previewPrintCharge.toFixed(2)}</span>
                  </div>
                )}
                
                {/* Total */}
                <div className="flex justify-between items-center pt-3 text-lg font-extrabold text-gray-900">
                  <span>Total Payable:</span>
                  <span className="text-2xl text-primary font-black">₹{previewTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className={`border rounded-lg p-3 flex items-center cursor-pointer transition-all ${
                    paymentMethod === 'cash' ? 'border-primary bg-blue-50 ring-2 ring-primary/20' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="payment" 
                      value="cash" 
                      checked={paymentMethod === 'cash'} 
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="sr-only"
                    />
                    <Banknote className="w-5 h-5 text-green-600 mr-2" />
                    <span className="text-sm font-semibold text-gray-900">Cash</span>
                  </label>

                  <label className={`border rounded-lg p-3 flex items-center cursor-pointer transition-all ${
                    paymentMethod === 'card' ? 'border-primary bg-blue-50 ring-2 ring-primary/20' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input 
                      type="radio" 
                      name="payment" 
                      value="card" 
                      checked={paymentMethod === 'card'} 
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="sr-only"
                    />
                    <CreditCard className="w-5 h-5 text-blue-600 mr-2" />
                    <span className="text-sm font-semibold text-gray-900">UPI / Card</span>
                  </label>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleFinalize}
                disabled={finalizeMutation.isPending}
                className="w-full py-3 px-4 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 flex items-center justify-center space-x-2 transition-colors"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{finalizeMutation.isPending ? 'Processing Payment...' : 'Collect Payment & Print Receipt'}</span>
              </button>
            </div>
          ) : (
            <div className="text-center text-red-500 py-8">Unable to compute bill.</div>
          )}
        </div>
      </div>

      {/* Official Printable Receipt Modal */}
      <ReceiptModal 
        isOpen={!!receiptData} 
        onClose={() => setReceiptData(null)} 
        receiptData={receiptData} 
      />
    </div>
  );
};

export default Billing;
