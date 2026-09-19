import React from 'react';

const LoadingSpinner = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className="flex justify-center items-center">
      <div 
        className={`${sizeClasses[size]} border-gray-200 border-t-primary rounded-full animate-spin`}
      />
    </div>
  );
};

export default LoadingSpinner;
