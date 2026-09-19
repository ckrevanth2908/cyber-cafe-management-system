import React from 'react';
import { X, Printer } from 'lucide-react';
import { format } from 'date-fns';

const ReceiptModal = ({ isOpen, onClose, receiptData }) => {
  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    window.print();
  };

  const receiptNumber = receiptData.receipt_number || receiptData.receiptNumber || `RCP-${Date.now().toString().slice(-6)}`;
  const customerName = receiptData.customer_name || receiptData.customerName || 'Customer';
  const totalAmount = receiptData.total_amount ?? receiptData.total ?? receiptData.amount ?? 0;
  const paymentMethod = receiptData.payment_method || receiptData.paymentMethod || 'Cash';
  const items = receiptData.items || [
    { description: 'Cyber Cafe Terminal Usage', amount: totalAmount }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-black bg-opacity-60 backdrop-blur-sm print:bg-white print:backdrop-blur-none p-4">
      <div className="relative w-full max-w-md p-6 mx-auto bg-white rounded-xl shadow-2xl print:shadow-none print:w-full print:max-w-none border border-gray-100">
        
        {/* Modal Actions - Hidden when printing */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 print:hidden">
          <span className="font-semibold text-gray-800 text-sm">Official Customer Receipt</span>
          <div className="flex items-center space-x-2">
            <button 
              onClick={handlePrint}
              className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary-dark shadow-sm"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print Receipt
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-gray-400 rounded-lg hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="font-mono text-sm text-gray-800 bg-gray-50 p-5 rounded-lg border border-dashed border-gray-300" id="receipt-content">
          <div className="text-center mb-4 border-b border-dashed border-gray-300 pb-3">
            <h2 className="text-lg font-bold uppercase tracking-wider text-gray-900">CyberNet Cafe</h2>
            <p className="text-xs text-gray-500 mt-0.5">High Speed Internet • Gaming • Xerox</p>
            <p className="text-xs text-gray-500">123 Main Street • Tel: 555-0100</p>
          </div>

          <div className="space-y-1 text-xs mb-4">
            <div className="flex justify-between">
              <span className="text-gray-500">Receipt #:</span>
              <span className="font-bold text-gray-900">{receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date & Time:</span>
              <span>{format(new Date(), 'dd MMM yyyy, hh:mm a')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Customer:</span>
              <span className="font-semibold text-gray-900">{customerName}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-3 mb-3">
            <div className="flex justify-between font-bold text-xs uppercase text-gray-500 mb-2">
              <span>Item / Service</span>
              <span>Amount (₹)</span>
            </div>
            
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs py-1">
                <span className="w-2/3 truncate text-gray-800">{item.description}</span>
                <span className="font-medium text-gray-900">₹{Number(item.amount || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-b-2 border-dashed border-gray-400 py-3 mb-4 bg-white px-2 rounded">
            <div className="flex justify-between items-center font-bold text-base text-gray-900">
              <span>TOTAL PAID:</span>
              <span className="text-lg text-primary font-black">₹{Number(totalAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>Payment Mode:</span>
              <span className="capitalize font-medium">{paymentMethod.toUpperCase()}</span>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 space-y-0.5">
            <p className="font-semibold text-gray-700">Thank you for visiting CyberNet!</p>
            <p className="text-[11px]">System generated tax invoice</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
