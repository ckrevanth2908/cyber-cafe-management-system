import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { printingApi, printersApi, customersApi, ratesApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';

const printSchema = z.object({
  customerId: z.string().optional(),
  printerId: z.string().min(1, 'Select a printer'),
  serviceType: z.enum(['plain_print', 'colour_print', 'xerox']),
  pages: z.number({ coerce: true }).min(1, 'At least 1 page required')
});

const Printing = () => {
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');

  const { data: printJobs, isLoading } = useQuery({
    queryKey: ['printing'],
    queryFn: () => printingApi.list()
  });

  const { data: printers } = useQuery({
    queryKey: ['printers'],
    queryFn: printersApi.list
  });

  const { data: rates } = useQuery({
    queryKey: ['rates'],
    queryFn: ratesApi.list
  });

  const { data: customers } = useQuery({
    queryKey: ['customers', customerSearch],
    queryFn: () => customersApi.list(customerSearch),
    enabled: customerSearch.length > 2,
  });

  const createMutation = useMutation({
    mutationFn: printingApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printing'] });
      reset();
      setCustomerSearch('');
    }
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(printSchema)
  });

  const pages = watch('pages') || 0;
  const serviceType = watch('serviceType');
  
  const rate = rates?.find(r => r.serviceType === serviceType)?.ratePerUnit || 0;
  const totalAmount = pages * rate;

  const onSubmit = (data) => {
    createMutation.mutate({
      ...data,
      customerId: data.customerId ? parseInt(data.customerId) : null,
      printerId: parseInt(data.printerId),
      amount: totalAmount
    });
  };

  const columns = [
    { 
      header: 'Date', 
      accessorKey: 'createdAt',
      cell: (row) => format(new Date(row.createdAt), 'dd MMM HH:mm')
    },
    { header: 'Customer', accessorKey: 'customerName', cell: (row) => row.customerName || 'Walk-in' },
    { header: 'Type', accessorKey: 'serviceType', cell: (row) => row.serviceType.replace('_', ' ') },
    { header: 'Pages', accessorKey: 'pages' },
    { header: 'Amount', accessorKey: 'amount', cell: (row) => `$${row.amount.toFixed(2)}` }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-3">
        <PageHeader title="Printing & Xerox Services" />
      </div>

      {/* New Job Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">New Print Job</h3>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Customer (Optional)</label>
            <input
              type="text"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
            {customers && customers.length > 0 && customerSearch.length > 2 && (
              <div className="mt-1 border border-gray-200 rounded-md max-h-32 overflow-y-auto">
                {customers.map(c => (
                  <div 
                    key={c.id}
                    onClick={() => {
                      setValue('customerId', c.id.toString());
                      setCustomerSearch(c.name);
                    }}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    {c.name}
                  </div>
                ))}
              </div>
            )}
            <input type="hidden" {...register('customerId')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Printer</label>
            <select
              {...register('printerId')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="">Select a printer...</option>
              {printers?.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
              ))}
            </select>
            {errors.printerId && <p className="mt-1 text-sm text-red-600">{errors.printerId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Service Type</label>
            <select
              {...register('serviceType')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            >
              <option value="">Select service...</option>
              <option value="plain_print">Plain Print (B&W)</option>
              <option value="colour_print">Colour Print</option>
              <option value="xerox">Xerox / Copy</option>
            </select>
            {errors.serviceType && <p className="mt-1 text-sm text-red-600">{errors.serviceType.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Number of Pages</label>
            <input
              type="number"
              {...register('pages')}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
            />
            {errors.pages && <p className="mt-1 text-sm text-red-600">{errors.pages.message}</p>}
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-600">Total Amount:</span>
              <span className="text-xl font-bold text-gray-900">${totalAmount.toFixed(2)}</span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !serviceType || !pages}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              Record Job
            </button>
          </div>

        </form>
      </div>

      {/* History Table */}
      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Print Jobs</h3>
        <DataTable 
          columns={columns} 
          data={printJobs || []} 
          loading={isLoading} 
        />
      </div>

    </div>
  );
};

export default Printing;
