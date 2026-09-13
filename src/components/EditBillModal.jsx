import React, { useState, useMemo } from 'react';
import { 
  X, Save, Plus, Minus, Trash2, Edit3, AlertCircle, 
  Search, CreditCard, Banknote, QrCode, PackageCheck
} from 'lucide-react';
import { CATEGORIES } from '../data/seedData';

export default function EditBillModal({ 
  bill, 
  products = [], 
  onSave, 
  onClose 
}) {
  // Editable customer info (Hooks always called unconditionally at top)
  const [customerName, setCustomerName] = useState(() => bill?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(() => bill?.customerPhone || '');
  const [paymentMode, setPaymentMode] = useState(() => bill?.paymentMode || 'Cash');
  const [editReason, setEditReason] = useState(() => bill?.editReason || '');

  // Editable items
  const [items, setItems] = useState(() => {
    if (!bill?.items) return [];
    return bill.items.map(item => ({
      ...item,
      qty: parseInt(item.qty, 10) || 1,
      rate: parseFloat(item.rate) || 0,
      amount: (parseInt(item.qty, 10) || 1) * (parseFloat(item.rate) || 0)
    }));
  });

  // Financial adjustments
  const [discount, setDiscount] = useState(() => {
    return bill?.discount || 0;
  });
  const [customGrandTotal, setCustomGrandTotal] = useState('');
  const [stockWarning, setStockWarning] = useState(null);

  // Search for adding more items to this bill
  const [productSearch, setProductSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [showAddSection, setShowAddSection] = useState(false);

  // Helper to get max allowable stock for this product in this bill
  // (Available stock in store + quantity already recorded in original bill)
  const getMaxStockForProduct = (productId, productName, productWeight) => {
    const product = products.find(p => 
      p.id === productId || 
      String(p.srNo) === String(productId) ||
      (p.name && productName && p.name.trim().toUpperCase() === productName.trim().toUpperCase() &&
       p.weight && productWeight && p.weight.trim().toUpperCase() === productWeight.trim().toUpperCase())
    );
    if (!product) return 999;

    const originalBillItem = (bill?.items || []).find(i => 
      i.productId === product.id || 
      String(i.productId) === String(product.srNo) ||
      (i.name && product.name && i.name.trim().toUpperCase() === product.name.trim().toUpperCase() &&
       i.weight && product.weight && i.weight.trim().toUpperCase() === product.weight.trim().toUpperCase())
    );

    const origQty = originalBillItem ? parseInt(originalBillItem.qty, 10) || 0 : 0;
    const currentStock = parseInt(product.currentStock, 10) || 0;

    return currentStock + origQty;
  };

  // Subtotal calculation
  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.rate * item.qty), 0);
  }, [items]);

  // Payment mode & Grand Total calculation
  const { grandTotal, totalDiscount, roundOffAmount, isCustomOverride } = useMemo(() => {
    if (customGrandTotal !== '' && !isNaN(parseFloat(customGrandTotal))) {
      const overrideVal = Math.max(0, parseFloat(customGrandTotal));
      return {
        grandTotal: overrideVal,
        totalDiscount: Math.max(0, subtotal - overrideVal),
        roundOffAmount: 0,
        isCustomOverride: true
      };
    }

    const manualDisc = parseFloat(discount) || 0;
    const afterManual = Math.max(0, subtotal - manualDisc);

    if (paymentMode === 'Cash') {
      const rounded = Math.floor(afterManual / 10) * 10;
      return {
        grandTotal: rounded,
        totalDiscount: subtotal - rounded,
        roundOffAmount: afterManual - rounded,
        isCustomOverride: false
      };
    } else {
      return {
        grandTotal: afterManual,
        totalDiscount: manualDisc,
        roundOffAmount: 0,
        isCustomOverride: false
      };
    }
  }, [subtotal, discount, customGrandTotal, paymentMode]);

  // Real-time Inventory Impact Calculation (Comparing original bill vs edited items)
  const stockChanges = useMemo(() => {
    if (!bill?.items) return [];
    const changes = [];

    // Collect all involved product IDs/names across original bill and edited items
    const allProductIds = new Set();
    bill.items.forEach(i => allProductIds.add(i.productId || i.name));
    items.forEach(i => allProductIds.add(i.productId || i.name));

    allProductIds.forEach(idKey => {
      const origItems = bill.items.filter(i => (i.productId || i.name) === idKey);
      const origQty = origItems.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 0), 0);

      const editedMatching = items.filter(i => (i.productId || i.name) === idKey);
      const editedQty = editedMatching.reduce((sum, i) => sum + (parseInt(i.qty, 10) || 0), 0);

      const delta = origQty - editedQty; // + means returning to stock, - means deducting from stock

      const refItem = editedMatching[0] || origItems[0];
      if (refItem) {
        changes.push({
          productId: refItem.productId,
          name: refItem.name,
          weight: refItem.weight,
          origQty,
          editedQty,
          delta
        });
      }
    });

    return changes;
  }, [bill, items]);

  // Filtered products list for the "Add Product" drawer
  const catalogFiltered = useMemo(() => {
    return products.filter(p => {
      const matchesCategory = selectedBrand === 'All' || p.brand === selectedBrand;
      const q = productSearch.toLowerCase().trim();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.brand.toLowerCase().includes(q) || 
        p.weight.toLowerCase().includes(q) ||
        p.srNo.toString() === q;
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedBrand, productSearch]);

  if (!bill) return null;

  // Handle updating item quantity
  const handleUpdateQty = (index, delta) => {
    setItems(prevItems => {
      const newItems = [...prevItems];
      const target = newItems[index];
      if (!target) return prevItems;

      const newQty = target.qty + delta;
      if (newQty <= 0) {
        // If reduced to 0, remove item
        return newItems.filter((_, i) => i !== index);
      }

      const maxStock = getMaxStockForProduct(target.productId, target.name, target.weight);
      if (newQty > maxStock) {
        setStockWarning(`Cannot increase beyond available stock headroom (${maxStock} units max).`);
        return prevItems;
      }

      newItems[index] = {
        ...target,
        qty: newQty,
        amount: newQty * target.rate
      };
      return newItems;
    });
  };

  const handleSetExactQty = (index, val) => {
    const qty = parseInt(val, 10);
    if (isNaN(qty) || qty <= 0) {
      setItems(prev => prev.filter((_, i) => i !== index));
      return;
    }

    setItems(prevItems => {
      const newItems = [...prevItems];
      const target = newItems[index];
      if (!target) return prevItems;

      const maxStock = getMaxStockForProduct(target.productId, target.name, target.weight);
      const safeQty = Math.min(qty, maxStock);

      if (qty > maxStock) {
        setStockWarning(`Adjusted to maximum available stock (${maxStock} units).`);
      }

      newItems[index] = {
        ...target,
        qty: safeQty,
        amount: safeQty * target.rate
      };
      return newItems;
    });
  };

  // Handle updating rate per unit
  const handleUpdateRate = (index, val) => {
    const rate = parseFloat(val);
    setItems(prevItems => {
      const newItems = [...prevItems];
      const target = newItems[index];
      if (!target) return prevItems;

      const safeRate = isNaN(rate) || rate < 0 ? 0 : rate;
      newItems[index] = {
        ...target,
        rate: safeRate,
        amount: target.qty * safeRate
      };
      return newItems;
    });
  };

  // Handle removing item
  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      setStockWarning('A bill must contain at least 1 item. If you wish to cancel this bill entirely, use the "Void Bill" option.');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  // Handle adding product from catalog into this bill
  const handleAddProduct = (product) => {
    const maxStock = getMaxStockForProduct(product.id, product.name, product.weight);
    if (maxStock <= 0) {
      setStockWarning(`"${product.name}" is out of stock.`);
      return;
    }

    setItems(prevItems => {
      const existingIdx = prevItems.findIndex(i => 
        i.productId === product.id || 
        (i.name && product.name && i.name.trim().toUpperCase() === product.name.trim().toUpperCase() &&
         i.weight && product.weight && i.weight.trim().toUpperCase() === product.weight.trim().toUpperCase())
      );

      if (existingIdx >= 0) {
        const existing = prevItems[existingIdx];
        if (existing.qty + 1 > maxStock) {
          setStockWarning(`Cannot add more than available stock (${maxStock} units available).`);
          return prevItems;
        }
        const updated = [...prevItems];
        updated[existingIdx] = {
          ...existing,
          qty: existing.qty + 1,
          amount: (existing.qty + 1) * existing.rate
        };
        return updated;
      } else {
        return [...prevItems, {
          productId: product.id,
          name: product.name,
          brand: product.brand,
          weight: product.weight,
          qty: 1,
          rate: product.mrp,
          amount: product.mrp
        }];
      }
    });
  };

  // Handle Save
  const handleSaveBill = (e) => {
    e.preventDefault();

    if (items.length === 0) {
      setStockWarning('Cannot save an empty bill. Please add at least 1 item.');
      return;
    }

    const updatedBill = {
      ...bill,
      customerName: customerName.trim() || undefined,
      customerPhone: customerPhone.trim() || undefined,
      paymentMode,
      subtotal,
      discount: totalDiscount,
      roundOffAmount,
      grandTotal,
      isEdited: true,
      editedAt: new Date().toISOString(),
      editReason: editReason.trim() || undefined,
      items: items.map(item => ({
        productId: item.productId,
        name: item.name,
        brand: item.brand,
        weight: item.weight,
        qty: item.qty,
        rate: item.rate,
        amount: item.qty * item.rate
      }))
    };

    onSave(updatedBill);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Edit Mistyped Bill #{bill.billNo}
                </h3>
                <span className="bg-amber-950 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded-full text-[10px] font-bold">
                  Editing Mode
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Original Date: {new Date(bill.dateTime).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <button 
            onClick={onClose} 
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Warning Banner if any */}
          {stockWarning && (
            <div className="bg-rose-950/90 border border-rose-500 rounded-xl p-3.5 flex items-center justify-between text-rose-200 text-xs shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{stockWarning}</span>
              </div>
              <button 
                onClick={() => setStockWarning(null)}
                className="text-rose-400 hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section 1: Customer Details & Payment Mode */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>Customer & Payment Information</span>
              <span className="text-[10px] text-slate-500 font-normal">Fix mistyped details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Customer Name</label>
                <input
                  type="text"
                  placeholder="Walk-in Customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 font-semibold block mb-1">Customer Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. 9840123456"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>
            </div>

            {/* Payment Mode Selector */}
            <div>
              <label className="text-[11px] text-slate-400 font-semibold block mb-1.5">Payment Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'Cash', label: 'Cash', sub: 'Discounted', icon: Banknote },
                  { id: 'UPI', label: 'GPay / UPI', sub: 'Exact Amt', icon: QrCode },
                  { id: 'Card', label: 'Card', sub: 'Exact Amt', icon: CreditCard }
                ].map(mode => {
                  const Icon = mode.icon;
                  const isSelected = paymentMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setPaymentMode(mode.id)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        isSelected 
                          ? 'bg-teal-600 text-white shadow-md border border-teal-400' 
                          : 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{mode.label}</span>
                      <span className={`text-[9px] font-normal ${isSelected ? 'text-teal-200' : 'text-slate-500'}`}>
                        ({mode.sub})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 2: Items on this Bill */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <span>Items in Bill ({items.reduce((a,c)=>a+c.qty, 0)} units)</span>
                <span className="text-[10px] text-slate-400 font-normal">Edit quantities, rates or remove items</span>
              </div>

              <button
                type="button"
                onClick={() => setShowAddSection(!showAddSection)}
                className="px-2.5 py-1 bg-teal-600/30 hover:bg-teal-600/50 text-teal-300 border border-teal-500/40 rounded-lg text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showAddSection ? 'Hide Product Catalog' : 'Add Item to Bill'}</span>
              </button>
            </div>

            {/* Optional Catalog Drawer to Add Omitted Items */}
            {showAddSection && (
              <div className="bg-slate-950 border border-teal-500/30 rounded-xl p-3 space-y-2.5 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search catalog to add omitted item..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-800/60">
                  {catalogFiltered.map(p => {
                    const maxStock = getMaxStockForProduct(p.id, p.name, p.weight);
                    const isOut = maxStock <= 0;

                    return (
                      <div key={p.id} className="pt-1.5 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-white">{p.name}</span>
                          <span className="text-slate-400 text-[11px] ml-1.5">({p.weight}) • ₹{p.mrp}</span>
                        </div>
                        <button
                          type="button"
                          disabled={isOut}
                          onClick={() => handleAddProduct(p)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                            isOut 
                              ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                              : 'bg-teal-600 hover:bg-teal-500 text-white shadow'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Editable Items Table */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900/90 text-slate-400 font-bold uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Product</th>
                    <th className="py-2.5 px-2 text-center w-28">Qty</th>
                    <th className="py-2.5 px-2 text-center w-24">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right w-24">Line Total</th>
                    <th className="py-2.5 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {items.map((item, idx) => {
                    const maxStock = getMaxStockForProduct(item.productId, item.name, item.weight);

                    return (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white">{item.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.weight} • <span className="text-slate-500">Max avail: {maxStock}</span>
                          </div>
                        </td>

                        {/* Qty controller */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(idx, -1)}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            
                            <input
                              type="number"
                              min="1"
                              max={maxStock}
                              value={item.qty}
                              onChange={(e) => handleSetExactQty(idx, e.target.value)}
                              className="w-8 text-center bg-transparent text-white font-bold text-xs focus:outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => handleUpdateQty(idx, 1)}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Rate input */}
                        <td className="py-2.5 px-2 text-center">
                          <input
                            type="number"
                            min="0"
                            value={item.rate}
                            onChange={(e) => handleUpdateRate(idx, e.target.value)}
                            className="w-16 bg-slate-900 text-emerald-400 font-bold border border-slate-700 rounded px-1.5 py-1 text-center text-xs focus:outline-none focus:border-teal-500"
                          />
                        </td>

                        {/* Line Total */}
                        <td className="py-2.5 px-3 text-right font-extrabold text-white text-xs">
                          ₹{item.qty * item.rate}
                        </td>

                        {/* Delete Action */}
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                            title="Remove item from bill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Financial Calculations & Rounding */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Calculated Subtotal:</span>
              <span className="font-bold text-white">₹{subtotal}</span>
            </div>

            {paymentMode === 'Cash' && !isCustomOverride && (
              <div className="flex justify-between text-xs text-teal-400">
                <span>Cash Discount / Rounding:</span>
                <span>-₹{roundOffAmount}</span>
              </div>
            )}

            {/* Manual Custom Override */}
            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
              <div className="flex items-center gap-1 text-amber-300 font-semibold">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Manual Final Bill Total (₹):</span>
              </div>
              <input
                type="number"
                min="0"
                placeholder={`Auto (${grandTotal})`}
                value={customGrandTotal}
                onChange={(e) => setCustomGrandTotal(e.target.value)}
                className="w-24 text-right px-2 py-1 bg-amber-950/40 border border-amber-500/50 rounded text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400 placeholder-slate-500"
              />
            </div>

            {!isCustomOverride && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Extra Discount (₹):</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="w-20 text-right px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-amber-400 font-bold focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-800 text-sm font-extrabold">
              <span className="text-slate-200">Final Grand Total:</span>
              <span className="text-xl text-emerald-400 font-heading">₹{grandTotal}</span>
            </div>
          </div>

          {/* Section 4: Live Inventory Stock Impact Preview */}
          <div className="bg-slate-950 border border-teal-500/30 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4 text-teal-400" />
                <span>Inventory Stock Impact Upon Saving</span>
              </div>
              <span className="text-[10px] text-slate-400">Automatic live sync</span>
            </div>

            <div className="space-y-1 text-xs">
              {stockChanges.length === 0 ? (
                <div className="text-slate-500 text-[11px] italic">No items changed.</div>
              ) : (
                stockChanges.map((sc, i) => {
                  return (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                      <div className="font-medium text-slate-300 truncate max-w-[280px]">
                        {sc.name} <span className="text-slate-500 text-[10px]">({sc.weight})</span>
                      </div>
                      <div className="text-right">
                        {sc.delta > 0 ? (
                          <span className="text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded text-[11px]">
                            +{sc.delta} units returned to stock
                          </span>
                        ) : sc.delta < 0 ? (
                          <span className="text-amber-400 font-bold bg-amber-950/60 border border-amber-800 px-2 py-0.5 rounded text-[11px]">
                            {sc.delta} units deducted from stock
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">
                            Qty unchanged ({sc.editedQty})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 5: Optional Edit Note */}
          <div>
            <label className="text-[11px] text-slate-400 font-semibold block mb-1">
              Reason for Edit (Optional Audit Note)
            </label>
            <input
              type="text"
              placeholder="e.g. Corrected quantity mistyped at counter / Swapped product"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-800/90 border-t border-slate-700 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSaveBill}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition border border-emerald-400/30"
          >
            <Save className="w-4 h-4" />
            <span>Save Corrected Bill & Update Stock</span>
          </button>
        </div>

      </div>
    </div>
  );
}
