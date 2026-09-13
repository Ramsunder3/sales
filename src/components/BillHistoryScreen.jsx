import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, Search, Printer, Download, Eye, X, AlertOctagon, 
  CheckCircle2, Ban, MessageSquare, Share2, Edit3, ChevronDown, 
  ChevronUp, Package, Tag, Filter, Sparkles, ShoppingBag, 
  ArrowUpDown, Calendar, DollarSign, ListFilter, Layers, Check,
  ExternalLink, FileSpreadsheet
} from 'lucide-react';
import { generateBillPDF, shareBillPDFToCustomer } from '../utils/pdfGenerator';
import { sendWhatsAppBill } from '../utils/whatsapp';
import PrintReceiptModal from './PrintReceiptModal';
import EditBillModal from './EditBillModal';
import { exportBillsCSV } from '../utils/exportUtils';

export default function BillHistoryScreen({ 
  bills = [], 
  products = [], 
  onVoidBill, 
  onUpdateBill, 
  stallInfo,
  initialSearchQuery = '',
  initialItemFilter = null,
  onClearInitialSearch
}) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [searchScope, setSearchScope] = useState('all'); // 'all', 'items', 'billNo', 'customer'
  const [selectedProductFilter, setSelectedProductFilter] = useState(initialItemFilter || '');
  const [dateRange, setDateRange] = useState('all'); // 'all', 'today', 'yesterday'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'edited', 'void'
  const [sortBy, setSortBy] = useState('date_desc'); // 'date_desc', 'date_asc', 'total_desc', 'total_asc', 'items_desc'

  const [selectedBill, setSelectedBill] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(null);
  const [voidConfirmBill, setVoidConfirmBill] = useState(null);
  const [editingBill, setEditingBill] = useState(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState('');

  // Set of bill numbers with expanded item lists in the table
  const [expandedBillNos, setExpandedBillNos] = useState(new Set());

  // Synchronize when initial props change
  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
    if (initialItemFilter) {
      setSelectedProductFilter(initialItemFilter);
    }
  }, [initialSearchQuery, initialItemFilter]);

  // Aggregate all unique catalog & bill items for dropdown selection
  const uniqueItemsList = useMemo(() => {
    const map = new Map();
    // 1. Add from products catalog
    (products || []).forEach(p => {
      const key = `${(p.name || '').trim().toUpperCase()}__${(p.weight || '').trim().toUpperCase()}`;
      map.set(key, {
        id: p.id,
        srNo: p.srNo,
        name: p.name,
        brand: p.brand || 'Other',
        weight: p.weight || '',
        mrp: p.mrp
      });
    });
    // 2. Add from bills if not in catalog
    (bills || []).forEach(b => {
      (b.items || []).forEach(item => {
        const key = `${(item.name || '').trim().toUpperCase()}__${(item.weight || '').trim().toUpperCase()}`;
        if (!map.has(key)) {
          map.set(key, {
            id: item.productId || key,
            srNo: map.size + 1,
            name: item.name,
            brand: item.brand || 'Other',
            weight: item.weight || '',
            mrp: item.rate
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products, bills]);

  // Helper to test if a line-item matches an active query or product filter
  const isLineItemMatch = (item, q, selectedProdName) => {
    if (!item) return false;
    if (selectedProdName) {
      const normalizedSel = selectedProdName.trim().toUpperCase();
      const itemName = (item.name || '').trim().toUpperCase();
      const itemKey = `${itemName}__${(item.weight || '').trim().toUpperCase()}`;
      if (itemName === normalizedSel || itemKey === normalizedSel || (item.productId && item.productId === selectedProdName)) {
        return true;
      }
    }
    if (q) {
      const name = (item.name || '').toLowerCase();
      const brand = (item.brand || '').toLowerCase();
      const weight = (item.weight || '').toLowerCase();
      const prodId = (item.productId || '').toString().toLowerCase();
      return name.includes(q) || brand.includes(q) || weight.includes(q) || prodId.includes(q);
    }
    return false;
  };

  // Helper to extract matching items from a bill
  const getMatchingItemsInBill = (bill) => {
    if (!bill.items || !Array.isArray(bill.items)) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q && !selectedProductFilter) return [];

    return bill.items.filter(item => isLineItemMatch(item, q, selectedProductFilter));
  };

  // Filter bills list with comprehensive item search support
  const filteredBills = useMemo(() => {
    return bills.filter(b => {
      // 1. Status Filter
      if (statusFilter === 'active' && b.status === 'void') return false;
      if (statusFilter === 'void' && b.status !== 'void') return false;
      if (statusFilter === 'edited' && !b.isEdited) return false;

      // 2. Date Filter
      if (dateRange === 'today') {
        const billDateStr = new Date(b.dateTime).toDateString();
        const todayStr = new Date().toDateString();
        if (billDateStr !== todayStr) return false;
      } else if (dateRange === 'yesterday') {
        const billDateStr = new Date(b.dateTime).toDateString();
        const yestStr = new Date(Date.now() - 86400000).toDateString();
        if (billDateStr !== yestStr) return false;
      }

      // 3. Specific Product Selected from Dropdown
      if (selectedProductFilter) {
        const hasItem = b.items && b.items.some(item => isLineItemMatch(item, '', selectedProductFilter));
        if (!hasItem) return false;
      }

      // 4. Text Search Query
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const billNoMatch = (b.billNo || '').toLowerCase().includes(q);
      const custMatch = (b.customerName || '').toLowerCase().includes(q) || (b.customerPhone || '').includes(q);
      const modeMatch = (b.paymentMode || '').toLowerCase().includes(q);
      const dateMatch = new Date(b.dateTime).toLocaleDateString('en-IN').includes(q);
      
      const itemMatch = b.items && b.items.some(item => {
        const name = (item.name || '').toLowerCase();
        const brand = (item.brand || '').toLowerCase();
        const weight = (item.weight || '').toLowerCase();
        const prodId = (item.productId || '').toString().toLowerCase();
        return name.includes(q) || brand.includes(q) || weight.includes(q) || prodId.includes(q);
      });

      if (searchScope === 'items') {
        return itemMatch;
      } else if (searchScope === 'billNo') {
        return billNoMatch;
      } else if (searchScope === 'customer') {
        return custMatch;
      }

      // Default: 'all' fields matches bill info OR any item inside the bill
      return billNoMatch || custMatch || modeMatch || dateMatch || itemMatch;
    });
  }, [bills, searchQuery, searchScope, selectedProductFilter, statusFilter, dateRange]);

  // Sort bills
  const sortedBills = useMemo(() => {
    const list = [...filteredBills];
    list.sort((a, b) => {
      if (sortBy === 'date_desc') return new Date(b.dateTime) - new Date(a.dateTime);
      if (sortBy === 'date_asc') return new Date(a.dateTime) - new Date(b.dateTime);
      if (sortBy === 'total_desc') return (b.grandTotal || 0) - (a.grandTotal || 0);
      if (sortBy === 'total_asc') return (a.grandTotal || 0) - (b.grandTotal || 0);
      if (sortBy === 'items_desc') {
        const countA = (a.items || []).reduce((acc, curr) => acc + curr.qty, 0);
        const countB = (b.items || []).reduce((acc, curr) => acc + curr.qty, 0);
        return countB - countA;
      }
      return new Date(b.dateTime) - new Date(a.dateTime);
    });
    return list;
  }, [filteredBills, sortBy]);

  // Compute live item matching analytics when an item or search is active
  const itemMatchSummary = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q && !selectedProductFilter) return null;

    let totalMatchedBills = 0;
    let totalMatchedUnits = 0;
    let totalMatchedRevenue = 0;
    const uniqueItemNames = new Set();

    sortedBills.forEach(b => {
      const matchedItems = getMatchingItemsInBill(b);
      if (matchedItems.length > 0) {
        totalMatchedBills += 1;
        matchedItems.forEach(i => {
          const qty = parseInt(i.qty, 10) || 0;
          const rate = parseFloat(i.rate) || 0;
          const amt = parseFloat(i.amount) || (qty * rate);
          totalMatchedUnits += qty;
          totalMatchedRevenue += amt;
          uniqueItemNames.add(`${i.name} (${i.weight || '-'})`);
        });
      }
    });

    if (totalMatchedBills === 0 && !selectedProductFilter && searchScope !== 'items') {
      return null;
    }

    return {
      billsCount: totalMatchedBills,
      unitsCount: totalMatchedUnits,
      revenue: totalMatchedRevenue,
      itemNames: Array.from(uniqueItemNames)
    };
  }, [sortedBills, searchQuery, selectedProductFilter, searchScope]);

  // Toggle row item details expansion
  const toggleRowExpansion = (billNo) => {
    setExpandedBillNos(prev => {
      const next = new Set(prev);
      if (next.has(billNo)) {
        next.delete(billNo);
      } else {
        next.add(billNo);
      }
      return next;
    });
  };

  // Expand or Collapse All rows
  const handleToggleExpandAll = () => {
    if (expandedBillNos.size === sortedBills.length) {
      setExpandedBillNos(new Set());
    } else {
      setExpandedBillNos(new Set(sortedBills.map(b => b.billNo)));
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedProductFilter('');
    setSearchScope('all');
    setDateRange('all');
    setStatusFilter('all');
    if (onClearInitialSearch) {
      onClearInitialSearch();
    }
  };

  // Quick filter by clicking an item badge
  const handleQuickFilterByItem = (itemName) => {
    setSelectedProductFilter(itemName);
    setSearchQuery('');
    setSearchScope('items');
  };

  const handleDownloadPDF = (bill) => {
    generateBillPDF(bill, stallInfo);
  };

  const handleConfirmVoid = () => {
    if (voidConfirmBill) {
      onVoidBill(voidConfirmBill.billNo);
      setVoidConfirmBill(null);
      if (selectedBill && selectedBill.billNo === voidConfirmBill.billNo) {
        setSelectedBill(null);
      }
    }
  };

  const handleSaveEditedBill = (updatedBill) => {
    if (onUpdateBill) {
      onUpdateBill(updatedBill);
    }
    setEditingBill(null);
    if (selectedBill && selectedBill.billNo === updatedBill.billNo) {
      setSelectedBill(updatedBill);
    }
    setEditSuccessMsg(`Bill #${updatedBill.billNo} has been updated successfully and inventory stock adjusted!`);
    setTimeout(() => setEditSuccessMsg(''), 4000);
  };

  const isAnyFilterActive = searchQuery || selectedProductFilter || dateRange !== 'all' || statusFilter !== 'all' || searchScope !== 'all';

  return (
    <div className="space-y-6">
      
      {/* Header & Export Controls */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4 border-teal-500/30">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Sales Log & Bill History
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-teal-300 border border-slate-700">
                  {sortedBills.length} {sortedBills.length === 1 ? 'Bill' : 'Bills'}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Search bills by <strong>items inside</strong>, reprint thermal receipts, edit mistyped sales, or export transaction logs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Toggle Expand All Rows */}
          <button
            onClick={handleToggleExpandAll}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition shadow"
            title="Expand / Collapse all items in table"
          >
            <Layers className="w-4 h-4 text-teal-400" />
            <span>{expandedBillNos.size === sortedBills.length && sortedBills.length > 0 ? 'Collapse All Items' : 'Expand All Items'}</span>
          </button>

          {/* Export Filtered or All CSV */}
          <button
            onClick={() => exportBillsCSV(sortedBills)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition shadow"
            title="Export filtered list to CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV ({sortedBills.length})</span>
          </button>
        </div>
      </div>

      {/* Edit Success Toast */}
      {editSuccessMsg && (
        <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-xl p-4 text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 shadow-lg animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-semibold">{editSuccessMsg}</span>
        </div>
      )}

      {/* Comprehensive Search & Item Finder Toolbar */}
      <div className="glass-panel p-4 space-y-3.5">
        
        {/* Row 1: Search Bar + Scope Selector + Quick Product Picker */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          
          {/* Main Search Input (6 cols) */}
          <div className="lg:col-span-6 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-400" />
            <input
              type="text"
              placeholder={
                searchScope === 'items'
                  ? "🔍 Search item name inside bills (e.g. 'Puttupodi', 'Halwa', 'Chips', 'Pickle')..."
                  : searchScope === 'billNo'
                  ? "Search by Bill No (e.g. BILL-1001)..."
                  : searchScope === 'customer'
                  ? "Search by Customer Name or Phone..."
                  : "Search anything: Item Name inside bill, Bill #, Customer, Brand, Phone, Date..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Scope Filter Buttons (3 cols) */}
          <div className="lg:col-span-3 flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
            {[
              { id: 'all', label: 'All Fields' },
              { id: 'items', label: 'Items in Bills', icon: Package },
              { id: 'billNo', label: 'Bill No' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSearchScope(tab.id)}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition text-center flex items-center justify-center gap-1 ${
                  searchScope === tab.id
                    ? 'bg-teal-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.icon && <tab.icon className="w-3 h-3" />}
                <span className="truncate">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Quick Item/Product Dropdown (3 cols) */}
          <div className="lg:col-span-3 relative">
            <div className="relative">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400 pointer-events-none" />
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 font-semibold focus:outline-none focus:border-teal-500 appearance-none cursor-pointer"
              >
                <option value="">🎯 Pick item to find bills...</option>
                {uniqueItemsList.map(item => (
                  <option key={`${item.name}-${item.weight}`} value={item.name}>
                    {item.name} ({item.weight}) - ₹{item.mrp}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

        </div>

        {/* Row 2: Secondary Filter Pills & Sorting */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          
          {/* Left: Date Range & Status Filters */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Date Pills */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'all', label: 'All Dates' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setDateRange(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    dateRange === f.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Status Pills */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              {[
                { id: 'all', label: 'All Status' },
                { id: 'active', label: 'Active Only' },
                { id: 'edited', label: 'Edited' },
                { id: 'void', label: 'Voided' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                    statusFilter === f.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Clear Filters Button if any active */}
            {isAnyFilterActive && (
              <button
                onClick={handleClearFilters}
                className="px-2.5 py-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg border border-rose-900/60 font-semibold flex items-center gap-1 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Clear Filters</span>
              </button>
            )}
          </div>

          {/* Right: Sort Order Selector */}
          <div className="flex items-center gap-2 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-teal-500 font-semibold"
            >
              <option value="date_desc">⏱️ Newest Bills First</option>
              <option value="date_asc">⏱️ Oldest Bills First</option>
              <option value="total_desc">💰 Highest Grand Total</option>
              <option value="total_asc">💰 Lowest Grand Total</option>
              <option value="items_desc">📦 Most Items in Bill</option>
            </select>
          </div>

        </div>

      </div>

      {/* Item Search Intelligence Summary Banner */}
      {itemMatchSummary && (
        <div className="bg-gradient-to-r from-teal-950/90 via-slate-900 to-teal-950/90 border border-teal-500/50 rounded-2xl p-4 shadow-xl animate-fadeIn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center font-bold shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-teal-300">
                    Item Search Result:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-teal-900/80 text-white font-mono font-bold text-xs border border-teal-600">
                    "{selectedProductFilter || searchQuery}"
                  </span>
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  Found in <strong className="text-teal-300">{itemMatchSummary.billsCount}</strong> bills • Sold a total of <strong className="text-white">{itemMatchSummary.unitsCount} units</strong> of this item • Generated <strong className="text-emerald-400">₹{itemMatchSummary.revenue.toLocaleString('en-IN')}</strong> in matched item sales
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedProductFilter('');
                  setSearchQuery('');
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 flex items-center gap-1 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Show All Bills</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bills Table with Expandable Item Rows */}
      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-300 font-bold uppercase border-b border-slate-700">
              <tr>
                <th className="py-3.5 px-3 w-10 text-center">Items</th>
                <th className="py-3.5 px-3">Bill No</th>
                <th className="py-3.5 px-3">Date & Time</th>
                <th className="py-3.5 px-3">Customer Details</th>
                <th className="py-3.5 px-3">Items Summary</th>
                <th className="py-3.5 px-3 text-center">Payment</th>
                <th className="py-3.5 px-3 text-right">Grand Total (₹)</th>
                <th className="py-3.5 px-3 text-center">Status</th>
                <th className="py-3.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <History className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-400">
                      {isAnyFilterActive ? "No bills matching your search or item criteria" : "No bills found"}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {isAnyFilterActive ? (
                        <button
                          onClick={handleClearFilters}
                          className="text-teal-400 hover:underline font-bold"
                        >
                          Clear filters and show all bills
                        </button>
                      ) : (
                        "Completed sales bills from the counter will appear here"
                      )}
                    </p>
                  </td>
                </tr>
              ) : (
                sortedBills.map(bill => {
                  const isVoid = bill.status === 'void';
                  const dateStr = new Date(bill.dateTime).toLocaleDateString('en-IN');
                  const timeStr = new Date(bill.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                  const totalItemsQty = (bill.items || []).reduce((acc, curr) => acc + curr.qty, 0);
                  const isExpanded = expandedBillNos.has(bill.billNo);
                  const matchedItems = getMatchingItemsInBill(bill);
                  const hasMatchedItem = matchedItems.length > 0;

                  return (
                    <React.Fragment key={bill.billNo}>
                      {/* Main Bill Row */}
                      <tr 
                        className={`hover:bg-slate-800/50 transition cursor-pointer ${
                          isVoid ? 'opacity-50 bg-rose-950/10' : 
                          hasMatchedItem ? 'bg-teal-950/20 border-l-2 border-teal-500' : ''
                        }`}
                        onClick={() => toggleRowExpansion(bill.billNo)}
                      >
                        {/* Expand / Collapse Chevron Button */}
                        <td className="py-3 px-3 text-center" onClick={(e) => { e.stopPropagation(); toggleRowExpansion(bill.billNo); }}>
                          <button 
                            className={`p-1 rounded-lg transition ${
                              isExpanded ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                            title={isExpanded ? "Hide items in bill" : "View items in bill"}
                          >
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>

                        {/* Bill No */}
                        <td className="py-3 px-3 font-mono font-bold text-teal-400">
                          <div className="flex items-center gap-1.5">
                            <span>{bill.billNo}</span>
                          </div>
                          {bill.isEdited && (
                            <span className="text-[9px] font-bold text-amber-300/90 uppercase tracking-wider block">
                              • Edited
                            </span>
                          )}
                        </td>

                        {/* Date & Time */}
                        <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                          <div>{dateStr}</div>
                          <div className="text-[10px] text-slate-500">{timeStr}</div>
                        </td>

                        {/* Customer Details */}
                        <td className="py-3 px-3 text-slate-300">
                          {bill.customerName ? (
                            <div>
                              <div className="font-semibold text-white">{bill.customerName}</div>
                              <div className="text-[10px] text-slate-400">{bill.customerPhone}</div>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Walk-in Customer</span>
                          )}
                        </td>

                        {/* Items Summary Column with Matched Item Badges */}
                        <td className="py-3 px-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-200">
                                {totalItemsQty} {totalItemsQty === 1 ? 'unit' : 'units'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({bill.items ? bill.items.length : 0} {bill.items && bill.items.length === 1 ? 'variety' : 'varieties'})
                              </span>
                            </div>

                            {/* If an item matched the search, display matched item highlight pill */}
                            {hasMatchedItem && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {matchedItems.map((mItem, mIdx) => (
                                  <span 
                                    key={mIdx}
                                    className="bg-teal-950 text-teal-300 border border-teal-500/70 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-sm"
                                  >
                                    <Sparkles className="w-2.5 h-2.5 text-teal-400" />
                                    <span>{mItem.name} {mItem.weight ? `(${mItem.weight})` : ''}</span>
                                    <span className="text-teal-200 font-mono">x{mItem.qty}</span>
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* If no specific match, preview first 2 item names */}
                            {!hasMatchedItem && bill.items && bill.items.length > 0 && (
                              <div className="text-[10px] text-slate-400 truncate max-w-xs">
                                {bill.items.slice(0, 2).map(i => `${i.name} (${i.qty})`).join(', ')}
                                {bill.items.length > 2 ? ` +${bill.items.length - 2} more` : ''}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Payment Mode */}
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            bill.paymentMode === 'UPI' ? 'bg-teal-950 text-teal-400 border border-teal-800' :
                            bill.paymentMode === 'Card' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                            'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {bill.paymentMode}
                          </span>
                        </td>

                        {/* Grand Total */}
                        <td className="py-3 px-3 text-right font-extrabold text-sm text-emerald-400 whitespace-nowrap">
                          ₹{bill.grandTotal}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          {isVoid ? (
                            <span className="badge-red">VOIDED</span>
                          ) : bill.isEdited ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="badge-green">ACTIVE</span>
                              <span className="bg-amber-950 text-amber-300 border border-amber-700/60 px-1.5 py-0.2 rounded text-[9px] font-bold">
                                EDITED
                              </span>
                            </div>
                          ) : (
                            <span className="badge-green">ACTIVE</span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedBill(bill)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                              title="View Full Bill Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {!isVoid && (
                              <button
                                onClick={() => setEditingBill(bill)}
                                className="p-1.5 bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-700/50 rounded-lg transition"
                                title="Edit Mistyped Bill"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                            )}
                            
                            <button
                              onClick={() => handleDownloadPDF(bill)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-teal-400 rounded-lg transition"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => sendWhatsAppBill(bill, stallInfo)}
                              className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-800/60 rounded-lg transition"
                              title="Send via WhatsApp"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => setShowPrintModal(bill)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg transition"
                              title="Print Thermal Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {!isVoid && (
                              <button
                                onClick={() => setVoidConfirmBill(bill)}
                                className="p-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-400 rounded-lg transition"
                                title="Void Bill (Restores Stock)"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expandable In-Line Item List Drawer for this Bill */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-b border-slate-800">
                          <td colSpan={9} className="p-4">
                            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-3">
                              
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-teal-400" />
                                  <span className="font-bold text-white text-xs">
                                    Line Items Inside Bill #{bill.billNo}
                                  </span>
                                  <span className="text-slate-400 text-[11px]">
                                    ({bill.items ? bill.items.length : 0} distinct items • {totalItemsQty} total units)
                                  </span>
                                </div>
                                <span className="text-xs text-slate-400">
                                  Click any item to search all bills with that item
                                </span>
                              </div>

                              {/* Items Table inside Drawer */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead className="text-slate-400 font-semibold border-b border-slate-800 pb-1">
                                    <tr>
                                      <th className="pb-1.5">#</th>
                                      <th className="pb-1.5">Item Name & Brand</th>
                                      <th className="pb-1.5">Weight / Pack</th>
                                      <th className="pb-1.5 text-center">Qty Sold</th>
                                      <th className="pb-1.5 text-right">Unit Rate (₹)</th>
                                      <th className="pb-1.5 text-right">Line Amount (₹)</th>
                                      <th className="pb-1.5 text-center">Quick Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60">
                                    {(bill.items || []).map((item, idx) => {
                                      const isMatched = isLineItemMatch(item, searchQuery.toLowerCase().trim(), selectedProductFilter);

                                      return (
                                        <tr 
                                          key={idx} 
                                          className={`hover:bg-slate-800/40 transition ${
                                            isMatched ? 'bg-teal-950/40 text-teal-200 font-semibold' : 'text-slate-300'
                                          }`}
                                        >
                                          <td className="py-2 font-mono text-slate-500">{idx + 1}</td>
                                          <td className="py-2">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-bold text-white">{item.name}</span>
                                              {item.brand && (
                                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-teal-400 border border-slate-700">
                                                  {item.brand}
                                                </span>
                                              )}
                                              {isMatched && (
                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-teal-600 text-white font-bold animate-pulse">
                                                  MATCHED ITEM
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 text-slate-400 font-mono">{item.weight || '-'}</td>
                                          <td className="py-2 text-center font-extrabold text-white">
                                            <span className="px-2 py-0.5 bg-slate-800 rounded font-mono text-xs">
                                              x{item.qty}
                                            </span>
                                          </td>
                                          <td className="py-2 text-right text-slate-400 font-mono">₹{item.rate}</td>
                                          <td className="py-2 text-right font-extrabold text-emerald-400 font-mono">
                                            ₹{item.amount || (item.qty * item.rate)}
                                          </td>
                                          <td className="py-2 text-center">
                                            <button
                                              onClick={() => handleQuickFilterByItem(item.name)}
                                              className="px-2 py-0.5 bg-slate-800 hover:bg-teal-900 text-teal-400 hover:text-teal-200 rounded text-[10px] font-bold border border-slate-700 transition"
                                              title={`Find all bills containing ${item.name}`}
                                            >
                                              Find in all bills 🔍
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Detail Full Modal */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Bill Detail #{selectedBill.billNo}
                  {selectedBill.status === 'void' ? (
                    <span className="badge-red">VOIDED</span>
                  ) : selectedBill.isEdited ? (
                    <span className="bg-amber-950 text-amber-300 border border-amber-700/60 px-2 py-0.5 rounded text-[10px] font-bold">
                      EDITED
                    </span>
                  ) : null}
                </h3>
                <div className="text-xs text-slate-400">
                  {new Date(selectedBill.dateTime).toLocaleString('en-IN')}
                  {selectedBill.editedAt && (
                    <span className="text-amber-400/80 ml-2">
                      (Last edited: {new Date(selectedBill.editedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedBill(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Customer Details info */}
            {selectedBill.customerName || selectedBill.customerPhone ? (
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 text-xs flex justify-between">
                <div>
                  <span className="text-slate-400">Customer: </span>
                  <strong className="text-white">{selectedBill.customerName || 'Walk-in'}</strong>
                </div>
                {selectedBill.customerPhone && (
                  <div>
                    <span className="text-slate-400">Phone: </span>
                    <strong className="text-teal-400 font-mono">{selectedBill.customerPhone}</strong>
                  </div>
                )}
              </div>
            ) : null}

            {/* Optional Audit Reason Note if edited */}
            {selectedBill.editReason && (
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-2.5 text-xs text-amber-300 flex items-start gap-1.5">
                <Edit3 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-400" />
                <div>
                  <span className="font-bold text-amber-200">Edit Note: </span>
                  <span>{selectedBill.editReason}</span>
                </div>
              </div>
            )}

            {/* Item Table */}
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 font-semibold border-b border-slate-800 pb-1">
                  <tr>
                    <th className="pb-2">Item</th>
                    <th className="pb-2 text-center">Qty</th>
                    <th className="pb-2 text-right">Rate</th>
                    <th className="pb-2 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900">
                  {selectedBill.items.map((item, i) => (
                    <tr key={i} className="text-slate-200">
                      <td className="py-2 pr-2">
                        <div className="font-bold">{item.name}</div>
                        <div className="text-[10px] text-slate-400">{item.weight}</div>
                      </td>
                      <td className="py-2 text-center font-bold">{item.qty}</td>
                      <td className="py-2 text-right text-slate-400">₹{item.rate}</td>
                      <td className="py-2 text-right font-bold text-emerald-400">₹{item.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations */}
            <div className="space-y-1 text-xs pt-2 border-t border-slate-800">
              <div className="flex justify-between text-slate-400">
                <span>Payment Mode:</span>
                <span className="text-slate-200 font-semibold">{selectedBill.paymentMode}</span>
              </div>
              {selectedBill.discount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Discount / Rounding:</span>
                  <span>-₹{selectedBill.discount}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-extrabold text-white">
                <span>Grand Total:</span>
                <span className="text-emerald-400">₹{selectedBill.grandTotal}</span>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-3 flex flex-col gap-2">
              {selectedBill.status !== 'void' && (
                <button
                  onClick={() => setEditingBill(selectedBill)}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow border border-amber-400/40 transition"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Mistyped Bill (Change Qty, Rate, Items, Mode)
                </button>
              )}

              <button
                onClick={() => shareBillPDFToCustomer(selectedBill, stallInfo)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow border border-emerald-400/30"
              >
                <Share2 className="w-4 h-4 text-emerald-200" />
                Share PDF Receipt to Customer {selectedBill.customerPhone ? `(${selectedBill.customerPhone})` : ''}
              </button>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => sendWhatsAppBill(selectedBill, stallInfo)}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-[11px] rounded-xl flex items-center justify-center gap-1 border border-slate-700 transition"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
                <button
                  onClick={() => handleDownloadPDF(selectedBill)}
                  className="py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-400 font-semibold text-[11px] rounded-xl flex items-center justify-center gap-1 border border-slate-700"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  onClick={() => setShowPrintModal(selectedBill)}
                  className="py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-[11px] rounded-xl flex items-center justify-center gap-1 shadow"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
              </div>

              {selectedBill.status !== 'void' && (
                <button
                  onClick={() => setVoidConfirmBill(selectedBill)}
                  className="w-full py-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition"
                >
                  <Ban className="w-4 h-4" />
                  Void Bill & Restore Stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Bill Modal */}
      {editingBill && (
        <EditBillModal
          bill={editingBill}
          products={products}
          onSave={handleSaveEditedBill}
          onClose={() => setEditingBill(null)}
          stallInfo={stallInfo}
        />
      )}

      {/* Thermal Printable Modal */}
      {showPrintModal && (
        <PrintReceiptModal
          bill={showPrintModal}
          stallInfo={stallInfo}
          onClose={() => setShowPrintModal(null)}
        />
      )}

      {/* Confirmation Void Modal */}
      {voidConfirmBill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-rose-950 text-rose-400 rounded-xl flex items-center justify-center mx-auto border border-rose-800">
              <AlertOctagon className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-white mb-1">
                Void Bill #{voidConfirmBill.billNo}?
              </h3>
              <p className="text-xs text-slate-300">
                This action will mark the bill as VOID and <strong>automatically return all sold items ({voidConfirmBill.items.reduce((a,c)=>a+c.qty,0)} units) back to live inventory stock</strong>.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setVoidConfirmBill(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow transition"
              >
                Confirm & Void Sale
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
