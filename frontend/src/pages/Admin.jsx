import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { adminApi, ratesApi } from '../api';
import PageHeader from '../components/PageHeader';
import LoadingSpinner from '../components/LoadingSpinner';

const Admin = () => {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState('');
  const [editingRateId, setEditingRateId] = useState(null);
  const [newRateValue, setNewRateValue] = useState('');

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['config'],
    queryFn: adminApi.getConfig
  });

  const { data: rates, isLoading: ratesLoading } = useQuery({
    queryKey: ['rates'],
    queryFn: ratesApi.list
  });

  const updateRateMutation = useMutation({
    mutationFn: ({ id, rate_per_unit }) => ratesApi.update(id, { rate_per_unit: parseFloat(rate_per_unit) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rates'] });
      setEditingRateId(null);
      setSuccessMsg('Service pricing rate updated successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  });

  const handleSaveRate = (id) => {
    if (newRateValue && !isNaN(newRateValue)) {
      updateRateMutation.mutate({ id, rate_per_unit: newRateValue });
    }
  };

  return (
    <div className="max-w-5xl space-y-6 mx-auto">
      <PageHeader 
        title="Administrative Controls & Settings" 
        subtitle="Manage hourly computer tariffs, printing charges in ₹ (INR), and café system parameters"
      />

      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-lg flex items-center text-sm">
          <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      
      <div className="space-y-6">
        
        {/* Rates Config */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Service Rate Card (₹ INR)</h3>
              <p className="text-xs text-gray-500">Configure cost per hour for systems and per-page rates for document printing</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Service Category</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rate (₹ INR)</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Billing Unit</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {ratesLoading ? (
                  <tr><td colSpan="5" className="p-4 text-center"><LoadingSpinner size="sm" /></td></tr>
                ) : rates?.map((rate) => {
                  const serviceTypeStr = rate.service_type || rate.serviceType || '';
                  const unitRate = Number(rate.rate_per_unit ?? rate.ratePerHour ?? rate.ratePerUnit ?? 0);
                  const isEditing = editingRateId === rate.id;

                  return (
                    <tr key={rate.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 whitespace-nowrap font-bold text-gray-900 capitalize">
                        {serviceTypeStr.replace('_', ' ')}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-500 text-sm">₹</span>
                            <input
                              type="number"
                              step="0.5"
                              value={newRateValue}
                              onChange={(e) => setNewRateValue(e.target.value)}
                              className="w-24 border border-primary rounded px-2 py-1 text-sm font-semibold text-gray-900"
                              autoFocus
                            />
                          </div>
                        ) : (
                          <span className="font-extrabold text-primary text-base">
                            ₹{unitRate.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-600 text-xs">
                        per {rate.unit || (serviceTypeStr.includes('print') || serviceTypeStr === 'xerox' ? 'page' : 'hour')}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-gray-500 text-xs">
                        {rate.description || 'Standard service charge'}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-right text-xs font-semibold">
                        {isEditing ? (
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleSaveRate(rate.id)}
                              className="bg-primary text-white px-2.5 py-1 rounded hover:bg-primary-dark"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRateId(null)}
                              className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingRateId(rate.id);
                              setNewRateValue(unitRate.toString());
                            }}
                            className="text-primary hover:underline"
                          >
                            Edit Rate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Settings Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-1">Café Branding & Policies</h3>
          <p className="text-xs text-gray-500 mb-4">Location information printed on official customer invoices and gaming restrictions</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Café Legal Name</label>
              <input 
                type="text" 
                readOnly 
                value={config?.cafe_name || config?.cafeName || 'CyberNet Cafe Pro'} 
                className="w-full border-gray-300 rounded-lg shadow-sm bg-gray-50 py-2 px-3 border text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Contact Phone</label>
              <input 
                type="text" 
                readOnly 
                value={config?.phone || '555-0100'} 
                className="w-full border-gray-300 rounded-lg shadow-sm bg-gray-50 py-2 px-3 border text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Gaming Age Limit</label>
              <input 
                type="text" 
                readOnly 
                value={`${config?.age_restriction_gaming || 15} Years`} 
                className="w-full border-gray-300 rounded-lg shadow-sm bg-gray-50 py-2 px-3 border text-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Session Expiry Warning</label>
              <input 
                type="text" 
                readOnly 
                value={`${config?.session_warning_minutes || 5} Minutes Before Expiry`} 
                className="w-full border-gray-300 rounded-lg shadow-sm bg-gray-50 py-2 px-3 border text-sm" 
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Admin;
