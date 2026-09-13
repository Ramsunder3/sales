import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, ShoppingBag, Search, Download, 
  ArrowUpDown, ChevronRight, Eye, Clock,
  Layers, BarChart3, Radio, Flame, PackageCheck 
} from 'lucide-react';
import { 
  analyzeItemSales, 
  getLiveItemSalesFeed, 
  getItemSalesSummaryStats,
  formatTimeAgo 
} from '../utils/itemSalesAnalyzer';
import { CATEGORIES } from '../data/seedData';
import { exportItemSalesCSV } from '../utils/exportUtils';
import ItemSalesDetailModal from './ItemSalesDetailModal';

export default function ItemSalesScreen({ products = [], bills = [], stallInfo, onNavigateToHistoryWithItem }) {
  const [dateRange, setDateRange] = useState('all'); // 'all', 'today', 'yesterday'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [salesStatusFilter, setSalesStatusFilter] = useState('all'); // 'all', 'sold', 'fast', 'low_stock', 'out_of_stock', 'unsold'
  const [sortBy, setSortBy] = useState('qty_desc'); // 'qty_desc', 'revenue_desc', 'orders_desc', 'recent', 'stock_asc', 'name_asc'
  const [viewMode, setViewMode] = useState('table'); // 'table', 'grid', 'feed'
  const [selectedItemForModal, setSelectedItemForModal] = useState(null);

  // Analyze previous bills to produce item-by-item live sales data
  const { items: analyzedItems, totalBillsAnalyzed } = useMemo(() => {
    return analyzeItemSales(bills, products, {
      dateRange,
      searchQuery,
      selectedCategory,
      salesStatusFilter,
      sortBy
    });
  }, [bills, products, dateRange, searchQuery, selectedCategory, salesStatusFilter, sortBy]);

  // Overall summary statistics
  const summaryStats = useMemo(() => {
    return getItemSalesSummaryStats(analyzedItems, totalBillsAnalyzed);
  }, [analyzedItems, totalBillsAnalyzed]);

  // Live item sales chronological feed (from all previous bills)
  const liveSalesFeed = useMemo(() => {
    return getLiveItemSalesFeed(bills, 50);
  }, [bills]);

  // Export CSV handler
  const handleExportCSV = () => {
    const rangeLabel = dateRange === 'today' ? 'Today' : dateRange === 'yesterday' ? 'Yesterday' : 'All_Time';
    exportItemSalesCSV(analyzedItems, rangeLabel);
  };

  return (
    <div className="space-y-6">
      
      {/* TOP HEADER & CONTROLS */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4 border-teal-500/30">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Live Item Sales Analyzer
                </h2>
                <span className="flex items-center gap-1 bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-time sold quantity, revenue, and transaction logs computed directly from customer bills.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Date Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700">
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setDateRange(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  dateRange === filter.id 
                    ? 'bg-teal-600 text-white shadow' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1.5 transition shadow"
          >
            <Download className="w-4 h-4 text-teal-400" />
            Export Report (.CSV)
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Units Sold */}
        <div className="glass-panel-glow p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-1">
              Total Units Sold
            </div>
            <div className="text-3xl font-black text-white font-heading">
              {summaryStats.totalUnitsSold.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-teal-200/80 mt-1">
              From {totalBillsAnalyzed} customer bills
            </div>
          </div>
          <div className="p-3.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Total Item Revenue */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">
              Item Sales Revenue
            </div>
            <div className="text-3xl font-black text-emerald-300 font-heading">
              ₹{summaryStats.totalRevenue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Average ₹{totalBillsAnalyzed > 0 ? Math.round(summaryStats.totalRevenue / totalBillsAnalyzed) : 0} per bill
            </div>
          </div>
          <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Active Products Sold */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1">
              Products Sold
            </div>
            <div className="text-3xl font-black text-white font-heading">
              {summaryStats.productsWithSalesCount} <span className="text-sm font-semibold text-slate-400">/ {summaryStats.totalProducts}</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {summaryStats.unsoldProductsCount} items with 0 sales
            </div>
          </div>
          <div className="p-3.5 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
            <PackageCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Top Product Hero */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-amber-500/30">
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              #1 Stall Top Seller
            </div>
            {summaryStats.topSellingByQty.length > 0 ? (
              <>
                <div className="text-base font-extrabold text-white truncate max-w-[180px]">
                  {summaryStats.topSellingByQty[0].name}
                </div>
                <div className="text-xs font-bold text-amber-300 mt-0.5">
                  🔥 {summaryStats.topSellingByQty[0].totalSoldQty} sold • ₹{summaryStats.topSellingByQty[0].totalRevenue}
                </div>
              </>
            ) : (
              <div className="text-sm font-medium text-slate-400">No sales recorded yet</div>
            )}
          </div>
          <div className="p-3.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <Flame className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTER & VIEW TOGGLE TOOLBAR */}
      <div className="glass-panel p-4 space-y-4">
        
        {/* Search and Sort row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by product name, brand, weight, bill no..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-semibold"
            >
              <option value="qty_desc">🔥 Most Units Sold (High to Low)</option>
              <option value="revenue_desc">💰 Highest Revenue (₹)</option>
              <option value="orders_desc">📋 Most Frequent in Bills</option>
              <option value="recent">⏱️ Recently Sold</option>
              <option value="stock_asc">⚠️ Lowest Stock Remaining</option>
              <option value="name_asc">🔤 Product Name (A to Z)</option>
            </select>
          </div>

          {/* View Mode Toggle Buttons */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                viewMode === 'table' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                viewMode === 'grid' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('feed')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition ${
                viewMode === 'feed' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <span>Live Stream</span>
            </button>
          </div>
        </div>

        {/* Status Filters & Categories */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {[
              { id: 'all', label: 'All Items' },
              { id: 'sold', label: `Sold Items (${summaryStats.productsWithSalesCount})` },
              { id: 'fast', label: `🔥 Fast Movers (${summaryStats.fastMovingCount})` },
              { id: 'low_stock', label: `⚠️ Low Stock (${summaryStats.lowStockCount})` },
              { id: 'out_of_stock', label: `❌ Out of Stock (${summaryStats.outOfStockCount})` },
              { id: 'unsold', label: `Unsold (${summaryStats.unsoldProductsCount})` }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSalesStatusFilter(f.id)}
                className={`px-3 py-1 rounded-lg font-semibold whitespace-nowrap transition ${
                  salesStatusFilter === f.id 
                    ? 'bg-slate-700 text-white border border-slate-500' 
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category Dropdown/Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {CATEGORIES.slice(0, 6).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-teal-900/60 text-teal-300 border border-teal-500/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
            {CATEGORIES.length > 6 && (
              <select
                value={CATEGORIES.slice(0, 6).includes(selectedCategory) ? '' : selectedCategory}
                onChange={(e) => e.target.value && setSelectedCategory(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none"
              >
                <option value="">More Brands...</option>
                {CATEGORIES.slice(6).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
        </div>

      </div>

      {/* MAIN VIEW CONTENT */}

      {/* 1. TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-300 font-bold uppercase border-b border-slate-700">
                <tr>
                  <th className="py-3 px-3">#</th>
                  <th className="py-3 px-3">Product Name & Weight</th>
                  <th className="py-3 px-3">Brand</th>
                  <th className="py-3 px-3 text-center">MRP (₹)</th>
                  <th className="py-3 px-3 text-center">Units Sold</th>
                  <th className="py-3 px-3 text-right">Total Revenue</th>
                  <th className="py-3 px-3 text-center">Bills Count</th>
                  <th className="py-3 px-3">Payment Split</th>
                  <th className="py-3 px-3">Last Sold Time</th>
                  <th className="py-3 px-3 text-center">Stock Left</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {analyzedItems.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30 text-slate-400" />
                      <p className="text-sm font-semibold text-slate-400">No items matching criteria</p>
                      <p className="text-xs text-slate-500 mt-1">Try changing filters or search query</p>
                    </td>
                  </tr>
                ) : (
                  analyzedItems.map((item, idx) => {
                    const isSold = item.totalSoldQty > 0;
                    const isTop3 = idx < 3 && isSold && sortBy === 'qty_desc';

                    return (
                      <tr 
                        key={item.id}
                        className="hover:bg-slate-800/50 transition cursor-pointer"
                        onClick={() => setSelectedItemForModal(item)}
                      >
                        {/* Sr No */}
                        <td className="py-3 px-3 font-mono">
                          {isTop3 ? (
                            <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center font-black text-[10px] ${
                              idx === 0 ? 'bg-amber-500 text-slate-950 font-bold' :
                              idx === 1 ? 'bg-slate-300 text-slate-950 font-bold' :
                              'bg-amber-700 text-white font-bold'
                            }`}>
                              {idx + 1}
                            </span>
                          ) : (
                            <span className="text-slate-500">{item.srNo || idx + 1}</span>
                          )}
                        </td>

                        {/* Product Name */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{item.name}</span>
                            {item.salesStatus === 'fast_selling' && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 font-bold border border-amber-800">
                                🔥 FAST
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400">{item.weight}</div>
                        </td>

                        {/* Brand */}
                        <td className="py-3 px-3 text-teal-400 font-semibold">
                          {item.brand}
                        </td>

                        {/* MRP */}
                        <td className="py-3 px-3 text-center font-bold text-slate-300">
                          ₹{item.mrp}
                        </td>

                        {/* Units Sold (Live) */}
                        <td className="py-3 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${
                              item.totalSoldQty > 0 
                                ? 'bg-teal-950 text-teal-300 border border-teal-700/80 shadow-sm shadow-teal-900/50' 
                                : 'bg-slate-900 text-slate-500 border border-slate-800'
                            }`}>
                              {item.totalSoldQty} Sold
                            </span>
                            {item.effectiveOpening > 0 && item.totalSoldQty > 0 && (
                              <div className="w-16 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    item.depletionPercent >= 75 ? 'bg-rose-500' :
                                    item.depletionPercent >= 40 ? 'bg-amber-500' : 'bg-teal-500'
                                  }`}
                                  style={{ width: `${item.depletionPercent}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Total Revenue */}
                        <td className="py-3 px-3 text-right font-extrabold text-emerald-400">
                          ₹{item.totalRevenue.toLocaleString('en-IN')}
                        </td>

                        {/* Bills Count */}
                        <td className="py-3 px-3 text-center text-slate-300 font-medium">
                          {item.billCount > 0 ? (
                            <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                              {item.billCount} bills
                            </span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>

                        {/* Payment Split */}
                        <td className="py-3 px-3">
                          {item.totalSoldQty > 0 ? (
                            <div className="flex items-center gap-1 text-[10px]">
                              {item.paymentSplit?.Cash?.qty > 0 && (
                                <span className="bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded font-mono" title={`Cash: ₹${item.paymentSplit.Cash.amount}`}>
                                  Cash:{item.paymentSplit.Cash.qty}
                                </span>
                              )}
                              {item.paymentSplit?.UPI?.qty > 0 && (
                                <span className="bg-teal-950/70 text-teal-400 border border-teal-800/60 px-1.5 py-0.5 rounded font-mono" title={`UPI: ₹${item.paymentSplit.UPI.amount}`}>
                                  UPI:{item.paymentSplit.UPI.qty}
                                </span>
                              )}
                              {item.paymentSplit?.Card?.qty > 0 && (
                                <span className="bg-amber-950/70 text-amber-400 border border-amber-800/60 px-1.5 py-0.5 rounded font-mono" title={`Card: ₹${item.paymentSplit.Card.amount}`}>
                                  Card:{item.paymentSplit.Card.qty}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">-</span>
                          )}
                        </td>

                        {/* Last Sold Time */}
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {item.lastSoldDateTime ? (
                            <div>
                              <div className="text-slate-200 font-medium">{formatTimeAgo(item.lastSoldDateTime)}</div>
                              <div className="text-[10px] text-teal-400 font-mono">{item.lastSoldBillNo}</div>
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">No sales</span>
                          )}
                        </td>

                        {/* Stock Left */}
                        <td className="py-3 px-3 text-center">
                          <span className={`font-bold ${
                            item.currentStock <= 0 ? 'text-rose-400 font-black' :
                            item.currentStock <= 5 ? 'text-amber-400 font-black' : 'text-slate-300'
                          }`}>
                            {item.currentStock}
                          </span>
                        </td>

                        {/* Action: Inspect Modal */}
                        <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedItemForModal(item)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 hover:text-teal-200 rounded-lg text-xs font-bold border border-slate-700 transition inline-flex items-center gap-1 shadow-sm"
                          >
                            <Eye className="w-3.5 h-3.5 text-teal-400" />
                            <span>Bills ({item.billCount})</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. CARD GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {analyzedItems.length === 0 ? (
            <div className="col-span-full glass-panel p-12 text-center text-slate-500">
              <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-base font-semibold text-slate-400">No products matching filters</p>
            </div>
          ) : (
            analyzedItems.map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedItemForModal(item)}
                className="bg-slate-900/90 border border-slate-800 hover:border-teal-500/60 rounded-2xl p-4 transition-all duration-200 hover:shadow-xl hover:shadow-teal-950/30 cursor-pointer flex flex-col justify-between space-y-3 relative group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/80">
                      {item.brand}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {item.weight}
                    </span>
                  </div>

                  <h3 className="font-bold text-white text-sm mt-2 line-clamp-2">
                    {item.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    MRP: <strong className="text-emerald-400">₹{item.mrp}</strong>
                  </div>
                </div>

                {/* Units Sold & Revenue Box */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Units Sold</span>
                    <span className="font-black text-white text-sm">
                      {item.totalSoldQty} <span className="text-[10px] font-normal text-slate-500">/ {item.effectiveOpening}</span>
                    </span>
                  </div>

                  {/* Stock depletion bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        item.depletionPercent >= 75 ? 'bg-rose-500' :
                        item.depletionPercent >= 40 ? 'bg-amber-500' : 'bg-teal-500'
                      }`}
                      style={{ width: `${item.depletionPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/50">
                    <span className="text-slate-400 font-medium">Revenue</span>
                    <span className="font-extrabold text-emerald-400">₹{item.totalRevenue}</span>
                  </div>
                </div>

                {/* Footer stats & Inspect */}
                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                  <div>
                    Stock Left: <strong className={item.currentStock <= 0 ? 'text-rose-400' : item.currentStock <= 5 ? 'text-amber-400' : 'text-white'}>
                      {item.currentStock}
                    </strong>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItemForModal(item);
                    }}
                    className="text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 text-xs"
                  >
                    <span>{item.billCount} Bills</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. LIVE SALES STREAM VIEW */}
      {viewMode === 'feed' && (
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-rose-500 animate-pulse" />
              <h3 className="text-base font-bold text-white">Live Transactions Item Stream</h3>
            </div>
            <span className="text-xs text-slate-400">Chronological feed from completed customer bills</span>
          </div>

          <div className="space-y-2.5">
            {liveSalesFeed.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="font-semibold text-slate-400">No item sales recorded yet</p>
                <p className="text-xs text-slate-500 mt-0.5">As items are sold at the billing counter, they will flow here live.</p>
              </div>
            ) : (
              liveSalesFeed.map(feedItem => (
                <div 
                  key={feedItem.id}
                  className="bg-slate-900/80 border border-slate-800 hover:border-teal-500/50 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                      x{feedItem.qty}
                    </div>
                    <div>
                      <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-2">
                        <span>{feedItem.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({feedItem.weight})</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="text-teal-400 font-semibold">{feedItem.brand}</span>
                        <span>•</span>
                        <span className="text-slate-300 font-mono font-bold">{feedItem.billNo}</span>
                        <span>•</span>
                        <span>{feedItem.customerName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-4">
                    <div>
                      <div className="text-sm font-extrabold text-emerald-400 font-heading">
                        ₹{feedItem.amount}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {feedItem.qty} × ₹{feedItem.rate} ({feedItem.paymentMode})
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono">
                      {formatTimeAgo(feedItem.dateTime)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* DETAIL MODAL INSPECTOR */}
      {selectedItemForModal && (
        <ItemSalesDetailModal
          item={selectedItemForModal}
          stallInfo={stallInfo}
          allBills={bills}
          onClose={() => setSelectedItemForModal(null)}
          onNavigateToHistory={onNavigateToHistoryWithItem}
        />
      )}

    </div>
  );
}
