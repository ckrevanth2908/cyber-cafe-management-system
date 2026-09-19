import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, X, Monitor, CheckCircle, UserCheck } from 'lucide-react';
import { customersApi, sessionsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Valid phone number required'),
  email: z.string().email('Valid email required').optional().or(z.literal('')),
  age: z.number({ coerce: true }).min(1, 'Age is required').max(120),
});

const Customers = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers', searchTerm],
    queryFn: () => customersApi.list(searchTerm),
    refetchInterval: 5000
  });

  const { data: activeSessions } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: () => sessionsApi.list({ status: 'active' }),
    refetchInterval: 5000
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(customerSchema)
  });

  const createMutation = useMutation({
    mutationFn: customersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => customersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      closeForm();
    }
  });

  const onSubmit = (data) => {
    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openForm = (customer = null) => {
    setEditingCustomer(customer);
    if (customer) {
      reset(customer);
    } else {
      reset({ name: '', phone: '', email: '', age: '' });
    }
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
    reset();
  };

  const endSessionMutation = useMutation({
    mutationFn: sessionsApi.endSession,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['dailyRevenue'] });
    }
  });

  const columns = [
    { 
      header: 'Name', 
      accessorKey: 'name',
      cell: (row) => {
        const activeSess = activeSessions?.find(s => s.customer_id === row.id || s.customerId === row.id);
        return (
          <div className="flex items-center space-x-2">
            <span className={`font-bold ${activeSess ? 'text-red-600' : 'text-gray-900'}`}>
              {row.name}
            </span>
            {activeSess && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  endSessionMutation.mutate(activeSess.id);
                }}
                title="Click to release seat and set status to Available"
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 hover:bg-red-200 active:scale-95 transition-all"
              >
                🔴 On PC {activeSess.terminal_number || activeSess.terminalNumber} (Click to Free)
              </button>
            )}
          </div>
        );
      }
    },
    { 
      header: 'Phone', 
      accessorKey: 'phone',
      cell: (row) => row.phone || 'N/A'
    },
    { 
      header: 'Email', 
      accessorKey: 'email',
      cell: (row) => row.email || 'N/A'
    },
    { 
      header: 'Age', 
      accessorKey: 'age',
      cell: (row) => <span className="font-semibold text-gray-700">{row.age} yrs</span>
    },
    { 
      header: 'Current Status',
      accessorKey: 'status',
      cell: (row) => {
        const activeSess = activeSessions?.find(s => s.customer_id === row.id || s.customerId === row.id);
        if (activeSess) {
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                endSessionMutation.mutate(activeSess.id);
              }}
              title="Click to free seat and mark customer Idle"
              className="px-2.5 py-1 rounded-full text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-sm active:scale-95 transition-all flex items-center space-x-1"
            >
              <span>OCCUPIED (Free Seat)</span>
            </button>
          );
        }
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            🟢 Idle / Available
          </span>
        );
      }
    },
    { 
      header: 'Actions',
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); openForm(row); }}
          className="text-primary hover:text-primary-dark font-bold text-xs"
        >
          Edit Profile
        </button>
      )
    }
  ];

  return (
    <div className="relative space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Registered Customer Profiles" 
        subtitle="Manage customer records, view real-time occupied statuses (highlighted in RED), and edit contact details"
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

      <div className="relative max-w-md">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary shadow-sm"
          placeholder="Search by customer name, phone, or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <DataTable 
          columns={columns} 
          data={customers || []} 
          loading={isLoading} 
        />
      </div>

      {/* Slide-in Form Panel */}
      {isFormOpen && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity" onClick={closeForm} />
          <section className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-md">
              <div className="h-full divide-y divide-gray-200 flex flex-col bg-white shadow-xl">
                <div className="flex-1 h-0 overflow-y-auto">
                  <div className="py-6 px-4 bg-primary sm:px-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-white">
                        {editingCustomer ? 'Edit Customer Profile' : 'Register New Customer'}
                      </h2>
                      <div className="ml-3 h-7 flex items-center">
                        <button
                          onClick={closeForm}
                          className="bg-primary rounded-md text-blue-200 hover:text-white focus:outline-none"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="px-4 divide-y divide-gray-200 sm:px-6">
                      <div className="space-y-6 pt-6 pb-5">
                        <form id="customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                          
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Full Name</label>
                            <input
                              type="text"
                              {...register('name')}
                              className="w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary text-sm"
                              placeholder="e.g. Ramesh Kumar"
                            />
                            {errors.name && <p className="mt-1 text-xs text-red-600 font-semibold">{errors.name.message}</p>}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Phone Number</label>
                            <input
                              type="text"
                              {...register('phone')}
                              className="w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary text-sm"
                              placeholder="e.g. +91 9876543210"
                            />
                            {errors.phone && <p className="mt-1 text-xs text-red-600 font-semibold">{errors.phone.message}</p>}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Email (Optional)</label>
                            <input
                              type="email"
                              {...register('email')}
                              className="w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary text-sm"
                              placeholder="e.g. user@example.com"
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-600 font-semibold">{errors.email.message}</p>}
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Age</label>
                            <input
                              type="number"
                              {...register('age')}
                              className="w-full border border-gray-300 rounded-lg shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary text-sm"
                              placeholder="e.g. 21"
                            />
                            {errors.age && <p className="mt-1 text-xs text-red-600 font-semibold">{errors.age.message}</p>}
                          </div>

                        </form>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 px-4 py-4 flex justify-end space-x-3 bg-gray-50">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="bg-white py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="customer-form"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-xs font-bold rounded-lg text-white bg-primary hover:bg-primary-dark"
                  >
                    Save Customer
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
