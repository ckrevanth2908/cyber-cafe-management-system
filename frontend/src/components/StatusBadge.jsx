import React from 'react';

const StatusBadge = ({ status }) => {
  let colorClass = '';
  switch (status?.toLowerCase()) {
    case 'available':
    case 'active':
      colorClass = 'bg-green-100 text-green-800 border-green-200';
      break;
    case 'occupied':
    case 'completed':
      colorClass = 'bg-red-100 text-red-800 border-red-200';
      break;
    case 'maintenance':
    case 'cancelled':
      colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
      break;
    default:
      colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {status || 'Unknown'}
    </span>
  );
};

export default StatusBadge;
