import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, ratesApi } from '../api';
import PageHeader from '../components/PageHeader';

const Admin = () => {
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: adminApi.getConfig
  });

  const { data: rates } = useQuery({
    queryKey: ['rates'],
    queryFn: ratesApi.list
  });

  return (
    <div className="max-w-4xl">
      <PageHeader title="Admin Settings" />
      
      <div className="space-y-6">
        
        {/* System Settings Form (Readonly representation) */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Cafe Name</label>
              <input type="text" readOnly value={config?.cafeName || 'Cyber Cafe Pro'} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 focus:ring-primary focus:border-primary sm:text-sm py-2 px-3 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone</label>
              <input type="text" readOnly value={config?.phone || '555-0199'} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 focus:ring-primary focus:border-primary sm:text-sm py-2 px-3 border" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <input type="text" readOnly value={config?.address || '123 Tech Street'} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 focus:ring-primary focus:border-primary sm:text-sm py-2 px-3 border" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
             <button className="px-4 py-2 bg-primary text-white rounded-md opacity-50 cursor-not-allowed">Save Changes</button>
          </div>
        </div>

        {/* Rates Config */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Service Rates</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {rates?.map((rate) => (
                  <tr key={rate.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                      {rate.serviceType.replace('_', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${(rate.ratePerHour || rate.ratePerUnit || 0).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {rate.ratePerHour ? 'per hour' : 'per unit'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-primary hover:text-primary-dark">Edit</button>
                    </td>
                  </tr>
                ))}
                {!rates && (
                  <tr><td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">Loading rates...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Admin;
