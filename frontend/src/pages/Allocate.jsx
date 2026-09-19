import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Monitor, CheckCircle, AlertCircle, UserPlus, Play } from 'lucide-react';
import { customersApi, terminalsApi, allocationsApi, ratesApi } from '../api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';

const Allocate = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedType, setSelectedType] = useState('browsing');
  const [duration, setDuration] = useState(60);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Fetch all customers
  const { data: allCustomers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
  });

  // Fetch all terminals
  const { data: terminals, isLoading: terminalsLoading } = useQuery({
    queryKey: ['terminals'],
    queryFn: terminalsApi.list
  });

  // Fetch pricing rates
  const { data: rates } = useQuery({
    queryKey: ['rates'],
    queryFn: ratesApi.list
  });

  // Auto-select first customer if available
  useEffect(() => {
    if (allCustomers && allCustomers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(allCustomers[0].id.toString());
    }
  }, [allCustomers, selectedCustomerId]);

  const allocateMutation = useMutation({
    mutationFn: allocationsApi.allocate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setSuccessMessage(`Allocated ${data.terminal_number || 'PC'} successfully! Redirecting to live active sessions...`);
      setTimeout(() => {
        navigate('/sessions');
      }, 600);
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to allocate terminal';
      setErrorMessage(msg);
    }
  });

  const filteredCustomers = (allCustomers || []).filter(c => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q)
    );
  });

  const selectedCustomer = (allCustomers || []).find(c => c.id.toString() === selectedCustomerId);
  
  // Available terminals of selected system type
  const matchingTerminals = (terminals || []).filter(t => {
    const tTypeName = (t.type_name || t.type || '').toLowerCase();
    return tTypeName === selectedType.toLowerCase();
  });

  const currentRateObj = (rates || []).find(r => (r.service_type || r.serviceType || '').toLowerCase() === selectedType.toLowerCase());
  const hourlyRate = currentRateObj ? (currentRateObj.rate_per_unit || currentRateObj.ratePerHour || 20) : (selectedType === 'gaming' ? 50 : selectedType === 'academic' ? 15 : 20);
  const estimatedCost = (duration / 60) * hourlyRate;

  const handleStartSession = (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedCustomerId) {
      setErrorMessage('Please select a customer first.');
      return;
    }

    const typeIdMap = {
      browsing: 1,
      gaming: 2,
      academic: 3
    };
    const finalTypeId = typeIdMap[selectedType] || 1;

    allocateMutation.mutate({
      customer_id: parseInt(selectedCustomerId, 10),
      customerId: parseInt(selectedCustomerId, 10),
      terminal_type_id: finalTypeId,
      terminalTypeId: finalTypeId,
      terminal_id: selectedTerminalId ? parseInt(selectedTerminalId, 10) : undefined,
      terminalId: selectedTerminalId ? parseInt(selectedTerminalId, 10) : undefined,
      system_type: selectedType,
      systemType: selectedType,
      duration_minutes: parseInt(duration, 10),
      durationMinutes: parseInt(duration, 10),
      expectedDurationMinutes: parseInt(duration, 10),
      duration: parseInt(duration, 10)
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader 
        title="Terminal Allocation & Launch Session" 
        subtitle="Assign an available computer system to a customer and start their live timer"
      />

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center text-green-700 text-sm font-semibold shadow-sm">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm font-medium shadow-sm">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleStartSession} className="space-y-8">
          
          {/* Step 1: Customer Selection */}
          <section>
            <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
              <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">1. Select Customer</h3>
              <button
                type="button"
                onClick={() => navigate('/customers')}
                className="text-xs text-primary font-bold hover:underline flex items-center bg-blue-50 px-2.5 py-1 rounded"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                + New Customer
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder="Filter customer by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                  />
                </div>

                <div className="flex-1">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="block w-full py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white font-medium focus:outline-none focus:ring-primary focus:border-primary"
                  >
                    <option value="">-- Choose Customer --</option>
                    {filteredCustomers.map(c => (
                      <option key={c.id} value={c.id.toString()}>
                        {c.name} (Age: {c.age}, {c.phone || 'No phone'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 flex justify-between items-center">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                      {selectedCustomer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm">{selectedCustomer.name} <span className="text-xs text-gray-500 font-normal">(Age: {selectedCustomer.age} yrs)</span></p>
                      <p className="text-xs text-gray-600">Phone: {selectedCustomer.phone || 'N/A'} • Email: {selectedCustomer.email || 'N/A'}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded">Selected</span>
                </div>
              )}
            </div>
          </section>

          {/* Step 2: System Type */}
          <section>
            <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">
              2. Select Computer Type
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'browsing', title: 'Browsing System', desc: 'General internet, emails, browsing' },
                { id: 'gaming', title: 'Gaming System', desc: 'High-performance GPU & gaming peripherals' },
                { id: 'academic', title: 'Academic System', desc: 'Study, typing, project & quiet zone' }
              ].map((item) => {
                const isSelected = selectedType === item.id;
                const r = (rates || []).find(rate => (rate.service_type || rate.serviceType || '').toLowerCase() === item.id);
                const price = r ? (r.rate_per_unit || r.ratePerHour || 0) : (item.id === 'gaming' ? 50 : item.id === 'academic' ? 15 : 20);
                
                const typeTerms = (terminals || []).filter(t => (t.type_name || t.type || '').toLowerCase() === item.id);
                const countAvail = typeTerms.filter(t => t.status === 'available').length;

                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedType(item.id)}
                    className={`border rounded-xl p-4 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected 
                        ? 'border-primary ring-2 ring-primary/30 bg-blue-50/70 shadow-sm' 
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                        {isSelected && <CheckCircle className="w-5 h-5 text-primary" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                      <span className="font-black text-gray-900 text-sm">₹{price} / hr</span>
                      <span className={`px-2 py-0.5 rounded font-bold ${countAvail > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {countAvail > 0 ? `${countAvail} Available` : 'All Occupied (Auto-Free)'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Optional: Specific PC selection */}
          {matchingTerminals.length > 0 && (
            <section>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
                Specific Terminal (Optional - Leave blank for Auto-Assign)
              </label>
              <select
                value={selectedTerminalId}
                onChange={(e) => setSelectedTerminalId(e.target.value)}
                className="w-full sm:w-80 py-2 px-3 border border-gray-300 rounded-lg text-sm bg-white font-medium"
              >
                <option value="">⚡ Automatic Best Available Terminal</option>
                {matchingTerminals.map(t => {
                  const isOcc = t.status === 'occupied';
                  return (
                    <option key={t.id} value={t.id.toString()} className={isOcc ? 'text-red-600 font-bold bg-red-50' : ''}>
                      Terminal {t.terminal_number} - {isOcc ? '🔴 OCCUPIED' : '🟢 AVAILABLE'} {t.specifications ? `(${t.specifications})` : ''}
                    </option>
                  );
                })}
              </select>
            </section>
          )}

          {/* Step 3: Duration */}
          <section>
            <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-4">
              3. Session Duration
            </h3>
            <div className="max-w-xs">
              <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Expected Usage (minutes)</label>
              <div className="flex rounded-lg shadow-sm">
                <input
                  type="number"
                  step="15"
                  min="15"
                  max="720"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value, 10) || 15)}
                  className="flex-1 block w-full border-gray-300 rounded-none rounded-l-lg text-sm border py-2 px-3 font-semibold text-gray-900"
                />
                <span className="inline-flex items-center px-3.5 rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 text-gray-600 text-xs font-bold">
                  MINS
                </span>
              </div>
              <div className="flex gap-2 mt-2.5">
                {[30, 60, 120, 180].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDuration(mins)}
                    className={`text-xs px-3 py-1 rounded-md border font-semibold ${duration === mins ? 'bg-primary text-white border-primary shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}
                  >
                    {mins >= 60 ? `${mins / 60} hr` : `${mins}m`}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Step 4: Summary & Costing */}
          <section className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <h4 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-2">Allocation Summary</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block">Customer</span>
                <span className="font-bold text-gray-900 text-sm truncate block">{selectedCustomer?.name || 'Please select customer'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">System Type</span>
                <span className="font-bold capitalize text-gray-900 text-sm">{selectedType} PC</span>
              </div>
              <div>
                <span className="text-gray-500 block">Est. Cost</span>
                <span className="font-black text-primary text-base">₹{estimatedCost.toFixed(2)}</span>
              </div>
            </div>
          </section>

          <div className="pt-2 flex justify-end items-center space-x-3">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={allocateMutation.isPending || !selectedCustomerId}
              className="inline-flex items-center justify-center py-2.5 px-6 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Play className="w-4 h-4 mr-1.5 fill-current" />
              <span>{allocateMutation.isPending ? 'Allocating System...' : 'Start Session & Allocate PC'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Allocate;
