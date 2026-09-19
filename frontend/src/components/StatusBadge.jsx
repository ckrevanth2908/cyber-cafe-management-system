import React from 'react';

const StatusBadge = ({ status, onClick, title }) => {
  const s = (status || 'unknown').toLowerCase();
  let colorClass = 'bg-gray-100 text-gray-800 border-gray-200';
  let dotColor = 'bg-gray-400';

  if (s === 'available') {
    colorClass = 'bg-green-100 text-green-900 border-green-300 font-bold';
    dotColor = 'bg-green-500';
  } else if (s === 'occupied') {
    colorClass = 'bg-red-100 text-red-900 border-red-400 font-bold';
    dotColor = 'bg-red-600 animate-pulse';
  } else if (s === 'active') {
    colorClass = 'bg-red-100 text-red-800 border-red-300 font-bold';
    dotColor = 'bg-red-500 animate-pulse';
  } else if (s === 'completed') {
    colorClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold';
    dotColor = 'bg-emerald-500';
  } else if (s === 'maintenance') {
    colorClass = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
    dotColor = 'bg-amber-500';
  }

  return (
    <span 
      onClick={onClick}
      title={title}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${colorClass} capitalize ${onClick ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-transform' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${dotColor}`} />
      {status || 'Unknown'}
    </span>
  );
};

export default StatusBadge;
