import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search } from 'lucide-react';
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
  
  const { data: customers } = useQuery({
    queryKey: ['customers', customerSearch],
    queryFn: () => customersApi.list(customerSearch),
    enabled: customerSearch.length > 2,
  });

  const { data: terminals } = useQuery({
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
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      navigate('/sessions');
    },
    onError: (error) => {
      alert(error.response?.data?.message || 'Failed to allocate terminal');
    }
  });

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(allocationSchema),
    defaultValues: { duration: 60 }
  });

  const selectedCustomerId = watch('customerId');
  const selectedType = watch('systemType');
  const duration = watch('duration');

  const selectedCustomer = customers?.find(c => c.id.toString() === selectedCustomerId);
  
  const availableTerminals = terminals?.filter(t => 
    t.status === 'available' && t.type === selectedType
  ) || [];

  const rate = rates?.find(r => r.serviceType === selectedType)?.ratePerHour || 0;
  const estimatedCost = (duration / 60) * rate;

  const onSubmit = (data) => {
    if (availableTerminals.length === 0) {
      alert('No terminals available of this type. Consider adding to queue.');
      return;
    }
    
    // Auto-select first available terminal
    const terminalToAllocate = availableTerminals[0];
    
    allocateMutation.mutate({
      customerId: parseInt(data.customerId),
      terminalId: terminalToAllocate.id,
      expectedDurationMinutes: parseInt(data.duration)
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader title="New Session Allocation" />

      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Step 1: Customer */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-4">1. Select Customer</h3>
            
            <div className="mb-4 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                placeholder="Search existing customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>

            {customers && customers.length > 0 && !selectedCustomer && (
              <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto mb-4">
                {customers.map(customer => (
                  <div 
                    key={customer.id}
                    onClick={() => setValue('customerId', customer.id.toString(), { shouldValidate: true })}
                    className="px-4 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                  >
                    <div className="font-medium text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-500">{customer.phone}</div>
                  </div>
                ))}
              </div>
            )}

            {selectedCustomer && (
              <div className="bg-primary/5 border border-primary/20 rounded-md p-4 flex justify-between items-center mb-4">
                <div>
                  <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                  <p className="text-sm text-gray-500">{selectedCustomer.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValue('customerId', '')}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Change
                </button>
              </div>
            )}
            
            {/* Hidden input for react-hook-form to register customerId */}
            <input type="hidden" {...register('customerId')} />
            {errors.customerId && <p className="text-sm text-red-600">{errors.customerId.message}</p>}
          </section>

          {/* Step 2: System Type */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-4">2. System Type</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {['browsing', 'gaming', 'academic'].map((type) => (
                <label 
                  key={type}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedType === type 
                      ? 'border-primary ring-2 ring-primary bg-primary/5' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    value={type}
                    {...register('systemType')}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <p className="font-medium capitalize text-gray-900">{type}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      ${rates?.find(r => r.serviceType === type)?.ratePerHour || 0}/hr
                    </p>
                  </div>
                </label>
              ))}
            </div>
            {errors.systemType && <p className="mt-2 text-sm text-red-600">{errors.systemType.message}</p>}
          </section>

          {/* Step 3: Duration */}
          <section>
            <h3 className="text-lg font-medium text-gray-900 border-b border-gray-200 pb-2 mb-4">3. Duration</h3>
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700">Expected Duration (minutes)</label>
              <div className="mt-1 flex rounded-md shadow-sm">
                <input
                  type="number"
                  {...register('duration')}
                  className="flex-1 block w-full border-gray-300 rounded-none rounded-l-md focus:ring-primary focus:border-primary sm:text-sm border py-2 px-3"
                />
                <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">
                  min
                </span>
              </div>
              {errors.duration && <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>}
            </div>
          </section>

          {/* Summary */}
          {selectedCustomerId && selectedType && (
            <section className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Allocation Summary</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Available Terminals: </span>
                  <span className={`font-medium ${availableTerminals.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {availableTerminals.length}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Estimated Cost: </span>
                  <span className="font-medium">${estimatedCost.toFixed(2)}</span>
                </div>
              </div>
            </section>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || availableTerminals.length === 0}
              className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Allocating...' : 'Start Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Allocate;
