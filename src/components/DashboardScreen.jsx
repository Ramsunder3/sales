import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, ShoppingBag, Receipt, AlertTriangle, Search, 
  Banknote, QrCode, CreditCard, Award, ArrowRight, Calendar,
  CalendarDays, BarChart3, Clock, Sparkles, Filter, ChevronRight,
  Layers, ArrowUpRight, Flame, Percent, CheckCircle2, ArrowUpDown
} from 'lucide-react';
import { findMatchingProduct } from '../utils/itemSalesAnalyzer';

export default function DashboardScreen({ 
  products = [], 
  bills = [], 
  onNavigateToItemSales, 
  onNavigateToHistoryWithItem,
  onNavigateToHistoryWithDate
}) {
  const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low', 'out'
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // 'all', 'today', 'yesterday', or custom dateKey

  // Daily Sales Table & View Controls
  const [dailyViewMode, setDailyViewMode] = useState('cards'); // 'cards' | 'table'
  const [dailySortBy, setDailySortBy] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'revenue_desc' | 'bills_desc'
  const [dailySearch, setDailySearch] = useState('');

  // Daily Sales Aggregation of ALL active bills across all recorded days
  const dailySalesSummary = useMemo(() => {
    const dayMap = {};
    let allTimeTotalRevenue = 0;
    let allTimeTotalBills = 0;
    let allTimeUnitsSold = 0;
    
    // Group active (non-void) bills by calendar date
    bills.forEach(b => {
      if (b.status === 'void') return;
      const dateObj = new Date(b.dateTime);
      if (isNaN(dateObj.getTime())) return;

      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`; // ISO format YYYY-MM-DD for reliable sorting
      
      const billTotal = b.grandTotal || 0;
      allTimeTotalRevenue += billTotal;
      allTimeTotalBills += 1;

      if (!dayMap[dateKey]) {
        dayMap[dateKey] = {
          dateKey,
          dateObj,
          rawDateStr: dateObj.toDateString(),
          displayDate: dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
          dayOfWeek: dateObj.toLocaleDateString('en-IN', { weekday: 'long' }),
          shortDate: dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          revenue: 0,
          billsCount: 0,
          unitsSold: 0,
          cashTotal: 0,
          upiTotal: 0,
          cardTotal: 0,
          itemsBreakdown: {}
        };
      }

      dayMap[dateKey].revenue += billTotal;
      dayMap[dateKey].billsCount += 1;

      const mode = b.paymentMode || 'Cash';
      if (mode === 'Cash') dayMap[dateKey].cashTotal += billTotal;
      else if (mode === 'UPI') dayMap[dateKey].upiTotal += billTotal;
      else if (mode === 'Card') dayMap[dateKey].cardTotal += billTotal;
      else dayMap[dateKey].cashTotal += billTotal;

      if (Array.isArray(b.items)) {
        b.items.forEach(item => {
          const qty = parseInt(item.qty, 10) || 0;
          allTimeUnitsSold += qty;
          dayMap[dateKey].unitsSold += qty;
          const key = `${item.name} (${item.weight})`;
          if (!dayMap[dateKey].itemsBreakdown[key]) {
            dayMap[dateKey].itemsBreakdown[key] = {
              name: item.name,
              weight: item.weight,
              qty: 0,
              amount: 0
            };
          }
          dayMap[dateKey].itemsBreakdown[key].qty += qty;
          dayMap[dateKey].itemsBreakdown[key].amount += (item.amount || (qty * (item.rate || 0)));
        });
      }
    });

    const todayDateStr = new Date().toDateString();
    const yesterdayDateStr = new Date(Date.now() - 86400000).toDateString();

    const daysList = Object.values(dayMap).map(day => {
      const topItemsList = Object.values(day.itemsBreakdown)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 3);

      return {
        ...day,
        isToday: day.rawDateStr === todayDateStr,
        isYesterday: day.rawDateStr === yesterdayDateStr,
        avgTicketValue: day.billsCount > 0 ? Math.round(day.revenue / day.billsCount) : 0,
        revenueSharePct: allTimeTotalRevenue > 0 ? Number(((day.revenue / allTimeTotalRevenue) * 100).toFixed(1)) : 0,
        topItems: topItemsList
      };
    });

    // Default sort descending by date (most recent date first)
    daysList.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    // Calculate max single day revenue for relative chart progress bars
    const maxDayRevenue = daysList.reduce((max, d) => Math.max(max, d.revenue), 0);
    const totalDaysCount = daysList.length;
    const avgDailyRevenue = totalDaysCount > 0 ? Math.round(allTimeTotalRevenue / totalDaysCount) : 0;
    const bestDay = daysList.length > 0 
      ? [...daysList].sort((a, b) => b.revenue - a.revenue)[0] 
      : null;

    // Today's summary object if available
    const todaySummary = daysList.find(d => d.isToday) || null;

    return {
      daysList,
      allTimeTotalRevenue,
      allTimeTotalBills,
      allTimeUnitsSold,
      maxDayRevenue,
      totalDaysCount,
      avgDailyRevenue,
      bestDay,
      todaySummary
    };
  }, [bills]);

  // Filtered & Sorted daily sales list
  const filteredDailySales = useMemo(() => {
    let list = [...dailySalesSummary.daysList];

    // Search filter
    if (dailySearch.trim()) {
      const q = dailySearch.toLowerCase().trim();
      list = list.filter(d => 
        d.displayDate.toLowerCase().includes(q) ||
        d.dayOfWeek.toLowerCase().includes(q) ||
        d.dateKey.includes(q) ||
        (d.isToday && 'today'.includes(q)) ||
        (d.isYesterday && 'yesterday'.includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      if (dailySortBy === 'date_desc') return b.dateKey.localeCompare(a.dateKey);
      if (dailySortBy === 'date_asc') return a.dateKey.localeCompare(b.dateKey);
      if (dailySortBy === 'revenue_desc') return b.revenue - a.revenue;
      if (dailySortBy === 'bills_desc') return b.billsCount - a.billsCount;
      return 0;
    });

    return list;
  }, [dailySalesSummary.daysList, dailySearch, dailySortBy]);

  // Active (non-voided) bills filtered by the selected date range for the rest of the dashboard
  const activeBills = useMemo(() => {
    return bills.filter(b => {
      if (b.status === 'void') return false;
      const billDateObj = new Date(b.dateTime);
      const billDate = billDateObj.toDateString();

      if (dateRangeFilter === 'today') {
        const today = new Date().toDateString();
        return billDate === today;
      }
      if (dateRangeFilter === 'yesterday') {
        const yest = new Date(Date.now() - 86400000).toDateString();
        return billDate === yest;
      }
      if (dateRangeFilter !== 'all') {
        // Specific dateKey YYYY-MM-DD
        const year = billDateObj.getFullYear();
        const month = String(billDateObj.getMonth() + 1).padStart(2, '0');
        const day = String(billDateObj.getDate()).padStart(2, '0');
        const billKey = `${year}-${month}-${day}`;
        return billKey === dateRangeFilter;
      }
      return true;
    });
  }, [bills, dateRangeFilter]);

  // Overall KPI statistics for selected filter
  const kpis = useMemo(() => {
    const totalRevenue = activeBills.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const totalBillsCount = activeBills.length;
    
    let totalItemsSold = 0;
    activeBills.forEach(b => {
      (b.items || []).forEach(item => {
        totalItemsSold += (parseInt(item.qty, 10) || 0);
      });
    });

    const lowStockCount = products.filter(p => p.currentStock > 0 && p.currentStock <= 5).length;
    const outOfStockCount = products.filter(p => p.currentStock <= 0).length;

    return {
      totalRevenue,
      totalBillsCount,
      totalItemsSold,
      lowStockCount,
      outOfStockCount
    };
  }, [activeBills, products]);

  // Payment mode summary for selected filter
  const paymentBreakdown = useMemo(() => {
    const breakdown = { Cash: 0, UPI: 0, Card: 0 };
    activeBills.forEach(b => {
      const mode = b.paymentMode || 'Cash';
      if (breakdown[mode] !== undefined) {
        breakdown[mode] += (b.grandTotal || 0);
      } else {
        breakdown.Cash += (b.grandTotal || 0);
      }
    });
    return breakdown;
  }, [activeBills]);

  // Sales per product map computed with robust matching
  const productSalesMap = useMemo(() => {
    const map = {};
    activeBills.forEach(b => {
      (b.items || []).forEach(item => {
        const matched = findMatchingProduct(products, item);
        const prodId = matched ? matched.id : item.productId;
        if (!map[prodId]) {
          map[prodId] = { qtySold: 0, amountSold: 0 };
        }
        map[prodId].qtySold += (parseInt(item.qty, 10) || 0);
        map[prodId].amountSold += (item.amount || ((parseInt(item.qty, 10) || 0) * (item.rate || 0)));
      });
    });
    return map;
  }, [activeBills, products]);

  // Top selling products list
  const topSellers = useMemo(() => {
    return products
      .map(p => ({
        ...p,
        qtySold: (productSalesMap[p.id]?.qtySold || 0) + (dateRangeFilter === 'all' || dateRangeFilter === 'yesterday' ? (p.alreadySoldYesterday || 0) : 0),
        amountSold: (productSalesMap[p.id]?.amountSold || 0) + ((dateRangeFilter === 'all' || dateRangeFilter === 'yesterday' ? (p.alreadySoldYesterday || 0) : 0) * p.mrp)
      }))
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 5);
  }, [products, productSalesMap, dateRangeFilter]);

  // Inventory Table view filtered
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesStock = 
        stockFilter === 'all' ? true :
        stockFilter === 'low' ? (p.currentStock > 0 && p.currentStock <= 5) :
        stockFilter === 'out' ? (p.currentStock <= 0) : true;
      
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q);

      return matchesStock && matchesSearch;
    });
  }, [products, stockFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Date Filter */}
      <div className="glass-panel p-5 flex flex-wrap items-center justify-between gap-4 border-teal-500/30">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            Live Counter Dashboard
          </h2>
          <p className="text-xs text-slate-400">
            Real-time daily sales revenue, day-by-day analysis, payment collections, and stock tracking.
          </p>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-xl border border-slate-700">
          {[
            { id: 'all', label: 'All Days' },
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' }
          ].map(filter => (
            <button
              key={filter.id}
              onClick={() => setDateRangeFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                dateRangeFilter === filter.id 
                  ? 'bg-teal-600 text-white shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {filter.label}
            </button>
          ))}
          {dateRangeFilter !== 'all' && dateRangeFilter !== 'today' && dateRangeFilter !== 'yesterday' && (
            <div className="flex items-center gap-1 bg-teal-900/80 text-teal-200 px-2.5 py-1 rounded-lg text-xs font-bold border border-teal-500/40">
              <span>Day: {dateRangeFilter}</span>
              <button 
                onClick={() => setDateRangeFilter('all')}
                className="hover:text-white text-slate-400 ml-1"
                title="Reset to All Days"
              >
                ×
              </button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="glass-panel-glow p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-teal-300 uppercase tracking-wider mb-1">
              {dateRangeFilter === 'today' ? "Today's Revenue" : dateRangeFilter === 'yesterday' ? "Yesterday's Revenue" : "Total Revenue"}
            </div>
            <div className="text-2xl font-extrabold text-white font-heading">
              ₹{kpis.totalRevenue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-teal-200/70 mt-1">
              From {kpis.totalBillsCount} completed bills
            </div>
          </div>
          <div className="p-3.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Items Sold */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Units Sold
            </div>
            <div className="text-2xl font-extrabold text-white font-heading">
              {kpis.totalItemsSold.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Packaged items sold
            </div>
          </div>
          <div className="p-3.5 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Total Bills */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Bills Counter
            </div>
            <div className="text-2xl font-extrabold text-white font-heading">
              {kpis.totalBillsCount}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Active customer transactions
            </div>
          </div>
          <div className="p-3.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-700">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Low Stock Alert */}
        <div className="glass-panel p-5 rounded-2xl flex items-center justify-between border-amber-500/30">
          <div>
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
              Low / Zero Stock
            </div>
            <div className="text-2xl font-extrabold text-amber-300 font-heading">
              {kpis.lowStockCount + kpis.outOfStockCount}
            </div>
            <div className="text-[11px] text-amber-400/80 mt-1">
              {kpis.outOfStockCount} out of stock, {kpis.lowStockCount} critical (&lt;5)
            </div>
          </div>
          <div className="p-3.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* NEW DEDICATED SECTION: SALES OF EACH DAY (DAILY PERFORMANCE BREAKDOWN) */}
      {/* ========================================================================= */}
      <div className="glass-panel p-5 sm:p-6 space-y-5 border-teal-500/40 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Section Top Header & Summary Stats */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl border border-teal-500/30">
                <CalendarDays className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                Sales of Each Day
                <span className="text-xs font-bold text-teal-300 bg-teal-950/90 border border-teal-800/80 px-2.5 py-0.5 rounded-full">
                  {dailySalesSummary.totalDaysCount} {dailySalesSummary.totalDaysCount === 1 ? 'Day' : 'Days'} Recorded
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Comprehensive day-by-day revenue breakdown, order volume, payment mode split, and peak sales days.
            </p>
          </div>

          {/* Quick Stats Highlights */}
          <div className="flex items-center gap-3 flex-wrap">
            {dailySalesSummary.bestDay && (
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 shadow-sm">
                <Flame className="w-4 h-4 text-amber-400" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">Best Sales Day</span>
                  <span className="font-extrabold text-amber-300">
                    {dailySalesSummary.bestDay.shortDate}: ₹{dailySalesSummary.bestDay.revenue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            {dailySalesSummary.totalDaysCount > 0 && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-1.5 text-xs flex items-center gap-2 shadow-sm">
                <BarChart3 className="w-4 h-4 text-teal-400" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none">Daily Average</span>
                  <span className="font-extrabold text-white">
                    ₹{dailySalesSummary.avgDailyRevenue.toLocaleString('en-IN')}/day
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls Toolbar: Search, Sort & View Mode */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search day (e.g. Tuesday, 25 Aug)..."
                value={dailySearch}
                onChange={(e) => setDailySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
              />
              {dailySearch && (
                <button
                  onClick={() => setDailySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Sort Selector */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
              <ArrowUpDown className="w-3 h-3 text-teal-400" />
              <select
                value={dailySortBy}
                onChange={(e) => setDailySortBy(e.target.value)}
                className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value="date_desc" className="bg-slate-900">Latest Date First</option>
                <option value="date_asc" className="bg-slate-900">Oldest Date First</option>
                <option value="revenue_desc" className="bg-slate-900">Highest Sales First</option>
                <option value="bills_desc" className="bg-slate-900">Most Bills First</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setDailyViewMode('cards')}
                className={`px-2.5 py-1 rounded-md transition ${
                  dailyViewMode === 'cards' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Cards View
              </button>
              <button
                onClick={() => setDailyViewMode('table')}
                className={`px-2.5 py-1 rounded-md transition ${
                  dailyViewMode === 'table' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Table View
              </button>
            </div>
          </div>
        </div>

        {/* Empty State if No Days with Sales */}
        {filteredDailySales.length === 0 ? (
          <div className="text-center py-10 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 space-y-2">
            <Calendar className="w-8 h-8 text-slate-500 mx-auto" />
            <div className="text-sm font-bold text-slate-300">
              {dailySearch ? 'No matching sales days found' : 'No daily sales recorded yet'}
            </div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {dailySearch 
                ? `No sales records matched "${dailySearch}". Try clearing your search.` 
                : 'As customer bills are generated at the billing counter, each day\'s revenue, bill volume, and payment breakdowns will automatically appear here.'}
            </p>
            {dailySearch && (
              <button
                onClick={() => setDailySearch('')}
                className="mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-teal-300 rounded-lg transition"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : dailyViewMode === 'cards' ? (
          /* ================= CARDS VIEW ================= */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDailySales.map((day) => {
              const isSelectedDay = dateRangeFilter === day.dateKey || (dateRangeFilter === 'today' && day.isToday) || (dateRangeFilter === 'yesterday' && day.isYesterday);
              const relativeBarWidth = dailySalesSummary.maxDayRevenue > 0 ? Math.max(8, Math.round((day.revenue / dailySalesSummary.maxDayRevenue) * 100)) : 0;

              return (
                <div
                  key={day.dateKey}
                  className={`bg-slate-900/90 rounded-2xl p-4 border transition-all space-y-3.5 relative overflow-hidden flex flex-col justify-between ${
                    isSelectedDay 
                      ? 'border-teal-400 ring-1 ring-teal-400/40 shadow-lg shadow-teal-950/60' 
                      : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  {/* Top Day Header */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {day.isToday ? (
                          <span className="bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                            Today
                          </span>
                        ) : day.isYesterday ? (
                          <span className="bg-teal-950 text-teal-300 border border-teal-500/50 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Yesterday
                          </span>
                        ) : (
                          <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {day.dayOfWeek}
                          </span>
                        )}
                        <span className="text-xs font-bold text-white">
                          {day.displayDate}
                        </span>
                      </div>

                      {/* Revenue Share Badge */}
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                        {day.revenueSharePct}% of total
                      </span>
                    </div>

                    {/* Revenue Display */}
                    <div className="flex items-baseline justify-between pt-1">
                      <div>
                        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Total Sales</div>
                        <div className="text-2xl font-black text-emerald-400 font-heading">
                          ₹{day.revenue.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-extrabold text-white">{day.billsCount} Bills</div>
                        <div className="text-[11px] text-slate-400">{day.unitsSold} Units Sold</div>
                      </div>
                    </div>

                    {/* Relative Revenue Comparison Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div 
                          className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 rounded-full transition-all duration-700"
                          style={{ width: `${relativeBarWidth}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Avg ₹{day.avgTicketValue}/bill</span>
                        <span>{relativeBarWidth}% vs Peak Day</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Breakdown & Top Item */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                    {/* Payment Mode Pills */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">Cash</span>
                        <span className="text-[11px] font-bold text-emerald-300">₹{day.cashTotal}</span>
                      </div>
                      <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">UPI</span>
                        <span className="text-[11px] font-bold text-teal-300">₹{day.upiTotal}</span>
                      </div>
                      <div className="bg-slate-950/80 p-1.5 rounded-lg border border-slate-800/60">
                        <span className="text-[10px] text-slate-400 block">Card</span>
                        <span className="text-[11px] font-bold text-amber-300">₹{day.cardTotal}</span>
                      </div>
                    </div>

                    {/* Top seller of the day */}
                    {day.topItems && day.topItems.length > 0 && (
                      <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="text-[11px] text-slate-300 truncate">
                            {day.topItems[0].name}
                          </span>
                        </div>
                        <span className="text-[11px] font-extrabold text-teal-300 shrink-0 ml-1">
                          {day.topItems[0].qty} sold
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setDateRangeFilter(day.isToday ? 'today' : day.isYesterday ? 'yesterday' : day.dateKey)}
                        className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                          isSelectedDay
                            ? 'bg-teal-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        <Filter className="w-3 h-3" />
                        <span>{isSelectedDay ? 'Viewing Day' : 'Filter Dashboard'}</span>
                      </button>

                      {onNavigateToHistoryWithDate && (
                        <button
                          onClick={() => onNavigateToHistoryWithDate(new Date(day.dateObj).toLocaleDateString('en-IN'))}
                          className="py-1.5 px-2 bg-slate-950 hover:bg-slate-800 text-teal-400 border border-slate-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
                          title="View all bills for this date in Bill History"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Bills</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ================= TABLE VIEW ================= */
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-950 text-slate-300 font-bold uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3.5">Date & Day</th>
                  <th className="py-3 px-3 text-right">Day Sales (₹)</th>
                  <th className="py-3 px-3 text-center">Bills</th>
                  <th className="py-3 px-3 text-center">Units Sold</th>
                  <th className="py-3 px-3 text-right">Avg / Bill</th>
                  <th className="py-3 px-3 text-center">Cash</th>
                  <th className="py-3 px-3 text-center">UPI</th>
                  <th className="py-3 px-3 text-center">Card</th>
                  <th className="py-3 px-3">Top Product of the Day</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredDailySales.map((day) => {
                  const isSelectedDay = dateRangeFilter === day.dateKey || (dateRangeFilter === 'today' && day.isToday) || (dateRangeFilter === 'yesterday' && day.isYesterday);

                  return (
                    <tr 
                      key={day.dateKey} 
                      className={`hover:bg-slate-800/50 transition ${
                        isSelectedDay ? 'bg-teal-950/30' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-2">
                          {day.isToday ? (
                            <span className="badge-green text-[10px] font-black">Today</span>
                          ) : day.isYesterday ? (
                            <span className="badge-blue text-[10px] font-bold">Yesterday</span>
                          ) : null}
                          <div>
                            <div className="font-bold text-white">{day.displayDate}</div>
                            <div className="text-[11px] text-slate-400">{day.dayOfWeek}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-sm text-emerald-400">
                        ₹{day.revenue.toLocaleString('en-IN')}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {day.revenueSharePct}% of total
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-white">{day.billsCount}</td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-200">{day.unitsSold}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-300">₹{day.avgTicketValue}</td>
                      <td className="py-3 px-3 text-center font-bold text-emerald-400">₹{day.cashTotal}</td>
                      <td className="py-3 px-3 text-center font-bold text-teal-400">₹{day.upiTotal}</td>
                      <td className="py-3 px-3 text-center font-bold text-amber-400">₹{day.cardTotal}</td>
                      <td className="py-3 px-3">
                        {day.topItems && day.topItems.length > 0 ? (
                          <div className="max-w-[180px] truncate">
                            <span className="font-semibold text-white">{day.topItems[0].name}</span>
                            <span className="text-teal-300 text-[11px] ml-1 font-bold">({day.topItems[0].qty} sold)</span>
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setDateRangeFilter(day.isToday ? 'today' : day.isYesterday ? 'yesterday' : day.dateKey)}
                            className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                              isSelectedDay 
                                ? 'bg-teal-600 text-white' 
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            }`}
                          >
                            {isSelectedDay ? 'Filtered' : 'Filter'}
                          </button>
                          {onNavigateToHistoryWithDate && (
                            <button
                              onClick={() => onNavigateToHistoryWithDate(new Date(day.dateObj).toLocaleDateString('en-IN'))}
                              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-teal-400 border border-slate-700 rounded text-[11px] font-bold transition"
                            >
                              Bills
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Middle Grid: Payment Breakdown & Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Payment Breakdown (5 cols) */}
        <div className="lg:col-span-5 glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Banknote className="w-5 h-5 text-teal-400" />
              Payment Collection Breakdown
            </h3>
            <span className="text-xs font-semibold text-slate-400">
              {dateRangeFilter === 'all' ? 'All Time' : dateRangeFilter === 'today' ? 'Today' : dateRangeFilter === 'yesterday' ? 'Yesterday' : dateRangeFilter}
            </span>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Cash Collection', amount: paymentBreakdown.Cash, icon: Banknote, color: 'emerald' },
              { label: 'UPI / QR Payments', amount: paymentBreakdown.UPI, icon: QrCode, color: 'teal' },
              { label: 'Card Payments', amount: paymentBreakdown.Card, icon: CreditCard, color: 'amber' }
            ].map(item => {
              const Icon = item.icon;
              const pct = kpis.totalRevenue > 0 ? Math.round((item.amount / kpis.totalRevenue) * 100) : 0;

              return (
                <div key={item.label} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-200 font-semibold">
                      <Icon className="w-4 h-4 text-teal-400" />
                      {item.label}
                    </div>
                    <div className="font-extrabold text-white">
                      ₹{item.amount.toLocaleString('en-IN')} ({pct}%)
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-teal-500 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top 5 Selling Products Mini-List (7 cols) */}
        <div className="lg:col-span-7 glass-panel p-5 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-white">Top 5 Selling Products</h3>
            </div>
            {onNavigateToItemSales && (
              <button
                onClick={onNavigateToItemSales}
                className="text-xs text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 hover:underline"
              >
                <span>View Full Item Tracker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {topSellers.map((item, idx) => (
              <div 
                key={item.id}
                onClick={onNavigateToItemSales ? onNavigateToItemSales : undefined}
                className={`bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 ${
                  onNavigateToItemSales ? 'cursor-pointer hover:border-teal-500/60 hover:bg-slate-800/80 transition' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs ${
                    idx === 0 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-900/50' :
                    idx === 1 ? 'bg-slate-300 text-slate-950' :
                    idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="font-bold text-white text-xs leading-tight">{item.name}</div>
                    <div className="text-[11px] text-slate-400">{item.brand} • {item.weight}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-extrabold text-emerald-400">
                    {item.qtySold} sold
                  </div>
                  <div className="text-[11px] text-slate-400">
                    ₹{item.amountSold.toLocaleString('en-IN')} total
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Live Stock Inventory Table */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">Live Stock & Inventory Status</h3>
            <p className="text-xs text-slate-400">Always updated live after every counter sale</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Pills */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-700 text-xs font-semibold">
              {[
                { id: 'all', label: 'All Items' },
                { id: 'low', label: 'Low Stock (<5)' },
                { id: 'out', label: 'Out of Stock' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStockFilter(f.id)}
                  className={`px-3 py-1 rounded-lg transition ${
                    stockFilter === f.id ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Table Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search live stock..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-300 font-bold uppercase border-b border-slate-700">
              <tr>
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Product Name & Weight</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3 text-center">MRP (₹)</th>
                <th className="py-3 px-3 text-center">Opening Qty</th>
                <th className="py-3 px-3 text-center">Total Sold Qty</th>
                <th className="py-3 px-3 text-center">Available Stock</th>
                <th className="py-3 px-3 text-right">Revenue (₹)</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredProducts.map(p => {
                const sales = productSalesMap[p.id] || { qtySold: 0, amountSold: 0 };
                const totalQtySold = sales.qtySold + (dateRangeFilter === 'all' || dateRangeFilter === 'yesterday' ? (p.alreadySoldYesterday || 0) : 0);
                const totalRev = sales.amountSold + ((dateRangeFilter === 'all' || dateRangeFilter === 'yesterday' ? (p.alreadySoldYesterday || 0) : 0) * p.mrp);

                return (
                  <tr key={p.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{p.srNo}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{p.name}</div>
                      <div className="text-[11px] text-slate-400">{p.weight}</div>
                    </td>
                    <td className="py-2.5 px-3 text-teal-400 font-semibold">{p.brand}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-400">₹{p.mrp}</td>
                    <td className="py-2.5 px-3 text-center text-slate-300">{p.openingQty}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-white">{totalQtySold}</td>
                    <td className="py-2.5 px-3 text-center font-extrabold text-sm">
                      <span className={p.currentStock <= 0 ? 'text-rose-400' : p.currentStock <= 5 ? 'text-amber-400' : 'text-emerald-400'}>
                        {p.currentStock}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      ₹{totalRev.toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {p.currentStock <= 0 ? (
                        <span className="badge-red">Out of Stock</span>
                      ) : p.currentStock <= 5 ? (
                        <span className="badge-amber">Low Stock</span>
                      ) : (
                        <span className="badge-green">In Stock</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

