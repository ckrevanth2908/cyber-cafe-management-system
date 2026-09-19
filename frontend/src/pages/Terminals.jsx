import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { terminalsApi } from '../api';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import TerminalCard from '../components/TerminalCard';

const Terminals = () => {
  const [viewMode, setViewMode] = useState('grid');
  const [filterType, setFilterType] = useState('All');
  
  const queryClient = useQueryClient();

  const { data: terminals, isLoading } = useQuery({
    queryKey: ['terminals'],
    queryFn: terminalsApi.list
  });

  const toggleMaintenance = useMutation({
    mutationFn: ({ id, status }) => terminalsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
    }
  });

  const filteredTerminals = terminals?.filter(t => 
    filterType === 'All' ? true : t.type === filterType.toLowerCase()
  ) || [];

  const columns = [
    { header: 'Terminal No.', accessorKey: 'number' },
    { header: 'Type', accessorKey: 'type', cell: (row) => <span className="capitalize">{row.type}</span> },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />
    },
    { header: 'Specs', accessorKey: 'specifications' },
    { 
      header: 'Actions',
      cell: (row) => (
        <button
          onClick={() => toggleMaintenance.mutate({ 
            id: row.id, 
            status: row.status === 'maintenance' ? 'available' : 'maintenance' 
          })}
          className={`font-medium ${row.status === 'maintenance' ? 'text-green-600' : 'text-yellow-600'}`}
        >
          {row.status === 'maintenance' ? 'Mark Available' : 'Maintenance'}
        </button>
      )
    }
  ];

  return (
    <div>
      <PageHeader 
        title="Terminals" 
        action={
          <div className="flex space-x-4">
            <div className="flex items-center bg-white border border-gray-300 rounded-md p-1">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <LayoutGrid className="w-4 h-4 text-gray-600" />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <List className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            {/* Note: Admin functionality to actually add terminal is omitted for brevity, keeping simple listing */}
          </div>
        }
      />

      <div className="mb-6 flex space-x-2">
        {['All', 'Browsing', 'Gaming', 'Academic'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 text-sm font-medium rounded-full ${
              filterType === type 
                ? 'bg-primary text-white' 
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredTerminals.map(terminal => (
            <TerminalCard 
              key={terminal.id} 
              terminal={terminal} 
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
        <DataTable 
          columns={columns} 
          data={filteredTerminals} 
          loading={isLoading} 
        />
      )}
    </div>
  );
};

export default Terminals;
