import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutGrid, List, Monitor, Wrench, CheckCircle, X } from 'lucide-react';
import { terminalsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import TerminalCard from '../components/TerminalCard';

const Terminals = () => {
  const [viewMode, setViewMode] = useState('grid');
  const [filterType, setFilterType] = useState('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newTypeId, setNewTypeId] = useState('1');
  const [newSpecs, setNewSpecs] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  const queryClient = useQueryClient();

  const { data: terminals, isLoading } = useQuery({
    queryKey: ['terminals'],
    queryFn: terminalsApi.list
  });

  const { data: terminalTypes } = useQuery({
    queryKey: ['terminalTypes'],
    queryFn: terminalsApi.types
  });

  const toggleMaintenance = useMutation({
    mutationFn: ({ id, status }) => terminalsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
    }
  });

  const addTerminalMutation = useMutation({
    mutationFn: terminalsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      setIsAddModalOpen(false);
      setNewNumber('');
      setNewSpecs('');
      setErrorMsg('');
    },
    onError: (err) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to create terminal');
    }
  });

  const handleAddTerminal = (e) => {
    e.preventDefault();
    if (!newNumber.trim()) {
      setErrorMsg('Terminal number is required (e.g. B-03, G-03)');
      return;
    }
    setErrorMsg('');
    addTerminalMutation.mutate({
      terminal_number: newNumber.trim(),
      type_id: parseInt(newTypeId, 10),
      specifications: newSpecs.trim()
    });
  };

  const filteredTerminals = (terminals || []).filter(t => {
    if (filterType === 'All') return true;
    const tType = (t.type_name || t.type || '').toLowerCase();
    return tType === filterType.toLowerCase();
  });

  const freeTerminalMutation = useMutation({
    mutationFn: terminalsApi.freeTerminal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['dailyRevenue'] });
      queryClient.invalidateQueries({ queryKey: ['sessionHistorySummary'] });
    }
  });

  const columns = [
    { 
      header: 'Terminal No.', 
      accessorKey: 'terminal_number',
      cell: (row) => <span className="font-bold text-primary">{row.terminal_number || row.number}</span>
    },
    { 
      header: 'Type', 
      accessorKey: 'type_name', 
      cell: (row) => <span className="capitalize font-semibold text-gray-800">{row.type_name || row.type}</span> 
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    { 
      header: 'Specifications', 
      accessorKey: 'specifications',
      cell: (row) => row.specifications || 'Standard PC Setup'
    },
    { 
      header: 'Actions',
      cell: (row) => {
        if (row.status === 'occupied') {
          return (
            <button
              onClick={() => {
                if (window.confirm(`Release ${row.terminal_number} and revoke occupied status?`)) {
                  freeTerminalMutation.mutate(row.id);
                }
              }}
              disabled={freeTerminalMutation.isPending}
              className="text-xs font-bold px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white shadow-sm transition-colors"
              title="Click when customer leaves to free this seat"
            >
              Customer Left (Free Seat)
            </button>
          );
        }
        return (
          <button
            onClick={() => {
              toggleMaintenance.mutate({ 
                id: row.id, 
                status: row.status === 'maintenance' ? 'available' : 'maintenance' 
              });
            }}
            className={`text-xs font-semibold px-2.5 py-1 rounded border ${
              row.status === 'maintenance' 
                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            {row.status === 'maintenance' ? 'Mark Available' : 'Set Maintenance'}
          </button>
        );
      }
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader 
        title="Computer Terminals Management" 
        subtitle="Configure physical client PCs, view live statuses, and manage hardware maintenance"
        action={
          <div className="flex items-center space-x-3">
            <div className="flex items-center bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center px-3.5 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-sm hover:bg-primary-dark"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add PC Terminal
            </button>
          </div>
        }
      />

      <div className="flex space-x-2">
        {['All', 'Browsing', 'Gaming', 'Academic'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-colors ${
              filterType === type 
                ? 'bg-primary text-white shadow-sm' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredTerminals.map(terminal => (
            <TerminalCard 
              key={terminal.id} 
              terminal={terminal} 
              session={terminal.current_session}
              onClick={() => {
                if (terminal.status !== 'occupied') {
                  toggleMaintenance.mutate({ 
                    id: terminal.id, 
                    status: terminal.status === 'maintenance' ? 'available' : 'maintenance' 
                  });
                }
              }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <DataTable 
            columns={columns} 
            data={filteredTerminals} 
            loading={isLoading} 
          />
        </div>
      )}

      {/* Add Terminal Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-900">Add Computer Terminal</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-md">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddTerminal} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Terminal Number</label>
                <input
                  type="text"
                  placeholder="e.g. B-03, G-03, A-02"
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Terminal Type</label>
                <select
                  value={newTypeId}
                  onChange={(e) => setNewTypeId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                >
                  {terminalTypes?.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.description})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">Hardware Specifications</label>
                <input
                  type="text"
                  placeholder="e.g. RTX 4070, 32GB RAM, 240Hz"
                  value={newSpecs}
                  onChange={(e) => setNewSpecs(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addTerminalMutation.isPending}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark text-xs font-bold disabled:opacity-50"
                >
                  {addTerminalMutation.isPending ? 'Saving...' : 'Add Terminal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Terminals;
