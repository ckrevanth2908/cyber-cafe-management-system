import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, X } from 'lucide-react';
import { customersApi } from '../api';
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

  const columns = [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Phone', accessorKey: 'phone' },
    { header: 'Email', accessorKey: 'email' },
    { header: 'Age', accessorKey: 'age' },
    { 
      header: 'Actions',
      cell: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); openForm(row); }}
          className="text-primary hover:text-primary-dark font-medium"
        >
          Edit
        </button>
      )
    }
  ];

  return (
    <div className="relative">
      <PageHeader 
        title="Customers" 
        action={
          <button 
            onClick={() => openForm()}
            className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Customer
          </button>
        }
      />

      <div className="mb-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm"
            placeholder="Search by name, phone, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={customers || []} 
        loading={isLoading} 
      />

      {/* Slide-in Form Panel */}
      {isFormOpen && (
        <div className="fixed inset-0 overflow-hidden z-50">
          <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeForm} />
          <section className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-md">
              <div className="h-full divide-y divide-gray-200 flex flex-col bg-white shadow-xl">
                <div className="flex-1 h-0 overflow-y-auto">
                  <div className="py-6 px-4 bg-primary sm:px-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-medium text-white">
                        {editingCustomer ? 'Edit Customer' : 'New Customer'}
                      </h2>
                      <div className="ml-3 h-7 flex items-center">
                        <button
                          onClick={closeForm}
                          className="bg-primary rounded-md text-primary-light hover:text-white focus:outline-none"
                        >
                          <X className="h-6 w-6" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="px-4 divide-y divide-gray-200 sm:px-6">
                      <div className="space-y-6 pt-6 pb-5">
                        <form id="customer-form" onSubmit={handleSubmit(onSubmit)}>
                          
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-900">Name</label>
                            <input
                              type="text"
                              {...register('name')}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                            />
                            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                          </div>

                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-900">Phone Number</label>
                            <input
                              type="text"
                              {...register('phone')}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                            />
                            {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
                          </div>

                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-900">Email <span className="text-gray-500 font-normal">(Optional)</span></label>
                            <input
                              type="email"
                              {...register('email')}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                            />
                            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
                          </div>

                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-900">Age</label>
                            <input
                              type="number"
                              {...register('age')}
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                            />
                            {errors.age && <p className="mt-1 text-sm text-red-600">{errors.age.message}</p>}
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
                    className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="customer-form"
                    className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                  >
                    Save
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
