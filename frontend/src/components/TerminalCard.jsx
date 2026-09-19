import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Monitor, User, Clock, LogOut, CheckCircle } from 'lucide-react';
import { terminalsApi } from '../api';
import StatusBadge from './StatusBadge';
import SessionTimer from './SessionTimer';

const TerminalCard = ({ terminal, session, onClick, onFree }) => {
  const queryClient = useQueryClient();
  if (!terminal) return null;

  const currentSession = session || terminal.current_session;
  const statusStr = (terminal.status || 'available').toLowerCase();
  const isOccupied = statusStr === 'occupied';
  const isMaintenance = statusStr === 'maintenance';

  const terminalNumber = terminal.terminal_number || terminal.number || 'PC';
  const terminalType = terminal.type_name || terminal.type || 'Standard';
  const customerName = currentSession?.customer_name || currentSession?.customerName || 'Occupied';
  const customerPhone = currentSession?.customer_phone || currentSession?.phone || '';
  const endTime = currentSession?.expected_end_time || currentSession?.expectedEnd;

  const freeSeatMutation = useMutation({
    mutationFn: () => terminalsApi.freeTerminal(terminal.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['terminals'] });
      // Optimistically update terminals cache immediately to green
      queryClient.setQueryData(['terminals'], (old = []) =>
        old.map(t => t.id === terminal.id ? { ...t, status: 'available', current_session: null } : t)
      );
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
    if (window.confirm(`Free Terminal ${terminalNumber}? Customer will be checked out and seat will become available.`)) {
      freeSeatMutation.mutate();
    }
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
      className={`relative p-4 rounded-xl border-2 transition-all duration-200 select-none ${
        isOccupied 
          ? 'border-red-500 bg-red-50/90 shadow-md ring-2 ring-red-400/40' 
          : isMaintenance
            ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
            : 'border-green-400 bg-green-50/70 hover:border-green-600 hover:bg-green-100/60 shadow-sm'
      }`}
    >
      {/* Top Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <Monitor className={`w-5 h-5 ${isOccupied ? 'text-red-600' : isMaintenance ? 'text-amber-600' : 'text-green-600'}`} />
          <h3 className={`font-black text-lg ${isOccupied ? 'text-red-900' : isMaintenance ? 'text-amber-900' : 'text-green-900'}`}>
            {terminalNumber}
          </h3>
        </div>
        <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider ${
          isOccupied 
            ? 'bg-red-600 text-white shadow-sm animate-pulse' 
            : isMaintenance
              ? 'bg-amber-200 text-amber-900'
              : 'bg-green-600 text-white shadow-sm'
        }`}>
          {isOccupied ? '🔴 FILLED' : isMaintenance ? '🟡 MAINT' : '🟢 VACANT'}
        </span>
      </div>

      <div className="text-xs text-gray-600 mb-2">
        <p className="capitalize font-medium">Type: <span className="font-bold text-gray-800">{terminalType}</span></p>
      </div>

      {/* When Vacant / Available */}
      {!isOccupied && !isMaintenance && (
        <div className="mt-3 pt-2.5 border-t border-green-200/60 flex items-center justify-between text-xs text-green-800 font-semibold">
          <span>Ready for Customer</span>
          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
        </div>
      )}

      {/* When Filled / Occupied */}
      {isOccupied && (
        <div className="mt-3 pt-3 border-t border-red-200 bg-red-100/80 -mx-4 -mb-4 p-3 rounded-b-lg space-y-2">
          <div>
            <div className="flex items-center text-xs font-bold text-red-900 truncate">
              <User className="w-3.5 h-3.5 mr-1.5 text-red-600 flex-shrink-0" />
              <span className="truncate">{customerName}</span>
            </div>
            {customerPhone && (
              <p className="text-[11px] text-red-700 ml-5 truncate">{customerPhone}</p>
            )}
          </div>

          {endTime && (
            <div className="flex items-center justify-between text-xs text-red-800 font-semibold bg-white/70 px-2 py-1 rounded border border-red-200">
              <div className="flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-red-600" />
                <span>Time Left:</span>
              </div>
              <SessionTimer endTime={endTime} />
            </div>
          )}

          <button
            type="button"
            onClick={handleFreeSeat}
            disabled={freeSeatMutation.isPending}
            className="w-full mt-2 flex items-center justify-center py-2 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-black shadow-sm transition-all active:scale-95 disabled:opacity-50 space-x-1.5"
            title="Click when customer exits to make this seat available"
          >
            <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{freeSeatMutation.isPending ? 'Freeing Seat...' : 'Customer Exit (Make Available)'}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TerminalCard;
