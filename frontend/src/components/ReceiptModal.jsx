import React from 'react';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';

const ReceiptModal = ({ isOpen, onClose, receiptData }) => {
  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-50 backdrop-blur-sm print:bg-white print:backdrop-blur-none">
      <div className="relative w-full max-w-md p-6 mx-auto bg-white rounded-lg shadow-xl print:shadow-none print:w-full print:max-w-none">
        
        {/* Modal Actions - Hidden when printing */}
        <div className="flex justify-end mb-4 space-x-2 print:hidden">
          <button 
            onClick={handlePrint}
            className="flex items-center px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </button>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-500 rounded-md hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Area */}
        <div className="font-mono text-sm text-gray-800" id="receipt-content">
          <div className="text-center mb-6 border-b-2 border-dashed border-gray-300 pb-4">
            <h2 className="text-xl font-bold uppercase tracking-wider">{receiptData.cafeName || 'Cyber Cafe Pro'}</h2>
            <p className="text-xs text-gray-600 mt-1">{receiptData.address || '123 Tech Street, Digital City'}</p>
            <p className="text-xs text-gray-600">Phone: {receiptData.phone || '555-0199'}</p>
          </div>

          <div className="mb-4">
            <div className="flex justify-between">
              <span>Receipt #:</span>
              <span>{receiptData.receiptNumber || `RCPT-${Math.floor(Math.random() * 10000)}`}</span>
            </div>
            <div className="flex justify-between">
              <span>Date:</span>
              <span>{format(new Date(), 'dd MMM yyyy, HH:mm')}</span>
            </div>
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{receiptData.customerName || 'Walk-in'}</span>
            </div>
            {receiptData.terminal && (
              <div className="flex justify-between">
                <span>Terminal:</span>
                <span>{receiptData.terminal}</span>
              </div>
            )}
          </div>

          <div className="border-t-2 border-dashed border-gray-300 pt-4 mb-4">
            <div className="flex justify-between font-bold mb-2">
              <span>Item</span>
              <span>Amount</span>
            </div>
            
            {receiptData.items?.map((item, idx) => (
              <div key={idx} className="flex justify-between mb-1">
                <span className="w-2/3 truncate">{item.description}</span>
                <span>${item.amount?.toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-4 mb-6">
            <div className="flex justify-between font-bold text-lg">
              <span>TOTAL:</span>
              <span>${receiptData.total?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span>Payment Method:</span>
              <span className="capitalize">{receiptData.paymentMethod || 'Cash'}</span>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 mt-8">
            <p>Thank you for your business!</p>
            <p>Please come again.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
