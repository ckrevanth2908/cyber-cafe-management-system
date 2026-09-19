import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, User, Clock, LogOut, CheckCircle } from 'lucide-react';
import { terminalsApi } from '../api';
import StatusBadge from './StatusBadge';
import SessionTimer from './SessionTimer';

const TerminalCard = ({ terminal, session, onClick, onFree }) => {
  const queryClient = useQueryClient();
  if (!terminal) return null;

  const statusStr = (terminal.status || 'available').toLowerCase();
  const isOccupied = statusStr === 'occupied';
  const isMaintenance = statusStr === 'maintenance';

  const terminalNumber = terminal.terminal_number || terminal.number || 'PC';
  const terminalType = terminal.type_name || terminal.type || 'Standard';
  const customerName = session?.customer_name || session?.customerName || terminal.current_session?.customer_name || 'Occupied';
  const endTime = session?.expected_end_time || session?.expectedEnd || terminal.current_session?.expected_end_time;

  const freeSeatMutation = useMutation({
    mutationFn: () => terminalsApi.freeTerminal(terminal.id),
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['terminals'] });
      // Optimistically update terminals cache to immediately turn green
      queryClient.setQueryData(['terminals'], (old) => {
        if (!old) return old;
        return old.map(t => t.id === terminal.id ? { ...t, status: 'available', current_session: null } : t);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['terminals'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['adminStats'] });
      queryClient.invalidateQueries({ queryKey: ['dailyRevenue'] });
      queryClient.invalidateQueries({ queryKey: ['sessionHistorySummary'] });
      if (onFree) onFree();
    }
  });

  const handleFreeSeat = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    freeSeatMutation.mutate();
  };

  const handleCardClick = (e) => {
    if (isOccupied) {
      handleFreeSeat(e);
    } else if (onClick) {
      onClick(e);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      title={isOccupied ? "Click to turn status to Available" : undefined}
      className={`relative p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer select-none active:scale-[0.99] ${
        isOccupied 
          ? 'border-red-500 bg-red-50/90 shadow-md ring-2 ring-red-400/40 hover:bg-red-100/90' 
          : isMaintenance
            ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
            : 'border-green-400 bg-green-50/60 hover:border-green-600 hover:bg-green-100/60 hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <Monitor className={`w-5 h-5 ${isOccupied ? 'text-red-600' : isMaintenance ? 'text-amber-600' : 'text-green-600'}`} />
          <h3 className={`font-black text-lg ${isOccupied ? 'text-red-900' : isMaintenance ? 'text-amber-900' : 'text-green-900'}`}>
            {terminalNumber}
          </h3>
        </div>
        <StatusBadge 
          status={terminal.status} 
          onClick={(e) => {
            e.stopPropagation();
            if (isOccupied) {
              freeSeatMutation.mutate();
            } else if (onClick) {
              onClick(e);
            }
          }}
          title={isOccupied ? "Click to turn to Available" : "Status"}
        />
      </div>

      <div className="text-xs text-gray-600 mb-2">
        <p className="capitalize">Type: <span className="font-bold text-gray-800">{terminalType}</span></p>
      </div>

      {isOccupied && (
        <div className="mt-3 pt-3 border-t border-red-200 bg-red-100/70 -mx-4 -mb-4 p-3 rounded-b-lg space-y-2">
          <div className="flex items-center text-xs font-bold text-red-900 truncate">
            <User className="w-3.5 h-3.5 mr-1.5 text-red-600 flex-shrink-0" />
            <span className="truncate">{customerName}</span>
          </div>
          {endTime && (
            <div className="flex items-center text-xs text-red-800 font-semibold">
              <Clock className="w-3.5 h-3.5 mr-1.5 text-red-600 flex-shrink-0" />
              <SessionTimer endTime={endTime} />
            </div>
          )}
          <button
            type="button"
            onClick={handleFreeSeat}
            disabled={freeSeatMutation.isPending}
            className="w-full mt-2 flex items-center justify-center py-1.5 px-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-black shadow transition-colors active:scale-95 disabled:opacity-50"
            title="Click when customer leaves to free this seat immediately"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            {freeSeatMutation.isPending ? 'Freeing...' : 'Customer Left (Free Seat)'}
          </button>
        </div>
      )}
    </div>
  );
};

export default TerminalCard;
