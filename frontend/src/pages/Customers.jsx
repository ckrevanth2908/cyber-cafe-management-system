import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, X, AlertCircle, CheckCircle } from 'lucide-react';
import { customersApi, sessionsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email('Valid email').optional().or(z.literal('')),
  age: z.coerce.number().min(1, 'Age required').max(120, 'Age must be ≤ 120'),
});

const Customers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const queryClient = useQueryClient();

  const { data: customers = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: () => customersApi.list(searchTerm),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const { data: activeSessions = [] } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: () => sessionsApi.list({ status: 'active' }),
    refetchInterval: 30000,
    placeholderData: (prev) => prev,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: '', phone: '', email: '', age: '' },
  });

  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: (newCustomer) => {
      // Optimistically add to cache instantly
      queryClient.setQueryData(['customers', searchTerm], (old = []) => [newCustomer, ...old]);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSubmitSuccess(`Customer "${newCustomer.name}" added successfully!`);
      setTimeout(() => {
        closeForm();
        setSubmitSuccess('');
      }, 1200);
    },
    onError: (err) => {
      setSubmitError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to add customer. Please try again.'
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => customersApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['customers', searchTerm], (old = []) =>
        old.map((c) => (c.id === updated.id ? updated : c))
      );
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setSubmitSuccess('Customer updated!');
      setTimeout(() => {
        closeForm();
        setSubmitSuccess('');
      }, 1000);
    },
    onError: (err) => {
      setSubmitError(
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Failed to update customer.'
      );
    },
  });

  const onSubmit = (data) => {
    setSubmitError('');
    setSubmitSuccess('');
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openForm = (customer = null) => {
    setEditingCustomer(customer);
    setSubmitError('');
    setSubmitSuccess('');
    reset(
      customer
        ? { name: customer.name, phone: customer.phone, email: customer.email || '', age: customer.age }
        : { name: '', phone: '', email: '', age: '' }
    );
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
    setSubmitError('');
    setSubmitSuccess('');
    reset({ name: '', phone: '', email: '', age: '' });
  };

  const endSessionMutation = useMutation({
    mutationFn: sessionsApi.endSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
    },
  });

  const columns = [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: (row) => {
        const activeSess = activeSessions.find(
          (s) => s.customer_id === row.id || s.customerId === row.id
        );
        return (
          <div className="flex items-center space-x-2">
            <span className={`font-bold ${activeSess ? 'text-red-600' : 'text-gray-900'}`}>
              {row.name}
            </span>
            {activeSess && (
              <button
                onClick={(e) => { e.stopPropagation(); endSessionMutation.mutate(activeSess.id); }}
                title="Click to free seat"
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 hover:bg-red-200 transition-all"
              >
                🔴 PC {activeSess.terminal_number || activeSess.terminalNumber} (Free)
              </button>
            )}
          </div>
        );
      },
    },
    { header: 'Phone', accessorKey: 'phone', cell: (row) => row.phone || 'N/A' },
    { header: 'Email', accessorKey: 'email', cell: (row) => row.email || 'N/A' },
    {
      header: 'Age',
      accessorKey: 'age',
      cell: (row) => <span className="font-semibold text-gray-700">{row.age} yrs</span>,
    },
    {
      header: 'Status',
      cell: (row) => {
        const activeSess = activeSessions.find(
          (s) => s.customer_id === row.id || s.customerId === row.id
        );
        if (activeSess) {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); endSessionMutation.mutate(activeSess.id); }}
              className="px-2.5 py-1 rounded-full text-xs font-black bg-red-600 hover:bg-red-700 text-white transition-all"
            >
              OCCUPIED — Free Seat
            </button>
          );
        }
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            🟢 Idle
          </span>
        );
      },
    },
    {
      header: 'Actions',
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); openForm(row); }}
          className="text-primary hover:text-primary-dark font-bold text-xs underline"
        >
          Edit
        </button>
      ),
    },
  ];

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="relative space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Customer Profiles"
        subtitle="Register and manage customers. Click a name to edit. Click OCCUPIED to free a seat."
        action={
          <button
            onClick={() => openForm()}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Customer
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary shadow-sm"
          placeholder="Search by name, phone, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* API Error Banner */}
      {isError && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Could not load customers — server may be waking up (Render free tier).{' '}
              <strong>{error?.message}</strong>
            </span>
          </div>
          <button
            onClick={() => refetch()}
            className="ml-4 text-xs font-bold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <DataTable columns={columns} data={customers} loading={isLoading && customers.length === 0} />
      </div>

      {/* Slide-in Form Panel */}
      {isFormOpen && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={closeForm} />
          <section className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-md">
              <div className="h-full flex flex-col bg-white shadow-xl">
                {/* Header */}
                <div className="py-6 px-6 bg-primary">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">
                      {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                    </h2>
                    <button onClick={closeForm} className="text-blue-200 hover:text-white">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-6">
                  {/* Success / Error feedback */}
                  {submitSuccess && (
                    <div className="mb-4 flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 font-semibold">
                      <CheckCircle className="w-4 h-4" />
                      <span>{submitSuccess}</span>
                    </div>
                  )}
                  {submitError && (
                    <div className="mb-4 flex items-center space-x-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 font-semibold">
                      <AlertCircle className="w-4 h-4" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        {...register('name')}
                        className={`w-full border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        placeholder="e.g. Ramesh Kumar"
                      />
                      {errors.name && (
                        <p className="mt-1 text-xs text-red-600 font-semibold">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        {...register('phone')}
                        className={`w-full border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors.phone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        placeholder="e.g. 9876543210"
                      />
                      {errors.phone && (
                        <p className="mt-1 text-xs text-red-600 font-semibold">{errors.phone.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        {...register('email')}
                        className={`w-full border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors.email ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        placeholder="e.g. user@example.com"
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs text-red-600 font-semibold">{errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                        Age *
                      </label>
                      <input
                        type="number"
                        {...register('age')}
                        className={`w-full border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${errors.age ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                        placeholder="e.g. 21"
                        min="1"
                        max="120"
                      />
                      {errors.age && (
                        <p className="mt-1 text-xs text-red-600 font-semibold">{errors.age.message}</p>
                      )}
                    </div>
                  </form>
                </div>

                {/* Footer buttons */}
                <div className="flex-shrink-0 px-6 py-4 flex justify-end space-x-3 bg-gray-50 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={closeForm}
                    disabled={isBusy}
                    className="py-2 px-4 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="customer-form"
                    disabled={isBusy}
                    className="py-2 px-5 bg-primary hover:bg-primary-dark text-white rounded-lg text-xs font-bold disabled:opacity-50 flex items-center space-x-1"
                  >
                    {isBusy ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingCustomer ? 'Update Customer' : 'Save Customer'}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default Customers;
