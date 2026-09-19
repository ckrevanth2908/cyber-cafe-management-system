import React from 'react';

const StatsCard = ({ title, value, icon: Icon, trend }) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 flex items-center">
      <div className="p-4 bg-primary/10 rounded-full mr-4 text-primary">
        <Icon className="w-8 h-8" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{title}</p>
        <div className="flex items-baseline mt-1">
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {trend && (
            <span className={`ml-2 text-sm font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
