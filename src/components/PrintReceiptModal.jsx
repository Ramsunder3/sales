import React from 'react';
import { X, Printer, Download, MessageSquare, Share2 } from 'lucide-react';
import { generateBillPDF, shareBillPDFToCustomer } from '../utils/pdfGenerator';
import { sendWhatsAppBill } from '../utils/whatsapp';

export default function PrintReceiptModal({ bill, stallInfo, onClose }) {
  if (!bill) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    generateBillPDF(bill, stallInfo);
  };

  const handleWhatsApp = () => {
    sendWhatsAppBill(bill, stallInfo);
  };

  const handleSharePDF = () => {
    shareBillPDFToCustomer(bill, stallInfo);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-teal-400" />
            Receipt Preview #{bill.billNo}
          </h3>
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Container */}
        <div className="p-6 overflow-y-auto flex-1 flex justify-center bg-slate-950">
          <div 
            id="printable-receipt" 
            className="bg-white text-black p-5 rounded-md shadow-lg w-[280px] font-mono text-xs leading-tight border border-slate-200"
          >
            <div className="text-center font-bold text-xs tracking-wide uppercase">
              KRL CONSLOIDATES - MADIPAKKAM
            </div>
            <div className="text-center font-semibold text-[11px] text-slate-700">
              (Tamil Nadu Nair Service Society)
            </div>
            <div className="text-center text-[10px] text-slate-600 mb-2">
              FOOD STALL SALES RECEIPT
            </div>
            <div className="border-b border-dashed border-slate-400 my-2" />

            <div className="flex justify-between">
              <span>Bill No: <strong>{bill.billNo}</strong></span>
              <span>{new Date(bill.dateTime).toLocaleDateString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600 mb-1">
              <span>Time: {new Date(bill.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>Mode: <strong>{bill.paymentMode}</strong></span>
            </div>

            {bill.customerName && (
              <div className="text-[11px] text-slate-700 mb-1">
                Cust: {bill.customerName} {bill.customerPhone ? `(${bill.customerPhone})` : ''}
              </div>
            )}

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Table Header */}
            <div className="grid grid-cols-12 font-bold mb-1 border-b border-slate-300 pb-1">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Rate</div>
              <div className="col-span-2 text-right">Amt</div>
            </div>

            {/* Item Rows */}
            {bill.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 py-0.5 border-b border-slate-100">
                <div className="col-span-6 pr-1 font-semibold">
                  {item.name} <span className="text-[9px] text-slate-600 font-normal">({item.weight})</span>
                </div>
                <div className="col-span-2 text-center">{item.qty}</div>
                <div className="col-span-2 text-right">₹{item.rate}</div>
                <div className="col-span-2 text-right font-semibold">₹{item.amount}</div>
              </div>
            ))}

            <div className="border-b border-dashed border-slate-400 my-2" />

            {/* Calculations */}
            {((bill.subtotal || bill.grandTotal + (bill.discount || 0)) !== bill.grandTotal) && (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>₹{bill.subtotal || bill.items.reduce((s, i) => s + (i.rate * i.qty), 0)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Discount:</span>
                  <span>-₹{bill.discount !== undefined ? bill.discount : ((bill.subtotal || 0) - bill.grandTotal)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between font-bold text-sm text-emerald-950 mt-1">
              <span>GRAND TOTAL:</span>
              <span>₹{bill.grandTotal}</span>
            </div>

            <div className="border-b border-dashed border-slate-400 my-3" />

            <div className="text-center text-[10px] text-slate-500 italic">
              Thank you! Visit again.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-800/80 border-t border-slate-700 space-y-2">
          <button
            onClick={handleSharePDF}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition border border-emerald-400/30 text-xs"
          >
            <Share2 className="w-4 h-4 text-emerald-200" />
            Share Receipt to Customer
          </button>
          
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={handleWhatsApp}
              className="py-2.5 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-[11px] rounded-xl flex items-center justify-center gap-1 border border-slate-700 transition"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp
            </button>
            <button
              onClick={handlePrint}
              className="py-2.5 px-2 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-[11px] rounded-xl flex items-center justify-center gap-1 shadow transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button
              onClick={handleDownloadPDF}
              className="py-2.5 px-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-[11px] rounded-xl flex items-center justify-center gap-1 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
