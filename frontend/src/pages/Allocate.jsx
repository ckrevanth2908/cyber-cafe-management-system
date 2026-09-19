import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, Monitor, CheckCircle, AlertCircle, UserPlus } from 'lucide-react';
import { customersApi, terminalsApi, allocationsApi, ratesApi } from '../api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';

const allocationSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer'),
  systemType: z.enum(['browsing', 'gaming', 'academic'], { errorMap: () => ({ message: "Please select a system type" }) }),
  duration: z.number({ coerce: true }).min(15, 'Minimum duration is 15 minutes').max(720, 'Maximum duration is 12 hours'),
});

const Allocate = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Fetch all customers (filterable via customerSearch)
  const { data: allCustomers, isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
  });

  const { data: terminals, isLoading: terminalsLoading } = useQuery({
    queryKey: ['terminals'],
    queryFn: terminalsApi.list
  });

  const { data: rates } = useQuery({
    queryKey: ['rates'],
    queryFn: ratesApi.list
  });

  const allocateMutation = useMutation({
    mutationFn: allocationsApi.allocate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      navigate('/sessions');
    },
    onError: (error) => {
      const msg = error.response?.data?.detail || error.response?.data?.message || 'Failed to allocate terminal';
      setErrorMessage(msg);
    }
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(allocationSchema),
    defaultValues: { 
      systemType: 'browsing',
      duration: 60 
    }
  });

  const selectedCustomerId = watch('customerId');
  const selectedType = watch('systemType');
  const duration = watch('duration') || 60;

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
  
  // Match available terminals by type_name or name
  const availableTerminals = (terminals || []).filter(t => {
    const tTypeName = (t.type_name || t.type || '').toLowerCase();
    return t.status === 'available' && tTypeName === selectedType.toLowerCase();
  });

  const currentRateObj = (rates || []).find(r => (r.service_type || r.serviceType || '').toLowerCase() === selectedType.toLowerCase());
  const hourlyRate = currentRateObj ? (currentRateObj.rate_per_unit || currentRateObj.ratePerHour || 20) : 20;
  const estimatedCost = (duration / 60) * hourlyRate;

  const onSubmit = (data) => {
    setErrorMessage('');
    if (availableTerminals.length === 0) {
      setErrorMessage(`No ${selectedType} terminals currently available. Please put the customer into the Waiting Queue.`);
      return;
    }
    
    // Auto-select first available terminal
    const terminalToAllocate = availableTerminals[0];
    
    allocateMutation.mutate({
      customer_id: parseInt(data.customerId, 10),
      terminal_id: terminalToAllocate.id,
      system_type: data.systemType,
      duration_minutes: parseInt(data.duration, 10)
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader 
        title="Terminal Allocation & Session Launch" 
        subtitle="Assign an available computer to a customer and start their live timer"
      />

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center text-red-700 text-sm">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Step 1: Customer Selection */}
          <section>
            <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
              <h3 className="text-lg font-medium text-gray-900">1. Select Customer</h3>
              <button
                type="button"
                onClick={() => navigate('/customers')}
                className="text-xs text-primary hover:underline flex items-center"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1" />
                Register New Customer
              </button>
            </div>
            
            <div className="mb-3 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="Search by name, phone or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>

            {selectedCustomer ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-center mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedCustomer.name} (Age: {selectedCustomer.age})</p>
                    <p className="text-xs text-gray-600">Phone: {selectedCustomer.phone || 'N/A'} • Email: {selectedCustomer.email || 'N/A'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setValue('customerId', '', { shouldValidate: true })}
                  className="text-xs font-semibold bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded hover:bg-red-50"
                >
                  Change Customer
                </button>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto mb-4 divide-y divide-gray-100">
                {customersLoading ? (
                  <div className="p-4 text-center text-sm text-gray-500"><LoadingSpinner size="sm" /> Loading customers...</div>
                ) : filteredCustomers.length > 0 ? (
                  filteredCustomers.map(customer => (
                    <div 
                      key={customer.id}
                      onClick={() => setValue('customerId', customer.id.toString(), { shouldValidate: true })}
                      className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{customer.name}</span>
                        <span className="text-xs text-gray-500 ml-2">(Age: {customer.age})</span>
                        <div className="text-xs text-gray-500">{customer.phone} {customer.email && `• ${customer.email}`}</div>
                      </div>
                      <span className="text-xs text-primary font-medium">Select →</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No customers found. <span className="text-primary cursor-pointer underline" onClick={() => navigate('/customers')}>Add one now</span>
                  </div>
                )}
              </div>
            )}
            
            <input type="hidden" {...register('customerId')} />
            {errors.customerId && <p className="text-sm text-red-600 mt-1">{errors.customerId.message}</p>}
          </section>

          {/* Step 2: System Type */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-4">2. Select Terminal Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'browsing', title: 'Browsing System', desc: 'Standard internet, web & mail' },
                { id: 'gaming', title: 'Gaming System', desc: 'High-end GPU, gaming setup' },
                { id: 'academic', title: 'Academic System', desc: 'Study, research & typing' }
              ].map((item) => {
                const isSelected = selectedType === item.id;
                const r = (rates || []).find(rate => (rate.service_type || rate.serviceType || '').toLowerCase() === item.id);
                const price = r ? (r.rate_per_unit || r.ratePerHour || 0) : 0;
                const countAvail = (terminals || []).filter(t => (t.type_name || t.type || '').toLowerCase() === item.id && t.status === 'available').length;

                return (
                  <label 
                    key={item.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected 
                        ? 'border-primary ring-2 ring-primary bg-blue-50/50 shadow-sm' 
                        : 'border-gray-300 hover:border-gray-400 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      value={item.id}
                      {...register('systemType')}
                      className="sr-only"
                    />
                    <div>
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-gray-900">{item.title}</p>
                        {isSelected && <CheckCircle className="w-5 h-5 text-primary" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{item.desc}</p>
                    </div>
                    
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
                      <span className="font-semibold text-gray-900 text-sm">₹{price} / hr</span>
                      <span className={`px-2 py-0.5 rounded font-medium ${countAvail > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {countAvail} Available
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.systemType && <p className="mt-2 text-sm text-red-600">{errors.systemType.message}</p>}
          </section>

          {/* Step 3: Duration */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-4">3. Usage Duration</h3>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700">Expected Duration (minutes)</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="number"
                  step="15"
                  min="15"
                  max="720"
                  {...register('duration')}
                  className="flex-1 block w-full border-gray-300 rounded-none rounded-l-md focus:ring-primary focus:border-primary sm:text-sm border py-2 px-3"
                />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  min
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                {[30, 60, 120, 180].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setValue('duration', mins)}
                    className={`text-xs px-2.5 py-1 rounded border ${duration === mins ? 'bg-primary text-white border-primary' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
                  >
                    {mins >= 60 ? `${mins / 60} hr` : `${mins} min`}
                  </button>
                ))}
              </div>
              {errors.duration && <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>}
            </div>
          </section>

          {/* Step 4: Summary & Costing */}
          <section className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Session Cost Estimate</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500 text-xs block">Assigned System</span>
                <span className="font-medium capitalize text-gray-900">{selectedType} Terminal</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Duration</span>
                <span className="font-medium text-gray-900">{duration} minutes</span>
              </div>
              <div>
                <span className="text-gray-500 text-xs block">Estimated Rate</span>
                <span className="font-bold text-primary text-base">₹{estimatedCost.toFixed(2)}</span>
              </div>
            </div>
          </section>

          <div className="pt-4 flex justify-end items-center space-x-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || availableTerminals.length === 0}
              className="inline-flex justify-center py-2.5 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Starting Session...' : 'Start Session & Allocate PC'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Allocate;
