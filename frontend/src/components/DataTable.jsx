import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const DataTable = ({ columns, data, loading, onRowClick }) => {
  if (loading) {
    return <div className="py-8 flex justify-center"><LoadingSpinner /></div>;
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500 bg-white border border-gray-200 rounded-lg">
        No data available.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr 
              key={rowIndex} 
              onClick={() => onRowClick && onRowClick(row)}
              className={onRowClick ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""}
            >
              {columns.map((col, colIndex) => (
                <td key={colIndex} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  {col.cell ? col.cell(row) : row[col.accessorKey]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
