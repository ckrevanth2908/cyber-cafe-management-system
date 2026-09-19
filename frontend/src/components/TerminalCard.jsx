import React from 'react';
import { Monitor, User, Clock } from 'lucide-react';
import StatusBadge from './StatusBadge';
import SessionTimer from './SessionTimer';

const TerminalCard = ({ terminal, session, onClick }) => {
  const isOccupied = terminal.status.toLowerCase() === 'occupied';

  return (
    <div 
      onClick={onClick}
      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
        isOccupied 
          ? 'border-red-200 bg-red-50 hover:border-red-300' 
          : terminal.status.toLowerCase() === 'maintenance'
            ? 'border-yellow-200 bg-yellow-50 hover:border-yellow-300'
            : 'border-green-200 bg-white hover:border-green-300 hover:shadow-md'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center space-x-2">
          <Monitor className={`w-5 h-5 ${isOccupied ? 'text-red-500' : 'text-green-500'}`} />
          <h3 className="font-bold text-lg text-gray-800">{terminal.number}</h3>
        </div>
        <StatusBadge status={terminal.status} />
      </div>

      <div className="text-sm text-gray-600 mb-4">
        <p className="capitalize">Type: <span className="font-medium text-gray-900">{terminal.type}</span></p>
      </div>

      {isOccupied && session && (
        <div className="mt-4 pt-4 border-t border-red-100 space-y-2">
          <div className="flex items-center text-sm text-gray-700">
            <User className="w-4 h-4 mr-2 text-gray-500" />
            <span className="truncate">{session.customerName}</span>
          </div>
          <div className="flex items-center text-sm text-gray-700">
            <Clock className="w-4 h-4 mr-2 text-gray-500" />
            <SessionTimer endTime={session.expectedEnd} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalCard;
