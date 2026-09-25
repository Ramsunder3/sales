import React, { useState, useMemo } from 'react';
import { 
  Lock, KeyRound, Save, Download, Upload, RefreshCw, Plus, 
  Search, CheckCircle, AlertTriangle, Edit3, X, FileSpreadsheet, HardDrive, PackagePlus,
  Trash2, Ban, CheckSquare, AlertOctagon
} from 'lucide-react';
import { exportProductsCSV, exportBillsCSV, exportFullBackupJSON } from '../utils/exportUtils';
import { resetToDefaults } from '../utils/storage';
import { CATEGORIES } from '../data/seedData';

export default function AdminScreen({ 
  products, 
  onUpdateProducts, 
  bills, 
  adminPin, 
  onUpdateAdminPin,
  stallInfo,
  onUpdateStallInfo
}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Admin Sub-tabs: 'yesterday', 'inventory', 'backup', 'settings'
  const [activeTab, setActiveTab] = useState('yesterday');
  const [searchFilter, setSearchFilter] = useState('');

  // Editable local state for batch stock adjustment
  const [editedProducts, setEditedProducts] = useState(() => JSON.parse(JSON.stringify(products)));
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Delete & Zero Stock states
  const [deleteItemConfirm, setDeleteItemConfirm] = useState(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  // Tab 2 Inventory management states
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryBrandFilter, setInventoryBrandFilter] = useState('All');
  const [inventoryStockFilter, setInventoryStockFilter] = useState('all'); // 'all', 'in_stock', 'low_stock', 'out_of_stock'
  const [selectedStockIds, setSelectedStockIds] = useState([]);

  // Filtered edited products list for Tab 1
  const filteredEdited = useMemo(() => {
    const q = searchFilter.toLowerCase().trim();
    return editedProducts.filter(p => !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.srNo.toString() === q);
  }, [editedProducts, searchFilter]);

  // Filtered inventory products list for Tab 2
  const filteredInventory = useMemo(() => {
    return editedProducts.filter(p => {
      const q = inventorySearch.toLowerCase().trim();
      const matchesSearch = !q || 
        p.name.toLowerCase().includes(q) || 
        p.brand.toLowerCase().includes(q) || 
        p.weight.toLowerCase().includes(q) ||
        p.srNo.toString() === q;
      
      const matchesBrand = inventoryBrandFilter === 'All' || p.brand === inventoryBrandFilter;

      const matchesStock = 
        inventoryStockFilter === 'all' ? true :
        inventoryStockFilter === 'in_stock' ? (p.currentStock > 5) :
        inventoryStockFilter === 'low_stock' ? (p.currentStock > 0 && p.currentStock <= 5) :
        inventoryStockFilter === 'out_of_stock' ? (p.currentStock <= 0) : true;

      return matchesSearch && matchesBrand && matchesStock;
    });
  }, [editedProducts, inventorySearch, inventoryBrandFilter, inventoryStockFilter]);

  // Inventory count stats
  const inventoryStats = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    editedProducts.forEach(p => {
      if (p.currentStock <= 0) outOfStock++;
      else if (p.currentStock <= 5) lowStock++;
      else inStock++;
    });
    return { inStock, lowStock, outOfStock, total: editedProducts.length };
  }, [editedProducts]);

  React.useEffect(() => {
    setEditedProducts(JSON.parse(JSON.stringify(products)));
  }, [products]);

  // New product modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProd, setNewProd] = useState({
    name: '',
    brand: 'Ponkathir',
    customBrand: '',
    weight: '500GM',
    mrp: '100',
    openingQty: '50'
  });

  // Change PIN state
  const [newPin, setNewPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState('');

  // PIN check handler
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === adminPin) {
      setIsAuthenticated(true);
      setPinError('');
      setEditedProducts(JSON.parse(JSON.stringify(products)));
    } else {
      setPinError('Incorrect PIN. Please try again.');
    }
  };

  // Yesterday's sales adjustment input change
  const handleQtyChange = (id, field, value) => {
    const numVal = parseInt(value, 10);
    const safeVal = isNaN(numVal) || numVal < 0 ? 0 : numVal;

    setEditedProducts(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: safeVal };
        // Recalculate current stock based on openingQty and alreadySoldYesterday
        if (field === 'openingQty' || field === 'alreadySoldYesterday') {
          const newOpening = field === 'openingQty' ? safeVal : p.openingQty;
          const newSoldYesterday = field === 'alreadySoldYesterday' ? safeVal : p.alreadySoldYesterday;
          
          // Calculate stock delta from active bills today
          const soldToday = bills
            .filter(b => b.status === 'active' && Array.isArray(b.items))
            .reduce((acc, b) => {
              const matchingItems = b.items.filter(i => 
                i.productId === id || 
                String(i.productId) === String(p.srNo) ||
                (i.name && p.name && i.name.trim().toUpperCase() === p.name.trim().toUpperCase() &&
                 i.weight && p.weight && i.weight.trim().toUpperCase() === p.weight.trim().toUpperCase())
              );
              const sumQty = matchingItems.reduce((s, i) => s + (parseInt(i.qty, 10) || 0), 0);
              return acc + sumQty;
            }, 0);

          updated.currentStock = Math.max(0, newOpening - newSoldYesterday - soldToday);
          
          if (field === 'openingQty' && safeVal > 0) {
            updated.needsQtySetup = false;
          }
        }
        return updated;
      }
      return p;
    }));
  };

  const handlePriceChange = (id, value) => {
    const numVal = parseFloat(value);
    const safeVal = isNaN(numVal) || numVal < 0 ? 0 : numVal;

    setEditedProducts(prev => prev.map(p => {
      if (p.id === id) {
        return { 
          ...p, 
          mrp: safeVal,
          needsPriceSetup: false 
        };
      }
      return p;
    }));
  };

  // Save batch stock adjustments
  const handleSaveStockAdjustments = () => {
    onUpdateProducts(editedProducts);
    setSaveSuccessMsg('All inventory & opening stock adjustments saved successfully!');
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Add new product handler
  const handleAddProductSubmit = (e) => {
    e.preventDefault();
    if (!newProd.name.trim()) return;

    const brandName = newProd.brand === 'CUSTOM'
      ? (newProd.customBrand.trim() || 'Other')
      : newProd.brand;

    const newId = `PROD-${Date.now().toString().slice(-4)}`;
    const nextSrNo = products.length + 1;
    const initialQty = parseInt(newProd.openingQty, 10) || 0;
    const mrpVal = parseFloat(newProd.mrp) || 0;

    const created = {
      id: newId,
      srNo: nextSrNo,
      name: newProd.name.trim().toUpperCase(),
      brand: brandName,
      weight: newProd.weight.trim().toUpperCase() || '1PC',
      mrp: mrpVal,
      openingQty: initialQty,
      alreadySoldYesterday: 0,
      currentStock: initialQty,
      needsQtySetup: false,
      needsPriceSetup: false
    };

    const updatedList = [...products, created];
    onUpdateProducts(updatedList);
    setEditedProducts(JSON.parse(JSON.stringify(updatedList)));
    setShowAddModal(false);
    setNewProd({ name: '', brand: 'Ponkathir', customBrand: '', weight: '500GM', mrp: '100', openingQty: '50' });
    setSaveSuccessMsg(`New product "${created.name}" added to catalog successfully!`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Delete single stock item from catalog
  const handleDeleteProduct = (productId) => {
    const target = products.find(p => p.id === productId);
    const updated = products.filter(p => p.id !== productId).map((p, idx) => ({ ...p, srNo: idx + 1 }));
    onUpdateProducts(updated);
    setEditedProducts(prev => prev.filter(p => p.id !== productId).map((p, idx) => ({ ...p, srNo: idx + 1 })));
    setDeleteItemConfirm(null);
    setSelectedStockIds(prev => prev.filter(id => id !== productId));
    setSaveSuccessMsg(`Product "${target?.name || ''}" deleted from catalog successfully.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Bulk delete selected stock items
  const handleBulkDelete = () => {
    if (selectedStockIds.length === 0) return;
    const deleteSet = new Set(selectedStockIds);
    const count = selectedStockIds.length;
    const updated = products.filter(p => !deleteSet.has(p.id)).map((p, idx) => ({ ...p, srNo: idx + 1 }));
    onUpdateProducts(updated);
    setEditedProducts(prev => prev.filter(p => !deleteSet.has(p.id)).map((p, idx) => ({ ...p, srNo: idx + 1 })));
    setBulkDeleteConfirm(false);
    setSelectedStockIds([]);
    setSaveSuccessMsg(`${count} stock item${count > 1 ? 's' : ''} deleted from catalog.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Set stock to 0 for a product
  const handleZeroStock = (productId) => {
    const target = products.find(p => p.id === productId);
    const updated = products.map(p => p.id === productId ? { ...p, currentStock: 0 } : p);
    onUpdateProducts(updated);
    setEditedProducts(prev => prev.map(p => p.id === productId ? { ...p, currentStock: 0 } : p));
    setSaveSuccessMsg(`Stock for "${target?.name || ''}" set to 0 (Out of stock).`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Bulk zero stock for selected products
  const handleBulkZeroStock = () => {
    if (selectedStockIds.length === 0) return;
    const zeroSet = new Set(selectedStockIds);
    const count = selectedStockIds.length;
    const updated = products.map(p => zeroSet.has(p.id) ? { ...p, currentStock: 0 } : p);
    onUpdateProducts(updated);
    setEditedProducts(prev => prev.map(p => zeroSet.has(p.id) ? { ...p, currentStock: 0 } : p));
    setSelectedStockIds([]);
    setSaveSuccessMsg(`Stock set to 0 for ${count} selected item${count > 1 ? 's' : ''}.`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  // Override stock quantity and save immediately
  const handleOverrideStock = (productId, currentVal, name) => {
    const input = prompt(`Enter new available stock for "${name}":`, currentVal);
    if (input !== null) {
      const numVal = parseInt(input, 10);
      const safeVal = isNaN(numVal) || numVal < 0 ? 0 : numVal;
      const updated = products.map(p => p.id === productId ? { ...p, currentStock: safeVal } : p);
      onUpdateProducts(updated);
      setEditedProducts(prev => prev.map(p => p.id === productId ? { ...p, currentStock: safeVal } : p));
      setSaveSuccessMsg(`Stock updated to ${safeVal} for "${name}".`);
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    }
  };

  // Selection handlers for batch operations
  const handleToggleSelectAll = (filteredItems) => {
    const allFilteredIds = filteredItems.map(p => p.id);
    const isAllSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedStockIds.includes(id));
    if (isAllSelected) {
      setSelectedStockIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedStockIds(prev => Array.from(new Set([...prev, ...allFilteredIds])));
    }
  };

  const handleToggleSelectRow = (id) => {
    setSelectedStockIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // JSON Backup Import handler
  const handleRestoreJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.products && Array.isArray(data.products)) {
          onUpdateProducts(data.products);
          setEditedProducts(JSON.parse(JSON.stringify(data.products)));
          alert('Backup restored successfully!');
        } else {
          alert('Invalid backup file format.');
        }
      } catch (err) {
        alert('Failed to parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleChangePin = (e) => {
    e.preventDefault();
    if (newPin.length < 4) {
      setPinChangeMsg('PIN must be at least 4 digits.');
      return;
    }
    onUpdateAdminPin(newPin);
    setPinChangeMsg('Admin PIN updated successfully!');
    setNewPin('');
    setTimeout(() => setPinChangeMsg(''), 3000);
  };

  // Lock screen modal if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-12 glass-panel p-8 shadow-2xl border-slate-700 text-center animate-fadeIn">
        <div className="w-16 h-16 bg-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-teal-500/30">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Admin Security Gate</h2>
        <p className="text-xs text-slate-400 mb-6">
          Enter PIN to access stock editing, yesterday's sales setup, and system exports.
        </p>

        <form onSubmit={handlePinSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="Enter PIN (Default: 1234)"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full text-center tracking-widest text-2xl py-3 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500"
              maxLength={8}
              autoFocus
            />
          </div>

          {pinError && (
            <div className="text-xs text-rose-400 font-semibold">{pinError}</div>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl transition shadow-lg shadow-teal-950"
          >
            Unlock Admin Panel
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Admin Header */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4 border-teal-500/30">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-teal-400" />
            Admin & Inventory Management
          </h2>
          <p className="text-xs text-slate-400">
            Set opening stock, record yesterday's sales, edit MRPs, and export records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add New Product</span>
          </button>

          <button
            onClick={() => setIsAuthenticated(false)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
          >
            Lock Session
          </button>
        </div>
      </div>

      {/* Admin Tabs Navigation */}
      <div className="flex border-b border-slate-700 gap-4 overflow-x-auto">
        {[
          { id: 'yesterday', label: "Yesterday's Stock Adjustment", icon: Edit3 },
          { id: 'inventory', label: 'Inventory & MRP Edit', icon: FileSpreadsheet },
          { id: 'backup', label: 'Export & Backup', icon: HardDrive },
          { id: 'settings', label: 'Stall Settings & PIN', icon: KeyRound }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
                isActive 
                  ? 'border-teal-400 text-teal-400' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {saveSuccessMsg && (
        <div className="bg-emerald-950/80 border border-emerald-500/50 rounded-xl p-4 text-emerald-300 text-sm flex items-center gap-2 shadow-lg animate-fadeIn">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* TAB 1: YESTERDAY'S SALES ONE-TIME ADJUSTMENT */}
      {activeTab === 'yesterday' && (
        <div className="space-y-4">
          <div className="bg-slate-800/90 border border-teal-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                Yesterday's Sales One-Time Stock Adjustment
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                The stall started before this app went live. Enter how many items were <strong>already sold yesterday</strong> so the app calculates exact current stock: <br />
                <code className="text-teal-300 font-bold bg-slate-900 px-2 py-0.5 rounded">Current Stock = Opening Qty - Already Sold Yesterday - Today's Sales</code>
              </p>
            </div>

            <button
              onClick={handleSaveStockAdjustments}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950 flex items-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              Save All Adjustments
            </button>
          </div>

          {/* Search bar for admin table */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Filter table by product or brand..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Adjustment Table */}
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto max-h-[550px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-slate-300 font-bold uppercase sticky top-0 border-b border-slate-700">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Product Name & Weight</th>
                    <th className="py-3 px-3">Brand</th>
                    <th className="py-3 px-3 text-center">MRP (₹)</th>
                    <th className="py-3 px-3 text-center">Opening Qty (Sheet)</th>
                    <th className="py-3 px-3 text-center bg-amber-950/40 text-amber-300 border-x border-amber-800/40">
                      Already Sold (Yesterday)
                    </th>
                    <th className="py-3 px-3 text-center">Current Available Stock</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredEdited.map((p) => {
                    const needsSetup = p.needsQtySetup || p.needsPriceSetup;
                    return (
                      <tr key={p.id} className={`hover:bg-slate-800/50 ${needsSetup ? 'bg-amber-950/20' : ''}`}>
                        <td className="py-2.5 px-3 font-mono text-slate-400">{p.srNo}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white">{p.name}</div>
                          <div className="text-[11px] text-slate-400">{p.weight}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="bg-slate-800 text-teal-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-700">
                            {p.brand}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            value={p.mrp}
                            onChange={(e) => handlePriceChange(p.id, e.target.value)}
                            className={`w-16 text-center py-1 bg-slate-900 border rounded font-bold text-emerald-400 focus:outline-none ${
                              p.needsPriceSetup ? 'border-amber-500 bg-amber-950/40' : 'border-slate-700'
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            value={p.openingQty}
                            onChange={(e) => handleQtyChange(p.id, 'openingQty', e.target.value)}
                            className={`w-16 text-center py-1 bg-slate-900 border rounded font-bold text-white focus:outline-none ${
                              p.needsQtySetup ? 'border-amber-500 bg-amber-950/40' : 'border-slate-700'
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center bg-amber-950/20 border-x border-amber-900/30">
                          <input
                            type="number"
                            value={p.alreadySoldYesterday}
                            onChange={(e) => handleQtyChange(p.id, 'alreadySoldYesterday', e.target.value)}
                            className="w-20 text-center py-1 bg-slate-900 border border-amber-500/60 rounded font-extrabold text-amber-300 focus:outline-none focus:border-amber-400"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-extrabold text-sm">
                          <span className={p.currentStock <= 0 ? 'text-rose-400' : p.currentStock <= 5 ? 'text-amber-400' : 'text-emerald-400'}>
                            {p.currentStock}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {p.needsQtySetup || p.needsPriceSetup ? (
                            <span className="badge-amber">Needs Setup</span>
                          ) : p.currentStock <= 0 ? (
                            <span className="badge-red">Out of Stock</span>
                          ) : (
                            <span className="badge-green">OK</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => setDeleteItemConfirm(p)}
                            title={`Delete "${p.name}" from catalog`}
                            className="p-1.5 bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 hover:border-rose-700/60 transition inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px] hidden xl:inline">Delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY & PRODUCT MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Top Title & Add Button */}
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-teal-400" />
                <span>Full Product Catalog & Stock Management</span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-normal border border-slate-700">
                  {filteredInventory.length} of {products.length} Items
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage live counter inventory, override stock counts, zero out depleted items, or delete unwanted stocks from catalog.
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-lg shadow-teal-950 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Product</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="glass-panel p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by product name, brand, weight, or #..."
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
                />
                {inventorySearch && (
                  <button
                    onClick={() => setInventorySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Brand Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold hidden sm:inline">Brand:</span>
                <select
                  value={inventoryBrandFilter}
                  onChange={(e) => setInventoryBrandFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'All Brands' : cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stock Level Quick Filter Pills */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[11px] text-slate-400 font-semibold mr-1">Stock Status:</span>
                {[
                  { id: 'all', label: 'All', count: inventoryStats.total },
                  { id: 'in_stock', label: 'In Stock (>5)', count: inventoryStats.inStock, badgeClass: 'text-emerald-400' },
                  { id: 'low_stock', label: 'Low Stock (1-5)', count: inventoryStats.lowStock, badgeClass: 'text-amber-400' },
                  { id: 'out_of_stock', label: 'Out of Stock (0)', count: inventoryStats.outOfStock, badgeClass: 'text-rose-400' }
                ].map(f => {
                  const isActive = inventoryStockFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setInventoryStockFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                        isActive 
                          ? 'bg-teal-600 text-white shadow' 
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <span>{f.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-teal-800 text-white' : 'bg-slate-800 text-slate-300'
                      }`}>
                        {f.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {(inventorySearch || inventoryBrandFilter !== 'All' || inventoryStockFilter !== 'all') && (
                <button
                  onClick={() => {
                    setInventorySearch('');
                    setInventoryBrandFilter('All');
                    setInventoryStockFilter('all');
                  }}
                  className="text-[11px] text-teal-400 hover:underline font-semibold"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Batch Actions Bar (when items selected) */}
          {selectedStockIds.length > 0 && (
            <div className="bg-teal-950/90 border border-teal-500/50 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-teal-400" />
                <span className="text-xs font-bold text-white">
                  {selectedStockIds.length} of {filteredInventory.length} stocks selected
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleBulkZeroStock}
                  className="px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900 border border-amber-600/60 text-amber-300 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                  title="Set available stock to 0 for selected items"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Zero Stock ({selectedStockIds.length})</span>
                </button>

                <button
                  onClick={() => setBulkDeleteConfirm(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950 transition"
                  title="Permanently remove selected stock items from catalog"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Selected ({selectedStockIds.length})</span>
                </button>

                <button
                  onClick={() => setSelectedStockIds([])}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          {/* Inventory Table */}
          <div className="glass-panel overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-slate-300 font-bold uppercase border-b border-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={filteredInventory.length > 0 && filteredInventory.every(p => selectedStockIds.includes(p.id))}
                        onChange={() => handleToggleSelectAll(filteredInventory)}
                        className="rounded border-slate-700 text-teal-600 focus:ring-0 cursor-pointer w-4 h-4 bg-slate-950"
                        title="Select/Deselect all filtered items"
                      />
                    </th>
                    <th className="py-3 px-2">#</th>
                    <th className="py-3 px-3">Product Name</th>
                    <th className="py-3 px-3">Brand</th>
                    <th className="py-3 px-3">Weight</th>
                    <th className="py-3 px-3 text-center">MRP (₹)</th>
                    <th className="py-3 px-3 text-center">Current Stock</th>
                    <th className="py-3 px-3 text-center">Status</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <Search className="w-8 h-8 mx-auto opacity-40 mb-2" />
                        <div className="font-bold text-sm text-slate-300">No stock items match your search criteria.</div>
                        <div className="text-xs text-slate-500 mt-1">Try clearing filters or search terms.</div>
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map(p => {
                      const isSelected = selectedStockIds.includes(p.id);
                      const isOutOfStock = p.currentStock <= 0;
                      const isLowStock = p.currentStock > 0 && p.currentStock <= 5;

                      return (
                        <tr 
                          key={p.id} 
                          className={`hover:bg-slate-800/50 transition ${
                            isSelected ? 'bg-teal-950/20' : ''
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRow(p.id)}
                              className="rounded border-slate-700 text-teal-600 focus:ring-0 cursor-pointer w-4 h-4 bg-slate-950"
                            />
                          </td>
                          <td className="py-2.5 px-2 font-mono text-slate-400">{p.srNo}</td>
                          <td className="py-2.5 px-3 font-bold text-white">
                            <div>{p.name}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="bg-slate-900 text-teal-300 px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-800">
                              {p.brand}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-300 font-mono">{p.weight}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-emerald-400">₹{p.mrp}</td>
                          <td className="py-2.5 px-3 text-center font-extrabold text-sm font-mono">
                            <span className={isOutOfStock ? 'text-rose-400' : isLowStock ? 'text-amber-400' : 'text-emerald-400'}>
                              {p.currentStock}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isOutOfStock ? (
                              <span className="badge-red">Out of Stock</span>
                            ) : isLowStock ? (
                              <span className="badge-amber">Low Stock</span>
                            ) : (
                              <span className="badge-green">In Stock</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Override Stock */}
                              <button
                                onClick={() => handleOverrideStock(p.id, p.currentStock, p.name)}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-semibold border border-slate-700 transition"
                                title="Set new stock quantity directly"
                              >
                                Override
                              </button>

                              {/* Zero Stock (sets stock to 0) */}
                              <button
                                onClick={() => handleZeroStock(p.id)}
                                disabled={isOutOfStock}
                                className={`px-2 py-1 rounded text-[11px] font-semibold border transition ${
                                  isOutOfStock
                                    ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                    : 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-700/50'
                                }`}
                                title={isOutOfStock ? 'Already out of stock' : 'Quickly set stock to 0'}
                              >
                                Zero
                              </button>

                              {/* Delete Stock Item from Catalog */}
                              <button
                                onClick={() => setDeleteItemConfirm(p)}
                                className="p-1.5 bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 rounded-lg border border-slate-700 hover:border-rose-700/60 transition"
                                title={`Permanently delete "${p.name}" from catalog`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXPORT & BACKUP */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CSV Export Options */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-teal-400" />
              Export Reports (CSV / Excel)
            </h3>
            <p className="text-xs text-slate-400">
              Download clean CSV spreadsheets to open in Microsoft Excel or Google Sheets for club accounting reconciliation.
            </p>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => exportProductsCSV(products)}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-between transition shadow"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Export Inventory & Stock List (.CSV)</span>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => exportBillsCSV(bills)}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-between transition shadow"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                  <span>Export Sales Log & Completed Bills (.CSV)</span>
                </div>
                <Download className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* System Backup & Restore */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-teal-400" />
              System Backup & Restore
            </h3>
            <p className="text-xs text-slate-400">
              Save a full backup of all sales, bills, and stock data to JSON, or restore from a previous backup file.
            </p>

            <div className="space-y-3 pt-2">
              <button
                onClick={() => exportFullBackupJSON(products, bills, stallInfo)}
                className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow flex items-center justify-center gap-2 transition"
              >
                <Download className="w-4 h-4" />
                Download Full JSON Backup
              </button>

              <label className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 cursor-pointer transition">
                <Upload className="w-4 h-4 text-amber-400" />
                <span>Restore Data from JSON File</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreJSON}
                  className="hidden"
                />
              </label>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={() => {
                    if (confirm('WARNING: Are you sure you want to reset all data back to original seed defaults? This cannot be undone!')) {
                      resetToDefaults();
                      window.location.reload();
                    }
                  }}
                  className="w-full py-2.5 px-3 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset Stall Data to Seed Defaults
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SETTINGS & PIN */}
      {activeTab === 'settings' && (
        <div className="max-w-md glass-panel p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Change Admin PIN</h3>
            <p className="text-xs text-slate-400">Update security PIN for counter protection.</p>
          </div>

          <form onSubmit={handleChangePin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">New Security PIN</label>
              <input
                type="password"
                placeholder="Enter 4 or 6 digit PIN"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            {pinChangeMsg && (
              <div className="text-xs font-semibold text-emerald-400">{pinChangeMsg}</div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl transition shadow"
            >
              Update PIN
            </button>
          </form>
        </div>
      )}

      {/* Add New Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
                  <PackagePlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Custom Product to Catalog</h3>
                  <p className="text-xs text-slate-400">Save a new item with price and opening inventory.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProductSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-bold block mb-1">
                  Product Description / Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. SPECIAL JACKFRUIT HALWA"
                  value={newProd.name}
                  onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-teal-500 font-semibold"
                />
              </div>

              {/* Brand Selector & Custom Brand */}
              <div className="space-y-2">
                <label className="text-xs text-slate-300 font-bold block">
                  Brand / Category *
                </label>
                <select
                  value={newProd.brand}
                  onChange={(e) => setNewProd({ ...newProd, brand: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 font-semibold cursor-pointer"
                >
                  {CATEGORIES.filter(c => c !== 'All').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="CUSTOM">+ Custom Brand Name...</option>
                </select>

                {newProd.brand === 'CUSTOM' && (
                  <input
                    type="text"
                    required
                    placeholder="Type custom brand name (e.g. Aachi, MTR, Homemade)..."
                    value={newProd.customBrand}
                    onChange={(e) => setNewProd({ ...newProd, customBrand: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-teal-500 rounded-xl text-xs text-teal-300 focus:outline-none placeholder-slate-500"
                  />
                )}
              </div>

              {/* Weight / Pack Size with Quick Pills */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-slate-300 font-bold">Weight / Unit Pack *</label>
                  <span className="text-[10px] text-slate-400">Click a preset below or type</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500GM, 1KG, 250GM, 1PC"
                  value={newProd.weight}
                  onChange={(e) => setNewProd({ ...newProd, weight: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs sm:text-sm text-white focus:outline-none focus:border-teal-500 font-mono font-semibold"
                />
                {/* Preset weight buttons */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {['100GM', '200GM', '250GM', '500GM', '1KG', '2KG', '5KG', '1PC'].map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setNewProd({ ...newProd, weight: w })}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                        newProd.weight.toUpperCase() === w
                          ? 'bg-teal-900/80 text-teal-200 border-teal-500'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price & Opening Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">
                    Selling MRP Price (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="e.g. 100"
                    value={newProd.mrp}
                    onChange={(e) => setNewProd({ ...newProd, mrp: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-extrabold text-emerald-400 focus:outline-none focus:border-emerald-500 font-heading"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 font-bold block mb-1">
                    Opening Stock Qty *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 50"
                    value={newProd.openingQty}
                    onChange={(e) => setNewProd({ ...newProd, openingQty: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-teal-950 transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Product to Catalog</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Product Confirmation Modal */}
      {deleteItemConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Stock Item from Catalog?</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to permanently remove this stock item from the inventory?
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Product Name:</span>
                <span className="font-bold text-white text-right">{deleteItemConfirm.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Brand / Category:</span>
                <span className="text-teal-300 font-semibold">{deleteItemConfirm.brand}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Weight / Size:</span>
                <span className="text-slate-200 font-mono font-semibold">{deleteItemConfirm.weight}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MRP Selling Price:</span>
                <span className="text-emerald-400 font-bold">₹{deleteItemConfirm.mrp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Stock:</span>
                <span className={`font-extrabold ${deleteItemConfirm.currentStock <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                  {deleteItemConfirm.currentStock} units
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl text-[11px] text-slate-400 space-y-1">
              <div className="text-amber-300 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Permanent Catalog Deletion</span>
              </div>
              <p>
                This item will be deleted from the stock list and billing catalog. Past completed bills that already contain this item will keep their sales audit records.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteItemConfirm(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProduct(deleteItemConfirm.id)}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950 transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Stock Item</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Products Confirmation Modal */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 shrink-0">
                <AlertOctagon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Delete {selectedStockIds.length} Stock Items?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  You are about to permanently delete {selectedStockIds.length} items from the product catalog.
                </p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 max-h-52 overflow-y-auto divide-y divide-slate-800/80 text-xs">
              {products.filter(p => selectedStockIds.includes(p.id)).map(p => (
                <div key={p.id} className="py-1.5 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <span className="font-bold text-white mr-1.5">{p.name}</span>
                    <span className="text-slate-400 font-mono">({p.weight})</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-teal-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {p.brand}
                    </span>
                    <span className="text-slate-400 font-mono font-semibold">
                      {p.currentStock} units
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-rose-950/30 border border-rose-800/50 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                These items will be permanently removed from inventory. (If you only wish to set stock to 0, use <strong>Zero Stock</strong> instead).
              </span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBulkDeleteConfirm(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950 transition flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete {selectedStockIds.length} Items</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
