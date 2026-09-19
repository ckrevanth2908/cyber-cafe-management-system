import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Printer, CheckCircle, AlertCircle } from 'lucide-react';
import { printingApi, printersApi, customersApi, ratesApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';

const printSchema = z.object({
  customerId: z.string().optional(),
  printerId: z.string().optional(),
  serviceType: z.enum(['plain_print', 'colour_print', 'xerox']),
  pages: z.number({ coerce: true }).min(1, 'At least 1 page is required')
});

const Printing = () => {
  const queryClient = useQueryClient();
  const [customerSearch, setCustomerSearch] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { data: printJobs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['printing'],
    queryFn: () => printingApi.list(),
    placeholderData: (prev) => prev,
  });

  const { data: printers = [] } = useQuery({
    queryKey: ['printers'],
    queryFn: printersApi.list,
    placeholderData: (prev) => prev,
  });

  const { data: rates = [] } = useQuery({
    queryKey: ['rates'],
    queryFn: ratesApi.list,
    placeholderData: (prev) => prev,
  });

  const { data: allCustomers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersApi.list(),
    placeholderData: (prev) => prev,
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(printSchema),
    defaultValues: {
      serviceType: 'plain_print',
      pages: 1
    }
  });

  const createMutation = useMutation({
    mutationFn: printingApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['printing'] });
      queryClient.invalidateQueries({ queryKey: ['dailyRevenue'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      setSuccessMsg('Print / Xerox job successfully recorded!');
      setErrorMsg('');
      reset({ serviceType: 'plain_print', pages: 1 });
      setCustomerSearch('');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to record print transaction');
    }
  });

  const pages = watch('pages') || 1;
  const serviceType = watch('serviceType') || 'plain_print';
  const selectedCustomerId = watch('customerId');

  const selectedCustomer = (allCustomers || []).find(c => c.id.toString() === selectedCustomerId);
  const filteredCustomers = (allCustomers || []).filter(c => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone?.includes(q);
  });
  
  const currentRateObj = rates?.find(r => (r.service_type || r.serviceType) === serviceType);
  const costPerPage = currentRateObj ? (currentRateObj.rate_per_unit || currentRateObj.ratePerUnit || 2) : 2;
  const totalAmount = pages * costPerPage;

  const onSubmit = (data) => {
    setSuccessMsg('');
    setErrorMsg('');

    // Default to first customer if none selected or fallback to customer 1
    const finalCustId = data.customerId ? parseInt(data.customerId, 10) : (allCustomers && allCustomers.length > 0 ? allCustomers[0].id : 1);
    const finalPrinterId = data.printerId ? parseInt(data.printerId, 10) : (printers && printers.length > 0 ? printers[0].id : null);

    createMutation.mutate({
      customer_id: finalCustId,
      printer_id: finalPrinterId,
      service_type: data.serviceType,
      num_pages: parseInt(data.pages, 10),
      notes: `Instant ${data.serviceType.replace('_', ' ')}`
    });
  };

  const columns = [
    { 
      header: 'Date & Time', 
      accessorKey: 'created_at',
      cell: (row) => format(new Date(row.created_at || row.createdAt || Date.now()), 'dd MMM, hh:mm a')
    },
    { 
      header: 'Customer', 
      accessorKey: 'customer_name', 
      cell: (row) => row.customer_name || row.customerName || 'Walk-in Customer' 
    },
    { 
      header: 'Service', 
      accessorKey: 'service_type', 
      cell: (row) => <span className="capitalize font-semibold text-gray-800">{(row.service_type || row.serviceType || '').replace('_', ' ')}</span>
    },
    { 
      header: 'Pages', 
      accessorKey: 'num_pages',
      cell: (row) => row.num_pages || row.pages || 1
    },
    { 
      header: 'Total Paid', 
      accessorKey: 'total_amount', 
      cell: (row) => <span className="font-bold text-primary">₹{Number(row.total_amount || row.amount || 0).toFixed(2)}</span>
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      <div className="lg:col-span-3">
        <PageHeader 
          title="Instant Printing & Xerox Desk" 
          subtitle="Instant plain b&w, colour printouts and document photocopying without terminal allocation"
        />
      </div>

      {/* New Job Form */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit space-y-4">
        <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center">
          <Printer className="w-5 h-5 mr-2 text-primary" />
          Log Print / Xerox Job
        </h3>

        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-xs flex items-center">
            <CheckCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center">
            <AlertCircle className="w-4 h-4 mr-1.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* Customer */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Customer (Optional)</label>
            {selectedCustomer ? (
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-900">{selectedCustomer.name}</span>
                <button 
                  type="button" 
                  onClick={() => setValue('customerId', '')} 
                  className="text-red-600 font-bold hover:underline"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary text-sm"
                  placeholder="Type to filter customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
                {customerSearch && (
                  <div className="mt-1 border border-gray-200 rounded-md max-h-32 overflow-y-auto divide-y divide-gray-100 text-xs">
                    {filteredCustomers.map(c => (
                      <div 
                        key={c.id}
                        onClick={() => {
                          setValue('customerId', c.id.toString());
                          setCustomerSearch('');
                        }}
                        className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex justify-between"
                      >
                        <span className="font-medium text-gray-800">{c.name}</span>
                        <span className="text-gray-500">{c.phone}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            <input type="hidden" {...register('customerId')} />
          </div>

          {/* Service Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Service Type</label>
            <select
              {...register('serviceType')}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary text-sm"
            >
              <option value="plain_print">Plain B&W Print (₹2/page)</option>
              <option value="colour_print">Colour Print (₹10/page)</option>
              <option value="xerox">Photocopy / Xerox (₹1/page)</option>
            </select>
            {errors.serviceType && <p className="mt-1 text-xs text-red-600">{errors.serviceType.message}</p>}
          </div>

          {/* Printer Device */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Printer / Machine</label>
            <select
              {...register('printerId')}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary text-sm"
            >
              <option value="">Default Machine</option>
              {printers?.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.printer_type || p.type})</option>
              ))}
            </select>
          </div>

          {/* Number of Pages */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Number of Pages</label>
            <input
              type="number"
              min="1"
              max="500"
              {...register('pages')}
              className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary text-sm"
            />
            {errors.pages && <p className="mt-1 text-xs text-red-600">{errors.pages.message}</p>}
          </div>

          {/* Price Calculation Box */}
          <div className="pt-3 border-t border-gray-200">
            <div className="bg-gray-50 p-3 rounded-lg flex justify-between items-center mb-3">
              <div>
                <span className="text-xs text-gray-500 block">Rate: ₹{costPerPage} / page</span>
                <span className="text-xs font-bold text-gray-700">Total Charge:</span>
              </div>
              <span className="text-xl font-extrabold text-primary">₹{totalAmount.toFixed(2)}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || pages < 1}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Record & Collect Payment'}
            </button>
          </div>

        </form>
      </div>

      {/* History Table */}
      <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Recent Printing & Xerox Operations</h3>
        <DataTable 
          columns={columns} 
          data={printJobs} 
          loading={isLoading && printJobs.length === 0} 
        />
      </div>

    </div>
  );
};

export default Printing;
