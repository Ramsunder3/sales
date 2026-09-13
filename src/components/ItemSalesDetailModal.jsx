import React, { useState } from 'react';
import { 
  X, ShoppingBag, Receipt, Clock, Banknote, 
  QrCode, CreditCard, Printer, ExternalLink 
} from 'lucide-react';
import { formatTimeAgo } from '../utils/itemSalesAnalyzer';
import PrintReceiptModal from './PrintReceiptModal';

export default function ItemSalesDetailModal({ item, stallInfo, onClose, allBills = [], onNavigateToHistory }) {
  const [selectedBillForPrint, setSelectedBillForPrint] = useState(null);

  if (!item) return null;

  const handlePrintBill = (historyEntry) => {
    // Find the full bill object from allBills if available
    const fullBill = allBills.find(b => b.billNo === historyEntry.billNo) || {
      billNo: historyEntry.billNo,
      dateTime: historyEntry.dateTime,
      customerName: historyEntry.customerName,
      customerPhone: historyEntry.customerPhone,
      paymentMode: historyEntry.paymentMode,
      grandTotal: historyEntry.billGrandTotal || historyEntry.amount,
      items: [{
        name: item.name,
        brand: item.brand,
        weight: item.weight,
        qty: historyEntry.qty,
        rate: historyEntry.rate,
        amount: historyEntry.amount
      }]
    };
    setSelectedBillForPrint(fullBill);
  };

  const cashSplit = item.paymentSplit?.Cash || { qty: 0, amount: 0 };
  const upiSplit = item.paymentSplit?.UPI || { qty: 0, amount: 0 };
  const cardSplit = item.paymentSplit?.Card || { qty: 0, amount: 0 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/80 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-lg shrink-0">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-teal-950 text-teal-300 font-bold border border-teal-800/80">
                  {item.brand}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                  {item.weight}
                </span>
                {item.salesStatus === 'fast_selling' && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 font-bold border border-amber-800 animate-pulse">
                    🔥 Fast Selling
                  </span>
                )}
                {item.currentStock <= 0 ? (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-rose-950 text-rose-300 font-bold border border-rose-800">
                    Out of Stock
                  </span>
                ) : item.currentStock <= 5 ? (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 font-bold border border-amber-800">
                    Low Stock ({item.currentStock} left)
                  </span>
                ) : null}
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1">
                {item.name}
              </h2>
              <p className="text-xs text-slate-400">
                Item Analysis & Historical Bill Line Items
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">Total Units Sold</div>
              <div className="text-2xl font-extrabold text-white mt-1 font-heading">{item.totalSoldQty}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {item.billsSoldQty} in bills {item.alreadySoldYesterday ? `+ ${item.alreadySoldYesterday} prev` : ''}
              </div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Total Revenue</div>
              <div className="text-2xl font-extrabold text-emerald-300 mt-1 font-heading">₹{item.totalRevenue.toLocaleString('en-IN')}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">MRP: ₹{item.mrp} each</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Bill Appearances</div>
              <div className="text-2xl font-extrabold text-white mt-1 font-heading">{item.billCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Avg {item.avgQtyPerOrder} units / bill</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5">
              <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Available Stock</div>
              <div className={`text-2xl font-extrabold mt-1 font-heading ${
                item.currentStock <= 0 ? 'text-rose-400' : item.currentStock <= 5 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {item.currentStock}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Opening: {item.openingQty} ({item.depletionPercent}% sold)
              </div>
            </div>
          </div>

          {/* Payment Split & Last Sold Timing */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Cash */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Cash Sales</div>
                  <div className="text-sm font-bold text-white">₹{cashSplit.amount.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                {cashSplit.qty} units
              </span>
            </div>

            {/* UPI */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-teal-950 text-teal-400 border border-teal-800">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">UPI / QR Sales</div>
                  <div className="text-sm font-bold text-white">₹{upiSplit.amount.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-800/40">
                {upiSplit.qty} units
              </span>
            </div>

            {/* Card */}
            <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-950 text-amber-400 border border-amber-800">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-slate-400">Card Sales</div>
                  <div className="text-sm font-bold text-white">₹{cardSplit.amount.toLocaleString('en-IN')}</div>
                </div>
              </div>
              <span className="text-xs font-semibold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                {cardSplit.qty} units
              </span>
            </div>
          </div>

          {/* Previous Bills Transaction Breakdown Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-400" />
                Bills Containing This Item ({item.billsHistory.length} Transactions)
              </h3>
              {item.lastSoldDateTime && (
                <div className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>Last sold: <strong className="text-white">{formatTimeAgo(item.lastSoldDateTime)}</strong></span>
                </div>
              )}
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900/90 text-slate-300 font-bold uppercase border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3.5">Bill No</th>
                      <th className="py-2.5 px-3.5">Date & Time</th>
                      <th className="py-2.5 px-3.5">Customer</th>
                      <th className="py-2.5 px-3.5 text-center">Payment</th>
                      <th className="py-2.5 px-3.5 text-center">Qty</th>
                      <th className="py-2.5 px-3.5 text-right">Rate (₹)</th>
                      <th className="py-2.5 px-3.5 text-right">Total (₹)</th>
                      <th className="py-2.5 px-3.5 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {item.billsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          <Receipt className="w-8 h-8 mx-auto mb-1.5 opacity-30 text-slate-400" />
                          <p className="font-semibold text-slate-400">No bill records found for this item yet</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">When customers purchase this item at the counter, transactions appear here live.</p>
                        </td>
                      </tr>
                    ) : (
                      item.billsHistory.map((entry, idx) => (
                        <tr key={`${entry.billNo}-${idx}`} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3.5 font-mono font-bold text-teal-300">
                            {entry.billNo}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-300">
                            <div>{new Date(entry.dateTime).toLocaleDateString('en-IN')}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {new Date(entry.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ({formatTimeAgo(entry.dateTime)})
                            </div>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <div className="font-medium text-white">{entry.customerName}</div>
                            {entry.customerPhone && (
                              <div className="text-[10px] text-slate-400 font-mono">{entry.customerPhone}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.paymentMode === 'UPI' ? 'bg-teal-950 text-teal-400 border border-teal-800' :
                              entry.paymentMode === 'Card' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                              'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            }`}>
                              {entry.paymentMode}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-extrabold text-white">
                            {entry.qty}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-medium text-slate-300">
                            ₹{entry.rate}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-extrabold text-emerald-400">
                            ₹{entry.amount}
                          </td>
                          <td className="py-2.5 px-3.5 text-center">
                            <button
                              onClick={() => handlePrintBill(entry)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition"
                              title="Print Receipt"
                            >
                              <Printer className="w-3.5 h-3.5 text-teal-400" />
                              <span>Receipt</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
          <div>
            Item ID: <span className="font-mono text-slate-300">{item.id}</span>
          </div>
          <div className="flex items-center gap-2">
            {onNavigateToHistory && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToHistory(item.name);
                }}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl flex items-center gap-1.5 shadow transition text-xs"
              >
                <span>Find in Bill History</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-700 transition"
            >
              Close Inspector
            </button>
          </div>
        </div>

      </div>

      {/* Embedded Print / View Receipt Modal */}
      {selectedBillForPrint && (
        <PrintReceiptModal
          bill={selectedBillForPrint}
          stallInfo={stallInfo}
          onClose={() => setSelectedBillForPrint(null)}
        />
      )}
    </div>
  );
}
