import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Receipt, CheckCircle, CreditCard, Banknote, AlertCircle, Smartphone } from 'lucide-react';
import { billingApi, sessionsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import ReceiptModal from '../components/ReceiptModal';
import LoadingSpinner from '../components/LoadingSpinner';

const Billing = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlSessionId = searchParams.get('sessionId') || '';
  
  const [selectedSessionId, setSelectedSessionId] = useState(urlSessionId);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receiptData, setReceiptData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Sync with URL param if it changes
  useEffect(() => {
    if (urlSessionId) {
      setSelectedSessionId(urlSessionId);
    }
  }, [urlSessionId]);

  // Get active sessions
  const { data: activeSessions = [], isLoading: activeLoading } = useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: () => sessionsApi.list({ status: 'active' }),
    placeholderData: (prev) => prev,
  });

  // Get completed sessions
  const { data: completedSessions = [], isLoading: completedLoading } = useQuery({
    queryKey: ['sessions', 'completed'],
    queryFn: () => sessionsApi.list({ status: 'completed' }),
    placeholderData: (prev) => prev,
  });

  // Combine and sort by ID descending (newest sessions first)
  const allSessions = [
    ...(activeSessions || []),
    ...(completedSessions || [])
  ].sort((a, b) => (b.id || 0) - (a.id || 0));

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
      cell: (row) => <span className="font-mono text-xs font-bold text-gray-600">#{row.id}</span>
    },
    { 
      header: 'Customer', 
      accessorKey: 'customer_name',
      cell: (row) => (
        <div>
          <span className="font-bold text-gray-900 block text-sm">{row.customer_name || 'Customer'}</span>
          <span className="text-xs text-gray-500">{row.customer_phone || ''}</span>
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
          {row.terminal_number || 'PC'}
        </span>
      )
    },
    { 
      header: 'Type', 
      accessorKey: 'terminal_type_name',
      cell: (row) => <span className="capitalize text-xs font-semibold px-2 py-0.5 bg-gray-100 rounded text-gray-700">{row.terminal_type_name || 'Standard'}</span>
    },
    { 
      header: 'Billing State', 
      cell: (row) => {
        const isPaid = !!row.receipt_number || row.payment_status === 'paid';
        if (isPaid) {
          return <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded">🟢 Paid ({row.receipt_number})</span>;
        }
        if (row.status === 'active') {
          return <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">⚡ Active</span>;
        }
        return <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">🟡 Ready to Bill</span>;
      }
    },
    {
      header: 'Action',
      cell: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSessionId(row.id.toString());
          }}
          className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
            selectedSessionId === row.id.toString()
              ? 'bg-primary text-white shadow-sm'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          {selectedSessionId === row.id.toString() ? 'Selected' : 'Bill Session'}
        </button>
      )
    }
  ];

  const previewCustomer = billPreview?.customer_name || 'Customer';
  const previewTerminal = billPreview?.terminal_number || 'Terminal';
  const previewType = billPreview?.terminal_type_name || 'PC';
  const previewDuration = billPreview?.duration_minutes || 0;
  const previewSessionCharge = billPreview?.session_charge || 0;
  const previewPrintCharge = billPreview?.print_charge || 0;
  const previewTotal = billPreview?.total_amount || (previewSessionCharge + previewPrintCharge);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Billing & Invoicing" 
        subtitle="Itemized customer invoices, payment collection in ₹ (INR), and official printed receipts"
      />

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center text-sm">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Sessions List */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Select Customer Session</h3>
              <p className="text-xs text-gray-500">Pick any session below to generate an itemized bill</p>
            </div>
            <span className="text-xs font-bold bg-blue-50 text-primary px-2.5 py-1 rounded-full border border-blue-200">
              {allSessions.length} Total Sessions
            </span>
          </div>
          
          <DataTable 
            columns={columns} 
            data={allSessions} 
            loading={(activeLoading || completedLoading) && allSessions.length === 0} 
            onRowClick={(row) => setSelectedSessionId(row.id.toString())}
          />
        </div>

        {/* Right: Bill Preview & Payment */}
        <div className="lg:col-span-5 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-base font-bold text-gray-900 mb-4 pb-3 border-b border-gray-100 flex items-center">
            <Receipt className="w-5 h-5 mr-2 text-primary" />
            Live Bill Summary & Receipt
          </h3>
          
          {!selectedSessionId ? (
            <div className="text-center text-gray-400 py-16">
              <Receipt className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-gray-700">No session selected</p>
              <p className="text-xs mt-1 text-gray-500">Click on any session in the table to inspect and collect payment.</p>
            </div>
          ) : previewLoading ? (
            <div className="text-center py-12">
              <LoadingSpinner size="md" />
              <p className="text-sm text-gray-500 mt-2">Computing duration and charges...</p>
            </div>
          ) : billPreview ? (
            <div className="space-y-5">
              {/* Customer & Session Info */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-bold text-gray-900 text-sm">{previewCustomer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Terminal:</span>
                  <span className="font-bold text-gray-900">{previewTerminal} ({previewType})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Duration:</span>
                  <span className="font-bold text-gray-900">{previewDuration} minutes</span>
                </div>
              </div>

              {/* Itemized Charges */}
              <div className="space-y-2">
                <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wider">Itemized Breakdown</h4>
                
                <div className="flex justify-between items-center py-2 border-b border-gray-100 text-xs">
                  <span className="text-gray-700">{previewType} Usage ({previewDuration} mins)</span>
                  <span className="font-bold text-gray-900 text-sm">₹{previewSessionCharge.toFixed(2)}</span>
                </div>

                {previewPrintCharge > 0 && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100 text-xs">
                    <span className="text-gray-700">Printing / Xerox Jobs</span>
                    <span className="font-bold text-gray-900 text-sm">₹{previewPrintCharge.toFixed(2)}</span>
                  </div>
                )}
                
                {/* Total */}
                <div className="flex justify-between items-center pt-3 text-sm font-extrabold text-gray-900">
                  <span>TOTAL PAYABLE:</span>
                  <span className="text-2xl text-primary font-black">₹{previewTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="pt-2 border-t border-gray-200">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Select Payment Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-600' },
                    { id: 'upi', label: 'UPI / QR', icon: Smartphone, color: 'text-purple-600' },
                    { id: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMethod(mode.id)}
                      className={`border rounded-lg p-2.5 flex flex-col items-center justify-center transition-all ${
                        paymentMethod === mode.id 
                          ? 'border-primary bg-blue-50 ring-2 ring-primary/20 text-primary' 
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <mode.icon className={`w-5 h-5 mb-1 ${mode.color}`} />
                      <span className="text-xs font-bold">{mode.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleFinalize}
                disabled={finalizeMutation.isPending}
                className="w-full py-3 px-4 rounded-xl font-black text-sm text-white bg-green-600 hover:bg-green-700 shadow transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <CheckCircle className="w-5 h-5" />
                <span>{finalizeMutation.isPending ? 'Finalizing Invoice...' : 'Collect Payment & Print Receipt'}</span>
              </button>
            </div>
          ) : (
            <div className="text-center text-red-500 py-8 text-xs font-semibold">Unable to compute charges for this session.</div>
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
