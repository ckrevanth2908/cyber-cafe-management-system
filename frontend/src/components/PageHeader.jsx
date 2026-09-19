import React from 'react';

const PageHeader = ({ title, action }) => {
  return (
    <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
      <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
      {action && <div>{action}</div>}
    </div>
  );
};

export default PageHeader;
